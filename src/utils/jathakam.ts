// Offline birth chart (janma jathakam): sidereal (Lahiri) Moon and Lagna, janma rashi, nakshatra +
// pada, Vimshottari Mahadasha / Antardasha, birth tithi, gana, yoni, nadi and numerology.
// No network. Moon: full Meeus ch. 47 longitude series + ΔT + nutation (≈0.01° vs JPL DE421);
// Lagna: true sidereal time and obliquity (≈0.01° for a correct birth time and place).
// Birth place comes from the bundled city list (constants/indianCities.ts); default Hyderabad.
import {
  HYDERABAD,
  julianDay,
  lahiriAyanamsa,
  moonLongitude,
  nakshatraLord,
  parseBirthTime,
  parseDob,
  sunLongitude,
} from './astro';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const norm = (d: number) => ((d % 360) + 360) % 360;
const NAK = 360 / 27;
const DAY_MS = 86400000;
const YEAR_MS = 365.25 * DAY_MS; // Vimshottari year (as most Indian software)

export interface BirthPlace {
  name: string;
  lat: number;
  lng: number;
  tzMinutes: number; // offset from UTC at birth (IST = 330)
}
export const DEFAULT_PLACE: BirthPlace = { name: 'Hyderabad', lat: HYDERABAD.lat, lng: HYDERABAD.lng, tzMinutes: 330 };

// Nutation in longitude / obliquity (degrees), Meeus ch. 22 low-precision form
export const nutation = (ms: number): { dPsi: number; dEps: number } => {
  const T = (julianDay(ms) - 2451545) / 36525;
  const om = rad(125.04452 - 1934.136261 * T);
  const L = rad(280.4665 + 36000.7698 * T);
  const Lp = rad(218.3165 + 481267.8813 * T);
  const dPsi = (-17.2 * Math.sin(om) - 1.32 * Math.sin(2 * L) - 0.23 * Math.sin(2 * Lp) + 0.21 * Math.sin(2 * om)) / 3600;
  const dEps = (9.2 * Math.cos(om) + 0.57 * Math.cos(2 * L) + 0.1 * Math.cos(2 * Lp) - 0.09 * Math.cos(2 * om)) / 3600;
  return { dPsi, dEps };
};
export const trueObliquity = (ms: number): number => {
  const T = (julianDay(ms) - 2451545) / 36525;
  const eps0 = 23.439291111 - 0.013004167 * T - 1.639e-7 * T * T + 5.036e-7 * T * T * T;
  return eps0 + nutation(ms).dEps;
};

// ΔT = TT - UT (seconds), interpolated from observed values (1900-2025) and extrapolated after
const DT: [number, number][] = [
  [1900, -2.8], [1910, 10.4], [1920, 21.2], [1930, 24.0], [1940, 24.3], [1950, 29.1], [1960, 33.2],
  [1970, 40.2], [1980, 50.5], [1990, 56.9], [2000, 63.8], [2010, 66.1], [2020, 69.4], [2025, 69.2], [2050, 75],
];
export const deltaT = (ms: number): number => {
  const y = 1970 + ms / YEAR_MS;
  if (y <= DT[0][0]) return DT[0][1];
  for (let i = 1; i < DT.length; i++) {
    if (y <= DT[i][0]) {
      const [y0, v0] = DT[i - 1];
      const [y1, v1] = DT[i];
      return v0 + ((v1 - v0) * (y - y0)) / (y1 - y0);
    }
  }
  return DT[DT.length - 1][1];
};

// Sidereal (Lahiri) apparent Moon / Sun at a UT instant
export const birthMoon = (msUt: number): number => {
  const tt = msUt + deltaT(msUt) * 1000;
  return norm(moonLongitude(tt) + nutation(tt).dPsi - lahiriAyanamsa(tt));
};
export const birthSun = (msUt: number): number => {
  const tt = msUt + deltaT(msUt) * 1000;
  return norm(sunLongitude(tt) - lahiriAyanamsa(tt)); // sunLongitude is already apparent
};

// Lagna (ascendant), sidereal degrees
export const lagnaAt = (msUt: number, lat: number, lng: number): number => {
  const jd = julianDay(msUt);
  const T = (jd - 2451545) / 36525;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - (T * T * T) / 38710000;
  const tt = msUt + deltaT(msUt) * 1000;
  const eps = trueObliquity(tt);
  const lst = rad(norm(gmst + nutation(tt).dPsi * Math.cos(rad(eps)) + lng));
  const e = rad(eps);
  const asc = deg(Math.atan2(Math.cos(lst), -(Math.sin(lst) * Math.cos(e) + Math.tan(rad(lat)) * Math.sin(e))));
  return norm(asc - lahiriAyanamsa(tt));
};

// ── Tables (by nakshatra 0..26) ────────────────────────────────────────────
// Gana: 0 Deva, 1 Manushya, 2 Rakshasa
export const GANA = [0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0];
// Yoni (animal) index into YONI names
export const YONI_OF = [0, 1, 2, 3, 3, 4, 5, 2, 5, 6, 6, 7, 8, 9, 8, 9, 10, 10, 4, 11, 12, 11, 13, 0, 13, 7, 1];
export const YONI_EN = ['Horse', 'Elephant', 'Goat', 'Serpent', 'Dog', 'Cat', 'Rat', 'Cow', 'Buffalo', 'Tiger', 'Deer', 'Monkey', 'Mongoose', 'Lion'];
// Nadi: 0 Adi (Vata), 1 Madhya (Pitta), 2 Antya (Kapha)
export const NADI = [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2];
export const GANA_EN = ['Deva', 'Manushya', 'Rakshasa'];
export const NADI_EN = ['Adi (Vata)', 'Madhya (Pitta)', 'Antya (Kapha)'];

// Vimshottari: lords as planet indexes (0 Sun, 1 Moon, 2 Mars, 3 Mercury, 4 Jupiter, 5 Venus,
// 6 Saturn, 7 Rahu, 8 Ketu) in dasha order, with years
export const DASHA_ORDER = [8, 5, 0, 1, 2, 7, 4, 6, 3];
export const DASHA_YEARS: Record<number, number> = { 8: 7, 5: 20, 0: 6, 1: 10, 2: 7, 7: 18, 4: 16, 6: 19, 3: 17 };

export interface DashaPeriod {
  lord: number;
  start: number; // ms
  end: number;
}

// Mahadashas from birth (the first one is the balance), covering at least `years` years
export const mahadashas = (birthMs: number, moonSid: number, years = 120): DashaPeriod[] => {
  const nak = Math.floor(moonSid / NAK) % 27;
  const frac = (moonSid % NAK) / NAK;
  const first = nakshatraLord(nak);
  let i = DASHA_ORDER.indexOf(first);
  const out: DashaPeriod[] = [];
  // The first dasha started before birth: the elapsed part is frac of its length
  let start = birthMs - frac * DASHA_YEARS[first] * YEAR_MS;
  while (start < birthMs + years * YEAR_MS) {
    const lord = DASHA_ORDER[i % 9];
    const end = start + DASHA_YEARS[lord] * YEAR_MS;
    out.push({ lord, start, end });
    start = end;
    i++;
  }
  return out;
};
export const antardashas = (md: DashaPeriod): DashaPeriod[] => {
  const len = md.end - md.start;
  let i = DASHA_ORDER.indexOf(md.lord);
  let start = md.start;
  const out: DashaPeriod[] = [];
  for (let k = 0; k < 9; k++, i++) {
    const lord = DASHA_ORDER[i % 9];
    const end = start + (len * DASHA_YEARS[lord]) / 120;
    out.push({ lord, start, end });
    start = end;
  }
  return out;
};
export const currentDasha = (birthMs: number, moonSid: number, nowMs: number) => {
  const md = mahadashas(birthMs, moonSid).find(p => nowMs >= p.start && nowMs < p.end) || null;
  const ad = md ? antardashas(md).find(p => nowMs >= p.start && nowMs < p.end) || null : null;
  return { md, ad };
};

// ── Numerology ────────────────────────────────────────────────────────────
const reduce = (n: number): number => {
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) n = String(n).split('').reduce((a, c) => a + Number(c), 0);
  return n;
};
const digitRoot = (n: number) => {
  while (n > 9) n = String(n).split('').reduce((a, c) => a + Number(c), 0);
  return n;
};
// Life path (all digits of the date, master numbers kept) and birth number (day of month)
export const lifePathNumber = (y: number, m: number, d: number) => reduce(digitRoot(y) + digitRoot(m) + digitRoot(d));
export const birthNumber = (d: number) => digitRoot(d);
// Name number, Chaldean values (as most Indian numerologists use)
const CHALDEAN: Record<string, number> = {
  a: 1, i: 1, j: 1, q: 1, y: 1, b: 2, k: 2, r: 2, c: 3, g: 3, l: 3, s: 3, d: 4, m: 4, t: 4,
  e: 5, h: 5, n: 5, x: 5, u: 6, v: 6, w: 6, o: 7, z: 7, f: 8, p: 8,
};
export const nameNumber = (name: string): number | null => {
  const sum = (name || '').toLowerCase().split('').reduce((a, c) => a + (CHALDEAN[c] || 0), 0);
  return sum ? digitRoot(sum) : null;
};

// ── Name star (nama nakshatra) from the first syllable of the name ────────────
// Avakahada chakra: four syllables per nakshatra (one per pada), romanized with common spellings.
const NAME_SYLLABLES: string[][] = [
  ['chu', 'che', 'cho', 'la'], ['li', 'lu', 'le', 'lo'], ['a', 'i', 'u', 'e'], ['o', 'va', 'vi', 'vu'],
  ['ve', 'vo', 'ka', 'ki'], ['ku', 'gha', 'ng', 'chha'], ['ke', 'ko', 'ha', 'hi'], ['hu', 'he', 'ho', 'da'],
  ['di', 'du', 'de', 'do'], ['ma', 'mi', 'mu', 'me'], ['mo', 'ta', 'ti', 'tu'], ['te', 'to', 'pa', 'pi'],
  ['pu', 'sha', 'na', 'tha'], ['pe', 'po', 'ra', 'ri'], ['ru', 're', 'ro', 'taa'], ['thi', 'thu', 'the', 'tho'],
  ['naa', 'ni', 'nu', 'ne'], ['no', 'ya', 'yi', 'yu'], ['ye', 'yo', 'bha', 'bhi'], ['bhu', 'dha', 'pha', 'dhaa'],
  ['bhe', 'bho', 'ja', 'ji'], ['ju', 'je', 'jo', 'khe'], ['ga', 'gi', 'gu', 'ge'], ['go', 'sa', 'si', 'su'],
  ['se', 'so', 'daa', 'dii'], ['duu', 'thaa', 'jha', 'gna'], ['dee', 'doo', 'cha', 'chi'],
];
// Extra spellings -> [nakshatra, pada]
const NAME_ALIASES: Record<string, [number, number]> = {
  aa: [2, 0], ee: [2, 1], oo: [2, 2], ai: [2, 3], au: [3, 0], ba: [3, 1], bi: [3, 2], bu: [3, 3], be: [4, 0], bo: [4, 1],
  ca: [4, 2], qa: [4, 2], ga: [22, 0], kha: [21, 3], khi: [21, 0], khu: [21, 1], kho: [21, 3], wa: [3, 1], wi: [3, 2],
  fa: [19, 2], fi: [19, 2], ph: [19, 2], sh: [12, 1], shi: [23, 2], shu: [23, 3], sri: [23, 2], shri: [23, 2],
  sy: [23, 2], ze: [20, 0], za: [20, 2], zi: [20, 3], tr: [10, 1], kr: [4, 2], pr: [11, 2], br: [3, 1], gr: [22, 0], dh: [19, 1],
  sai: [23, 1], sa: [23, 1], ka: [4, 2], ki: [4, 3],
};
export const nameStar = (name?: string | null): { nakshatra: number; pada: number } | null => {
  const n = (name || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!n) return null;
  let best: { len: number; nak: number; pada: number } | null = null;
  const consider = (syl: string, nak: number, pada: number) => {
    if (n.startsWith(syl) && (!best || syl.length > best.len)) best = { len: syl.length, nak, pada };
  };
  NAME_SYLLABLES.forEach((row, nak) => row.forEach((syl, pada) => consider(syl, nak, pada)));
  Object.entries(NAME_ALIASES).forEach(([syl, [nak, pada]]) => consider(syl, nak, pada));
  if (!best) {
    // Fall back to the first letter + 'a'
    const f = n[0] + 'a';
    NAME_SYLLABLES.forEach((row, nak) => row.forEach((syl, pada) => syl === f && !best && (best = { len: 1, nak, pada })));
  }
  const b = best as { len: number; nak: number; pada: number } | null;
  return b ? { nakshatra: b.nak, pada: b.pada } : null;
};

// ── Full chart ─────────────────────────────────────────────────────────────
export interface Jathakam {
  birthMs: number; // UT instant
  timeKnown: boolean;
  place: BirthPlace;
  moon: number; // sidereal degrees
  sun: number;
  lagna: number | null; // only with a time of birth
  lagnaRashi: number | null;
  rashi: number; // janma rashi (Moon sign)
  nakshatra: number;
  pada: number; // 0..3
  tithi: number; // 1..30
  gana: number;
  yoni: number;
  nadi: number;
  mahadasha: DashaPeriod | null;
  antardasha: DashaPeriod | null;
  lifePath: number;
  birthNumber: number;
  nameNumber: number | null;
  uncertain: boolean; // no time and the Moon changed star that day
}

export const computeJathakam = (
  p: { dob?: string | null; timeOfBirth?: string | null; name?: string | null },
  place: BirthPlace = DEFAULT_PLACE,
  nowMs: number = Date.now(),
): Jathakam | null => {
  const dob = parseDob(p.dob);
  if (!dob) return null;
  const t = parseBirthTime(p.timeOfBirth);
  const [h, mi] = t || [12, 0];
  const local = (hh: number, mm: number) => Date.UTC(dob[0], dob[1] - 1, dob[2], hh, mm) - place.tzMinutes * 60000;
  const birthMs = local(h, mi);
  const moon = birthMoon(birthMs);
  const sun = birthSun(birthMs);
  const nak = Math.floor(moon / NAK) % 27;
  let uncertain = false;
  if (!t) uncertain = Math.floor(birthMoon(local(0, 0)) / NAK) !== Math.floor(birthMoon(local(23, 59)) / NAK);
  const lagna = t ? lagnaAt(birthMs, place.lat, place.lng) : null;
  const { md, ad } = currentDasha(birthMs, moon, nowMs);
  return {
    birthMs,
    timeKnown: !!t,
    place,
    moon,
    sun,
    lagna,
    lagnaRashi: lagna === null ? null : Math.floor(lagna / 30) % 12,
    rashi: Math.floor(moon / 30) % 12,
    nakshatra: nak,
    pada: Math.floor((moon % NAK) / (NAK / 4)),
    tithi: Math.floor(norm(moon - sun) / 12) + 1,
    gana: GANA[nak],
    yoni: YONI_OF[nak],
    nadi: NADI[nak],
    mahadasha: md,
    antardasha: ad,
    lifePath: lifePathNumber(dob[0], dob[1], dob[2]),
    birthNumber: birthNumber(dob[2]),
    nameNumber: nameNumber(p.name || ''),
    uncertain,
  };
};
