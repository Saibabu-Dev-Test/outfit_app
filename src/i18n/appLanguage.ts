// App display language for wardrobe labels (Settings > "App language"). English by default;
// Telugu / Hindi only when the user picks it here. Saved on the phone (AsyncStorage), kept
// across sign-out. Separate from the profile's "Language" (used for astrology / stylist).
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppLanguage = 'English' | 'Telugu' | 'Hindi';
export const APP_LANGUAGES: AppLanguage[] = ['English', 'Telugu', 'Hindi'];
export const APP_LANGUAGE_KEY = 'outfitpref:appLanguage';

let current: AppLanguage = 'English';
const listeners = new Set<(l: AppLanguage) => void>();

const valid = (v?: string | null): v is AppLanguage => !!v && (APP_LANGUAGES as string[]).includes(v);

AsyncStorage.getItem(APP_LANGUAGE_KEY)
  .then(v => {
    if (valid(v) && v !== current) {
      current = v;
      listeners.forEach(f => f(v));
    }
  })
  .catch(() => {});

export const getAppLanguage = (): AppLanguage => current;

export const setAppLanguage = (l: AppLanguage): void => {
  if (!valid(l)) return;
  current = l;
  listeners.forEach(f => f(l));
  AsyncStorage.setItem(APP_LANGUAGE_KEY, l).catch(() => {});
};

export const useAppLanguage = (): AppLanguage => {
  const [lang, setLang] = useState<AppLanguage>(current);
  useEffect(() => {
    listeners.add(setLang);
    setLang(current);
    return () => {
      listeners.delete(setLang);
    };
  }, []);
  return lang;
};
