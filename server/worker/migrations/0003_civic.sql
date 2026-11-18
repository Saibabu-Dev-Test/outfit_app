-- Civic tabs (Govt, Hospitals; more kinds can be added without a new table). Additive only.
--
-- civic_data: ONE final AI-researched summary per (kind, state, district, variant), replaced on each
--   refresh. kind: 'govt' | 'hosp'. district '' = state level. variant: '' for govt,
--   'govt' | 'private' for hospitals. data = JSON shown to users. sources = JSON list of public URLs
--   the research used (owner only, never sent to normal users).
CREATE TABLE IF NOT EXISTS civic_data (
  kind TEXT NOT NULL,
  state TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT '',
  variant TEXT NOT NULL DEFAULT '',
  data TEXT,
  sources TEXT,
  ai_stars REAL,
  status TEXT NOT NULL DEFAULT 'ok',   -- ok | error
  error TEXT,
  model TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (kind, state, district, variant)
);
CREATE INDEX IF NOT EXISTS civic_data_age ON civic_data (kind, district, updated_at);

-- User star ratings + written opinions, one per user per item (item key, e.g. 'govt:TG',
-- 'govt:TG:dept:health', 'hosp:TG:hyderabad:nims'). photo = data URI or https URL (optional).
CREATE TABLE IF NOT EXISTS civic_reviews (
  item TEXT NOT NULL,
  uid TEXT NOT NULL,
  kind TEXT NOT NULL,
  state TEXT,
  district TEXT,
  place TEXT,
  stars INTEGER NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  photo TEXT,
  user_name TEXT,
  hidden INTEGER NOT NULL DEFAULT 0,   -- 1 = hidden by the owner (moderation)
  report_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (item, uid)
);
CREATE INDEX IF NOT EXISTS civic_reviews_item ON civic_reviews (item, hidden, updated_at DESC);
CREATE INDEX IF NOT EXISTS civic_reviews_reported ON civic_reviews (report_count DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS civic_reviews_recent ON civic_reviews (updated_at DESC);

-- One report per reporter per review
CREATE TABLE IF NOT EXISTS civic_reports (
  item TEXT NOT NULL,
  author TEXT NOT NULL,
  reporter TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (item, author, reporter)
);
