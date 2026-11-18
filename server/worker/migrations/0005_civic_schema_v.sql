-- Civic tabs: data-shape version per civic_data row. Additive only: no row, column or value is
-- removed or changed. Rows saved before this migration get 1. When a kind's shape grows (hospitals
-- v2: timings, special-for diseases, publicly listed doctors, facilities, per-hospital source URLs),
-- the capped research cron re-researches rows with an older version; until then the old data keeps
-- showing. New kind 'gcmp' (previous vs present government) uses the same table (no change needed).
ALTER TABLE civic_data ADD COLUMN schema_v INTEGER NOT NULL DEFAULT 1;
