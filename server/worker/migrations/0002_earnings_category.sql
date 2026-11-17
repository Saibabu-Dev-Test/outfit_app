-- Earn ledger reporting fields (owner's Admin tracking > Earnings). Additive only: old rows keep
-- NULLs and the report falls back to `type` (survey | offer) and rupees + owner_rupees.
--   category       what the partner says the task was: survey | offer | game | quiz | receipt | other
--   task_name      the partner's offer / task name when it sends one (Offerwall.GG offerName,
--                  BitLabs [%OFFER:NAME%]); reporting only, never used for money
--   payout_rupees  the full partner payout in rupees (user share + owner share)
ALTER TABLE earnings ADD COLUMN category TEXT;
ALTER TABLE earnings ADD COLUMN task_name TEXT;
ALTER TABLE earnings ADD COLUMN payout_rupees REAL;
CREATE INDEX IF NOT EXISTS earnings_created ON earnings (created_at DESC);
