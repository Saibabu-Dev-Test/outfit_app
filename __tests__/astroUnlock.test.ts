import AsyncStorage from '@react-native-async-storage/async-storage';
import { astroUnlockKey, isUnlockedFor, loadAstroUnlock, saveAstroUnlock, shortText } from '../src/services/astroUnlock';

describe('astrology daily unlock', () => {
  it('is open only on the day it was unlocked', () => {
    expect(isUnlockedFor('2026-11-12', '2026-11-12')).toBe(true);
    expect(isUnlockedFor('2026-11-12', '2026-11-13')).toBe(false); // after local midnight
    expect(isUnlockedFor(null, '2026-11-12')).toBe(false);
    expect(isUnlockedFor('garbage', 'garbage')).toBe(false);
  });

  it('persists per user in AsyncStorage', async () => {
    await saveAstroUnlock('u1', '2026-11-12');
    expect(await AsyncStorage.getItem(astroUnlockKey('u1'))).toBe('2026-11-12');
    expect(await loadAstroUnlock('u1', '2026-11-12')).toBe(true);
    expect(await loadAstroUnlock('u1', '2026-11-13')).toBe(false);
    expect(await loadAstroUnlock('u2', '2026-11-12')).toBe(false);
  });

  it('short summary keeps the first sentence', () => {
    expect(shortText('Good day for work. Avoid arguments in the evening.')).toBe('Good day for work.');
    expect(shortText('')).toBe('');
    const long = 'word '.repeat(80);
    const s = shortText(long, 40);
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith('…')).toBe(true);
  });
});
