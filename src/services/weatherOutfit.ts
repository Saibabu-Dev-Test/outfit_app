// Weather + occasion aware outfit suggestion. Weather: Open-Meteo (free, no key, no account).
// Place: the profile district / city (bundled city list, else Open-Meteo geocoding), else the
// phone's approximate location ONLY when location permission was already granted (never asks).
import type { WardrobeItemResponse } from './wardrobeApi';
import { pickLuckyPairs, LuckyPair } from './luckyPairs';
import { findCity } from '../constants/indianCities';
import { getApproxLocation, hasLocationPermission } from '../native/location';

export interface Weather {
  place: string;
  tempNow: number;
  tempMax: number;
  tempMin: number;
  rainChance: number; // %
  code: number; // WMO weather code
  summary: string;
}

const WMO: [number[], string][] = [
  [[0], 'Clear sky ☀️'],
  [[1, 2], 'Partly cloudy ⛅'],
  [[3], 'Cloudy ☁️'],
  [[45, 48], 'Fog 🌫️'],
  [[51, 53, 55, 56, 57], 'Drizzle 🌦️'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'Rain 🌧️'],
  [[71, 73, 75, 77, 85, 86], 'Snow ❄️'],
  [[95, 96, 99], 'Thunderstorm ⛈️'],
];
export const weatherText = (code: number) => WMO.find(([cs]) => cs.includes(code))?.[1] || 'Weather';

const getJson = async (url: string) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
};

const geocode = async (name: string): Promise<{ lat: number; lng: number; label: string } | null> => {
  const c = findCity(name);
  if (c) return { lat: c.lat, lng: c.lng, label: c.name };
  try {
    const j = await getJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name.split(',')[0].trim())}&count=1&country=IN&language=en&format=json`,
    );
    const r = j?.results?.[0];
    return r ? { lat: r.latitude, lng: r.longitude, label: r.name } : null;
  } catch {
    return null;
  }
};

export const getTodayWeather = async (profilePlace?: string | null): Promise<Weather> => {
  let loc = profilePlace ? await geocode(profilePlace) : null;
  if (!loc && (await hasLocationPermission().catch(() => false))) {
    const r = await getApproxLocation();
    if (r.ok) loc = { lat: r.coords.lat, lng: r.coords.lng, label: 'your area' };
  }
  if (!loc) throw new Error('Set your district in the profile (Circles > Discover or Edit profile) to see the weather.');
  const j = await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}` +
      '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&timezone=auto&forecast_days=1',
  );
  const code = Number(j?.current?.weather_code ?? 0);
  return {
    place: loc.label,
    tempNow: Math.round(Number(j?.current?.temperature_2m ?? 0)),
    tempMax: Math.round(Number(j?.daily?.temperature_2m_max?.[0] ?? 0)),
    tempMin: Math.round(Number(j?.daily?.temperature_2m_min?.[0] ?? 0)),
    rainChance: Math.round(Number(j?.daily?.precipitation_probability_max?.[0] ?? 0)),
    code,
    summary: weatherText(code),
  };
};

const text = (i: WardrobeItemResponse) =>
  `${i.name || ''} ${i.category || ''} ${i.subType || ''} ${i.fabric || ''} ${i.color || ''}`.toLowerCase();
const WARM = /jacket|hoodie|sweat|sweater|coat|thermal|cardigan|fleece|shawl|blazer|wool/;
const LIGHTWEIGHT = /linen|cotton|t-?shirt|tee|short|kurta|kurti|polo|top\b/;
const HEAVY = /jacket|hoodie|sweat|sweater|coat|wool|velvet|leather|blazer|sherwani/;
const LIGHT_COLOUR = /white|cream|beige|ivory|light|pastel/;
const RAIN_BAD = /suede|white|silk|velvet/;

// Pure: how well one item suits the weather (roughly -3..+3)
export const weatherFit = (i: WardrobeItemResponse, w: Pick<Weather, 'tempMax' | 'tempMin' | 'rainChance'>): number => {
  const t = text(i);
  let s = 0;
  if (w.tempMin <= 16) s += WARM.test(t) ? 2 : 0;
  if (w.tempMax >= 32) {
    if (LIGHTWEIGHT.test(t)) s += 1.5;
    if (HEAVY.test(t)) s -= 2;
    if (LIGHT_COLOUR.test(t)) s += 0.5;
  }
  if (w.rainChance >= 50 && RAIN_BAD.test(t)) s -= 1.5;
  return s;
};

export const weatherTips = (w: Weather): string[] => {
  const tips: string[] = [];
  if (w.tempMax >= 35) tips.push('Very hot: breathable cotton / linen, light colours, sunglasses and water.');
  else if (w.tempMax >= 30) tips.push('Warm day: light cotton fabrics and loose fits.');
  if (w.tempMin <= 16) tips.push('Cool morning / evening: carry a jacket, shawl or hoodie.');
  if (w.rainChance >= 50) tips.push(`Rain likely (${w.rainChance}%): skip white and suede, wear quick-dry fabrics and closed footwear.`);
  if (!tips.length) tips.push('Pleasant weather: wear what you love today.');
  return tips;
};

export const suggestForWeather = (items: WardrobeItemResponse[], w: Weather, occasion: string): LuckyPair[] => {
  const base = pickLuckyPairs(items, 'English', { occasion, max: 12 }).pairs;
  return base
    .map(p => ({ p, s: p.score + weatherFit(p.top, w) + weatherFit(p.bottom, w) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map(x => x.p);
};
