// Web build: photos come from <input type="file"> and are shrunk with a canvas to the same sizes
// as the Android picker (imageSpecs.ts): full photo + optional thumbnail, JPEG data URIs.
import { loadImage, resizeLoaded } from './imageResize.web';
import { AVATAR_SPEC, AVATAR_THUMB_SPEC, CLEAR_SPEC, FULL_MAX_CHARS, FULL_SPEC, ImageSpec, POLL_SPEC, THUMB_SPEC } from './imageSpecs';

export const MAX_BASE64_CHARS = FULL_MAX_CHARS; // one full photo (~942K chars), see imagePicker.ts

export interface PickedImage {
  dataUri: string;
  thumbUri?: string;
  clearUri?: string;
  uri?: string;
}

export interface PickOptions {
  spec?: ImageSpec;
  thumb?: ImageSpec | null;
  clear?: ImageSpec | null;
  maxChars?: number;
  ifSeveral?: PickOptions;
}

export const PHOTO_PICK: PickOptions = { spec: FULL_SPEC, thumb: THUMB_SPEC, clear: CLEAR_SPEC };
export const AVATAR_PICK: PickOptions = { spec: AVATAR_SPEC, thumb: AVATAR_THUMB_SPEC };
export const POLL_PICK: PickOptions = { spec: POLL_SPEC, thumb: null };
// Circle / birthday chat: one photo = near-original full photo (opened in the viewer) + a ~1080 px
// clear copy shown in the chat bubble; several photos (an A-F vote) = poll-size photos as before
export const CHAT_PICK: PickOptions = { spec: FULL_SPEC, thumb: null, clear: CLEAR_SPEC, ifSeveral: POLL_PICK };

export const isDataUri = (s?: string | null): boolean => !!s && s.startsWith('data:');

const g = (): any => globalThis as any;

// Opens the browser file chooser. Resolves [] when the user cancels.
const chooseFiles = (camera: boolean, multiple: boolean): Promise<any[]> =>
  new Promise(resolve => {
    const doc = g().document;
    if (!doc) return resolve([]);
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (multiple) input.multiple = true;
    if (camera) input.setAttribute('capture', 'environment');
    input.style.position = 'fixed';
    input.style.left = '-1000px';
    input.style.opacity = '0';
    let done = false;
    const finish = (files: any[]) => {
      if (done) return;
      done = true;
      g().removeEventListener?.('focus', onFocus);
      input.remove();
      resolve(files);
    };
    // Browsers without the "cancel" event: the window gets focus back with no file chosen
    const onFocus = () => setTimeout(() => finish(Array.from(input.files || [])), 1500);
    input.addEventListener('change', () => finish(Array.from(input.files || [])));
    input.addEventListener('cancel', () => finish([]));
    doc.body.appendChild(input);
    g().addEventListener?.('focus', onFocus, { once: true });
    input.click();
  });

const isImage = (f: any) => !f?.type || String(f.type).startsWith('image/');

// Full photo (+ thumbnail). null when it can't get small enough.
const processFile = async (file: any, o: PickOptions): Promise<PickedImage | null> => {
  const img = await loadImage(file);
  const dataUri = resizeLoaded(img, o.spec || FULL_SPEC);
  const maxChars = Math.min(o.maxChars ?? MAX_BASE64_CHARS, MAX_BASE64_CHARS);
  if (!dataUri || dataUri.length > maxChars) return null;
  const thumbUri = o.thumb ? resizeLoaded(img, o.thumb) : undefined;
  const clearUri = o.clear ? resizeLoaded(img, o.clear) || undefined : undefined;
  return { dataUri, thumbUri, clearUri };
};

// Resolves null when cancelled; rejects with a readable Error
export const pickImage = async (source: 'camera' | 'library', opts: PickOptions = PHOTO_PICK): Promise<PickedImage | null> => {
  const files = await chooseFiles(source === 'camera', false);
  const file = files[0];
  if (!file) return null;
  if (!isImage(file)) throw new Error('Please pick a photo.');
  const p = await processFile(file, opts);
  if (!p) throw new Error('This photo is too large to save. Please pick a smaller photo or crop it.');
  return p;
};

// Several photos at once. Photos that can't be made small enough are counted in `skipped`.
export const pickImages = async (max: number, opts: PickOptions = POLL_PICK): Promise<{ images: PickedImage[]; skipped: number }> => {
  const files = (await chooseFiles(false, max > 1)).slice(0, Math.max(1, max));
  const images: PickedImage[] = [];
  let skipped = 0;
  const o = files.length > 1 && opts.ifSeveral ? opts.ifSeveral : opts;
  for (const f of files) {
    try {
      const p = isImage(f) ? await processFile(f, o) : null;
      if (p) images.push(p);
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }
  return { images, skipped };
};

// Background choices are Android only: the web keeps the original photo
export const remakeImage = async (
  _uri: string,
  _bg: { mode: 'plain' | 'blur' | 'off'; level?: number },
  _opts: PickOptions = PHOTO_PICK,
): Promise<PickedImage | null> => null;
