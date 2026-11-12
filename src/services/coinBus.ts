// Tiny in-memory bus between coin awards (services) and the UI (overlay, profile badge).
// No React / React Native imports so services and tests can use it freely.
import type { CoinTier } from '../config/coins';
import type { LikeLevel } from '../config/likeLevels';

export interface CoinFlipEvent {
  earned: number; // coins added (0 = no new coins, e.g. a like on a photo already rewarded)
  total: number;
  tier: CoinTier;
  // Likes: the coin face of the photo owner's like level and a line under it ("Gold like")
  face?: CoinTier | LikeLevel;
  caption?: string;
}

type FlipListener = (e: CoinFlipEvent) => void;
type TotalListener = (total: number | null) => void;

const flipListeners = new Set<FlipListener>();
const totalListeners = new Set<TotalListener>();
let lastTotal: number | null = null;

// Shows the coin flip overlay (no-op when the overlay isn't mounted). Never throws.
export const showCoinFlip = (e: CoinFlipEvent) => {
  flipListeners.forEach(fn => {
    try {
      fn(e);
    } catch {}
  });
};

export const onCoinFlip = (fn: FlipListener): (() => void) => {
  flipListeners.add(fn);
  return () => {
    flipListeners.delete(fn);
  };
};

export const getKnownCoinTotal = () => lastTotal;

export const setKnownCoinTotal = (total: number | null) => {
  lastTotal = total;
  totalListeners.forEach(fn => {
    try {
      fn(total);
    } catch {}
  });
};

export const onCoinTotal = (fn: TotalListener): (() => void) => {
  totalListeners.add(fn);
  return () => {
    totalListeners.delete(fn);
  };
};
