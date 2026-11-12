import { COIN_POINTS, coinsToNextTier, tierFor, tierLabel } from '../src/config/coins';

describe('coin tiers', () => {
  it('maps totals to Silver / Gold / Diamond', () => {
    expect(tierFor(0)).toBe('silver');
    expect(tierFor(499)).toBe('silver');
    expect(tierFor(500)).toBe('gold');
    expect(tierFor(1999)).toBe('gold');
    expect(tierFor(2000)).toBe('diamond');
    expect(tierFor(1e7)).toBe('diamond');
    expect(tierFor(NaN)).toBe('silver');
    expect(tierFor(-5)).toBe('silver');
  });
  it('labels and next tier', () => {
    expect(tierLabel('gold')).toBe('Gold');
    expect(coinsToNextTier(450)).toBe(50);
    expect(coinsToNextTier(500)).toBe(1500);
    expect(coinsToNextTier(2500)).toBeNull();
  });
  it('fixed points (must match firestore.rules coinPoints)', () => {
    expect(COIN_POINTS).toEqual({ like: 1, upload: 10, share: 50, task: 100 });
  });
});
