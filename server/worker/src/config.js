// Numbers shared with the app. Keep in step with:
//   src/config/backend.ts   FIRESTORE_FREE / D1_FREE / BACKEND_SWITCH_AT
//   src/config/coins.ts     COIN_POINTS
//   src/config/owner.ts     OWNER_EMAILS (and isOwner() in firestore.rules)
// __tests__/apiWorker.test.ts checks they match.
export const PROJECT_ID = 'outfit-vote-9edca';
export const OWNER_EMAILS = ['2saibabug@gmail.com', 'saibabu8870@gmail.com'];

// Firestore Spark plan, per day (resets at midnight Pacific)
export const FIRESTORE_FREE = { reads: 50000, writes: 20000, deletes: 20000, storageBytes: 1024 * 1024 * 1024 };
// Cloudflare D1 free plan
export const D1_FREE = { reads: 5000000, writes: 100000, storageBytes: 5 * 1000 * 1000 * 1000 };
// Switch to D1 at 95% of Firestore's free daily quota (same idea as photo storage SWITCH_AT)
export const BACKEND_SWITCH_AT = 0.95;

export const COIN_POINTS = { like: 1, upload: 10, share: 50, task: 100, vote: 1 };
export const MAX_COIN_EVENTS_PER_DAY = 300; // per user, D1 fallback only
export const MAX_POSTS_PER_DAY = 20; // per user, D1 fallback only
export const MAX_POST_CHARS = 1500000; // D1 rows are capped at 2 MB
export const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
// Per call from one phone (app batches its own Firestore op counts)
export const MAX_USAGE_PER_CALL = 5000;

export const WORKER_VERSION = '1.3.0'; // 1.3.0: civic total info (leaders, MPs/MLAs, offices, grievance, election), sources + TE/HI copies (migration 0004), on-demand POST /v1/civic/research. 1.2.0: civic tabs (/v1/civic, migration 0003, 2-hourly research cron). 1.1.0: /v1/admin/earnings + earn category / task name / payout (migration 0002)
