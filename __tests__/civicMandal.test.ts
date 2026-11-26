// Mandal (sub-district) support in the Worker: place.js keys ("<district>~<mandal>"), the routes'
// mandal param (stored joined, echoed back split), Hospitals bounded to the mandal's area, Govt's
// mandal block from Wikipedia, and the free research scope fallback mandal -> district -> state
// (data.scope + a short note say which level answered). fetch is mocked; D1 is node:sqlite with the
// real migration SQL.
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
const { Db } = require('../server/worker/src/db.js');
const research = require('../server/worker/src/civic/research.js');
const govt = require('../server/worker/src/civic/free/govt.js');
const hosp = require('../server/worker/src/civic/free/hosp.js');
const place = require('../server/worker/src/civic/place.js');
const routes = require('../server/worker/src/civic/routes.js');

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
const rows = (bindings: any[]) => ({ results: { bindings } });
const OFFICES = rows([
  { ol: lit('Chief Minister of Andhra Pradesh'), p: lit('http://www.wikidata.org/entity/Q2'), pLabel: lit('N. Chandrababu Naidu'), start: lit('2024-06-12'), partyLabel: lit('Telugu Desam Party') },
]);
const STATE = rows([{ kind: lit('state'), capLabel: lit('Amaravati'), pop: lit('49386799'), web: lit('http://www.ap.gov.in'), article: lit('https://en.wikipedia.org/wiki/Andhra_Pradesh') }]);
const DISTRICT = rows([{ d: lit('http://www.wikidata.org/entity/Q15395'), dLabel: lit('Kurnool district'), hqLabel: lit('Kurnool'), web: lit('http://kurnool.ap.gov.in'), article: lit('https://en.wikipedia.org/wiki/Kurnool_district') }]);
const MANDAL_BOX = ['15.55', '15.70', '77.20', '77.35'];
const DISTRICT_BOX = ['15.13', '15.96', '76.97', '78.27'];
const nom = (id: number, name: string) => ({
  osm_type: 'node',
  osm_id: id,
  name,
  lat: '15.62',
  lon: '77.27',
  category: 'amenity',
  display_name: `${name}, Adoni`,
  address: { road: 'Main Road', town: 'Adoni', state: 'Andhra Pradesh' },
  extratags: null,
});
const vbOf = (b: string[]) => [b[2], b[1], b[3], b[0]].map(Number).join(',');

type Call = { url: string; init: any };
// mandalArea: Nominatim knows the mandal's boundary; mandalHosp: hospitals inside it;
// mandalWiki: Wikipedia has an article for "Adoni mandal" that names the district
const makeFetch = (o: { mandalArea?: boolean; mandalHosp?: boolean; mandalWiki?: boolean; districtHosp?: boolean } = {}) => {
  const opt = { mandalArea: true, mandalHosp: true, mandalWiki: true, districtHosp: true, ...o };
  const calls: Call[] = [];
  const f = jest.fn(async (url: string, init?: any) => {
    if (url === JWKS_URL) {
      return { ok: true, status: 200, headers: { get: () => 'public, max-age=3600' }, json: async () => ({ keys: [jwk] }) };
    }
    calls.push({ url, init });
    const u = new URL(url);
    if (u.host === 'query.wikidata.org') {
      const q = u.searchParams.get('query') || '';
      if (q.includes('Deputy Chief Minister|Administrator')) return res(OFFICES);
      if (q.includes('BIND("state"')) return res(STATE);
      if (q.includes('wdt:P150 ?d')) return res(DISTRICT);
      return res(rows([]));
    }
    if (u.host === 'en.wikipedia.org' && u.pathname === '/w/api.php') return res({ parse: { sections: [] } });
    if (u.host === 'en.wikipedia.org' && u.pathname.startsWith('/api/rest_v1/page/summary/')) {
      const title = decodeURIComponent(u.pathname.split('/').pop() || '');
      if (/^Adoni_mandal$/.test(title)) {
        return opt.mandalWiki ? res({ extract: 'Adoni mandal is one of the mandals in Kurnool district of the Indian state of Andhra Pradesh. Its headquarters is Adoni.' }) : res({}, 404);
      }
      if (/^Adoni/.test(title)) return res({ extract: 'Adoni is a town in a different country entirely, far away from here and unrelated.' });
      return res({ extract: 'Kurnool district is a district in the Indian state of Andhra Pradesh, India.' });
    }
    if (u.host === 'nominatim.openstreetmap.org') {
      const q = u.searchParams.get('q') || '';
      const vb = u.searchParams.get('viewbox') || '';
      if (/India$/.test(q)) {
        if (/^Adoni/.test(q)) {
          return res(opt.mandalArea ? [{ category: 'boundary', display_name: 'Adoni mandal, Kurnool, Andhra Pradesh, India', boundingbox: MANDAL_BOX }] : []);
        }
        return res([{ category: 'boundary', display_name: 'Kurnool District, Andhra Pradesh, India', boundingbox: DISTRICT_BOX }]);
      }
      if (vb === vbOf(MANDAL_BOX)) return res(opt.mandalHosp ? [nom(7, 'Adoni Area Hospital')] : []);
      if (vb === vbOf(DISTRICT_BOX)) return res(opt.districtHosp ? [nom(1, 'Government General Hospital'), nom(2, 'Sukheebhava Hospital')] : []);
      return res([]);
    }
    if (hosp.OVERPASS_MIRRORS.includes(url)) return res('busy', 429);
    throw new Error('unexpected fetch ' + url);
  });
  return { f, calls };
};

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
const qOf = (c: Call) => new URL(c.url).searchParams.get('q') || '';

describe('place.js keys', () => {
  it('placeKey / splitPlace / levelOf / publicTarget round-trip', () => {
    expect(place.placeKey('kurnool', 'adoni')).toBe('kurnool~adoni');
    expect(place.placeKey('kurnool', '')).toBe('kurnool');
    expect(place.placeKey('', 'adoni')).toBe(''); // a mandal never stands without its district
    expect(place.splitPlace('kurnool~adoni')).toEqual({ district: 'kurnool', mandal: 'adoni' });
    expect(place.splitPlace('kurnool')).toEqual({ district: 'kurnool', mandal: '' });
    expect(place.splitPlace('')).toEqual({ district: '', mandal: '' });
    expect(place.splitPlace('~adoni')).toEqual({ district: '', mandal: '' });
    expect(place.splitPlace(null)).toEqual({ district: '', mandal: '' });
    expect(['kurnool~adoni', 'kurnool', ''].map(place.levelOf)).toEqual(['mandal', 'district', 'state']);
    expect(place.publicTarget({ kind: 'hosp', state: 'AP', district: 'kurnool~adoni', variant: 'govt' })).toEqual({ kind: 'hosp', state: 'AP', district: 'kurnool', mandal: 'adoni', variant: 'govt' });
    expect([...place.MANDAL_KINDS].sort()).toEqual(['govt', 'hosp']);
  });

  it("subLevelWord: the state's own word for a sub-district, tehsil by default", () => {
    expect(place.subLevelWord('AP')).toBe('mandal');
    expect(place.subLevelWord('KA')).toBe('taluk');
    expect(place.subLevelWord('MH')).toBe('taluka');
    expect(place.subLevelWord('BR')).toBe('block');
    expect(place.subLevelWord('UP')).toBe('tehsil');
  });
});

describe('routes: mandal param', () => {
  const p = (q: string) => new URLSearchParams(q);
  it('parseTarget joins district + mandal for Govt / Hospitals only, and needs a district', () => {
    expect(routes.parseTarget(p('kind=hosp&state=AP&district=Kurnool&mandal=Adoni&variant=govt'))).toEqual({ kind: 'hosp', state: 'AP', district: 'kurnool~adoni', variant: 'govt' });
    expect(routes.parseTarget(p('kind=govt&state=AP&district=kurnool&mandal=Yemmiganur Rural'))).toMatchObject({ district: 'kurnool~yemmiganur-rural' });
    expect(routes.parseTarget(p('kind=govt&state=AP&mandal=adoni')).district).toBe(''); // no district: mandal ignored
    expect(routes.parseTarget(p('kind=gprm&state=AP&mandal=adoni')).district).toBe(''); // not a mandal kind
    expect(() => routes.parseTarget(p('kind=gprm&state=IN&district=kurnool'))).toThrow();
  });

  it('GET echoes district + mandal split (never the joined key); a new mandal row is queued on its own', async () => {
    const e = env();
    const g = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=kurnool&mandal=adoni&variant=govt');
    expect(g.status).toBe(200);
    expect(g.json).toMatchObject({ kind: 'hosp', state: 'AP', district: 'kurnool', mandal: 'adoni', variant: 'govt', data: null });
    expect(JSON.stringify(g.json)).not.toContain('~');
    const row = e.DB.raw.prepare("SELECT district, status FROM civic_data WHERE kind='hosp' AND state='AP' AND variant='govt'").get();
    expect(row).toMatchObject({ district: 'kurnool~adoni', status: 'pending' });
  });

  it('POST research with mandal: mandal hospitals saved in the mandal row, scope mandal, reply split', async () => {
    const e = env();
    const { f } = makeFetch();
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'hosp', state: 'AP', district: 'kurnool', mandal: 'adoni', variant: 'govt' }, fetchImpl: f });
    expect(r.json).toMatchObject({ ok: true, status: 'ready', origin: 'free', district: 'kurnool', mandal: 'adoni', scope: 'mandal' });
    expect(r.json.note).toBeUndefined();
    const g = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=kurnool&mandal=adoni&variant=govt', { fetchImpl: f });
    expect(g.json.data.scope).toBe('mandal');
    expect(g.json.data.hospitals.map((h: any) => h.name)).toEqual(['Adoni Area Hospital']);
    expect(g.json.answeredBy).toBe('free');
    // the district row is untouched (a separate place)
    const d = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=kurnool&variant=govt', { fetchImpl: f });
    expect(d.json.data).toBeNull();
  });
});

describe('free/hosp.js + free/govt.js mandal helpers', () => {
  it('areaQueries: mandal first inside its district, else the district, else the state', () => {
    expect(hosp.areaQueries('Andhra Pradesh', 'Kurnool', 'Adoni')).toEqual(['Adoni, Kurnool district, Andhra Pradesh, India', 'Adoni, Kurnool, Andhra Pradesh, India']);
    expect(hosp.areaQueries('Andhra Pradesh', 'Kurnool')).toEqual(['Kurnool district, Andhra Pradesh, India', 'Kurnool, Andhra Pradesh, India']);
    expect(hosp.areaQueries('Andhra Pradesh', '', 'Adoni')).toEqual(['Andhra Pradesh, India']);
  });

  it('fetchHospFree with a mandal: area looked up for the mandal, searches bounded to it', async () => {
    const { f, calls } = makeFetch();
    const r = await hosp.fetchHospFree({ name: 'Andhra Pradesh' }, 'kurnool', { fetchImpl: f, now: NOW, gapMs: 0, sleepImpl: async () => undefined, mandal: 'adoni' });
    expect(r.ok).toBe(true);
    expect(r.place).toBe('Adoni, Kurnool, Andhra Pradesh');
    expect(qOf(calls[0])).toBe('Adoni, Kurnool district, Andhra Pradesh, India');
    expect(calls.slice(1).every(c => new URL(c.url).searchParams.get('viewbox') === vbOf(MANDAL_BOX))).toBe(true);
    expect(r.hospitals.map((h: any) => h.name)).toEqual(['Adoni Area Hospital']);
  });

  it('fetchHospFree: mandal area unknown = "hospital in <mandal>, <district>, <state>" text search', async () => {
    const { f, calls } = makeFetch({ mandalArea: false });
    await hosp.fetchHospFree({ name: 'Andhra Pradesh' }, 'kurnool', { fetchImpl: f, now: NOW, gapMs: 0, sleepImpl: async () => undefined, mandal: 'adoni' });
    expect(calls.map(qOf)).toContain('hospital in Adoni, Kurnool, Andhra Pradesh');
  });

  it('mandalTitles / summaryFits', () => {
    expect(govt.mandalTitles('Adoni', 'Kurnool', 'mandal')).toEqual(['Adoni mandal', 'Adoni Mandal', 'Adoni, Kurnool district', 'Adoni, Kurnool', 'Adoni']);
    expect(govt.mandalTitles('Adoni', '', '')).toEqual(['Adoni']);
    expect(govt.mandalTitles('', 'Kurnool', 'mandal')).toEqual([]);
    expect(govt.summaryFits('Adoni mandal is one of the mandals in Kurnool district of Andhra Pradesh.', 'Kurnool', 'Andhra Pradesh')).toBe(true);
    expect(govt.summaryFits('Adoni is a town in a different country entirely, far away from here.', 'Kurnool', 'Andhra Pradesh')).toBe(false);
    expect(govt.summaryFits('short', 'Kurnool', 'Andhra Pradesh')).toBe(false);
  });

  it("fetchMandalFree: Wikipedia summary only when it names the district / state; MLAs whose seat is the mandal's", async () => {
    const mlas = [
      { name: 'P. V. Parthasarathi', constituency: 'Adoni', party: 'BJP' },
      { name: 'Someone Else', constituency: 'Kurnool', party: 'TDP' },
    ];
    const { f } = makeFetch();
    const m = await govt.fetchMandalFree({ name: 'Andhra Pradesh' }, 'Kurnool', 'Adoni', { fetchImpl: f, now: NOW, level: 'mandal', mlas });
    expect(m.name).toBe('Adoni');
    expect(m.overview).toMatch(/^Adoni mandal is one of the mandals in Kurnool district/);
    expect(m.src).toEqual({ name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Adoni_mandal', date: '2026-11-22' });
    expect(m.mlas).toEqual([{ name: 'P. V. Parthasarathi', constituency: 'Adoni', party: 'BJP' }]);
    // no fitting article: no overview (the same-name town elsewhere is never used)
    const none = await govt.fetchMandalFree({ name: 'Andhra Pradesh' }, 'Kurnool', 'Adoni', { fetchImpl: makeFetch({ mandalWiki: false }).f, now: NOW, level: 'mandal' });
    expect(none).toMatchObject({ overview: '', mlas: [], src: null });
  });
});

describe('research scope fallback (free sources)', () => {
  const T = { kind: 'hosp', state: 'AP', district: 'kurnool~adoni', variant: 'govt' };
  const opts = (f: any) => ({ fetchImpl: f, now: NOW, sleepImpl: async () => undefined });

  it('scopeNote: only when a wider level answered', () => {
    expect(research.scopeNote('mandal', 'mandal')).toEqual({});
    expect(research.scopeNote('mandal', 'district')).toEqual({ note: 'nothing public for the mandal yet: showing the district' });
    expect(research.scopeNote('district', 'state')).toEqual({ note: 'nothing public for the district yet: showing the state' });
  });

  it('Hospitals: no hospital mapped inside the mandal -> the district list, saved in the mandal row with scope + note', async () => {
    const e = env();
    const db = new Db(e.DB);
    const r = await research.researchFree(db, e, T, opts(makeFetch({ mandalHosp: false }).f));
    expect(r).toMatchObject({ ok: true, origin: 'free', scope: 'district', note: 'nothing public for the mandal yet: showing the district' });
    const row = e.DB.raw.prepare("SELECT data FROM civic_data WHERE kind='hosp' AND district='kurnool~adoni' AND variant='govt'").get();
    const data = JSON.parse(row.data);
    expect(data.scope).toBe('district');
    expect(data.hospitals.map((h: any) => h.name)).toEqual(['Government General Hospital']);
  });

  it('Hospitals: nothing in the mandal or district -> the state list (scope state)', async () => {
    const e = env();
    const db = new Db(e.DB);
    const { f } = makeFetch({ mandalHosp: false, districtHosp: false });
    // state level: no viewbox fixture answers, so give the state search one hospital
    const g = jest.fn(async (url: string, init?: any) => {
      const u = new URL(url);
      if (u.host === 'nominatim.openstreetmap.org' && u.searchParams.get('q') === 'Andhra Pradesh, India') {
        return res([{ category: 'boundary', display_name: 'Andhra Pradesh, India', boundingbox: ['12.6', '19.9', '76.7', '84.8'] }]);
      }
      if (u.host === 'nominatim.openstreetmap.org' && u.searchParams.get('viewbox') === '76.7,19.9,84.8,12.6') return res([nom(9, 'Government General Hospital Guntur')]);
      return f(url, init);
    });
    const r = await research.researchFree(db, e, T, opts(g));
    expect(r).toMatchObject({ ok: true, scope: 'state', note: 'nothing public for the mandal yet: showing the state' });
  });

  it('Hospitals: a district list already saved from free sources is reused (no new Nominatim search for it)', async () => {
    const e = env();
    const db = new Db(e.DB);
    await research.researchFree(db, e, { ...T, district: 'kurnool' }, opts(makeFetch().f));
    const { f, calls } = makeFetch({ mandalHosp: false });
    const r = await research.researchFree(db, e, T, opts(f));
    expect(r).toMatchObject({ ok: true, scope: 'district' });
    expect(calls.filter(c => new URL(c.url).searchParams.get('viewbox') === vbOf(DISTRICT_BOX))).toHaveLength(0);
    const p = JSON.parse(e.DB.raw.prepare("SELECT data FROM civic_data WHERE kind='hosp' AND district='kurnool~adoni' AND variant='private'").get().data);
    expect(p.scope).toBe('district');
  });

  it('Govt: mandal with its own Wikipedia article = scope mandal + mandal block; none = scope district + note', async () => {
    const e = env();
    const db = new Db(e.DB);
    const G = { kind: 'govt', state: 'AP', district: 'kurnool~adoni', variant: '' };
    const r = await research.researchFree(db, e, G, opts(makeFetch().f));
    expect(r).toMatchObject({ ok: true, scope: 'mandal' });
    const d = JSON.parse(e.DB.raw.prepare("SELECT data FROM civic_data WHERE kind='govt' AND district='kurnool~adoni'").get().data);
    expect(d.scope).toBe('mandal');
    expect(d.mandal).toMatchObject({ name: 'Adoni', src: { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Adoni_mandal' } });
    expect(d.district.headquarters).toBe('Kurnool');
    const e2 = env();
    const r2 = await research.researchFree(new Db(e2.DB), e2, G, opts(makeFetch({ mandalWiki: false }).f));
    expect(r2).toMatchObject({ ok: true, scope: 'district', note: 'nothing public for the mandal yet: showing the district' });
  });

  it('on-demand POST passes scope + note through to the app', async () => {
    const e = env();
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'hosp', state: 'AP', district: 'kurnool', mandal: 'adoni', variant: 'private' }, fetchImpl: makeFetch({ mandalHosp: false }).f });
    expect(r.json).toMatchObject({ ok: true, status: 'ready', scope: 'district', note: 'nothing public for the mandal yet: showing the district', mandal: 'adoni' });
  });
});
