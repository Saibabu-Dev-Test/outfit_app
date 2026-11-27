// Never-stop AI chain (research.js researchFallbackChain) + the keyless comparison source
// (free/compare.js, kind 'gcmp'): every Gemini key x every model (Flash-Lite included) first, then
// keyless Wikidata + Wikipedia, then Groq ONLY with GROQ_API_KEY, then the last saved data
// ({ok: true, status: 'saved'}), else {ok: false, status: 'none'}. No reply ever says 'paused'.
// Every comparison fact keeps its own cited https source + a date inside that government's term,
// or it is dropped. fetch is mocked; D1 is node:sqlite with the real migration SQL.
export {}; // a module: its names do not clash with the other test files
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
const { handleRequest } = require('../server/worker/src/index.js');
const { STATES } = require('../server/worker/src/civic/states.js');
const { Db } = require('../server/worker/src/db.js');
const research = require('../server/worker/src/civic/research.js');
const compare = require('../server/worker/src/civic/free/compare.js');
const gemini = require('../server/worker/src/civic/gemini.js');

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
const NOW = Date.UTC(2026, 10, 22, 7, 0, 0);
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

const res = (body: any, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });


const lit = (v: string) => ({ type: 'literal', value: v });
const uri = (v: string) => ({ type: 'uri', value: v });
const WD = 'http://www.wikidata.org/entity/';
// Wikidata: three Chief Minister terms of AP + two ministries (real shape of the terms query)
const TERMS = {
  results: {
    bindings: [
      { kind: lit('term'), p: uri(`${WD}Q1`), pLabel: lit('Nara Chandrababu Naidu'), start: lit('2014-06-08T00:00:00Z'), end: lit('2019-05-29T00:00:00Z'), partyLabel: lit('Telugu Desam Party'), article: uri('https://en.wikipedia.org/wiki/N._Chandrababu_Naidu') },
      { kind: lit('term'), p: uri(`${WD}Q2`), pLabel: lit('Y. S. Jaganmohan Reddy'), start: lit('2019-05-30T00:00:00Z'), end: lit('2024-06-11T00:00:00Z'), partyLabel: lit('YSR Congress Party'), article: uri('https://en.wikipedia.org/wiki/Y._S._Jagan_Mohan_Reddy') },
      { kind: lit('term'), p: uri(`${WD}Q1`), pLabel: lit('Nara Chandrababu Naidu'), start: lit('2024-06-12T00:00:00Z'), partyLabel: lit('Telugu Desam Party'), article: uri('https://en.wikipedia.org/wiki/N._Chandrababu_Naidu') },
      { kind: lit('ministry'), xl: lit('Y. S. Jaganmohan Reddy Ministry'), mstart: lit('2019-05-30T00:00:00Z'), article: uri('https://en.wikipedia.org/wiki/Y._S._Jagan_Mohan_Reddy_ministry') },
      { kind: lit('ministry'), xl: lit('Fourth N. Chandrababu Naidu ministry'), mstart: lit('2024-06-12T00:00:00Z'), article: uri('https://en.wikipedia.org/wiki/Fourth_N._Chandrababu_Naidu_ministry') },
    ],
  },
};
const PRESENT_WT = [
  '==Major decisions==',
  'On 13 June 2024, the government increased social security pensions from Rs. 3,000 to Rs. 4,000 under the NTR Bharosa Pension Scheme.<ref>{{Cite news |date=2024-06-14 |title=Pensions |url=https://www.thehindu.com/pension-2024}}</ref>',
  'The government re-launched the Anna Canteen program on 15 August 2024, discontinued earlier.<ref name="ac">{{Cite web |date=2024-08-15 |url=https://www.deccanchronicle.com/anna-canteen |title=Anna}}</ref>',
  'The opposition alleged that the pension scheme payments were delayed in many districts.<ref>{{Cite news |date=2024-07-01 |url=https://example.com/alleged}}</ref>',
  'Works on the Amaravati capital city project restarted in May 2025 after a long gap.',
  'The landmark Polavaram irrigation project was moved forward with central funds.<ref>{{cite news |date=2024-09-01 |url=https://example.com/landmark}}</ref>',
  'The government launched a free gas cylinder scheme for poor families in the state.<ref>{{cite news |date=2019-11-01 |url=https://example.com/old-date}}</ref>',
].join('\n');
const PREVIOUS_WT = [
  '===2019–2024: As Chief Minister===',
  "In January 2020, Reddy launched the Jagananna Amma Vodi scheme, giving ₹15,000 a year to mothers.<ref>{{cite news|url=https://www.newindianexpress.com/amma-vodi|date=9 January 2020|title=t}}</ref>",
  'He scrapped the plans for a new capital at Amaravati, proposing three capitals instead.<ref>{{cite news|url=https://www.hindustantimes.com/three-capitals|date=December 15, 2020}}</ref>',
].join('\n');
const SECTIONS: Record<string, any[]> = {
  'Fourth N. Chandrababu Naidu ministry': [
    { index: '1', level: '2', line: 'Background' },
    { index: '2', level: '2', line: 'Council of Ministers' },
    { index: '6', level: '2', line: 'Major decisions', anchor: 'Major_decisions' },
    { index: '9', level: '2', line: 'References' },
  ],
  'Y. S. Jagan Mohan Reddy ministry': [{ index: '1', level: '2', line: 'Cabinet Ministers' }],
  'Y. S. Jagan Mohan Reddy': [
    { index: '1', level: '2', line: 'Early life' },
    { index: '3', level: '2', line: 'Political career' },
    { index: '5', level: '3', line: '2014–2019: Leader of opposition and Padayatra' },
    { index: '6', level: '3', line: '2019–2024: As Chief Minister' },
  ],
  'N. Chandrababu Naidu': [],
};
const TEXT: Record<string, string> = { 'Fourth N. Chandrababu Naidu ministry|6': PRESENT_WT, 'Y. S. Jagan Mohan Reddy|6': PREVIOUS_WT };

type Call = { url: string; init: any };
// gemini: http status for every Gemini call; free: Wikidata / Wikipedia answer; groq: Groq answer text
const makeFetch = (o: { gemini?: number; free?: boolean; groq?: string } = {}) => {
  const opt = { gemini: 429, free: true, ...o };
  const calls: Call[] = [];
  const f = jest.fn(async (url: string, init?: any): Promise<any> => {
    if (url === JWKS_URL) {
      return { ok: true, status: 200, headers: { get: () => 'public, max-age=3600' }, json: async () => ({ keys: [jwk] }) };
    }
    calls.push({ url, init });
    const u = new URL(url);
    if (u.host === 'generativelanguage.googleapis.com') {
      const body = JSON.stringify({ error: { message: 'Quota exceeded: requests per day' } });
      return { ok: false, status: opt.gemini, headers: { get: () => '' }, text: async () => body, json: async () => JSON.parse(body) };
    }
    if (u.host === 'api.groq.com') {
      const g = opt.groq ? { choices: [{ message: { content: opt.groq } }] } : { error: 'busy' };
      return { ...res(g, opt.groq ? 200 : 503), json: async () => g };
    }
    if (!opt.free) throw new Error('ECONNRESET');
    if (u.host === 'query.wikidata.org') {
      return res((u.searchParams.get('query') || '').includes('BIND("term"') ? TERMS : { results: { bindings: [] } });
    }
    if (u.host === 'en.wikipedia.org' && u.pathname === '/w/api.php') {
      if (u.searchParams.get('action') === 'parse') return res({ parse: { sections: SECTIONS[u.searchParams.get('page') || ''] || [] } });
      const title = u.searchParams.get('titles') || '';
      const wt = TEXT[`${title}|${u.searchParams.get('rvsection')}`];
      return res({ query: { pages: [wt ? { title, revisions: [{ slots: { main: { content: wt } } }] } : { title, missing: true }] } });
    }
    return res({}, 404);
  });
  return { f, calls };
};
const isGemini = (c: Call) => /generativelanguage/.test(c.url);
const isFree = (c: Call) => /wikidata|wikipedia/.test(c.url);
const isGroq = (c: Call) => /api\.groq\.com/.test(c.url);

beforeEach(() => clearJwksCache());
const env = (extra: any = {}) => ({ DB: makeD1(), FIREBASE_PROJECT_ID: 'outfit-vote-9edca', CIVIC_FREE_GAP_MS: '0', ...extra });
const call = async (e: any, method: string, path: string, opts: { body?: any; fetchImpl?: any } = {}) => {
  const headers: any = { authorization: `Bearer ${token()}` };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const req = new Request(`https://outfit-api.example.workers.dev${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const waits: Promise<any>[] = [];
  const r = await handleRequest(req, e, { waitUntil: (p: Promise<any>) => waits.push(p) }, { fetchImpl: opts.fetchImpl || makeFetch().f, now: NOW });
  await Promise.all(waits);
  return { status: r.status, json: JSON.parse(await r.text()) };
};
// every Gemini key (whole key) cooling down until after NOW
const coolAll = (e: any, keys = ['k']) =>
  keys.forEach(k => e.DB.raw.prepare("INSERT INTO ai_cooldown (id, until, reason, updated_at) VALUES (?, ?, 'daily', ?)").run(gemini.geminiCoolId(k), NOW + 3600 * 1000, NOW));
const AP = STATES.find((x: any) => x.code === 'AP');
const TERM_PRESENT = { from: '2024-06-12', to: '' };

describe('free/compare.js (keyless previous vs present government)', () => {
  it('termsFrom: present = newest term, previous = the term before it held by another person, ministry matched by date', () => {
    const { present, previous } = compare.termsFrom(TERMS.results.bindings, '2026-11-22');
    expect(present).toMatchObject({ head: 'Nara Chandrababu Naidu', party: 'Telugu Desam Party', from: '2024-06-12', to: '', ministry: { label: 'Fourth N. Chandrababu Naidu ministry' } });
    expect(previous).toMatchObject({ head: 'Y. S. Jaganmohan Reddy', party: 'YSR Congress Party', from: '2019-05-30', to: '2024-06-11', ministry: { label: 'Y. S. Jaganmohan Reddy Ministry' } });
    expect(compare.termsFrom([], '2026-11-22')).toEqual({ present: null, previous: null });
    // a future-dated term is ignored
    const future = [...TERMS.results.bindings, { kind: lit('term'), p: uri(`${WD}Q9`), pLabel: lit('Someone'), start: lit('2030-01-01T00:00:00Z') }];
    expect(compare.termsFrom(future, '2026-11-22').present.head).toBe('Nara Chandrababu Naidu');
  });

  it("pickFactSections: decisions / schemes sections of the ministry; only the office's in-term sections of the biography", () => {
    expect(compare.pickFactSections(SECTIONS['Fourth N. Chandrababu Naidu ministry'], TERM_PRESENT).map((x: any) => x.line)).toEqual(['Major decisions']);
    const prev = { from: '2019-05-30', to: '2024-06-11' };
    expect(compare.pickFactSections(SECTIONS['Y. S. Jagan Mohan Reddy'], prev, true).map((x: any) => x.line)).toEqual(['2019–2024: As Chief Minister']);
    // the same office in another term (years outside) is skipped
    expect(compare.pickFactSections([{ index: '4', level: '2', line: 'Chief Minister (1995–2004)' }], TERM_PRESENT, true)).toEqual([]);
  });

  it('factArea / topicOf', () => {
    expect(compare.factArea('Reddy launched the Jagananna Amma Vodi scheme')).toBe('started');
    expect(compare.factArea('He scrapped the plans for a new capital at Amaravati')).toBe('stopped');
    expect(compare.factArea('The government re-launched the Anna Canteen program, discontinued by the previous government')).toBe('started');
    expect(compare.factArea('The state budget for 2025-26 was ₹3.22 lakh crore')).toBe('budget');
    expect(compare.factArea('The cabinet ministers were allocated their portfolios on 14 June 2024')).toBe('');
    expect(compare.factArea('The prime minister cancelled all his official events')).toBe('');
    expect(compare.factArea('Works on the Polavaram irrigation project resumed')).toBe('projects');
    expect(compare.factArea('Pensions were raised to Rs 4,000 a month under the welfare scheme')).toBe('schemes');
    expect(compare.topicOf('In January 2020, Reddy launched the Jagananna Amma Vodi scheme, giving money')).toBe('Reddy launched the Jagananna Amma Vodi scheme');
    expect(compare.topicOf('15 August 2024 – The government re-launched the Anna Canteen program')).toBe('The government re-launched the Anna Canteen program');
    expect(compare.topicOf('Additionally, handloom workers will receive a pension')).toBe('Handloom workers will receive a pension');
  });

  it('extractFacts: own cited https source + date inside the term, else dropped; contested sentences dropped', () => {
    const facts = compare.extractFacts(PRESENT_WT, TERM_PRESENT);
    expect(facts.map((x: any) => x.source)).toEqual(['https://www.thehindu.com/pension-2024', 'https://www.deccanchronicle.com/anna-canteen', 'https://example.com/landmark']);
    expect(facts[0]).toMatchObject({ area: 'schemes', date: '2024-06-14' });
    expect(facts[1]).toMatchObject({ area: 'started', date: '2024-08-15' });
    // the evaluative word is dropped by research.cleanCompare (OPINION_RE)
    const clean = research.cleanCompare({ previous: {}, present: {}, rows: facts.map((x: any) => ({ area: x.area, topic: x.topic, present: x })) });
    expect(clean.rows.map((r: any) => r.present.source)).toEqual(['https://www.thehindu.com/pension-2024', 'https://www.deccanchronicle.com/anna-canteen']);
    const prev = compare.extractFacts(PREVIOUS_WT, { from: '2019-05-30', to: '2024-06-11' });
    expect(prev.map((x: any) => [x.area, x.date])).toEqual([
      ['started', '2020-01-09'],
      ['stopped', '2020-12-15'],
    ]);
  });

  it('fetchCompareFree: both governments from Wikidata, facts from Wikipedia with their own sources; cleanCompare keeps origin free', async () => {
    const { f } = makeFetch();
    const r = await compare.fetchCompareFree(AP, { fetchImpl: f, now: NOW });
    expect(r.ok).toBe(true);
    const d = research.cleanCompare(r.data);
    expect(d.origin).toBe('free');
    expect(d.present).toMatchObject({ label: 'Fourth N. Chandrababu Naidu ministry', head: 'Nara Chandrababu Naidu', party: 'Telugu Desam Party', from: '2024-06-12', source: 'https://en.wikipedia.org/wiki/Fourth_N._Chandrababu_Naidu_ministry' });
    expect(d.previous).toMatchObject({ head: 'Y. S. Jaganmohan Reddy', from: '2019-05-30', to: '2024-06-11' });
    expect(d.rows).toHaveLength(4);
    d.rows.forEach((x: any) => {
      const fact = x.present || x.previous;
      expect(fact.source).toMatch(/^https:\/\//);
      expect(fact.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
    expect(d.rows.filter((x: any) => x.previous).map((x: any) => x.area)).toEqual(['started', 'stopped']);
    expect(r.sources.map((x: any) => x.url)).toEqual(expect.arrayContaining(['https://www.wikidata.org/wiki/Q1159', 'https://en.wikipedia.org/wiki/Fourth_N._Chandrababu_Naidu_ministry', 'https://www.hindustantimes.com/three-capitals']));
    // Wikidata down: no data, never invented
    const down = await compare.fetchCompareFree(AP, { fetchImpl: makeFetch({ free: false }).f, now: NOW });
    expect(down.ok).toBe(false);
  });
});

describe('never-stop chain', () => {
  it('order: every Gemini key x free grounded model (2.5 Flash-Lite only) first, then keyless sources -> ready from free data', async () => {
    const e = env({ GEMINI_API_KEY: 'k1', GEMINI_API_KEY_2: 'k2' });
    const { f, calls } = makeFetch({ gemini: 429 });
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'gcmp', state: 'AP' }, fetchImpl: f });
    expect(r.json).toMatchObject({ ok: true, status: 'ready', did: 'research', origin: 'free' });
    const g = calls.filter(isGemini);
    const tried = new Set(g.map(c => `${c.init.headers['x-goog-api-key']}|${c.url.split('/models/')[1].split(':')[0]}`));
    // grounded research: only the free-tier grounded model (Grounding with Google Search is free only on 2.5 Flash / Flash-Lite)
    expect(gemini.GEMINI_GROUNDED_MODELS).toEqual(['gemini-2.5-flash-lite']);
    const want = ['k1', 'k2'].flatMap(k => gemini.GEMINI_GROUNDED_MODELS.map((m: string) => `${k}|${m}`));
    expect([...tried].sort()).toEqual(want.sort());
    expect(gemini.GEMINI_MODELS.some((m: string) => /flash-lite/.test(m))).toBe(true);
    const lastGemini = calls.map(isGemini).lastIndexOf(true);
    const firstFree = calls.findIndex(isFree);
    expect(firstFree).toBeGreaterThan(lastGemini);
    expect(calls.some(isGroq)).toBe(false); // no GROQ_API_KEY: never called
    const d = await call(e, 'GET', '/v1/civic/data?kind=gcmp&state=AP', { fetchImpl: f });
    expect(d.json).toMatchObject({ status: 'ok', answeredBy: 'free', researchConfigured: true });
    expect(d.json.data.rows.length).toBeGreaterThan(0);
    expect(e.DB.raw.prepare("SELECT origin, model FROM civic_data WHERE kind='gcmp' AND state='AP'").get()).toEqual({ origin: 'free', model: 'free' });
  });

  it('no Gemini key at all: the comparison still comes from keyless sources', async () => {
    const e = env();
    const { f, calls } = makeFetch();
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'gcmp', state: 'AP' }, fetchImpl: f });
    expect(r.json).toMatchObject({ ok: true, status: 'ready', origin: 'free' });
    expect(calls.some(isGemini)).toBe(false);
  });

  it('keys cooling + free sources down: Groq has no free web-search model (groq/compound decommissioned) -> never asked, status none with or without GROQ_API_KEY', async () => {
    const groqAns = JSON.stringify({
      asOf: '2026-11',
      previous: { label: 'YSRCP government', head: 'Y. S. Jagan Mohan Reddy', party: 'YSRCP', from: '2019-05-30', to: '2024-06-11', source: 'https://ap.gov.in/a' },
      present: { label: 'NDA government', head: 'N. Chandrababu Naidu', party: 'TDP', from: '2024-06-12', to: '', source: 'https://ap.gov.in/b' },
      rows: [
        { area: 'schemes', topic: 'Pensions', previous: { text: 'Pension Rs 3,000 a month', source: 'https://ap.gov.in/p1', date: '2024-01' }, present: { text: 'Pension Rs 4,000 a month', source: 'https://ap.gov.in/p2', date: '2024-07' } },
        { area: 'projects', topic: 'Capital', present: { text: 'Works restarted', source: 'http://insecure.example', date: '2025' } }, // no https source: dropped
      ],
    });
    const e = env({ GEMINI_API_KEY: 'k', GROQ_API_KEY: 'gk' });
    coolAll(e);
    const a = makeFetch({ free: false, groq: groqAns });
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'gcmp', state: 'AP' }, fetchImpl: a.f });
    expect(r.json).toMatchObject({ ok: false, status: 'none' });
    expect(a.calls.some(isGemini)).toBe(false);
    expect(a.calls.some(isGroq)).toBe(false); // free tier only: no paid web search, never an ungrounded guess
    expect(e.DB.raw.prepare("SELECT COUNT(*) AS n FROM civic_data WHERE data IS NOT NULL OR status = 'error'").get().n).toBe(0);

    const e2 = env({ GEMINI_API_KEY: 'k' });
    coolAll(e2);
    const b = makeFetch({ free: false, groq: groqAns });
    const r2 = await call(e2, 'POST', '/v1/civic/research', { body: { kind: 'gcmp', state: 'AP' }, fetchImpl: b.f });
    expect(r2.json).toMatchObject({ ok: false, status: 'none' });
    expect(b.calls.some(isGroq)).toBe(false);
    expect(JSON.stringify(r2.json)).not.toMatch(/paused/i);
    expect(e2.DB.raw.prepare("SELECT COUNT(*) AS n FROM civic_data WHERE data IS NOT NULL OR status = 'error'").get().n).toBe(0);
  });

  it('Govt / Hospitals: keys out + free sources down + Groq set -> still none (no free Groq web search), Groq never asked', async () => {
    const e = env({ GEMINI_API_KEY: 'k', GROQ_API_KEY: 'gk' });
    coolAll(e);
    const ans = JSON.stringify({ asOf: '2026-11', hospitals: [{ name: 'Government General Hospital, Kurnool', type: 'Government', address: 'Kurnool' }] });
    const { f, calls } = makeFetch({ free: false, groq: ans });
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'hosp', state: 'AP', district: 'kurnool', variant: 'govt' }, fetchImpl: f });
    expect(r.json).toMatchObject({ ok: false, status: 'none' });
    expect(calls.filter(isGroq)).toHaveLength(0);
  });

  it('saved data stands: refresh with every source failing answers saved (row unchanged, never marked failed); cron stops grounded research', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const old = JSON.stringify({ asOf: '2026-01', previous: {}, present: {}, rows: [{ area: 'schemes', topic: 'Pensions', present: { text: 'Pension Rs 4,000', source: 'https://ap.gov.in/p', date: '2024-07' } }] });
    e.DB.raw
      .prepare("INSERT INTO civic_data (kind, state, district, variant, data, sources, status, model, updated_at, schema_v, origin) VALUES ('gcmp', 'AP', '', '', ?, '[]', 'ok', 'gemini-3.5-flash-lite', ?, 1, 'ai')")
      .run(old, NOW - 30 * 24 * 3600 * 1000);
    const db = new Db(e.DB);
    const r = await research.researchOne(db, e, { kind: 'gcmp', state: 'AP', district: '', variant: '' }, { fetchImpl: makeFetch({ gemini: 429, free: false }).f, now: NOW });
    expect(r).toMatchObject({ ok: true, status: 'saved', origin: 'ai', answeredBy: 'gemini', aiOut: true });
    expect(e.DB.raw.prepare("SELECT data, status FROM civic_data WHERE kind='gcmp' AND state='AP'").get()).toEqual({ data: old, status: 'ok' });
    // next cron run: keys cooling, nothing researched, summary says why (never 'paused')
    const out = await research.runCivicResearch(db, e, { fetchImpl: makeFetch().f, now: NOW + 1000, translate: false });
    expect(out).toMatchObject({ ran: 0, skipped: research.AI_KEYS_OUT });
    expect(JSON.stringify(out)).not.toMatch(/paused/i);
  });

  it('researchFallbackChain: keyless / groq switched off -> saved or none with the given code', async () => {
    const e = env();
    const db = new Db(e.DB);
    const t = { kind: 'gprm', state: 'AP', district: '', variant: '' };
    expect(await research.researchFallbackChain(db, e, t, { fetchImpl: makeFetch().f, now: NOW, keyless: false, groq: false, code: 'billing' })).toEqual({ ok: false, status: 'none', error: 'no data yet', code: 'billing' });
    e.DB.raw.prepare("INSERT INTO civic_data (kind, state, district, variant, data, status, model, updated_at, origin) VALUES ('gprm', 'AP', '', '', '{}', 'ok', 'free', ?, 'free')").run(NOW);
    expect(await research.researchFallbackChain(db, e, t, { fetchImpl: makeFetch().f, now: NOW, keyless: false })).toMatchObject({ ok: true, status: 'saved', origin: 'free', answeredBy: 'free' });
  });

  it('keyless step respects the daily free-source cap', async () => {
    const e = env({ CIVIC_FREE_DAILY_MAX: '0' });
    const r = await research.researchKeyless(new Db(e.DB), e, { kind: 'gcmp', state: 'AP', district: '', variant: '' }, { fetchImpl: makeFetch().f, now: NOW });
    expect(r).toMatchObject({ ok: false, code: 'cap' });
  });
});
