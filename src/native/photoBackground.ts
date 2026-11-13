// Clothing photo background (Android: PhotoBackgroundModule.kt, ML Kit subject segmentation on the
// phone). Chosen per photo under the photo when adding clothes: Original (default), Blur (level
// 1-5) or Remove BG ('plain': white behind dark clothes, black behind light ones). Never throws:
// any failure keeps the original photo.
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PhotoBgMode = 'plain' | 'blur' | 'off';
export const PHOTO_BG_MODES: PhotoBgMode[] = ['plain', 'blur', 'off'];
export const PHOTO_BG_LABEL: Record<PhotoBgMode, string> = {
  plain: 'Remove BG',
  blur: 'Blur',
  off: 'Original',
};
export const PHOTO_BG_KEY = 'outfitpref:photoBg';

type NativeBg = {
  process?: (uri: string, mode: string) => Promise<{ uri: string; changed: boolean }>;
  processLevel?: (uri: string, mode: string, level: number) => Promise<{ uri: string; changed: boolean }>;
  warmUp?: () => Promise<boolean>;
};
const native = (): NativeBg | null => {
  try {
    return Platform.OS === 'android' ? (NativeModules.OutfitPhotoBackground as NativeBg) || null : null;
  } catch {
    return null;
  }
};

let mode: PhotoBgMode = 'off';
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

let warmed: Promise<boolean> | null = null;
/**
 * Loads the on-device segmentation model in the background (once per app run) so the first
 * Blur / Remove BG tap is fast. Call when a photo screen opens. Never throws.
 */
export const warmUpPhotoBg = (): Promise<boolean> => {
  if (warmed) return warmed;
  const n = native();
  if (!n?.warmUp) return Promise.resolve(false);
  warmed = n.warmUp().then(
    ok => {
      if (!ok) warmed = null; // model still downloading: try again next time
      return !!ok;
    },
    () => {
      warmed = null;
      return false;
    },
  );
  return warmed;
};

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

/** The file with its background changed (mode, else the saved default; blur level 1-5), or the same uri. */
export const applyPhotoBg = async (uri: string, mode?: PhotoBgMode, level = 3): Promise<string> => {
  try {
    const m = mode || (await getPhotoBg());
    const n = native();
    if (m === 'off' || !n?.process || !uri) return uri;
    const lv = Math.max(1, Math.min(5, Math.round(level)));
    const r = n.processLevel ? await n.processLevel(uri, m, lv) : await n.process(uri, m);
    return r?.changed && r.uri ? r.uri : uri;
  } catch {
    return uri;
  }
};
