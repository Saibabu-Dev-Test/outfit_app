// Hardware-bound session vault (Android).
//
// When the fingerprint lock is on, the Firebase Auth session (the AsyncStorage keys firebase/auth
// writes through getReactNativePersistence, e.g. "firebase:authUser:<apiKey>:[DEFAULT]" with the
// refresh token) is never stored in plaintext. It lives in AsyncStorage only as one encrypted blob
// (BLOB_KEY): AES-256-GCM, with the AES key wrapped by an Android Keystore RSA key whose private
// half needs a fingerprint for every use. Writes (token refreshes) use the public key, no prompt.
// At cold start the blob is decrypted once behind BiometricPrompt into an in-memory cache, and
// only then can firebase/auth read its session (its reads wait on `ready`).
//
// If someone patches the JS to skip the lock screen, auth still has nothing to read: the refresh
// token only exists inside the Keystore-protected blob.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

interface NativeLock {
  isAvailable: () => Promise<boolean>;
  authenticate: (title: string, subtitle: string, negativeText: string) => Promise<string>;
  hasKey: () => Promise<boolean>;
  createKey: (preferStrongBox: boolean) => Promise<string>;
  deleteKey: () => Promise<boolean>;
  encrypt: (plain: string) => Promise<string>;
  decrypt: (blob: string, title: string, subtitle: string, negativeText: string) => Promise<string>;
  verifySignature: () => Promise<{ ok: boolean; sha256: string }>;
  setPrivacy: (enabled: boolean, screenShown: boolean) => Promise<boolean>;
}

const RawNative: Partial<NativeLock> | undefined =
  Platform.OS === 'android' ? NativeModules.OutfitAppLock : undefined;
// The full native vault is present (Android build with the new AppLockModule)
export const Native: NativeLock | undefined =
  RawNative && typeof RawNative.decrypt === 'function' ? (RawNative as NativeLock) : undefined;

// Shared with appLock.ts (kept here so this file has no app imports)
export const LOCK_ENABLED_KEY = 'outfit:appLockEnabled';
// Not under "outfit:" so logout's app-key cleanup can't drop it before signOut wipes it properly
const BLOB_KEY = 'outfitvault:session';
const BACKEND_KEY = 'outfitvault:backend'; // "strongbox" | "tee"
const NO_STRONGBOX_KEY = 'outfitvault:noStrongBox'; // StrongBox key failed once on this phone
const FIREBASE_PREFIX = 'firebase:';
const PROBE_KEY = '__sak'; // firebase/auth's storage-available probe ("1"), not a secret

export const FINGERPRINTS_CHANGED_MESSAGE =
  'Fingerprints changed on this phone. Please sign in again.';

export type VaultStatus =
  | 'checking' // reading the lock state
  | 'locked' // session encrypted, waiting for the fingerprint
  | 'unlocking' // prompt showing
  | 'invalidated' // key invalidated / blob unreadable: session wiped, tell the user
  | 'tampered' // APK signature mismatch: blocked
  | 'ready'; // auth may read its session

type Mode = 'plain' | 'secure';

let mode: Mode = 'plain';
let cache: Record<string, string> = {};
let status: VaultStatus = 'checking';
let tampered = false;
let unlockedThisLaunch = false;
let lockOnCached = false;

let resolveReady: () => void = () => {};
const ready = new Promise<void>(r => {
  resolveReady = r;
});
const finishReady = () => resolveReady();

const listeners = new Set<(s: VaultStatus) => void>();
const setStatus = (s: VaultStatus) => {
  status = s;
  listeners.forEach(l => l(s));
};
export const getVaultStatus = (): VaultStatus => status;
export const subscribeVault = (l: (s: VaultStatus) => void): (() => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
// True when this launch already unlocked the session with a fingerprint
export const wasUnlockedThisLaunch = (): boolean => unlockedThisLaunch;
// True while the Firebase session is held encrypted (lock on)
export const isSecureMode = (): boolean => mode === 'secure';

// All writes run one at a time, in order (firebase writes, enable/disable switches)
let chain: Promise<unknown> = Promise.resolve();
const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
};

const flagOn = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(LOCK_ENABLED_KEY)) === '1';
  } catch {
    return false;
  }
};

export const setPrivacy = (enabled: boolean, screenShown: boolean) => {
  lockOnCached = enabled;
  Native?.setPrivacy(enabled, screenShown).catch(() => undefined);
};
export const isLockOnCached = () => lockOnCached;

const biometricAvailable = async (): Promise<boolean> => {
  try {
    return !!(await Native?.isAvailable());
  } catch {
    return false;
  }
};

// Plaintext Firebase session keys currently in AsyncStorage
const readPlainSession = async (): Promise<Record<string, string>> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    k => k.startsWith(FIREBASE_PREFIX) && k !== PROBE_KEY,
  );
  const out: Record<string, string> = {};
  if (!keys.length) return out;
  const pairs = await AsyncStorage.multiGet(keys);
  pairs.forEach(([k, v]) => {
    if (v != null) out[k] = v;
  });
  return out;
};

/**
 * Lists every AsyncStorage key and removes any plaintext Firebase session key while the lock is
 * on. Returns the keys it had to remove (expected: none). Runs at start, after enabling the lock
 * and after every encrypted write.
 */
export const auditPlaintext = async (): Promise<string[]> => {
  if (mode !== 'secure') return [];
  try {
    const leaked = (await AsyncStorage.getAllKeys()).filter(
      k => k.startsWith(FIREBASE_PREFIX) && k !== PROBE_KEY,
    );
    if (leaked.length) {
      await AsyncStorage.multiRemove(leaked);
      console.warn('Vault: removed plaintext session keys', leaked.length);
    }
    return leaked;
  } catch (e: any) {
    console.warn('Vault audit failed:', e?.message);
    return [];
  }
};

const preferStrongBox = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(NO_STRONGBOX_KEY)) !== '1';
  } catch {
    return true;
  }
};

const createKey = async (strongBox: boolean): Promise<string> => {
  if (!Native) return 'error:no native';
  const be = String(await Native.createKey(strongBox));
  if (!be.startsWith('error')) await AsyncStorage.setItem(BACKEND_KEY, be).catch(() => undefined);
  return be;
};

// Encrypts with the public key (creates the key pair if it is missing). null on failure.
const encryptJson = async (data: Record<string, string>): Promise<string | null> => {
  if (!Native) return null;
  const json = JSON.stringify(data);
  let r = String(await Native.encrypt(json));
  if (r === 'error:nokey') {
    const be = await createKey(await preferStrongBox());
    if (be.startsWith('error')) {
      console.warn('Vault key create failed:', be);
      return null;
    }
    r = String(await Native.encrypt(json));
  }
  if (r.startsWith('error')) {
    console.warn('Vault encrypt failed:', r);
    return null;
  }
  return r;
};

// Saves the cache as the encrypted blob. Never writes plaintext while the lock is on.
const persistSecure = async (): Promise<boolean> => {
  if (tampered) return false; // memory only
  if (!Object.keys(cache).length) {
    await AsyncStorage.removeItem(BLOB_KEY);
    // Logout clears the lock flag before signOut: go back to normal storage
    if (!(await flagOn())) {
      mode = 'plain';
      setPrivacy(false, false);
      await Native?.deleteKey().catch(() => undefined);
    }
    return true;
  }
  const blob = await encryptJson(cache);
  if (blob) {
    await AsyncStorage.setItem(BLOB_KEY, blob);
    await auditPlaintext();
    return true;
  }
  if (!(await biometricAvailable())) {
    // No fingerprint left on the phone (removing them needs the phone's PIN): the lock can't
    // work any more, so turn it off and keep the user signed in, as before.
    const entries = Object.entries(cache);
    mode = 'plain';
    cache = {};
    await AsyncStorage.removeItem(LOCK_ENABLED_KEY);
    await AsyncStorage.removeItem(BLOB_KEY);
    if (entries.length) await AsyncStorage.multiSet(entries);
    setPrivacy(false, false);
    return false;
  }
  // Keep the session in memory only for this run (signed out at next cold start)
  return false;
};

// Removes the session everywhere (blob, cache, any plaintext copy)
const wipeSession = async () => {
  cache = {};
  try {
    await AsyncStorage.removeItem(BLOB_KEY);
    const keys = (await AsyncStorage.getAllKeys()).filter(
      k => k.startsWith(FIREBASE_PREFIX) && k !== PROBE_KEY,
    );
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch (e: any) {
    console.warn('Vault wipe failed:', e?.message);
  }
};

// ── Storage passed to getReactNativePersistence ──
export const secureAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (key === PROBE_KEY) return AsyncStorage.getItem(key);
    await ready;
    if (mode === 'secure') return cache[key] ?? null;
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (key === PROBE_KEY) return AsyncStorage.setItem(key, value);
    return enqueue(async () => {
      await ready;
      if (mode === 'secure') {
        cache[key] = value;
        await persistSecure();
        if ((mode as Mode) === 'secure') await AsyncStorage.removeItem(key); // never a plaintext copy
      } else {
        await AsyncStorage.setItem(key, value);
      }
    });
  },
  removeItem: (key: string): Promise<void> => {
    if (key === PROBE_KEY) return AsyncStorage.removeItem(key);
    return enqueue(async () => {
      await ready;
      if (mode === 'secure') {
        delete cache[key];
        await persistSecure();
      }
      await AsyncStorage.removeItem(key);
    });
  },
};

// ── Cold start ──
const boot = async () => {
  if (!Native) {
    // iOS, tests, or an old native build: normal storage
    mode = 'plain';
    setStatus('ready');
    finishReady();
    return;
  }
  try {
    const sig = await Native.verifySignature();
    if (!sig?.ok) {
      console.warn('Signature mismatch:', sig?.sha256);
      tampered = true;
      mode = 'secure'; // memory only from here on
      await wipeSession();
      await Native.deleteKey().catch(() => undefined);
      setStatus('tampered');
      finishReady();
      return;
    }
    const on = await flagOn();
    const blob = await AsyncStorage.getItem(BLOB_KEY);
    if (!on) {
      if (blob) {
        // Leftover from a lock that was turned off mid-way: unreadable without a prompt, drop it
        await AsyncStorage.removeItem(BLOB_KEY);
        await Native.deleteKey().catch(() => undefined);
      }
      mode = 'plain';
      setPrivacy(false, false);
      setStatus('ready');
      finishReady();
      return;
    }
    setPrivacy(true, false);
    if (!blob) {
      const plain = await readPlainSession();
      if (!Object.keys(plain).length) {
        // Lock on, nobody signed in: next login is stored encrypted
        mode = 'secure';
        cache = {};
        setStatus('ready');
        finishReady();
        return;
      }
      // Lock was turned on in an older build (plaintext session): encrypt it now
      cache = plain;
      mode = 'secure';
      const saved = await persistSecure();
      if (!saved) {
        if ((mode as Mode) === 'plain') {
          // No fingerprint on the phone: lock was turned off, session kept
          setStatus('ready');
          finishReady();
          return;
        }
        // Encryption failed: keep the old plaintext session and the old screen lock
        mode = 'plain';
        cache = {};
        setStatus('ready');
        finishReady();
        return;
      }
      await AsyncStorage.multiRemove(Object.keys(plain));
      await auditPlaintext();
    } else {
      mode = 'secure';
      await auditPlaintext();
    }
    setStatus('locked'); // the lock screen calls unlockSession()
  } catch (e: any) {
    console.warn('Vault start failed:', e?.message);
    // Fail closed: no session is read
    mode = 'secure';
    cache = {};
    setStatus('ready');
    finishReady();
  }
};
boot();

export type ColdUnlockResult =
  | 'ok'
  | 'cancelled'
  | 'lockout'
  | 'password'
  | 'invalidated'
  | 'tampered'
  | 'error';

// Shows the fingerprint prompt and decrypts the session (cold start). Never throws.
export const unlockSession = async (): Promise<ColdUnlockResult> => {
  if (!Native || status !== 'locked') return status === 'ready' ? 'ok' : 'error';
  setStatus('unlocking');
  let r = 'error:';
  try {
    const blob = await AsyncStorage.getItem(BLOB_KEY);
    r = blob
      ? String(await Native.decrypt(blob, 'Unlock OUTFIT', 'Touch the fingerprint sensor', 'Use password instead'))
      : 'failed';
  } catch (e: any) {
    r = `error:${e?.message || ''}`;
  }
  if (r.startsWith('ok:')) {
    try {
      const parsed = JSON.parse(r.slice(3));
      cache = parsed && typeof parsed === 'object' ? parsed : {};
      unlockedThisLaunch = true;
      setStatus('ready');
      finishReady();
      return 'ok';
    } catch {
      r = 'failed';
    }
  }
  if (r === 'cancelled' || r === 'lockout') {
    setStatus('locked');
    return r;
  }
  if (r === 'password') {
    await wipeSession();
    setStatus('ready');
    finishReady();
    return 'password';
  }
  if (r === 'tampered') {
    tampered = true;
    await wipeSession();
    setStatus('tampered');
    finishReady();
    return 'tampered';
  }
  const available = await biometricAvailable();
  if (r === 'invalidated' || r === 'failed' || !available) {
    if (r === 'failed') {
      // A StrongBox key that can't decrypt: use the TEE next time
      const be = await AsyncStorage.getItem(BACKEND_KEY).catch(() => null);
      if (be === 'strongbox') await AsyncStorage.setItem(NO_STRONGBOX_KEY, '1').catch(() => undefined);
    }
    await wipeSession();
    await Native.deleteKey().catch(() => undefined);
    if (!available) {
      // No fingerprint left: the lock can't be used; next login is stored normally
      await AsyncStorage.removeItem(LOCK_ENABLED_KEY).catch(() => undefined);
      mode = 'plain';
      setPrivacy(false, false);
    }
    finishReady(); // auth starts signed out
    setStatus('invalidated');
    return 'invalidated';
  }
  console.warn('Unlock prompt:', r);
  setStatus('locked');
  return 'error';
};

// Cold lock screen "Use password instead": wipe the encrypted session, auth starts signed out
export const forgetLockedSession = async (): Promise<boolean> => {
  if (status !== 'locked') return false;
  await wipeSession();
  setStatus('ready');
  finishReady();
  return true;
};

// "Sign in again" on the fingerprints-changed screen
export const acknowledgeInvalidated = () => {
  if (status === 'invalidated') setStatus('ready');
};

// Lock screen relock (after 30 s in background): fingerprint bound to the key when possible
export type VerifyResult = 'success' | 'cancelled' | 'password' | 'lockout' | 'invalidated' | 'error';
export const verifyFingerprint = async (
  title = 'Unlock OUTFIT',
  subtitle = 'Touch the fingerprint sensor',
  negativeText = 'Use password instead',
): Promise<VerifyResult> => {
  if (!Native) return 'error';
  try {
    const blob = mode === 'secure' ? await AsyncStorage.getItem(BLOB_KEY) : null;
    if (blob) {
      const r = String(await Native.decrypt(blob, title, subtitle, negativeText));
      if (r.startsWith('ok:')) return 'success';
      if (r === 'cancelled' || r === 'password' || r === 'lockout') return r;
      if (r === 'invalidated' || r === 'failed' || r === 'tampered') {
        await wipeSession();
        await Native.deleteKey().catch(() => undefined);
        if (!(await biometricAvailable())) {
          await AsyncStorage.removeItem(LOCK_ENABLED_KEY).catch(() => undefined);
          mode = 'plain';
          setPrivacy(false, false);
        }
        return 'invalidated';
      }
      console.warn('Relock prompt:', r);
      return 'error';
    }
    const r = String(await Native.authenticate(title, subtitle, negativeText));
    if (r === 'success' || r === 'cancelled' || r === 'password' || r === 'lockout') return r;
    console.warn('Relock prompt:', r);
    return 'error';
  } catch (e: any) {
    console.warn('Relock prompt failed:', e?.message);
    return 'error';
  }
};

// Wipes the session for "Use password instead" (the caller signs out of Firebase and Google)
export const wipeForPasswordLogin = async () => {
  await enqueue(async () => {
    await wipeSession();
  });
};

export interface LockChange {
  ok: boolean;
  message?: string; // shown to the user when set
  invalidated?: boolean; // session wiped: caller signs out
}

// Turn the lock ON: new key pair, prove one fingerprint can decrypt, then encrypt the session.
export const enableHardwareLock = async (): Promise<LockChange> => {
  if (!Native) return { ok: false, message: 'Fingerprint lock needs the latest app on Android.' };
  if (!(await biometricAvailable())) {
    return { ok: false, message: 'Add a fingerprint in your phone settings first.' };
  }
  const attempt = async (strongBox: boolean): Promise<{ r: string; be: string }> => {
    const be = await createKey(strongBox);
    if (be.startsWith('error')) return { r: be, be };
    const blob = String(await Native.encrypt(JSON.stringify(await readPlainSession())));
    if (blob.startsWith('error')) return { r: blob, be };
    const r = String(await Native.decrypt(blob, 'Turn on app lock', 'Confirm with your fingerprint', 'Cancel'));
    return { r, be };
  };
  try {
    let { r, be } = await attempt(await preferStrongBox());
    if (be === 'strongbox' && (r === 'failed' || r === 'invalidated' || r.startsWith('error'))) {
      await AsyncStorage.setItem(NO_STRONGBOX_KEY, '1').catch(() => undefined);
      ({ r, be } = await attempt(false));
    }
    if (!r.startsWith('ok:')) {
      await Native.deleteKey().catch(() => undefined);
      if (r === 'cancelled' || r === 'password') return { ok: false };
      if (r === 'lockout') return { ok: false, message: 'Too many tries. Wait a little and try again.' };
      if (r === 'error:tampered' || r === 'tampered') {
        return { ok: false, message: 'This copy of OUTFIT was modified. Install the official app.' };
      }
      console.warn('Enable lock failed:', r, be);
      return { ok: false, message: 'Fingerprint lock could not be turned on on this phone.' };
    }
    // Switch storage: from here every Firebase write is encrypted
    const saved = await enqueue(async () => {
      const plain = await readPlainSession();
      cache = plain;
      mode = 'secure';
      await AsyncStorage.setItem(LOCK_ENABLED_KEY, '1');
      const ok = await persistSecure();
      if (!ok) {
        // Roll back to plaintext with the lock off
        mode = 'plain';
        cache = {};
        await AsyncStorage.removeItem(LOCK_ENABLED_KEY);
        await AsyncStorage.removeItem(BLOB_KEY);
        if (Object.keys(plain).length) await AsyncStorage.multiSet(Object.entries(plain));
        return false;
      }
      if (Object.keys(plain).length) await AsyncStorage.multiRemove(Object.keys(plain));
      return true;
    });
    if (!saved) {
      await Native.deleteKey().catch(() => undefined);
      return { ok: false, message: 'Fingerprint lock could not be turned on on this phone.' };
    }
    await auditPlaintext();
    unlockedThisLaunch = true;
    setPrivacy(true, false);
    return { ok: true };
  } catch (e: any) {
    console.warn('Enable lock error:', e?.message);
    return { ok: false, message: 'Fingerprint lock could not be turned on on this phone.' };
  }
};

// Turn the lock OFF: one fingerprint, then the session is stored as plaintext again.
export const disableHardwareLock = async (): Promise<LockChange> => {
  if (!Native) {
    await AsyncStorage.removeItem(LOCK_ENABLED_KEY).catch(() => undefined);
    return { ok: true };
  }
  try {
    const blob = mode === 'secure' ? await AsyncStorage.getItem(BLOB_KEY) : null;
    let r: string;
    if (blob) {
      r = String(await Native.decrypt(blob, 'Turn off app lock', 'Confirm with your fingerprint', 'Cancel'));
    } else {
      // Session only in memory (or lock from an older build): plain fingerprint check
      const a = String(await Native.authenticate('Turn off app lock', 'Confirm with your fingerprint', 'Cancel'));
      r = a === 'success' ? 'ok:' : a;
    }
    if (!r.startsWith('ok:')) {
      if (r === 'cancelled' || r === 'password') return { ok: false };
      if (r === 'lockout') return { ok: false, message: 'Too many tries. Wait a little and try again.' };
      if (r === 'invalidated' || r === 'failed' || r === 'tampered') {
        await enqueue(async () => {
          await wipeSession();
        });
        await Native.deleteKey().catch(() => undefined);
        return { ok: false, invalidated: true, message: FINGERPRINTS_CHANGED_MESSAGE };
      }
      console.warn('Disable lock failed:', r);
      return { ok: false, message: 'Could not check your fingerprint. Try again.' };
    }
    await enqueue(async () => {
      const entries = Object.entries(cache);
      mode = 'plain';
      cache = {};
      if (entries.length) await AsyncStorage.multiSet(entries);
      await AsyncStorage.removeItem(BLOB_KEY);
      await AsyncStorage.removeItem(LOCK_ENABLED_KEY);
    });
    await Native.deleteKey().catch(() => undefined);
    setPrivacy(false, false);
    return { ok: true };
  } catch (e: any) {
    console.warn('Disable lock error:', e?.message);
    return { ok: false, message: 'Could not check your fingerprint. Try again.' };
  }
};
