// Civic AI research (Govt + Hospitals). Google-Search-grounded Gemini answers are cleaned to a
// fixed JSON shape and stored as ONE row per (kind, state, district, variant) in civic_data.
// Run by the `15 */2 * * *` cron with hard caps so the free Gemini tier and D1 stay safe:
//   CIVIC_PER_RUN items per cron run, CIVIC_DAILY_MAX items per UTC day (usage key 'civic_ai').
// Order: districts users asked for (status 'pending') -> state rows never researched ->
// stalest rows older than CIVIC_REFRESH_MS -> rows in error older than CIVIC_RETRY_MS.
import { STATES, stateByCode } from './states.js';
import { geminiGenerate, isGeminiConfigured, parseJsonLoose } from './gemini.js';
import { addUsage, usageFor } from '../db.js';
import { utcDay } from '../days.js';

export const CIVIC_PER_RUN = 3;
export const CIVIC_DAILY_MAX = 30;
export const CIVIC_REFRESH_MS = 7 * 24 * 3600 * 1000;
export const CIVIC_RETRY_MS = 6 * 3600 * 1000;
export const CIVIC_MAX_PENDING = 200;
export const KINDS = { govt: [''], hosp: ['govt', 'private'] };

const s = (v, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const url = v => (typeof v === 'string' && /^https:\/\/[^\s"'<>]{3,300}$/.test(v.trim()) ? v.trim() : '');
const phone = v => s(v, 40).replace(/[^0-9+\-/ ,]/g, '');
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
export const slugify = v =>
  String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
const stars = v => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? Math.round(n * 10) / 10 : null;
};

export function cleanGovt(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  return {
    overview: s(o.overview, 800),
    departments: arr(o.departments, 15).map(d => ({
      name: s(d && d.name, 120),
      what: s(d && d.what, 300),
      website: url(d && d.website),
      helpline: phone(d && d.helpline),
    })).filter(d => d.name),
    schemes: arr(o.schemes, 15).map(d => ({
      name: s(d && d.name, 120),
      who: s(d && d.who, 200),
      benefit: s(d && d.benefit, 300),
      apply: s(d && d.apply, 300),
      website: url(d && d.website),
    })).filter(d => d.name),
    services: arr(o.services, 15).map(d => ({ name: s(d && d.name, 120), how: s(d && d.how, 300), website: url(d && d.website) })).filter(d => d.name),
    helplines: arr(o.helplines, 15).map(d => ({ name: s(d && d.name, 80), number: phone(d && d.number) })).filter(d => d.name && d.number),
  };
}

export function cleanHosp(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const seen = new Set();
  const hospitals = arr(o.hospitals, 20)
    .map(h => ({
      name: s(h && h.name, 140),
      slug: slugify((h && h.slug) || (h && h.name)),
      type: s(h && h.type, 40),
      district: s(h && h.district, 60),
      address: s(h && h.address, 300),
      phone: phone(h && h.phone),
      emergency24x7: !!(h && h.emergency24x7 === true),
      specialities: arr(h && h.specialities, 12).map(x => s(x, 60)).filter(Boolean),
      schemes: arr(h && h.schemes, 8).map(x => s(x, 60)).filter(Boolean),
      website: url(h && h.website),
      stars: stars(h && h.stars),
      note: s(h && h.note, 300),
    }))
    .filter(h => h.name && h.slug && !seen.has(h.slug) && seen.add(h.slug));
  return { hospitals };
}

const placeName = (state, district) => `${district ? `${district} district, ` : ''}${state.name}, India`;

export function researchPrompt(kind, variant, state, district) {
  const where = placeName(state, district);
  if (kind === 'govt') {
    return [
      `Using Google Search, list factual, current public-service information for ${where}.`,
      'Only official government departments, welfare schemes, citizen services and helplines. No politics, no party names, no opinions, no ratings of politicians.',
      'Prefer official .gov.in / .nic.in sources. If unsure about a value, leave it empty instead of guessing.',
      'Reply with ONLY this JSON: {"overview":"2-3 neutral sentences","departments":[{"name":"","what":"","website":"https://","helpline":""}],',
      '"schemes":[{"name":"","who":"eligibility","benefit":"","apply":"how to apply","website":"https://"}],"services":[{"name":"","how":"","website":"https://"}],"helplines":[{"name":"","number":""}]}',
    ].join('\n');
  }
  const which = variant === 'govt' ? 'government (public) hospitals' : 'private hospitals';
  return [
    `Using Google Search, list up to 15 well-known ${which} in ${where}.`,
    'Facts only from public sources (official sites, government lists, public review averages). If unsure about a value, leave it empty instead of guessing. No medical advice.',
    'stars = public average rating 1-5 if clearly available, else null. schemes = government insurance accepted (e.g. PM-JAY / Ayushman Bharat, state schemes) only if confirmed.',
    'Reply with ONLY this JSON: {"hospitals":[{"name":"","type":"","district":"","address":"","phone":"","emergency24x7":true,"specialities":[""],"schemes":[""],"website":"https://","stars":null,"note":""}]}',
  ].join('\n');
}

export async function researchOne(db, env, { kind, state, district = '', variant = '' }, { fetchImpl = fetch, now = Date.now() } = {}) {
  const st = stateByCode(state);
  if (!st || !KINDS[kind] || !KINDS[kind].includes(variant)) {
    return { ok: false, error: 'bad target' };
  }
  const r = await geminiGenerate(env, { prompt: researchPrompt(kind, variant, st, district), grounded: true, maxTokens: 4096 }, { fetchImpl });
  await addUsage(db, utcDay(now), 'civic_ai', 1);
  let data = null;
  let error = r.ok ? '' : r.error;
  if (r.ok) {
    const parsed = parseJsonLoose(r.text);
    data = parsed ? (kind === 'govt' ? cleanGovt(parsed) : cleanHosp(parsed)) : null;
    if (!data || (kind === 'hosp' && !data.hospitals.length) || (kind === 'govt' && !data.overview && !data.departments.length)) {
      data = null;
      error = 'empty or unreadable answer';
    }
  }
  const aiStars =
    kind === 'hosp' && data
      ? (() => {
          const xs = data.hospitals.map(h => h.stars).filter(x => x !== null);
          return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
        })()
      : null;
  if (data) {
    await db.run(
      `INSERT INTO civic_data (kind, state, district, variant, data, sources, ai_stars, status, error, model, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ok', NULL, ?, ?)
       ON CONFLICT (kind, state, district, variant) DO UPDATE SET data = excluded.data, sources = excluded.sources,
         ai_stars = excluded.ai_stars, status = 'ok', error = NULL, model = excluded.model, updated_at = excluded.updated_at`,
      kind, state, district, variant, JSON.stringify(data), JSON.stringify(r.sources || []), aiStars, r.model, now,
    );
    return { ok: true, model: r.model };
  }
  // Keep the last good data; only mark the error
  await db.run(
    `INSERT INTO civic_data (kind, state, district, variant, status, error, updated_at) VALUES (?, ?, ?, ?, 'error', ?, ?)
     ON CONFLICT (kind, state, district, variant) DO UPDATE SET status = CASE WHEN civic_data.data IS NULL THEN 'error' ELSE civic_data.status END,
       error = excluded.error, updated_at = CASE WHEN civic_data.data IS NULL THEN excluded.updated_at ELSE civic_data.updated_at END`,
    kind, state, district, variant, String(error).slice(0, 300), now,
  );
  return { ok: false, error };
}

// Which targets the next run should research, best first (pure: tested)
export function pickTargets(rows, now, n) {
  const key = (k, st, d, v) => `${k}|${st}|${d}|${v}`;
  const byKey = new Map(rows.map(r => [key(r.kind, r.state, r.district || '', r.variant || ''), r]));
  const pending = rows.filter(r => r.status === 'pending').sort((a, b) => Number(a.updated_at) - Number(b.updated_at));
  const missing = [];
  STATES.forEach(st =>
    Object.entries(KINDS).forEach(([kind, variants]) =>
      variants.forEach(variant => {
        if (!byKey.has(key(kind, st.code, '', variant))) {
          missing.push({ kind, state: st.code, district: '', variant });
        }
      }),
    ),
  );
  const stale = rows
    .filter(
      r =>
        (r.status === 'ok' && now - Number(r.updated_at) > CIVIC_REFRESH_MS) ||
        (r.status === 'error' && now - Number(r.updated_at) > CIVIC_RETRY_MS),
    )
    .sort((a, b) => Number(a.updated_at) - Number(b.updated_at));
  const pick = r => ({ kind: r.kind, state: r.state, district: r.district || '', variant: r.variant || '' });
  return [...pending.map(pick), ...missing, ...stale.map(pick)].slice(0, Math.max(0, n));
}

export async function runCivicResearch(db, env, { fetchImpl = fetch, now = Date.now(), perRun = CIVIC_PER_RUN, dailyMax = CIVIC_DAILY_MAX } = {}) {
  if (!isGeminiConfigured(env)) {
    return { ran: 0, skipped: 'GEMINI_API_KEY not set' };
  }
  const used = (await usageFor(db, utcDay(now), ['civic_ai'])).civic_ai;
  const n = Math.min(perRun, dailyMax - used);
  if (n <= 0) {
    return { ran: 0, skipped: 'daily cap reached' };
  }
  const rows = await db.all('SELECT kind, state, district, variant, status, updated_at FROM civic_data');
  const targets = pickTargets(rows, now, n);
  const results = [];
  for (const t of targets) {
    results.push({ ...t, ...(await researchOne(db, env, t, { fetchImpl, now })) });
  }
  return { ran: results.length, results };
}
