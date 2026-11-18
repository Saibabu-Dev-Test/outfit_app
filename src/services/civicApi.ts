// Govt / Hospitals tabs data from the Worker (server/worker/src/civic/routes.js). Pure helpers
// (item keys, district slug) are tested in __tests__/civicWorker.test.ts.
import { workerFetch } from './workerApi';

export type CivicKind = 'govt' | 'hosp';
export type HospVariant = 'govt' | 'private';

export interface GovtData {
  overview: string;
  departments: { name: string; what: string; website: string; helpline: string }[];
  schemes: { name: string; who: string; benefit: string; apply: string; website: string }[];
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
  stars: number | null;
  note: string;
}

export interface HospData {
  hospitals: Hospital[];
}

export interface CivicDataResponse<T> {
  kind: CivicKind;
  state: string;
  district: string;
  variant: string;
  data: T | null;
  aiStars: number | null;
  status: 'ok' | 'error' | 'pending' | 'none';
  updatedAt: number;
  aiConfigured: boolean;
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
