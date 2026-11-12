// Coin rewards: points per action and the tiers. One place for every number.
// If you change COIN_POINTS, change coinPoints() in firestore.rules too.
export type CoinAction = 'like' | 'upload' | 'share';

export const COIN_POINTS: Record<CoinAction, number> = {
  like: 1,
  upload: 10,
  share: 50,
};

export type CoinTier = 'silver' | 'gold' | 'diamond';

// Lowest total for each tier (Silver 0-499, Gold 500-1,999, Diamond 2,000+)
export const COIN_TIERS: { tier: CoinTier; min: number; label: string }[] = [
  { tier: 'diamond', min: 2000, label: 'Diamond' },
  { tier: 'gold', min: 500, label: 'Gold' },
  { tier: 'silver', min: 0, label: 'Silver' },
];

export const tierFor = (total: number): CoinTier => {
  const n = Number.isFinite(total) ? total : 0;
  return (COIN_TIERS.find(t => n >= t.min) || COIN_TIERS[COIN_TIERS.length - 1]).tier;
};

export const tierLabel = (tier: CoinTier): string =>
  (COIN_TIERS.find(t => t.tier === tier) || COIN_TIERS[COIN_TIERS.length - 1]).label;

// Coins still needed for the next tier (null at the top)
export const coinsToNextTier = (total: number): number | null => {
  const n = Math.max(0, Number.isFinite(total) ? total : 0);
  const next = [...COIN_TIERS].reverse().find(t => t.min > n);
  return next ? next.min - n : null;
};
