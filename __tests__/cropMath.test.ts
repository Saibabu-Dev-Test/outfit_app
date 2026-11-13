import {
  aspectRatio,
  clampView,
  coverScale,
  cropPixels,
  cropRect,
  doubleTapView,
  frameSize,
  isFullCrop,
  padFaceBox,
  pinchView,
} from '../src/utils/cropMath';
import { PHOTO_EDIT_LABELS, photoText } from '../src/i18n/photoEditLabels';

describe('photo Adjust crop maths', () => {
  it('fits a frame of the chosen shape in the space', () => {
    expect(frameSize(1, 300, 500)).toEqual({ width: 300, height: 300 });
    expect(frameSize(4 / 5, 400, 400)).toEqual({ width: 320, height: 400 });
    expect(aspectRatio('photo', 3000, 4000)).toBeCloseTo(0.75);
    expect(aspectRatio('1:1', 3000, 4000)).toBe(1);
    expect(aspectRatio('4:5', 1, 1)).toBeCloseTo(0.8);
  });

  it('zoom 1 in a frame of the photo shape keeps the whole photo', () => {
    const c = cropRect(3000, 4000, 300, 400, { zoom: 1, tx: 0, ty: 0 });
    expect(c).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(isFullCrop(c)).toBe(true);
  });

  it('a square frame on a portrait photo crops the middle', () => {
    expect(coverScale(1000, 2000, 300, 300)).toBeCloseTo(0.3);
    const c = cropRect(1000, 2000, 300, 300, { zoom: 1, tx: 0, ty: 0 });
    expect(c.x).toBeCloseTo(0);
    expect(c.w).toBeCloseTo(1);
    expect(c.h).toBeCloseTo(0.5);
    expect(c.y).toBeCloseTo(0.25);
  });

  it('zoom 2 centred keeps the middle half', () => {
    const c = cropRect(1000, 1000, 200, 200, { zoom: 2, tx: 0, ty: 0 });
    expect(c).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    expect(isFullCrop(c)).toBe(false);
  });

  it('dragging the photo right shows its left side', () => {
    // zoom 2 in a 200 frame: drawn 400 wide, pan range +-100
    const c = cropRect(1000, 1000, 200, 200, { zoom: 2, tx: 100, ty: -100 });
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(0.5);
  });

  it('never pans past the edge or zooms out of range', () => {
    const v = clampView({ zoom: 9, tx: 5000, ty: -5000 }, 1000, 1000, 200, 200);
    expect(v.zoom).toBe(5);
    expect(v.tx).toBe(400); // (1000 - 200) / 2
    expect(v.ty).toBe(-400);
    expect(clampView({ zoom: 0.2, tx: 50, ty: 50 }, 1000, 1000, 200, 200)).toEqual({ zoom: 1, tx: 0, ty: 0 });
    const c = cropRect(1000, 1000, 200, 200, { zoom: 9, tx: 5000, ty: -5000 });
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.y + c.h).toBeLessThanOrEqual(1);
    expect(c.w).toBeCloseTo(0.2);
  });

  it('pinch and double tap', () => {
    const p = pinchView({ zoom: 2, tx: 10, ty: -10 }, 1.5);
    expect(p.zoom).toBe(3);
    expect(p.tx).toBeCloseTo(15);
    expect(pinchView({ zoom: 4, tx: 0, ty: 0 }, 3).zoom).toBe(5);
    expect(doubleTapView({ zoom: 1, tx: 0, ty: 0 }, 100, 100, 200, 200)).toEqual({ zoom: 2.5, tx: 0, ty: 0 });
    expect(doubleTapView({ zoom: 1, tx: 0, ty: 0 }, 0, 100, 200, 200).tx).toBeCloseTo(150);
    expect(doubleTapView({ zoom: 3, tx: 40, ty: 0 }, 0, 0, 200, 200)).toEqual({ zoom: 1, tx: 0, ty: 0 });
  });

  it('bad sizes give the whole photo', () => {
    expect(cropRect(0, 0, 200, 200, { zoom: 2, tx: 0, ty: 0 })).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(cropRect(1000, 1000, 200, 200, { zoom: NaN, tx: NaN, ty: 0 })).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('crop pixels stay inside the bitmap', () => {
    expect(cropPixels({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 2048, 1536)).toEqual({ x: 512, y: 384, width: 1024, height: 768 });
    const p = cropPixels({ x: 0.999, y: 0.999, w: 0.5, h: 0.5 }, 100, 100);
    expect(p.x + p.width).toBeLessThanOrEqual(100);
    expect(p.width).toBeGreaterThanOrEqual(1);
  });

  it('face boxes grow with padding and stay inside the photo', () => {
    const b = padFaceBox({ left: 100, top: 100, width: 100, height: 100 }, 1000, 1000);
    expect(b).toEqual({ left: 75, top: 60, width: 150, height: 165 });
    const edge = padFaceBox({ left: 0, top: 0, width: 100, height: 100 }, 120, 120);
    expect(edge.left).toBe(0);
    expect(edge.top).toBe(0);
    expect(edge.left + edge.width).toBeLessThanOrEqual(120);
    expect(edge.top + edge.height).toBeLessThanOrEqual(120);
  });
});

describe('photo options labels', () => {
  it('has every label in English, Telugu and Hindi', () => {
    const keys = Object.keys(PHOTO_EDIT_LABELS.English).sort();
    (['Telugu', 'Hindi'] as const).forEach(l => {
      expect(Object.keys(PHOTO_EDIT_LABELS[l]).sort()).toEqual(keys);
      Object.values(PHOTO_EDIT_LABELS[l]).forEach(v => expect(v.trim()).not.toBe(''));
    });
  });

  it('shows Original / Blur / Remove BG / Adjust and fills counts', () => {
    expect(['original', 'blur', 'removeBg', 'adjust'].map(k => photoText(k as any))).toEqual([
      'Original',
      'Blur',
      'Remove BG',
      'Adjust',
    ]);
    expect(photoText('adjust', 'Telugu')).toBe('సర్దుబాటు');
    expect(photoText('usePhotos', 'English', 3)).toBe('Use 3 photos');
    expect(photoText('blurFace', null)).toBe('Blur face');
  });
});
