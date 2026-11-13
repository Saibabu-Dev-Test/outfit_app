// Start-up safe mode + boot health (Android: CrashModule.kt). When the app died during start-up
// twice in a row, CrashModule switches safe mode on for this build: the optional native features
// (ads, coin sound, keyboard animation, coin flip overlay) are skipped so the app still opens and
// the next launch can show what went wrong. A new build clears it. Never throws.
import { NativeModules, Platform } from 'react-native';

interface NativeCrash {
  safeMode?: boolean;
  nativeDialog?: boolean;
  getConstants?: () => { safeMode?: boolean; nativeDialog?: boolean };
  markBootOk?: () => void;
  saveJsCrash?: (text: string) => void;
  getLastCrash?: () => Promise<string | null>;
}

export const crashNative = (): NativeCrash | undefined => {
  try {
    return Platform.OS === 'android' ? (NativeModules.OutfitCrash as NativeCrash | undefined) : undefined;
  } catch {
    return undefined;
  }
};

const constant = (key: 'safeMode' | 'nativeDialog'): boolean => {
  try {
    const n = crashNative();
    if (!n) return false;
    if (typeof n[key] === 'boolean') return n[key] as boolean;
    const c = typeof n.getConstants === 'function' ? n.getConstants() : undefined;
    return !!c?.[key];
  } catch {
    return false;
  }
};

let safe: boolean | null = null;
export const isSafeMode = (): boolean => {
  if (safe == null) safe = constant('safeMode');
  return safe;
};

// The native side shows the last crash itself (newer APKs)
export const nativeShowsCrash = (): boolean => constant('nativeDialog');

let marked = false;
// Call once the first screen has been up for a few seconds: this start counts as healthy
export const markBootOk = (): void => {
  if (marked) return;
  marked = true;
  try {
    crashNative()?.markBootOk?.();
  } catch {}
};

export const saveJsCrash = (text: string): void => {
  try {
    crashNative()?.saveJsCrash?.(String(text).slice(0, 3500));
  } catch {}
};
