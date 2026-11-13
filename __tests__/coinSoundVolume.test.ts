import { MAX_COIN_VOLUME, clampVolume } from '../src/native/coinSound';

describe('coin sound volume cap', () => {
  it('caps at 40% of media volume', () => {
    expect(MAX_COIN_VOLUME).toBe(0.4);
    expect(clampVolume(1)).toBe(0.4);
    expect(clampVolume('0.9')).toBe(0.4);
    expect(clampVolume(0.25)).toBe(0.25);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume('x')).toBe(0.4);
  });
});
