// Pure maths for the photo "Adjust" step (zoom + pan inside a frame, then crop to what is visible).
// The image is drawn to COVER the frame at zoom 1 (no empty edges), centred, then scaled by `zoom`
// (>= 1) and moved by (tx, ty) frame pixels. cropRect() turns that view into the visible part of
// the image as fractions 0..1 of its width / height, which the native module crops from the
// processed (blurred / BG removed / face blurred) photo. Exported for Jest.

export interface NormCrop {
  x: number; // left, 0..1 of the image width
  y: number; // top, 0..1 of the image height
  w: number; // width, 0..1
  h: number; // height, 0..1
}

export interface AdjustView {
  zoom: number; // 1 = cover the frame
  tx: number; // pan in frame pixels (image centre minus frame centre)
  ty: number;
}

export type FrameAspect = 'photo' | '4:5' | '1:1';
export const FRAME_ASPECTS: FrameAspect[] = ['photo', '4:5', '1:1'];

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;
export const FULL_CROP: NormCrop = { x: 0, y: 0, w: 1, h: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const finite = (v: number, d: number) => (Number.isFinite(v) ? v : d);

/** Width / height ratio of the frame for an aspect choice ('photo' = the image's own shape). */
export const aspectRatio = (aspect: FrameAspect, iw: number, ih: number): number => {
  if (aspect === '1:1') return 1;
  if (aspect === '4:5') return 4 / 5;
  return iw > 0 && ih > 0 ? iw / ih : 1;
};

/** Largest frame of the given ratio (w / h) that fits in maxW x maxH. */
export const frameSize = (ratio: number, maxW: number, maxH: number): { width: number; height: number } => {
  const r = ratio > 0 && Number.isFinite(ratio) ? ratio : 1;
  let width = Math.max(1, maxW);
  let height = width / r;
  if (height > maxH) {
    height = Math.max(1, maxH);
    width = height * r;
  }
  return { width: Math.round(width), height: Math.round(height) };
};

/** Scale that makes the image cover the frame exactly at zoom 1. */
export const coverScale = (iw: number, ih: number, fw: number, fh: number): number =>
  iw > 0 && ih > 0 ? Math.max(fw / iw, fh / ih) : 1;

/** Size of the drawn image (frame pixels) at this zoom. */
export const drawnSize = (iw: number, ih: number, fw: number, fh: number, zoom: number) => {
  const s = coverScale(iw, ih, fw, fh) * clamp(finite(zoom, 1), MIN_ZOOM, MAX_ZOOM);
  return { width: iw * s, height: ih * s };
};

/** Keeps zoom in range and the pan inside the image (the frame never shows an empty edge). */
export const clampView = (v: AdjustView, iw: number, ih: number, fw: number, fh: number): AdjustView => {
  const zoom = clamp(finite(v.zoom, 1), MIN_ZOOM, MAX_ZOOM);
  const d = drawnSize(iw, ih, fw, fh, zoom);
  const mx = Math.max(0, (d.width - fw) / 2);
  const my = Math.max(0, (d.height - fh) / 2);
  return { zoom, tx: clamp(finite(v.tx, 0), -mx, mx), ty: clamp(finite(v.ty, 0), -my, my) };
};

/** Pinch: new zoom = start zoom * ratio, the pan scales with it (zooms about the frame centre). */
export const pinchView = (start: AdjustView, ratio: number, dx = 0, dy = 0): AdjustView => {
  const zoom = clamp(start.zoom * (ratio > 0 && Number.isFinite(ratio) ? ratio : 1), MIN_ZOOM, MAX_ZOOM);
  const k = zoom / start.zoom;
  return { zoom, tx: start.tx * k + dx, ty: start.ty * k + dy };
};

/** Double tap: zoom 1 -> 2.5 towards the tapped point (frame coords), anything else -> back to 1. */
export const doubleTapView = (v: AdjustView, px: number, py: number, fw: number, fh: number, to = 2.5): AdjustView => {
  if (v.zoom > 1.01) return { zoom: 1, tx: 0, ty: 0 };
  return { zoom: to, tx: (fw / 2 - px) * (to - 1), ty: (fh / 2 - py) * (to - 1) };
};

/** The visible part of the image as fractions of its size (always inside 0..1). */
export const cropRect = (iw: number, ih: number, fw: number, fh: number, view: AdjustView): NormCrop => {
  if (!(iw > 0 && ih > 0 && fw > 0 && fh > 0)) return { ...FULL_CROP };
  const v = clampView(view, iw, ih, fw, fh);
  const d = drawnSize(iw, ih, fw, fh, v.zoom);
  const w = clamp(fw / d.width, 0, 1);
  const h = clamp(fh / d.height, 0, 1);
  const x = clamp((d.width - fw) / 2 - v.tx, 0, d.width) / d.width;
  const y = clamp((d.height - fh) / 2 - v.ty, 0, d.height) / d.height;
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  return { x: r(clamp(x, 0, 1 - w)), y: r(clamp(y, 0, 1 - h)), w: r(w), h: r(h) };
};

/** True when the crop keeps (almost) the whole image, so no crop is needed. */
export const isFullCrop = (c?: NormCrop | null): boolean =>
  !c || (c.x <= 0.002 && c.y <= 0.002 && c.w >= 0.996 && c.h >= 0.996);

/** Crop in pixels of a w x h bitmap (what the native side does), at least 1 px, inside the bitmap. */
export const cropPixels = (c: NormCrop, w: number, h: number) => {
  const x = clamp(Math.round(c.x * w), 0, Math.max(0, w - 1));
  const y = clamp(Math.round(c.y * h), 0, Math.max(0, h - 1));
  const cw = clamp(Math.round(c.w * w), 1, w - x);
  const ch = clamp(Math.round(c.h * h), 1, h - y);
  return { x, y, width: cw, height: ch };
};

/** A face box grown by `pad` (fraction of its size; extra on top for hair), kept inside the image. */
export const padFaceBox = (
  box: { left: number; top: number; width: number; height: number },
  iw: number,
  ih: number,
  pad = 0.25,
) => {
  const left = clamp(box.left - box.width * pad, 0, iw);
  const top = clamp(box.top - box.height * (pad + 0.15), 0, ih);
  const right = clamp(box.left + box.width * (1 + pad), 0, iw);
  const bottom = clamp(box.top + box.height * (1 + pad), 0, ih);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
};
