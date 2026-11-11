import { istInstant, panchangFor } from '../src/utils/astro';
import { assessDay, relationOf, saturnRashiAt, shaniPhase, yamagandam, durmuhurtam } from '../src/utils/astroVerdict';
import { dailyReading } from '../src/services/astrologyDaily';
import { VERDICT_TEXT } from '../src/i18n/astroLabels';

const at = (y: number, m: number, d: number, h = 8) => new Date(istInstant(y, m, d, h));

describe('honest daily verdict', () => {
  it('places sidereal Saturn correctly (Kumbha 2024, Meena Nov 2026)', () => {
    expect(saturnRashiAt(istInstant(2021, 6, 1))).toBe(9); // Makara
    expect(saturnRashiAt(istInstant(2024, 1, 15))).toBe(10); // Kumbha
    expect(saturnRashiAt(istInstant(2026, 11, 11))).toBe(11); // Meena
  });

  it('detects Sade Sati for Kumbha / Meena / Mesha moon signs in Nov 2026', () => {
    const sat = saturnRashiAt(istInstant(2026, 11, 11));
    expect(shaniPhase(10, sat)).toBe('sadeSatiSetting'); // Kumbha
    expect(shaniPhase(11, sat)).toBe('sadeSatiPeak'); // Meena
    expect(shaniPhase(0, sat)).toBe('sadeSatiRising'); // Mesha
    expect(shaniPhase(4, sat)).toBe('ashtama'); // Simha: Saturn 8th
    expect(shaniPhase(8, sat)).toBe('ardhashtama'); // Dhanu: Saturn 4th
    expect(shaniPhase(3, sat)).toBeNull(); // Karka: Saturn 9th
    const r = dailyReading({ name: 'Ravi', rashi: 'Meena' }, { date: at(2026, 11, 11) });
    expect(r.verdict!.cautions.map(c => c.text).join(' ')).toMatch(/Sade Sati/);
  });

  it('Ashtama Chandra is a Caution day with a strong negative bullet', () => {
    const a = assessDay({ janmaRashi: 0, janmaStar: null, moonRashi: 7, todayStar: 0, weekdayLord: 4, saturnRashi: 4 });
    expect(a.house).toBe(8);
    expect(a.rating).toBe('caution');
    expect(a.minus).toContain('ashtamaChandra');
    // Real day: find a November 2026 day with the Moon in Vrischika for a Mesha native
    let day = 0;
    for (let d = 1; d <= 30 && !day; d++) if (panchangFor(at(2026, 11, d)).moonRashi === 7) day = d;
    expect(day).toBeGreaterThan(0);
    (['English', 'Telugu', 'Hindi'] as const).forEach(lang => {
      const r = dailyReading({ name: 'Sai', rashi: 'Mesha' }, { uid: 'u1', date: at(2026, 11, day), lang });
      expect(r.verdict!.rating).toBe('caution');
      expect(r.stars).toBe(1);
      expect(r.verdict!.cautions[0].text).toBe(VERDICT_TEXT[lang]!.ashtamaChandra);
      expect(r.verdict!.cautions.length).toBeGreaterThan(1);
      expect(r.verdict!.positives.length).toBeGreaterThan(0);
    });
  });

  it('Sampat tara + Moon in the 11th is a Good day', () => {
    const a = assessDay({ janmaRashi: 0, janmaStar: 0, moonRashi: 10, todayStar: 1, weekdayLord: 0, saturnRashi: 4 });
    expect(a.house).toBe(11);
    expect(a.tara).toBe(2);
    expect(a.rating).toBe('good');
    expect(a.plus).toEqual(expect.arrayContaining(['chandraGood', 'taraGood']));
    // Naidhana tara + 12th house is a Caution day
    const b = assessDay({ janmaRashi: 0, janmaStar: 0, moonRashi: 11, todayStar: 6, weekdayLord: 0, saturnRashi: 4 });
    expect(b.tara).toBe(7);
    expect(b.rating).toBe('caution');
  });

  it('dasha friendship, inauspicious times', () => {
    expect(relationOf(6, 0)).toBe('enemy'); // Saturn dasha on a Sunday
    expect(relationOf(4, 0)).toBe('friend');
    const p = panchangFor(at(2026, 11, 15)); // Sunday
    const y = yamagandam(0, p.sunrise, p.sunset);
    // Sunday: Yamagandam is the 5th eighth of the day, Rahu kalam the 8th
    expect(y.start).toBeCloseTo(p.sunrise + ((p.sunset - p.sunrise) / 8) * 4, -3);
    expect(y.end).toBeLessThanOrEqual(p.rahu.start);
    expect(durmuhurtam(1, p.sunrise, p.sunset)).toHaveLength(2);
  });

  it('is stable for a person all day, and differs between people on the same day', () => {
    const date1 = at(2026, 11, 12, 7);
    const date2 = at(2026, 11, 12, 21);
    const a = { name: 'Sai Babu', dob: '1996-05-14', timeOfBirth: '07:30 AM' };
    const b = { name: 'Lakshmi', dob: '1990-01-03', timeOfBirth: '11:10 PM' };
    expect(dailyReading(a, { uid: 'a', date: date1 }).verdict).toEqual(dailyReading(a, { uid: 'a', date: date2 }).verdict);
    const va = dailyReading(a, { uid: 'a', date: date1 }).verdict!;
    const vb = dailyReading(b, { uid: 'b', date: date1 }).verdict!;
    expect([...va.positives, ...va.cautions].map(x => x.text)).not.toEqual([...vb.positives, ...vb.cautions].map(x => x.text));
    // Over a month a person sees all three ratings, not always positive
    const seen = new Set<string>();
    for (let d = 1; d <= 30; d++) seen.add(dailyReading(a, { uid: 'a', date: at(2026, 11, d) }).verdict!.rating);
    expect(seen.size).toBe(3);
    // Languages without their own verdict text fall back to English
    expect(dailyReading(a, { uid: 'a', date: date1, lang: 'Tamil' }).verdict!.lang).toBe('English');
  });

  it('has complete EN / Telugu / Hindi verdict tables', () => {
    const en = VERDICT_TEXT.English!;
    (['Telugu', 'Hindi'] as const).forEach(l => {
      const t = VERDICT_TEXT[l]!;
      expect(Object.keys(t).sort()).toEqual(Object.keys(en).sort());
      expect(t.taras).toHaveLength(9);
      expect(t.deities).toHaveLength(9);
      expect(t.chandraGood.filter(Boolean)).toHaveLength(6);
    });
  });
});
