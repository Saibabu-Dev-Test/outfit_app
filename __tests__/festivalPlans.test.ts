import { FESTIVALS } from '../src/services/festivals';
import { FESTIVAL_PLANS, festivalDressFor, PLAN_LABELS, planText } from '../src/services/festivalPlans';
import { ASTRO_LANGS, COLOUR_KEYS } from '../src/i18n/astroNames';

describe('festival planning cards', () => {
  it('has a plan (English + Telugu) for every festival', () => {
    FESTIVALS.forEach(f => {
      const p = FESTIVAL_PLANS[f.id];
      expect(p).toBeTruthy();
      (['prep', 'fast', 'food'] as const).forEach(k => {
        expect(p[k].English.length).toBeGreaterThan(10);
        expect(p[k].Telugu).toMatch(/[\u0C00-\u0C7F]/);
      });
    });
    expect(Object.keys(FESTIVAL_PLANS).length).toBe(FESTIVALS.length);
  });

  it('has headings in all 12 languages and falls back to English text', () => {
    ASTRO_LANGS.forEach(l => Object.values(PLAN_LABELS[l]).forEach(v => expect(v.trim().length).toBeGreaterThan(0)));
    expect(planText('ugadi', 'Tamil').food).toBe(planText('ugadi', 'English').food);
    expect(planText('ugadi', 'Telugu').food).toMatch(/ఉగాది/);
  });

  it('picks the dress colour from the rashi lord', () => {
    const sankranti = FESTIVALS.find(f => f.id === 'sankranti')!; // Yellow, Green, Maroon
    // Dhanu (8): Guru -> Yellow, a festival colour
    expect(festivalDressFor(sankranti, 8)).toEqual({ main: { name: 'Yellow', hex: '#FBC02D' }, accent: null });
    // Mithuna (2): Budha -> Green
    expect(festivalDressFor(sankranti, 2)?.main.name).toBe('Green');
    // Makara (9): Shani -> no match: festival colour + blue accent
    const m = festivalDressFor(sankranti, 9)!;
    expect(m.main.name).toBe('Yellow');
    expect(m.accent?.name).toBe('Blue');
    expect(festivalDressFor(sankranti, null)).toBeNull();
    // every colour it can return has a name in the 12 languages
    FESTIVALS.forEach(f =>
      Array.from({ length: 12 }, (_, r) => festivalDressFor(f, r)).forEach(d => {
        [d!.main, d!.accent].filter(Boolean).forEach(c => expect((COLOUR_KEYS as readonly string[]).includes(c!.name.toLowerCase())).toBe(true));
      }),
    );
  });
});
