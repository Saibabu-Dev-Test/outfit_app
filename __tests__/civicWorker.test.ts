// Worker civic routes (server/worker/src/civic): data by state/district/category, reviews
// (profanity filter, rate limit), reports (auto-hide), owner-only moderation + refresh, the
// 2-hourly research cron with caps, and the daily cron still running releaseHeld only.
// D1 is node:sqlite with the real migration SQL (same as apiWorker.test.ts).
const nodeCrypto = require('crypto');
const fsMod = require('fs');
const pathMod = require('path');
const NodeBuffer = require('buffer').Buffer;
const ROOT = (globalThis as any).process.cwd();
if (!(globalThis as any).crypto?.subtle) {
  (globalThis as any).crypto = nodeCrypto.webcrypto;
}
const { DatabaseSync } = require('node:sqlite');
const { clearJwksCache, JWKS_URL } = require('../server/worker/src/auth.js');
const { handleRequest, handleScheduled, CIVIC_CRON } = require('../server/worker/src/index.js');
const { Db } = require('../server/worker/src/db.js');
const { STATES } = require('../server/worker/src/civic/states.js');
const { hasProfanity, cleanReviewText } = require('../server/worker/src/civic/moderation.js');
const { geminiGenerate, parseJsonLoose, groundingSources } = require('../server/worker/src/civic/gemini.js');
const research = require('../server/worker/src/civic/research.js');
const routes = require('../server/worker/src/civic/routes.js');

import { INDIA_STATES } from '../src/constants/indiaStates';
import { civicItem, districtSlug } from '../src/services/civicApi';
import { hospitalFacts, hospitalSystem, withSafetyLine } from '../src/services/hospitalAi';
import { CIVIC_LABELS } from '../src/i18n/civicLabels';

jest.mock('../src/services/workerApi', () => ({ workerFetch: jest.fn() }));
jest.mock('../src/services/aiStylist', () => ({ askStylist: jest.fn(), isAiPaused: () => false }));

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
  return { raw: db, prepare: (sql: string) => new FakeStmt(db, sql), batch: async (stmts: any[]) => stmts.map(s => s.exec()) };
};

const { privateKey, publicKey } = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const NOW = Date.UTC(2026, 10, 18, 7, 0, 0);
const b64u = (o: any) => NodeBuffer.from(JSON.stringify(o)).toString('base64url');
const token = (claims: any = {}) => {
  const nowSec = Math.floor(NOW / 1000);
  const h = b64u({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
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
  const sig = nodeCrypto.sign('RSA-SHA256', NodeBuffer.from(`${h}.${p}`), privateKey).toString('base64url');
  return `${h}.${p}.${sig}`;
};
const OWNER = () => token({ sub: 'owner1', email: '2saibabug@gmail.com' });
const USER2 = () => token({ sub: 'user2' });

const GEMINI_HOSP = {
  candidates: [
    {
      content: {
        parts: [
          {
            text:
              '```json\n{"hospitals":[{"name":"NIMS","type":"Govt","address":"Punjagutta","phone":"040-23489000","emergency24x7":true,"specialities":["Cardiology"],"schemes":["Aarogyasri"],"website":"https://nims.edu.in","stars":4.2},{"name":"NIMS","stars":9}]}\n```',
          },
        ],
      },
      groundingMetadata: { groundingChunks: [{ web: { uri: 'https://nims.edu.in', title: 'NIMS' } }, { web: { uri: 'http://bad' } }] },
    },
  ],
};
const GEMINI_GOVT = {
  candidates: [{ content: { parts: [{ text: '{"overview":"Telangana state services.","departments":[{"name":"Health","website":"javascript:alert(1)"}],"helplines":[{"name":"Police","number":"100"}]}' }] } }],
};

const makeFetch = (gemini: any = GEMINI_HOSP, status = 200) =>
  jest.fn(async (url: string) => {
    if (url === JWKS_URL) {
      return { ok: true, status: 200, headers: { get: () => 'public, max-age=3600' }, json: async () => ({ keys: [jwk] }) };
    }
    if (url.includes('generativelanguage.googleapis.com')) {
      return { ok: status === 200, status, json: async () => gemini };
    }
    throw new Error('unexpected fetch ' + url);
  });

beforeEach(() => clearJwksCache());

const env = (extra: any = {}) => ({ DB: makeD1(), FIREBASE_PROJECT_ID: 'outfit-vote-9edca', ...extra });
const call = async (e: any, method: string, path: string, opts: { body?: any; tok?: string | null; now?: number; fetchImpl?: any } = {}) => {
  const headers: any = {};
  if (opts.tok !== null) headers.authorization = `Bearer ${opts.tok || token()}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const req = new Request(`https://outfit-api.example.workers.dev${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const waits: Promise<any>[] = [];
  const res = await handleRequest(req, e, { waitUntil: (p: Promise<any>) => waits.push(p) }, { fetchImpl: opts.fetchImpl || makeFetch(), now: opts.now || NOW });
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

describe('shared civic constants', () => {
  it('states match the app and labels are complete in EN/TE/HI', () => {
    expect(STATES).toEqual(INDIA_STATES);
    expect(STATES).toHaveLength(36);
    const keys = Object.keys(CIVIC_LABELS.English).sort();
    (['Telugu', 'Hindi'] as const).forEach(l => {
      expect(Object.keys(CIVIC_LABELS[l]).sort()).toEqual(keys);
      Object.values(CIVIC_LABELS[l]).forEach(v => expect(v.trim()).not.toBe(''));
    });
  });

  it('app item keys are accepted by the Worker', () => {
    expect(districtSlug(' Ranga Reddy ')).toBe('ranga-reddy');
    expect(districtSlug('Ranga Reddy')).toBe(routes.normDistrict('Ranga Reddy'));
    expect(civicItem('govt', 'TG')).toBe('govt:TG');
    expect(civicItem('govt', 'TG', 'Hyderabad')).toBe('govt:TG:hyderabad');
    expect(civicItem('hosp', 'TG', '', 'nims')).toBe('hosp:TG:state:nims');
    ['govt:TG', 'govt:TG:hyderabad', 'hosp:TG:state:nims', civicItem('hosp', 'AP', 'Guntur', 'GGH Guntur')].forEach(i => expect(routes.parseItem(i)).not.toBeNull());
    ['govt:XX', 'govt:tg', 'other:TG', 'govt:TG:Bad Name', ''].forEach(i => expect(routes.parseItem(i)).toBeNull());
  });

  it('wrangler keeps the daily cron and adds the civic cron; no secret values', () => {
    const toml = fsMod.readFileSync(pathMod.join(ROOT, 'server/worker/wrangler.toml'), 'utf8');
    expect(toml).toMatch(/crons = \["30 0 \* \* \*", "15 \*\/2 \* \* \*"\]/);
    expect(CIVIC_CRON).toBe('15 */2 * * *');
    expect(toml).not.toMatch(/GEMINI_API_KEY\s*=|AIza/);
  });
});

describe('moderation + gemini helpers', () => {
  it('profanity filter catches EN / HI / TE words and leetspeak, passes normal text', () => {
    ['Fuuuuck this', 'chutiya office', 'lanja', 'B1tch', 'मादरचोद'].forEach(t => expect(hasProfanity(t)).toBe(true));
    ['Staff were helpful, clean ward', 'Scunthorpe hospital', 'అద్భుతమైన సేవ', 'बहुत अच्छा अस्पताल'].forEach(t => expect(hasProfanity(t)).toBe(false));
  });

  it('review text drops links and phone numbers', () => {
    expect(cleanReviewText('Call 9876543210 or +91 98765 43210, see https://x.y now')).toBe('Call or , see now');
  });

  it('parses fenced JSON and keeps only https sources', () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('nope')).toBeNull();
    expect(groundingSources(GEMINI_HOSP.candidates[0])).toEqual([{ url: 'https://nims.edu.in', title: 'NIMS' }]);
  });

  it('missing key -> graceful not configured, no fetch', async () => {
    const f = makeFetch();
    expect(await geminiGenerate({}, { prompt: 'x' }, { fetchImpl: f })).toEqual({ ok: false, error: 'not configured' });
    expect(f).not.toHaveBeenCalled();
  });

  it('falls through models on 429 and sends the key only in the header', async () => {
    let n = 0;
    const f = jest.fn(async (url: string, init: any) => {
      expect(url).not.toMatch(/key=/);
      expect(init.headers['x-goog-api-key']).toBe('k');
      n++;
      return n === 1 ? { ok: false, status: 429, json: async () => ({}) } : { ok: true, status: 200, json: async () => GEMINI_GOVT };
    });
    const r = await geminiGenerate({ GEMINI_API_KEY: 'k' }, { prompt: 'x', grounded: true }, { fetchImpl: f });
    expect(r.ok).toBe(true);
    expect(JSON.parse(f.mock.calls[0][1].body).tools).toEqual([{ google_search: {} }]);
  });
});

describe('civic routes', () => {
  it('needs a token; validates kind/state/district', async () => {
    const e = env();
    expect((await call(e, 'GET', '/v1/civic/data?kind=govt&state=TG', { tok: null })).status).toBe(401);
    expect((await call(e, 'GET', '/v1/civic/data?kind=x&state=TG')).status).toBe(400);
    expect((await call(e, 'GET', '/v1/civic/data?kind=govt&state=ZZ')).status).toBe(400);
    expect((await call(e, 'GET', '/v1/civic/data?kind=hosp&state=TG&variant=other')).status).toBe(400);
  });

  it('state miss -> none; district miss -> queued pending; category alias works', async () => {
    const e = env();
    const a = await call(e, 'GET', '/v1/civic/data?kind=govt&state=TG');
    expect(a.json).toMatchObject({ status: 'none', data: null, aiConfigured: false });
    const b = await call(e, 'GET', '/v1/civic/data?category=hosp-govt&state=TG&district=Hyderabad');
    expect(b.json).toMatchObject({ kind: 'hosp', variant: 'govt', district: 'hyderabad', status: 'pending' });
    const c = await call(e, 'GET', '/v1/civic/data?category=hosp-govt&state=TG&district=hyderabad');
    expect(c.json.status).toBe('pending');
  });

  it('serves stored data without the owner-only sources', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const db = new Db(e.DB);
    expect(await research.researchOne(db, e, { kind: 'hosp', state: 'TG', variant: 'govt' }, { fetchImpl: makeFetch(), now: NOW })).toMatchObject({ ok: true });
    const r = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=TG&variant=govt');
    expect(r.json.status).toBe('ok');
    expect(r.json.data.hospitals).toHaveLength(1); // duplicate slug dropped
    expect(r.json.data.hospitals[0]).toMatchObject({ name: 'NIMS', slug: 'nims', emergency24x7: true, stars: 4.2 });
    expect(r.json.aiStars).toBe(4.2);
    expect(JSON.stringify(r.json)).not.toMatch(/sources/);
  });

  it('reviews: upsert one per user, profanity 422, stars 1-5, rate limit', async () => {
    const e = env();
    const item = 'govt:TG';
    expect((await call(e, 'POST', '/v1/civic/reviews', { body: { item, stars: 0, body: 'x' } })).status).toBe(400);
    expect((await call(e, 'POST', '/v1/civic/reviews', { body: { item: 'govt:ZZ', stars: 3 } })).status).toBe(400);
    expect((await call(e, 'POST', '/v1/civic/reviews', { body: { item, stars: 3, body: 'total chutiya service' } })).status).toBe(422);
    const ok = await call(e, 'POST', '/v1/civic/reviews', { body: { item, stars: 4, body: 'Good. Call 9876543210', userName: 'Sai' } });
    expect(ok.status).toBe(200);
    expect(ok.json.review).toMatchObject({ stars: 4, body: 'Good. Call', userName: 'Sai' });
    await call(e, 'POST', '/v1/civic/reviews', { body: { item, stars: 2, body: 'Changed my mind' } });
    await call(e, 'POST', '/v1/civic/reviews', { tok: USER2(), body: { item, stars: 5, body: 'Great' } });
    const list = await call(e, 'GET', `/v1/civic/reviews?item=${item}`);
    expect(list.json.count).toBe(2);
    expect(list.json.avg).toBe(3.5);
    expect(list.json.mine).toMatchObject({ stars: 2, body: 'Changed my mind' });
    for (let i = 0; i < routes.MAX_REVIEWS_PER_DAY - 2; i++) {
      await call(e, 'POST', '/v1/civic/reviews', { body: { item, stars: 3 } });
    }
    expect((await call(e, 'POST', '/v1/civic/reviews', { body: { item, stars: 3 } })).status).toBe(429);
  });

  it('bad photo rejected, https / small data image accepted', async () => {
    const e = env();
    expect((await call(e, 'POST', '/v1/civic/reviews', { body: { item: 'govt:AP', stars: 3, photo: 'javascript:x' } })).status).toBe(400);
    expect((await call(e, 'POST', '/v1/civic/reviews', { body: { item: 'govt:AP', stars: 3, photo: 'data:image/jpeg;base64,AAAA' } })).status).toBe(200);
  });

  it('reports: once per reporter, not own review, auto-hide at threshold', async () => {
    const e = env();
    const item = 'hosp:TG:state:nims';
    await call(e, 'POST', '/v1/civic/reviews', { body: { item, stars: 1, body: 'meh' } });
    expect((await call(e, 'POST', '/v1/civic/reports', { body: { item, author: 'user1' } })).status).toBe(400);
    expect((await call(e, 'POST', '/v1/civic/reports', { tok: USER2(), body: { item, author: 'nobody' } })).status).toBe(404);
    const r1 = await call(e, 'POST', '/v1/civic/reports', { tok: USER2(), body: { item, author: 'user1', reason: 'spam' } });
    expect(r1.json).toEqual({ ok: true, alreadyReported: false });
    expect((await call(e, 'POST', '/v1/civic/reports', { tok: USER2(), body: { item, author: 'user1' } })).json.alreadyReported).toBe(true);
    for (let i = 3; i < 3 + routes.AUTO_HIDE_REPORTS - 1; i++) {
      await call(e, 'POST', '/v1/civic/reports', { tok: token({ sub: `u${i}` }), body: { item, author: 'user1' } });
    }
    expect((await call(e, 'GET', `/v1/civic/reviews?item=${item}`, { tok: USER2() })).json.count).toBe(0);
    // author still sees it as hidden
    expect((await call(e, 'GET', `/v1/civic/reviews?item=${item}`)).json.mine.hidden).toBe(true);
  });

  it('admin routes are owner only; hide / unhide; refresh needs the key', async () => {
    const e = env();
    const item = 'govt:KA';
    await call(e, 'POST', '/v1/civic/reviews', { body: { item, stars: 2, body: 'slow office' } });
    expect((await call(e, 'GET', '/v1/admin/civic')).status).toBe(403);
    expect((await call(e, 'POST', '/v1/admin/civic/review', { body: { item, uid: 'user1', hidden: true } })).status).toBe(403);
    expect((await call(e, 'POST', '/v1/admin/civic/refresh', { body: { kind: 'govt', state: 'KA' } })).status).toBe(403);
    const snap = await call(e, 'GET', '/v1/admin/civic', { tok: OWNER() });
    expect(snap.json).toMatchObject({ aiConfigured: false, aiToday: 0, aiDailyMax: research.CIVIC_DAILY_MAX });
    expect(snap.json.recent).toHaveLength(1);
    await call(e, 'POST', '/v1/admin/civic/review', { tok: OWNER(), body: { item, uid: 'user1', hidden: true } });
    expect((await call(e, 'GET', `/v1/civic/reviews?item=${item}`, { tok: USER2() })).json.count).toBe(0);
    await call(e, 'POST', '/v1/admin/civic/review', { tok: OWNER(), body: { item, uid: 'user1', hidden: false } });
    expect((await call(e, 'GET', `/v1/civic/reviews?item=${item}`, { tok: USER2() })).json.count).toBe(1);
    expect((await call(e, 'POST', '/v1/admin/civic/refresh', { tok: OWNER(), body: { kind: 'govt', state: 'KA' } })).status).toBe(503);
    const e2 = env({ GEMINI_API_KEY: 'k' });
    const r = await call(e2, 'POST', '/v1/admin/civic/refresh', { tok: OWNER(), body: { kind: 'govt', state: 'TG' }, fetchImpl: makeFetch(GEMINI_GOVT) });
    expect(r.json).toMatchObject({ ok: true, kind: 'govt', state: 'TG' });
    const g = await call(e2, 'GET', '/v1/civic/data?kind=govt&state=TG');
    expect(g.json.data.overview).toBe('Telangana state services.');
    expect(g.json.data.departments[0].website).toBe(''); // non-https dropped
    expect(g.json.aiStars).toBeNull();
  });
});

describe('research cron', () => {
  it('pickTargets: pending districts first, then missing states, then stale', () => {
    const rows = [
      { kind: 'govt', state: 'TG', district: 'hyderabad', variant: '', status: 'pending', updated_at: NOW },
      { kind: 'govt', state: 'AP', district: '', variant: '', status: 'ok', updated_at: NOW - research.CIVIC_REFRESH_MS - 1 },
    ];
    const t = research.pickTargets(rows, NOW, 200);
    expect(t[0]).toEqual({ kind: 'govt', state: 'TG', district: 'hyderabad', variant: '' });
    expect(t[1]).toEqual({ kind: 'hosp', state: 'AP', district: '', variant: 'govt' }); // AP govt row exists
    expect(t[t.length - 1]).toEqual({ kind: 'govt', state: 'AP', district: '', variant: '' });
    expect(t).toHaveLength(1 + 36 * 3 - 1 + 1);
  });

  it('civic cron: skips without key; runs CIVIC_PER_RUN; stops at the daily cap; never touches earn', async () => {
    const e0 = env();
    const f0 = makeFetch();
    await handleScheduled({ cron: CIVIC_CRON }, e0, null, { fetchImpl: f0, now: NOW });
    expect(f0).not.toHaveBeenCalled();

    const e = env({ GEMINI_API_KEY: 'k' });
    const f = makeFetch();
    await handleScheduled({ cron: CIVIC_CRON }, e, null, { fetchImpl: f, now: NOW });
    expect(f).toHaveBeenCalledTimes(research.CIVIC_PER_RUN);
    const rows = e.DB.raw.prepare('SELECT COUNT(*) AS n FROM civic_data').get();
    expect(Number(rows.n)).toBe(research.CIVIC_PER_RUN);

    const db = new Db(e.DB);
    const r = await research.runCivicResearch(db, e, { fetchImpl: f, now: NOW, perRun: 100, dailyMax: research.CIVIC_PER_RUN + 2 });
    expect(r.ran).toBe(2);
    expect((await research.runCivicResearch(db, e, { fetchImpl: f, now: NOW, dailyMax: research.CIVIC_PER_RUN + 2 })).skipped).toBe('daily cap reached');
  });

  it('failed research keeps the last good data', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const db = new Db(e.DB);
    await research.researchOne(db, e, { kind: 'hosp', state: 'TG', variant: 'private' }, { fetchImpl: makeFetch(), now: NOW });
    const bad = await research.researchOne(db, e, { kind: 'hosp', state: 'TG', variant: 'private' }, { fetchImpl: makeFetch({ candidates: [{ content: { parts: [{ text: 'sorry' }] } }] }), now: NOW + 1000 });
    expect(bad.ok).toBe(false);
    const row = e.DB.raw.prepare("SELECT status, data, updated_at FROM civic_data WHERE kind='hosp' AND state='TG' AND variant='private'").get();
    expect(row.status).toBe('ok');
    expect(JSON.parse(row.data).hospitals[0].name).toBe('NIMS');
    expect(Number(row.updated_at)).toBe(NOW);
  });

  it('daily cron still runs releaseHeld only (no Gemini call)', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const f = makeFetch();
    e.DB.raw.exec(
      "INSERT INTO earnings (uid, id, type, partner, status, rupees, owner_rupees, hold_until, created_at, updated_at) VALUES ('u', 'x1', 'survey', 'cpx', 'pending', 5, 1, 0, 0, 0)",
    );
    await handleScheduled({ cron: '30 0 * * *' }, e, null, { fetchImpl: f, now: NOW });
    expect(f).not.toHaveBeenCalled();
    expect(e.DB.raw.prepare("SELECT status FROM earnings WHERE id='x1'").get().status).toBe('approved');
  });
});

describe('Hospital AI prompt (app)', () => {
  const h = { name: 'NIMS', slug: 'nims', type: 'Govt', district: '', address: 'Punjagutta', phone: '040', emergency24x7: true, specialities: ['Cardiology'], schemes: [], website: '', stars: 4.2, note: '' };
  it('grounds on the stored list only, no diagnosis, 108/112 + verify', () => {
    const sys = hospitalSystem('English', hospitalFacts('Hyderabad', [h]));
    expect(sys).toMatch(/ONLY the hospital list/);
    expect(sys).toMatch(/Never diagnose/);
    expect(sys).toMatch(/108/);
    expect(sys).toMatch(/112/);
    expect(sys).toMatch(/verify with the hospital/i);
    expect(sys).toMatch(/1\. NIMS; type: Govt; address: Punjagutta; phone: 040; 24x7 emergency: yes; specialities: Cardiology; public rating: 4.2\/5/);
    expect(withSafetyLine('Go to NIMS.', 'Telugu')).toMatch(/108[\s\S]*112/);
    expect(withSafetyLine('Call 108 or 112.', 'English')).toBe('Call 108 or 112.');
  });
});
