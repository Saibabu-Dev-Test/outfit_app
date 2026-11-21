-- AI fallback chain (civic/aiCooldown.js): remembers an AI key / model / provider that ran out of
-- free quota so the Worker skips it until it resets instead of hitting it again on every call.
-- Additive only. One small row per cooling key+model (a few dozen rows at most); rows whose
-- `until` has passed are ignored and overwritten. `id` never contains a key, only a short hash:
--   gemini:<md5(key) first 12 hex>:<model or *>   groq:<model or *>   workers-ai:*
-- until: epoch ms the cool-down ends. reason: 'daily' | 'minute' | 'billing' | 'key' | 'model'.
CREATE TABLE IF NOT EXISTS ai_cooldown (
  id TEXT PRIMARY KEY,
  until INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
