// Location scope with automatic fallback: the screen asks for the picked mandal; when that answer is
// empty it asks for the district, and when the district is empty too, the whole state. The Worker
// already falls back the same way (data.scope); this covers Workers deployed before it and rows saved
// empty. Only an answer that belongs to the asked level counts (a stale 'ready' from the previous
// level never skips a level).
import { useCallback, useEffect, useState } from 'react';
import { DataScope, districtSlug } from '../../services/civicApi';
import { CivicPlace, ScopeLevel, askedLevel } from './LocationPicker';

export interface ScopeRequest {
  level: ScopeLevel;
  district: string; // '' = state-wide
  mandal: string; // '' = district-wide
}

export const requestFor = (place: CivicPlace, level: ScopeLevel): ScopeRequest => ({
  level,
  district: level === 'state' ? '' : place.district,
  mandal: level === 'mandal' ? place.mandal : '',
});

// Does this Worker answer belong to the request? (Older Workers do not echo mandal: never matches a
// mandal request, so no level is skipped on their answers.)
export const answerFor = (res: { state?: string; district?: string; mandal?: string } | null | undefined, state: string, req: ScopeRequest): boolean =>
  !!res && res.state === state && (res.district || '') === districtSlug(req.district) && (res.mandal || '') === districtSlug(req.mandal);

/** Level actually shown (pure: tested). The Worker's data.scope wins; an older Worker asked for a
 *  mandal answers for the district. */
export const shownLevel = (req: ScopeRequest, scope?: DataScope | null): ScopeLevel => {
  if (scope === 'mandal' || scope === 'district' || scope === 'state') return scope;
  return req.level === 'mandal' ? 'district' : req.level;
};

const down = (l: ScopeLevel): ScopeLevel => (l === 'mandal' ? 'district' : 'state');

/**
 * The request for the current level + fallback(from): step down one level when the answer for `from`
 * was empty. Call fallback from an effect once the loaders finished (useFallbackWhen).
 */
export function useScopeLevel(place: CivicPlace): { req: ScopeRequest; fallback: (from: ScopeLevel) => void } {
  const asked = askedLevel(place);
  const placeKey = `${place.state}|${place.districtCode || place.district}|${place.mandalCode || place.mandal}`;
  const [st, setSt] = useState<{ key: string; level: ScopeLevel }>({ key: placeKey, level: asked });
  const level = st.key === placeKey ? st.level : asked;
  useEffect(() => {
    if (st.key !== placeKey) setSt({ key: placeKey, level: asked });
  }, [placeKey, asked, st.key]);
  const fallback = useCallback(
    (from: ScopeLevel) =>
      setSt(cur => {
        const lv = cur.key === placeKey ? cur.level : asked;
        return lv === from && lv !== 'state' ? { key: placeKey, level: down(lv) } : cur.key === placeKey ? cur : { key: placeKey, level: lv };
      }),
    [placeKey, asked],
  );
  return { req: requestFor(place, level), fallback };
}

/** Steps down when `empty` (the loaders finished for req and have nothing). */
export function useFallbackWhen(empty: boolean, req: ScopeRequest, fallback: (from: ScopeLevel) => void) {
  useEffect(() => {
    if (empty && req.level !== 'state') fallback(req.level);
  }, [empty, req.level, fallback]);
}
