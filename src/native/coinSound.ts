// Coin flip sound (Android: CoinSoundModule.kt, SoundPool on the media stream).
// User switch in Settings ("Coin sound"), on by default. Never throws; no-op when the
// native module is missing (older native build, tests).
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSafeMode } from './safeMode';

export const COIN_SOUND_KEY = 'outfitpref:coinSound'; // '0' = off; kept across sign-out

// Looked up on first use (not at import): nothing native is touched during app start
let NativeRef: { play?: () => void } | null | undefined;
const native = (): { play?: () => void } | null => {
  if (NativeRef !== undefined) return NativeRef;
  let n: { play?: () => void } | null = null;
  try {
    n = Platform.OS === 'android' && !isSafeMode() ? NativeModules.OutfitCoinSound || null : null;
  } catch {
    n = null;
  }
  NativeRef = n;
  return n;
};

let enabled = true;
let loadedPref = false;

const loadPref = async () => {
  try {
    enabled = (await AsyncStorage.getItem(COIN_SOUND_KEY)) !== '0';
  } catch {}
  loadedPref = true;
};
loadPref();

export const isCoinSoundSupported = (): boolean => Platform.OS === 'android' && !!native()?.play;

export const isCoinSoundOn = async (): Promise<boolean> => {
  if (!loadedPref) await loadPref();
  return enabled;
};

export const setCoinSound = async (on: boolean): Promise<void> => {
  enabled = on;
  loadedPref = true;
  try {
    await AsyncStorage.setItem(COIN_SOUND_KEY, on ? '1' : '0');
  } catch {}
};

export const playCoinSound = (): void => {
  try {
    if (enabled && Platform.OS === 'android') native()?.play?.();
  } catch {}
};
