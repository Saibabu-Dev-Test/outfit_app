// Easy wardrobe on the phone (WardrobeVisionModule.kt, Google ML Kit via Play services, free):
// background removal + auto tags. Every call resolves null on any problem (no module, model not
// downloaded yet, no subject found) so the original photo / manual tags are used. Never throws.
import { NativeModules, Platform } from 'react-native';

interface NativeVision {
  removeBackground: (uri: string) => Promise<string>;
  labels: (uri: string) => Promise<{ text: string; confidence: number }[]>;
  dominantColor: (uri: string) => Promise<string>;
}
const native = (): NativeVision | undefined =>
  Platform.OS === 'android' ? (NativeModules.OutfitVision as NativeVision | undefined) : undefined;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>(r => setTimeout(() => r(null), ms))]);

// file:// uri of the photo with a plain white background, or null (keep the original)
export const removeBackground = async (uri: string): Promise<string | null> => {
  try {
    const n = native();
    if (!n?.removeBackground || !uri) return null;
    return (await withTimeout(n.removeBackground(uri), 15000)) || null;
  } catch (e: any) {
    console.warn('background removal skipped:', e?.message);
    return null;
  }
};

export const imageLabels = async (uri: string): Promise<{ text: string; confidence: number }[]> => {
  try {
    const n = native();
    if (!n?.labels || !uri) return [];
    return (await withTimeout(n.labels(uri), 10000)) || [];
  } catch (e: any) {
    console.warn('labels skipped:', e?.message);
    return [];
  }
};

export const dominantColor = async (uri: string): Promise<string | null> => {
  try {
    const n = native();
    if (!n?.dominantColor || !uri) return null;
    return (await withTimeout(n.dominantColor(uri), 5000)) || null;
  } catch {
    return null;
  }
};
