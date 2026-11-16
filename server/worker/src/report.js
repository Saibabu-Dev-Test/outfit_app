// Reporting helpers for the earn ledger (owner's Admin tracking > Earnings). Pure, no I/O.
// ── Reporting fields (owner's Admin tracking > Earnings) ──
// category = what the partner says the task was. Taken from an explicit callback param when the
// partner (or the owner, in the partner's callback URL) sends one: cat | category | offer_type |
// offerType | task_type. Unknown words map to 'other'; no hint at all = null (report uses `type`).
export const CATEGORIES = ['survey', 'offer', 'game', 'quiz', 'receipt', 'other'];
export function categoryOf(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) {
    return null;
  }
  if (/survey/.test(s)) {
    return 'survey';
  }
  if (/game|gaming/.test(s)) {
    return 'game';
  }
  if (/quiz|trivia|\btests?\b/.test(s)) {
    return 'quiz';
  }
  if (/receipt/.test(s)) {
    return 'receipt';
  }
  if (/offer|app|install|signup|sign_up|register|cpi|cpe|cpa|deposit|purchase/.test(s)) {
    return 'offer';
  }
  return 'other';
}
export const CATEGORY_PARAMS = ['cat', 'category', 'offer_type', 'offerType', 'task_type', 'kind'];

// Partner task name, for the owner's report only (never trusted for money): printable, <= 80 chars
export const cleanTaskName = v => {
  const s = Array.from(String(v || ''), ch => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return s ? s.slice(0, 80) : null;
};

// BitLabs: explicit cat= wins; otherwise offer-only macros (offer_id / offer_name / task_name /
// task_type_name) mean an offer or game task, survey-only macros (survey_id / loi / survey_reason)
// mean a survey. Nothing to go on = null.
export function bitlabsCategory(q = {}) {
  for (const n of CATEGORY_PARAMS) {
    if (q[n]) {
      return categoryOf(q[n]);
    }
  }
  const typeName = String(q.task_type_name || q.offer_task_type || '');
  if (typeName) {
    return categoryOf(typeName) === 'other' ? 'offer' : categoryOf(typeName);
  }
  if (q.offer_id || q.offer_name || q.task_name || q.task_id) {
    return 'offer';
  }
  if (q.survey_id || q.loi || q.survey_reason) {
    return 'survey';
  }
  return null;
}

export const bitlabsTaskName = (q = {}) => cleanTaskName([q.offer_name, q.task_name].filter(Boolean).join(' · '));

// Start of the India day / month (UTC ms) for "today" and "this month" totals
const IST_MS = 330 * 60000;
export const istDayStartMs = now => {
  const t = now + IST_MS;
  return t - (t % 86400000) - IST_MS;
};
export const istMonthStartMs = now => {
  const d = new Date(now + IST_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - IST_MS;
};

// Short user id for the owner's list (never the full uid)
export const shortUid = uid => {
  const s = String(uid || '');
  return s.length <= 6 ? s : `${s.slice(0, 6)}…`;
};
