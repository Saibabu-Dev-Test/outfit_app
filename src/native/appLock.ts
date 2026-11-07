// Fingerprint app lock (Android). Strong biometric only, no device PIN fallback.
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
export const LOCK_AFTER_MS = 30 * 1000; // lock again after 30 s in background

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

export const wasLockAsked = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(LOCK_ASKED_KEY)) === '1';
  } catch {
    return true; // don't nag if storage fails
  }
};

export const markLockAsked = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(LOCK_ASKED_KEY, '1');
  } catch {
    // ignore
  }
};

export type UnlockResult = 'success' | 'cancelled' | 'password' | 'invalidated' | 'error';

// Fingerprint prompt (bound to the session key when the lock is on). Never throws.
export const authenticate = async (
  title = 'Unlock OUTFIT',
  subtitle = 'Touch the fingerprint sensor',
  negativeText = 'Use password instead',
): Promise<UnlockResult> => {
  const r = await verifyFingerprint(title, subtitle, negativeText);
  if (r === 'lockout') return 'error';
  return r;
};
