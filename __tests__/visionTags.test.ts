import { nearestSwatch, tagsFromVision } from '../src/utils/visionTags';
import { COLOR_SWATCHES } from '../src/constants/wardrobe';

describe('visionTags', () => {
  it('maps ML Kit labels to a wardrobe category', () => {
    const t = tagsFromVision([{ text: 'Jeans', confidence: 0.9 }], null);
    expect(t).not.toBeNull();
    expect(t!.category).not.toBe('');
    expect(t!.confidence).toBeCloseTo(0.9);
  });

  it('takes the most confident clothing label', () => {
    const t = tagsFromVision(
      [
        { text: 'Sky', confidence: 0.99 },
        { text: 'Dress', confidence: 0.6 },
        { text: 'Shirt', confidence: 0.8 },
      ],
      null,
    );
    const shirt = tagsFromVision([{ text: 'Shirt', confidence: 0.8 }], null);
    expect(t!.category).toBe(shirt!.category);
  });

  it('picks the nearest colour swatch', () => {
    const first = COLOR_SWATCHES[0];
    expect(nearestSwatch(first.hex)?.label).toBe(first.label);
    expect(nearestSwatch('not a colour')).toBeNull();
    expect(nearestSwatch(null)).toBeNull();
  });

  it('returns null when nothing is useful', () => {
    expect(tagsFromVision([{ text: 'Sky', confidence: 0.9 }], null)).toBeNull();
    expect(tagsFromVision([], null)).toBeNull();
  });

  it('suggests a colour even without a category', () => {
    const t = tagsFromVision([], COLOR_SWATCHES[0].hex);
    expect(t?.colorName).toBe(COLOR_SWATCHES[0].label);
    expect(t?.category).toBe('');
  });
});
