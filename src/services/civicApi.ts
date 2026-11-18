// Govt / Hospitals tabs data from the Worker (server/worker/src/civic/routes.js). Pure helpers
// (item keys, district slug) are tested in __tests__/civicWorker.test.ts.
import { workerFetch } from './workerApi';

// gcmp = neutral previous vs present government comparison (state code or 'IN' for the centre)
export type CivicKind = 'govt' | 'hosp' | 'gcmp';
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

export type TrCode = 'te' | 'hi';

export interface CivicDataResponse<T> {
  kind: CivicKind;
  state: string;
  district: string;
  variant: string;
  data: T | null;
  i18n?: { te: T | null; hi: T | null };
  sources?: { url: string; title: string }[];
  aiStars: number | null;
  status: 'ok' | 'error' | 'pending' | 'none';
  running?: boolean;
  updatedAt: number;
  aiConfigured: boolean;
}

export interface CivicResearchResponse {
  ok: boolean;
  status: 'ok' | 'error' | 'pending' | 'running' | 'ai_off';
  did?: 'research' | 'translate' | 'nothing' | 'already running';
  error?: string;
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

export const getGovtData = (state: string, district?: string) =>
  workerFetch<CivicDataResponse<GovtData>>(`/v1/civic/data?${q({ kind: 'govt', state, district: districtSlug(district), variant: '' })}`);

export const getHospData = (state: string, variant: HospVariant, district?: string) =>
  workerFetch<CivicDataResponse<HospData>>(`/v1/civic/data?${q({ kind: 'hosp', state, district: districtSlug(district), variant })}`);

// state = a state code, or CENTRE_CODE ('IN') for the Union Government
export const getCompareData = (state: string) =>
  workerFetch<CivicDataResponse<CompareData>>(`/v1/civic/data?${q({ kind: 'gcmp', state, district: '', variant: '' })}`);

// On demand: research this place now (no data yet) or translate it into lang (te | hi). Slow
// (Gemini with Google Search), so a long timeout; the screen shows "collecting" meanwhile.
export const researchCivic = (kind: CivicKind, state: string, district: string | undefined, variant: string, lang?: TrCode | null) =>
  workerFetch<CivicResearchResponse>('/v1/civic/research', {
    method: 'POST',
    body: { kind, state, district: districtSlug(district), variant, lang: lang || '' },
    timeoutMs: 150000,
  });

export const getReviews = (item: string, limit = 20) => workerFetch<CivicReviewsResponse>(`/v1/civic/reviews?${q({ item, limit: String(limit) })}`);

export const postReview = (item: string, stars: number, body: string, userName?: string, photo?: string | null) =>
  workerFetch<{ ok: boolean; review: CivicReview }>('/v1/civic/reviews', { method: 'POST', body: { item, stars, body, userName, photo: photo || undefined } });

export const reportReview = (item: string, author: string, reason = '') =>
  workerFetch<{ ok: boolean; alreadyReported: boolean }>('/v1/civic/reports', { method: 'POST', body: { item, author, reason } });

// ── Owner only (Worker checks the verified owner email too) ──
export interface AdminCivic {
  aiConfigured: boolean;
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
