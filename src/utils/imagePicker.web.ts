// Web build: photos come from <input type="file"> and are shrunk with a canvas to the same limits
// as the Android picker (base64 data URI stored in Firestore; no Firebase Storage on Spark).
export const MAX_BASE64_CHARS = 700000;

export interface PickedImage {
  dataUri: string;
  uri?: string;
}

export interface PickOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxChars?: number;
}

export const AVATAR_PICK: PickOptions = { maxWidth: 256, maxHeight: 256, quality: 0.6, maxChars: 60000 };
export const POLL_PICK: PickOptions = { maxWidth: 540, maxHeight: 540, quality: 0.4, maxChars: 145000 };
const DEFAULTS = { maxWidth: 720, maxHeight: 720, quality: 0.5 };

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

const loadImage = (file: any): Promise<any> =>
  new Promise((resolve, reject) => {
    const url = g().URL.createObjectURL(file);
    const img = new (g().Image)();
    img.onload = () => {
      g().URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      g().URL.revokeObjectURL(url);
      reject(new Error('Could not read the photo. Please try another one.'));
    };
    img.src = url;
  });

// Resize to fit maxWidth x maxHeight and encode as JPEG; lowers quality/size until it fits maxChars.
// Returns null when it can't get small enough.
const compress = async (file: any, opts: PickOptions, maxChars: number): Promise<string | null> => {
  const img = await loadImage(file);
  const maxW = opts.maxWidth ?? DEFAULTS.maxWidth;
  const maxH = opts.maxHeight ?? DEFAULTS.maxHeight;
  let quality = opts.quality ?? DEFAULTS.quality;
  let scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
  const canvas = g().document.createElement('canvas');
  for (let i = 0; i < 6; i++) {
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; // JPEG has no transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const uri: string = canvas.toDataURL('image/jpeg', quality);
    const b64 = uri.length - uri.indexOf(',') - 1;
    if (b64 <= maxChars) return uri;
    quality = Math.max(0.2, quality * 0.75);
    scale *= 0.8;
  }
  return null;
};

const isImage = (f: any) => !f?.type || String(f.type).startsWith('image/');

// Resolves null when cancelled; rejects with a readable Error
export const pickImage = async (
  source: 'camera' | 'library',
  opts: PickOptions = {},
): Promise<PickedImage | null> => {
  const files = await chooseFiles(source === 'camera', false);
  const file = files[0];
  if (!file) return null;
  if (!isImage(file)) throw new Error('Please pick a photo.');
  const maxChars = Math.min(opts.maxChars ?? MAX_BASE64_CHARS, MAX_BASE64_CHARS);
  const dataUri = await compress(file, opts, maxChars);
  if (!dataUri) throw new Error('This photo is too large to save. Please pick a smaller photo or crop it.');
  return { dataUri };
};

// Several photos at once. Photos that can't be made small enough are counted in `skipped`.
export const pickImages = async (
  max: number,
  opts: PickOptions = POLL_PICK,
): Promise<{ images: PickedImage[]; skipped: number }> => {
  const files = (await chooseFiles(false, max > 1)).slice(0, Math.max(1, max));
  const maxChars = Math.min(opts.maxChars ?? MAX_BASE64_CHARS, MAX_BASE64_CHARS);
  const images: PickedImage[] = [];
  let skipped = 0;
  for (const f of files) {
    try {
      const uri = isImage(f) ? await compress(f, opts, maxChars) : null;
      if (uri) images.push({ dataUri: uri });
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }
  return { images, skipped };
};
