// Android: shrink a picked photo with the native OutfitImageResize module (ImageResizeModule.kt).
import { NativeModules } from 'react-native';
import { ImageSpec } from './imageSpecs';

interface NativeResize {
  // mime: 'image/webp' (lossy WebP, the default) or 'image/jpeg' (fallback on a device without a WebP encoder)
  resize: (uri: string, maxEdge: number, maxBytes: number) => Promise<{ base64: string; bytes: number; mime?: string }>;
  // Newer APKs: same with an explicit sharpen amount (< 0 = default)
  resizeSharp?: (uri: string, maxEdge: number, maxBytes: number, sharpen: number) => Promise<{ base64: string; bytes: number; mime?: string }>;
}
const Native: NativeResize | undefined = NativeModules.OutfitImageResize;

export const canResize = (): boolean => !!Native?.resize;

// WebP (or JPEG) data URI at most spec.maxBytes (long edge <= spec.maxEdge). Source: content:// / file:// /
// data: URI. Rejects with a readable Error.
export const resizeImage = async (uri: string, spec: ImageSpec): Promise<string> => {
  if (!Native?.resize) throw new Error('Photo tools need the latest app. Please update Outfit.');
  try {
    const r =
      spec.sharpen != null && Native.resizeSharp
        ? await Native.resizeSharp(uri, spec.maxEdge, spec.maxBytes, spec.sharpen)
        : await Native.resize(uri, spec.maxEdge, spec.maxBytes);
    const mime = r.mime === 'image/webp' ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${r.base64}`;
  } catch (e: any) {
    console.warn('resize failed:', e?.code, e?.message);
    throw new Error('Could not read the photo. Please try another one.');
  }
};
