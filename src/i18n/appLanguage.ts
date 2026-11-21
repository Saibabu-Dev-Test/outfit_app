// App display language (Settings > "App language"): wardrobe labels and the Govt / Laws / Hospitals
// tabs. English by default; 12 languages. Wardrobe / photo labels have static copies in English,
// Telugu and Hindi (other languages show English there); the civic tabs show every language (static
// labels where they exist, else AI translation cached on the Worker) with an English toggle. Saved on the phone (AsyncStorage), kept
// across sign-out. Separate from the profile's "Language" (used for astrology / stylist).
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppLanguage =
  | 'English'
  | 'Telugu'
  | 'Hindi'
  | 'Tamil'
  | 'Kannada'
  | 'Malayalam'
  | 'Marathi'
  | 'Bengali'
  | 'Gujarati'
  | 'Punjabi'
  | 'Odia'
  | 'Urdu';
export const APP_LANGUAGES: AppLanguage[] = ['English', 'Telugu', 'Hindi', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Odia', 'Urdu'];

// Short code per language (same codes as the Worker's TR_LANGS; 'en' = the stored English data)
export type AppLangCode = 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml' | 'mr' | 'bn' | 'gu' | 'pa' | 'or' | 'ur';
export const APP_LANGUAGE_CODE: Record<AppLanguage, AppLangCode> = {
  English: 'en',
  Telugu: 'te',
  Hindi: 'hi',
  Tamil: 'ta',
  Kannada: 'kn',
  Malayalam: 'ml',
  Marathi: 'mr',
  Bengali: 'bn',
  Gujarati: 'gu',
  Punjabi: 'pa',
  Odia: 'or',
  Urdu: 'ur',
};

// Each language in its own script (language picker)
export const APP_LANGUAGE_NATIVE: Record<AppLanguage, string> = {
  English: 'English',
  Telugu: 'తెలుగు',
  Hindi: 'हिन्दी',
  Tamil: 'தமிழ்',
  Kannada: 'ಕನ್ನಡ',
  Malayalam: 'മലയാളം',
  Marathi: 'मराठी',
  Bengali: 'বাংলা',
  Gujarati: 'ગુજરાતી',
  Punjabi: 'ਪੰਜਾਬੀ',
  Odia: 'ଓଡ଼ିଆ',
  Urdu: 'اردو',
};

export const langCode = (l?: AppLanguage | null): AppLangCode => (l && APP_LANGUAGE_CODE[l]) || 'en';

// Languages with hand-written static copies (wardrobe, photo, civic labels, laws plain text)
export type StaticLanguage = 'English' | 'Telugu' | 'Hindi';
export const staticLanguage = (l?: AppLanguage | null): StaticLanguage => (l === 'Telugu' || l === 'Hindi' ? l : 'English');
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
