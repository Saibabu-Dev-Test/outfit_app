// Data backend fallback (FREE tiers only): Firestore first, Cloudflare D1 (through the Worker
// 'outfit-api', server/worker) when Firestore's Spark daily quota runs out or nears SWITCH_AT.
// Firebase Auth stays the login: the Worker checks the Firebase ID token on every call.
// Keep the numbers equal to server/worker/src/config.js (__tests__/apiWorker.test.ts checks).
//
// Day boundaries: Firestore's free quota resets at midnight US Pacific time, D1's at 00:00 UTC.

// Public URL of the Worker (not a secret)
export const WORKER_URL = 'https://outfit-api.babusai927.workers.dev';

// Firestore Spark plan, per day
export const FIRESTORE_FREE = { reads: 50000, writes: 20000, deletes: 20000, storageBytes: 1024 * 1024 * 1024 };
// Cloudflare D1 free plan
export const D1_FREE = { reads: 5000000, writes: 100000, storageBytes: 5 * 1000 * 1000 * 1000 };

// Switch to D1 at 95% of Firestore's daily quota (same idea as photo storage SWITCH_AT)
export const BACKEND_SWITCH_AT = 0.95;

// The app sends its own Firestore op counts to the Worker in batches (no Firestore write for this)
export const USAGE_FLUSH_OPS = 50;
export const USAGE_FLUSH_MS = 60 * 1000;
// How long a /v1/status answer is trusted on the phone
export const STATUS_TTL_MS = 5 * 60 * 1000;

export type DataBackend = 'firestore' | 'd1';

// Ids of documents that live in D1 (the Worker makes them)
export const D1_ID_PREFIX = 'd1_';
export const isD1Id = (id?: string | null): boolean => !!id && id.startsWith(D1_ID_PREFIX);
