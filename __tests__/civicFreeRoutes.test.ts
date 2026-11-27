// Govt / Hospitals served from FREE, keyless sources through the Worker routes (research.js
// researchFree + routes.js): status 'ready' with NO AI key, never 'paused' for AI limits, results in
// the civic cache tables (civic_data origin 'free', civic_geo, governors in civic_text_cache),
// Overpass upgrade only after the response (waitUntil) / in the cron, OSM names + addresses never
// translated. fetch is mocked; D1 is node:sqlite with the real migration SQL.
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
const { handleRequest, handleScheduled, CIVIC_CRON } = require('../server/worker/src/index.js');
const { Db } = require('../server/worker/src/db.js');
const research = require('../server/worker/src/civic/research.js');
const govt = require('../server/worker/src/civic/free/govt.js');
const hosp = require('../server/worker/src/civic/free/hosp.js');

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
const OWNER = () => token({ sub: 'owner1', email: '2saibabug@gmail.com' });

const res = (body: any, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
const lit = (v: string) => ({ type: 'literal', value: v });
const rows = (bindings: any[]) => ({ results: { bindings } });

// ── free-source fixtures ──
const OFFICES = rows([
  // no Governor office in Wikidata for AP (the real gap): the Wikipedia incumbent list fills it
  { ol: lit('Chief Minister of Andhra Pradesh'), p: lit('http://www.wikidata.org/entity/Q2'), pLabel: lit('N. Chandrababu Naidu'), start: lit('2024-06-12'), partyLabel: lit('Telugu Desam Party') },
]);
const STATE = rows([
  { kind: lit('state'), capLabel: lit('Amaravati'), pop: lit('49386799'), web: lit('http://www.ap.gov.in'), article: lit('https://en.wikipedia.org/wiki/Andhra_Pradesh') },
  { kind: lit('item'), xl: lit('2024 Andhra Pradesh Legislative Assembly election'), date: lit('2024-05-13') },
]);
const DISTRICT = rows([{ d: lit('http://www.wikidata.org/entity/Q15395'), dLabel: lit('Kurnool district'), hqLabel: lit('Kurnool'), web: lit('http://kurnool.ap.gov.in'), article: lit('https://en.wikipedia.org/wiki/Kurnool_district') }]);
const GOVERNORS_HTML = `<table class="wikitable"><tbody>
<tr><th>State</th><th>List</th><th>Officeholder</th><th>Assumed office</th></tr>
<tr><td>Andhra Pradesh</td><td>List</td><td>Syed Abdul Nazeer</td><td>24 February 2023</td></tr>
</tbody></table>`;
const nom = (type: string, id: number, name: string, extra: any = {}) => ({
  osm_type: type,
  osm_id: id,
  name,
  lat: '15.83',
  lon: '78.04',
  category: 'amenity',
  display_name: `${name}, Kurnool`,
  address: { road: 'Main Road', city: 'Kurnool', state: 'Andhra Pradesh', postcode: '518001' },
  extratags: null,
  ...extra,
});
const AREA = [{ category: 'boundary', display_name: 'Kurnool District, Andhra Pradesh, India', boundingbox: ['15.13', '15.96', '76.97', '78.27'] }];

type Call = { url: string; init: any };
// Every source answers (Wikidata, Wikipedia, Nominatim, Overpass); Gemini optional / failing
// Overpass: the boundary relation (printed first by the area query) + the hospitals inside it.
// overpassFailFirst: the first n Overpass calls time out (504), as a busy mirror does.
const KURNOOL_REL = { type: 'relation', id: 2022291, bounds: { minlat: 15.13, minlon: 76.97, maxlat: 15.96, maxlon: 78.27 }, tags: { boundary: 'administrative', admin_level: '5', name: 'Kurnool District', 'ref:LGD:district': '511' } };
const makeFetch = (opts: { gemini?: number; overpass?: boolean; overpassGate?: Promise<void>; overpassFailFirst?: number; extraOverpass?: any[] } = {}) => {
  const calls: Call[] = [];
  let overpassCalls = 0;
  const f = jest.fn(async (url: string, init?: any) => {
    if (url === JWKS_URL) {
      return { ok: true, status: 200, headers: { get: () => 'public, max-age=3600' }, json: async () => ({ keys: [jwk] }) };
    }
    calls.push({ url, init });
    const u = new URL(url);
    if (u.host === 'generativelanguage.googleapis.com') {
      const body = JSON.parse(init.body);
      const prompt: string = body.contents[0].parts[0].text;
      if (opts.gemini && opts.gemini !== 200) return { ok: false, status: opts.gemini, json: async () => ({}) };
      const j = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
      const tr = (v: any): any => (Array.isArray(v) ? v.map(tr) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tr(x)])) : typeof v === 'string' && v ? `TE ${v}` : v);
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(tr(j)) }] } }] }) };
    }
    if (u.host === 'query.wikidata.org') {
      const q = u.searchParams.get('query') || '';
      if (q.includes('Deputy Chief Minister|Administrator')) return res(OFFICES);
      if (q.includes('BIND("state"')) return res(STATE);
      if (q.includes('wdt:P150 ?d')) return res(DISTRICT);
      return res(rows([]));
    }
    if (u.host === 'en.wikipedia.org' && u.pathname === '/w/api.php') {
      const page = u.searchParams.get('page');
      if (page === govt.GOVERNORS_PAGE) {
        if (u.searchParams.get('prop') === 'sections') return res({ parse: { sections: [{ line: 'List of incumbent governors', index: '19' }] } });
        return res({ parse: { text: GOVERNORS_HTML } });
      }
      return res({ parse: { sections: [] } });
    }
    if (u.host === 'en.wikipedia.org') return res({ extract: 'Kurnool district is in Andhra Pradesh.' });
    if (u.host === 'nominatim.openstreetmap.org') {
      const q = u.searchParams.get('q') || '';
      if (/India$/.test(q)) return res(AREA);
      if (/^hospital/.test(q)) return res([nom('node', 1, 'Government General Hospital', { extratags: { phone: '+91 8518 222222' } }), nom('node', 2, 'Sukheebhava Hospital')]);
      if (/^government hospital/.test(q)) return res([nom('node', 5, 'Government Hospital', { address: { town: 'Adoni' } })]);
      return res([nom('node', 4, 'Sai Clinic', { extratags: { 'operator:type': 'private' } })]);
    }
    if (hosp.OVERPASS_MIRRORS.includes(url)) {
      overpassCalls += 1;
      if (!opts.overpass) return res('busy', 429);
      if (overpassCalls <= (opts.overpassFailFirst || 0)) return res('gateway timeout', 504);
      if (opts.overpassGate) await opts.overpassGate;
      return res({
        elements: [
          KURNOOL_REL,
          ...(opts.extraOverpass || []),
          { type: 'node', id: 1, lat: 15.83, lon: 78.04, tags: { amenity: 'hospital', name: 'Government General Hospital' } }, // already known
          { type: 'node', id: 10, lat: 15.8, lon: 78.0, tags: { amenity: 'hospital', name: 'District Hospital', 'addr:city': 'Kurnool' } },
          { type: 'way', id: 11, center: { lat: 15.7, lon: 78.1 }, tags: { amenity: 'hospital', name: 'Medicover Hospitals', 'operator:type': 'private' } },
        ],
      });
    }
    throw new Error('unexpected fetch ' + url);
  });
  return { f, calls };
};

beforeEach(() => clearJwksCache());
// CIVIC_FREE_GAP_MS 0: no real 1.1 s Nominatim gaps in tests
const env = (extra: any = {}) => ({ DB: makeD1(), FIREBASE_PROJECT_ID: 'outfit-vote-9edca', CIVIC_FREE_GAP_MS: '0', ...extra });
const call = async (e: any, method: string, path: string, opts: { body?: any; tok?: string; fetchImpl?: any; waits?: Promise<any>[] } = {}) => {
  const headers: any = { authorization: `Bearer ${opts.tok || token()}` };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const req = new Request(`https://outfit-api.example.workers.dev${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const waits: Promise<any>[] = opts.waits || [];
  const r = await handleRequest(req, e, { waitUntil: (p: Promise<any>) => waits.push(p) }, { fetchImpl: opts.fetchImpl || makeFetch().f, now: NOW });
  if (!opts.waits) await Promise.all(waits);
  return { status: r.status, json: JSON.parse(await r.text()) };
};
const isAi = (c: Call) => /generativelanguage|groq|cloudflare/.test(c.url);

describe('Govt from free sources (no AI)', () => {
  it('no AI key: POST research -> ready in one call; GET serves it with per-section sources; governor from Wikipedia', async () => {
    const e = env();
    const { f, calls } = makeFetch();
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'govt', state: 'AP', district: 'Kurnool', lang: 'te' }, fetchImpl: f });
    expect(r.json).toMatchObject({ ok: true, status: 'ready', did: 'research', origin: 'free', kind: 'govt', district: 'kurnool' });
    expect(r.json.translating).toBeUndefined(); // no AI provider: English only
    expect(calls.some(isAi)).toBe(false);
    const g = await call(e, 'GET', '/v1/civic/data?kind=govt&state=AP&district=kurnool&lang=te', { fetchImpl: f });
    expect(g.json).toMatchObject({ status: 'ok', researchConfigured: true, aiConfigured: false, freeSources: true });
    const d = g.json.data;
    expect(d.origin).toBe('free');
    expect(d.leaders.governor).toBe('Syed Abdul Nazeer');
    expect(d.leaders.chiefMinister.name).toBe('N. Chandrababu Naidu');
    expect(d.district.headquarters).toBe('Kurnool');
    expect(d.src.leaders).toMatchObject({ name: 'Wikidata + Wikipedia', url: 'https://en.wikipedia.org/wiki/Governor_(India)', date: '2026-11-22' });
    expect(d.src.place).toBe('Kurnool district');
    expect(d.helplines.map((h: any) => h.number)).toContain('112');
    expect(g.json.sources.map((x: any) => x.url)).toContain('https://pgportal.gov.in');
    const row = e.DB.raw.prepare("SELECT status, origin, model, free_at FROM civic_data WHERE kind='govt' AND state='AP' AND district='kurnool'").get();
    expect(row).toMatchObject({ status: 'ok', origin: 'free', model: 'free', free_at: NOW });
    // governors list cached: the next place does not fetch the Wikipedia section again
    expect(e.DB.raw.prepare("SELECT COUNT(*) AS n FROM civic_text_cache WHERE ns='free_gov' AND h='state'").get().n).toBe(1);
    const second = makeFetch();
    const r2 = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'govt', state: 'AP' }, fetchImpl: second.f });
    expect(r2.json.status).toBe('ready');
    expect(second.calls.some(c => c.url.includes(govt.GOVERNORS_PAGE))).toBe(false);
    // a place with data: nothing to do
    const again = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'govt', state: 'AP', district: 'kurnool' }, fetchImpl: f });
    expect(again.json.did).toBe('nothing');
  });

  it('AI keys out of quota (paused) no longer block: free research still ready, no Gemini call', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    // every Gemini key cooling down
    const until = NOW + 3600 * 1000;
    e.DB.raw.prepare("INSERT INTO ai_cooldown (id, until, reason, updated_at) VALUES ('gemini:*:*', ?, 'daily', ?)").run(until, NOW);
    const { f, calls } = makeFetch({ gemini: 429 });
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'govt', state: 'AP', district: 'kurnool' }, fetchImpl: f });
    expect(r.json).toMatchObject({ ok: true, status: 'ready', origin: 'free' });
    expect(r.json.status).not.toBe('paused');
    expect(calls.filter(c => /generativelanguage/.test(c.url) && JSON.parse(c.init.body).tools)).toHaveLength(0); // no grounded research
  });

  it('free sources down + no AI: ai_off as before (with the free error), nothing saved as data', async () => {
    const e = env();
    const down = jest.fn(async (url: string) => {
      if (url === JWKS_URL) return { ok: true, status: 200, headers: { get: () => 'public, max-age=3600' }, json: async () => ({ keys: [jwk] }) };
      throw new Error('ECONNRESET');
    });
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'govt', state: 'AP' }, fetchImpl: down });
    expect(r.json).toMatchObject({ ok: false, status: 'ai_off' });
    expect(r.json.freeError).toBeTruthy();
    expect(e.DB.raw.prepare('SELECT COUNT(*) AS n FROM civic_data WHERE data IS NOT NULL').get().n).toBe(0);
  });
});

describe('Hospitals from free sources (no AI)', () => {
  it('district: hospitals from the exact OSM boundary (Overpass, LGD code), other-state rows dropped, no Nominatim guess', async () => {
    const e = env();
    const { f, calls } = makeFetch({
      overpass: true,
      extraOverpass: [
        // inside the box, outside the state: dropped (PIN / addr:state)
        { type: 'node', id: 90, lat: 15.2, lon: 77.0, tags: { amenity: 'hospital', name: 'Government Hospital, Bellary Road', 'addr:state': 'Karnataka' } },
        { type: 'node', id: 91, lat: 15.3, lon: 77.1, tags: { amenity: 'hospital', name: 'Ballari Govt Hospital', 'addr:postcode': '583101' } },
      ],
    });
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'hosp', state: 'AP', district: 'kurnool', variant: 'govt' }, fetchImpl: f });
    expect(r.json).toMatchObject({ ok: true, status: 'ready', did: 'research', origin: 'free', scope: 'district' });
    const op = calls.filter(c => hosp.OVERPASS_MIRRORS.includes(c.url));
    expect(op).toHaveLength(1);
    expect(decodeURIComponent(op[0].init.body)).toContain('rel["boundary"="administrative"]["ref:LGD:district"="511"]');
    expect(calls.some(c => c.url.includes('nominatim'))).toBe(false);
    const g = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=kurnool&variant=govt', { fetchImpl: f });
    expect(g.json.status).toBe('ok');
    expect(g.json.data.v).toBe(research.FREE_HOSP_V);
    expect(g.json.data.hospitals.map((h: any) => h.name)).toEqual(['District Hospital', 'Government General Hospital']);
    const p = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=kurnool&variant=private', { fetchImpl: f });
    expect(p.json.data.hospitals.map((h: any) => h.name)).toEqual(['Medicover Hospitals']);
    const geo = e.DB.raw.prepare("SELECT * FROM civic_geo WHERE place='AP|kurnool'").get();
    expect(geo.label).toBe('osm:relation/2022291 Kurnool District');
    expect(JSON.parse(geo.bbox)).toEqual({ south: 15.13, north: 15.96, west: 76.97, east: 78.27 });
    expect(geo.overpass_status).toBe('ok');
  });

  it('Overpass busy: Nominatim fallback (strict state filter); full boundary list after the response', async () => {
    const e = env();
    let release: () => void = () => undefined;
    const overpassGate = new Promise<void>(r0 => (release = r0));
    // the request path tries 2 mirrors: both time out; the background upgrade then gets an answer
    const { f } = makeFetch({ overpass: true, overpassGate, overpassFailFirst: 2 });
    const waits: Promise<any>[] = [];
    // Overpass is held back: the response must not wait for it (upgrade runs in waitUntil)
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'hosp', state: 'AP', district: 'kurnool', variant: 'govt' }, fetchImpl: f, waits });
    expect(r.json).toMatchObject({ ok: true, status: 'ready', did: 'research', origin: 'free' });
    expect(waits.length).toBeGreaterThan(0);
    const g = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=kurnool&variant=govt', { fetchImpl: f });
    expect(g.json.status).toBe('ok');
    const names = g.json.data.hospitals.map((h: any) => h.name);
    expect(names).toEqual(['Government General Hospital', 'Government Hospital, Adoni']);
    expect(g.json.data.hospitals[0]).toMatchObject({
      type: 'Government',
      ownership: 'govt',
      phone: '+91 8518 222222',
      address: 'Main Road, Kurnool, Andhra Pradesh, 518001',
      lat: 15.83,
      lon: 78.04,
      mapUrl: 'https://www.openstreetmap.org/?mlat=15.83&mlon=78.04#map=17/15.83/78.04',
      osmUrl: 'https://www.openstreetmap.org/node/1',
      src: { name: 'OpenStreetMap (Nominatim)', url: 'https://www.openstreetmap.org/node/1', date: '2026-11-22' },
      district: 'Kurnool',
    });
    expect(g.json.data.origin).toBe('free');
    expect(g.json.sources).toEqual([{ url: 'https://www.openstreetmap.org/copyright', title: 'OpenStreetMap contributors (ODbL)' }]);
    const p = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=kurnool&variant=private', { fetchImpl: f });
    expect(p.json.data.hospitals.map((h: any) => [h.name, h.ownership])).toEqual([
      ['Sai Clinic', 'private'],
      ['Sukheebhava Hospital', 'unknown'],
    ]);
    const geo = e.DB.raw.prepare("SELECT * FROM civic_geo WHERE place='AP|kurnool'").get();
    expect(JSON.parse(geo.bbox)).toEqual({ south: 15.13, north: 15.96, west: 76.97, east: 78.27 });
    expect(geo.overpass_at).toBeNull();
    expect(geo.label.startsWith('osm:')).toBe(false); // a Nominatim box: not trusted for later lookups
    // now the background upgrade finishes: new OSM items added, known ones kept once
    release();
    await Promise.all(waits);
    const g2 = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=kurnool&variant=govt', { fetchImpl: f });
    expect(g2.json.data.hospitals.map((h: any) => h.name)).toEqual(['District Hospital', 'Government General Hospital', 'Government Hospital, Adoni']);
    const p2 = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=kurnool&variant=private', { fetchImpl: f });
    expect(p2.json.data.hospitals.map((h: any) => h.name)).toContain('Medicover Hospitals');
    expect(e.DB.raw.prepare("SELECT overpass_status FROM civic_geo WHERE place='AP|kurnool'").get().overpass_status).toBe('ok');
  });

  it('cached area: no lookup, first search with no wait (fast first load)', async () => {
    const e = env({ CIVIC_FREE_GAP_MS: '1100' });
    // a box from the OSM boundary itself (label osm:...): trusted; Overpass busy -> Nominatim in the box
    e.DB.raw
      .prepare("INSERT INTO civic_geo (place, label, bbox, lat, lon, fetched_at) VALUES ('AP|kurnool', 'osm:relation/2022291 Kurnool District', ?, 15.5, 77.6, ?)")
      .run(JSON.stringify({ south: 15.13, north: 15.96, west: 76.97, east: 78.27 }), NOW);
    const { f, calls } = makeFetch();
    const gaps: number[] = [];
    const db = new Db(e.DB);
    const r = await research.researchFree(db, e, { kind: 'hosp', state: 'AP', district: 'kurnool', variant: 'govt' }, { fetchImpl: f, now: NOW, sleepImpl: async (ms: number) => gaps.push(ms) });
    expect(r.ok).toBe(true);
    const nomCalls = calls.filter(c => c.url.includes('nominatim'));
    expect(nomCalls.every(c => !/India$/.test(new URL(c.url).searchParams.get('q') || ''))).toBe(true);
    expect(nomCalls).toHaveLength(hosp.HOSP_QUERIES.length);
    expect(gaps).toEqual([1100, 1100]); // 1 req/s between searches, none before the first
  });

  it('AI paused: hospitals still ready from free sources (never paused)', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const { f, calls } = makeFetch({ gemini: 402 });
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'hosp', state: 'TG', variant: 'private' }, fetchImpl: f });
    expect(r.json).toMatchObject({ ok: true, status: 'ready', origin: 'free' });
    expect(calls.filter(c => /generativelanguage/.test(c.url) && JSON.parse(c.init.body).tools)).toHaveLength(0);
    // the cron refresh / translation backlog never undoes it: rows stay origin free
    expect(e.DB.raw.prepare("SELECT COUNT(*) AS n FROM civic_data WHERE kind='hosp' AND state='TG' AND origin='free' AND status='ok'").get().n).toBe(2);
  });

  it('translation of an OSM list: names / addresses / phones never sent, never changed', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const { f, calls } = makeFetch();
    const waits: Promise<any>[] = [];
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'hosp', state: 'AP', district: 'kurnool', variant: 'govt', lang: 'te' }, fetchImpl: f, waits });
    expect(r.json).toMatchObject({ ok: true, status: 'ready', translating: true });
    await Promise.all(waits);
    const sent = calls.filter(c => /generativelanguage/.test(c.url)).map(c => JSON.parse(c.init.body).contents[0].parts[0].text);
    expect(sent.length).toBeGreaterThan(0);
    sent.forEach(p => {
      expect(p).not.toContain('Government General Hospital');
      expect(p).not.toContain('Main Road');
      expect(p).not.toContain('8518');
      expect(p).not.toContain('openstreetmap');
    });
    const g = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=kurnool&variant=govt&lang=te', { fetchImpl: f });
    const te = g.json.i18n.te.hospitals[0];
    expect(te).toMatchObject({ name: 'Government General Hospital', address: 'Main Road, Kurnool, Andhra Pradesh, 518001', type: 'TE Government', lat: 15.83, ownership: 'govt' });
    expect(te.src).toEqual(g.json.data.hospitals[0].src);
  });
});

describe('cleaners + cron', () => {
  it('cleanGovt / cleanHosp keep src, origin, lat, lon, mapUrl, phone, address of free rows; AI rows unchanged', () => {
    const g = research.cleanGovt({ origin: 'free', overview: 'x', leaders: { governor: 'G', chiefMinister: { name: 'CM' } }, src: { leaders: { name: 'Wikidata', url: 'https://www.wikidata.org/wiki/Q1159', date: '2026-11-22' }, bad: { url: 'http://insecure.example' }, place: 'AP' } });
    expect(g.origin).toBe('free');
    expect(g.leaders.governor).toBe('G');
    expect(g.src).toEqual({ leaders: { name: 'Wikidata', url: 'https://www.wikidata.org/wiki/Q1159', date: '2026-11-22' }, place: 'AP' });
    expect(research.cleanGovt({ overview: 'x' }).origin).toBeUndefined();
    const h = research.cleanHosp({
      origin: 'free',
      src: { name: 'OpenStreetMap (Nominatim)', url: 'https://www.openstreetmap.org/copyright', date: '2026-11-22' },
      hospitals: [
        { id: 'node/1', name: 'Apollo Clinic', address: 'A', phone: '+91 1', lat: 15.8, lon: 78, mapUrl: 'https://www.openstreetmap.org/?mlat=15.8&mlon=78', osmUrl: 'https://www.openstreetmap.org/node/1', ownership: 'private', src: { name: 'OSM', url: 'https://www.openstreetmap.org/node/1' } },
        { id: 'node/2', name: 'Apollo Clinic', lat: 'x', lon: 999 },
      ],
    });
    expect(h.origin).toBe('free');
    expect(h.hospitals[0]).toMatchObject({ address: 'A', phone: '+91 1', lat: 15.8, lon: 78, mapUrl: 'https://www.openstreetmap.org/?mlat=15.8&mlon=78', ownership: 'private', src: { name: 'OSM', url: 'https://www.openstreetmap.org/node/1', date: '' } });
    // same name, another OSM place: kept with its own slug
    expect(h.hospitals[1]).toMatchObject({ slug: 'apollo-clinic-2', lat: null, lon: null, ownership: 'unknown' });
    const ai = research.cleanHosp({ hospitals: [{ name: 'NIMS', lat: 1, mapUrl: 'https://x.example' }] }, 'Hyderabad');
    expect(ai.hospitals[0].lat).toBeUndefined();
    expect(ai.hospitals[0].mapUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search/);
  });

  it('civic cron: gentle free refresh (no AI key): one Overpass upgrade + one stale free row per run', async () => {
    const e = env();
    const db = new Db(e.DB);
    await research.researchFree(db, e, { kind: 'hosp', state: 'AP', district: 'kurnool', variant: 'govt' }, { fetchImpl: makeFetch().f, now: NOW - research.CIVIC_FREE_REFRESH_MS - 1000 });
    await research.researchFree(db, e, { kind: 'govt', state: 'AP', district: 'kurnool', variant: '' }, { fetchImpl: makeFetch().f, now: NOW - research.CIVIC_FREE_REFRESH_MS - 2000 });
    const { f, calls } = makeFetch({ overpass: true });
    await handleScheduled({ cron: CIVIC_CRON }, e, null, { fetchImpl: f, now: NOW });
    expect(calls.some(c => hosp.OVERPASS_MIRRORS.includes(c.url))).toBe(true);
    expect(calls.some(isAi)).toBe(false);
    expect(e.DB.raw.prepare("SELECT overpass_at FROM civic_geo WHERE place='AP|kurnool'").get().overpass_at).toBe(NOW);
    // the stalest free row (govt) was re-fetched
    expect(e.DB.raw.prepare("SELECT free_at FROM civic_data WHERE kind='govt' AND district='kurnool'").get().free_at).toBe(NOW);
    // nothing left to do on the next run
    const again = makeFetch({ overpass: true });
    const out = await research.runFreeRefresh(db, e, { fetchImpl: again.f, now: NOW + 1000 });
    expect(out.ran).toBe(0); // upgraded hosp rows were re-saved (fresh), govt re-fetched: nothing stale
    expect(again.calls.some(c => hosp.OVERPASS_MIRRORS.includes(c.url))).toBe(false);
  });

  it('owner refresh without a Gemini key refreshes Govt / Hospitals from free sources', async () => {
    const e = env();
    const r = await call(e, 'POST', '/v1/admin/civic/refresh', { tok: OWNER(), body: { kind: 'govt', state: 'AP' }, fetchImpl: makeFetch().f });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ ok: true, origin: 'free', kind: 'govt', state: 'AP' });
  });
});
