// Fingerprint app lock (Android). Fingerprint, with the phone's PIN / pattern as fallback
// (Android 11+ keys; see AppLockModule.kt).
// The session encryption itself lives in sessionVault.ts.
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  disableHardwareLock,
  enableHardwareLock,
  LOCK_ENABLED_KEY,
  LockChange,
  Native,
  releaseLockWithoutPrompt,
  verifyFingerprint,
} from './sessionVault';

export {
  enableHardwareLock,
  disableHardwareLock,
  verifyFingerprint,
  wipeForPasswordLogin,
  wasUnlockedThisLaunch,
  setPrivacy,
  releaseLockWithoutPrompt,
  FINGERPRINTS_CHANGED_MESSAGE,
} from './sessionVault';
export type { LockChange, VerifyResult } from './sessionVault';
export { LOCK_ENABLED_KEY };

const Legacy: { isAvailable?: () => Promise<boolean> } | undefined = NativeModules.OutfitAppLock;

export const LOCK_ASKED_KEY = 'outfit:appLockAsked';
export const LOCK_AFTER_MS = 60 * 1000; // lock again after more than 1 min in background
// Per-user choice, kept across sign-out (not under "outfit:", which logout clears):
//   outfitlock:asked:<uid> = '1' once offered; outfitlock:on:<uid> = '1' | '0'
const userAskedKey = (uid: string) => `outfitlock:asked:${uid}`;
const userPrefKey = (uid: string) => `outfitlock:on:${uid}`;

// True when the phone has a strong biometric (fingerprint) enrolled. Never throws.
export const isLockSupported = async (): Promise<boolean> => {
  if (Platform.OS !== 'android' || !Native || !Legacy?.isAvailable) return false;
  try {
    return !!(await Legacy.isAvailable());
  } catch {
    return false;
  }
};

export const isLockEnabled = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(LOCK_ENABLED_KEY)) === '1';
  } catch {
    return false;
  }
};

// Only for turning the flag off when the phone has no fingerprint left.
// Turning the lock on/off goes through enableHardwareLock / disableHardwareLock.
export const setLockEnabled = async (on: boolean): Promise<void> => {
  try {
    if (on) await AsyncStorage.setItem(LOCK_ENABLED_KEY, '1');
    else await AsyncStorage.removeItem(LOCK_ENABLED_KEY);
  } catch (e: any) {
    console.warn('App lock flag save failed:', e?.message);
  }
};

export const wasLockAsked = async (uid?: string | null): Promise<boolean> => {
  try {
    if (uid) return (await AsyncStorage.getItem(userAskedKey(uid))) === '1';
    return (await AsyncStorage.getItem(LOCK_ASKED_KEY)) === '1';
  } catch {
    return true; // don't nag if storage fails
  }
};

export const markLockAsked = async (uid?: string | null): Promise<void> => {
  try {
    await AsyncStorage.setItem(LOCK_ASKED_KEY, '1');
    if (uid) await AsyncStorage.setItem(userAskedKey(uid), '1');
  } catch {
    // ignore
  }
};

// This user's own choice on this phone: true / false, or null when never chosen
export const getUserLockPref = async (uid?: string | null): Promise<boolean | null> => {
  if (!uid) return null;
  try {
    const v = await AsyncStorage.getItem(userPrefKey(uid));
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
};

export const setUserLockPref = async (uid: string | null | undefined, on: boolean): Promise<void> => {
  if (!uid) return;
  try {
    await AsyncStorage.setItem(userPrefKey(uid), on ? '1' : '0');
    await AsyncStorage.setItem(userAskedKey(uid), '1');
  } catch {}
};

export type UnlockResult = 'success' | 'cancelled' | 'password' | 'invalidated' | 'error';

// Fingerprint prompt (bound to the session key when the lock is on). Never throws.
export const authenticate = async (
  title = 'Unlock OUTFIT',
  subtitle = 'Use your fingerprint or screen lock',
  negativeText = 'Sign out',
): Promise<UnlockResult> => {
  const r = await verifyFingerprint(title, subtitle, negativeText);
  if (r === 'lockout') return 'error';
  return r;
};

// ── Optional app lock (off by default; Settings → App lock) ─────────────────────
// 'biometric'   fingerprint enrolled: hardware-bound session lock (enableHardwareLock)
// 'screenlock'  only a PIN / pattern / password: prompt-only lock (SOFT_LOCK_KEY)
// 'none'        no screen lock yet: the user must set one before using the app
// 'unsupported' the phone has no secure lock screen at all: allowed, with a one-time notice
export type LockCapability = 'biometric' | 'screenlock' | 'none' | 'unsupported';

const Cap: { lockCapability?: () => Promise<string>; openSecuritySettings?: () => Promise<boolean> } | undefined =
  NativeModules.OutfitAppLock;

export const SOFT_LOCK_KEY = 'outfit:appLockSoft';
const noLockNoticeKey = (uid: string) => `outfitlock:nolocknotice:${uid}`;

export const getLockCapability = async (): Promise<LockCapability> => {
  if (Platform.OS !== 'android') return 'unsupported';
  try {
    if (Cap?.lockCapability) {
      const r = String(await Cap.lockCapability());
      if (r === 'biometric' || r === 'screenlock' || r === 'none' || r === 'unsupported') return r;
    }
  } catch {}
  // Older native build: fall back to the fingerprint check only
  return (await isLockSupported()) ? 'biometric' : 'unsupported';
};

export const openSecuritySettings = async (): Promise<void> => {
  try {
    await Cap?.openSecuritySettings?.();
  } catch {}
};

export const isSoftLockOn = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(SOFT_LOCK_KEY)) === '1';
  } catch {
    return false;
  }
};

export const setSoftLock = async (on: boolean): Promise<void> => {
  try {
    if (on) await AsyncStorage.setItem(SOFT_LOCK_KEY, '1');
    else await AsyncStorage.removeItem(SOFT_LOCK_KEY);
  } catch {}
};

// Shown once per user on a phone that cannot have a screen lock
export const takeNoLockNotice = async (uid: string): Promise<boolean> => {
  try {
    if ((await AsyncStorage.getItem(noLockNoticeKey(uid))) === '1') return false;
    await AsyncStorage.setItem(noLockNoticeKey(uid), '1');
    return true;
  } catch {
    return false;
  }
};

// ── Optional app lock ──────────────────────────────────────────────────────────
// Off by default. The user turns it on in Settings:
//   fingerprint enrolled -> hardware-bound session lock (enableHardwareLock)
//   only PIN / pattern   -> prompt-only lock with the screen lock (SOFT_LOCK_KEY)
// Builds before this one forced the lock on for everyone; migrateToOptionalLock() switches that
// forced lock off once per phone (not under "outfit:", so logout keeps the marker).
const OPTIONAL_MIGRATED_KEY = 'outfitlock:optional:v1';

const markMigrated = async () => {
  try {
    await AsyncStorage.setItem(OPTIONAL_MIGRATED_KEY, '1');
  } catch {}
};

// One time: turn off a lock that the old build forced on. Never prompts, never throws.
export const migrateToOptionalLock = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  try {
    if ((await AsyncStorage.getItem(OPTIONAL_MIGRATED_KEY)) === '1') return;
    await setSoftLock(false);
    if (await isLockEnabled()) {
      // Needs the session already unlocked this launch; otherwise try again next launch
      if (!(await releaseLockWithoutPrompt())) return;
    }
    await markMigrated();
  } catch {}
};

// App lock on or off right now (hardware or screen-lock lock)
export const isAppLockOn = async (): Promise<boolean> =>
  ((await isLockEnabled()) && (await isLockSupported())) || (await isSoftLockOn());

// Settings switch ON. Uses what this phone has. Never throws.
export const turnOnAppLock = async (uid?: string | null): Promise<LockChange> => {
  await markMigrated();
  const cap = await getLockCapability();
  if (cap === 'biometric') {
    const r = await enableHardwareLock();
    if (r.ok) {
      await setSoftLock(false);
      await setUserLockPref(uid, true);
    }
    return r;
  }
  if (cap === 'screenlock') {
    const r = await authenticate('Turn on app lock', 'Confirm with your screen lock', 'Cancel');
    if (r !== 'success') return { ok: false };
    await setSoftLock(true);
    await setUserLockPref(uid, true);
    return { ok: true };
  }
  if (cap === 'none') {
    return { ok: false, message: 'Set a screen lock (fingerprint, PIN, pattern or password) in your phone settings first.' };
  }
  return { ok: false, message: 'This phone has no screen lock, so Outfit can\'t be locked.' };
};

// Settings switch OFF: one fingerprint / screen-lock check. Never throws.
export const turnOffAppLock = async (uid?: string | null): Promise<LockChange> => {
  await markMigrated();
  if (await isLockEnabled()) {
    const r = await disableHardwareLock();
    if (!r.ok) return r;
  } else if (await isSoftLockOn()) {
    const r = await authenticate('Turn off app lock', 'Confirm with your screen lock', 'Cancel');
    if (r !== 'success' && r !== 'error') return { ok: false };
  }
  await setSoftLock(false);
  await setUserLockPref(uid, false);
  return { ok: true };
};
