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
  jest.fn(async (url: string, init?: any) => {
    if (url === JWKS_URL) {
      return { ok: true, status: 200, headers: { get: () => 'public, max-age=3600' }, json: async () => ({ keys: [jwk] }) };
    }
    if (url.includes('generativelanguage.googleapis.com')) {
      const sent = JSON.parse((init && init.body) || '{}');
      const prompt = sent?.contents?.[0]?.parts?.[0]?.text || '';
      if (status === 200 && prompt.startsWith('Translate the text values')) {
        const j = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
        if (j.overview !== undefined) j.overview = `TR ${j.overview}`;
        if (Array.isArray(j.hospitals)) j.hospitals = j.hospitals.map((h: any) => ({ ...h, name: `TR ${h.name}` }));
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(j) }] } }] }) };
      }
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
    expect(toml).toMatch(/crons = \["30 0 \* \* \*", "\*\/20 \* \* \* \*"\]/);
    expect(CIVIC_CRON).toBe('*/20 * * * *');
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
    expect(await geminiGenerate({}, { prompt: 'x' }, { fetchImpl: f })).toEqual({ ok: false, error: 'not configured', code: 'config' });
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

  it('state / district miss -> queued pending; category alias works', async () => {
    const e = env();
    const a = await call(e, 'GET', '/v1/civic/data?kind=govt&state=TG');
    expect(a.json).toMatchObject({ status: 'pending', data: null, aiConfigured: false, sources: [] });
    const b = await call(e, 'GET', '/v1/civic/data?category=hosp-govt&state=TG&district=Hyderabad');
    expect(b.json).toMatchObject({ kind: 'hosp', variant: 'govt', district: 'hyderabad', status: 'pending' });
    const c = await call(e, 'GET', '/v1/civic/data?category=hosp-govt&state=TG&district=hyderabad');
    expect(c.json.status).toBe('pending');
  });

  it('serves stored data with its https sources, no AI stars, map link', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const db = new Db(e.DB);
    expect(await research.researchOne(db, e, { kind: 'hosp', state: 'TG', variant: 'govt' }, { fetchImpl: makeFetch(), now: NOW })).toMatchObject({ ok: true });
    const r = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=TG&variant=govt');
    expect(r.json.status).toBe('ok');
    expect(r.json.data.hospitals).toHaveLength(1); // duplicate slug dropped
    expect(r.json.data.hospitals[0]).toMatchObject({ name: 'NIMS', slug: 'nims', emergency24x7: true, phone: '040-23489000' });
    expect(r.json.data.hospitals[0].stars).toBeUndefined();
    expect(r.json.data.hospitals[0].mapUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=NIMS/);
    expect(r.json.aiStars).toBeNull();
    expect(r.json.sources).toEqual([{ url: 'https://nims.edu.in', title: 'NIMS' }]);
    expect(r.json.i18n).toEqual({ te: null, hi: null });
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
    expect(snap.json).toMatchObject({ aiConfigured: false, aiToday: 0, aiDailyMax: research.CIVIC_DAILY_MAX, trToday: 0 });
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
    // owner refresh also translates into Telugu + Hindi
    expect(g.json.i18n.te.overview).toBe('TR Telangana state services.');
    expect(g.json.i18n.hi.overview).toBe('TR Telangana state services.');
  });
});

describe('on-demand research', () => {
  it('no key -> ai_off; research now; then translate the asked language; locked + capped', async () => {
    const e0 = env();
    const off = await call(e0, 'POST', '/v1/civic/research', { body: { kind: 'hosp', state: 'AP', district: 'Kurnool', variant: 'govt', lang: 'te' } });
    expect(off.json).toMatchObject({ ok: false, status: 'ai_off' });

    const e = env({ GEMINI_API_KEY: 'k' });
    const body = { kind: 'hosp', state: 'AP', district: 'Kurnool', variant: 'govt', lang: 'te' };
    const pend = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=Kurnool&variant=govt');
    expect(pend.json.status).toBe('pending');
    const r1 = await call(e, 'POST', '/v1/civic/research', { body });
    expect(r1.json).toMatchObject({ ok: true, status: 'ok', did: 'research', district: 'kurnool' });
    // the asked language is translated in the same run as the research
    expect(r1.json.translated).toEqual(['te']);
    const d1 = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=kurnool&variant=govt');
    expect(d1.json.status).toBe('ok');
    expect(d1.json.i18n.te.hospitals[0].name).toBe('TR NIMS');
    expect(d1.json.i18n.te.hospitals[0].phone).toBe('040-23489000');
    expect(d1.json.i18n.hi).toBeNull();
    // another app language (Tamil) is translated on request and served with ?lang=ta
    const r2 = await call(e, 'POST', '/v1/civic/research', { body: { ...body, lang: 'ta' } });
    expect(r2.json).toMatchObject({ ok: true, did: 'translate', lang: 'ta' });
    const d2 = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=kurnool&variant=govt&lang=ta');
    expect(d2.json.i18n.ta.hospitals[0].name).toBe('TR NIMS');
    expect(d2.json.i18n.ta.hospitals[0].mapUrl).toBe(d2.json.data.hospitals[0].mapUrl);
    const r3 = await call(e, 'POST', '/v1/civic/research', { body });
    expect(r3.json.did).toBe('nothing');

    // lock: a run started a moment ago blocks a second one
    e.DB.raw.prepare("INSERT INTO civic_data (kind, state, district, variant, status, updated_at, running_at) VALUES ('govt','AP','kurnool','','pending',?,?)").run(NOW, NOW - 1000);
    const f = makeFetch(GEMINI_GOVT);
    const locked = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'govt', state: 'AP', district: 'kurnool' }, fetchImpl: f });
    expect(locked.json.status).toBe('running');
    expect((await call(e, 'GET', '/v1/civic/data?kind=govt&state=AP&district=kurnool', { fetchImpl: f })).json).toMatchObject({ status: 'pending', running: true });

    // per-user cap
    const e2 = env({ GEMINI_API_KEY: 'k' });
    e2.DB.raw.prepare('INSERT INTO usage (day, key, n) VALUES (?, ?, ?)').run('2026-11-18', 'civic_od:user1', routes.MAX_RESEARCH_PER_USER_DAY);
    expect((await call(e2, 'POST', '/v1/civic/research', { body })).status).toBe(429);
  });

  it('govt cleaner keeps leaders, MPs / MLAs, offices, grievance, election; drops bad urls / letters in phones', () => {
    const g = research.cleanGovt({
      overview: 'Kurnool district.',
      state: { governor: 'G', chiefMinister: { name: 'CM', party: 'P' }, deputyCMs: [{ name: 'D', party: 'Q', role: 'Panchayat Raj' }], ministers: [{ name: 'M', portfolio: 'Health' }, { party: 'x' }] },
      district: { collector: 'C', sp: 'S', mps: [{ name: 'MP1', constituency: 'Kurnool', party: 'P' }], mlas: [{ name: 'L1', constituency: 'Kurnool', party: 'P' }] },
      offices: [{ name: 'Collectorate', phone: '08518-abc277305', website: 'http://x' }],
      schemes: [{ name: 'PM-JAY', level: 'Central' }, { name: 'Pension' }],
      grievance: [{ name: 'CPGRAMS', website: 'https://pgportal.gov.in' }],
      election: { voterHelpline: '1950', ceoWebsite: 'https://ceoandhra.nic.in' },
    });
    expect(g.leaders.chiefMinister).toEqual({ name: 'CM', party: 'P', role: '' });
    expect(g.leaders.ministers).toEqual([{ name: 'M', party: '', role: 'Health' }]);
    expect(g.district.mlas[0]).toEqual({ name: 'L1', constituency: 'Kurnool', party: 'P' });
    expect(g.offices[0]).toMatchObject({ phone: '', website: '' }); // letters in a phone: dropped, not repaired
    expect(g.schemes.map((x: any) => x.level)).toEqual(['central', 'state']);
    expect(g.election).toMatchObject({ voterHelpline: '1950', ceoWebsite: 'https://ceoandhra.nic.in' });
    const p = research.researchPrompt('govt', '', STATES[0], 'kurnool');
    expect(p).toMatch(/Collector/);
    expect(p).toMatch(/MLAs/);
    expect(p).toMatch(/Never invent phone numbers/);
    expect(research.researchPrompt('hosp', 'govt', STATES[0], 'kurnool')).toMatch(/Dr NTR Vaidya Seva/);
  });
});

describe('research cron', () => {
  it('pickTargets: pending districts first, then missing states, then stale', () => {
    const rows = [
      { kind: 'govt', state: 'TG', district: 'hyderabad', variant: '', status: 'pending', updated_at: NOW },
      { kind: 'govt', state: 'AP', district: '', variant: '', status: 'ok', updated_at: NOW - research.CIVIC_REFRESH_MS - 1 },
    ];
    const t = research.pickTargets(rows, NOW, 200, {});
    expect(t[0]).toEqual({ kind: 'govt', state: 'TG', district: 'hyderabad', variant: '' });
    expect(t[1]).toEqual({ kind: 'hosp', state: 'AP', district: '', variant: 'govt' }); // AP govt row exists
    expect(t[t.length - 1]).toEqual({ kind: 'govt', state: 'AP', district: '', variant: '' });
    // 36 states x (govt + 2 hosp + gcmp) + the centre's gcmp, minus the AP govt row that exists
    expect(t).toHaveLength(1 + 36 * 4 + 1 - 1 + 1);
  });

  it('civic cron: skips without key; runs CIVIC_PER_RUN; stops at the daily cap; never touches earn', async () => {
    const e0 = env();
    const f0 = makeFetch();
    await handleScheduled({ cron: CIVIC_CRON }, e0, null, { fetchImpl: f0, now: NOW });
    expect(f0).not.toHaveBeenCalled();

    const e = env({ GEMINI_API_KEY: 'k' });
    const f = makeFetch();
    await handleScheduled({ cron: CIVIC_CRON }, e, null, { fetchImpl: f, now: NOW });
    const rows = e.DB.raw.prepare('SELECT COUNT(*) AS n FROM civic_data').get();
    expect(Number(rows.n)).toBe(research.CIVIC_PER_RUN);
    // AP govt (3 parallel grounded parts) + AP govt hospitals + AP private hospitals
    const used = e.DB.raw.prepare("SELECT key, n FROM usage WHERE key IN ('civic_ai','civic_tr')").all();
    expect(used.find((u: any) => u.key === 'civic_ai').n).toBe(5);
    // te + hi translated together with the research (cron languages)
    const i18n = e.DB.raw.prepare("SELECT lang FROM civic_i18n WHERE kind='hosp' AND state='AP' AND variant='govt' ORDER BY lang").all();
    expect(i18n.map((x: any) => x.lang)).toEqual(['hi', 'te']);

    const db = new Db(e.DB);
    // 2 calls left today: AP comparison (1 call) fits, AR govt (3 calls) does not
    const r = await research.runCivicResearch(db, e, { fetchImpl: f, now: NOW, perRun: 100, dailyMax: 7, translate: false });
    expect(r.ran).toBe(1);
    expect(r.results[0]).toMatchObject({ kind: 'gcmp', state: 'AP' });
    expect((await research.runCivicResearch(db, e, { fetchImpl: f, now: NOW, dailyMax: 6, translate: false })).skipped).toBe('daily cap reached');
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
    expect(sys).toMatch(/1\. NIMS; type: Govt; address: Punjagutta; phone: 040; 24x7 emergency: yes; specialities: Cardiology$/m);
    expect(sys).not.toMatch(/rating/); // no AI / public ratings fed to the AI
    expect(withSafetyLine('Go to NIMS.', 'Telugu')).toMatch(/108[\s\S]*112/);
    expect(withSafetyLine('Call 108 or 112.', 'English')).toBe('Call 108 or 112.');
  });
});

// ── Previous vs present government (kind 'gcmp') + hospitals v2 fields (migration 0005) ──
const CMP = {
  asOf: '2026-11',
  previous: { label: '2019-2024 government', head: 'A', party: 'P1', from: '2019-05', to: '2024-06', source: 'https://example.gov.in/a' },
  present: { label: '2024- government', head: 'B', party: 'P2', from: '2024-06', to: '', source: 'https://example.gov.in/b', verdict: 'better' },
  verdict: 'present is best',
  rows: [
    { area: 'schemes', topic: 'Old-age pension amount', previous: { text: 'Rs 3,000 a month', source: 'https://example.gov.in/p1', date: '2024-01-01' }, present: { text: 'Rs 4,000 a month', source: 'https://example.gov.in/p2', date: '2024-07-01' } },
    { area: 'budget', topic: 'State budget size', previous: { text: 'Rs 2.79 lakh crore (2023-24)', source: 'https://example.gov.in/b1', date: '2023-02' }, present: { text: 'no source given', date: '2025-02' } },
    { area: 'projects', topic: 'Capital city works', previous: { text: 'Works paused', source: 'http://insecure.example', date: '2020' }, present: { text: 'Works resumed', source: 'https://example.gov.in/c', date: 'last year' } },
    { area: 'started', topic: 'New scheme', previous: null, present: { text: 'The best scheme ever launched', source: 'https://example.gov.in/s', date: '2025-01-01' } },
    { area: 'opinion', topic: 'Who did better', previous: { text: 'x', source: 'https://a.in', date: '2020' }, present: null },
    { area: 'stopped', topic: 'Scheme X', previous: { text: 'Scheme X ran from 2020', source: 'https://example.gov.in/x', date: '2020-03' }, present: { text: 'Merged into Scheme Y by GO 12', source: 'https://example.gov.in/go12', date: '2024-09-15' } },
  ],
};
const gemini = (obj: any) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.gov.in/a', title: 'A' } }] } }] });

describe('previous vs present government (gcmp)', () => {
  it('cleaner keeps only sourced + dated neutral facts; no verdict field survives', () => {
    const c = research.cleanCompare(CMP);
    expect(c).not.toHaveProperty('verdict');
    expect(c.present).not.toHaveProperty('verdict');
    expect(c.previous).toEqual({ label: '2019-2024 government', head: 'A', party: 'P1', from: '2019-05', to: '2024-06', source: 'https://example.gov.in/a' });
    expect(c.rows.map((r: any) => r.topic)).toEqual(['Old-age pension amount', 'State budget size', 'Scheme X']);
    expect(c.rows[1].present).toBeNull(); // no source URL
    expect(c.rows[0].present).toEqual({ text: 'Rs 4,000 a month', source: 'https://example.gov.in/p2', date: '2024-07-01' });
    // http source / non-date row dropped; "best" (opinion) dropped; unknown area dropped
    expect(research.OPINION_RE.test('Pension raised to Rs 4,000')).toBe(false);
    expect(research.OPINION_RE.test('a failed scheme')).toBe(true);
    const p = research.researchPrompt('gcmp', '', STATES.find((x: any) => x.code === 'AP'), '');
    expect(p).toMatch(/NEUTRAL side-by-side/);
    expect(p).toMatch(/No opinion, no verdict/);
    expect(p).toMatch(/source URL and a date/);
    expect(research.researchPrompt('gcmp', '', { code: 'IN', name: 'Union', type: 'centre' }, '')).toMatch(/Union Government of India/);
  });

  it('routes: gcmp for a state or the centre (IN), state level only; IN only for gcmp', async () => {
    const e = env();
    expect((await call(e, 'GET', '/v1/civic/data?kind=gcmp&state=TG')).json).toMatchObject({ kind: 'gcmp', state: 'TG', status: 'pending' });
    expect((await call(e, 'GET', '/v1/civic/data?kind=gcmp&state=IN')).json).toMatchObject({ kind: 'gcmp', state: 'IN', status: 'pending' });
    expect((await call(e, 'GET', '/v1/civic/data?kind=gcmp&state=TG&district=hyderabad')).status).toBe(400);
    expect((await call(e, 'GET', '/v1/civic/data?kind=govt&state=IN')).status).toBe(400);
    expect((await call(e, 'GET', '/v1/civic/data?kind=hosp&state=IN&variant=govt')).status).toBe(400);
    expect(routes.parseItem('gcmp:TG')).toBeNull(); // no reviews / ratings on the comparison
  });

  it('research + translation: the translated copy keeps the English source URLs and dates', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const f = jest.fn(async (url: string, init?: any) => {
      if (url === JWKS_URL) {
        return { ok: true, status: 200, headers: { get: () => 'public, max-age=3600' }, json: async () => ({ keys: [jwk] }) };
      }
      const prompt = JSON.parse(init.body).contents[0].parts[0].text;
      if (prompt.startsWith('Translate the text values')) {
        const j = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
        j.rows = j.rows.map((r: any) => ({
          ...r,
          topic: `TR ${r.topic}`,
          previous: r.previous ? { ...r.previous, text: `TR ${r.previous.text}`, source: 'https://wrong.example', date: '౨౦౨౪' } : null,
          present: r.present ? { ...r.present, text: `TR ${r.present.text}`, date: 'translated' } : null,
        }));
        return { ok: true, status: 200, json: async () => gemini(j) };
      }
      return { ok: true, status: 200, json: async () => gemini(CMP) };
    });
    const r = await call(e, 'POST', '/v1/admin/civic/refresh', { tok: OWNER(), body: { kind: 'gcmp', state: 'IN' }, fetchImpl: f });
    expect(r.json).toMatchObject({ ok: true, kind: 'gcmp', state: 'IN' });
    const g = await call(e, 'GET', '/v1/civic/data?kind=gcmp&state=IN');
    expect(g.json.data.rows).toHaveLength(3);
    expect(g.json.sources[0].url).toBe('https://example.gov.in/a');
    const te = g.json.i18n.te;
    expect(te.rows).toHaveLength(3);
    expect(te.rows[0].topic).toBe('TR Old-age pension amount');
    expect(te.rows[0].previous).toEqual({ text: 'TR Rs 3,000 a month', source: 'https://example.gov.in/p1', date: '2024-01-01' });
    expect(te.rows[0].present.date).toBe('2024-07-01');
    const row = e.DB.raw.prepare("SELECT schema_v FROM civic_data WHERE kind='gcmp' AND state='IN'").get();
    expect(Number(row.schema_v)).toBe(research.CIVIC_SCHEMA.gcmp);
  });
});

describe('hospitals v2 fields (public-source only)', () => {
  const RAW = {
    hospitals: [
      {
        name: 'GGH Kurnool',
        type: 'Government General Hospital',
        address: 'Kurnool',
        phone: '08518-abc',
        timings: 'OPD 9 AM - 1 PM',
        emergency24x7: true,
        specialities: ['Cardiology', 'Nephrology'],
        specialFor: ['Kidney transplant'],
        facilities: ['ICU', 'Dialysis', 'Blood bank'],
        doctors: [
          { name: 'Dr A', speciality: 'Cardiology', qualification: 'DM', experience: '15 years', source: 'https://ggh.example.gov.in/doctors' },
          { name: 'Dr B', speciality: 'Neurology', experience: 'many', source: 'https://ggh.example.gov.in/doctors' },
          { name: 'Dr Invented', speciality: 'Surgery', experience: '10 years' },
        ],
        schemes: ['Dr NTR Vaidya Seva', 'PM-JAY'],
        sources: ['https://ggh.example.gov.in', 'http://bad', 'https://ggh.example.gov.in'],
      },
      { name: 'Small CHC' },
    ],
  };

  it('keeps sourced doctors only, experience only as published, empty when unknown', () => {
    const c = research.cleanHosp(RAW, 'Kurnool, Andhra Pradesh');
    const h = c.hospitals[0];
    expect(h).toMatchObject({ timings: 'OPD 9 AM - 1 PM', specialFor: ['Kidney transplant'], facilities: ['ICU', 'Dialysis', 'Blood bank'], phone: '' });
    expect(h.doctors).toEqual([
      { name: 'Dr A', speciality: 'Cardiology', qualification: 'DM', experience: '15 years', source: 'https://ggh.example.gov.in/doctors' },
      { name: 'Dr B', speciality: 'Neurology', qualification: '', experience: '', source: 'https://ggh.example.gov.in/doctors' },
    ]);
    expect(h.sources).toEqual(['https://ggh.example.gov.in']);
    expect(c.hospitals[1]).toMatchObject({ timings: '', specialFor: [], facilities: [], doctors: [], sources: [], emergency24x7: false, phone: '' });
    const p = research.researchPrompt('hosp', 'govt', STATES.find((x: any) => x.code === 'AP'), 'kurnool');
    expect(p).toMatch(/Never invent a doctor/);
    expect(p).toMatch(/specialFor/);
    expect(p).toMatch(/timings/);
  });

  it('keepFixed restores URLs / phones / dates from English, by position', () => {
    const en = { hospitals: [{ name: 'A', phone: '040-1', website: 'https://a.in', doctors: [{ name: 'D', source: 'https://a.in/d' }] }] };
    const tr = { hospitals: [{ name: 'అ', phone: '౦౪౦', website: 'https://x', doctors: [{ name: 'డి', source: '' }] }] };
    expect(research.keepFixed(en, tr)).toEqual({ hospitals: [{ name: 'అ', phone: '040-1', website: 'https://a.in', doctors: [{ name: 'డి', source: 'https://a.in/d' }] }] });
    // different array length: left as translated (the cleaner then decides)
    expect(research.keepFixed([1, 2], ['x'])).toEqual(['x']);
  });

  it('migration 0005: old rows get schema_v 1 and are re-researched (after missing ones); new hosp rows are v2', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    e.DB.raw
      .prepare("INSERT INTO civic_data (kind, state, district, variant, data, status, updated_at) VALUES ('hosp','TG','','govt','{\"hospitals\":[{\"name\":\"Old\"}]}','ok',?)")
      .run(NOW - 1000);
    const old = e.DB.raw.prepare("SELECT schema_v, data FROM civic_data WHERE kind='hosp' AND state='TG'").get();
    expect(Number(old.schema_v)).toBe(1);
    const rows = e.DB.raw.prepare('SELECT * FROM civic_data').all();
    const t = research.pickTargets(rows, NOW, 2000);
    const at = t.findIndex((x: any) => x.kind === 'hosp' && x.state === 'TG' && x.variant === 'govt' && !x.district);
    expect(at).toBe(t.length - 1); // outdated comes after all missing rows
    expect(t.filter((x: any) => x.kind === 'hosp' && x.state === 'TG' && x.variant === 'govt' && !x.district)).toHaveLength(1);
    // fresh v2 row is not outdated
    const db = new Db(e.DB);
    await research.researchOne(db, e, { kind: 'hosp', state: 'TG', variant: 'govt' }, { fetchImpl: makeFetch(), now: NOW });
    const nw = e.DB.raw.prepare("SELECT schema_v FROM civic_data WHERE kind='hosp' AND state='TG' AND variant='govt'").get();
    expect(Number(nw.schema_v)).toBe(2);
    const t2 = research.pickTargets(e.DB.raw.prepare('SELECT * FROM civic_data').all(), NOW, 2000);
    expect(t2.some((x: any) => x.kind === 'hosp' && x.state === 'TG' && x.variant === 'govt' && !x.district)).toBe(false);
  });

  it('free-tier caps (overridable by Worker vars) and the fastest-first free model list', () => {
    expect(research.CIVIC_PER_RUN).toBe(3);
    expect(research.CIVIC_DAILY_MAX).toBe(150);
    expect(research.CIVIC_TR_DAILY_MAX).toBe(300);
    expect(research.civicCaps({})).toEqual({ perRun: 3, dailyMax: 150, trDailyMax: 300, askDailyMax: 300 });
    expect(research.civicCaps({ CIVIC_DAILY_MAX: '200', CIVIC_PER_RUN: 'x', CIVIC_TR_DAILY_MAX: '' })).toMatchObject({ dailyMax: 200, perRun: 3, trDailyMax: 300 });
    expect(research.civicCaps({ CIVIC_PER_RUN: '99' }).perRun).toBe(8);
    const { GEMINI_MODELS } = require('../server/worker/src/civic/gemini.js');
    expect(GEMINI_MODELS).toEqual(['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.8-flash']);
  });
});
