// Loads one civic place (Govt, Hospitals or the comparison) fast:
//  1. the last answer for this place + language saved on the phone shows at once (civicCache),
//  2. the Worker read (one quick D1 read, with the app language's copy) replaces it,
//  3. a place not researched yet is researched on demand (POST /v1/civic/research) WITH the app
//     language in the same run; data present but the language missing = translation on demand.
// While a run is going it polls every POLL_MS for a short window (MAX_POLLS). Never loops: each
// place + language is requested at most once per screen visit. AI failures (free-tier limit, credits
// used up) give a clear message while saved / cached info stays on screen.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppLanguage, langCode } from '../../i18n/appLanguage';
import type { CivicKey } from '../../i18n/civicLabels';
import { CivicDataResponse, CivicKind, TrCode, researchCivic } from '../../services/civicApi';
import { civicCacheKey, readCivicCache, writeCivicCache } from '../../services/civicCache';
import { aiErrorKey } from '../../services/civicAi';
import { WorkerError } from '../../services/workerApi';

// Translated language code for an app language (null = English, nothing to translate)
export const trCode = (lang: AppLanguage): TrCode | null => {
  const c = langCode(lang);
  return c === 'en' ? null : c;
};

export type CivicPhase = 'idle' | 'loading' | 'collecting' | 'translating' | 'ready' | 'error' | 'serverOld';

export const POLL_MS = 2500;
export const MAX_POLLS = 24; // ~1 minute

export function useCivicData<T>(
  kind: CivicKind,
  state: string,
  district: string,
  variant: string,
  lang: AppLanguage,
  fetcher: (tr: TrCode | null) => Promise<CivicDataResponse<T>>,
) {
  const [res, setRes] = useState<CivicDataResponse<T> | null>(null);
  const [phase, setPhase] = useState<CivicPhase>('idle');
  const [errorText, setErrorText] = useState('');
  const [aiNote, setAiNote] = useState<CivicKey | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const asked = useRef<Set<string>>(new Set());
  const polls = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const live = useRef(false); // a Worker answer arrived for this place (cache must not replace it)
  const key = `${kind}|${state}|${district.trim().toLowerCase()}|${variant}`;
  const tr = trCode(lang);
  const cacheKey = civicCacheKey(kind, state, district, variant, tr);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const load = useCallback(
    async (quiet = false) => {
      if (!state) return;
      if (timer.current) clearTimeout(timer.current);
      if (!quiet) setPhase(p => (p === 'ready' ? p : 'loading'));
      setErrorText('');
      let r: CivicDataResponse<T>;
      try {
        r = await fetcher(tr);
      } catch (e: any) {
        if (!alive.current) return;
        if (e instanceof WorkerError && e.status === 404) {
          setPhase('serverOld');
        } else {
          // keep cached data on screen; only say the refresh failed
          setPhase(p => (p === 'ready' ? 'ready' : 'error'));
          setErrorText(e?.message || '');
        }
        return;
      }
      if (!alive.current) return;
      live.current = true;
      setRes(r);
      setFromCache(false);
      if (r.data) writeCivicCache(cacheKey, r);
      const schedulePoll = () => {
        if (polls.current < MAX_POLLS) {
          polls.current += 1;
          timer.current = setTimeout(() => load(true), POLL_MS);
        }
      };
      const note = (out: { ok: boolean; code?: any; error?: string }) => {
        if (!out.ok && out.code) setAiNote(aiErrorKey(null, out.code));
      };
      if (!r.data) {
        if (!r.aiConfigured) {
          setPhase('ready');
          return;
        }
        setPhase('collecting');
        const k = `${key}|research`;
        if (!asked.current.has(k) && !r.running) {
          asked.current.add(k);
          // The run takes seconds; poll meanwhile so another runner's result shows as soon as it lands
          schedulePoll();
          try {
            const out = await researchCivic(kind, state, district, variant, tr);
            if (!alive.current) return;
            note(out);
            if (out.did === 'research' && out.ok) {
              load(true);
              return;
            }
          } catch (e) {
            if (!alive.current) return;
            const n = aiErrorKey(e);
            if (n !== 'error') setAiNote(n);
            // phone gave up waiting; the Worker keeps going, polling continues
          }
          return;
        }
        schedulePoll();
        return;
      }
      if (tr && !(r.i18n && r.i18n[tr]) && r.aiConfigured) {
        setPhase('translating');
        const k = `${key}|${tr}`;
        if (!asked.current.has(k)) {
          asked.current.add(k);
          try {
            const out = await researchCivic(kind, state, district, variant, tr);
            if (!alive.current) return;
            note(out);
            if (out.did === 'translate' && out.ok) {
              load(true);
              return;
            }
            if (!out.ok && out.code) {
              setPhase('ready'); // English shows; the note says why
              return;
            }
          } catch (e) {
            if (!alive.current) return;
            const n = aiErrorKey(e);
            if (n !== 'error') setAiNote(n);
            setPhase('ready');
            return;
          }
          schedulePoll();
          return;
        }
        if (polls.current >= MAX_POLLS) setPhase('ready');
        else schedulePoll();
        return;
      }
      setPhase('ready');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, tr],
  );

  useEffect(() => {
    let cancelled = false;
    polls.current = 0;
    live.current = false;
    setRes(null);
    setAiNote(null);
    setFromCache(false);
    if (!state) {
      setPhase('idle');
      return;
    }
    setPhase('loading');
    // Saved answer first (instant), then the Worker
    readCivicCache<CivicDataResponse<T>>(cacheKey).then(c => {
      if (cancelled || !alive.current || live.current) return;
      if (c && c.res && c.res.data) {
        setRes(c.res);
        setFromCache(true);
        setPhase(p => (p === 'loading' ? 'ready' : p));
      }
    });
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const refresh = useCallback(() => {
    polls.current = 0;
    load();
  }, [load]);

  return { res, phase, errorText, refresh, tr, aiNote, fromCache };
}
