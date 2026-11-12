// Tiny in-memory bus between coin awards (services) and the UI (overlay, profile badge).
// No React / React Native imports so services and tests can use it freely.
import type { CoinTier } from '../config/coins';

export interface CoinFlipEvent {
  earned: number;
  total: number;
  tier: CoinTier;
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
