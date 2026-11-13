// Like coin levels: a user's level comes from the TOTAL likes they have received
// (users/{uid}.likesReceived, +1 per new like on their posts / wardrobe photos).
//   below 1,999 Bronze · 1,999+ Silver · 4,999+ Gold · 9,999+ Diamond
// Every like plays a coin flip with the coin of the photo owner's level (CoinFlipProvider), and
// the owner's like notifications say which coin the likes came at (services/likeCoins.ts).
export type LikeLevel = 'bronze' | 'silver' | 'gold' | 'diamond';

export const LIKE_LEVELS: { level: LikeLevel; min: number; label: string }[] = [
  { level: 'diamond', min: 9999, label: 'Diamond' },
  { level: 'gold', min: 4999, label: 'Gold' },
  { level: 'silver', min: 1999, label: 'Silver' },
  { level: 'bronze', min: 0, label: 'Bronze' },
];

const n0 = (x: number) => (Number.isFinite(x) ? Math.max(0, x) : 0);

export const likeLevelFor = (likesReceived: number): LikeLevel =>
  (LIKE_LEVELS.find(l => n0(likesReceived) >= l.min) || LIKE_LEVELS[LIKE_LEVELS.length - 1]).level;

export const likeLevelLabel = (level: LikeLevel): string =>
  (LIKE_LEVELS.find(l => l.level === level) || LIKE_LEVELS[LIKE_LEVELS.length - 1]).label;

// Likes still needed for the next level (null at Diamond)
export const likesToNextLevel = (likesReceived: number): number | null => {
  const n = n0(likesReceived);
  const next = [...LIKE_LEVELS].reverse().find(l => l.min > n);
  return next ? next.min - n : null;
};

export const isLikeLevel = (x: unknown): x is LikeLevel =>
  x === 'bronze' || x === 'silver' || x === 'gold' || x === 'diamond';
