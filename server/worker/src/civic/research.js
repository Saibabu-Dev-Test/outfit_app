// Civic AI research (Govt + Hospitals). Google-Search-grounded Gemini answers are cleaned to a
// fixed JSON shape and stored as ONE row per (kind, state, district, variant) in civic_data, with
// the grounding source URLs (shown in the app) and a Telugu + Hindi copy in civic_data.i18n
// (migration 0004). Neutral facts only: no AI ratings, no opinions.
// Run by the `15 */2 * * *` cron AND on demand (POST /v1/civic/research) with hard caps so the free
// Gemini tier and D1 stay safe:
//   CIVIC_PER_RUN items per cron run, CIVIC_DAILY_MAX researched items per UTC day (usage key
//   'civic_ai'), CIVIC_TR_DAILY_MAX translations per day ('civic_tr').
// Order: districts users asked for (status 'pending') -> state rows never researched ->
// stalest rows older than CIVIC_REFRESH_MS -> rows in error older than CIVIC_RETRY_MS.
import { STATES, stateByCode } from './states.js';
import { geminiGenerate, isGeminiConfigured, parseJsonLoose } from './gemini.js';
import { addUsage, usageFor } from '../db.js';
import { utcDay } from '../days.js';

export const CIVIC_PER_RUN = 2;
export const CIVIC_DAILY_MAX = 40;
export const CIVIC_TR_DAILY_MAX = 120;
export const CIVIC_REFRESH_MS = 7 * 24 * 3600 * 1000;
export const CIVIC_RETRY_MS = 20 * 60 * 1000;
export const CIVIC_LOCK_MS = 3 * 60 * 1000;
export const CIVIC_MAX_PENDING = 200;
export const KINDS = { govt: [''], hosp: ['govt', 'private'] };
export const TR_LANGS = { te: 'Telugu', hi: 'Hindi' };

const s = (v, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : typeof v === 'number' ? String(v) : '');
const url = v => (typeof v === 'string' && /^https:\/\/[^\s"'<>]{3,300}$/.test(v.trim()) ? v.trim() : '');
// A phone with letters in it is not trusted (dropped, never repaired into a different number)
const phone = v => {
  const p = s(v, 60);
  return /[a-z]/i.test(p) ? '' : p.replace(/[^0-9+\-/ ,]/g, '').trim();
};
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
export const slugify = v =>
  String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const person = p => ({ name: s(obj(p).name, 100), party: s(obj(p).party, 80), role: s(obj(p).role || obj(p).portfolio, 200) });
const rep = p => ({ name: s(obj(p).name, 100), constituency: s(obj(p).constituency, 100), party: s(obj(p).party, 80) });

export function cleanGovt(raw) {
  const o = obj(raw);
  const st = obj(o.state);
  const di = obj(o.district);
  const el = obj(o.election);
  return {
    asOf: s(o.asOf, 40),
    overview: s(o.overview, 1000),
    leaders: {
      governor: s(st.governor, 100),
      chiefMinister: person(st.chiefMinister),
      deputyCMs: arr(st.deputyCMs, 6).map(person).filter(p => p.name),
      ministers: arr(st.ministers, 40).map(person).filter(p => p.name),
    },
    district: {
      headquarters: s(di.headquarters, 100),
      collector: s(di.collector, 100),
      sp: s(di.sp, 100),
      policeCommissioner: s(di.policeCommissioner, 100),
      mps: arr(di.mps, 10).map(rep).filter(p => p.name),
      mlas: arr(di.mlas, 25).map(rep).filter(p => p.name),
    },
    offices: arr(o.offices, 25)
      .map(d => ({ name: s(obj(d).name, 140), what: s(obj(d).what, 300), address: s(obj(d).address, 300), phone: phone(obj(d).phone), website: url(obj(d).website) }))
      .filter(d => d.name),
    schemes: arr(o.schemes, 30)
      .map(d => ({
        name: s(obj(d).name, 140),
        level: /central/i.test(s(obj(d).level, 20)) ? 'central' : 'state',
        who: s(obj(d).who, 400),
        benefit: s(obj(d).benefit, 400),
        apply: s(obj(d).apply, 400),
        website: url(obj(d).website),
      }))
      .filter(d => d.name),
    grievance: arr(o.grievance, 15)
      .map(d => ({ name: s(obj(d).name, 140), how: s(obj(d).how, 400), phone: phone(obj(d).phone), website: url(obj(d).website) }))
      .filter(d => d.name),
    election: {
      lastAssembly: s(el.lastAssembly, 300),
      lastLokSabha: s(el.lastLokSabha, 300),
      next: s(el.next, 300),
      voterHelpline: phone(el.voterHelpline),
      ceoWebsite: url(el.ceoWebsite),
    },
    departments: arr(o.departments, 20)
      .map(d => ({ name: s(obj(d).name, 120), what: s(obj(d).what, 300), website: url(obj(d).website), helpline: phone(obj(d).helpline) }))
      .filter(d => d.name),
    services: arr(o.services, 15)
      .map(d => ({ name: s(obj(d).name, 120), how: s(obj(d).how, 300), website: url(obj(d).website) }))
      .filter(d => d.name),
    helplines: arr(o.helplines, 20)
      .map(d => ({ name: s(obj(d).name, 100), number: phone(obj(d).number) }))
      .filter(d => d.name && d.number),
  };
}

// Google Maps search link from the hospital's own name + address (a search, not a guessed place)
export const mapLink = (name, address, where) => {
  const q = [name, address, where].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q.slice(0, 250))}` : '';
};

export function cleanHosp(raw, where = '') {
  const o = obj(raw);
  const seen = new Set();
  const hospitals = arr(o.hospitals, 25)
    .map(h => {
      const x = obj(h);
      const name = s(x.name, 140);
      const address = s(x.address, 300);
      return {
        name,
        slug: slugify(x.slug || x.name),
        type: s(x.type, 60),
        district: s(x.district, 60),
        address,
        phone: phone(x.phone),
        emergency24x7: x.emergency24x7 === true,
        specialities: arr(x.specialities, 15).map(v => s(v, 60)).filter(Boolean),
        schemes: arr(x.schemes, 8).map(v => s(v, 80)).filter(Boolean),
        website: url(x.website),
        mapUrl: name ? mapLink(name, address, where) : '',
        note: s(x.note, 300),
      };
    })
    .filter(h => h.name && h.slug && !seen.has(h.slug) && seen.add(h.slug));
  return { asOf: s(o.asOf, 40), hospitals };
}

const placeName = (state, district) => `${district ? `${district.replace(/-/g, ' ')} district, ` : ''}${state.name}, India`;

const STATE_SCHEMES = {
  AP: 'Dr NTR Vaidya Seva (Aarogyasri AP)',
  TG: 'Aarogyasri (Telangana)',
};

export function researchPrompt(kind, variant, state, district) {
  const where = placeName(state, district);
  const today = new Date().toISOString().slice(0, 10);
  if (kind === 'govt') {
    return [
      `Today is ${today}. Using Google Search, collect current, factual public information for ${where}.`,
      'Neutral facts only: no opinions, no praise or criticism, no ratings. Party names only as plain facts next to each elected person.',
      'Prefer official sources (.gov.in, .nic.in, ap.gov.in style state portals, district NIC sites, ECI). Use the CURRENT office holders as of today.',
      'If you are not sure of a value (a name, a phone number, a website), leave it empty "" instead of guessing. Never invent phone numbers.',
      district
        ? `Include the state leaders AND the ${district.replace(/-/g, ' ')} district: District Collector, Superintendent of Police (or Commissioner of Police if a commissionerate), the Lok Sabha MP(s) whose constituency covers the district, and ALL MLAs of assembly constituencies in the district.`
        : 'District fields may stay empty (state-level summary).',
      'Schemes: the major state AND central welfare schemes people here use (health, pensions, farmers, housing, education, women, food), with eligibility and how to apply.',
      'Grievance: CM helpline / state grievance portal (for example PGRS / Meeseva / Spandana-type portals as they exist in this state now), CPGRAMS (pgportal.gov.in), and district grievance day details if found.',
      'Reply with ONLY this JSON (no markdown):',
      '{"asOf":"YYYY-MM","overview":"3-4 neutral sentences about the place (district HQ, population, main languages)",',
      '"state":{"governor":"","chiefMinister":{"name":"","party":""},"deputyCMs":[{"name":"","party":"","role":"portfolios"}],"ministers":[{"name":"","party":"","role":"portfolios"}]},',
      '"district":{"headquarters":"","collector":"","sp":"","policeCommissioner":"","mps":[{"name":"","constituency":"","party":""}],"mlas":[{"name":"","constituency":"","party":""}]},',
      '"offices":[{"name":"e.g. Collectorate, SP office, DMHO, RTO, municipal corporation","what":"","address":"","phone":"","website":"https://"}],',
      '"schemes":[{"name":"","level":"state|central","who":"eligibility","benefit":"","apply":"how to apply (office / portal / app)","website":"https://"}],',
      '"grievance":[{"name":"","how":"","phone":"","website":"https://"}],',
      '"election":{"lastAssembly":"year + result in one neutral line","lastLokSabha":"year + one neutral line","next":"when the next elections are due","voterHelpline":"1950","ceoWebsite":"https://"},',
      '"departments":[{"name":"","what":"","website":"https://","helpline":""}],"services":[{"name":"","how":"","website":"https://"}],"helplines":[{"name":"","number":""}]}',
    ].join('\n');
  }
  const which = variant === 'govt' ? 'government (public) hospitals (GGH / district hospital / area hospitals / CHCs / medical colleges / ESI)' : 'private hospitals (multi-speciality and well-known ones)';
  const stateScheme = STATE_SCHEMES[state.code] ? `${STATE_SCHEMES[state.code]}, ` : 'the state government health scheme, ';
  return [
    `Today is ${today}. Using Google Search, list up to 20 ${which} in ${where}.`,
    'Facts only from public sources (official hospital sites, government empanelment lists, NHA / state scheme portals, district sites).',
    'If you are not sure of a value, leave it empty "" (phone especially: NEVER invent or guess a phone number). No medical advice, no ratings.',
    `schemes = only schemes the hospital is confirmed empanelled in: ${stateScheme}PM-JAY / Ayushman Bharat, CGHS, ESI.`,
    'Reply with ONLY this JSON (no markdown): {"asOf":"YYYY-MM","hospitals":[{"name":"","type":"e.g. Government General Hospital / Private multi-speciality","district":"","address":"","phone":"","emergency24x7":true,"specialities":[""],"schemes":[""],"website":"https://","note":"one neutral line (beds, medical college, etc.)"}]}',
  ].join('\n');
}

// Text fields the translation keeps (everything else comes from the English row)
export function translatePrompt(kind, data, langName) {
  return [
    `Translate the text values of this JSON into simple, everyday ${langName} (native script).`,
    'Keep EXACTLY the same JSON keys, nesting, array order and array lengths. Transliterate names of people and places into the script.',
    'Do NOT translate or change: URLs, phone numbers, "level", "slug", booleans, numbers. Keep scheme / portal acronyms readable (e.g. "PM-JAY (ఆయుష్మాన్ భారత్)").',
    'Do not add or remove facts. Reply with ONLY the JSON.',
    JSON.stringify(data),
  ].join('\n');
}

const parseJsonCol = (v, dflt) => {
  try {
    return v ? JSON.parse(v) : dflt;
  } catch (e) {
    return dflt;
  }
};

const isEmpty = (kind, data) =>
  !data ||
  (kind === 'hosp' && !data.hospitals.length) ||
  (kind === 'govt' && !data.overview && !data.departments.length && !data.leaders.chiefMinister.name && !data.schemes.length);

const lockRow = async (db, t, now) => {
  // Insert a placeholder (pending) if needed, then take the lock only when free or stale
  await db.run(
    "INSERT OR IGNORE INTO civic_data (kind, state, district, variant, status, updated_at) VALUES (?, ?, ?, ?, 'pending', ?)",
    t.kind, t.state, t.district, t.variant, now,
  );
  const r = await db.run(
    'UPDATE civic_data SET running_at = ? WHERE kind = ? AND state = ? AND district = ? AND variant = ? AND (running_at IS NULL OR running_at < ?)',
    now, t.kind, t.state, t.district, t.variant, now - CIVIC_LOCK_MS,
  );
  return Number((r && r.meta && (r.meta.changes ?? r.meta.rows_written)) || 0) > 0;
};

const unlock = (db, t) =>
  db.run('UPDATE civic_data SET running_at = NULL WHERE kind = ? AND state = ? AND district = ? AND variant = ?', t.kind, t.state, t.district, t.variant);

// Translate the stored English data of one row into one language (te | hi) and save it in i18n
export async function translateOne(db, env, t, lang, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!TR_LANGS[lang]) {
    return { ok: false, error: 'bad lang' };
  }
  const row = await db.first('SELECT data, i18n FROM civic_data WHERE kind = ? AND state = ? AND district = ? AND variant = ?', t.kind, t.state, t.district, t.variant);
  const data = row ? parseJsonCol(row.data, null) : null;
  if (!data) {
    return { ok: false, error: 'no data yet' };
  }
  const r = await geminiGenerate(env, { prompt: translatePrompt(t.kind, data, TR_LANGS[lang]), jsonOut: true, maxTokens: 24000, temperature: 0.1 }, { fetchImpl });
  await addUsage(db, utcDay(now), 'civic_tr', 1);
  if (!r.ok) {
    return { ok: false, error: r.error };
  }
  const parsed = parseJsonLoose(r.text);
  const tr = parsed ? (t.kind === 'govt' ? cleanGovt(parsed) : cleanHosp(parsed)) : null;
  if (isEmpty(t.kind, tr)) {
    return { ok: false, error: 'unreadable translation' };
  }
  // Re-read so a parallel translation of the other language is not lost
  const cur = await db.first('SELECT i18n FROM civic_data WHERE kind = ? AND state = ? AND district = ? AND variant = ?', t.kind, t.state, t.district, t.variant);
  const i18n = { ...parseJsonCol(cur && cur.i18n, {}), [lang]: tr };
  await db.run('UPDATE civic_data SET i18n = ? WHERE kind = ? AND state = ? AND district = ? AND variant = ?', JSON.stringify(i18n), t.kind, t.state, t.district, t.variant);
  return { ok: true, lang, model: r.model };
}

// Research one target in English (grounded). opts.translate: also translate into te + hi after.
export async function researchOne(db, env, { kind, state, district = '', variant = '' }, { fetchImpl = fetch, now = Date.now(), translate = false } = {}) {
  const st = stateByCode(state);
  if (!st || !KINDS[kind] || !KINDS[kind].includes(variant)) {
    return { ok: false, error: 'bad target' };
  }
  const t = { kind, state, district, variant };
  const where = placeName(st, district);
  const r = await geminiGenerate(env, { prompt: researchPrompt(kind, variant, st, district), grounded: true, maxTokens: 16000 }, { fetchImpl });
  await addUsage(db, utcDay(now), 'civic_ai', 1);
  let data = null;
  let error = r.ok ? '' : r.error;
  if (r.ok) {
    const parsed = parseJsonLoose(r.text);
    data = parsed ? (kind === 'govt' ? cleanGovt(parsed) : cleanHosp(parsed, where)) : null;
    if (isEmpty(kind, data)) {
      data = null;
      error = 'empty or unreadable answer';
    }
  }
  if (data) {
    // New English data: old translations no longer match, so they are dropped (re-translated next)
    await db.run(
      `INSERT INTO civic_data (kind, state, district, variant, data, sources, ai_stars, status, error, model, updated_at, i18n)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'ok', NULL, ?, ?, NULL)
       ON CONFLICT (kind, state, district, variant) DO UPDATE SET data = excluded.data, sources = excluded.sources,
         ai_stars = NULL, status = 'ok', error = NULL, model = excluded.model, updated_at = excluded.updated_at, i18n = NULL`,
      kind, state, district, variant, JSON.stringify(data), JSON.stringify(r.sources || []), r.model, now,
    );
    const out = { ok: true, model: r.model };
    if (translate) {
      out.translated = [];
      for (const lang of Object.keys(TR_LANGS)) {
        const tr = await translateOne(db, env, t, lang, { fetchImpl, now });
        if (tr.ok) {
          out.translated.push(lang);
        }
      }
    }
    return out;
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

// On demand (a user opened a place): research it now if it has no data, else translate the missing
// language. Locked per row (one run at a time) and inside the same daily caps as the cron.
export async function researchNow(db, env, t, lang, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!isGeminiConfigured(env)) {
    return { ok: false, status: 'ai_off', error: 'GEMINI_API_KEY not set' };
  }
  const row = await db.first('SELECT data, i18n, status, updated_at, running_at FROM civic_data WHERE kind = ? AND state = ? AND district = ? AND variant = ?', t.kind, t.state, t.district, t.variant);
  const hasData = !!(row && row.data);
  const i18n = parseJsonCol(row && row.i18n, {});
  const needTr = hasData && TR_LANGS[lang] && !i18n[lang];
  if (hasData && !needTr) {
    return { ok: true, status: 'ok', did: 'nothing' };
  }
  if (row && row.status === 'error' && !hasData && now - Number(row.updated_at) < CIVIC_RETRY_MS) {
    return { ok: false, status: 'error', error: 'research failed recently, retrying later' };
  }
  const day = utcDay(now);
  const used = await usageFor(db, day, ['civic_ai', 'civic_tr']);
  if (!hasData && used.civic_ai >= CIVIC_DAILY_MAX) {
    return { ok: false, status: 'pending', error: 'daily cap reached' };
  }
  if (needTr && used.civic_tr >= CIVIC_TR_DAILY_MAX) {
    return { ok: false, status: 'ok', error: 'daily translation cap reached' };
  }
  if (!(await lockRow(db, t, now))) {
    return { ok: true, status: 'running', did: 'already running' };
  }
  try {
    if (!hasData) {
      const r = await researchOne(db, env, t, { fetchImpl, now });
      return { ...r, status: r.ok ? 'ok' : 'error', did: 'research' };
    }
    const r = await translateOne(db, env, t, lang, { fetchImpl, now });
    return { ...r, status: 'ok', did: 'translate' };
  } finally {
    await unlock(db, t);
  }
}

// Which targets the next run should research, best first (pure: tested)
export function pickTargets(rows, now, n) {
  const key = (k, st, d, v) => `${k}|${st}|${d}|${v}`;
  const byKey = new Map(rows.map(r => [key(r.kind, r.state, r.district || '', r.variant || ''), r]));
  const free = r => !r.running_at || now - Number(r.running_at) > CIVIC_LOCK_MS;
  const pending = rows.filter(r => r.status === 'pending' && free(r)).sort((a, b) => Number(a.updated_at) - Number(b.updated_at));
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
        free(r) &&
        ((r.status === 'ok' && now - Number(r.updated_at) > CIVIC_REFRESH_MS) || (r.status === 'error' && now - Number(r.updated_at) > CIVIC_RETRY_MS)),
    )
    .sort((a, b) => Number(a.updated_at) - Number(b.updated_at));
  const pick = r => ({ kind: r.kind, state: r.state, district: r.district || '', variant: r.variant || '' });
  return [...pending.map(pick), ...missing, ...stale.map(pick)].slice(0, Math.max(0, n));
}

export async function runCivicResearch(db, env, { fetchImpl = fetch, now = Date.now(), perRun = CIVIC_PER_RUN, dailyMax = CIVIC_DAILY_MAX, translate = true } = {}) {
  if (!isGeminiConfigured(env)) {
    return { ran: 0, skipped: 'GEMINI_API_KEY not set' };
  }
  const used = await usageFor(db, utcDay(now), ['civic_ai', 'civic_tr']);
  const n = Math.min(perRun, dailyMax - used.civic_ai);
  const results = [];
  if (n > 0) {
    const rows = await db.all('SELECT kind, state, district, variant, status, updated_at, running_at FROM civic_data');
    const targets = pickTargets(rows, now, n);
    for (const t of targets) {
      const tr = translate && used.civic_tr + results.length * 2 < CIVIC_TR_DAILY_MAX;
      results.push({ ...t, ...(await researchOne(db, env, t, { fetchImpl, now, translate: tr })) });
    }
  }
  // Rows with English data but no translation yet (e.g. researched on demand): one per run
  if (translate) {
    const left = await usageFor(db, utcDay(now), ['civic_tr']);
    if (left.civic_tr < CIVIC_TR_DAILY_MAX) {
      const rows = await db.all("SELECT kind, state, district, variant, i18n FROM civic_data WHERE status = 'ok' AND data IS NOT NULL ORDER BY updated_at DESC LIMIT 50");
      const todo = rows.find(r => {
        const i = parseJsonCol(r.i18n, {});
        return !i.te || !i.hi;
      });
      if (todo) {
        const i = parseJsonCol(todo.i18n, {});
        const lang = !i.te ? 'te' : 'hi';
        const t = { kind: todo.kind, state: todo.state, district: todo.district || '', variant: todo.variant || '' };
        results.push({ ...t, translate: lang, ...(await translateOne(db, env, t, lang, { fetchImpl, now })) });
      }
    }
  }
  if (!results.length) {
    return { ran: 0, skipped: n <= 0 ? 'daily cap reached' : 'nothing to do' };
  }
  return { ran: results.length, results };
}
