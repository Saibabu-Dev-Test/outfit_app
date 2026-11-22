// Loads one civic place (Govt, Hospitals or the comparison) fast:
//  1. the last answer for this place + language saved on the phone shows at once (civicCache),
//  2. the Worker read (one quick D1 read, with the app language's copy) replaces it,
//  3. a place not researched yet is researched on demand (POST /v1/civic/research) WITH the app
//     language in the same run; data present but the language missing = translation on demand.
// While a run is going it polls every POLL_MS for a short window (MAX_POLLS). Never loops: each
// place + language is requested at most once per screen visit. AI failures (free-tier limit, credits
// used up) give a clear message while saved / cached info stays on screen. Status 'paused' (every
// Worker Gemini key out of free quota) = "research paused, showing saved info": no retry, no poll.
// Research that fails (error, timeout, daily cap, busy) or polls that run out never leave the spinner
// on: saved / English info shows ('ready'), else 'error' with the pull-to-retry message (refresh asks
// again). Govt status 'partial' = the parts finished so far show at once while the rest is polled for.
// Translation status 'translating' = the Worker started it in the background: English shows, poll.
// Free sources (data reply freeSources: true; Govt / Hospitals from Wikidata / Wikipedia / OSM): a
// research reply with status 'ready' (origin 'free') is success, the saved rows are read at once;
// 'paused' is never shown for them (only AI translation can hit a limit: "translation on the way").
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
  const lastGood = useRef<CivicDataResponse<T> | null>(null); // last complete answer (phone cache or Worker)
  const stopped = useRef(false); // research gave up for this visit: late polls must not restart the spinner
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
      if (quiet && stopped.current) return;
      live.current = true;
      setRes(r);
      setFromCache(false);
      const partial = !!r.data && r.status === 'partial';
      if (r.data && !partial) {
        writeCivicCache(cacheKey, r);
        lastGood.current = r;
      }
      const schedulePoll = () => {
        if (polls.current < MAX_POLLS) {
          polls.current += 1;
          timer.current = setTimeout(() => load(true), POLL_MS);
        }
      };
      const free = !!r.freeSources;
      const note = (out: { ok: boolean; status?: string; code?: any; error?: string }, translate = false) => {
        if (free) {
          // free-source data never pauses; an AI translation hiccup only delays the translated copy
          if (translate && (out.status === 'paused' || (!out.ok && out.code))) setAiNote('trLater');
          return;
        }
        if (out.status === 'paused') setAiNote('researchPaused');
        else if (!out.ok && out.code) setAiNote(aiErrorKey(null, out.code));
      };
      // Research of a new place: free sources (Govt / Hospitals) or grounded Gemini on the Worker;
      // older Workers only send aiConfigured
      const canResearch = free || (r.researchConfigured ?? r.aiConfigured);
      if (!r.data || partial) {
        if (!canResearch) {
          setPhase('ready');
          return;
        }
        setPhase('collecting');
        // Stop the spinner (like the translating branch ends): what is on hand shows as 'ready'
        // (finished Govt parts, else the saved / English answer); nothing at all = 'error' + retry text
        const giveUp = () => {
          stopped.current = true;
          if (timer.current) clearTimeout(timer.current);
          if (r.data) {
            setPhase('ready');
          } else if (lastGood.current && lastGood.current.data) {
            setRes(lastGood.current);
            setFromCache(true);
            setPhase('ready');
          } else {
            setPhase('error');
          }
        };
        const k = `${key}|research`;
        if (!asked.current.has(k) && !r.running) {
          asked.current.add(k);
          // The run takes seconds; poll meanwhile so another runner's result shows as soon as it lands
          schedulePoll();
          try {
            const out = await researchCivic(kind, state, district, variant, tr);
            if (!alive.current) return;
            note(out);
            if ((out.did === 'research' && out.ok) || (out.ok && out.status === 'ready')) {
              // done ('ready' = free-source rows saved): read them now
              if (timer.current) clearTimeout(timer.current);
              load(true);
              return;
            }
            if (out.status === 'paused' && !free) {
              // Out of free quota: show what is saved (cache / nothing yet) and stop polling
              stopped.current = true;
              if (timer.current) clearTimeout(timer.current);
              setPhase('ready');
              return;
            }
            if (!out.ok) {
              // error / timeout / daily cap / busy: no point waiting for a run that is not going
              giveUp();
              return;
            }
            // ok (already running elsewhere / nothing to do): keep polling for the result
          } catch (e) {
            if (!alive.current) return;
            const n = aiErrorKey(e);
            if (n !== 'error' && !(free && n === 'researchPaused')) setAiNote(n);
            if (e instanceof WorkerError) {
              // the Worker answered with an error (busy 429, limit, server error): nothing is running
              giveUp();
              return;
            }
            // phone gave up waiting; the Worker keeps going, polling continues
          }
          return;
        }
        if (polls.current >= MAX_POLLS) giveUp();
        else schedulePoll();
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
            note(out, true);
            if (out.did === 'translate' && out.ok && out.status !== 'translating') {
              load(true);
              return;
            }
            if (!out.ok && (out.code || out.status === 'paused')) {
              setPhase('ready'); // English shows; the note says why
              return;
            }
          } catch (e) {
            if (!alive.current) return;
            const n = aiErrorKey(e);
            if (n !== 'error') setAiNote(free ? 'trLater' : n);
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
    lastGood.current = null;
    stopped.current = false;
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
        lastGood.current = c.res;
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

  // Pull to refresh = a real retry: research / translation may be asked again (once per pull)
  const refresh = useCallback(() => {
    polls.current = 0;
    stopped.current = false;
    asked.current.delete(`${key}|research`);
    if (tr) asked.current.delete(`${key}|${tr}`);
    load();
  }, [load, key, tr]);

  return { res, phase, errorText, refresh, tr, aiNote, fromCache };
}
