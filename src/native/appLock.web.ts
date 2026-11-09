// Web build: no fingerprint lock (the browser keeps the Firebase session, see firebaseConfig.web.ts)
export {
  enableHardwareLock,
  disableHardwareLock,
  verifyFingerprint,
  wipeForPasswordLogin,
  wasUnlockedThisLaunch,
  setPrivacy,
  releaseLockWithoutPrompt,
  FINGERPRINTS_CHANGED_MESSAGE,
  LOCK_ENABLED_KEY,
} from './sessionVault.web';
export type { LockChange, VerifyResult } from './sessionVault.web';

export const LOCK_ASKED_KEY = 'outfit:appLockAsked';
export const LOCK_AFTER_MS = 60 * 1000;

export const isLockSupported = async (): Promise<boolean> => false;
export const isLockEnabled = async (): Promise<boolean> => false;
export const setLockEnabled = async (_on: boolean): Promise<void> => {};
export const wasLockAsked = async (_uid?: string | null): Promise<boolean> => true;
export const markLockAsked = async (_uid?: string | null): Promise<void> => {};
export const getUserLockPref = async (_uid?: string | null): Promise<boolean | null> => null;
export const setUserLockPref = async (_uid: string | null | undefined, _on: boolean): Promise<void> => {};

export type UnlockResult = 'success' | 'cancelled' | 'password' | 'invalidated' | 'error';
export const authenticate = async (
  _title?: string,
  _subtitle?: string,
  _negativeText?: string,
): Promise<UnlockResult> => 'error';

// Optional app lock: no-op on web
export type LockCapability = 'biometric' | 'screenlock' | 'none' | 'unsupported';
export const SOFT_LOCK_KEY = 'outfit:appLockSoft';
export const getLockCapability = async (): Promise<LockCapability> => 'unsupported';
export const openSecuritySettings = async (): Promise<void> => {};
export const isSoftLockOn = async (): Promise<boolean> => false;
export const setSoftLock = async (_on: boolean): Promise<void> => {};
export const takeNoLockNotice = async (_uid: string): Promise<boolean> => false;
export const migrateToOptionalLock = async (): Promise<void> => {};
export const isAppLockOn = async (): Promise<boolean> => false;
export const turnOnAppLock = async (_uid?: string | null): Promise<{ ok: boolean; message?: string; invalidated?: boolean }> => ({
  ok: false,
  message: 'App lock is only in the Android app.',
});
export const turnOffAppLock = async (_uid?: string | null): Promise<{ ok: boolean; message?: string; invalidated?: boolean }> => ({
  ok: true,
});
