// Pick a photo as a compressed base64 data URI (stored in Firestore; no Firebase Storage on the Spark plan)
import { launchCamera, launchImageLibrary, ImagePickerResponse, CameraOptions } from 'react-native-image-picker';

// Firestore doc limit is 1 MiB; keep the image well under it
export const MAX_BASE64_CHARS = 700000;

export interface PickedImage {
  dataUri: string;
  uri?: string;
}

const OPTIONS: CameraOptions = {
  mediaType: 'photo',
  maxWidth: 720,
  maxHeight: 720,
  quality: 0.5,
  includeBase64: true,
  saveToPhotos: false,
};

const toPicked = (res: ImagePickerResponse): PickedImage | null => {
  if (res.didCancel) return null;
  if (res.errorCode || res.errorMessage) {
    throw new Error(res.errorMessage || `Image error: ${res.errorCode}`);
  }
  const asset = res.assets?.[0];
  if (!asset?.base64) throw new Error('Could not read the photo. Please try another one.');
  if (asset.base64.length > MAX_BASE64_CHARS) {
    throw new Error('This photo is too large to save. Please pick a smaller photo or crop it.');
  }
  const type = asset.type && asset.type.startsWith('image/') ? asset.type : 'image/jpeg';
  return { dataUri: `data:${type};base64,${asset.base64}`, uri: asset.uri };
};

// Resolves null when cancelled; rejects with a readable Error
export const pickImage = (source: 'camera' | 'library'): Promise<PickedImage | null> =>
  new Promise((resolve, reject) => {
    const cb = (res: ImagePickerResponse) => {
      try {
        resolve(toPicked(res));
      } catch (e) {
        reject(e);
      }
    };
    try {
      if (source === 'camera') {
        launchCamera(OPTIONS, cb);
      } else {
        launchImageLibrary({ ...OPTIONS, selectionLimit: 1 }, cb);
      }
    } catch (e) {
      reject(e);
    }
  });

export const isDataUri = (s?: string | null): boolean => !!s && s.startsWith('data:');
