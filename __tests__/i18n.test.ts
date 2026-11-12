import { ASTRO_LANGS, astroLanguage, COLOUR_NAMES, GANA_NAMES, NADI_NAMES, NAKSHATRA_NAMES, PLANET_NAMES, RASHI_NAMES, TITHI_NAMES, WEEKDAY_NAMES, YONI_NAMES, colourName } from '../src/i18n/astroNames';
import { LABELS } from '../src/i18n/astroLabels';
import { PROSE, PROSE_KEYS } from '../src/i18n/astroProse';
import { dailyReading } from '../src/services/astrologyDaily';
import { istInstant } from '../src/utils/astro';

describe('astrology languages', () => {
  it('has every name table and label in all 12 languages', () => {
    expect(ASTRO_LANGS).toHaveLength(12);
    const sizes: [Record<string, string[]>, number][] = [
      [NAKSHATRA_NAMES, 27], [RASHI_NAMES, 12], [TITHI_NAMES, 18], [PLANET_NAMES, 9], [WEEKDAY_NAMES, 7],
      [COLOUR_NAMES, 21], [GANA_NAMES, 3], [NADI_NAMES, 3], [YONI_NAMES, 14],
    ];
    const keys = Object.keys(LABELS.English);
    ASTRO_LANGS.forEach(l => {
      sizes.forEach(([t, n]) => {
        expect(t[l]).toHaveLength(n);
        t[l].forEach(v => expect(v.trim().length).toBeGreaterThan(0));
      });
      expect(Object.keys(LABELS[l]).sort()).toEqual([...keys].sort());
      Object.values(LABELS[l]).forEach(v => expect(v.trim()).not.toBe(''));
    });
  });

  it('has complete prose for English, Telugu, Odia and Urdu', () => {
    (['English', 'Telugu', 'Odia', 'Urdu'] as const).forEach(l => {
      const p = PROSE[l]!;
      PROSE_KEYS.forEach(k => expect(p.t[k]?.trim().length).toBeGreaterThan(0));
      expect(p.house).toHaveLength(12);
      expect(p.generalDo).toHaveLength(7);
      expect(p.benefit).toHaveLength(7);
    });
  });

  it('maps profile languages and reads in Odia', () => {
    expect(astroLanguage('Odia')).toBe('Odia');
    expect(astroLanguage('ଓଡ଼ିଆ')).toBe('Odia');
    expect(astroLanguage('ur')).toBe('Urdu');
    expect(colourName('Orange / Gold', 'Telugu')).toBe('నారింజ / బంగారు రంగు');
    const r = dailyReading({ name: 'Sai', dob: '1996-11-25', timeOfBirth: '06:10 AM', placeOfBirth: 'Bhubaneswar, Odisha', gender: 'Male' }, { date: new Date(istInstant(2026, 11, 11, 9)), lang: 'Odia' });
    expect(r.greeting).toMatch(/ଶୁଭ ଦିନ/);
    expect(r.chartRows.length).toBeGreaterThan(8);
    expect(r.jathakam?.place.name).toBe('Bhubaneswar, Odisha');
    expect(r.dress.colours[0].name).toMatch(/[\u0B00-\u0B7F]/); // Odia script
  });

  it('falls back to the name star without a date of birth', () => {
    const r = dailyReading({ name: 'Sai Babu' }, { date: new Date(istInstant(2026, 11, 11, 9)) });
    expect(r.needsDob).toBe(false);
    expect(r.chart?.nakshatra).toBe(23); // Shatabhisha
    expect(r.rashiLine).toMatch(/Shatabhisha/);
  });
});
