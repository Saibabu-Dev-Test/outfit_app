import {
  computePorutham,
  isVedha,
  lordsInEnmity,
  rajjuOf,
  rashiCount,
  rashisOfNakshatra,
  starCount,
  yoniEnemies,
} from '../src/utils/porutham';

const matches = (r: ReturnType<typeof computePorutham>) =>
  Object.fromEntries(r.results.map(x => [x.key, x.match])) as Record<string, boolean>;

describe('porutham helpers', () => {
  test('counts from the bride to the groom, inclusive', () => {
    expect(starCount(0, 0)).toBe(1);
    expect(starCount(0, 3)).toBe(4);
    expect(starCount(20, 2)).toBe(10);
    expect(rashiCount(0, 1)).toBe(2);
    expect(rashiCount(11, 0)).toBe(2);
  });
  test('nakshatra -> rashi(s)', () => {
    expect(rashisOfNakshatra(0)).toEqual([0]); // Ashwini: Mesha
    expect(rashisOfNakshatra(2)).toEqual([0, 1]); // Krittika: Mesha / Vrishabha
    expect(rashisOfNakshatra(3)).toEqual([1]); // Rohini: Vrishabha
    expect(rashisOfNakshatra(4)).toEqual([1, 2]); // Mrigashira
    expect(rashisOfNakshatra(26)).toEqual([11]); // Revati: Meena
  });
  test('rajju groups', () => {
    // Pada: Ashwini, Ashlesha, Magha, Jyeshtha, Mula, Revati
    expect([0, 8, 9, 17, 18, 26].map(rajjuOf)).toEqual([0, 0, 0, 0, 0, 0]);
    // Siro: Mrigashira, Chitra, Dhanishta
    expect([4, 13, 22].map(rajjuOf)).toEqual([4, 4, 4]);
    // Kantha: Rohini, Ardra, Hasta, Swati, Shravana, Shatabhisha
    expect([3, 5, 12, 14, 21, 23].map(rajjuOf)).toEqual([3, 3, 3, 3, 3, 3]);
  });
  test('vedha, yoni and lord tables', () => {
    expect(isVedha(0, 17)).toBe(true); // Ashwini - Jyeshtha
    expect(isVedha(13, 22)).toBe(true); // Chitra - Dhanishta
    expect(isVedha(0, 3)).toBe(false);
    expect(yoniEnemies(5, 6)).toBe(true); // Cat - Rat
    expect(yoniEnemies(9, 7)).toBe(true); // Tiger - Cow
    expect(yoniEnemies(0, 3)).toBe(false);
    expect(lordsInEnmity(0, 6)).toBe(true); // Sun - Saturn
    expect(lordsInEnmity(2, 5)).toBe(false); // Mars - Venus (neutral)
  });
});

describe('computePorutham known pairs', () => {
  test('Ashwini bride, Rohini groom: 7/10, favourable', () => {
    const r = computePorutham({ nakshatra: 0, rashi: 0 }, { nakshatra: 3, rashi: 1 });
    expect(matches(r)).toEqual({
      dina: true,
      gana: true,
      mahendra: true,
      streeDeergha: false,
      yoni: true,
      rasi: false,
      rasyadhipathi: true,
      vasya: false,
      rajju: true,
      vedha: true,
    });
    expect(r.score).toBe(7);
    expect(r.verdict).toBe('good');
  });
  test('Ashwini bride, Magha groom: same (Pada) rajju, 6/10', () => {
    const r = computePorutham({ nakshatra: 0, rashi: 0 }, { nakshatra: 9, rashi: 4 });
    const m = matches(r);
    expect(m.rajju).toBe(false);
    expect(m.gana).toBe(false); // Deva - Rakshasa
    expect(m.mahendra).toBe(true); // count 10
    expect(m.vasya).toBe(true); // Mesha -> Simha
    expect(r.score).toBe(6);
    expect(r.rajjuOk).toBe(false);
    expect(r.verdict).toBe('fair');
  });
  test('Ashwini bride, Jyeshtha groom: Vedha', () => {
    const r = computePorutham({ nakshatra: 0, rashi: 0 }, { nakshatra: 17, rashi: 7 });
    const m = matches(r);
    expect(m.vedha).toBe(false);
    expect(m.dina).toBe(true); // count 18
    expect(m.streeDeergha).toBe(true);
    expect(r.verdict).not.toBe('good');
  });
  test('same star (Rohini) both: 6/10 with rajju dosha', () => {
    const r = computePorutham({ nakshatra: 3, rashi: 1 }, { nakshatra: 3, rashi: 1 });
    expect(r.score).toBe(6);
    expect(matches(r).rajju).toBe(false);
  });
  test('every result has English and Telugu lines', () => {
    const r = computePorutham({ nakshatra: 12, rashi: 5 }, { nakshatra: 21, rashi: 9 });
    expect(r.results).toHaveLength(10);
    r.results.forEach(x => {
      expect(x.why.en.length).toBeGreaterThan(5);
      expect(x.why.te.length).toBeGreaterThan(5);
    });
    expect(r.verdictText.te.length).toBeGreaterThan(5);
  });
  test('rejects invalid input', () => {
    expect(() => computePorutham({ nakshatra: 27, rashi: 0 }, { nakshatra: 0, rashi: 0 })).toThrow();
  });
});
