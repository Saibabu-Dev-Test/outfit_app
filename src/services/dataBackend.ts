// Firestore first, D1 (Worker) as the free fallback. Same pattern as photoStorage.ts:
//   - the backend switches to 'd1' when Firestore answers resource-exhausted / quota (markFirestoreFull)
//     or when today's Firestore usage counter reaches BACKEND_SWITCH_AT (95%) of the Spark quota;
//   - nothing is moved: Firestore docs stay where they are, D1 docs get 'd1_' ids, and reads merge
//     both, so old data still loads (and Firestore data comes back as soon as its quota resets).
// Usage counter: the wrapped feed / vote / coin calls count their own Firestore reads and writes
// (noteFirestore) and send them to the Worker in batches (POST /v1/usage, a D1 write, no Firestore
// write). It is an estimate of the app's main paths, not Google's billing number.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BACKEND_SWITCH_AT,
  DataBackend,
  FIRESTORE_FREE,
  STATUS_TTL_MS,
  USAGE_FLUSH_MS,
  USAGE_FLUSH_OPS,
} from '../config/backend';
import { isQuotaError } from './photoStorage';
import { workerFetch } from './workerApi';

export { isQuotaError };

export interface BackendStatus {
  backend: DataBackend;
  reason: string;
  firestore: { day: string; reads: number; writes: number; exhausted: boolean; limits: { reads: number; writes: number } };
  at: number;
}

const LOCAL_KEY = 'backend.firestoreFull.v1';

// Pacific date: Firestore's free quota resets at midnight Pacific
export const pacificDay = (d: Date = new Date()): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    // Intl without time zones: UTC-8 approximation
    return new Date(d.getTime() - 8 * 3600000).toISOString().slice(0, 10);
  }
};

let status: BackendStatus | null = null;
let statusAt = 0;
let localFullDay: string | null | undefined;
let pending = { reads: 0, writes: 0 };
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const loadLocalFull = async (): Promise<string | null> => {
  if (localFullDay !== undefined) return localFullDay;
  try {
    localFullDay = (await AsyncStorage.getItem(LOCAL_KEY)) || null;
  } catch {
    localFullDay = null;
  }
  return localFullDay;
};

// Pure decision (unit-tested): same thresholds as the Worker's backendFrom()
export const chooseBackend = (s: { reads: number; writes: number; exhausted: boolean } | null, localFull: boolean): DataBackend => {
  if (localFull) return 'd1';
  if (!s) return 'firestore';
  if (s.exhausted) return 'd1';
  if (s.reads >= FIRESTORE_FREE.reads * BACKEND_SWITCH_AT) return 'd1';
  if (s.writes >= FIRESTORE_FREE.writes * BACKEND_SWITCH_AT) return 'd1';
  return 'firestore';
};

export const getBackendStatus = async (force = false): Promise<BackendStatus | null> => {
  if (!force && status && Date.now() - statusAt < STATUS_TTL_MS) return status;
  try {
    status = await workerFetch<BackendStatus>('/v1/status', { timeoutMs: 8000 });
    statusAt = Date.now();
  } catch (e: any) {
    console.warn('backend status failed:', e?.message);
  }
  return status;
};

// Which backend new reads / writes should use right now. Never throws.
export const activeBackend = async (): Promise<DataBackend> => {
  const full = (await loadLocalFull()) === pacificDay();
  if (full) return 'd1';
  const s = await getBackendStatus();
  return chooseBackend(s ? s.firestore : null, false);
};

// Firestore has answered resource-exhausted today (here or on another phone): skip Firestore READS
// until the quota resets. (At 95% only new writes move to D1; old Firestore data keeps loading.)
export const firestoreExhausted = async (): Promise<boolean> => {
  if ((await loadLocalFull()) === pacificDay()) return true;
  const s = await getBackendStatus();
  return !!s?.firestore?.exhausted && s.firestore.day === pacificDay();
};

// Firestore said resource-exhausted: use D1 for the rest of the Pacific day (this phone + Worker)
export const markFirestoreFull = async (): Promise<void> => {
  const day = pacificDay();
  localFullDay = day;
  try {
    await AsyncStorage.setItem(LOCAL_KEY, day);
  } catch {}
  try {
    status = await workerFetch<BackendStatus>('/v1/backend/exhausted', { method: 'POST', body: {} });
    statusAt = Date.now();
  } catch {}
};

const flush = async () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const batch = pending;
  if (!batch.reads && !batch.writes) return;
  pending = { reads: 0, writes: 0 };
  try {
    status = await workerFetch<BackendStatus>('/v1/usage', { method: 'POST', body: batch, timeoutMs: 8000 });
    statusAt = Date.now();
  } catch {
    // Keep the counts for the next try
    pending = { reads: pending.reads + batch.reads, writes: pending.writes + batch.writes };
  }
};

// Count Firestore ops done by a wrapped call (reads = docs returned, min 1 per query)
export const noteFirestore = (reads: number, writes = 0): void => {
  pending = { reads: pending.reads + Math.max(0, Math.floor(reads) || 0), writes: pending.writes + Math.max(0, Math.floor(writes) || 0) };
  if (pending.reads + pending.writes >= USAGE_FLUSH_OPS) {
    flush();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flush, USAGE_FLUSH_MS);
  }
};

// Once per app start: "active today" for Admin > System + a fresh status. Never throws.
export const pingBackend = (): void => {
  workerFetch<BackendStatus>('/v1/usage', { method: 'POST', body: { reads: 0, writes: 0 }, timeoutMs: 8000 })
    .then(s => {
      status = s;
      statusAt = Date.now();
    })
    .catch(() => undefined);
};

// Run a Firestore call, or its D1 version when Firestore is out of quota.
//   fs()  must throw the Firestore error as is (so isQuotaError can see it)
//   d1()  the Worker version
// A quota error marks Firestore full for today and retries on D1. Other errors pass through.
export const withFallback = async <T>(fs: () => Promise<T>, d1: () => Promise<T>): Promise<T> => {
  if ((await activeBackend()) === 'd1') return d1();
  try {
    return await fs();
  } catch (e: any) {
    if (!isQuotaError(e)) throw e;
    console.warn('Firestore quota reached, switching to D1:', e?.code, e?.message);
    await markFirestoreFull();
    return d1();
  }
};

// Test hook
export const __resetBackend = () => {
  status = null;
  statusAt = 0;
  localFullDay = undefined;
  pending = { reads: 0, writes: 0 };
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
};
