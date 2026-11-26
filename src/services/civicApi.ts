// Govt / Hospitals tabs data from the Worker (server/worker/src/civic/routes.js). Pure helpers
// (item keys, district slug) are tested in __tests__/civicWorker.test.ts.
import { workerFetch } from './workerApi';

// gcmp = neutral previous vs present government comparison (state code or 'IN' for the centre)
// gprm = promises tracker: the present government's manifesto promises + status (state or 'IN')
export type CivicKind = 'govt' | 'hosp' | 'gcmp' | 'gprm';
export const CENTRE_CODE = 'IN';
export type HospVariant = 'govt' | 'private';

export interface CivicPerson {
  name: string;
  party: string;
  role: string; // portfolios
}

export interface CivicRep {
  name: string;
  constituency: string;
  party: string;
}

export interface GovtData {
  asOf?: string;
  overview: string;
  leaders?: { governor: string; chiefMinister: CivicPerson; deputyCMs: CivicPerson[]; ministers: CivicPerson[] };
  district?: { headquarters: string; collector: string; sp: string; policeCommissioner: string; mps: CivicRep[]; mlas: CivicRep[] };
  offices?: { name: string; what: string; address: string; phone: string; website: string }[];
  schemes: { name: string; level?: 'state' | 'central'; who: string; benefit: string; apply: string; website: string }[];
  grievance?: { name: string; how: string; phone: string; website: string }[];
  election?: { lastAssembly: string; lastLokSabha: string; next: string; voterHelpline: string; ceoWebsite: string };
  departments: { name: string; what: string; website: string; helpline: string }[];
  services: { name: string; how: string; website: string }[];
  helplines: { name: string; number: string }[];
  // Free-source rows (Worker origin 'free': Wikidata / Wikipedia / official .gov.in): per-section
  // source {name, url, date}; Collector / SP stay '' (no free source)
  origin?: 'free' | 'ai';
  src?: GovtSrc;
  // Asked with a mandal (sub-district): that mandal's own facts (LGD name, Wikipedia summary, the
  // assembly constituencies named after it). Empty = nothing public for the mandal (district shown).
  mandal?: GovtMandal | null;
  // Level the data really covers (Worker fallback mandal -> district -> state); missing = as asked
  scope?: DataScope;
}

export type DataScope = 'mandal' | 'district' | 'state';

export interface GovtMandal {
  name: string;
  overview: string;
  mlas: CivicRep[];
  src?: CivicSrc | null;
}

// One public source of a free-source value (date = the day it was fetched, YYYY-MM-DD)
export interface CivicSrc {
  name: string;
  url: string;
  date: string;
}

export interface GovtSrc {
  overview?: CivicSrc | null;
  leaders?: CivicSrc | null;
  district?: CivicSrc | null;
  election?: CivicSrc | null;
  schemes?: CivicSrc | null;
  place?: string;
}

export interface Hospital {
  name: string;
  slug: string;
  type: string;
  district: string;
  address: string;
  phone: string;
  emergency24x7: boolean;
  specialities: string[];
  schemes: string[];
  website: string;
  mapUrl?: string;
  stars?: number | null; // old rows only; not shown (no AI ratings)
  note: string;
  // v2 (Worker CIVIC_SCHEMA.hosp = 2); missing / empty = no public source stated it
  timings?: string;
  specialFor?: string[]; // diseases / treatments a public source says it is a centre for
  facilities?: string[];
  doctors?: HospitalDoctor[]; // only doctors publicly listed, each with its source page
  sources?: string[];
  // Free-source rows (OpenStreetMap, origin 'free'): ownership as OSM tags it, coordinates, OSM page
  ownership?: 'govt' | 'private' | 'unknown';
  lat?: number | null;
  lon?: number | null;
  osmUrl?: string;
  src?: CivicSrc | null;
  origin?: 'free' | 'ai';
}

export interface HospitalDoctor {
  name: string;
  speciality: string;
  qualification: string;
  experience: string;
  source: string;
}

export interface HospData {
  asOf?: string;
  hospitals: Hospital[];
  origin?: 'free' | 'ai';
  src?: CivicSrc | null;
  // Level the list really covers: asked for a mandal with no hospital found there = the district's
  // list ('district'), district empty too = the state's ('state'). Missing = as asked.
  scope?: DataScope;
}

// Previous vs present government (facts only, every point with source URL + date, no verdict)
export type CompareArea = 'schemes' | 'budget' | 'projects' | 'started' | 'stopped';
export const COMPARE_AREAS: CompareArea[] = ['schemes', 'budget', 'projects', 'started', 'stopped'];

export interface CompareFact {
  text: string;
  source: string;
  date: string;
}

export interface CompareGovt {
  label: string;
  head: string;
  party: string;
  from: string;
  to: string;
  source: string;
}

export interface CompareData {
  asOf?: string;
  previous: CompareGovt;
  present: CompareGovt;
  rows: { area: CompareArea; topic: string; previous: CompareFact | null; present: CompareFact | null }[];
}

// Promises tracker (kind 'gprm'): the present government's manifesto promises. A status other than
// no_update always has a neutral fact + https source + date (the Worker forces no_update otherwise);
// summary counts are computed by the Worker's cleaner.
export type PromiseStatus = 'done' | 'in_progress' | 'not_done' | 'no_update';
export const PROMISE_STATUSES: PromiseStatus[] = ['done', 'in_progress', 'not_done', 'no_update'];
export type PromiseArea = 'welfare' | 'farmers' | 'women' | 'youth' | 'health' | 'education' | 'infrastructure' | 'other';

export interface PromiseItem {
  area: PromiseArea;
  text: string;
  status: PromiseStatus;
  fact: string;
  source: string;
  date: string;
  // where the promise itself is stated (its cited source, else the manifesto) + that date
  ref?: string;
  refDate?: string;
}

export interface PromisesData {
  asOf?: string;
  // 'free' = read from Wikipedia's election article (Gemini free quota used up); statuses stay "no update"
  origin?: 'free';
  govt: { party: string; head: string; year: string; term: string; source: string };
  promises: PromiseItem[];
  summary: { total: number; done: number; inProgress: number; notDone: number; noUpdate: number };
}

// Translated languages (every app language but English; same codes as the Worker's TR_LANGS)
export type TrCode = 'te' | 'hi' | 'ta' | 'kn' | 'ml' | 'mr' | 'bn' | 'gu' | 'pa' | 'or' | 'ur';

export interface CivicDataResponse<T> {
  kind: CivicKind;
  state: string;
  district: string;
  mandal?: string; // echoed by Workers that take the mandal param
  variant: string;
  data: T | null;
  i18n?: Partial<Record<TrCode, T | null>>;
  sources?: { url: string; title: string }[];
  aiStars: number | null;
  // 'partial' = a Govt place's first research is still running: data holds the parts finished so far
  // (poll for the rest). 'translating' = English only for the asked language, its copy is on the way.
  status: 'ok' | 'ready' | 'error' | 'pending' | 'none' | 'partial' | 'translating';
  running?: boolean;
  updatedAt: number;
  // Ask AI / Explain simply / translation work (any provider of the Worker's AI fallback chain)
  aiConfigured: boolean;
  // Research of a new place works (grounded Gemini). Older Workers do not send it: use aiConfigured.
  researchConfigured?: boolean;
  // Govt / Hospitals come from free, keyless sources (Wikidata, Wikipedia, OpenStreetMap): research
  // never needs an AI key and is never 'paused' for AI limits
  freeSources?: boolean;
  // Which source answered the stored data: free public sources, Gemini, Groq, Workers AI
  answeredBy?: AnsweredBy;
}

export type AnsweredBy = 'free' | 'gemini' | 'groq' | 'workers-ai' | 'saved';

// Short reason when an AI step failed: quota (free-tier limit, 429), billing (402), cap (daily cap),
// timeout, config (no key on the Worker)
export type CivicAiCode = 'quota' | 'billing' | 'cap' | 'timeout' | 'config' | 'key' | 'other';

export interface CivicResearchResponse {
  ok: boolean;
  // 'translating' = translation started in the background (English shows meanwhile; poll for it)
  // 'ready' = free-source research finished (origin 'free'): the data is saved, read it now
  // 'saved' = every live source failed (Gemini keys, free sources, Groq): the last saved data stands
  // 'none' = every source failed and nothing is saved yet ("no data yet")
  // 'paused' = only from Workers deployed before the never-stop chain (treated like 'saved')
  status: 'ok' | 'ready' | 'error' | 'pending' | 'running' | 'ai_off' | 'paused' | 'saved' | 'none' | 'translating';
  paused?: boolean;
  origin?: 'free' | 'ai' | 'groq' | 'saved';
  translating?: boolean; // the asked language's translation started in the background
  did?: 'research' | 'translate' | 'nothing' | 'already running';
  error?: string;
  code?: CivicAiCode;
  translated?: TrCode[];
}

export interface CivicReview {
  item: string;
  author: string;
  stars: number;
  body: string;
  photo: string | null;
  userName: string;
  createdAt: number;
  updatedAt: number;
  hidden?: boolean;
  reportCount?: number;
}

export interface CivicReviewsResponse {
  item: string;
  count: number;
  avg: number | null;
  reviews: CivicReview[];
  mine: CivicReview | null;
}

// Same rules as normDistrict() in the Worker
export const districtSlug = (v?: string | null): string =>
  String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

// 'govt:TG', 'govt:TG:hyderabad', 'hosp:TG:hyderabad:nims' (state-level hospital: 'hosp:TG::nims' is
// not allowed, so a state-level hospital uses district 'state')
export const civicItem = (kind: CivicKind, state: string, district?: string | null, place?: string | null): string => {
  const d = districtSlug(district);
  const p = districtSlug(place);
  if (kind === 'hosp' && p) return `hosp:${state}:${d || 'state'}:${p}`;
  return d ? `${kind}:${state}:${d}` : `${kind}:${state}`;
};

const q = (o: Record<string, string>) =>
  Object.entries(o)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

// lang: also return that language's translated copy in i18n (any TrCode)
const withLang = (o: Record<string, string>, lang?: TrCode | null) => (lang ? { ...o, lang } : o);

// mandal (sub-district name, LGD): only sent when picked (and only with a district)
const withMandal = (o: Record<string, string>, mandal?: string | null) => (mandal && o.district ? { ...o, mandal: districtSlug(mandal) } : o);

export const getGovtData = (state: string, district?: string, lang?: TrCode | null, mandal?: string | null) =>
  workerFetch<CivicDataResponse<GovtData>>(`/v1/civic/data?${q(withLang(withMandal({ kind: 'govt', state, district: districtSlug(district), variant: '' }, mandal), lang))}`);

export const getHospData = (state: string, variant: HospVariant, district?: string, lang?: TrCode | null, mandal?: string | null) =>
  workerFetch<CivicDataResponse<HospData>>(`/v1/civic/data?${q(withLang(withMandal({ kind: 'hosp', state, district: districtSlug(district), variant }, mandal), lang))}`);

// state = a state code, or CENTRE_CODE ('IN') for the Union Government
export const getCompareData = (state: string, lang?: TrCode | null) =>
  workerFetch<CivicDataResponse<CompareData>>(`/v1/civic/data?${q(withLang({ kind: 'gcmp', state, district: '', variant: '' }, lang))}`);

// Promises tracker for a state code or CENTRE_CODE ('IN')
export const getPromisesData = (state: string, lang?: TrCode | null) =>
  workerFetch<CivicDataResponse<PromisesData>>(`/v1/civic/data?${q(withLang({ kind: 'gprm', state, district: '', variant: '' }, lang))}`);

// On demand: research this place now (no data yet; translated into lang in the same run) or
// translate it into lang. Grounded research takes seconds, so a timeout well above that; the screen
// keeps showing saved / cached info (or "collecting") meanwhile and polls.
export const researchCivic = (kind: CivicKind, state: string, district: string | undefined, variant: string, lang?: TrCode | null, mandal?: string | null) =>
  workerFetch<CivicResearchResponse>('/v1/civic/research', {
    method: 'POST',
    body: withMandal({ kind, state, district: districtSlug(district), variant, lang: lang || '' }, mandal),
    timeoutMs: 90000,
  });

// ── Civic AI (Worker /v1/civic/ask): answers only from stored / app data ──
export type AskTopic = 'laws' | 'govt' | 'hosp';
export type GovtFocus = 'schemes' | 'grievance' | 'services' | 'offices' | 'departments' | 'helplines' | 'overview';

export interface CivicAskRequest {
  topic: AskTopic;
  lang: string; // 'en' or a TrCode
  question?: string;
  history?: { role: 'user' | 'model'; text: string }[];
  state?: string;
  district?: string;
  variants?: HospVariant[];
  focus?: GovtFocus;
  context?: string; // laws: the app's own law sections
}

export interface CivicAskResponse {
  topic: AskTopic;
  lang: string;
  answer: string; // in the asked language (ends with the safety line)
  en: string; // the same answer in English ('' when the asked language is English)
  cached?: boolean;
}

export const askCivic = (r: CivicAskRequest) =>
  workerFetch<CivicAskResponse>('/v1/civic/ask', {
    method: 'POST',
    body: { ...r, district: districtSlug(r.district) },
    timeoutMs: 45000,
  });

// AI translation of app text without a static copy (cached on the Worker per English text)
export type TrNamespace = 'labels' | 'laws' | 'guide';
export const translateCivicTexts = (ns: TrNamespace, lang: TrCode, items: Record<string, string>) =>
  workerFetch<{ items: Record<string, string>; missing: string[]; busy?: boolean; aiError?: CivicAiCode }>('/v1/civic/translate', {
    method: 'POST',
    body: { ns, lang, items },
    timeoutMs: 45000,
  });

export const getReviews = (item: string, limit = 20) => workerFetch<CivicReviewsResponse>(`/v1/civic/reviews?${q({ item, limit: String(limit) })}`);

export const postReview = (item: string, stars: number, body: string, userName?: string, photo?: string | null) =>
  workerFetch<{ ok: boolean; review: CivicReview }>('/v1/civic/reviews', { method: 'POST', body: { item, stars, body, userName, photo: photo || undefined } });

export const reportReview = (item: string, author: string, reason = '') =>
  workerFetch<{ ok: boolean; alreadyReported: boolean }>('/v1/civic/reports', { method: 'POST', body: { item, author, reason } });

// ── Owner only (Worker checks the verified owner email too) ──
// AI fallback chain state on the Worker (no key values): Gemini keys -> Groq -> Workers AI
export interface AiProviders {
  order: string[];
  gemini: { keys: number; ready: number; keyState: { key: number; ready: boolean; coolingUntil: number }[] };
  groq: { configured: boolean; coolingUntil: number };
  workersAi: { configured: boolean; model: string; coolingUntil: number };
}

export interface AdminCivic {
  aiConfigured: boolean;
  aiProviders?: AiProviders;
  aiToday: number;
  aiDailyMax: number;
  trToday?: number;
  trDailyMax?: number;
  data: { kind: string; status: string; count: number; oldest: number }[];
  errors: { kind: string; state: string; district: string; variant: string; error: string; updatedAt: number }[];
  reported: CivicReview[];
  recent: CivicReview[];
  at: number;
}

export const getAdminCivic = () => workerFetch<AdminCivic>('/v1/admin/civic');

export const setReviewHidden = (item: string, uid: string, hidden: boolean) =>
  workerFetch<{ ok: boolean }>('/v1/admin/civic/review', { method: 'POST', body: { item, uid, hidden } });

export const refreshCivic = (kind: CivicKind, state: string, district = '', variant = '') =>
  workerFetch<{ ok: boolean; error?: string }>('/v1/admin/civic/refresh', {
    method: 'POST',
    body: { kind, state, district: districtSlug(district), variant },
    timeoutMs: 90000,
  });
