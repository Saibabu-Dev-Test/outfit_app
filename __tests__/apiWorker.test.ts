// Worker 'outfit-api' (server/worker): Firebase token check, owner gate, D1 API, CPX / Offerwall.GG
// postbacks and the shared numbers. D1 is stood in for by node:sqlite with the real migration SQL.
const nodeCrypto = require('crypto');
const fsMod = require('fs');
const pathMod = require('path');
const NodeBuffer = require('buffer').Buffer;
const ROOT = (globalThis as any).process.cwd();
if (!(globalThis as any).crypto?.subtle) {
  (globalThis as any).crypto = nodeCrypto.webcrypto;
}
const { DatabaseSync } = require('node:sqlite');
const { verifyFirebaseToken, isOwner, clearJwksCache, JWKS_URL } = require('../server/worker/src/auth.js');
const { md5Hex } = require('../server/worker/src/md5.js');
const { planCpxPostback, planOfferwallPostback, hmacSha256Hex, releaseHeld, cpxHashFor } = require('../server/worker/src/earn.js');
const { handleRequest } = require('../server/worker/src/index.js');
const { backendFrom } = require('../server/worker/src/api.js');
const wcfg = require('../server/worker/src/config.js');
const { Db } = require('../server/worker/src/db.js');
const legacy = require('../server/earn/index.js');

import { COIN_POINTS } from '../src/config/coins';
import { OWNER_EMAILS } from '../src/config/owner';
import { BACKEND_SWITCH_AT, D1_FREE, FIRESTORE_FREE, isD1Id } from '../src/config/backend';

// ── node:sqlite as D1 ──
class FakeStmt {
  constructor(private db: any, private sql: string, private binds: any[] = []) {}
  bind(...b: any[]) {
    return new FakeStmt(this.db, this.sql, b);
  }
  exec() {
    const st = this.db.prepare(this.sql);
    if (/^\s*(SELECT|WITH)/i.test(this.sql)) {
      const results = st.all(...this.binds);
      return { results, meta: { rows_read: results.length, rows_written: 0, changes: 0 } };
    }
    const r = st.run(...this.binds);
    return { results: [], meta: { rows_read: 0, rows_written: Number(r.changes), changes: Number(r.changes) } };
  }
  async all() {
    return this.exec();
  }
  async run() {
    return this.exec();
  }
}
const makeD1 = () => {
  const db = new DatabaseSync(':memory:');
  const dir = pathMod.join(ROOT, 'server/worker/migrations');
  fsMod
    .readdirSync(dir)
    .filter((f: string) => f.endsWith('.sql'))
    .sort()
    .forEach((f: string) => db.exec(fsMod.readFileSync(pathMod.join(dir, f), 'utf8')));
  return {
    raw: db,
    prepare: (sql: string) => new FakeStmt(db, sql),
    batch: async (stmts: any[]) => stmts.map(s => s.exec()),
  };
};

// ── Firebase-style ID tokens signed with a test key ──
const { privateKey, publicKey } = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const NOW = Date.UTC(2026, 10, 16, 7, 0, 0);
const b64u = (o: any) => NodeBuffer.from(JSON.stringify(o)).toString('base64url');
const token = (claims: any = {}, kid = 'k1', key = privateKey) => {
  const nowSec = Math.floor(NOW / 1000);
  const h = b64u({ alg: 'RS256', kid, typ: 'JWT' });
  const p = b64u({
    aud: 'outfit-vote-9edca',
    iss: 'https://securetoken.google.com/outfit-vote-9edca',
    sub: 'user1',
    iat: nowSec - 60,
    auth_time: nowSec - 60,
    exp: nowSec + 3000,
    email: 'someone@gmail.com',
    email_verified: true,
    ...claims,
  });
  const sig = nodeCrypto.sign('RSA-SHA256', NodeBuffer.from(`${h}.${p}`), key).toString('base64url');
  return `${h}.${p}.${sig}`;
};
const jwksFetch = jest.fn(async (url: string) => {
  if (url !== JWKS_URL) throw new Error('unexpected fetch ' + url);
  return { ok: true, status: 200, headers: { get: () => 'public, max-age=3600' }, json: async () => ({ keys: [jwk] }) };
});

beforeEach(() => {
  clearJwksCache();
  jwksFetch.mockClear();
});

describe('shared numbers match the app', () => {
  test('coins, owner, limits', () => {
    expect(wcfg.COIN_POINTS).toEqual(COIN_POINTS);
    expect(wcfg.OWNER_EMAILS).toEqual(OWNER_EMAILS);
    expect(wcfg.FIRESTORE_FREE).toEqual(FIRESTORE_FREE);
    expect(wcfg.D1_FREE).toEqual(D1_FREE);
    expect(wcfg.BACKEND_SWITCH_AT).toBe(BACKEND_SWITCH_AT);
    expect(isD1Id('d1_abc')).toBe(true);
    expect(isD1Id('abc')).toBe(false);
  });

  test('wrangler.toml binds outfit-db and has no secret values', () => {
    const toml = fsMod.readFileSync(pathMod.join(ROOT, 'server/worker/wrangler.toml'), 'utf8');
    expect(toml).toMatch(/name = "outfit-api"/);
    expect(toml).toMatch(/database_name = "outfit-db"/);
    expect(toml).not.toMatch(/SECRET\s*=|private_key|BEGIN PRIVATE/);
  });
});

describe('Firebase ID token check', () => {
  test('valid token -> uid + verified email; keys cached', async () => {
    const u = await verifyFirebaseToken(token(), { fetchImpl: jwksFetch, now: NOW });
    expect(u).toMatchObject({ uid: 'user1', email: 'someone@gmail.com', emailVerified: true });
    await verifyFirebaseToken(token(), { fetchImpl: jwksFetch, now: NOW });
    expect(jwksFetch).toHaveBeenCalledTimes(1);
  });

  test('rejects wrong project, expired, bad signature, unknown key, garbage', async () => {
    const bad = async (t: string) => expect(verifyFirebaseToken(t, { fetchImpl: jwksFetch, now: NOW })).rejects.toThrow();
    await bad(token({ aud: 'other' }));
    await bad(token({ iss: 'https://securetoken.google.com/other' }));
    await bad(token({ exp: Math.floor(NOW / 1000) - 1 }));
    await bad(token({ sub: '' }));
    await bad(token({}, 'k2'));
    const other = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    await bad(token({}, 'k1', other));
    await bad('not.a.token');
    await bad('');
  });

  test('owner = verified email in OWNER_EMAILS only', () => {
    expect(isOwner({ uid: 'x', email: '2saibabug@gmail.com', emailVerified: true })).toBe(true);
    expect(isOwner({ uid: 'x', email: '2saibabug@gmail.com', emailVerified: false })).toBe(false);
    expect(isOwner({ uid: 'x', email: 'someone@gmail.com', emailVerified: true })).toBe(false);
    expect(isOwner(null)).toBe(false);
  });
});

describe('CPX and Offerwall.GG postbacks', () => {
  test('md5 matches node crypto + legacy handler', () => {
    ['', 'a', 'user1-secret', 'ünïcødé', 'x'.repeat(200)].forEach(s =>
      expect(md5Hex(s)).toBe(nodeCrypto.createHash('md5').update(s).digest('hex')),
    );
    expect(cpxHashFor('u1', 's')).toBe(legacy.md5('u1-s'));
  });

  test('CPX: 503 without secret, 403 bad hash, 65% credit, status 2 reversal', () => {
    expect(planCpxPostback({ query: { user_id: 'u', trans_id: 't' }, secret: '' })).toEqual({ status: 503, body: 'not configured' });
    const q = { user_id: 'u1', trans_id: 't1', amount_local: '10', hash: md5Hex('t1-sec') };
    expect(planCpxPostback({ query: { ...q, hash: 'x' }, secret: 'sec' }).status).toBe(403);
    const ok = planCpxPostback({ query: q, secret: 'sec', now: NOW });
    expect(ok.write).toMatchObject({ op: 'create', docPath: 'users/u1/earnings/cpx_t1', fields: { coins: 650, partner: 'cpx', status: 'pending', ownerRupees: 3.5 } });
    const rev = planCpxPostback({ query: { ...q, status: '2' }, secret: 'sec' });
    expect(rev.write).toMatchObject({ op: 'merge', fields: { status: 'reversed' } });
  });

  test('Offerwall.GG: signature over user:tx:amount, test never credits, reversal', async () => {
    expect(await planOfferwallPostback({ query: { user: 'u', tx: 't', amount: '1' }, secret: '' })).toEqual({ status: 503, body: 'not configured' });
    const sig = await hmacSha256Hex('ow', 'u1:tx1:1750.2857');
    expect(sig).toBe(nodeCrypto.createHmac('sha256', 'ow').update('u1:tx1:1750.2857').digest('hex'));
    const q = { user: 'u1', tx: 'tx1', amount: '1750.2857', status: 'credited', sig, payout: '0.21' };
    expect((await planOfferwallPostback({ query: { ...q, amount: '9999' }, secret: 'ow' })).status).toBe(403);
    expect(await planOfferwallPostback({ query: { ...q, test: '1' }, secret: 'ow' })).toEqual({ status: 200, body: 'OK' });
    const ok = await planOfferwallPostback({ query: q, secret: 'ow', now: NOW });
    expect(ok.write).toMatchObject({ docPath: 'users/u1/earnings/offerwall_tx1', fields: { coins: 1137, partner: 'offerwall', type: 'offer', usd: 0.21 } });
    // Aliases from their docs work too
    const alias = await planOfferwallPostback({ query: { userId: 'u1', transactionId: 'tx1', currencyAmount: '1750.2857', signature: sig }, secret: 'ow' });
    expect(alias.status).toBe(200);
    const revSig = await hmacSha256Hex('ow', 'u1:tx1:-1750.2857');
    const rev = await planOfferwallPostback({ query: { user: 'u1', tx: 'tx1', amount: '-1750.2857', status: 'reversed', sig: revSig }, secret: 'ow' });
    expect(rev.write).toMatchObject({ op: 'merge', docPath: 'users/u1/earnings/offerwall_tx1', fields: { status: 'reversed' } });
  });
});

describe('backend switch', () => {
  test('95% of reads / writes or exhausted -> d1', () => {
    expect(backendFrom({ fs_reads: 0, fs_writes: 0, fs_exhausted: 0 }).backend).toBe('firestore');
    expect(backendFrom({ fs_reads: 47500, fs_writes: 0, fs_exhausted: 0 }).backend).toBe('d1');
    expect(backendFrom({ fs_reads: 0, fs_writes: 19000, fs_exhausted: 0 }).backend).toBe('d1');
    expect(backendFrom({ fs_reads: 1, fs_writes: 1, fs_exhausted: 1 }).backend).toBe('d1');
  });
});

describe('Worker routes on D1 (node:sqlite)', () => {
  const env = (extra: any = {}) => ({ DB: makeD1(), FIREBASE_PROJECT_ID: 'outfit-vote-9edca', ...extra });
  const call = async (e: any, method: string, path: string, opts: { body?: any; tok?: string | null; now?: number } = {}) => {
    const headers: any = {};
    if (opts.tok !== null) headers.authorization = `Bearer ${opts.tok || token()}`;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const req = new Request(`https://outfit-api.example.workers.dev${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const waits: Promise<any>[] = [];
    const res = await handleRequest(req, e, { waitUntil: (p: Promise<any>) => waits.push(p) }, { fetchImpl: jwksFetch, now: opts.now || NOW });
    await Promise.all(waits);
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, json };
  };
  const PHOTO = 'data:image/jpeg;base64,AAAA';

  test('health without token; API needs a token', async () => {
    const e = env();
    expect((await call(e, 'GET', '/health', { tok: null })).json).toMatchObject({ ok: true, d1: true });
    expect((await call(e, 'GET', '/v1/status', { tok: null })).status).toBe(401);
    expect((await call(e, 'GET', '/v1/status', { tok: 'x.y.z' })).status).toBe(401);
  });

  test('posts + feed + votes + delete', async () => {
    const e = env();
    const p1 = await call(e, 'POST', '/v1/posts', { body: { photos: [PHOTO, PHOTO], caption: 'hi', userName: 'Sai' } });
    expect(p1.status).toBe(200);
    expect(p1.json.id).toMatch(/^d1_/);
    await call(e, 'POST', '/v1/posts', { body: { photos: [PHOTO] }, now: NOW + 1000 });
    expect((await call(e, 'POST', '/v1/posts', { body: { photos: ['ftp://x'] } })).status).toBe(400);
    const feed = await call(e, 'GET', '/v1/feed?limit=10');
    expect(feed.json.posts).toHaveLength(2);
    expect(feed.json.posts[0].createdAt).toBeGreaterThan(feed.json.posts[1].createdAt);
    expect(feed.json.posts[1]).toMatchObject({ userId: 'user1', caption: 'hi', photos: [PHOTO, PHOTO] });
    const page2 = await call(e, 'GET', `/v1/feed?limit=1&before=${feed.json.posts[0].createdAt}`);
    expect(page2.json.posts.map((p: any) => p.id)).toEqual([p1.json.id]);
    expect((await call(e, 'GET', '/v1/feed?uids=someoneelse')).json.posts).toHaveLength(0);

    await call(e, 'PUT', '/v1/votes', { body: { postId: p1.json.id, option: 'B' } });
    await call(e, 'PUT', '/v1/votes', { body: { postId: p1.json.id, option: 'A' }, tok: token({ sub: 'user2' }) });
    await call(e, 'PUT', '/v1/votes', { body: { postId: p1.json.id, option: 'A' } }); // change my vote
    expect((await call(e, 'PUT', '/v1/votes', { body: { postId: p1.json.id, option: 'Z' } })).status).toBe(400);
    const v = await call(e, 'GET', `/v1/votes?post=${p1.json.id}&n=2`);
    expect(v.json).toEqual({ counts: [2, 0], total: 2, myVote: 0 });

    // Only the author (or the owner) deletes
    expect((await call(e, 'DELETE', `/v1/posts/${p1.json.id}`, { tok: token({ sub: 'user2' }) })).status).toBe(403);
    expect((await call(e, 'DELETE', `/v1/posts/${p1.json.id}`)).status).toBe(200);
    expect((await call(e, 'GET', `/v1/posts/${p1.json.id}`)).status).toBe(404);
  });

  test('coins: fixed points, create-only', async () => {
    const e = env();
    expect((await call(e, 'POST', '/v1/coins', { body: { type: 'upload', targetId: 'post_1' } })).json).toMatchObject({ added: 10, total: 10 });
    expect((await call(e, 'POST', '/v1/coins', { body: { type: 'upload', targetId: 'post_1' } })).json).toMatchObject({ added: 0, total: 10 });
    expect((await call(e, 'POST', '/v1/coins', { body: { type: 'free', targetId: 'x' } })).status).toBe(400);
    expect((await call(e, 'GET', '/v1/coins')).json.total).toBe(10);
  });

  test('earn credits are server-only; postbacks land in D1; release after hold', async () => {
    const e = env({ CPX_SECURE_HASH: 'sec' });
    // No API route writes earnings
    expect((await call(e, 'POST', '/v1/earnings', { body: { coins: 999 } })).status).toBe(404);
    const pb = await call(e, 'GET', `/cpxPostback?user_id=user1&trans_id=t1&amount_local=10&hash=${md5Hex('t1-sec')}`, { tok: null });
    expect(pb).toEqual({ status: 200, json: 1 });
    // duplicate is fine
    await call(e, 'GET', `/cpxPostback?user_id=user1&trans_id=t1&amount_local=10&hash=${md5Hex('t1-sec')}`, { tok: null });
    expect((await call(e, 'GET', '/cpxPostback?user_id=user1&trans_id=t2&hash=bad', { tok: null })).status).toBe(403);
    expect((await call(e, 'GET', '/offerwallPostback?user=u&tx=t&amount=1&sig=x', { tok: null })).status).toBe(503);
    expect((await call(e, 'GET', '/bitlabsPostback?uid=u&tx=t&hash=x', { tok: null })).status).toBe(503);
    const mine = await call(e, 'GET', '/v1/earnings');
    expect(mine.json.entries).toHaveLength(1);
    expect(mine.json.entries[0]).toMatchObject({ id: 'cpx_t1', coins: 650, status: 'pending', partner: 'cpx' });
    expect((await call(e, 'GET', '/v1/earnings', { tok: token({ sub: 'user2' }) })).json.entries).toHaveLength(0);
    const db = new Db(e.DB);
    expect(await releaseHeld(db, NOW + 86400000)).toBe(0);
    expect(await releaseHeld(db, NOW + 6 * 86400000)).toBe(1);
    expect((await call(e, 'GET', '/v1/earnings')).json.entries[0].status).toBe('approved');
  });

  test('usage + exhausted flag switch the backend; admin is owner only', async () => {
    const e = env({ BITLABS_SECRET: 'b' });
    expect((await call(e, 'GET', '/v1/status')).json.backend).toBe('firestore');
    const u = await call(e, 'POST', '/v1/usage', { body: { reads: 99999, writes: 10 } });
    expect(u.json.firestore).toMatchObject({ reads: 5000, writes: 10 }); // clamped per call
    expect((await call(e, 'POST', '/v1/backend/exhausted', { body: {} })).json).toMatchObject({ backend: 'd1', reason: 'firestore-quota-exhausted' });

    expect((await call(e, 'GET', '/v1/admin/system')).status).toBe(403);
    expect((await call(e, 'GET', '/v1/admin/system', { tok: token({ email: '2saibabug@gmail.com', email_verified: false }) })).status).toBe(403);
    const a = await call(e, 'GET', '/v1/admin/system', { tok: token({ email: '2saibabug@gmail.com' }) });
    expect(a.status).toBe(200);
    expect(a.json).toMatchObject({ backend: 'd1', users: { activeToday: 1 } });
    expect(a.json.earn.bitlabs.configured).toBe(true);
    expect(a.json.earn.cpx.configured).toBe(false);
    expect(a.json.d1.reads).toBeGreaterThan(0); // the Worker counts its own D1 rows
  });
});

// ── Owner's Admin tracking > Earnings: real ledger report + category stored from partner callbacks ──
const report = require('../server/worker/src/report.js');
const { planBitlabsCallback, hmacSha1Hex } = require('../server/worker/src/bitlabs.js');

describe('earn categories from partner callbacks', () => {
  test('categoryOf / bitlabsCategory / task names', () => {
    expect(report.categoryOf('')).toBeNull();
    expect(report.categoryOf('Survey')).toBe('survey');
    expect(report.categoryOf('GAME')).toBe('game');
    expect(report.categoryOf('quiz')).toBe('quiz');
    expect(report.categoryOf('app install')).toBe('offer');
    expect(report.categoryOf('weird')).toBe('other');
    expect(report.bitlabsCategory({})).toBeNull();
    expect(report.bitlabsCategory({ cat: 'game' })).toBe('game');
    expect(report.bitlabsCategory({ offer_id: '12' })).toBe('offer');
    expect(report.bitlabsCategory({ survey_id: 's', loi: '10' })).toBe('survey');
    expect(report.bitlabsTaskName({ offer_name: 'Sea\nBattle', task_name: 'Level 5' })).toBe('Sea Battle · Level 5');
    expect(report.cleanTaskName('x'.repeat(200))).toHaveLength(80);
    expect(report.shortUid('abcdefghijk')).toBe('abcdef…');
  });

  test('IST day / month starts', () => {
    const now = Date.UTC(2026, 10, 16, 20, 0, 0); // 17 Nov 01:30 IST
    expect(new Date(report.istDayStartMs(now)).toISOString()).toBe('2026-11-16T18:30:00.000Z');
    expect(new Date(report.istMonthStartMs(now)).toISOString()).toBe('2026-10-31T18:30:00.000Z');
  });

  test('CPX + Offerwall.GG plans carry category, task name, full payout (old fields unchanged)', async () => {
    const cpx = planCpxPostback({ query: { user_id: 'u1', trans_id: 't1', amount_local: '10', hash: md5Hex('t1-sec') }, secret: 'sec', now: NOW });
    expect(cpx.write.fields).toMatchObject({ type: 'survey', coins: 650, partner: 'cpx', category: 'survey', payoutRupees: 10, ownerRupees: 3.5 });
    const sig = await hmacSha256Hex('ow', 'u1:tx1:830');
    const ow = await planOfferwallPostback({ query: { user: 'u1', tx: 'tx1', amount: '830', sig, payout: '0.1', offerName: 'World of Sea Battle', cat: 'game' }, secret: 'ow', now: NOW });
    expect(ow.write.fields).toMatchObject({ type: 'offer', partner: 'offerwall', category: 'game', taskName: 'World of Sea Battle', payoutRupees: 8.3 });
    const ow2 = await planOfferwallPostback({ query: { user: 'u1', tx: 'tx1', amount: '830', sig }, secret: 'ow', now: NOW });
    expect(ow2.write.fields.category).toBe('offer');
    expect(ow2.write.fields.taskName).toBeUndefined();
  });

  test('BitLabs plan stores category only when BitLabs tells us', async () => {
    const BASE = 'https://outfit-api.example.workers.dev';
    const sign = async (p: string) => `${BASE}${p}&hash=${await hmacSha1Hex('bs', BASE + p)}`;
    const plain = await planBitlabsCallback({ url: await sign('/bitlabsPostback?uid=u1&val=1&tx=t1&type=COMPLETE'), secret: 'bs', now: NOW });
    expect(plain.write.fields.type).toBe('offer'); // unchanged for the app
    expect(plain.write.fields.category).toBeUndefined();
    expect(plain.write.fields.payoutRupees).toBe(83);
    const offer = await planBitlabsCallback({ url: await sign('/bitlabsPostback?uid=u1&val=1&tx=t2&type=COMPLETE&offer_id=9&offer_name=Bingo'), secret: 'bs', now: NOW });
    expect(offer.write.fields).toMatchObject({ category: 'offer', taskName: 'Bingo' });
    const survey = await planBitlabsCallback({ url: await sign('/bitlabsPostback?uid=u1&val=1&tx=t3&type=COMPLETE&cat=survey'), secret: 'bs', now: NOW });
    expect(survey.write.fields.category).toBe('survey');
  });
});

describe('GET /v1/admin/earnings (owner only, real D1 ledger)', () => {
  const env = (extra: any = {}) => ({ DB: makeD1(), FIREBASE_PROJECT_ID: 'outfit-vote-9edca', ...extra });
  const call = async (e: any, path: string, tok: string | null, now = NOW) => {
    const headers: any = {};
    if (tok) headers.authorization = `Bearer ${tok}`;
    const res = await handleRequest(new Request(`https://outfit-api.example.workers.dev${path}`, { headers }), e, { waitUntil: () => undefined }, { fetchImpl: jwksFetch, now });
    const t = await res.text();
    let json: any = t;
    try {
      json = JSON.parse(t);
    } catch {}
    return { status: res.status, json };
  };
  const owner = () => token({ email: '2saibabug@gmail.com', sub: 'ownerUid' });

  test('not the owner -> 403', async () => {
    const e = env();
    expect((await call(e, '/v1/admin/earnings', token())).status).toBe(403);
    expect((await call(e, '/v1/admin/earnings', null)).status).toBe(401);
  });

  test('empty ledger -> zeros, no rows (never sample numbers)', async () => {
    const r = await call(env(), '/v1/admin/earnings', owner());
    expect(r.status).toBe(200);
    expect(r.json.total).toMatchObject({ tasks: 0, payout: 0, user: 0, owner: 0, pending: 0, approved: 0, reversed: 0 });
    expect(r.json.recent).toEqual([]);
    expect(r.json.byCategory).toEqual({});
    expect(r.json.partners.cpx).toMatchObject({ configured: false, tasks: 0 });
  });

  test('credits, reversal and approval are aggregated per partner / category / status', async () => {
    const e = env({ CPX_SECURE_HASH: 'sec', OFFERWALL_GG_SECRET: 'ow' });
    // CPX survey ₹10 (user 6.5, owner 3.5), yesterday IST
    await call(e, `/cpxPostback?user_id=userAAAA1&trans_id=t1&amount_local=10&hash=${md5Hex('t1-sec')}`, null, NOW - 86400000);
    // CPX survey ₹20 today, then reversed
    await call(e, `/cpxPostback?user_id=userBBBB2&trans_id=t2&amount_local=20&hash=${md5Hex('t2-sec')}`, null);
    await call(e, `/cpxPostback?user_id=userBBBB2&trans_id=t2&status=2&hash=${md5Hex('t2-sec')}`, null);
    // Offerwall.GG game 830 coins (₹8.30) today
    const sig = await hmacSha256Hex('ow', 'userAAAA1:g1:830');
    await call(e, `/offerwallPostback?user=userAAAA1&tx=g1&amount=830&sig=${sig}&cat=game&offerName=Sea%20Battle`, null, NOW + 1000);
    // A row written before migration 0002 (no category / payout columns) still counts
    e.DB.raw
      .prepare("INSERT INTO earnings (uid, id, type, partner, status, coins, rupees, owner_rupees, created_at, updated_at) VALUES ('old', 'bitlabs_x', 'offer', 'bitlabs', 'approved', 130, 1.3, 0.7, ?, ?)")
      .run(NOW - 40 * 86400000, NOW - 40 * 86400000);

    const r = await call(e, '/v1/admin/earnings', owner(), NOW + 2000);
    expect(r.status).toBe(200);
    const j = r.json;
    expect(j.partners.cpx).toMatchObject({ configured: true, tasks: 1, payout: 10, user: 6.5, owner: 3.5, pending: 1, reversed: 1, reversedPayout: 20 });
    expect(j.partners.offerwall).toMatchObject({ configured: true, tasks: 1, payout: 8.3, pending: 1 });
    expect(j.partners.bitlabs).toMatchObject({ configured: false, tasks: 1, payout: 2, approved: 1 });
    expect(j.byCategory.survey).toMatchObject({ tasks: 1, reversed: 1 });
    expect(j.byCategory.game).toMatchObject({ tasks: 1, payout: 8.3 });
    expect(j.byCategory.offer).toMatchObject({ tasks: 1, payout: 2 }); // old row: type fallback
    expect(j.byPartnerCategory['offerwall:game'].tasks).toBe(1);
    expect(j.total).toMatchObject({ tasks: 3, payout: 20.3, reversed: 1 });
    expect(j.today).toMatchObject({ tasks: 1, payout: 8.3, reversed: 1 }); // the ₹20 survey was reversed
    expect(j.month.tasks).toBe(2);
    expect(j.recent).toHaveLength(4);
    expect(j.recent[0]).toMatchObject({ partner: 'offerwall', category: 'game', taskName: 'Sea Battle', status: 'pending', user: 'userAA…' });
    expect(JSON.stringify(j.recent)).not.toMatch(/userAAAA1|userBBBB2/); // short uids only
  });
});
