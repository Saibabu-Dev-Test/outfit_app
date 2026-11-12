// Profile > Birth details: the user's name, date, time (optional) and place of birth, a
// "Confirm birth details" tick, and the birth chart worked out from them on the phone
// (utils/jathakam.ts: rashi, nakshatra + pada, birth tithi, Lagna with a birth time, gana, yoni,
// nadi, current Mahadasha, numerology). Saved on users/{uid} as `astroChart` (plain English names
// + indexes) so it persists and other screens can read it; `rashi` is auto-filled from it.
// Recomputed whenever the details change (the key below), and when the Mahadasha period ends.
import { computeJathakam, DEFAULT_PLACE, Jathakam } from '../utils/jathakam';
import { birthPlaceOf } from '../constants/indianCities';
import { RASHIS } from '../utils/panchangam';
import { GANA_NAMES, NADI_NAMES, NAKSHATRA_NAMES, PLANET_NAMES, tithiName, YONI_NAMES } from '../i18n/astroNames';

export interface BirthInputs {
  name?: string | null;
  dob?: string | null;
  timeOfBirth?: string | null;
  placeOfBirth?: string | null;
}

export interface StoredAstroChart {
  key: string; // birthKey() of the details it was computed from
  rashi: string; // 'Simha (Leo)' (RASHIS)
  rashiIndex: number;
  nakshatra: string; // English name
  nakshatraIndex: number;
  pada: number; // 1..4
  birthTithi: string;
  lagna: string | null; // only with a time of birth
  gana: string;
  yoni: string;
  nadi: string;
  mahadasha: string | null; // planet (English)
  mahadashaUntil: string | null; // YYYY-MM-DD (IST)
  lifePath: number;
  birthNumber: number;
  nameNumber: number | null;
  place: string;
  timeKnown: boolean;
}

const clean = (v?: string | null) => (v || '').trim();
// Identity of the birth details: confirmation and the stored chart belong to exactly these values
export const birthKey = (p: BirthInputs) =>
  [clean(p.name).toLowerCase(), clean(p.dob), clean(p.timeOfBirth).toUpperCase(), clean(p.placeOfBirth).toLowerCase()].join('|');

// Name, date and place are needed to confirm; time of birth is optional
export const birthDetailsComplete = (p: BirthInputs) => !!(clean(p.name) && clean(p.dob) && clean(p.placeOfBirth));

export const jathakamFor = (p: BirthInputs, nowMs: number = Date.now()): Jathakam | null =>
  computeJathakam(p, birthPlaceOf(p.placeOfBirth) || DEFAULT_PLACE, nowMs);

const istYmd = (ms: number) => new Date(ms + 330 * 60000).toISOString().slice(0, 10);

export const astroChartFor = (p: BirthInputs, nowMs: number = Date.now()): StoredAstroChart | null => {
  const j = jathakamFor(p, nowMs);
  if (!j) return null;
  const E = 'English' as const;
  return {
    key: birthKey(p),
    rashi: RASHIS[j.rashi],
    rashiIndex: j.rashi,
    nakshatra: NAKSHATRA_NAMES[E][j.nakshatra],
    nakshatraIndex: j.nakshatra,
    pada: j.pada + 1,
    birthTithi: tithiName(j.tithi, E),
    lagna: j.lagnaRashi === null ? null : RASHIS[j.lagnaRashi],
    gana: GANA_NAMES[E][j.gana],
    yoni: YONI_NAMES[E][j.yoni],
    nadi: NADI_NAMES[E][j.nadi],
    mahadasha: j.mahadasha ? PLANET_NAMES[E][j.mahadasha.lord] : null,
    mahadashaUntil: j.mahadasha ? istYmd(j.mahadasha.end) : null,
    lifePath: j.lifePath,
    birthNumber: j.birthNumber,
    nameNumber: j.nameNumber,
    place: j.place.name,
    timeKnown: j.timeKnown,
  };
};

// True when the saved chart is missing, was computed from other details, or its Mahadasha ended
export const astroChartStale = (p: BirthInputs, saved: StoredAstroChart | null | undefined, nowMs: number = Date.now()): boolean => {
  if (!clean(p.dob)) return false; // nothing to compute
  if (!saved || saved.key !== birthKey(p)) return true;
  return !!saved.mahadashaUntil && saved.mahadashaUntil < istYmd(nowMs);
};

// The fields to merge into users/{uid} after the birth details are saved / confirmed
export const birthProfileUpdate = (
  p: BirthInputs & { rashi?: string | null },
  opts: { confirm?: boolean; prevConfirmedKey?: string | null; nowMs?: number } = {},
): { astroChart: StoredAstroChart | null; rashi: string; birthConfirmed: boolean; birthConfirmedKey: string | null } => {
  const chart = astroChartFor(p, opts.nowMs);
  const key = birthKey(p);
  const confirmed = opts.confirm ? birthDetailsComplete(p) : !!opts.prevConfirmedKey && opts.prevConfirmedKey === key;
  return {
    astroChart: chart,
    rashi: chart ? chart.rashi : clean(p.rashi), // no date of birth: keep a rashi saved earlier
    birthConfirmed: confirmed,
    birthConfirmedKey: confirmed ? key : null,
  };
};
