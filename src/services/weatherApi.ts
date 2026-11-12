// Weather for planned functions: Open-Meteo (free, no API key). City -> coordinates (geocoding),
// then a 16-day daily forecast. Cached in AsyncStorage for 3 hours per place. Never throws:
// anything that fails returns null and the card simply shows no weather.
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

export interface DayWeather {
  date: string; // YYYY-MM-DD (the place's local date)
  code: number; // WMO weather code
  tMax: number;
  tMin: number;
  rainChance: number | null; // %
}

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const FORECAST_DAYS = 16;
const CACHE_MS = 3 * 60 * 60 * 1000;
const TIMEOUT_MS = 8000;

const fetchJson = async (url: string): Promise<any> => {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
};

// WMO code -> emoji + short text
export const weatherText = (code: number): { emoji: string; label: string } => {
  if (code === 0) return { emoji: '☀️', label: 'Clear sky' };
  if (code <= 2) return { emoji: '🌤️', label: 'Partly cloudy' };
  if (code === 3) return { emoji: '☁️', label: 'Cloudy' };
  if (code === 45 || code === 48) return { emoji: '🌫️', label: 'Fog' };
  if (code >= 51 && code <= 57) return { emoji: '🌦️', label: 'Drizzle' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { emoji: '🌧️', label: 'Rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { emoji: '❄️', label: 'Snow' };
  if (code >= 95) return { emoji: '⛈️', label: 'Thunderstorm' };
  return { emoji: '🌡️', label: 'Weather' };
};

// What the weather means for the outfit
export const weatherTip = (w: DayWeather): string => {
  const rainy = (w.rainChance ?? 0) >= 50 || (w.code >= 51 && w.code <= 67) || (w.code >= 80 && w.code <= 99);
  if (rainy) return 'Rain likely: skip long trailing hems and suede; carry an umbrella and a quick-dry dupatta.';
  if (w.tMax >= 34) return 'Hot day: light cotton, linen or georgette in light colours; avoid heavy silk and velvet.';
  if (w.tMin <= 14) return 'Cool evening: add a shawl, jacket or full sleeves; silk and velvet work well.';
  return 'Pleasant weather: any fabric works, silk and festive wear are comfortable.';
};

// Parses an Open-Meteo daily response
export const parseForecast = (j: any): DayWeather[] => {
  const d = j?.daily;
  if (!d || !Array.isArray(d.time)) return [];
  return d.time.map((date: string, i: number) => ({
    date,
    code: Number(d.weathercode?.[i] ?? d.weather_code?.[i] ?? -1),
    tMax: Math.round(Number(d.temperature_2m_max?.[i])),
    tMin: Math.round(Number(d.temperature_2m_min?.[i])),
    rainChance: d.precipitation_probability_max?.[i] == null ? null : Number(d.precipitation_probability_max[i]),
  }));
};

export const geocodeCity = async (city: string): Promise<Place | null> => {
  const name = city.trim();
  if (!name) return null;
  const key = `outfitwx:geo:${name.toLowerCase()}`;
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch {}
  try {
    const j = await fetchJson(`${GEO_URL}?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
    const r = j?.results?.[0];
    if (!r || !Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) return null;
    const place: Place = { name: [r.name, r.admin1].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude };
    AsyncStorage.setItem(key, JSON.stringify(place)).catch(() => undefined);
    return place;
  } catch (e: any) {
    console.warn('geocode failed:', e?.message);
    return null;
  }
};

export const getForecast = async (place: Place): Promise<DayWeather[] | null> => {
  const key = `outfitwx:fc:${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) {
      const c = JSON.parse(cached);
      if (Date.now() - Number(c?.at) < CACHE_MS && Array.isArray(c?.days)) return c.days;
    }
  } catch {}
  try {
    const j = await fetchJson(
      `${FORECAST_URL}?latitude=${place.lat}&longitude=${place.lon}` +
        '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
        `&timezone=auto&forecast_days=${FORECAST_DAYS}`,
    );
    const days = parseForecast(j);
    if (days.length) AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), days })).catch(() => undefined);
    return days;
  } catch (e: any) {
    console.warn('forecast failed:', e?.message);
    return null;
  }
};

// The forecast for one date in a city, or null (too far ahead, unknown city, offline)
export const weatherFor = async (city: string, date: string): Promise<DayWeather | null> => {
  const place = await geocodeCity(city);
  if (!place) return null;
  const days = await getForecast(place);
  return days?.find(d => d.date === date) || null;
};
