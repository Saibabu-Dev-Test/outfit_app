// Fingerprint app lock with the phone's own biometrics (device PIN as fallback). Android only.
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Native:
  | { isAvailable?: () => Promise<boolean>; authenticate?: (t: string, s: string) => Promise<string> }
  | undefined = NativeModules.OutfitAppLock;

export const LOCK_ENABLED_KEY = 'outfit:appLockEnabled';
export const LOCK_ASKED_KEY = 'outfit:appLockAsked';
export const LOCK_AFTER_MS = 30 * 1000; // lock again after 30 s in background

// True when the phone has a fingerprint enrolled. Never throws.
export const isLockSupported = async (): Promise<boolean> => {
  if (Platform.OS !== 'android' || !Native?.isAvailable) return false;
  try {
    return !!(await Native.isAvailable());
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

export type UnlockResult = 'success' | 'cancelled' | 'error';

// Shows the system fingerprint prompt. Never throws.
export const authenticate = async (
  title = 'Unlock Outfit',
  subtitle = 'Use your fingerprint or phone PIN',
): Promise<UnlockResult> => {
  if (!Native?.authenticate) return 'error';
  try {
    const r = String(await Native.authenticate(title, subtitle));
    if (r === 'success') return 'success';
    if (r === 'cancelled') return 'cancelled';
    console.warn('App lock prompt:', r);
    return 'error';
  } catch (e: any) {
    console.warn('App lock prompt failed:', e?.message);
    return 'error';
  }
};
