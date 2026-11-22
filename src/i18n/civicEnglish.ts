// "Also show English" for the Govt / Laws / Hospitals tabs (header language chip): when on, every
// civic card shows the English original under the app-language line. On by default (selected
// language + English); each card's own "English" toggle can still hide / show it. Saved on the phone.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CIVIC_ENGLISH_KEY = 'outfitpref:civicShowEnglish';

let current = true;
const listeners = new Set<(v: boolean) => void>();

AsyncStorage.getItem(CIVIC_ENGLISH_KEY)
  .then(v => {
    if (v === '0' || v === '1') {
      const b = v === '1';
      if (b !== current) {
        current = b;
        listeners.forEach(f => f(b));
      }
    }
  })
  .catch(() => {});

export const getCivicShowEnglish = (): boolean => current;

export const setCivicShowEnglish = (v: boolean): void => {
  current = !!v;
  listeners.forEach(f => f(current));
  AsyncStorage.setItem(CIVIC_ENGLISH_KEY, current ? '1' : '0').catch(() => {});
};

export const useCivicShowEnglish = (): boolean => {
  const [v, setV] = useState<boolean>(current);
  useEffect(() => {
    listeners.add(setV);
    setV(current);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
};
