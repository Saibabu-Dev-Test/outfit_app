// Like notifications with coins: "❤️ 12 people liked your photos · Gold coins 🪙". Tapping the
// notification opens the app and those coins flip across the screen (CoinRain in
// CoinFlipProvider) with the coin flip sound. Pure helpers here (tested); the watcher posts it.
import { isLikeLevel, LikeLevel, likeLevelLabel } from '../config/likeLevels';

export interface CoinRainEvent {
  level: LikeLevel;
  count: number; // people who liked (coins to flip, capped on screen)
}

export const MAX_RAIN_COINS = 15;

// Distinct people among new like activity (the same person liking 3 photos counts once)
export const countLikers = (items: { type: string; actorId: string }[]): { likes: number; people: number } => {
  const likes = items.filter(a => a.type === 'like');
  const people = new Set(likes.map((a, i) => a.actorId || `anon_${i}`));
  return { likes: likes.length, people: people.size };
};

export const likeNotificationText = (people: number, likes: number, level: LikeLevel): { title: string; body: string } => {
  const lbl = likeLevelLabel(level);
  const who = people === 1 ? '1 person' : `${people.toLocaleString()} people`;
  const what = likes > people ? `${likes.toLocaleString()} likes` : likes === 1 ? 'your photo' : 'your photos';
  return {
    title: `🪙 ${lbl} coin likes!`,
    body: likes > people ? `${who} gave you ${what} at ${lbl} coin level. Tap to flip your coins ✨` : `${who} liked ${what} at ${lbl} coin level. Tap to flip your coins ✨`,
  };
};

export const encodeCoinRain = (e: CoinRainEvent): string =>
  JSON.stringify({ t: 'coinRain', level: e.level, count: Math.max(1, Math.floor(e.count) || 1) });

// null for anything that isn't a valid coin-rain payload
export const decodeCoinRain = (raw: string | null | undefined): CoinRainEvent | null => {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (!p || p.t !== 'coinRain' || !isLikeLevel(p.level)) return null;
    const count = Math.floor(Number(p.count));
    if (!Number.isFinite(count) || count < 1) return null;
    return { level: p.level, count };
  } catch {
    return null;
  }
};

// Coins actually drawn: one per person, at most MAX_RAIN_COINS
export const rainCoinCount = (count: number): number => Math.max(1, Math.min(MAX_RAIN_COINS, Math.floor(count) || 1));
