-- outfit-db (Cloudflare D1, free plan: 5M rows read/day, 100k rows written/day, 5 GB).
-- Fallback store for the high-volume data when Firestore's Spark daily quota runs out, plus the
-- server-only earn ledger written by the partner postbacks. Apply with:
--   npx wrangler d1 migrations apply outfit-db --remote   (from server/worker)
-- Times are Unix milliseconds. Day keys: 'YYYY-MM-DD' (see src/days.js for which time zone).

-- Feed posts created while the app runs on D1. Ids start with 'd1_' so the app knows where they live.
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT,
  user_avatar TEXT,
  user_age INTEGER,
  caption TEXT NOT NULL DEFAULT '',
  photos TEXT NOT NULL,            -- JSON array of thumbnails (A..F)
  clear TEXT,                      -- JSON array of ~720 px feed copies, or NULL
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS posts_created ON posts (deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_user ON posts (user_id, created_at DESC);

-- A/B/C... votes on multi-photo posts (Firestore posts or D1 posts), one row per voter.
CREATE TABLE IF NOT EXISTS votes (
  post_id TEXT NOT NULL,
  uid TEXT NOT NULL,
  option TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, uid)
);

-- Coin events (same ids and points as users/{uid}/coinEvents), create-only.
CREATE TABLE IF NOT EXISTS coin_events (
  uid TEXT NOT NULL,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  points INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (uid, id)
);
CREATE INDEX IF NOT EXISTS coin_events_day ON coin_events (uid, created_at);

-- Earn ledger: written ONLY by the Worker (partner postbacks, daily release). Never by the app.
CREATE TABLE IF NOT EXISTS earnings (
  uid TEXT NOT NULL,
  id TEXT NOT NULL,                -- bitlabs_<tx> | cpx_<trans_id> | offerwall_<tx>
  type TEXT NOT NULL,              -- survey | offer
  partner TEXT NOT NULL,
  status TEXT NOT NULL,            -- pending | approved | reversed
  coins INTEGER NOT NULL DEFAULT 0,
  rupees REAL NOT NULL DEFAULT 0,
  owner_rupees REAL NOT NULL DEFAULT 0,
  usd REAL,
  activity TEXT,
  reconciliation_tx TEXT,
  hold_until INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (uid, id)
);
CREATE INDEX IF NOT EXISTS earnings_status ON earnings (status, hold_until);
CREATE INDEX IF NOT EXISTS earnings_partner ON earnings (partner, status);

-- Daily counters: d1_reads / d1_writes (UTC day), fs_reads / fs_writes / fs_exhausted (Pacific day),
-- postback:<partner>:<outcome> (India day).
CREATE TABLE IF NOT EXISTS usage (
  day TEXT NOT NULL,
  key TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, key)
);

-- Users seen by the Worker per India day (one row per user per day).
CREATE TABLE IF NOT EXISTS active_users (
  day TEXT NOT NULL,
  uid TEXT NOT NULL,
  PRIMARY KEY (day, uid)
);
