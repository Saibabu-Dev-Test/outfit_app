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

const MIN_Q = 60;
const MAX_Q = 92;

const newCanvas = (w: number, h: number): any => {
  const c = g().document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
};

// Long edge <= edge: halves with high-quality smoothing while still >= 2x the target, then one
// smooth step to the exact size, drawn on white (JPEG has no transparency). Never upscales.
const fit = (img: any, w0: number, h0: number, edge: number): any => {
  const scale = Math.min(1, edge / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  let src: any = img;
  let sw = w0;
  let sh = h0;
  while (Math.floor(sw / 2) >= w * 2 && Math.floor(sh / 2) >= h * 2) {
    const half = newCanvas(Math.floor(sw / 2), Math.floor(sh / 2));
    const hc = half.getContext('2d');
    hc.imageSmoothingEnabled = true;
    hc.imageSmoothingQuality = 'high';
    hc.drawImage(src, 0, 0, half.width, half.height);
    src = half;
    sw = half.width;
    sh = half.height;
  }
  const out = newCanvas(w, h);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return out;
};

// 3x3 box blur of one channel, edges clamped
const blur3 = (src: Uint8ClampedArray | Int16Array, w: number, h: number): Int16Array => {
  const tmp = new Int16Array(src.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      tmp[row + x] = src[row + Math.max(0, x - 1)] + src[row + x] + src[row + Math.min(w - 1, x + 1)];
    }
  }
  const out = new Int16Array(src.length);
  for (let y = 0; y < h; y++) {
    const up = Math.max(0, y - 1) * w;
    const dn = Math.min(h - 1, y + 1) * w;
    const row = y * w;
    for (let x = 0; x < w; x++) out[row + x] = Math.floor((tmp[up + x] + tmp[row + x] + tmp[dn + x] + 4) / 9);
  }
  return out;
};

// Slight auto-contrast (0.5% / 99.5% luminance points, black point <= 24, white point >= 228,
// blended 50%) + mild unsharp mask with a small threshold. Same as ImageResizeModule.kt.
const enhance = (canvas: any, sharpen?: number) => {
  const w = canvas.width;
  const h = canvas.height;
  const n = w * h;
  if (n < 4) return;
  const ctx = canvas.getContext('2d');
  let data: any;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    return; // tainted canvas: keep the plain downscale
  }
  const d: Uint8ClampedArray = data.data;
  const hist = new Int32Array(256);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    hist[Math.floor((d[o] * 77 + d[o + 1] * 150 + d[o + 2] * 29) / 256)]++;
  }
  const clip = Math.floor(n / 200);
  let lo = 0;
  let acc = 0;
  while (lo < 255 && acc + hist[lo] <= clip) acc += hist[lo++];
  let hi = 255;
  acc = 0;
  while (hi > 0 && acc + hist[hi] <= clip) acc += hist[hi--];
  lo = Math.min(lo, 24);
  hi = Math.max(hi, 228);
  const range = Math.max(1, hi - lo);
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    const stretched = Math.min(255, Math.max(0, ((v - lo) * 255) / range));
    lut[v] = Math.round((v + stretched) / 2);
  }
  const ch = [new Uint8ClampedArray(n), new Uint8ClampedArray(n), new Uint8ClampedArray(n)];
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    ch[0][i] = lut[d[o]];
    ch[1][i] = lut[d[o + 1]];
    ch[2][i] = lut[d[o + 2]];
  }
  const amount = sharpen != null && sharpen >= 0 ? sharpen : Math.max(w, h) <= 320 ? 0.35 : 0.55;
  const threshold = 3;
  for (let c = 0; c < 3; c++) {
    const src = ch[c];
    const bl = blur3(src, w, h);
    for (let i = 0; i < n; i++) {
      const diff = src[i] - bl[i];
      d[i * 4 + c] = diff > -threshold && diff < threshold ? src[i] : src[i] + amount * diff;
    }
  }
  for (let i = 0; i < n; i++) d[i * 4 + 3] = 255;
  ctx.putImageData(data, 0, 0);
};

// JPEG data URI at most spec.maxBytes with the long edge <= spec.maxEdge: filtered multi-step
// downscale, slight auto-contrast + mild sharpen, then the highest JPEG quality in 60..92 that
// fits (binary search). Below quality 60 the size is lowered instead. Browsers apply EXIF
// rotation when drawing (image-orientation: from-image).
export const resizeLoaded = (img: any, spec: ImageSpec): string => {
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  let edge = spec.maxEdge;
  let best = '';
  for (let round = 0; round < 8; round++) {
    const canvas = fit(img, w0, h0, edge);
    enhance(canvas, spec.sharpen);
    let lowQ = MIN_Q;
    let highQ = MAX_Q;
    let fitUri = '';
    while (lowQ <= highQ) {
      const mid = Math.floor((lowQ + highQ) / 2);
      const uri = canvas.toDataURL('image/jpeg', mid / 100);
      if (b64Bytes(uri) <= spec.maxBytes) {
        fitUri = uri;
        lowQ = mid + 1;
      } else {
        highQ = mid - 1;
      }
    }
    if (fitUri) return fitUri;
    best = canvas.toDataURL('image/jpeg', MIN_Q / 100);
    if (edge <= 64) break;
    edge = Math.max(64, Math.round(edge * 0.85));
  }
  return best;
};

export const resizeImage = async (src: any, spec: ImageSpec): Promise<string> =>
  resizeLoaded(await loadImage(src), spec);
