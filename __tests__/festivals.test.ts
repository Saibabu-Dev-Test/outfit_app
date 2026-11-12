import { FESTIVALS, festivalText, wearText } from '../src/services/festivals';
import { ASTRO_LANGS, colourName, COLOUR_KEYS } from '../src/i18n/astroNames';

const on = (id: string) => FESTIVALS.find(f => f.id === id)!.dates;

describe('festivals 2026-27', () => {
  it('has the full list with names in all 12 languages', () => {
    expect(FESTIVALS.length).toBeGreaterThanOrEqual(55);
    expect(new Set(FESTIVALS.map(f => f.id)).size).toBe(FESTIVALS.length);
    FESTIVALS.forEach(f => {
      ASTRO_LANGS.forEach(l => expect(f.name[l]?.trim().length).toBeGreaterThan(0));
      expect(f.about.Telugu && f.celebrate.Telugu && f.wear.Telugu).toBeTruthy();
      f.dates.forEach(d => expect(d).toMatch(/^202[678]-\d\d-\d\d$/));
      f.colours.forEach(c => expect((COLOUR_KEYS as readonly string[]).includes(c.name.toLowerCase())).toBe(true));
    });
  });

  it('uses the settled / government dates', () => {
    expect(on('bathukamma')).toContain('2026-10-10');
    expect(on('holi')).toContain('2027-03-22');
    expect(on('ugadi')).toContain('2027-04-07');
    expect(on('dasara')).toContain('2027-10-09');
    expect(on('bakrid')).toContain('2026-05-27');
    expect(on('muharram')).toEqual(['2026-06-26', '2027-06-16']);
    expect(on('milad')).toEqual(['2026-08-26', '2027-08-15']);
    expect(on('goodfriday')).toEqual(['2026-04-03', '2027-03-26']);
    expect(on('karthikasomavaram')).toHaveLength(8);
  });

  it('shows festival dress colours in Telugu and Odia', () => {
    expect(colourName('Maroon', 'Telugu')).toBe('మెరూన్');
    expect(colourName('Peacock Blue', 'Telugu')).toBe('నెమలి నీలం');
    expect(colourName('Yellow', 'Odia')).toBe('ହଳଦିଆ');
    expect(festivalText(FESTIVALS[0], 'Odia').name).toBe('ନୂଆ ବର୍ଷ');
    expect(festivalText(FESTIVALS[0], 'Odia').about).toBe(FESTIVALS[0].about.English);
  });

  it('has every festival name and dress-colour line in all 12 languages', () => {
    FESTIVALS.forEach(f =>
      ASTRO_LANGS.forEach(l => {
        const t = festivalText(f, l);
        expect(t.name.trim().length).toBeGreaterThan(0);
        expect(t.wear.trim().length).toBeGreaterThan(0);
        if (l !== 'English' && l !== 'Telugu') {
          f.colours.forEach(c => expect(t.wear).toContain(colourName(c.name, l)));
        }
      }),
    );
    expect(wearText(FESTIVALS.find(f => f.id === 'holi')!, 'Hindi')).toBe('पहनने के रंग: सफ़ेद');
    expect(festivalText(FESTIVALS[0], 'Telugu').wear).toBe(FESTIVALS[0].wear.Telugu);
  });
});
