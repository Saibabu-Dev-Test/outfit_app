// Content unlocked by watching a rewarded ad, valid for the rest of that (local) day.
// AsyncStorage key 'adUnlock.<feature>' = 'YYYY-MM-DD' of the unlock.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from '../utils/date';

const key = (feature: string) => `adUnlock.${feature}`;

export const isUnlockedToday = async (feature: string): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(key(feature))) === localDateKey();
  } catch {
    return false;
  }
};

export const unlockToday = async (feature: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key(feature), localDateKey());
  } catch {}
};
