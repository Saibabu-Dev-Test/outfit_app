// Web: shrink a photo (File / Blob / data URI) with a canvas, same limits as ImageResizeModule.kt.
import { ImageSpec } from './imageSpecs';

const g = (): any => globalThis as any;

export const canResize = (): boolean => !!g().document;

// Loads a File/Blob or a data URI into an <img>
export const loadImage = (src: any): Promise<any> =>
  new Promise((resolve, reject) => {
    const isStr = typeof src === 'string';
    const url = isStr ? src : g().URL.createObjectURL(src);
    const img = new (g().Image)();
    const done = () => {
      if (!isStr) g().URL.revokeObjectURL(url);
    };
    img.onload = () => {
      done();
      resolve(img);
    };
    img.onerror = () => {
      done();
      reject(new Error('Could not read the photo. Please try another one.'));
    };
    img.src = url;
  });

const b64Bytes = (uri: string) => Math.floor(((uri.length - uri.indexOf(',') - 1) * 3) / 4);

// JPEG data URI at most spec.maxBytes with the long edge <= spec.maxEdge (quality loop, then
// smaller sizes). Browsers apply EXIF rotation when drawing (image-orientation: from-image).
export const resizeLoaded = (img: any, spec: ImageSpec): string => {
  const canvas = g().document.createElement('canvas');
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  let edge = spec.maxEdge;
  let best = '';
  for (let round = 0; round < 5; round++) {
    const scale = Math.min(1, edge / Math.max(w0, h0));
    canvas.width = Math.max(1, Math.round(w0 * scale));
    canvas.height = Math.max(1, Math.round(h0 * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; // JPEG has no transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (let q = 0.82; q >= 0.34; q -= 0.07) {
      best = canvas.toDataURL('image/jpeg', q);
      if (b64Bytes(best) <= spec.maxBytes) return best;
    }
    edge = Math.max(64, Math.round(edge * 0.85));
  }
  return best;
};

export const resizeImage = async (src: any, spec: ImageSpec): Promise<string> =>
  resizeLoaded(await loadImage(src), spec);
