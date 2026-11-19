// AI translation of civic app text that has no static copy in the user's language (civic labels for
// Tamil / Kannada / ..., laws plain-language text, offence guide lines). Asked from the Worker
// (POST /v1/civic/translate, cached there for every user) and kept on the phone per namespace +
// language, keyed by the English text so a changed English string is translated again. Until a
// translation arrives the screens show English. Never throws.
import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppLanguage, langCode } from '../i18n/appLanguage';
import { CIVIC_LABELS, CivicKey, hasStaticLabels, setAiLabels } from '../i18n/civicLabels';
import { TrCode, TrNamespace, translateCivicTexts } from './civicApi';

const STORE_PREFIX = 'outfit.civicTr.v1:';
const BATCH = 80; // Worker limit per request

type Store = Record<string, [string, string]>; // key -> [english, translated]
const stores = new Map<string, Store>();
const inflight = new Map<string, Promise<Record<string, string>>>();

const loadStore = async (id: string): Promise<Store> => {
  const mem = stores.get(id);
  if (mem) return mem;
  let s: Store = {};
  try {
    const raw = await AsyncStorage.getItem(STORE_PREFIX + id);
    const v = raw ? JSON.parse(raw) : null;
    if (v && typeof v === 'object') s = v;
  } catch {
    s = {};
  }
  stores.set(id, s);
  return s;
};

// Cached translations whose English source still matches (pure: tested)
export const fromStore = (store: Store, items: Record<string, string>): { have: Record<string, string>; missing: string[] } => {
  const have: Record<string, string> = {};
  const missing: string[] = [];
  Object.entries(items).forEach(([k, en]) => {
    const hit = store[k];
    if (hit && hit[0] === en && hit[1]) have[k] = hit[1];
    else missing.push(k);
  });
  return { have, missing };
};

export async function translateTexts(ns: TrNamespace, lang: TrCode, items: Record<string, string>): Promise<Record<string, string>> {
  const id = `${ns}:${lang}`;
  const store = await loadStore(id);
  const { have, missing } = fromStore(store, items);
  if (!missing.length) return have;
  const flightKey = `${id}|${missing.join(',')}`;
  const running = inflight.get(flightKey);
  if (running) return { ...have, ...(await running) };
  const job = (async () => {
    const got: Record<string, string> = {};
    for (let i = 0; i < missing.length; i += BATCH) {
      const part = Object.fromEntries(missing.slice(i, i + BATCH).map(k => [k, items[k]]));
      try {
        const r = await translateCivicTexts(ns, lang, part);
        Object.entries(r.items || {}).forEach(([k, v]) => {
          if (typeof v === 'string' && v && part[k]) {
            got[k] = v;
            store[k] = [part[k], v];
          }
        });
      } catch {
        break; // offline / old Worker / AI busy: English stays
      }
    }
    if (Object.keys(got).length) AsyncStorage.setItem(STORE_PREFIX + id, JSON.stringify(store)).catch(() => undefined);
    return got;
  })();
  inflight.set(flightKey, job);
  try {
    return { ...have, ...(await job) };
  } finally {
    inflight.delete(flightKey);
  }
}

// Civic labels for an app language without static labels (no-op for English / Telugu / Hindi)
export async function ensureCivicLabels(lang: AppLanguage): Promise<number> {
  if (hasStaticLabels(lang)) return 0;
  const code = langCode(lang) as TrCode;
  const got = await translateTexts('labels', code, CIVIC_LABELS.English);
  setAiLabels(lang, got as Partial<Record<CivicKey, string>>);
  return Object.keys(got).length;
}

// Re-renders the screen once the AI labels for its language are ready
export function useCivicLabels(lang: AppLanguage): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    ensureCivicLabels(lang).then(c => {
      if (alive && c) setN(x => x + 1);
    });
    return () => {
      alive = false;
    };
  }, [lang]);
  return n;
}

// AI translations of some English texts (only when `enabled`, e.g. when a law card is opened)
export function useAiTexts(ns: TrNamespace, lang: AppLanguage, items: Record<string, string>, enabled: boolean): Record<string, string> {
  const [out, setOut] = useState<Record<string, string>>({});
  const sig = useMemo(() => JSON.stringify(items), [items]);
  useEffect(() => {
    let alive = true;
    if (!enabled || hasStaticLabels(lang) || !Object.keys(items).length) {
      setOut({});
      return;
    }
    translateTexts(ns, langCode(lang) as TrCode, items).then(r => {
      if (alive) setOut(r);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ns, lang, sig, enabled]);
  return out;
}
