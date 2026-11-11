import { ALL_CHIPS, chipSuggestion, OCCASIONS, PLACES, placeAdvice } from '../src/services/stylistPlaces';
import type { AiLanguage } from '../src/services/aiStylist';

const item = (id: string, category: string, name: string, color: string) =>
  ({ id, userId: 'u', name, category, color, fabric: null, imageUrl: null, hasMedia: false, isPublic: false, createdAt: '', updatedAt: '' } as any);

const SAMPLE = [
  item('t1', 'T-Shirts', 'T-Shirt', 'White'),
  item('t2', 'Shirts', 'Formal shirt', 'Light Blue'),
  item('t3', 'Kurtas', 'Kurta', 'Yellow'),
  item('b1', 'Jeans', 'Jeans', 'Blue'),
  item('b2', 'Trousers', 'Formal trousers', 'Black'),
];
const LANGS: AiLanguage[] = ['English', 'Telugu', 'Hindi'];
const WED = new Date('2026-11-11T08:00:00Z');

describe('Style screen chips', () => {
  it('covers every occasion and place the owner listed', () => {
    ['Indoor', 'Outdoor', 'Office', 'College', 'Temple', 'Wedding', 'Party', 'Date', 'Interview', 'Beach', 'Hill station', 'Gym', 'Travel', 'Home / Night'].forEach(p =>
      expect(PLACES).toContain(p),
    );
    OCCASIONS.forEach(o => expect(ALL_CHIPS).toContain(o));
  });

  it.each(ALL_CHIPS)('"%s" gives at least one suggestion with an empty wardrobe', chip => {
    LANGS.forEach(lang => {
      const s = chipSuggestion([], lang, chip, { date: WED });
      expect(s).not.toBeNull();
      expect(s!.count).toBeGreaterThanOrEqual(1);
      expect(s!.advice.best.length).toBeGreaterThan(10);
      expect(s!.advice.add).not.toBeNull(); // says what to add
      s!.advice.lines.forEach(l => expect(l).not.toMatch(/undefined|\{\w+\}|error/i));
    });
  });

  it.each(ALL_CHIPS)('"%s" gives wardrobe pairs + advice with a sample wardrobe', chip => {
    LANGS.forEach(lang => {
      const s = chipSuggestion(SAMPLE, lang, chip, { date: WED })!;
      expect(s.pairs.pairs.length).toBeGreaterThanOrEqual(1);
      expect(s.pairs.pairs.length).toBeLessThanOrEqual(3);
      expect(s.advice.lines.length).toBeGreaterThanOrEqual(2);
      expect(s.advice.have || s.advice.closest).toBeTruthy(); // names a wardrobe item
    });
  });

  it('suggests shorts for the beach, night pants for home and a jacket for a hill station', () => {
    const beach = placeAdvice(SAMPLE, 'English', 'Beach', WED)!;
    expect(beach.best).toMatch(/Shorts and a light linen/);
    expect(beach.add).toMatch(/shorts/);
    expect(beach.closest).toMatch(/Closest in your wardrobe now: White T-Shirt/);
    expect(placeAdvice([], 'English', 'Home / Night', WED)!.best).toMatch(/Night pants \/ a pyjama set/);
    const hill = placeAdvice(SAMPLE, 'English', 'Hill station', WED)!;
    expect(hill.best).toMatch(/warm jacket/);
    expect(hill.add).toMatch(/jacket/);
    expect(placeAdvice(SAMPLE, 'English', 'Temple', WED)!.have).toMatch(/Yellow Kurta/);
    expect(placeAdvice(SAMPLE, 'English', 'Interview', WED)!.have).toMatch(/Formal/);
    expect(placeAdvice(SAMPLE, 'Telugu', 'Beach', WED)!.best).toMatch(/షార్ట్స్/);
    expect(placeAdvice(SAMPLE, 'Hindi', 'Beach', WED)!.best).toMatch(/शॉर्ट्स/);
  });

  it('a hill station prefers the jacket and the beach avoids formal trousers', () => {
    const w = [...SAMPLE, item('j1', 'Jackets', 'Jacket', 'Black'), item('s1', 'Shorts', 'Shorts', 'Beige')];
    const hill = chipSuggestion(w, 'English', 'Hill station', { date: WED })!;
    expect(hill.pairs.pairs[0].top.id).toBe('j1');
    expect(hill.advice.add).toBeNull();
    const beach = chipSuggestion(w, 'English', 'Beach', { date: WED })!;
    expect(beach.pairs.pairs[0].bottom.id).toBe('s1');
  });
});
