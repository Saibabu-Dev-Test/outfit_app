// Photo options on the phone before upload (Android: PhotoEditModule.kt): crop to the "Adjust"
// frame and blur faces (on-device ML Kit face detection). Optional module: when it is missing
// (old APK, web) the photo is used unchanged. Never throws.
import { NativeModules, Platform } from 'react-native';
import { isFullCrop, NormCrop } from '../utils/cropMath';

type NativeEdit = {
  edit?: (uri: string, opts: Record<string, any>) => Promise<{ uri: string; changed: boolean; faces?: number }>;
};
const native = (): NativeEdit | null => {
  try {
    return Platform.OS === 'android' ? (NativeModules.OutfitPhotoEdit as NativeEdit) || null : null;
  } catch {
    return null;
  }
};

export const isPhotoEditSupported = (): boolean => !!native()?.edit;

export interface PhotoEditResult {
  uri: string; // edited file, or the same uri
  changed: boolean;
  faces: number; // faces blurred; -1 = face detection not available on this phone
}

/** Blurs faces and / or crops (fractions 0..1). Resolves the same uri when nothing changed or on any error. */
export const editPhoto = async (
  uri: string,
  edit: { blurFaces?: boolean; crop?: NormCrop | null },
): Promise<PhotoEditResult> => {
  const same: PhotoEditResult = { uri, changed: false, faces: edit.blurFaces ? -1 : 0 };
  try {
    const n = native();
    const crop = edit.crop && !isFullCrop(edit.crop) ? edit.crop : null;
    if (!uri || !n?.edit || (!edit.blurFaces && !crop)) return same;
    const opts: Record<string, any> = { blurFaces: !!edit.blurFaces };
    if (crop) {
      opts.cropX = crop.x;
      opts.cropY = crop.y;
      opts.cropW = crop.w;
      opts.cropH = crop.h;
    }
    const r = await n.edit(uri, opts);
    const faces = typeof r?.faces === 'number' ? r.faces : 0;
    return r?.changed && r.uri ? { uri: r.uri, changed: true, faces } : { uri, changed: false, faces };
  } catch {
    return same;
  }
};
