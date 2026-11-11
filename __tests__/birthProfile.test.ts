import { astroChartFor, astroChartStale, birthDetailsComplete, birthKey, birthProfileUpdate } from '../src/services/birthProfile';
import { birthChartRows } from '../src/services/astrologyDaily';
import { computeJathakam } from '../src/utils/jathakam';
import { birthPlaceOf } from '../src/constants/indianCities';

const NOW = Date.UTC(2026, 10, 11, 6);
const sai = { name: 'Sai', dob: '1996-11-25', timeOfBirth: '06:10 AM', placeOfBirth: 'Bhubaneswar, Odisha' };

describe('profile birth details -> auto birth chart', () => {
  it('fills every chart field from the offline engine', () => {
    const c = astroChartFor(sai, NOW)!;
    const j = computeJathakam(sai, birthPlaceOf(sai.placeOfBirth)!, NOW)!;
    expect(c.rashiIndex).toBe(j.rashi);
    expect(c.rashi).toMatch(/\(/); // 'Simha (Leo)' style, same as the old Rashi list
    expect(c.nakshatraIndex).toBe(j.nakshatra);
    expect(c.pada).toBe(j.pada + 1);
    expect(c.lagna).toBeTruthy(); // birth time known
    expect(c.birthTithi && c.gana && c.yoni && c.nadi && c.mahadasha && c.mahadashaUntil).toBeTruthy();
    expect(c.lifePath).toBeGreaterThan(0);
    expect(c.place).toBe('Bhubaneswar, Odisha');
    expect(astroChartFor({ ...sai, timeOfBirth: '' }, NOW)!.lagna).toBeNull();
    expect(astroChartFor({ name: 'Sai' }, NOW)).toBeNull();
  });

  it('recomputes when the details change and keeps confirmation only for the same details', () => {
    const c = astroChartFor(sai, NOW)!;
    expect(astroChartStale(sai, c, NOW)).toBe(false);
    expect(astroChartStale({ ...sai, timeOfBirth: '11:45 PM' }, c, NOW)).toBe(true);
    expect(astroChartStale(sai, null, NOW)).toBe(true);
    expect(astroChartStale({ name: 'x' }, null, NOW)).toBe(false); // no dob: nothing to compute
    expect(astroChartStale(sai, { ...c, mahadashaUntil: '2020-01-01' }, NOW)).toBe(true); // dasha ended

    const confirmed = birthProfileUpdate(sai, { confirm: true, nowMs: NOW });
    expect(confirmed.birthConfirmed).toBe(true);
    expect(confirmed.birthConfirmedKey).toBe(birthKey(sai));
    expect(confirmed.rashi).toBe(confirmed.astroChart!.rashi); // rashi auto-filled
    const same = birthProfileUpdate(sai, { prevConfirmedKey: confirmed.birthConfirmedKey, nowMs: NOW });
    expect(same.birthConfirmed).toBe(true);
    const changed = birthProfileUpdate({ ...sai, dob: '1996-11-26' }, { prevConfirmedKey: confirmed.birthConfirmedKey, nowMs: NOW });
    expect(changed.birthConfirmed).toBe(false);
    expect(changed.birthConfirmedKey).toBeNull();
    // Time of birth is optional; name, date and place are needed
    expect(birthDetailsComplete({ ...sai, timeOfBirth: '' })).toBe(true);
    expect(birthDetailsComplete({ ...sai, placeOfBirth: '' })).toBe(false);
    expect(birthProfileUpdate({ name: 'A', rashi: 'Mesha (Aries)' }).rashi).toBe('Mesha (Aries)');
  });

  it('shows the chart rows in the reading language', () => {
    const j = computeJathakam(sai, birthPlaceOf(sai.placeOfBirth)!, NOW)!;
    const te = birthChartRows(j, 'Telugu');
    const keys = te.map(r => r.key);
    ['rashi', 'nakshatra', 'lagna', 'mahadasha', 'tithi', 'gana', 'yoni', 'nadi', 'lifePath', 'birthNumber', 'place'].forEach(k =>
      expect(keys).toContain(k),
    );
    expect(te[0].value).toMatch(/[\u0C00-\u0C7F]/); // Telugu script
    expect(birthChartRows(j, 'English')).toHaveLength(te.length);
  });
});
