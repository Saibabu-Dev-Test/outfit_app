// Civic tab routes (Govt / Hospitals / previous vs present government comparison). All need a verified Firebase ID token (index.js); the uid
// always comes from the token.
//   GET  /v1/civic/data?kind=govt|hosp&state=TG&district=&variant=&lang=ta   stored AI summary + its
//        public source URLs + translated copies in i18n: te, hi and the asked lang (any TR_LANGS
//        code) (also ?category=govt|hosp-govt|hosp-private). One fast D1 read (+1 for i18n).
//        A place never researched is queued (status 'pending').
//        kind=gcmp: neutral previous vs present government comparison, state-level only (district
//        must be empty); state may also be 'IN' (the centre). No reviews for it (facts only).
//   POST /v1/civic/research {kind, state, district, variant, lang}   on demand: research the place
//        now (translated into lang in the same run) if it has no data, else translate the missing
//        language (any TR_LANGS code). Capped per user + per day. `code` on failure: quota | billing |
//        cap | timeout | config (the app shows a clear message). status 'paused' = every Gemini key
//        is out of free quota: research paused, the saved info is kept and shown.
//   POST /v1/civic/ask, /v1/civic/translate   civic AI answers + cached AI translations (ask.js)
//   GET  /v1/civic/reviews?item=&limit=     visible reviews + average + my review
//   POST /v1/civic/reviews {item, stars, body, photo?, userName?}  one per user per item (upsert)
//   POST /v1/civic/reports {item, author, reason}                  one per reporter per review
//   GET  /v1/admin/civic                    owner: reported + recent reviews, data status, AI usage
//   POST /v1/admin/civic/review {item, uid, hidden}               owner: hide / unhide a review
//   POST /v1/admin/civic/refresh {kind, state, district, variant} owner: research one now
import { HttpError } from '../api.js';
import { isOwner } from '../auth.js';
import { usageFor } from '../db.js';
import { utcDay } from '../days.js';
import { placeByCode, stateByCode } from './states.js';
import { cleanReviewText, hasProfanity } from './moderation.js';
import { isGeminiConfigured } from './gemini.js';
import { aiProviderStatus, isAiConfigured } from './llm.js';
import { CIVIC_LOCK_MS, CIVIC_MAX_PENDING, KINDS, TR_LANGS, civicCaps, readI18n, researchNow, researchOne } from './research.js';

export const MAX_REVIEWS_PER_DAY = 20; // per user (new or edited)
export const MAX_REPORTS_PER_DAY = 30; // per user
export const AUTO_HIDE_REPORTS = 5; // hidden until the owner looks
export const MAX_REVIEW_CHARS = 1000;
export const MAX_PHOTO_CHARS = 400000;
export const MAX_RESEARCH_PER_USER_DAY = 12; // on-demand research / translate calls per user

const DISTRICT_RE = /^[a-z0-9-]{0,40}$/;
const ITEM_RE = /^(govt|hosp):([A-Z]{2})((?::[a-z0-9-]{1,40}){0,3})$/;
const safeUid = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

export const normDistrict = v =>
  String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export function parseItem(item) {
  const m = ITEM_RE.exec(String(item || ''));
  if (!m || !stateByCode(m[2])) {
    return null;
  }
  const rest = m[3] ? m[3].slice(1).split(':') : [];
  return { kind: m[1], state: m[2], district: rest[0] || '', place: rest.slice(1).join(':') };
}

export function parseTarget(p) {
  let kind = str(p.get('kind'), 10);
  let variant = str(p.get('variant'), 10);
  const cat = str(p.get('category'), 20);
  if (cat) {
    [kind, variant = ''] = cat === 'govt' ? ['govt', ''] : cat.split('-');
  }
  const state = str(p.get('state'), 4).toUpperCase();
  const district = normDistrict(p.get('district'));
  if (!KINDS[kind] || !KINDS[kind].includes(variant || '') || !placeByCode(state, kind) || !DISTRICT_RE.test(district) || (kind === 'gcmp' && district)) {
    throw new HttpError(400, 'bad kind / state / district / variant');
  }
  return { kind, state, district, variant: variant || '' };
}

const parseJson = (v, dflt) => {
  try {
    return v ? JSON.parse(v) : dflt;
  } catch (e) {
    return dflt;
  }
};

const cleanSources = v =>
  (Array.isArray(v) ? v : [])
    .filter(x => x && typeof x.url === 'string' && /^https:\/\//.test(x.url))
    .slice(0, 12)
    .map(x => ({ url: x.url, title: typeof x.title === 'string' ? x.title.slice(0, 120) : '' }));

export async function getCivicData({ db, env, url, now }) {
  const t = parseTarget(url.searchParams);
  const lang = TR_LANGS[str(url.searchParams.get('lang'), 4)] ? str(url.searchParams.get('lang'), 4) : '';
  const row = await db.first(
    'SELECT data, sources, i18n, status, updated_at, running_at FROM civic_data WHERE kind = ? AND state = ? AND district = ? AND variant = ?',
    t.kind, t.state, t.district, t.variant,
  );
  let queued = false;
  if (!row) {
    const pend = await db.first("SELECT COUNT(*) AS n FROM civic_data WHERE status = 'pending'");
    if ((Number(pend && pend.n) || 0) < CIVIC_MAX_PENDING) {
      await db.run("INSERT OR IGNORE INTO civic_data (kind, state, district, variant, status, updated_at) VALUES (?, ?, ?, ?, 'pending', ?)", t.kind, t.state, t.district, t.variant, now);
      queued = true;
    }
  }
  const data = row ? parseJson(row.data, null) : null;
  const running = !!(row && row.running_at && now - Number(row.running_at) < CIVIC_LOCK_MS);
  const i18n = data ? await readI18n(db, t, ['te', 'hi', ...(lang ? [lang] : [])], row.i18n) : {};
  return {
    ...t,
    data,
    i18n: { te: i18n.te || null, hi: i18n.hi || null, ...(lang ? { [lang]: i18n[lang] || null } : {}) },
    sources: data ? cleanSources(parseJson(row.sources, [])) : [],
    aiStars: null, // no AI ratings (neutral information only)
    status: row ? (running && !data ? 'pending' : row.status) : queued ? 'pending' : 'none',
    running,
    updatedAt: row && data ? Number(row.updated_at) || 0 : 0,
    // aiConfigured: Ask AI / Explain simply / translation work (any provider in the fallback chain);
    // researchConfigured: grounded research of new places works (needs a Gemini key)
    aiConfigured: isAiConfigured(env),
    researchConfigured: isGeminiConfigured(env),
  };
}

export async function postCivicResearch({ db, env, user, body, now, fetchImpl, ctx }) {
  const p = new URLSearchParams();
  ['kind', 'state', 'district', 'variant'].forEach(k => p.set(k, str(body && body[k], 60)));
  const t = parseTarget(p);
  const lang = TR_LANGS[str(body && body.lang, 4)] ? str(body && body.lang, 4) : '';
  const day = utcDay(now);
  const rk = `civic_od:${user.uid}`.slice(0, 160);
  if (!isOwner(user) && (await usageFor(db, day, [rk]))[rk] >= MAX_RESEARCH_PER_USER_DAY) {
    throw new HttpError(429, 'try again later today');
  }
  const run = researchNow(db, env, t, lang, { fetchImpl: fetchImpl || fetch, now });
  if (ctx && ctx.waitUntil) {
    // keeps the run (and its save) going a little if the phone gives up waiting
    ctx.waitUntil(run.catch(() => undefined));
  }
  const r = await run;
  if (r.did === 'research' || r.did === 'translate') {
    await db.run('INSERT INTO usage (day, key, n) VALUES (?, ?, 1) ON CONFLICT (day, key) DO UPDATE SET n = n + 1', day, rk);
  }
  return { ...t, lang, ...r };
}

const rowToReview = (r, mine = false) => ({
  item: r.item,
  author: r.uid,
  stars: Number(r.stars) || 0,
  body: r.body || '',
  photo: r.photo || null,
  userName: r.user_name || 'Outfit user',
  createdAt: Number(r.created_at) || 0,
  updatedAt: Number(r.updated_at) || 0,
  ...(mine ? { hidden: !!r.hidden } : {}),
});

export async function getCivicReviews({ db, user, url }) {
  const item = str(url.searchParams.get('item'), 200);
  if (!parseItem(item)) {
    throw new HttpError(400, 'bad item');
  }
  const limit = Math.max(1, Math.min(50, Math.floor(Number(url.searchParams.get('limit')) || 20)));
  const rows = await db.all('SELECT * FROM civic_reviews WHERE item = ? AND hidden = 0 ORDER BY updated_at DESC LIMIT ?', item, limit);
  const agg = await db.first('SELECT COUNT(*) AS n, AVG(stars) AS avg FROM civic_reviews WHERE item = ? AND hidden = 0', item);
  const mine = await db.first('SELECT * FROM civic_reviews WHERE item = ? AND uid = ?', item, user.uid);
  return {
    item,
    count: Number(agg && agg.n) || 0,
    avg: agg && agg.avg ? Math.round(Number(agg.avg) * 10) / 10 : null,
    reviews: rows.map(r => rowToReview(r)),
    mine: mine ? rowToReview(mine, true) : null,
  };
}

export function checkPhoto(photo) {
  if (photo === undefined || photo === null || photo === '') {
    return null;
  }
  if (typeof photo !== 'string' || photo.length > MAX_PHOTO_CHARS) {
    throw new HttpError(400, 'photo too large');
  }
  if (/^https:\/\/[^\s"'<>]{3,500}$/.test(photo) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)) {
    return photo;
  }
  throw new HttpError(400, 'bad photo');
}

export async function postCivicReview({ db, user, body, now }) {
  const item = str(body && body.item, 200);
  const it = parseItem(item);
  if (!it) {
    throw new HttpError(400, 'bad item');
  }
  const stars = Math.floor(Number(body && body.stars));
  if (!(stars >= 1 && stars <= 5)) {
    throw new HttpError(400, 'stars must be 1-5');
  }
  const raw = str(body && body.body, MAX_REVIEW_CHARS * 2);
  if (hasProfanity(raw) || hasProfanity(body && body.userName)) {
    throw new HttpError(422, 'please remove abusive words');
  }
  const text = cleanReviewText(raw, MAX_REVIEW_CHARS);
  const photo = checkPhoto(body && body.photo);
  const day = utcDay(now);
  const rk = `civic_rv:${user.uid}`.slice(0, 160);
  const used = (await usageFor(db, day, [rk]))[rk];
  if (used >= MAX_REVIEWS_PER_DAY) {
    throw new HttpError(429, 'daily review limit reached');
  }
  const name = cleanReviewText(str(body && body.userName, 60), 60) || user.name || 'Outfit user';
  await db.batch([
    db.stmt(
      `INSERT INTO civic_reviews (item, uid, kind, state, district, place, stars, body, photo, user_name, hidden, report_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
       ON CONFLICT (item, uid) DO UPDATE SET stars = excluded.stars, body = excluded.body, photo = excluded.photo,
         user_name = excluded.user_name, updated_at = excluded.updated_at`,
      item, user.uid, it.kind, it.state, it.district, it.place, stars, text, photo, name, now, now,
    ),
    db.stmt('INSERT INTO usage (day, key, n) VALUES (?, ?, 1) ON CONFLICT (day, key) DO UPDATE SET n = n + 1', day, rk),
  ]);
  const mine = await db.first('SELECT * FROM civic_reviews WHERE item = ? AND uid = ?', item, user.uid);
  return { ok: true, review: rowToReview(mine, true) };
}

export async function postCivicReport({ db, user, body, now }) {
  const item = str(body && body.item, 200);
  const author = str(body && body.author, 128);
  if (!parseItem(item) || !safeUid(author)) {
    throw new HttpError(400, 'bad item / author');
  }
  if (author === user.uid) {
    throw new HttpError(400, 'cannot report your own review');
  }
  const review = await db.first('SELECT report_count FROM civic_reviews WHERE item = ? AND uid = ?', item, author);
  if (!review) {
    throw new HttpError(404, 'review not found');
  }
  const day = utcDay(now);
  const rk = `civic_rp:${user.uid}`.slice(0, 160);
  if ((await usageFor(db, day, [rk]))[rk] >= MAX_REPORTS_PER_DAY) {
    throw new HttpError(429, 'daily report limit reached');
  }
  const ins = await db.run('INSERT OR IGNORE INTO civic_reports (item, author, reporter, reason, created_at) VALUES (?, ?, ?, ?, ?)', item, author, user.uid, cleanReviewText(str(body && body.reason, 200), 200), now);
  const added = Number((ins && ins.meta && (ins.meta.changes ?? ins.meta.rows_written)) || 0) > 0;
  if (added) {
    await db.batch([
      db.stmt(`UPDATE civic_reviews SET report_count = report_count + 1, hidden = CASE WHEN report_count + 1 >= ? THEN 1 ELSE hidden END WHERE item = ? AND uid = ?`, AUTO_HIDE_REPORTS, item, author),
      db.stmt('INSERT INTO usage (day, key, n) VALUES (?, ?, 1) ON CONFLICT (day, key) DO UPDATE SET n = n + 1', day, rk),
    ]);
  }
  return { ok: true, alreadyReported: !added };
}

const ownerOnly = user => {
  if (!isOwner(user)) {
    throw new HttpError(403, 'owner only');
  }
};

export async function getAdminCivic({ db, user, env, now }) {
  ownerOnly(user);
  const reported = await db.all('SELECT * FROM civic_reviews WHERE report_count > 0 ORDER BY report_count DESC, updated_at DESC LIMIT 50');
  const recent = await db.all('SELECT * FROM civic_reviews ORDER BY updated_at DESC LIMIT 50');
  const status = await db.all('SELECT kind, status, COUNT(*) AS n, MIN(updated_at) AS oldest FROM civic_data GROUP BY kind, status');
  const errors = await db.all("SELECT kind, state, district, variant, error, updated_at, sources FROM civic_data WHERE status = 'error' ORDER BY updated_at DESC LIMIT 20");
  const full = r => ({ ...rowToReview(r, true), reportCount: Number(r.report_count) || 0 });
  return {
    aiConfigured: isGeminiConfigured(env),
    aiProviders: await aiProviderStatus(env, { now }),
    aiToday: (await usageFor(db, utcDay(now), ['civic_ai'])).civic_ai,
    aiDailyMax: civicCaps(env).dailyMax,
    trToday: (await usageFor(db, utcDay(now), ['civic_tr'])).civic_tr,
    trDailyMax: civicCaps(env).trDailyMax,
    askToday: (await usageFor(db, utcDay(now), ['civic_ask'])).civic_ask,
    askDailyMax: civicCaps(env).askDailyMax,
    data: status.map(r => ({ kind: r.kind, status: r.status, count: Number(r.n) || 0, oldest: Number(r.oldest) || 0 })),
    errors: errors.map(r => ({ kind: r.kind, state: r.state, district: r.district, variant: r.variant, error: r.error, updatedAt: Number(r.updated_at) || 0 })),
    reported: reported.map(full),
    recent: recent.map(full),
    at: now,
  };
}

export async function postAdminCivicReview({ db, user, body }) {
  ownerOnly(user);
  const item = str(body && body.item, 200);
  const uid = str(body && body.uid, 128);
  if (!parseItem(item) || !safeUid(uid)) {
    throw new HttpError(400, 'bad item / uid');
  }
  const hidden = body && body.hidden ? 1 : 0;
  // Unhiding clears the reports so it is not auto-hidden again by the same reports
  await db.run(`UPDATE civic_reviews SET hidden = ?, report_count = CASE WHEN ? = 0 THEN 0 ELSE report_count END WHERE item = ? AND uid = ?`, hidden, hidden, item, uid);
  if (!hidden) {
    await db.run('DELETE FROM civic_reports WHERE item = ? AND author = ?', item, uid);
  }
  return { ok: true, item, uid, hidden: !!hidden };
}

export async function postAdminCivicRefresh({ db, user, env, body, now, fetchImpl }) {
  ownerOnly(user);
  if (!isGeminiConfigured(env)) {
    throw new HttpError(503, 'GEMINI_API_KEY not set on the Worker');
  }
  const p = new URLSearchParams();
  ['kind', 'state', 'district', 'variant'].forEach(k => p.set(k, str(body && body[k], 60)));
  const t = parseTarget(p);
  const r = await researchOne(db, env, t, { fetchImpl: fetchImpl || fetch, now, translate: true });
  return { ...t, ...r };
}

