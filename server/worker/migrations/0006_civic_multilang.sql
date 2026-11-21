-- Civic tabs in 12 app languages + cached AI text. Additive only: no existing row, column or value is
-- removed or changed (civic_data.i18n keeps the old Telugu / Hindi copies and is still read).
--
-- civic_i18n: one translated copy per (kind, state, district, variant, lang), same JSON shape as
--   civic_data.data with only the text translated (URLs, phones, dates copied from English). One row
--   per language keeps every row small (12 languages in one column could pass D1's row size limit).
--   lang: te hi ta kn ml mr bn gu pa or ur. Dropped when the English data is re-researched.
CREATE TABLE IF NOT EXISTS civic_i18n (
  kind TEXT NOT NULL,
  state TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT '',
  variant TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (kind, state, district, variant, lang)
);

-- civic_text_cache: AI text shared by every user, keyed by a hash of its input so nobody can change
-- what another user sees:
--   ns 'labels' / 'laws' / 'guide': translation of one English string (h = md5 of the English text)
--   ns 'explain': "Explain simply" answer for a stored civic row (h = md5 of row + focus + data time)
CREATE TABLE IF NOT EXISTS civic_text_cache (
  ns TEXT NOT NULL,
  lang TEXT NOT NULL,
  h TEXT NOT NULL,
  text TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (ns, lang, h)
);
