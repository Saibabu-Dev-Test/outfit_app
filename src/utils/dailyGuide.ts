// Home "daily guide": pure logic (no network, no React) for
//   1. today's rashi lucky colour from Chandra gochara (Moon's sidereal rashi today, counted from the
//      user's janma rashi), so it changes as the Moon moves (about every 2-2.5 days),
//   2. "Good day to buy?" from today's panchang (tithi, nakshatra, Chandrashtama) + Rahu kalam,
//   3. weather alerts, age-group precautions and "Go out today?" with the best time window.
// All astronomy is the app's own offline code (utils/astro.ts: Meeus Moon + Lahiri ayanamsa); the day
// is the Asia/Kolkata calendar day at local sunrise. Traditional guidance only.
import {
  chandraHouse,
  panchangFor,
  Panchang,
  RASHI_LORD,
  HYDERABAD,
} from './astro';

// ── 1. Daily rashi lucky colour ──────────────────────────────────────────────
// Colour of each graha (0 Sun .. 6 Saturn). Names are COLOUR_KEYS in i18n/astroNames.ts.
export const PLANET_COLOUR: { name: string; hex: string }[] = [
  { name: 'Orange', hex: '#F57C00' }, // Surya
  { name: 'White', hex: '#F5F5F5' }, // Chandra
  { name: 'Red', hex: '#D32F2F' }, // Kuja
  { name: 'Green', hex: '#388E3C' }, // Budha
  { name: 'Yellow', hex: '#FBC02D' }, // Guru
  { name: 'Pink', hex: '#F48FB1' }, // Shukra
  { name: 'Blue', hex: '#1565C0' }, // Shani
];
// Chandra gochara: favourable houses from the janma rashi, mixed ones, and weak ones (4, 8, 12)
export const FAVOURABLE_HOUSES = new Set([1, 3, 6, 7, 10, 11]);
export const MIXED_HOUSES = new Set([2, 5, 9]);
export type HouseKind = 'good' | 'mixed' | 'weak' | 'chandrashtama';
export const houseKind = (house: number): HouseKind =>
  house === 8
    ? 'chandrashtama'
    : FAVOURABLE_HOUSES.has(house)
    ? 'good'
    : MIXED_HOUSES.has(house)
    ? 'mixed'
    : 'weak';

export interface DailyRashiColour {
  janmaRashi: number; // 0..11
  moonRashi: number; // 0..11, Moon's sidereal rashi at today's sunrise
  house: number; // 1..12 counted from the janma rashi
  kind: HouseKind;
  planet: number; // graha whose colour is used
  colour: { name: string; hex: string };
}

// Good / mixed houses: colour of the lord of the rashi the Moon is in today. Weak houses (4, 8, 12):
// White (Chandra's own colour), traditionally worn to calm a weak Moon.
export const dailyRashiColour = (
  janmaRashi: number,
  p: Panchang,
): DailyRashiColour | null => {
  if (!(janmaRashi >= 0 && janmaRashi < 12)) return null;
  const house = chandraHouse(janmaRashi, p.moonRashi);
  const kind = houseKind(house);
  const planet =
    kind === 'good' || kind === 'mixed' ? RASHI_LORD[p.moonRashi] : 1;
  return {
    janmaRashi,
    moonRashi: p.moonRashi,
    house,
    kind,
    planet,
    colour: PLANET_COLOUR[planet],
  };
};

// ── 2. Good day to buy? ─────────────────────────────────────────────────────
export type BuyVerdict = 'yes' | 'careful' | 'no';
// Nakshatras traditionally good for purchases (0 = Ashwini)
export const GOOD_BUY_NAKSHATRAS = new Set([
  0, 3, 4, 6, 7, 12, 13, 14, 16, 21, 22, 26,
]);
// Nakshatras traditionally avoided for new purchases (Bharani, Krittika, Ardra, Ashlesha, Magha,
// Purva Phalguni, Vishakha, Jyeshtha, Mula, Purva Ashadha, Purva Bhadrapada)
export const AVOID_BUY_NAKSHATRAS = new Set([
  1, 2, 5, 8, 9, 10, 15, 17, 18, 19, 24,
]);
export const isRiktaTithi = (t: number) =>
  t !== 30 && [4, 9, 14].includes(((t - 1) % 15) + 1);

export type BuyReason =
  | 'chandrashtama'
  | 'amavasya'
  | 'rikta'
  | 'badNakshatra'
  | 'plainNakshatra'
  | 'goodDay';
export interface BuyAdvice {
  verdict: BuyVerdict;
  reasons: BuyReason[]; // most important first; 'goodDay' alone when all is well
  tithi: number;
  nakshatra: number;
  rahu: { start: number; end: number };
}

export const buyAdvice = (p: Panchang, janmaRashi = -1): BuyAdvice => {
  const reasons: BuyReason[] = [];
  let verdict: BuyVerdict = 'yes';
  const worse = (v: BuyVerdict) => {
    if (v === 'no' || (v === 'careful' && verdict === 'yes')) verdict = v;
  };
  if (janmaRashi >= 0 && chandraHouse(janmaRashi, p.moonRashi) === 8) {
    reasons.push('chandrashtama');
    worse('no');
  }
  if (p.tithi === 30) {
    reasons.push('amavasya');
    worse('no');
  } else if (isRiktaTithi(p.tithi)) {
    reasons.push('rikta');
    worse('careful');
  }
  if (AVOID_BUY_NAKSHATRAS.has(p.nakshatra)) {
    reasons.push('badNakshatra');
    worse('careful');
  } else if (!GOOD_BUY_NAKSHATRAS.has(p.nakshatra)) {
    reasons.push('plainNakshatra');
    worse('careful');
  }
  if (!reasons.length) reasons.push('goodDay');
  return {
    verdict,
    reasons,
    tithi: p.tithi,
    nakshatra: p.nakshatra,
    rahu: p.rahu,
  };
};

// Today's panchang at the user's place (device location or Hyderabad)
export const todayPanchang = (
  d: Date = new Date(),
  place: { lat: number; lng: number } = HYDERABAD,
): Panchang => panchangFor(d, place);

// ── 3. Weather, alerts, age tips, go out ────────────────────────────────────
export interface HourWeather {
  hour: number; // 0..23 local
  temp: number | null;
  feels: number | null;
  rain: number | null; // % chance
  uv: number | null;
  wind: number | null; // km/h
  aqi: number | null; // US AQI
  code: number | null;
}
export interface TodayWeather {
  date: string; // YYYY-MM-DD at the place
  utcOffsetSec: number; // 19800 = IST
  nowHour: number | null; // local hour of the reading
  code: number;
  nowTemp: number | null;
  tMax: number | null;
  tMin: number | null;
  feelsMax: number | null;
  rainChance: number | null; // %
  rainMm: number | null; // day total
  windMax: number | null; // km/h
  gustMax: number | null; // km/h
  uvMax: number | null;
  aqi: number | null; // US AQI now
  pm25: number | null;
  hours: HourWeather[];
  fetchedAt: number;
}

const num = (v: any): number | null =>
  v === null || v === undefined || v === '' || !Number.isFinite(Number(v))
    ? null
    : Number(v);
const hourOf = (iso: any): number | null => {
  const m = /T(\d{2}):/.exec(String(iso || ''));
  return m ? Number(m[1]) : null;
};

// Open-Meteo forecast + air-quality JSON -> TodayWeather (null when the forecast is unusable)
export const parseTodayWeather = (
  fc: any,
  air: any,
  fetchedAt = Date.now(),
): TodayWeather | null => {
  const d = fc?.daily;
  if (!d || !Array.isArray(d.time) || !d.time.length) return null;
  const date = String(d.time[0]);
  const h = fc?.hourly || {};
  const aqiByTime = new Map<string, number | null>();
  (air?.hourly?.time || []).forEach((t: string, i: number) =>
    aqiByTime.set(t, num(air.hourly.us_aqi?.[i])),
  );
  const hours: HourWeather[] = [];
  (h.time || []).forEach((t: string, i: number) => {
    if (!String(t).startsWith(date)) return;
    const hr = hourOf(t);
    if (hr === null) return;
    hours.push({
      hour: hr,
      temp: num(h.temperature_2m?.[i]),
      feels: num(h.apparent_temperature?.[i]),
      rain: num(h.precipitation_probability?.[i]),
      uv: num(h.uv_index?.[i]),
      wind: num(h.wind_speed_10m?.[i]),
      aqi: aqiByTime.has(t) ? aqiByTime.get(t)! : null,
      code: num(h.weather_code?.[i]),
    });
  });
  return {
    date,
    utcOffsetSec: num(fc.utc_offset_seconds) ?? 19800,
    nowHour: hourOf(fc?.current?.time),
    code: num(d.weather_code?.[0] ?? d.weathercode?.[0]) ?? -1,
    nowTemp: num(fc?.current?.temperature_2m),
    tMax: num(d.temperature_2m_max?.[0]),
    tMin: num(d.temperature_2m_min?.[0]),
    feelsMax: num(d.apparent_temperature_max?.[0]),
    rainChance: num(d.precipitation_probability_max?.[0]),
    rainMm: num(d.precipitation_sum?.[0]),
    windMax: num(d.wind_speed_10m_max?.[0]),
    gustMax: num(d.wind_gusts_10m_max?.[0]),
    uvMax: num(d.uv_index_max?.[0]),
    aqi: num(air?.current?.us_aqi),
    pm25: num(air?.current?.pm2_5),
    hours,
    fetchedAt,
  };
};

// Severe-weather flags worked out from the forecast numbers (Open-Meteo has no official warnings).
// Thresholds follow IMD terms loosely: heavy rain 64.5 mm/day, very heavy 115.6 mm/day, heatwave 40 °C.
export type AlertKind =
  | 'cyclone'
  | 'veryHeavyRain'
  | 'heavyRain'
  | 'thunderstorm'
  | 'severeHeat'
  | 'heatwave'
  | 'highWind'
  | 'coldWave'
  | 'severeAir'
  | 'poorAir';
export interface WeatherAlert {
  kind: AlertKind;
  severe: boolean;
}

export const weatherAlerts = (w: TodayWeather): WeatherAlert[] => {
  const out: WeatherAlert[] = [];
  const gust = w.gustMax ?? 0;
  const wind = w.windMax ?? 0;
  const rain = w.rainMm ?? 0;
  const hot = Math.max(w.tMax ?? -99, (w.feelsMax ?? -99) - 2);
  const cyclone = gust >= 90 || (gust >= 75 && rain >= 30);
  if (cyclone) out.push({ kind: 'cyclone', severe: true });
  if (rain >= 115.6) out.push({ kind: 'veryHeavyRain', severe: true });
  else if (rain >= 64.5) out.push({ kind: 'heavyRain', severe: false });
  if (w.code >= 95) out.push({ kind: 'thunderstorm', severe: false });
  if (hot >= 45) out.push({ kind: 'severeHeat', severe: true });
  else if (hot >= 40) out.push({ kind: 'heatwave', severe: false });
  if (!cyclone && (gust >= 50 || wind >= 40))
    out.push({ kind: 'highWind', severe: false });
  if (w.tMin !== null && w.tMin <= 10)
    out.push({ kind: 'coldWave', severe: w.tMin <= 4 });
  if ((w.aqi ?? 0) >= 201) out.push({ kind: 'severeAir', severe: true });
  else if ((w.aqi ?? 0) >= 151) out.push({ kind: 'poorAir', severe: false });
  return out;
};

// Everyday conditions the age tips react to
export type Condition = 'heat' | 'rain' | 'cold' | 'pollution' | 'wind';
export const weatherConditions = (w: TodayWeather): Condition[] => {
  const c: Condition[] = [];
  if ((w.tMax ?? 0) >= 35 || (w.feelsMax ?? 0) >= 37 || (w.uvMax ?? 0) >= 8)
    c.push('heat');
  if (
    (w.rainChance ?? 0) >= 50 ||
    (w.rainMm ?? 0) >= 5 ||
    (w.code >= 51 && w.code <= 67) ||
    (w.code >= 80 && w.code <= 82) ||
    w.code >= 95
  )
    c.push('rain');
  if (w.tMin !== null && w.tMin <= 15) c.push('cold');
  if ((w.aqi ?? 0) >= 101) c.push('pollution');
  if ((w.gustMax ?? 0) >= 40 || (w.windMax ?? 0) >= 30) c.push('wind');
  return c;
};

export type AgeGroup = 'child' | 'teen' | 'adult' | 'senior';
export const ageGroup = (age: number | null | undefined): AgeGroup =>
  age === null || age === undefined
    ? 'adult'
    : age < 12
    ? 'child'
    : age < 18
    ? 'teen'
    : age >= 60
    ? 'senior'
    : 'adult';

export type GoOutVerdict = 'yes' | 'careful' | 'avoid';
export interface GoOutAdvice {
  verdict: GoOutVerdict;
  because: (AlertKind | Condition)[]; // what drove the verdict (empty when all is fine)
  window: { from: number; to: number } | null; // best local hours, e.g. 7..9 (to is exclusive)
  rahuOverlap: boolean; // best window overlaps today's Rahu kalam (IST only)
}

// Lower is better: heat, cold, rain chance, UV, AQI and wind
const hourPenalty = (h: HourWeather): number => {
  const f = h.feels ?? h.temp ?? 28;
  return (
    Math.max(0, f - 32) * 3 +
    Math.max(0, 18 - f) * 2 +
    ((h.rain ?? 0) / 10) * 2 +
    Math.max(0, (h.uv ?? 0) - 5) * 2 +
    Math.max(0, (h.aqi ?? 0) - 100) / 25 +
    Math.max(0, (h.wind ?? 0) - 30) / 5 +
    ((h.code ?? 0) >= 95 ? 10 : 0)
  );
};

// Best 2-hour window between 6 AM and 9 PM that has not passed yet (local hours)
export const bestOutingWindow = (
  w: TodayWeather,
  nowHour: number | null = w.nowHour,
): { from: number; to: number } | null => {
  const byHour = new Map(w.hours.map(h => [h.hour, h]));
  let best: { from: number; score: number } | null = null;
  const first = Math.max(6, nowHour === null ? 6 : nowHour + 1);
  for (let s = first; s <= 19; s++) {
    const a = byHour.get(s);
    const b = byHour.get(s + 1);
    if (!a || !b) continue;
    const score = hourPenalty(a) + hourPenalty(b);
    if (!best || score < best.score - 0.01) best = { from: s, score };
  }
  return best ? { from: best.from, to: best.from + 2 } : null;
};

export const goOutAdvice = (
  w: TodayWeather,
  group: AgeGroup,
  rahu?: { start: number; end: number } | null,
  nowHour: number | null = w.nowHour,
): GoOutAdvice => {
  const alerts = weatherAlerts(w);
  const conds = weatherConditions(w);
  const vulnerable = group === 'child' || group === 'senior';
  let verdict: GoOutVerdict = 'yes';
  let because: (AlertKind | Condition)[] = [];
  const severe = alerts.filter(a => a.severe).map(a => a.kind);
  const warn = alerts.filter(a => !a.severe).map(a => a.kind);
  if (severe.length) {
    verdict = 'avoid';
    because = severe;
  } else if (vulnerable && warn.length) {
    verdict = 'avoid';
    because = warn;
  } else if (warn.length) {
    verdict = 'careful';
    because = warn;
  } else {
    const relevant = conds.filter(
      c =>
        vulnerable ||
        c === 'heat' ||
        c === 'rain' ||
        ((w.aqi ?? 0) >= 151 && c === 'pollution'),
    );
    if (relevant.length) {
      verdict = 'careful';
      because = relevant;
    }
  }
  const window =
    verdict === 'avoid' && severe.length ? null : bestOutingWindow(w, nowHour);
  let rahuOverlap = false;
  if (window && rahu && w.utcOffsetSec === 19800) {
    const ist = (ms: number) =>
      new Date(ms + 19800000).getUTCHours() +
      new Date(ms + 19800000).getUTCMinutes() / 60;
    const rs = ist(rahu.start);
    const re = ist(rahu.end);
    rahuOverlap = window.from < re && window.to > rs;
  }
  return { verdict, because, window, rahuOverlap };
};

// Up to 3 tips for the age group from today's conditions ('fine' when nothing stands out)
export const ageTipKeys = (w: TodayWeather): (Condition | 'fine')[] => {
  const c = weatherConditions(w);
  const order: Condition[] = ['heat', 'rain', 'pollution', 'cold', 'wind'];
  const picked = order.filter(k => c.includes(k)).slice(0, 3);
  return picked.length ? picked : ['fine'];
};
