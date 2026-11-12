import {
  antardashas,
  birthMoon,
  computeJathakam,
  mahadashas,
  nameNumber,
  nameStar,
  lifePathNumber,
  GANA,
  NADI,
  YONI_OF,
} from '../src/utils/jathakam';

// Reference: JPL DE421 apparent Moon (skyfield) minus the same Lahiri ayanamsa; Lagna from GAST
// and true obliquity. Target: within 0.1° (AstroSage-style results).
const REF = [
  { dob: '1996-11-23', time: '07:30', lat: 17.385, lng: 78.4867, moon: 11.6952, lagna: 230.8382 },
  { dob: '1985-03-14', time: '22:10', lat: 13.0827, lng: 80.2707, moon: 252.3101, lagna: 206.9923 },
  { dob: '1970-07-01', time: '04:45', lat: 28.6139, lng: 77.209, moon: 44.4923, lagna: 64.9514 },
  { dob: '2001-01-26', time: '13:05', lat: 19.076, lng: 72.8777, moon: 301.6533, lagna: 27.3261 },
  { dob: '2015-09-09', time: '18:20', lat: 20.2961, lng: 85.8245, moon: 101.1784, lagna: 331.491 },
  { dob: '1962-12-31', time: '23:55', lat: 12.9716, lng: 77.5946, moon: 316.5612, lagna: 160.2064 },
];
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe('jathakam (offline birth chart)', () => {
  it.each(REF)('Moon and Lagna within 0.1° for $dob $time', r => {
    const j = computeJathakam({ dob: r.dob, timeOfBirth: r.time }, { name: 'x', lat: r.lat, lng: r.lng, tzMinutes: 330 })!;
    expect(angDiff(j.moon, r.moon)).toBeLessThan(0.1);
    expect(angDiff(j.lagna!, r.lagna)).toBeLessThan(0.1);
    expect(j.rashi).toBe(Math.floor(r.moon / 30));
    expect(j.nakshatra).toBe(Math.floor(r.moon / (360 / 27)));
  });

  it('builds Vimshottari periods that add up', () => {
    const birth = Date.UTC(1996, 10, 23, 2, 0);
    const moon = birthMoon(birth);
    const mds = mahadashas(birth, moon);
    expect(mds[0].start).toBeLessThanOrEqual(birth);
    expect(mds[0].end).toBeGreaterThan(birth);
    for (let i = 1; i < mds.length; i++) expect(mds[i].start).toBe(mds[i - 1].end);
    const ads = antardashas(mds[1]);
    expect(ads[0].lord).toBe(mds[1].lord);
    expect(ads[8].end).toBeCloseTo(mds[1].end, -3);
  });

  it('has complete gana / yoni / nadi tables', () => {
    expect(GANA).toHaveLength(27);
    expect(NADI).toHaveLength(27);
    expect(YONI_OF).toHaveLength(27);
    expect(GANA[23]).toBe(2); // Shatabhisha: Rakshasa
    expect(NADI[0]).toBe(0); // Ashwini: Adi
  });

  it('reads the name star from the first syllable', () => {
    expect(nameStar('Sai Babu')).toEqual({ nakshatra: 23, pada: 1 }); // Shatabhisha pada 2
    expect(nameStar('Lakshmi')!.nakshatra).toBe(0); // La: Ashwini
    expect(nameStar('Ravi')!.nakshatra).toBe(13); // Ra: Chitra
    expect(nameStar('Mahesh')!.nakshatra).toBe(9); // Ma: Magha
    expect(nameStar('')).toBeNull();
  });

  it('does numerology', () => {
    expect(lifePathNumber(1996, 11, 23)).toBe(5); // 1996 -> 7, 11 -> 2, 23 -> 5: 14 -> 5
    expect(nameNumber('Sai')).toBe(5); // 3 + 1 + 1
  });

  it('needs a dob, marks no-time charts', () => {
    expect(computeJathakam({})).toBeNull();
    const j = computeJathakam({ dob: '1996-11-23' })!;
    expect(j.timeKnown).toBe(false);
    expect(j.lagna).toBeNull();
    expect(j.mahadasha).not.toBeNull();
  });
});
