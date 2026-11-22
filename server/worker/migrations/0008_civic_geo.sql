-- Civic tabs served from FREE, keyless sources (civic/free: Wikidata, Wikipedia, OpenStreetMap
-- Nominatim + Overpass). Additive only: no existing row, column or value is removed or changed.
--
-- civic_geo: Nominatim district (or state) lookup cache, so the hospitals fast path skips the area
--   lookup (one request less, inside Nominatim's 1 request / second policy) on every later visit.
--   place = '<STATE>|<district slug>' ('AP|kurnool'; 'AP|' = the whole state).
--   bbox = JSON {south, north, west, east}; lat / lon = its centre; label = Nominatim display name.
--   overpass_at / overpass_status: last background Overpass upgrade of this place's hospital lists
--   (ctx.waitUntil after the first load, then a gentle cron refresh), never on the request path.
CREATE TABLE IF NOT EXISTS civic_geo (
  place TEXT PRIMARY KEY,
  label TEXT,
  bbox TEXT,
  lat REAL,
  lon REAL,
  fetched_at INTEGER NOT NULL,
  overpass_at INTEGER,
  overpass_status TEXT
);
CREATE INDEX IF NOT EXISTS civic_geo_overpass ON civic_geo (overpass_at);

-- civic_data.origin: where a row's English data came from. 'free' = the free sources above (no AI),
--   'ai' = grounded Gemini research. NULL = saved before this migration (AI research).
-- civic_data.free_at: ms of the last free-source fetch of the row (cron refresh picks the oldest).
-- The free Govt governors list (one Wikipedia section for all states / UTs) is cached in
-- civic_text_cache (ns 'free_gov', lang 'en', h 'state' | 'ut'), no new table needed.
ALTER TABLE civic_data ADD COLUMN origin TEXT;
ALTER TABLE civic_data ADD COLUMN free_at INTEGER;
CREATE INDEX IF NOT EXISTS civic_data_free ON civic_data (origin, free_at);
