// Instant civic tabs: the last Worker answer per place + language is kept on the phone (AsyncStorage)
// and shown the moment a place opens (stale-while-revalidate: the Worker read runs right after and
// replaces it). At most MAX_ENTRIES places are kept; the oldest are dropped. Pure helpers tested in
// __tests__/civicFast.test.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CIVIC_CACHE_PREFIX = 'outfit.civicCache.v1:';
export const CIVIC_CACHE_INDEX = 'outfit.civicCache.v1.index';
export const MAX_ENTRIES = 60;

export interface CivicCacheEntry<T> {
  savedAt: number;
  res: T;
}

// 'govt|TG|hyderabad||te' (language '' = English only)
export const civicCacheKey = (kind: string, state: string, district: string, variant: string, lang?: string | null): string =>
  `${CIVIC_CACHE_PREFIX}${kind}|${state}|${(district || '').trim().toLowerCase()}|${variant || ''}|${lang || ''}`;

// Newest first, the key moved to the front, trimmed to max (pure)
export const touchIndex = (index: string[], key: string, max = MAX_ENTRIES): { index: string[]; dropped: string[] } => {
  const next = [key, ...index.filter(k => k !== key)];
  return { index: next.slice(0, max), dropped: next.slice(max) };
};

export async function readCivicCache<T>(key: string): Promise<CivicCacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v.savedAt === 'number' && v.res ? (v as CivicCacheEntry<T>) : null;
  } catch {
    return null;
  }
}

export async function writeCivicCache<T>(key: string, res: T, now = Date.now()): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ savedAt: now, res }));
    let index: string[] = [];
    try {
      const raw = await AsyncStorage.getItem(CIVIC_CACHE_INDEX);
      const v = raw ? JSON.parse(raw) : [];
      index = Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
    } catch {
      index = [];
    }
    const { index: next, dropped } = touchIndex(index, key);
    await AsyncStorage.setItem(CIVIC_CACHE_INDEX, JSON.stringify(next));
    if (dropped.length) await AsyncStorage.multiRemove(dropped);
  } catch {
    // phone storage full / unavailable: the screen still works from the Worker
  }
}
