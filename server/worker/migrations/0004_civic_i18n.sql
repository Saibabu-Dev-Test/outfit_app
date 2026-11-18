-- Civic tabs: Telugu / Hindi copies of each researched summary + a run lock for on-demand research.
-- Additive only (existing rows keep working; i18n NULL = English only until translated).
--   i18n       JSON {"te": <same shape as data, text fields translated>, "hi": {...}}
--   running_at ms when an on-demand / cron research started (lock, ignored after 3 minutes)
ALTER TABLE civic_data ADD COLUMN i18n TEXT;
ALTER TABLE civic_data ADD COLUMN running_at INTEGER;
