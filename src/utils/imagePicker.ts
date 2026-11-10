// Pick a photo as a small JPEG data URI (stored in Firestore; no Firebase Storage on the Spark plan).
// The picker hands over a file; ImageResizeModule.kt shrinks it to the requested size with a
// quality loop, and also makes a thumbnail when asked (lists / feed read only the thumbnail).
import { launchCamera, launchImageLibrary, Asset, ImagePickerResponse, CameraOptions } from 'react-native-image-picker';
import { canResize, resizeImage } from './imageResize';
import { AVATAR_SPEC, AVATAR_THUMB_SPEC, FULL_SPEC, ImageSpec, POLL_SPEC, THUMB_SPEC } from './imageSpecs';

// Firestore doc limit is 1 MiB; old (pre-split) photos were up to this size
export const MAX_BASE64_CHARS = 700000;

export interface PickedImage {
  dataUri: string; // full photo (spec size)
  thumbUri?: string; // thumbnail, when PickOptions.thumb is set
  uri?: string;
}

export interface PickOptions {
  spec?: ImageSpec; // default FULL_SPEC (1080 px, ~60 KB)
  thumb?: ImageSpec | null; // also make a thumbnail of this size
  maxChars?: number; // extra cap on the full photo's base64 length
}

// Posts and wardrobe items: full photo + ~200 px thumbnail
export const PHOTO_PICK: PickOptions = { spec: FULL_SPEC, thumb: THUMB_SPEC };
// Avatars are shown small; the tiny copy goes on posts / comments / likes
export const AVATAR_PICK: PickOptions = { spec: AVATAR_SPEC, thumb: AVATAR_THUMB_SPEC };
// A poll message / chat photo set holds up to 6 photos in one Firestore doc (1 MiB limit)
export const POLL_PICK: PickOptions = { spec: POLL_SPEC, thumb: null };

const specOf = (o: PickOptions) => o.spec || FULL_SPEC;

// The picker only pre-shrinks (keeps decoding fast); the native module does the real sizing.
// Without the module (should not happen: it ships in the same APK) the picker's own base64 is used.
const pickerOptions = (o: PickOptions): CameraOptions => {
  const native = canResize();
  const edge = specOf(o).maxEdge;
  return {
    mediaType: 'photo',
    maxWidth: native ? Math.max(1600, edge) : edge,
    maxHeight: native ? Math.max(1600, edge) : edge,
    quality: native ? 0.9 : 0.5,
    includeBase64: !native,
    saveToPhotos: false,
  };
};

const fromAsset = async (a: Asset, o: PickOptions): Promise<PickedImage | null> => {
  const maxChars = Math.min(o.maxChars ?? MAX_BASE64_CHARS, MAX_BASE64_CHARS);
  let dataUri = '';
  if (canResize() && a.uri) {
    dataUri = await resizeImage(a.uri, specOf(o));
  } else if (a.base64) {
    const type = a.type && a.type.startsWith('image/') ? a.type : 'image/jpeg';
    dataUri = `data:${type};base64,${a.base64}`;
  } else {
    throw new Error('Could not read the photo. Please try another one.');
  }
  if (dataUri.length > maxChars) return null;
  // Thumbnail from the (already small) full photo: fast and sharp enough
  const thumbUri = o.thumb && canResize() ? await resizeImage(dataUri, o.thumb) : undefined;
  return { dataUri, thumbUri, uri: a.uri };
};

const TOO_BIG = 'This photo is too large to save. Please pick a smaller photo or crop it.';

// Resolves null when cancelled; rejects with a readable Error
export const pickImage = (source: 'camera' | 'library', opts: PickOptions = PHOTO_PICK): Promise<PickedImage | null> =>
  new Promise((resolve, reject) => {
    const cb = async (res: ImagePickerResponse) => {
      try {
        if (res.didCancel) return resolve(null);
        if (res.errorCode || res.errorMessage) throw new Error(res.errorMessage || `Image error: ${res.errorCode}`);
        const a = res.assets?.[0];
        if (!a) throw new Error('Could not read the photo. Please try another one.');
        const picked = await fromAsset(a, opts);
        if (!picked) throw new Error(TOO_BIG);
        resolve(picked);
      } catch (e) {
        reject(e);
      }
    };
    try {
      const options = pickerOptions(opts);
      if (source === 'camera') launchCamera(options, cb);
      else launchImageLibrary({ ...options, selectionLimit: 1 }, cb);
    } catch (e) {
      reject(e);
    }
  });

export const isDataUri = (s?: string | null): boolean => !!s && s.startsWith('data:');

// Several photos from the library at once (multi-photo posts / A-F polls).
// Photos that can't be read or made small enough are counted in `skipped`. Resolves [] when cancelled.
export const pickImages = (max: number, opts: PickOptions = POLL_PICK): Promise<{ images: PickedImage[]; skipped: number }> =>
  new Promise((resolve, reject) => {
    try {
      launchImageLibrary({ ...pickerOptions(opts), selectionLimit: Math.max(1, max) }, async res => {
        if (res.didCancel) return resolve({ images: [], skipped: 0 });
        if (res.errorCode || res.errorMessage) {
          return reject(new Error(res.errorMessage || `Image error: ${res.errorCode}`));
        }
        const images: PickedImage[] = [];
        let skipped = 0;
        for (const a of (res.assets || []).slice(0, max)) {
          try {
            const p = await fromAsset(a, opts);
            if (p) images.push(p);
            else skipped += 1;
          } catch {
            skipped += 1;
          }
        }
        resolve({ images, skipped });
      });
    } catch (e) {
      reject(e);
    }
  });
