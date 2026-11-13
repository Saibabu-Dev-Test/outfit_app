// Wardrobe auto tags on the phone (WardrobeVisionModule.kt, Google ML Kit via Play services, free):
// image labels + main colour. Every call resolves null on any problem (no module, model not
// downloaded yet, unreadable photo) so the user picks the tags manually. Never throws.
import { NativeModules, Platform } from 'react-native';

interface NativeVision {
  labels: (uri: string) => Promise<{ text: string; confidence: number }[]>;
  dominantColor: (uri: string) => Promise<string>;
}
const native = (): NativeVision | undefined =>
  Platform.OS === 'android' ? (NativeModules.OutfitVision as NativeVision | undefined) : undefined;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>(r => setTimeout(() => r(null), ms))]);

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
