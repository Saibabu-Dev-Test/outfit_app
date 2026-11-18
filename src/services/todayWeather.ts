// Home "Weather & climate" card data: Open-Meteo forecast + air-quality APIs (free, no API key).
// One fetch per place every 3 hours (AsyncStorage cache per ~1 km cell). Offline or on any error the
// last saved reading is returned with stale = true; null only when nothing was ever saved. Never throws.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseTodayWeather, TodayWeather } from '../utils/dailyGuide';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
export const TODAY_WEATHER_CACHE_MS = 3 * 60 * 60 * 1000;
const TIMEOUT_MS = 10000;
const KEY_PREFIX = 'outfitwx:today:';

const fetchJson = async (url: string): Promise<any> => {
  const ctrl =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
};

export const forecastUrl = (lat: number, lon: number): string =>
  `${FORECAST_URL}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
  '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' +
  '&hourly=temperature_2m,apparent_temperature,precipitation_probability,uv_index,wind_speed_10m,weather_code' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,' +
  'precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max' +
  '&timezone=auto&forecast_days=1';

export const airUrl = (lat: number, lon: number): string =>
  `${AIR_URL}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(
    3,
  )}&current=us_aqi,pm2_5,pm10&hourly=us_aqi&timezone=auto&forecast_days=1`;

export interface TodayWeatherResult {
  weather: TodayWeather;
  stale: boolean; // true = an older saved reading (offline / fetch failed)
}

const cacheKey = (lat: number, lon: number) =>
  `${KEY_PREFIX}${lat.toFixed(2)},${lon.toFixed(2)}`;

export const getTodayWeather = async (
  lat: number,
  lon: number,
  force = false,
): Promise<TodayWeatherResult | null> => {
  const key = cacheKey(lat, lon);
  let cached: TodayWeather | null = null;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) cached = JSON.parse(raw);
  } catch {}
  if (
    !force &&
    cached &&
    Date.now() - Number(cached.fetchedAt) < TODAY_WEATHER_CACHE_MS
  ) {
    return { weather: cached, stale: false };
  }
  try {
    const [fc, air] = await Promise.all([
      fetchJson(forecastUrl(lat, lon)),
      fetchJson(airUrl(lat, lon)).catch(() => null),
    ]);
    const w = parseTodayWeather(fc, air);
    if (w) {
      AsyncStorage.setItem(key, JSON.stringify(w)).catch(() => undefined);
      return { weather: w, stale: false };
    }
  } catch (e: any) {
    console.warn('today weather failed:', e?.message);
  }
  return cached ? { weather: cached, stale: true } : null;
};
