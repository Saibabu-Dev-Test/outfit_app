// Clothing photo background (Android: PhotoBackgroundModule.kt, ML Kit subject segmentation on the
// phone). Settings > "Photo background": 'plain' (default: white behind dark clothes, black behind
// light ones), 'blur' (background blurred) or 'off'. Applied to wardrobe, post, poll and multi-shot
// photos when they are picked. Never throws: any failure keeps the original photo.
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PhotoBgMode = 'plain' | 'blur' | 'off';
export const PHOTO_BG_MODES: PhotoBgMode[] = ['plain', 'blur', 'off'];
export const PHOTO_BG_LABEL: Record<PhotoBgMode, string> = {
  plain: 'Plain (white / black)',
  blur: 'Blur background',
  off: 'Off (original)',
};
export const PHOTO_BG_KEY = 'outfitpref:photoBg';

type NativeBg = { process?: (uri: string, mode: string) => Promise<{ uri: string; changed: boolean }> };
const native = (): NativeBg | null => {
  try {
    return Platform.OS === 'android' ? (NativeModules.OutfitPhotoBackground as NativeBg) || null : null;
  } catch {
    return null;
  }
};

let mode: PhotoBgMode = 'plain';
let loaded = false;
const load = async () => {
  try {
    const v = await AsyncStorage.getItem(PHOTO_BG_KEY);
    if (v === 'plain' || v === 'blur' || v === 'off') mode = v;
  } catch {}
  loaded = true;
};
load();

export const isPhotoBgSupported = (): boolean => !!native()?.process;

export const getPhotoBg = async (): Promise<PhotoBgMode> => {
  if (!loaded) await load();
  return mode;
};

export const setPhotoBg = async (m: PhotoBgMode): Promise<void> => {
  mode = m;
  loaded = true;
  try {
    await AsyncStorage.setItem(PHOTO_BG_KEY, m);
  } catch {}
};

/** The picked file with its background changed per the setting, or the same uri. */
export const applyPhotoBg = async (uri: string): Promise<string> => {
  try {
    const m = await getPhotoBg();
    const n = native();
    if (m === 'off' || !n?.process || !uri) return uri;
    const r = await n.process(uri, m);
    return r?.changed && r.uri ? r.uri : uri;
  } catch {
    return uri;
  }
};
