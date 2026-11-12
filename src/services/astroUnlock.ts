// Astrology "full reading" unlock: a short summary is free; the full reading opens after a rewarded
// ad (config/ads.ts slot astroRewarded: Google test ids in debug, real id in release) and stays open
// for the rest of that LOCAL day only. The unlocked day (YYYY-MM-DD, local) is kept per user in
// AsyncStorage; at local midnight useDayKey() moves to the new day, so the saved day no longer
// matches and the reading locks again by itself. Never throws.
import AsyncStorage from '@react-native-async-storage/async-storage';

// Not under "outfit:" (sign-out clears those): an unlock survives a quick sign-out / sign-in
export const astroUnlockKey = (uid: string) => `outfitastro:fullUnlock:${uid || 'anon'}`;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Pure: is the stored unlock day today's day?
export const isUnlockedFor = (stored: string | null | undefined, dayKey: string): boolean =>
  !!stored && DAY_RE.test(stored) && stored === dayKey;

export const loadAstroUnlock = async (uid: string, dayKey: string): Promise<boolean> => {
  try {
    return isUnlockedFor(await AsyncStorage.getItem(astroUnlockKey(uid)), dayKey);
  } catch {
    return false;
  }
};

export const saveAstroUnlock = async (uid: string, dayKey: string): Promise<void> => {
  if (!DAY_RE.test(dayKey)) return;
  try {
    await AsyncStorage.setItem(astroUnlockKey(uid), dayKey);
  } catch {}
};

// Short free summary: the first sentence (or ~160 chars) of a longer text
export const shortText = (text: string | null | undefined, max = 160): string => {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const m = s.match(/^(.+?[.!?।॥])(\s|$)/);
  const first = m ? m[1] : s;
  if (first.length <= max) return first;
  const cut = first.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trim()}…`;
};
