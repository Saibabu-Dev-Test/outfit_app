// Loads one civic place (Govt or Hospitals) from the Worker and, when it is not researched yet,
// asks the Worker to research it right away (POST /v1/civic/research, capped there) while the
// screen shows "Collecting info…". When the English data is there but the user's app language
// (Telugu / Hindi) copy is not, it asks for that translation in the background. Polls a few times
// while a run is going. Never loops: each place + language is requested at most once per screen visit.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppLanguage } from '../../i18n/appLanguage';
import { CivicDataResponse, CivicKind, TrCode, researchCivic } from '../../services/civicApi';
import { WorkerError } from '../../services/workerApi';

export const trCode = (lang: AppLanguage): TrCode | null => (lang === 'Telugu' ? 'te' : lang === 'Hindi' ? 'hi' : null);

export type CivicPhase = 'idle' | 'loading' | 'collecting' | 'translating' | 'ready' | 'error' | 'serverOld';

const POLL_MS = 20000;
const MAX_POLLS = 12;

export function useCivicData<T>(
  kind: CivicKind,
  state: string,
  district: string,
  variant: string,
  lang: AppLanguage,
  fetcher: () => Promise<CivicDataResponse<T>>,
) {
  const [res, setRes] = useState<CivicDataResponse<T> | null>(null);
  const [phase, setPhase] = useState<CivicPhase>('idle');
  const [errorText, setErrorText] = useState('');
  const asked = useRef<Set<string>>(new Set());
  const polls = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const key = `${kind}|${state}|${district.trim().toLowerCase()}|${variant}`;
  const tr = trCode(lang);

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
      if (!quiet) setPhase('loading');
      setErrorText('');
      let r: CivicDataResponse<T>;
      try {
        r = await fetcher();
      } catch (e: any) {
        if (!alive.current) return;
        if (e instanceof WorkerError && e.status === 404) {
          setPhase('serverOld');
        } else {
          setPhase('error');
          setErrorText(e?.message || '');
        }
        return;
      }
      if (!alive.current) return;
      setRes(r);
      const schedulePoll = () => {
        if (polls.current < MAX_POLLS) {
          polls.current += 1;
          timer.current = setTimeout(() => load(true), POLL_MS);
        }
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
          try {
            const out = await researchCivic(kind, state, district, variant, null);
            if (!alive.current) return;
            if (out.did === 'research' && out.ok) {
              load(true);
              return;
            }
          } catch {
            // phone gave up waiting; the Worker keeps going, poll below
          }
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
            if (out.did === 'translate' && out.ok) {
              load(true);
              return;
            }
          } catch {
            // keep showing English
          }
          schedulePoll();
        }
        return;
      }
      setPhase('ready');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, tr],
  );

  useEffect(() => {
    polls.current = 0;
    setRes(null);
    load();
  }, [load]);

  const refresh = useCallback(() => {
    polls.current = 0;
    load();
  }, [load]);

  return { res, phase, errorText, refresh, tr };
}
