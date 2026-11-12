import { likeLevelFor, likeLevelLabel, likesToNextLevel, isLikeLevel } from '../src/config/likeLevels';

describe('like coin levels', () => {
  it('maps likes received to Bronze / Silver / Gold / Diamond', () => {
    expect(likeLevelFor(0)).toBe('bronze');
    expect(likeLevelFor(1998)).toBe('bronze');
    expect(likeLevelFor(1999)).toBe('silver');
    expect(likeLevelFor(4998)).toBe('silver');
    expect(likeLevelFor(4999)).toBe('gold');
    expect(likeLevelFor(9998)).toBe('gold');
    expect(likeLevelFor(9999)).toBe('diamond');
    expect(likeLevelFor(1e7)).toBe('diamond');
    expect(likeLevelFor(NaN)).toBe('bronze');
    expect(likeLevelFor(-3)).toBe('bronze');
  });
  it('labels and likes to the next level', () => {
    expect(likeLevelLabel('diamond')).toBe('Diamond');
    expect(likesToNextLevel(1990)).toBe(9);
    expect(likesToNextLevel(1999)).toBe(3000);
    expect(likesToNextLevel(9999)).toBeNull();
    expect(isLikeLevel('gold')).toBe(true);
    expect(isLikeLevel('platinum')).toBe(false);
  });
});
