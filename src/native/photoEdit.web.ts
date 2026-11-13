// Web build: no on-device photo editing (crop / face blur); photos are used as picked.
import { NormCrop } from '../utils/cropMath';

export const isPhotoEditSupported = (): boolean => false;

export interface PhotoEditResult {
  uri: string;
  changed: boolean;
  faces: number;
}

export const editPhoto = async (uri: string, edit: { blurFaces?: boolean; crop?: NormCrop | null }): Promise<PhotoEditResult> => ({
  uri,
  changed: false,
  faces: edit.blurFaces ? -1 : 0,
});
