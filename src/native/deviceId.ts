// Stable hashed id of this phone for Earn anti-fraud (one account per device).
// Android: SHA-256 of ANDROID_ID from the native module (raw id never leaves the phone).
// Fallback (module missing): a random install id kept in AsyncStorage, hashed the same way.
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sha256Hex } from '../utils/sha256';

const Native: { getDeviceHash?: () => Promise<string | null> } | undefined = NativeModules.OutfitDeviceId;
const KEY = 'earn.installId.v1';

let cached: string | null = null;

export const getDeviceHash = async (): Promise<{ hash: string; strong: boolean }> => {
  if (cached) return { hash: cached, strong: !cached.startsWith('i_') };
  if (Platform.OS === 'android' && Native?.getDeviceHash) {
    try {
      const h = await Native.getDeviceHash();
      if (h && /^[0-9a-f]{64}$/.test(h)) {
        cached = h;
        return { hash: h, strong: true };
      }
    } catch {}
  }
  let id = '';
  try {
    id = (await AsyncStorage.getItem(KEY)) || '';
    if (!id) {
      id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
      await AsyncStorage.setItem(KEY, id);
    }
  } catch {
    id = id || `${Date.now()}`;
  }
  cached = `i_${sha256Hex(`install:${id}`).slice(0, 62)}`;
  return { hash: cached, strong: false };
};
