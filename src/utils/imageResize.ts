// Android: shrink a picked photo with the native OutfitImageResize module (ImageResizeModule.kt).
import { NativeModules } from 'react-native';
import { ImageSpec } from './imageSpecs';

interface NativeResize {
  resize: (uri: string, maxEdge: number, maxBytes: number) => Promise<{ base64: string; bytes: number }>;
}
const Native: NativeResize | undefined = NativeModules.OutfitImageResize;

export const canResize = (): boolean => !!Native?.resize;

// JPEG data URI at most spec.maxBytes (long edge <= spec.maxEdge). Source: content:// / file:// /
// data: URI. Rejects with a readable Error.
export const resizeImage = async (uri: string, spec: ImageSpec): Promise<string> => {
  if (!Native?.resize) throw new Error('Photo tools need the latest app. Please update Outfit.');
  try {
    const r = await Native.resize(uri, spec.maxEdge, spec.maxBytes);
    return `data:image/jpeg;base64,${r.base64}`;
  } catch (e: any) {
    console.warn('resize failed:', e?.code, e?.message);
    throw new Error('Could not read the photo. Please try another one.');
  }
};
