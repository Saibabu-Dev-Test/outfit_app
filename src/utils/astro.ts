// Offline Vedic astronomy (no network, no SDK): Sun + Moon longitudes from short Meeus series,
// sidereal (Lahiri ayanamsa), tithi, nakshatra, moon sign (rashi), sunrise / sunset, Rahu kalam,
// Abhijit muhurtam and planetary horas. Accuracy is a few hundredths of a degree for the Moon,
// which is plenty for tithi / nakshatra / rashi (a boundary can still be off by a few minutes).
// Place: Hyderabad unless another is given. All civil times are IST (UTC+5:30, no daylight saving).

export const HYDERABAD = { lat: 17.385, lng: 78.4867 };
const IST_MS = 330 * 60 * 1000;
const DAY_MS = 86400000;
const rad = (d: number) => (d * Math.PI) / 180;
const norm = (d: number) => ((d % 360) + 360) % 360;

export const julianDay = (ms: number): number => ms / DAY_MS + 2440587.5;
const msFromJd = (jd: number): number => (jd - 2440587.5) * DAY_MS;

// Apparent geocentric ecliptic longitude of the Sun (tropical), degrees
export const sunLongitude = (ms: number): number => {
  const T = (julianDay(ms) - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = rad(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.000289 * Math.sin(3 * M);
  const omega = rad(125.04 - 1934.136 * T);
  return norm(L0 + C - 0.00569 - 0.00478 * Math.sin(omega));
};

// Geocentric ecliptic longitude of the Moon (tropical), degrees: the largest terms of Meeus ch. 47
const MOON_TERMS: [number, number, number, number, number][] = [
  // D, M, M', F, coefficient (1e-6 degrees)
  [0, 0, 1, 0, 6288774],
  [2, 0, -1, 0, 1274027],
  [2, 0, 0, 0, 658314],
  [0, 0, 2, 0, 213618],
  [0, 1, 0, 0, -185116],
  [0, 0, 0, 2, -114332],
  [2, 0, -2, 0, 58793],
  [2, -1, -1, 0, 57066],
  [2, 0, 1, 0, 53322],
  [2, -1, 0, 0, 45758],
  [0, 1, -1, 0, -40923],
  [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383],
  [2, 0, 0, -2, 15327],
  [0, 0, 1, 2, -12528],
  [0, 0, 1, -2, 10980],
  [4, 0, -1, 0, 10675],
  [0, 0, 3, 0, 10034],
  [4, 0, -2, 0, 8548],
  [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766],
  [1, 0, -1, 0, -5163],
  [1, 1, 0, 0, 4987],
  [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994],
  [4, 0, 0, 0, 3861],
  [2, 0, -3, 0, 3665],
  [0, 1, -2, 0, -2689],
  [2, 0, -1, 2, -2602],
  [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348],
  [2, -2, 0, 0, 2236],
  [0, 1, 2, 0, -2120],
  [0, 2, 0, 0, -2069],
];

export const moonLongitude = (ms: number): number => {
  const T = (julianDay(ms) - 2451545) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T * T;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  let sum = 0;
  for (const [d, m, mp, f, c] of MOON_TERMS) {
    const arg = rad(d * D + m * M + mp * Mp + f * F);
    const e = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    sum += c * e * Math.sin(arg);
  }
  // Venus / Jupiter / flattening corrections (A1, A2)
  const A1 = rad(119.75 + 131.849 * T);
  const A2 = rad(53.09 + 479264.29 * T);
  sum += 3958 * Math.sin(A1) + 1962 * Math.sin(rad(Lp) - rad(F)) + 318 * Math.sin(A2);
  return norm(Lp + sum / 1e6);
};

// Lahiri (Chitrapaksha) ayanamsa: 23°51'11" at J2000, precessing ~50.29" a year
export const lahiriAyanamsa = (ms: number): number => {
  const years = (julianDay(ms) - 2451545) / 365.25;
  return 23.85306 + years * 0.0139694;
};

export const siderealSun = (ms: number) => norm(sunLongitude(ms) - lahiriAyanamsa(ms));
export const siderealMoon = (ms: number) => norm(moonLongitude(ms) - lahiriAyanamsa(ms));

// 1..30: 1-15 Shukla paksha (15 = Purnima), 16-30 Krishna paksha (30 = Amavasya)
export const tithiAt = (ms: number): number => Math.floor(norm(moonLongitude(ms) - sunLongitude(ms)) / 12) + 1;
// 0..26 (Ashwini = 0)
export const nakshatraAt = (ms: number): number => Math.floor(siderealMoon(ms) / (360 / 27)) % 27;
// 0..11 (Mesha = 0): the Moon's sidereal sign
export const moonRashiAt = (ms: number): number => Math.floor(siderealMoon(ms) / 30) % 12;
// 0..3 pada of the nakshatra
export const padaAt = (ms: number): number => Math.floor((siderealMoon(ms) % (360 / 27)) / (360 / 108));

// ── IST calendar helpers ───────────────────────────────────────────────────
export interface IstDay {
  year: number;
  month: number; // 1..12
  day: number;
  weekday: number; // 0 = Sunday
  key: string; // YYYY-MM-DD
}
const pad = (n: number) => String(n).padStart(2, '0');
export const istDay = (d: Date = new Date()): IstDay => {
  const x = new Date(d.getTime() + IST_MS);
  const year = x.getUTCFullYear();
  const month = x.getUTCMonth() + 1;
  const day = x.getUTCDate();
  return { year, month, day, weekday: x.getUTCDay(), key: `${year}-${pad(month)}-${pad(day)}` };
};
// Instant of an IST wall-clock time
export const istInstant = (y: number, m: number, d: number, h = 0, min = 0): number =>
  Date.UTC(y, m - 1, d, h, min) - IST_MS;
// "06:17" in IST
export const istClock = (ms: number): string => {
  const x = new Date(ms + IST_MS);
  return `${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`;
};
// "6:17 AM"
export const istClock12 = (ms: number): string => {
  const x = new Date(ms + IST_MS);
  const h = x.getUTCHours();
  return `${((h + 11) % 12) + 1}:${pad(x.getUTCMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
};
// Whole days from one YYYY-MM-DD to another (b - a)
export const daysBetween = (a: string, b: string): number => {
  const p = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((p(b) - p(a)) / DAY_MS);
};

// Sunrise / sunset (sunrise equation, -0.833° for refraction + the Sun's radius), as instants
export const sunTimes = (y: number, m: number, d: number, place = HYDERABAD): { rise: number; set: number } => {
  const jdNoon = julianDay(Date.UTC(y, m - 1, d, 12));
  const n = Math.round(jdNoon - 2451545); // days since J2000 noon for this date
  const jStar = n - place.lng / 360;
  const M = norm(357.5291 + 0.98560028 * jStar);
  const C = 1.9148 * Math.sin(rad(M)) + 0.02 * Math.sin(rad(2 * M)) + 0.0003 * Math.sin(rad(3 * M));
  const lambda = norm(M + C + 180 + 102.9372);
  const jTransit = 2451545 + jStar + 0.0053 * Math.sin(rad(M)) - 0.0069 * Math.sin(rad(2 * lambda));
  const sinDec = Math.sin(rad(lambda)) * Math.sin(rad(23.4397));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosW = (Math.sin(rad(-0.833)) - Math.sin(rad(place.lat)) * sinDec) / (Math.cos(rad(place.lat)) * cosDec);
  const w = (Math.acos(Math.max(-1, Math.min(1, cosW))) * 180) / Math.PI;
  return { rise: msFromJd(jTransit - w / 360), set: msFromJd(jTransit + w / 360) };
};

// ── Names ─────────────────────────────────────────────────────────────────
export const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha',
  'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];
export const NAKSHATRAS_TE = [
  'అశ్విని', 'భరణి', 'కృత్తిక', 'రోహిణి', 'మృగశిర', 'ఆర్ద్ర', 'పునర్వసు', 'పుష్యమి', 'ఆశ్లేష',
  'మఖ', 'పుబ్బ', 'ఉత్తర', 'హస్త', 'చిత్త', 'స్వాతి', 'విశాఖ', 'అనూరాధ',
  'జ్యేష్ఠ', 'మూల', 'పూర్వాషాఢ', 'ఉత్తరాషాఢ', 'శ్రవణం', 'ధనిష్ఠ', 'శతభిషం',
  'పూర్వాభాద్ర', 'ఉత్తరాభాద్ర', 'రేవతి',
];
export const RASHI_EN = [
  'Mesha (Aries)', 'Vrishabha (Taurus)', 'Mithuna (Gemini)', 'Karka (Cancer)', 'Simha (Leo)', 'Kanya (Virgo)',
  'Tula (Libra)', 'Vrischika (Scorpio)', 'Dhanu (Sagittarius)', 'Makara (Capricorn)', 'Kumbha (Aquarius)',
  'Meena (Pisces)',
];
export const RASHI_TE = ['మేషం', 'వృషభం', 'మిథునం', 'కర్కాటకం', 'సింహం', 'కన్య', 'తుల', 'వృశ్చికం', 'ధనుస్సు', 'మకరం', 'కుంభం', 'మీనం'];
const TITHI_EN = [
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami',
  'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi',
];
const TITHI_TE = [
  'పాడ్యమి', 'విదియ', 'తదియ', 'చవితి', 'పంచమి', 'షష్ఠి', 'సప్తమి', 'అష్టమి', 'నవమి', 'దశమి', 'ఏకాదశి',
  'ద్వాదశి', 'త్రయోదశి', 'చతుర్దశి',
];
export const tithiName = (t: number, lang: 'English' | 'Telugu'): string => {
  const te = lang === 'Telugu';
  if (t === 15) return te ? 'పౌర్ణమి' : 'Purnima (full moon)';
  if (t === 30) return te ? 'అమావాస్య' : 'Amavasya (new moon)';
  const i = (t - 1) % 15;
  const paksha = t <= 15 ? (te ? 'శుక్ల' : 'Shukla') : te ? 'కృష్ణ' : 'Krishna';
  return `${paksha} ${(te ? TITHI_TE : TITHI_EN)[i]}`;
};

// Planets: 0 Sun, 1 Moon, 2 Mars, 3 Mercury, 4 Jupiter, 5 Venus, 6 Saturn (= weekday lords)
export const PLANET_EN = ['Surya (Sun)', 'Chandra (Moon)', 'Kuja (Mars)', 'Budha (Mercury)', 'Guru (Jupiter)', 'Shukra (Venus)', 'Shani (Saturn)', 'Rahu', 'Ketu'];
export const PLANET_TE = ['సూర్యుడు', 'చంద్రుడు', 'కుజుడు', 'బుధుడు', 'గురువు', 'శుక్రుడు', 'శని', 'రాహువు', 'కేతువు'];
// Rashi lords (Mesha..Meena)
export const RASHI_LORD = [2, 5, 3, 1, 0, 3, 5, 2, 4, 6, 6, 4];
// Nakshatra lords (Vimshottari order Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury)
const NAK_LORD_CYCLE = [8, 5, 0, 1, 2, 7, 4, 6, 3];
export const nakshatraLord = (n: number) => NAK_LORD_CYCLE[n % 9];

// Rashi index from a saved profile string ("Mesha (Aries)", "Aries", "మేషం", ...); -1 if unknown
const RASHI_KEYS = [
  ['mesha', 'mesham', 'aries', 'మేష'],
  ['vrishabha', 'vrushabha', 'taurus', 'వృషభ'],
  ['mithuna', 'gemini', 'మిథున'],
  ['karka', 'kataka', 'cancer', 'కర్కాట', 'కర్కా'],
  ['simha', 'leo', 'సింహ'],
  ['kanya', 'virgo', 'కన్య'],
  ['tula', 'thula', 'libra', 'తుల'],
  ['vrischika', 'vrishchika', 'scorpio', 'వృశ్చిక'],
  ['dhanu', 'sagittarius', 'ధను'],
  ['makara', 'capricorn', 'మకర'],
  ['kumbha', 'aquarius', 'కుంభ'],
  ['meena', 'pisces', 'మీన'],
];
export const rashiIndex = (s?: string | null): number => {
  const r = (s || '').toLowerCase();
  if (!r.trim()) return -1;
  return RASHI_KEYS.findIndex(keys => keys.some(k => r.includes(k)));
};

// "07:30 AM" / "19:30" -> [h, m] (24 h); null when missing / invalid
export const parseBirthTime = (s?: string | null): [number, number] | null => {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*([AaPp][Mm])?\s*$/.exec(s || '');
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const p = (m[3] || '').toUpperCase();
  if (p === 'PM' && h < 12) h += 12;
  if (p === 'AM' && h === 12) h = 0;
  return h < 24 && min < 60 ? [h, min] : null;
};
export const parseDob = (s?: string | null): [number, number, number] | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return y > 1900 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? [y, mo, d] : null;
};

export interface BirthChart {
  rashi: number; // moon sign used (saved one wins)
  rashiSource: 'saved' | 'computed';
  nakshatra: number | null; // birth star (only when dob is known and agrees with the rashi)
  pada: number | null;
  timeKnown: boolean; // time of birth used (otherwise noon IST: rashi / star approximate)
  uncertain: boolean; // no time and the Moon changed sign / star that day
}

// Birth moon sign + star from the profile. dob 'YYYY-MM-DD', timeOfBirth "07:30 AM" (IST, Hyderabad).
// Returns null when there is neither a saved rashi nor a valid dob.
export const birthChart = (p: { dob?: string | null; timeOfBirth?: string | null; rashi?: string | null }): BirthChart | null => {
  const saved = rashiIndex(p.rashi);
  const dob = parseDob(p.dob);
  if (!dob) {
    return saved >= 0 ? { rashi: saved, rashiSource: 'saved', nakshatra: null, pada: null, timeKnown: false, uncertain: false } : null;
  }
  const t = parseBirthTime(p.timeOfBirth);
  const at = istInstant(dob[0], dob[1], dob[2], t ? t[0] : 12, t ? t[1] : 0);
  const computed = moonRashiAt(at);
  let nak: number | null = nakshatraAt(at);
  let uncertain = false;
  if (!t) {
    const a = istInstant(dob[0], dob[1], dob[2], 0, 0);
    const b = istInstant(dob[0], dob[1], dob[2], 23, 59);
    uncertain = moonRashiAt(a) !== moonRashiAt(b) || nakshatraAt(a) !== nakshatraAt(b);
  }
  const rashi = saved >= 0 ? saved : computed;
  // The star must lie in the rashi used (a saved rashi can disagree with a noon estimate)
  if (nak !== null && Math.floor((nak * 4 + padaAt(at)) / 9) !== rashi) nak = null;
  return {
    rashi,
    rashiSource: saved >= 0 ? 'saved' : 'computed',
    nakshatra: nak,
    pada: nak !== null ? padaAt(at) : null,
    timeKnown: !!t,
    uncertain,
  };
};

// ── Today's panchang (at sunrise, Hyderabad) ──────────────────────────────
export interface Panchang {
  day: IstDay;
  sunrise: number;
  sunset: number;
  tithi: number; // 1..30 at sunrise
  nakshatra: number; // at sunrise
  moonRashi: number; // at sunrise
  weekdayLord: number; // planet index
  rahu: { start: number; end: number };
  abhijit: { start: number; end: number } | null; // not counted on Wednesdays
  horas: { start: number; end: number; planet: number }[]; // 12 daytime horas
}

// Rahu kalam: 1-based eighth of the daytime, by weekday (Sun..Sat)
const RAHU_PART = [8, 2, 7, 5, 6, 4, 3];
// Chaldean order for horas, as planet indexes: Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon
const CHALDEAN = [6, 4, 2, 0, 5, 3, 1];

export const panchangFor = (d: Date = new Date(), place = HYDERABAD): Panchang => {
  const day = istDay(d);
  const { rise, set } = sunTimes(day.year, day.month, day.day, place);
  const part = (set - rise) / 8;
  const r = RAHU_PART[day.weekday] - 1;
  const mid = (rise + set) / 2;
  const muhurta = (set - rise) / 15;
  const hora = (set - rise) / 12;
  const startIdx = CHALDEAN.indexOf(day.weekday);
  const horas = Array.from({ length: 12 }, (_, i) => ({
    start: rise + i * hora,
    end: rise + (i + 1) * hora,
    planet: CHALDEAN[(startIdx + i) % 7],
  }));
  return {
    day,
    sunrise: rise,
    sunset: set,
    tithi: tithiAt(rise),
    nakshatra: nakshatraAt(rise),
    moonRashi: moonRashiAt(rise),
    weekdayLord: day.weekday,
    rahu: { start: rise + r * part, end: rise + (r + 1) * part },
    abhijit: day.weekday === 3 ? null : { start: mid - muhurta / 2, end: mid + muhurta / 2 },
    horas,
  };
};

// Moon's house from the birth rashi today (1..12) and tara (1..9) from the birth star
export const chandraHouse = (birthRashi: number, todayRashi: number) => ((todayRashi - birthRashi + 12) % 12) + 1;
export const taraOf = (birthStar: number, todayStar: number) => ((todayStar - birthStar + 27) % 27) % 9 + 1;
// Chandrabalam good houses / good taras (traditional)
export const GOOD_HOUSES = new Set([1, 3, 6, 7, 10, 11]);
export const GOOD_TARAS = new Set([2, 4, 6, 8, 9]);

// Stable 32-bit hash (FNV-1a) for "same text all day for this user"
export const hashString = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
};
export const pick = <T,>(arr: T[], seed: number, salt = 0): T => arr[(seed + salt * 2654435761) % arr.length >>> 0] ?? arr[0];
