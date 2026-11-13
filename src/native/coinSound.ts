// Coin flip sound (Android: CoinSoundModule.kt, SoundPool on the media stream).
// User switch + volume slider in Settings ("Coin sound"), on by default at the 40% cap (MAX_COIN_VOLUME). Never throws; no-op when the
// native module is missing (older native build, tests).
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSafeMode } from './safeMode';

export const COIN_SOUND_KEY = 'outfitpref:coinSound'; // '0' = off; kept across sign-out
export const COIN_VOLUME_KEY = 'outfitpref:coinVolume'; // '0'..'0.4', default '0.4'
// The coin ting plays at most at 40% of the phone's media volume (older saved values above it are capped)
export const MAX_COIN_VOLUME = 0.4;

type NativeCoin = { play?: () => void; playAt?: (v: number) => void };

// Looked up on first use (not at import): nothing native is touched during app start
let NativeRef: NativeCoin | null | undefined;
const native = (): NativeCoin | null => {
  if (NativeRef !== undefined) return NativeRef;
  let n: NativeCoin | null = null;
  try {
    n = Platform.OS === 'android' && !isSafeMode() ? NativeModules.OutfitCoinSound || null : null;
  } catch {
    n = null;
  }
  NativeRef = n;
  return n;
};

let enabled = true;
let volume = MAX_COIN_VOLUME;
let loadedPref = false;

export const clampVolume = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(MAX_COIN_VOLUME, Math.max(0, n)) : MAX_COIN_VOLUME;
};

const loadPref = async () => {
  try {
    enabled = (await AsyncStorage.getItem(COIN_SOUND_KEY)) !== '0';
    const v = await AsyncStorage.getItem(COIN_VOLUME_KEY);
    volume = v === null ? MAX_COIN_VOLUME : clampVolume(v);
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

export const getCoinVolume = async (): Promise<number> => {
  if (!loadedPref) await loadPref();
  return volume;
};

export const setCoinVolume = async (v: number): Promise<void> => {
  volume = clampVolume(v);
  try {
    await AsyncStorage.setItem(COIN_VOLUME_KEY, String(Math.round(volume * 100) / 100));
  } catch {}
};

export const playCoinSound = (): void => {
  try {
    if (!enabled || Platform.OS !== 'android' || volume <= 0) return;
    const n = native();
    if (n?.playAt) n.playAt(Math.min(volume, MAX_COIN_VOLUME));
    else n?.play?.(); // older native build (native play() is capped at 0.4 too)
  } catch {}
};
