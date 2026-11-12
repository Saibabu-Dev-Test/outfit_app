// Pick a photo as a small WebP (JPEG fallback) data URI (stored in Firestore; no Firebase Storage on
// the Spark plan). The picker hands over a file; ImageResizeModule.kt shrinks it to the requested size
// with a quality loop, and also makes a thumbnail (lists) and a clear 1080 px copy (feed cards) when asked.
// The picker hands over the original file (no pre-shrink), so every size is made from the original.
import { launchCamera, launchImageLibrary, Asset, ImagePickerResponse, CameraOptions } from 'react-native-image-picker';
import { canResize, resizeImage } from './imageResize';
import { AVATAR_SPEC, AVATAR_THUMB_SPEC, CLEAR_SPEC, FULL_MAX_CHARS, FULL_SPEC, ImageSpec, POLL_SPEC, THUMB_SPEC } from './imageSpecs';

// Largest photo data URI accepted anywhere (one full photo: JPEG <= 690 KB = ~942K base64 chars,
// still one per Firestore document under the 1 MiB limit). Old photos were smaller.
export const MAX_BASE64_CHARS = FULL_MAX_CHARS;

export interface PickedImage {
  dataUri: string; // full photo (spec size)
  thumbUri?: string; // thumbnail, when PickOptions.thumb is set
  clearUri?: string; // ~1080 px feed photo, when PickOptions.clear is set
  uri?: string;
}

export interface PickOptions {
  spec?: ImageSpec; // default FULL_SPEC (1600 px, <= 160 KB)
  thumb?: ImageSpec | null; // also make a thumbnail of this size
  clear?: ImageSpec | null; // also make a clear feed-size copy (CLEAR_SPEC)
  maxChars?: number; // extra cap on the full photo's base64 length
  ifSeveral?: PickOptions; // pickImages: options used instead when more than one photo was picked
}

// Posts and wardrobe items: near-original full photo (2048 px JPEG <= 690 KB, opened on tap) + 360 px
// thumbnail (grids) + ~1080 px clear copy (feed cards)
export const PHOTO_PICK: PickOptions = { spec: FULL_SPEC, thumb: THUMB_SPEC, clear: CLEAR_SPEC };
// Avatars are shown small; the tiny copy goes on posts / comments / likes
export const AVATAR_PICK: PickOptions = { spec: AVATAR_SPEC, thumb: AVATAR_THUMB_SPEC };
// A poll message / chat photo set holds up to 6 photos in one Firestore doc (1 MiB limit)
export const POLL_PICK: PickOptions = { spec: POLL_SPEC, thumb: null };
// Circle / birthday chat: one photo = near-original full photo (opened in the viewer) + a ~1080 px
// clear copy shown in the chat bubble; several photos (an A-F vote) = poll-size photos as before
export const CHAT_PICK: PickOptions = { spec: FULL_SPEC, thumb: null, clear: CLEAR_SPEC, ifSeveral: POLL_PICK };

const specOf = (o: PickOptions) => o.spec || FULL_SPEC;

// No pre-shrink: the picker hands over the original photo and the native module does all sizing
// from it (it subsamples while decoding, so memory stays low). Without the module (should not
// happen: it ships in the same APK) the picker's own small base64 is used.
const pickerOptions = (o: PickOptions): CameraOptions => {
  const native = canResize();
  const edge = specOf(o).maxEdge;
  return native
    ? { mediaType: 'photo', quality: 1, includeBase64: false, saveToPhotos: false }
    : { mediaType: 'photo', maxWidth: edge, maxHeight: edge, quality: 0.5, includeBase64: true, saveToPhotos: false };
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
  // Thumbnail from the picked file (not the already sharpened full photo: no double sharpening)
  const thumbUri = o.thumb && canResize() ? await resizeImage(a.uri || dataUri, o.thumb) : undefined;
  // Clear feed photo, also from the original. Optional: a failure just leaves the thumbnail.
  let clearUri: string | undefined;
  if (o.clear && canResize()) {
    try {
      clearUri = await resizeImage(a.uri || dataUri, o.clear);
    } catch {
      clearUri = undefined;
    }
  }
  return { dataUri, thumbUri, clearUri, uri: a.uri };
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
        const assets = (res.assets || []).slice(0, max);
        const o = assets.length > 1 && opts.ifSeveral ? opts.ifSeveral : opts;
        for (const a of assets) {
          try {
            const p = await fromAsset(a, o);
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
