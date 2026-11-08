// Fingerprint app lock (Android). Fingerprint, with the phone's PIN / pattern as fallback
// (Android 11+ keys; see AppLockModule.kt).
// The session encryption itself lives in sessionVault.ts.
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCK_ENABLED_KEY, Native, verifyFingerprint } from './sessionVault';

export {
  enableHardwareLock,
  disableHardwareLock,
  verifyFingerprint,
  wipeForPasswordLogin,
  wasUnlockedThisLaunch,
  setPrivacy,
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
