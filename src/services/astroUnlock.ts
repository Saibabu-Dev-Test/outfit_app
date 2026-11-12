// Astrology "full reading" unlock: a short summary is free; the full reading opens after ONE rewarded
// ad (config/ads.ts slot astroRewarded: Google test ids in debug, real id in release) and stays open
// for the rest of that day in India time (IST, UTC+5:30), whatever the phone's time zone. The unlocked
// IST day (YYYY-MM-DD) is kept per user in AsyncStorage; at IST midnight useIstDayKey() moves to the
// new day, so the saved day no longer matches and the reading locks again by itself. Never throws.
import AsyncStorage from '@react-native-async-storage/async-storage';

// Not under "outfit:" (sign-out clears those): an unlock survives a quick sign-out / sign-in
export const astroUnlockKey = (uid: string) => `outfitastro:fullUnlock:${uid || 'anon'}`;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const IST_OFFSET_MS = 330 * 60 * 1000; // UTC+5:30, no daylight saving

// Today's date in India (IST) as YYYY-MM-DD, independent of the phone's time zone
export const istDateKey = (d: Date = new Date()): string => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

// Milliseconds until the next IST midnight (+1 s so the new IST day has surely started)
export const msUntilNextIstMidnight = (now: Date = new Date()): number => {
  const shifted = now.getTime() + IST_OFFSET_MS;
  const day = 24 * 60 * 60 * 1000;
  const next = Math.floor(shifted / day) * day + day + 1000;
  return Math.max(1000, next - shifted);
};

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
