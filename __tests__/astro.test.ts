import {
  birthChart,
  chandraHouse,
  istInstant,
  moonLongitude,
  panchangFor,
  rashiIndex,
  sunLongitude,
  taraOf,
} from '../src/utils/astro';
import { dailyReading } from '../src/services/astrologyDaily';
import { festivalsAround } from '../src/services/festivals';

const at = (y: number, m: number, d: number, h = 8) => new Date(istInstant(y, m, d, h));

describe('astro (offline panchang)', () => {
  it('matches the Meeus reference positions', () => {
    // Meeus example 47.a: 1992-04-12 0h TD, Moon 133.16°; example 25.a: 1992-10-13 0h, Sun 199.91°
    expect(moonLongitude(Date.UTC(1992, 3, 12))).toBeCloseTo(133.16, 1);
    expect(sunLongitude(Date.UTC(1992, 9, 13))).toBeCloseTo(199.91, 1);
  });

  it('gives the tithi at Hyderabad sunrise on known festival days', () => {
    expect(panchangFor(at(2026, 11, 8)).tithi).toBe(29); // Deepavali: Chaturdashi at sunrise, Amavasya by evening
    expect(panchangFor(at(2026, 11, 13)).tithi).toBe(4); // Nagula Chavithi: Shukla Chaturthi
    expect(panchangFor(at(2026, 11, 24)).tithi).toBe(15); // Karthika Pournami
    expect(panchangFor(at(2026, 10, 20)).tithi).toBeGreaterThanOrEqual(9); // Vijayadashami: Navami -> Dashami
  });

  it('has sunrise around 6 AM IST and Rahu kalam inside the day', () => {
    const p = panchangFor(at(2026, 11, 10));
    const h = new Date(p.sunrise + 330 * 60000).getUTCHours();
    expect(h).toBe(6);
    expect(p.rahu.start).toBeGreaterThan(p.sunrise);
    expect(p.rahu.end).toBeLessThan(p.sunset + 1);
    expect(p.horas).toHaveLength(12);
    expect(p.horas[0].planet).toBe(2); // Tuesday's first hora is Mars
  });

  it('reads saved rashi names and computes a moon sign from the birth date', () => {
    expect(rashiIndex('Simha (Leo)')).toBe(4);
    expect(rashiIndex('మీనం')).toBe(11);
    const c = birthChart({ dob: '1996-11-23', timeOfBirth: '07:30 AM' });
    expect(c?.rashiSource).toBe('computed');
    expect(c?.timeKnown).toBe(true);
    expect(c?.rashi).toBeGreaterThanOrEqual(0);
    const saved = birthChart({ dob: '1996-11-23', rashi: 'Mesha (Aries)' });
    expect(saved?.rashi).toBe(0);
    expect(birthChart({})).toBeNull();
    expect(chandraHouse(11, 0)).toBe(2);
    expect(taraOf(0, 1)).toBe(2);
  });

  it('is the same all day for a user and positive', () => {
    const p = { name: 'Sai Babu', dob: '1996-05-14', gender: 'Male' };
    const a = dailyReading(p, { uid: 'u1', date: at(2026, 11, 10, 7) });
    const b = dailyReading(p, { uid: 'u1', date: at(2026, 11, 10, 22) });
    expect(a.overview).toBe(b.overview);
    expect(a.crush.text).toBe(b.crush.text);
    expect(a.stars).toBeGreaterThanOrEqual(3);
    expect(a.dress.colours.length).toBeGreaterThan(0);
    expect(a.dress.title).toMatch(/Red|Coral/); // Tuesday
    expect(a.needsDob).toBe(false);
    const te = dailyReading(p, { uid: 'u1', date: at(2026, 11, 10), lang: 'Telugu' });
    expect(te.greeting).toMatch(/శుభదినం/);
    expect(dailyReading({}, { date: at(2026, 11, 10) }).needsDob).toBe(true);
  });

  it('finds festivals today and coming up', () => {
    expect(festivalsAround(at(2026, 11, 24)).today[0].festival.id).toBe('karthika');
    const soon = festivalsAround(at(2026, 11, 20));
    const k = soon.upcoming.find(h => h.festival.id === 'karthika')!;
    expect(k.inDays).toBe(4);
    expect(soon.upcoming[0].festival.id).toBe('karthikasomavaram'); // Monday 23 Nov
    expect(festivalsAround(at(2027, 10, 29)).today[0].festival.id).toBe('deepavali');
  });
});
