// Web build: no hardware vault, no fingerprint, no APK signature check.
// Firebase Auth keeps the session itself with browserLocalPersistence (firebaseConfig.web.ts),
// so this file only gives the same exports as sessionVault.ts with "always ready" values.
export const Native = undefined;

export const LOCK_ENABLED_KEY = 'outfit:appLockEnabled';
export const FINGERPRINTS_CHANGED_MESSAGE =
  'Fingerprints changed on this phone. Please sign in again.';

export type VaultStatus = 'checking' | 'locked' | 'unlocking' | 'invalidated' | 'tampered' | 'ready';
export type ColdUnlockResult = 'ok' | 'cancelled' | 'lockout' | 'password' | 'invalidated' | 'tampered' | 'error';
export type VerifyResult = 'success' | 'cancelled' | 'password' | 'lockout' | 'invalidated' | 'error';
export interface LockChange {
  ok: boolean;
  message?: string;
  invalidated?: boolean;
}

const NO_LOCK = 'Fingerprint lock is only in the Android app.';

export const getVaultStatus = (): VaultStatus => 'ready';
export const subscribeVault = (_l: (s: VaultStatus) => void): (() => void) => () => {};
export const wasUnlockedThisLaunch = (): boolean => false;
export const isSecureMode = (): boolean => false;
export const setPrivacy = (_enabled: boolean, _screenShown: boolean) => {};
export const isLockOnCached = () => false;
export const auditPlaintext = async (): Promise<string[]> => [];
// Not used on web (firebaseConfig.web.ts uses browserLocalPersistence), kept for the same exports
export const secureAuthStorage = {
  getItem: async (_key: string): Promise<string | null> => null,
  setItem: async (_key: string, _value: string): Promise<void> => {},
  removeItem: async (_key: string): Promise<void> => {},
};
export const unlockSession = async (): Promise<ColdUnlockResult> => 'ok';
export const forgetLockedSession = async (): Promise<boolean> => false;
export const acknowledgeInvalidated = () => {};
export const verifyFingerprint = async (
  _title?: string,
  _subtitle?: string,
  _negativeText?: string,
): Promise<VerifyResult> => 'error';
export const wipeForPasswordLogin = async () => {};
export const enableHardwareLock = async (): Promise<LockChange> => ({ ok: false, message: NO_LOCK });
export const disableHardwareLock = async (): Promise<LockChange> => ({ ok: true });
export const releaseLockWithoutPrompt = async (): Promise<boolean> => true;
