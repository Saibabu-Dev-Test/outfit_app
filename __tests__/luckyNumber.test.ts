import { istInstant } from '../src/utils/astro';
import { digitRoot, isFriendly, luckyNumbers, NUMBER_FRIENDS } from '../src/utils/luckyNumber';
import { dailyReading } from '../src/services/astrologyDaily';
import { LABELS } from '../src/i18n/astroLabels';
import { ASTRO_LANGS } from '../src/i18n/astroNames';

const at = (y: number, m: number, d: number, h = 8) => new Date(istInstant(y, m, d, h));

describe('lucky number (numerology, offline)', () => {
  it('reduces digits to 1-9', () => {
    expect(digitRoot(23)).toBe(5);
    expect(digitRoot(29)).toBe(2);
    expect(digitRoot(9)).toBe(9);
    expect(digitRoot(1996 + 5 + 14)).toBe(8);
  });

  it('uses a friendship table that is complete and includes no self-enemies', () => {
    for (let n = 1; n <= 9; n++) {
      expect(NUMBER_FRIENDS[n].length).toBeGreaterThan(0);
      expect(NUMBER_FRIENDS[n]).not.toContain(n);
      NUMBER_FRIENDS[n].forEach(f => expect(f >= 1 && f <= 9).toBe(true));
    }
    expect(isFriendly(1, 9)).toBe(true); // Sun - Mars
    expect(isFriendly(1, 8)).toBe(false); // Sun - Saturn
    expect(isFriendly(4, 8)).toBe(true); // Rahu as Saturn
  });

  it('computes birth, destiny and day numbers from the date of birth', () => {
    // 1996-05-14: birth 1+4 = 5, destiny 1+9+9+6+0+5+1+4 = 35 -> 8; 2026-11-11: 2+0+2+6+1+1+1+1 = 14 -> 5
    const r = luckyNumbers({ dob: '1996-05-14', dayKey: '2026-11-11', seed: 42 })!;
    expect(r.basis).toBe('dob');
    expect(r.base).toBe(5);
    expect(r.destiny).toBe(8);
    expect(r.day).toBe(5);
    expect(r.lucky).toBe(5); // today's number is the birth number: the day supports you
    expect(r.second).not.toBe(r.lucky);
  });

  it('always picks numbers friendly to the birth number', () => {
    for (let d = 1; d <= 31; d++) {
      for (let day = 1; day <= 28; day += 3) {
        const dob = `1990-01-${String(d).padStart(2, '0')}`;
        const key = `2026-02-${String(day).padStart(2, '0')}`;
        const r = luckyNumbers({ dob, dayKey: key, seed: d * 131 + day })!;
        expect(isFriendly(r.base, r.lucky)).toBe(true);
        if (r.second !== null) {
          expect(isFriendly(r.base, r.second)).toBe(true);
          expect(r.second).not.toBe(r.lucky);
        }
      }
    }
  });

  it('prefers the destiny number as the second number when friendly', () => {
    // 1990-01-10: birth 1, destiny 1+9+9+0+1+1+0 = 21 -> 3 (a friend of 1)
    const a = luckyNumbers({ dob: '1990-01-10', dayKey: '2026-11-13', seed: 0 })!; // day 7: not a friend of 1
    expect(a.destiny).toBe(3);
    expect(a.lucky).not.toBe(3);
    expect(a.second).toBe(3);
  });

  it('falls back to the name number, then the rashi lord, else null', () => {
    const byName = luckyNumbers({ name: 'Sai', dayKey: '2026-11-11', seed: 1 })!;
    expect(byName.basis).toBe('name');
    expect(byName.destiny).toBeNull();
    const byRashi = luckyNumbers({ rashiLord: 0, dayKey: '2026-11-11', seed: 1 })!;
    expect(byRashi.basis).toBe('rashi');
    expect(byRashi.base).toBe(1);
    expect(luckyNumbers({ dayKey: '2026-11-11', seed: 1 })).toBeNull();
  });

  it('is in the daily reading, the same all day and per user', () => {
    const p = { name: 'Sai Babu', dob: '1996-05-14', gender: 'Male' };
    const a = dailyReading(p, { uid: 'u1', date: at(2026, 11, 10, 7) });
    const b = dailyReading(p, { uid: 'u1', date: at(2026, 11, 10, 22) });
    expect(a.luckyNumber).not.toBeNull();
    expect(a.luckyNumber).toBe(b.luckyNumber);
    expect(a.luckyNumber2).toBe(b.luckyNumber2);
    const te = dailyReading(p, { uid: 'u1', date: at(2026, 11, 10), lang: 'Telugu' });
    expect(te.luckyNumber).toBe(a.luckyNumber); // numbers don't depend on the language
    expect(dailyReading({ name: 'Sai' }, { uid: 'u2', date: at(2026, 11, 10) }).luckyNumber).not.toBeNull();
    expect(dailyReading({}, { date: at(2026, 11, 10) }).luckyNumber).toBeNull();
  });

  it('has a "Lucky number" label in every language', () => {
    ASTRO_LANGS.forEach(l => expect(LABELS[l].luckyNumber.trim().length).toBeGreaterThan(0));
    expect(LABELS.English.luckyNumber).toBe('Lucky number');
  });
});
