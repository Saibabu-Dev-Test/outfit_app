// Honest daily verdict (traditional Vedic muhurta logic, offline): Chandrabalam, Tarabalam,
// Saturn's transit from the janma rashi (Sade Sati / Ashtama / Ardhashtama Shani), the current
// Mahadasha / Antardasha lord's natural friendship with the weekday lord, and the day's
// inauspicious periods (Rahu kalam, Yamagandam, Durmuhurtam). Pure functions; the wording
// lives in i18n/astroLabels.ts (VERDICT_TEXT) and is assembled in services/astrologyDaily.ts.
import { julianDay, lahiriAyanamsa } from './astro';

export type DayRating = 'good' | 'mixed' | 'caution';
export type Area = 'health' | 'money' | 'work' | 'travel' | 'relationships';
export const AREAS: Area[] = ['health', 'money', 'work', 'travel', 'relationships'];

// ── Chandrabalam: transit Moon's house from the janma rashi ─────────────────
export type HouseKind = 'good' | 'mixed' | 'bad';
export const houseKind = (house: number): HouseKind =>
  [1, 3, 6, 7, 10, 11].includes(house) ? 'good' : [4, 8, 12].includes(house) ? 'bad' : 'mixed';

// ── Tarabalam: 1 Janma, 2 Sampat, 3 Vipat, 4 Kshema, 5 Pratyak, 6 Sadhana, 7 Naidhana,
// 8 Mitra, 9 Parama Mitra ─────────────────────────────────────────────────────
export const TARA_EN = ['Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyak', 'Sadhana', 'Naidhana', 'Mitra', 'Parama Mitra'];
export type TaraKind = 'good' | 'neutral' | 'bad';
export const taraKind = (tara: number): TaraKind => ([3, 5, 7].includes(tara) ? 'bad' : tara === 1 ? 'neutral' : 'good');

// ── Saturn: sidereal (Lahiri) geocentric longitude from Keplerian elements ──
// JPL approximate elements (Standish, valid 1800-2050), ~1° accuracy: enough for the sign.
const rad = (d: number) => (d * Math.PI) / 180;
const norm = (d: number) => ((d % 360) + 360) % 360;
type El = [number, number, number, number, number, number, number, number, number, number, number, number];
// a, a', e, e', I, I', L, L', varpi, varpi', Omega, Omega' (per Julian century from J2000)
const EARTH: El = [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0];
const SATURN: El = [9.53667594, -0.0012506, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794];
const helio = (el: El, T: number): [number, number, number] => {
  const a = el[0] + el[1] * T;
  const e = el[2] + el[3] * T;
  const I = rad(el[4] + el[5] * T);
  const L = el[6] + el[7] * T;
  const varpi = el[8] + el[9] * T;
  const Om = el[10] + el[11] * T;
  const M = rad(norm(L - varpi));
  let E = M;
  for (let k = 0; k < 8; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const w = rad(varpi - Om);
  const o = rad(Om);
  const cw = Math.cos(w), sw = Math.sin(w), co = Math.cos(o), so = Math.sin(o), ci = Math.cos(I), si = Math.sin(I);
  return [
    (cw * co - sw * so * ci) * xp + (-sw * co - cw * so * ci) * yp,
    (cw * so + sw * co * ci) * xp + (-sw * so + cw * co * ci) * yp,
    sw * si * xp + cw * si * yp,
  ];
};
export const saturnSidereal = (ms: number): number => {
  const T = (julianDay(ms) - 2451545) / 36525;
  const s = helio(SATURN, T);
  const e = helio(EARTH, T);
  const lonJ2000 = (Math.atan2(s[1] - e[1], s[0] - e[0]) * 180) / Math.PI;
  const precession = 1.3969713 * T; // J2000 ecliptic -> ecliptic of date
  return norm(lonJ2000 + precession - lahiriAyanamsa(ms));
};
export const saturnRashiAt = (ms: number) => Math.floor(saturnSidereal(ms) / 30) % 12;

// Saturn's house from the janma rashi: 12 / 1 / 2 Sade Sati (rising / peak / setting),
// 8 Ashtama Shani, 4 Ardhashtama (Kantaka) Shani
export type ShaniPhase = 'sadeSatiRising' | 'sadeSatiPeak' | 'sadeSatiSetting' | 'ashtama' | 'ardhashtama' | null;
export const shaniPhase = (janmaRashi: number, saturnRashi: number): ShaniPhase => {
  const h = ((saturnRashi - janmaRashi + 12) % 12) + 1;
  return h === 12 ? 'sadeSatiRising' : h === 1 ? 'sadeSatiPeak' : h === 2 ? 'sadeSatiSetting' : h === 8 ? 'ashtama' : h === 4 ? 'ardhashtama' : null;
};

// ── Natural friendship (Naisargika maitri, Parashara). Planets 0 Sun .. 8 Ketu ──
const FRIENDS: number[][] = [[1, 2, 4], [0, 3], [0, 1, 4], [0, 5], [0, 1, 2], [3, 6], [3, 5], [3, 5, 6], [2, 5, 6]];
const ENEMIES: number[][] = [[5, 6], [], [3], [1], [3, 5], [0, 1], [0, 1, 2], [0, 1, 2], [0, 1]];
export type Relation = 'friend' | 'neutral' | 'enemy';
export const relationOf = (planet: number, other: number): Relation =>
  planet === other || FRIENDS[planet].includes(other) ? 'friend' : ENEMIES[planet].includes(other) ? 'enemy' : 'neutral';

// ── Inauspicious periods (daytime eighths / fifteenths, by weekday Sun..Sat) ──
const YAMA_PART = [5, 4, 3, 2, 1, 7, 6];
const DUR_MUHURTA = [[14], [9, 12], [4], [8], [6, 12], [4, 9], [1, 2]];
export const yamagandam = (weekday: number, rise: number, set: number) => {
  const part = (set - rise) / 8;
  const i = YAMA_PART[weekday] - 1;
  return { start: rise + i * part, end: rise + (i + 1) * part };
};
export const durmuhurtam = (weekday: number, rise: number, set: number) => {
  const m = (set - rise) / 15;
  return DUR_MUHURTA[weekday].map(n => ({ start: rise + (n - 1) * m, end: rise + n * m }));
};

// ── The assessment ──────────────────────────────────────────────────────────
export interface DayInput {
  janmaRashi: number;
  janmaStar: number | null;
  moonRashi: number; // today's Moon sign
  todayStar: number;
  weekdayLord: number; // 0..6
  saturnRashi: number;
  mahadashaLord?: number | null;
  antardashaLord?: number | null;
}
export type FactorKey =
  | 'chandraGood' | 'chandraMixed' | 'chandraBad' | 'ashtamaChandra'
  | 'taraGood' | 'taraJanma' | 'taraBad'
  | 'sadeSati' | 'ashtamaShani' | 'ardhashtamaShani'
  | 'dashaFriend' | 'dashaEnemy' | 'antarFriend' | 'antarEnemy';
export interface DayAssessment {
  rating: DayRating;
  score: number;
  house: number;
  houseKind: HouseKind;
  tara: number | null; // 1..9
  taraKind: TaraKind | null;
  shani: ShaniPhase;
  dasha: Relation | null;
  antar: Relation | null;
  plus: FactorKey[]; // favourable factors, strongest first
  minus: FactorKey[]; // unfavourable factors, strongest first
}

export const assessDay = (d: DayInput): DayAssessment => {
  const house = ((d.moonRashi - d.janmaRashi + 12) % 12) + 1;
  const hk = houseKind(house);
  const tara = d.janmaStar === null ? null : (((d.todayStar - d.janmaStar + 27) % 27) % 9) + 1;
  const tk = tara === null ? null : taraKind(tara);
  const shani = shaniPhase(d.janmaRashi, d.saturnRashi);
  const dasha = d.mahadashaLord == null ? null : relationOf(d.mahadashaLord, d.weekdayLord);
  const antar = d.antardashaLord == null ? null : relationOf(d.antardashaLord, d.weekdayLord);
  const plus: FactorKey[] = [];
  const minus: FactorKey[] = [];
  let score = 0;
  if (house === 8) {
    score -= 4;
    minus.push('ashtamaChandra');
  } else if (hk === 'bad') {
    score -= 2;
    minus.push('chandraBad');
  } else if (hk === 'good') {
    score += 2;
    plus.push('chandraGood');
  } else minus.push('chandraMixed');
  if (tk === 'good') {
    score += 1;
    plus.push('taraGood');
  } else if (tk === 'bad') {
    score -= tara === 7 ? 3 : 2;
    minus.push('taraBad');
  } else if (tk === 'neutral') minus.push('taraJanma');
  if (shani === 'ashtama') {
    score -= 1;
    minus.push('ashtamaShani');
  } else if (shani && shani.startsWith('sadeSati')) {
    score -= 1;
    minus.push('sadeSati');
  } else if (shani === 'ardhashtama') {
    score -= 1;
    minus.push('ardhashtamaShani');
  }
  if (dasha === 'friend') {
    score += 1;
    plus.push('dashaFriend');
  } else if (dasha === 'enemy') {
    score -= 1;
    minus.push('dashaEnemy');
  }
  if (antar === 'friend') plus.push('antarFriend');
  else if (antar === 'enemy') minus.push('antarEnemy');
  // Both balams strong is the classic "good day"; Ashtama Chandra or both weak is a caution day
  const rating: DayRating =
    house === 8 || (hk === 'bad' && tk === 'bad') || score <= -3
      ? 'caution'
      : hk === 'good' && (tk === 'good' || (tk === null && score >= 2))
        ? 'good'
        : 'mixed';
  return { rating, score, house, houseKind: hk, tara, taraKind: tk, shani, dasha, antar, plus, minus };
};

// Remedy planet: the affliction to pacify (Moon for weak Chandrabalam, Saturn for its transit,
// the dasha lord when hostile), else the weekday lord to strengthen the day
export const remedyPlanet = (a: DayAssessment, weekdayLord: number, mahadashaLord?: number | null): number => {
  if (a.minus.includes('ashtamaChandra') || a.minus.includes('chandraBad')) return 1;
  if (a.minus.includes('ashtamaShani') || a.minus.includes('sadeSati') || a.minus.includes('ardhashtamaShani')) return 6;
  if (a.minus.includes('dashaEnemy') && mahadashaLord != null) return mahadashaLord;
  return weekdayLord;
};
// Colour to avoid today: the colour of the weekday lord's natural enemy (Sun..Saturn)
export const AVOID_COLOUR = ['Black / Navy', 'Black / Grey', 'Green', 'White / Silver', 'Green', 'Orange', 'Red'];
