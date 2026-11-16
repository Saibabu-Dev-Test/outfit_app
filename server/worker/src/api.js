/* global crypto */
// D1-backed API for the app's high-volume data when Firestore's free daily quota runs out.
// Every route here needs a verified Firebase ID token (auth.js); the uid always comes from the
// token, never from the request body. Earn credits are NOT writable here (read-only ledger).
//
//   GET    /v1/status                     which backend the app should use + Firestore usage today
//   POST   /v1/usage {reads, writes}      app's batched Firestore op counts (estimate) + "active today"
//   POST   /v1/backend/exhausted          app saw resource-exhausted from Firestore: switch for today
//   GET    /v1/feed?before=&limit=&uids=  D1 posts, newest first
//   POST   /v1/posts                      new post while on D1 -> { id: 'd1_...' }
//   GET    /v1/posts/:id                  one D1 post
//   DELETE /v1/posts/:id                  author or owner
//   GET    /v1/votes?post=&n=             counts per option + my vote (D1 votes only)
//   PUT    /v1/votes {postId, option}     my vote (one per user per post)
//   GET    /v1/coins                      my D1 coin total
//   POST   /v1/coins {type, targetId}     coin event (fixed points, create-only, daily cap)
//   GET    /v1/earnings                   my D1 earn ledger (read-only)
//   GET    /v1/admin/system               owner only: usage, earn, users (Admin > System)
//   GET    /v1/admin/earnings             owner only: real earn ledger report (Admin tracking > Earnings)
import {
  BACKEND_SWITCH_AT,
  COIN_POINTS,
  D1_FREE,
  FIRESTORE_FREE,
  MAX_COIN_EVENTS_PER_DAY,
  MAX_POSTS_PER_DAY,
  MAX_POST_CHARS,
  MAX_USAGE_PER_CALL,
  OPTION_LABELS,
  WORKER_VERSION,
} from './config.js';
import { addUsage, setUsage, usageFor } from './db.js';
import { istDay, ptDay, utcDay } from './days.js';
import { isOwner } from './auth.js';
import { rowToEarning } from './earn.js';
import { istDayStartMs, istMonthStartMs, shortUid } from './report.js';
import { serviceAccountJson } from './handler.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const safeId = v => typeof v === 'string' && v.length > 0 && v.length <= 200 && /^[A-Za-z0-9_-]+$/.test(v);
const cleanId = s => String(s || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 200);
export const coinEventId = (type, targetId) => `${type}_${cleanId(targetId) || 'x'}`;
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

// ── Backend choice ──
export function backendFrom(fs) {
  if (fs.fs_exhausted > 0) {
    return { backend: 'd1', reason: 'firestore-quota-exhausted' };
  }
  if (fs.fs_reads >= FIRESTORE_FREE.reads * BACKEND_SWITCH_AT) {
    return { backend: 'd1', reason: 'firestore-reads-95' };
  }
  if (fs.fs_writes >= FIRESTORE_FREE.writes * BACKEND_SWITCH_AT) {
    return { backend: 'd1', reason: 'firestore-writes-95' };
  }
  return { backend: 'firestore', reason: 'ok' };
}

async function firestoreUsage(db, now) {
  const day = ptDay(now);
  const u = await usageFor(db, day, ['fs_reads', 'fs_writes', 'fs_exhausted']);
  return { day, ...u };
}

const statusBody = (fs, now) => ({
  ...backendFrom(fs),
  switchAt: BACKEND_SWITCH_AT,
  firestore: {
    day: fs.day,
    reads: fs.fs_reads,
    writes: fs.fs_writes,
    exhausted: fs.fs_exhausted > 0,
    limits: { reads: FIRESTORE_FREE.reads, writes: FIRESTORE_FREE.writes },
  },
  at: now,
});

export async function getStatus({ db, now }) {
  return statusBody(await firestoreUsage(db, now), now);
}

export async function postUsage({ db, user, body, now }) {
  const reads = clampInt(body && body.reads, 0, MAX_USAGE_PER_CALL);
  const writes = clampInt(body && body.writes, 0, MAX_USAGE_PER_CALL);
  const day = ptDay(now);
  const stmts = [];
  if (reads) {
    stmts.push(db.stmt('INSERT INTO usage (day, key, n) VALUES (?, ?, ?) ON CONFLICT (day, key) DO UPDATE SET n = n + excluded.n', day, 'fs_reads', reads));
  }
  if (writes) {
    stmts.push(db.stmt('INSERT INTO usage (day, key, n) VALUES (?, ?, ?) ON CONFLICT (day, key) DO UPDATE SET n = n + excluded.n', day, 'fs_writes', writes));
  }
  stmts.push(db.stmt('INSERT OR IGNORE INTO active_users (day, uid) VALUES (?, ?)', istDay(now), user.uid));
  await db.batch(stmts);
  return statusBody(await firestoreUsage(db, now), now);
}

export async function postExhausted({ db, now }) {
  await setUsage(db, ptDay(now), 'fs_exhausted', 1);
  return statusBody(await firestoreUsage(db, now), now);
}

// ── Feed ──
const parseJsonArray = s => {
  try {
    const v = JSON.parse(s || '[]');
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  } catch (e) {
    return [];
  }
};

export const rowToPost = r => ({
  id: r.id,
  userId: r.user_id,
  userName: r.user_name || 'Outfit user',
  userAvatar: r.user_avatar || null,
  userAge: r.user_age === null || r.user_age === undefined ? null : Number(r.user_age),
  caption: r.caption || '',
  photos: parseJsonArray(r.photos),
  clear: r.clear ? parseJsonArray(r.clear) : [],
  likeCount: Number(r.like_count) || 0,
  commentCount: Number(r.comment_count) || 0,
  createdAt: Number(r.created_at) || 0,
});

export async function getFeed({ db, url }) {
  const p = url.searchParams;
  const before = Number(p.get('before')) > 0 ? Number(p.get('before')) : Number.MAX_SAFE_INTEGER;
  const lim = clampInt(p.get('limit') || 10, 1, 30);
  const uids = String(p.get('uids') || '')
    .split(',')
    .filter(safeId)
    .slice(0, 300);
  let rows;
  if (uids.length) {
    const marks = uids.map(() => '?').join(',');
    rows = await db.all(
      `SELECT * FROM posts WHERE deleted = 0 AND created_at < ? AND user_id IN (${marks}) ORDER BY created_at DESC LIMIT ?`,
      before,
      ...uids,
      lim,
    );
  } else {
    rows = await db.all('SELECT * FROM posts WHERE deleted = 0 AND created_at < ? ORDER BY created_at DESC LIMIT ?', before, lim);
  }
  const posts = rows.map(rowToPost);
  return { posts, hasMore: posts.length === lim, cursor: posts.length ? posts[posts.length - 1].createdAt : null };
}

const randomId = () => {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return 'd1_' + Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
};

export async function createPost({ db, user, body, now }) {
  const photos = Array.isArray(body && body.photos) ? body.photos.filter(x => typeof x === 'string' && /^data:image\/|^https:\/\//.test(x)).slice(0, 6) : [];
  const clear = Array.isArray(body && body.clear) ? body.clear.filter(x => typeof x === 'string' && /^data:image\/|^https:\/\//.test(x)).slice(0, 6) : [];
  if (!photos.length) {
    throw new HttpError(400, 'add a photo');
  }
  const caption = str(body.caption, 500);
  const total = photos.join('').length + clear.join('').length + caption.length;
  if (total > MAX_POST_CHARS) {
    throw new HttpError(413, 'photos too large');
  }
  const since = now - 86400000;
  const recent = await db.first('SELECT COUNT(*) AS n FROM posts WHERE user_id = ? AND created_at > ?', user.uid, since);
  if (recent && Number(recent.n) >= MAX_POSTS_PER_DAY) {
    throw new HttpError(429, 'too many posts today');
  }
  const id = randomId();
  const age = Number(body.userAge);
  await db.run(
    `INSERT INTO posts (id, user_id, user_name, user_avatar, user_age, caption, photos, clear, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    user.uid,
    str(body.userName, 80) || null,
    str(body.userAvatar, 200000) || null,
    Number.isInteger(age) && age > 0 && age < 130 ? age : null,
    caption,
    JSON.stringify(photos),
    clear.length ? JSON.stringify(clear) : null,
    now,
  );
  return { id, createdAt: now };
}

export async function getPost({ db, id }) {
  if (!safeId(id)) {
    throw new HttpError(400, 'bad id');
  }
  const r = await db.first('SELECT * FROM posts WHERE id = ? AND deleted = 0', id);
  if (!r) {
    throw new HttpError(404, 'not found');
  }
  return { post: rowToPost(r) };
}

export async function deletePost({ db, user, id }) {
  if (!safeId(id)) {
    throw new HttpError(400, 'bad id');
  }
  const r = await db.first('SELECT user_id FROM posts WHERE id = ?', id);
  if (!r) {
    return { ok: true };
  }
  if (r.user_id !== user.uid && !isOwner(user)) {
    throw new HttpError(403, 'not yours');
  }
  await db.batch([db.stmt('UPDATE posts SET deleted = 1 WHERE id = ?', id), db.stmt('DELETE FROM votes WHERE post_id = ?', id)]);
  return { ok: true };
}

// ── Votes ──
export async function getVotes({ db, user, url }) {
  const postId = String(url.searchParams.get('post') || '');
  const n = clampInt(url.searchParams.get('n') || 6, 1, 6);
  if (!safeId(postId)) {
    throw new HttpError(400, 'bad post');
  }
  const labels = OPTION_LABELS.slice(0, n);
  const rows = await db.all('SELECT option, COUNT(*) AS c FROM votes WHERE post_id = ? GROUP BY option', postId);
  const mine = await db.first('SELECT option FROM votes WHERE post_id = ? AND uid = ?', postId, user.uid);
  const counts = labels.map(l => Number((rows.find(r => r.option === l) || {}).c) || 0);
  const idx = mine ? labels.indexOf(mine.option) : -1;
  return { counts, total: counts.reduce((a, b) => a + b, 0), myVote: idx >= 0 ? idx : null };
}

export async function putVote({ db, user, body, now }) {
  const postId = String((body && body.postId) || '');
  const option = String((body && body.option) || '');
  if (!safeId(postId) || !OPTION_LABELS.includes(option)) {
    throw new HttpError(400, 'bad vote');
  }
  await db.run(
    'INSERT INTO votes (post_id, uid, option, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (post_id, uid) DO UPDATE SET option = excluded.option, updated_at = excluded.updated_at',
    postId,
    user.uid,
    option,
    now,
  );
  return { ok: true };
}

// ── Coins ──
async function coinTotal(db, uid) {
  const r = await db.first('SELECT COALESCE(SUM(points), 0) AS t FROM coin_events WHERE uid = ?', uid);
  return Number(r && r.t) || 0;
}

export async function getCoins({ db, user }) {
  return { total: await coinTotal(db, user.uid) };
}

export async function postCoin({ db, user, body, now }) {
  const type = String((body && body.type) || '');
  const targetId = String((body && body.targetId) || '');
  if (!Object.prototype.hasOwnProperty.call(COIN_POINTS, type) || !targetId) {
    throw new HttpError(400, 'bad coin event');
  }
  const today = await db.first('SELECT COUNT(*) AS n FROM coin_events WHERE uid = ? AND created_at > ?', user.uid, now - 86400000);
  if (today && Number(today.n) >= MAX_COIN_EVENTS_PER_DAY) {
    return { added: 0, total: await coinTotal(db, user.uid), capped: true };
  }
  const id = coinEventId(type, targetId);
  const points = COIN_POINTS[type];
  const r = await db.run('INSERT OR IGNORE INTO coin_events (uid, id, type, points, created_at) VALUES (?, ?, ?, ?, ?)', user.uid, id, type, points, now);
  const added = r && r.meta && r.meta.changes ? points : 0;
  return { id, added, total: await coinTotal(db, user.uid) };
}

// ── Earn ledger (read-only for the app) ──
export async function getEarnings({ db, user }) {
  const rows = await db.all('SELECT * FROM earnings WHERE uid = ? ORDER BY created_at DESC LIMIT 300', user.uid);
  return { entries: rows.map(rowToEarning) };
}

// ── Owner: Admin > System ──
export const PARTNERS = ['bitlabs', 'cpx', 'offerwall'];
const PARTNER_SECRET = { bitlabs: 'BITLABS_SECRET', cpx: 'CPX_SECURE_HASH', offerwall: 'OFFERWALL_GG_SECRET' };
const OUTCOMES = ['ok', 'rejected', 'error', 'not_configured'];

export async function getAdminSystem({ db, user, env, now }) {
  if (!isOwner(user)) {
    throw new HttpError(403, 'owner only');
  }
  const fs = await firestoreUsage(db, now);
  const d1Day = utcDay(now);
  const d1 = await usageFor(db, d1Day, ['d1_reads', 'd1_writes']);
  const today = istDay(now);
  const pbKeys = [];
  PARTNERS.forEach(p => OUTCOMES.forEach(o => pbKeys.push(`postback:${p}:${o}`)));
  const pb = await usageFor(db, today, pbKeys);
  const sums = await db.all(
    'SELECT partner, status, COUNT(*) AS n, COALESCE(SUM(coins), 0) AS coins, COALESCE(SUM(owner_rupees), 0) AS owner FROM earnings GROUP BY partner, status',
  );
  const earn = {};
  PARTNERS.forEach(p => {
    const rows = sums.filter(r => r.partner === p);
    const by = s => rows.find(r => r.status === s) || { n: 0, coins: 0, owner: 0 };
    const postbacks = {};
    OUTCOMES.forEach(o => (postbacks[o] = pb[`postback:${p}:${o}`] || 0));
    earn[p] = {
      configured: !!env[PARTNER_SECRET[p]],
      postbacksToday: postbacks,
      pendingCoins: Number(by('pending').coins) || 0,
      approvedCoins: Number(by('approved').coins) || 0,
      reversedCount: Number(by('reversed').n) || 0,
      // Owner's 35% of credits still standing (pending + approved), in rupees
      ownerRupees: Math.round(((Number(by('pending').owner) || 0) + (Number(by('approved').owner) || 0)) * 100) / 100,
    };
  });
  const active = await db.first('SELECT COUNT(*) AS n FROM active_users WHERE day = ?', today);
  const counts = await db.first(
    "SELECT (SELECT COUNT(*) FROM posts WHERE deleted = 0) AS posts, (SELECT COUNT(*) FROM votes) AS votes, (SELECT COUNT(*) FROM coin_events) AS coinEvents, (SELECT COUNT(*) FROM earnings) AS earnings",
  );
  return {
    worker: { version: WORKER_VERSION, firebaseServiceAccount: !!serviceAccountJson(env) },
    ...statusBody(fs, now),
    d1: {
      day: d1Day,
      reads: d1.d1_reads,
      writes: d1.d1_writes,
      storageBytes: db.sizeBytes,
      limits: { reads: D1_FREE.reads, writes: D1_FREE.writes, storageBytes: D1_FREE.storageBytes },
      rows: counts || {},
    },
    earn,
    users: { day: today, activeToday: Number(active && active.n) || 0 },
    at: now,
  };
}

// ── Owner: Admin tracking > Earnings ──
// Everything comes from the D1 earn ledger the partner postbacks write (every verified credit lands
// here; Firestore only mirrors it). No sample numbers: an empty ledger gives zeros and no rows.
// payout = the partner's full payout in rupees (payout_rupees; older rows: user rupees + owner rupees).
const PAYOUT_SQL = 'COALESCE(payout_rupees, rupees + owner_rupees)';
const CATEGORY_SQL = "COALESCE(category, type, 'other')";
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const emptyBucket = () => ({ tasks: 0, payout: 0, user: 0, owner: 0, pending: 0, approved: 0, reversed: 0, reversedPayout: 0 });

// rows: [{ status, n, payout, user, owner }] for one group -> one bucket
// tasks / payout / user / owner count credits still standing (pending + approved); reversed apart.
export function bucketOf(rows) {
  const b = emptyBucket();
  rows.forEach(r => {
    const n = Number(r.n) || 0;
    if (r.status === 'reversed') {
      b.reversed += n;
      b.reversedPayout += Number(r.payout) || 0;
      return;
    }
    if (r.status === 'pending') {
      b.pending += n;
    } else if (r.status === 'approved') {
      b.approved += n;
    } else {
      return;
    }
    b.tasks += n;
    b.payout += Number(r.payout) || 0;
    b.user += Number(r.user) || 0;
    b.owner += Number(r.owner) || 0;
  });
  b.payout = r2(b.payout);
  b.user = r2(b.user);
  b.owner = r2(b.owner);
  b.reversedPayout = r2(b.reversedPayout);
  return b;
}

const groupBy = (rows, keyFn) => {
  const out = {};
  rows.forEach(r => {
    const k = keyFn(r);
    (out[k] = out[k] || []).push(r);
  });
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, bucketOf(v)]));
};

export async function getAdminEarnings({ db, user, env, now }) {
  if (!isOwner(user)) {
    throw new HttpError(403, 'owner only');
  }
  const sums = `COUNT(*) AS n, COALESCE(SUM(${PAYOUT_SQL}), 0) AS payout, COALESCE(SUM(rupees), 0) AS user, COALESCE(SUM(owner_rupees), 0) AS owner`;
  const grouped = await db.all(`SELECT partner, ${CATEGORY_SQL} AS category, status, ${sums} FROM earnings GROUP BY partner, ${CATEGORY_SQL}, status`);
  const dayStart = istDayStartMs(now);
  const monthStart = istMonthStartMs(now);
  const today = await db.all(`SELECT status, ${sums} FROM earnings WHERE created_at >= ? GROUP BY status`, dayStart);
  const month = await db.all(`SELECT status, ${sums} FROM earnings WHERE created_at >= ? GROUP BY status`, monthStart);
  const recentRows = await db.all(
    `SELECT uid, id, partner, ${CATEGORY_SQL} AS category, status, ${PAYOUT_SQL} AS payout, rupees, owner_rupees, task_name, activity, created_at FROM earnings ORDER BY created_at DESC LIMIT 20`,
  );
  const partners = {};
  PARTNERS.forEach(p => {
    partners[p] = { configured: !!env[PARTNER_SECRET[p]], ...bucketOf(grouped.filter(r => r.partner === p)) };
  });
  return {
    partners,
    byCategory: groupBy(grouped, r => r.category || 'other'),
    byPartnerCategory: groupBy(grouped, r => `${r.partner}:${r.category || 'other'}`),
    total: bucketOf(grouped),
    today: { since: dayStart, ...bucketOf(today) },
    month: { since: monthStart, ...bucketOf(month) },
    recent: recentRows.map(r => ({
      id: r.id,
      user: shortUid(r.uid),
      partner: r.partner,
      category: r.category,
      status: r.status,
      payout: r2(r.payout),
      userRupees: r2(r.rupees),
      ownerRupees: r2(r.owner_rupees),
      taskName: r.task_name || null,
      activity: r.activity || null,
      createdAt: Number(r.created_at) || 0,
    })),
    at: now,
  };
}

export { addUsage };
