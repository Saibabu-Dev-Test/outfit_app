// Calls to the Worker 'outfit-api' (config/backend.ts WORKER_URL) with the signed-in user's
// Firebase ID token. Throws WorkerError (status 0 = network / timeout).
import { auth } from '../config/firebaseConfig';
import { WORKER_URL } from '../config/backend';

export class WorkerError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const workerFetch = async <T = any>(
  path: string,
  init: { method?: string; body?: any; auth?: boolean; timeoutMs?: number } = {},
): Promise<T> => {
  const headers: Record<string, string> = {};
  if (init.auth !== false) {
    const token = await auth?.currentUser?.getIdToken();
    if (!token) throw new WorkerError(401, 'Please sign in again.');
    headers.Authorization = `Bearer ${token}`;
  }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), init.timeoutMs ?? 15000);
  try {
    let r: Response;
    try {
      r = await fetch(`${WORKER_URL}${path}`, {
        method: init.method || 'GET',
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: ctl.signal,
      });
    } catch (e: any) {
      throw new WorkerError(0, e?.name === 'AbortError' ? 'Server timed out.' : 'No connection to the server.');
    }
    const text = await r.text();
    let j: any = null;
    try {
      j = text ? JSON.parse(text) : null;
    } catch {
      j = { raw: text };
    }
    if (!r.ok) throw new WorkerError(r.status, j?.error || `HTTP ${r.status}`);
    return j as T;
  } finally {
    clearTimeout(t);
  }
};

// GET /health (no sign-in): ok + round-trip time
export const pingWorker = async (): Promise<{ ok: boolean; ms: number; version: string | null; d1: boolean; error?: string }> => {
  const t0 = Date.now();
  try {
    const j = await workerFetch<any>('/health', { auth: false, timeoutMs: 8000 });
    return { ok: !!j?.ok, ms: Date.now() - t0, version: j?.version || null, d1: !!j?.d1 };
  } catch (e: any) {
    return { ok: false, ms: Date.now() - t0, version: null, d1: false, error: e?.message || 'unreachable' };
  }
};
