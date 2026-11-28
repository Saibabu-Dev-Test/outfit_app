// Hospitals stay inside the picked state, and district / mandal lists come from the exact OSM
// boundary (free/scope.js, free/hosp.js fetchHospArea). Reported bug (build-267): Andhra Pradesh >
// Ananthapuramu > Anantapur Rural showed "No data for Anantapur Rural or Ananthapuramu district,
// showing Andhra Pradesh" and then Bengaluru (Karnataka) and Hosur / Ballur (Tamil Nadu / KA PIN)
// hospitals. Causes: the AP bounding box reaches into Karnataka / Tamil Nadu and the Overpass
// upgrade had no state filter; "Ananthapuramu district" matched a solar park in Nominatim (a 5 km
// box) and the mandal was not found at all (OSM: "Anantapuramu District" / "Anantapur Mandal").
// Fixtures are real OSM elements (ids / tags as mapped, trimmed) except where marked synthetic.
// fetch is mocked; D1 is node:sqlite with the real migration SQL.
export {}; // a module
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
const hosp = require('../server/worker/src/civic/free/hosp.js');
const scope = require('../server/worker/src/civic/free/scope.js');
const { LGD } = require('../server/worker/src/civic/lgd.js');

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


// ── fixtures ──
// OSM relation 10215519 "Anantapur Mandal" (ref:LGD:subdistrict 5330 = the app's "Anantapur Rural")
const MANDAL_REL = { type: 'relation', id: 10215519, bounds: { minlat: 14.58, minlon: 77.5, maxlat: 14.78, maxlon: 77.7 }, tags: { boundary: 'administrative', admin_level: '6', name: 'Anantapur Mandal', 'ref:LGD:subdistrict': '5330' } };
// OSM relation 2022303 "Anantapuramu District" (ref:LGD:district 502 = the app's "Ananthapuramu")
const DISTRICT_REL = { type: 'relation', id: 2022303, bounds: { minlat: 13.9, minlon: 76.75, maxlat: 15.25, maxlon: 78.45 }, tags: { boundary: 'administrative', admin_level: '5', name: 'Anantapuramu District', 'ref:LGD:district': '502' } };
const GGH = { type: 'node', id: 7113926692, lat: 14.670812, lon: 77.5946922, tags: { amenity: 'hospital', name: 'Govt. General Hospital', 'addr:full': '11-106-1', 'addr:place': 'Opp Dm&Ho Office', 'addr:district': 'Anantapur', 'addr:subdistrict': 'Anantapur Mandal', 'addr:state': 'Andhra Pradesh', 'addr:postcode': '515001' } };
const CDH = { type: 'node', id: 7113926709, lat: 14.6810951, lon: 77.610412, tags: { amenity: 'hospital', name: 'Government Communicable Diseases Hospital', 'addr:full': '18/9', 'addr:district': 'Anantapur', 'addr:state': 'Andhra Pradesh', 'addr:postcode': '515005' } };
const RANI = { type: 'node', id: 7812341270, lat: 14.6814977, lon: 77.6104953, tags: { amenity: 'hospital', name: 'Government Hospital', 'addr:full': 'Rani Nagar, Anantapur', 'addr:district': 'Anantapur', 'addr:state': 'Andhra Pradesh', 'addr:postcode': '515005' } };
const AASHA = { type: 'node', id: 7113926601, lat: 14.68, lon: 77.6, tags: { amenity: 'hospital', name: 'Aasha Hospitals', 'addr:city': 'Anantapur' } };
// synthetic rows shaped like the reported ones (inside AP's box, outside the state)
const BLR = { type: 'node', id: 900001, lat: 12.98, lon: 77.57, tags: { amenity: 'hospital', name: 'Government Hospital', 'addr:suburb': 'Gandhinagar', 'addr:district': 'Bengaluru Urban', 'addr:state': 'Karnataka', 'addr:postcode': '560064' } };
const BALLUR = { type: 'node', id: 900002, lat: 12.75, lon: 77.78, tags: { amenity: 'hospital', name: 'Government Hospital', 'addr:village': 'Ballur', 'addr:full': 'Hosur, Krishnagiri, Tamil Nadu 562107' } };
const BLR_NO_STATE = { type: 'node', id: 900003, lat: 12.97, lon: 77.59, tags: { amenity: 'hospital', name: 'Victoria Hospital', 'addr:postcode': '560002' } };

const NOW2 = NOW;
const AP = { code: 'AP', name: 'Andhra Pradesh' };
const bodyOf = (init: any) => decodeURIComponent(String((init && init.body) || '')).replace(/^data=/, '');

describe('scope.js: inside the state', () => {
  it('the reported rows are outside Andhra Pradesh; AP rows stay', () => {
    expect(scope.inState({ address: 'Hosur, Krishnagiri, Tamil Nadu 562107' }, 'AP')).toBe(false);
    expect(scope.inState({ address: 'Gandhinagar, Bengaluru Urban, Karnataka 560064' }, 'AP')).toBe(false);
    expect(scope.inState({ address: 'Opp Dm&Ho Office, Anantapur, Andhra Pradesh, 515001' }, 'AP')).toBe(true);
    expect(scope.inState({ address: 'Sai Nagar, Anantapur' }, 'AP')).toBe(true); // nothing says otherwise
    expect(scope.inState({ state: 'Karnataka' }, 'AP')).toBe(false);
    expect(scope.inState({ state: 'Telangana', iso: 'IN-TG' }, 'TG')).toBe(true);
    expect(scope.inState({ iso: 'IN-TS' }, 'TG')).toBe(true); // old OSM code
    expect(scope.inState({ iso: 'IN-KA' }, 'AP')).toBe(false);
    expect(scope.inState({ postcode: '560064' }, 'AP')).toBe(false);
    expect(scope.inState({ postcode: '500001' }, 'AP')).toBe(false); // Hyderabad PIN
    expect(scope.inState({ postcode: '500001' }, 'TG')).toBe(true);
    expect(scope.inState({ postcode: '507133' }, 'AP')).toBe(true); // Polavaram mandals moved to AP
    expect(scope.inState({ postcode: '515001' }, 'TG')).toBe(false);
    expect(scope.inState({ address: 'x' }, '')).toBe(true); // no state: no opinion
  });

  it('PIN prefixes: AP 515-535, Telangana 500-509, every state / UT has a range', () => {
    expect(scope.pinInState('515001', 'AP')).toBe(true);
    expect(scope.pinInState('535001', 'AP')).toBe(true);
    expect(scope.pinInState('536001', 'AP')).toBe(false);
    expect(scope.pinInState('509001', 'TG')).toBe(true);
    expect(scope.pinInState('510001', 'TG')).toBe(false);
    expect(scope.pinInState('abc', 'AP')).toBe(true);
    const codes = require('../server/worker/src/civic/states.js').STATES.map((s: any) => s.code);
    codes.forEach((c: string) => expect(scope.PIN_PREFIXES[c] && scope.PIN_PREFIXES[c].length).toBeGreaterThan(0));
    expect(scope.pinsInText('Hosur, Tamil Nadu 562107; 515 001')).toEqual(['562107', '515001']);
  });

  it('statesInText: whole names only, "Andhra Pradesh" is not also another Pradesh', () => {
    expect(scope.statesInText('Kurnool, Andhra Pradesh')).toEqual(['AP']);
    expect(scope.statesInText('Indore, Madhya Pradesh')).toEqual(['MP']);
    expect(scope.statesInText('Goal Road, Guntur')).toEqual([]);
    expect(scope.statesInText('Puducherry')).toEqual(['PY']);
    expect(scope.stateCodeOfName('Orissa')).toBe('OD');
    expect(scope.stateCodeOfName('Tamil Nadu')).toBe('TN');
  });

  it('scopeHospRow: drops outside rows, and the same positions from each translation', () => {
    const data = { origin: 'free', hospitals: [{ name: 'GGH', address: 'Anantapur, Andhra Pradesh, 515001' }, { name: 'Government Hospital, Bengaluru', address: 'Gandhinagar, Bengaluru Urban, Karnataka 560064' }, { name: 'Aasha', address: '' }] };
    const i18n = { te: { hospitals: [{ note: 'a' }, { note: 'b' }, { note: 'c' }] }, hi: { hospitals: [{ note: 'x' }] } };
    const r = scope.scopeHospRow(data, i18n, 'AP');
    expect(r.dropped).toBe(1);
    expect(r.data.hospitals.map((h: any) => h.name)).toEqual(['GGH', 'Aasha']);
    expect(r.i18n.te.hospitals).toEqual([{ note: 'a' }, { note: 'c' }]);
    expect(r.i18n.hi).toEqual(i18n.hi); // not aligned: left alone (the app falls back to English)
    expect(scope.scopeHospRow(data, null, 'KA').data.hospitals.map((h: any) => h.name)).toEqual(['Government Hospital, Bengaluru', 'Aasha']);
  });
});

describe('scope.js: names and LGD codes', () => {
  it('lgdPlace: the app picks -> OSM LGD codes (also older slugs by spelling)', () => {
    expect(scope.lgdPlace('AP', 'ananthapuramu', 'anantapur-rural')).toEqual({ state: 28, district: { code: 502, name: 'Ananthapuramu' }, mandal: { code: 5330, name: 'Anantapur Rural' } });
    expect(scope.lgdPlace('AP', 'Ananthapuramu', '').district).toEqual({ code: 502, name: 'Ananthapuramu' });
    expect(scope.lgdPlace('AP', 'anantapur', '').district).toEqual({ code: 502, name: 'Ananthapuramu' }); // seed slug
    expect(scope.lgdPlace('AP', 'kurnool', 'adoni')).toMatchObject({ district: { code: 511 }, mandal: { code: 5271 } });
    expect(scope.lgdPlace('AP', 'nowhere', '')).toEqual({ state: 28, district: null, mandal: null });
    expect(scope.lgdPlace('XX', 'kurnool', '')).toEqual({ state: null, district: null, mandal: null });
  });

  it('sameName / nameVariants: Ananthapuramu ~ Anantapuramu District ~ Anantapur; Rural is not Urban', () => {
    expect(scope.sameName('Ananthapuramu', 'Anantapuramu District')).toBe(true);
    expect(scope.sameName('Ananthapuramu', 'Anantapur')).toBe(true);
    expect(scope.sameName('Anantapur Rural', 'Anantapur Urban')).toBe(false);
    expect(scope.sameName('Kurnool', 'Guntur')).toBe(false);
    const v = scope.nameVariants('Ananthapuramu');
    ['ananthapuramu', 'anantapuramu', 'anantapur', 'ananthapur'].forEach(x => expect(v).toContain(x));
    expect(new RegExp(scope.nameRegex('Ananthapuramu'), 'i').test('Anantapuramu District')).toBe(true);
    expect(new RegExp(scope.nameRegex('Anantapur Rural'), 'i').test('Anantapur Mandal')).toBe(false);
  });

  it('lgd.js is generated from the app picker data (node scripts/gen-civic-lgd.js)', () => {
    const india = JSON.parse(fsMod.readFileSync(pathMod.join(ROOT, 'src/data/locations/india.json'), 'utf8'));
    expect(Object.keys(LGD).sort()).toEqual(india.states.map((s: any) => s.c).sort());
    let d = 0;
    let s = 0;
    Object.values(LGD).forEach((st: any) =>
      Object.values(st.d).forEach((x: any) => {
        d += 1;
        s += Object.keys(x[2]).length;
      }),
    );
    expect(d).toBe(india.states.reduce((n: number, st: any) => n + st.d.length, 0));
    // sub-districts sharing a slug inside one district are kept once
    expect(s).toBeLessThanOrEqual(india.counts.subdistricts);
    expect(s).toBeGreaterThan(india.counts.subdistricts * 0.98);
  });
});

describe('hosp.js: exact boundary (Overpass area query)', () => {
  it('overpassAreaQuery: LGD code first, names inside the parent otherwise; never a bbox', () => {
    const st = scope && hosp.overpassAreaQuery({ code: 'AP' });
    expect(st).toContain('rel["ISO3166-2"="IN-AP"]["admin_level"="4"]["boundary"="administrative"]');
    expect(st).toContain('map_to_area->.a;');
    expect(hosp.overpassAreaQuery({ code: 'TG' })).toContain('rel["ISO3166-2"="IN-TS"]');
    const d = hosp.overpassAreaQuery({ code: 'AP', district: { code: 502, name: 'Ananthapuramu' } });
    expect(d).toContain('rel["boundary"="administrative"]["ref:LGD:district"="502"]->.b;');
    const m = hosp.overpassAreaQuery({ code: 'AP', district: { code: 502, name: 'Ananthapuramu' }, mandal: { code: 5330, name: 'Anantapur Rural' } });
    expect(m).toContain('["ref:LGD:subdistrict"="5330"]->.b;');
    const byName = hosp.overpassAreaQuery({ code: 'AP', district: { code: 502, name: 'Ananthapuramu' }, mandal: { name: 'Anantapur Urban' } });
    expect(byName).toContain('["ref:LGD:district"="502"]->.dr;.dr map_to_area->.d;rel(area.d)["boundary"="administrative"]["admin_level"="6"]["name"~"^(anantapur[ -]?urban');
    const dn = hosp.overpassAreaQuery({ code: 'AP', district: { name: 'Ananthapuramu' } });
    expect(dn).toContain('rel(area.st)["boundary"="administrative"]["admin_level"~"^(5|6|8)$"]["name"~"^(ananthapuramu|');
    [st, d, m, byName, dn].forEach(q => expect(q).not.toMatch(/\(\d+\.\d+,\d+\.\d+,/));
    expect(hosp.overpassAreaQuery({})).toBe('');
  });

  it('parseAreaAnswer: boundary + bbox; other-state rows dropped; generic names get their place', () => {
    const p = hosp.parseAreaAnswer({ elements: [MANDAL_REL, GGH, CDH, RANI, AASHA, BLR, BALLUR, BLR_NO_STATE] }, 'AP', '2026-11-27');
    expect(p.boundary).toEqual({ id: 10215519, name: 'Anantapur Mandal', level: '6', lgd: '5330' });
    expect(p.bbox).toEqual({ south: 14.58, north: 14.78, west: 77.5, east: 77.7 });
    expect(p.hospitals.map((h: any) => [h.name, h.type])).toEqual([
      ['Government Communicable Diseases Hospital', 'govt'],
      ['Government Hospital, Anantapur', 'govt'],
      ['Govt. General Hospital', 'govt'],
      ['Aasha Hospitals', 'unknown'],
    ]);
    expect(p.hospitals.find((h: any) => h.name === 'Govt. General Hospital').address).toBe('11-106-1, Opp Dm&Ho Office, Anantapur, Andhra Pradesh, 515001');
    // Karnataka's own list keeps them
    expect(hosp.parseAreaAnswer({ elements: [BLR, BLR_NO_STATE, GGH] }, 'KA', 'x').hospitals.map((h: any) => h.name)).toEqual(['Government Hospital, Gandhinagar', 'Victoria Hospital']);
  });

  it('fetchHospArea: by LGD code; no boundary with that code -> once more by name inside the district', async () => {
    const bodies: string[] = [];
    const f = jest.fn(async (url: string, init: any) => {
      bodies.push(bodyOf(init));
      if (bodies.length === 1) return res({ elements: [] }); // OSM has no ref:LGD:subdistrict=7426
      return res({ elements: [{ ...MANDAL_REL, id: 1, tags: { ...MANDAL_REL.tags, name: 'Anantapur Urban Mandal', 'ref:LGD:subdistrict': '' } }, GGH] });
    });
    const r = await hosp.fetchHospArea(AP, 'ananthapuramu', 'anantapur-urban', { fetchImpl: f, now: NOW2, mirrors: ['https://op.example/api/interpreter'] });
    expect(bodies[0]).toContain('["ref:LGD:subdistrict"="7426"]');
    expect(bodies[1]).toContain('rel(area.d)["boundary"="administrative"]["admin_level"="6"]["name"~"^(anantapur[ -]?urban');
    expect(r).toMatchObject({ ok: true, boundary: { id: 1, name: 'Anantapur Urban Mandal' } });
    expect(r.hospitals.map((h: any) => h.name)).toEqual(['Govt. General Hospital']);
  });

  it('fetchHospArea: Overpass down -> unreachable (the caller falls back to Nominatim)', async () => {
    const f = jest.fn(async () => res('busy', 504));
    const r = await hosp.fetchHospArea(AP, 'ananthapuramu', '', { fetchImpl: f, mirrors: ['https://a.example', 'https://b.example'] });
    expect(r).toMatchObject({ ok: false, unreachable: true, boundary: null });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('fetchHospFree, mandal: the boundary answers; boundary mapped but empty -> not ok, no Nominatim guess', async () => {
    const urls: string[] = [];
    const f = jest.fn(async (url: string) => {
      urls.push(url);
      return res({ elements: [MANDAL_REL, GGH, BLR] });
    });
    const r = await hosp.fetchHospFree(AP, 'ananthapuramu', { fetchImpl: f, now: NOW2, mandal: 'anantapur-rural', mirrors: ['https://op.example'], sleepImpl: async () => {} });
    expect(r).toMatchObject({ ok: true, place: 'Anantapur Rural, Ananthapuramu, Andhra Pradesh', boundary: { lgd: '5330' } });
    expect(r.hospitals.map((h: any) => h.name)).toEqual(['Govt. General Hospital']);
    expect(urls.some(u => u.includes('nominatim'))).toBe(false);
    const g = jest.fn(async (url: string) => (url.includes('nominatim') ? res([]) : res({ elements: [MANDAL_REL] })));
    const e = await hosp.fetchHospFree(AP, 'ananthapuramu', { fetchImpl: g, mandal: 'anantapur-rural', mirrors: ['https://op.example'], sleepImpl: async () => {} });
    expect(e).toMatchObject({ ok: false, error: 'no hospitals found', bbox: { south: 14.58 } });
    expect(g.mock.calls.some((c: any) => String(c[0]).includes('nominatim'))).toBe(false);
  });

  it('Nominatim fallback: a landuse that shares the name is not an area; outside-state results dropped', async () => {
    // the real first hit for "Ananthapuramu district, Andhra Pradesh, India"
    const SOLAR = { category: 'landuse', type: 'industrial', display_name: 'Ananthapuramu Ultra Mega Solar Park, Sri Sathya Sai District, Andhra Pradesh, India', boundingbox: ['13.9804374', '14.0467877', '78.4020156', '78.4478491'] };
    const f = jest.fn(async () => res([SOLAR]));
    const a = await hosp.lookupArea('Andhra Pradesh', 'Ananthapuramu', { fetchImpl: f, timeoutMs: 100, gapMs: 0, sleepImpl: async () => {} });
    expect(a).toMatchObject({ ok: false, error: 'area not found' });
    const nm = (id: number, name: string, address: any) => ({ osm_type: 'node', osm_id: id, name, lat: '14.68', lon: '77.6', address, extratags: null });
    const m = hosp.mergeHospitals(
      [
        [
          nm(1, 'Govt. General Hospital', { city: 'Anantapur', state_district: 'Anantapuramu District', state: 'Andhra Pradesh', 'ISO3166-2-lvl4': 'IN-AP', postcode: '515001' }),
          nm(2, 'Government Hospital', { suburb: 'Gandhinagar', city: 'Bengaluru', state_district: 'Bengaluru Urban', state: 'Karnataka', 'ISO3166-2-lvl4': 'IN-KA', postcode: '560064' }),
          nm(3, 'Victoria Hospital', { city: 'Bengaluru', 'ISO3166-2-lvl4': 'IN-KA' }), // no state name: ISO says KA
          nm(4, 'Ballur PHC', { village: 'Ballur', postcode: '562107' }), // PIN says Karnataka
          nm(5, 'Area Hospital, Hindupur', { town: 'Hindupur', state_district: 'Sri Sathya Sai District', state: 'Andhra Pradesh' }), // other district
        ],
      ],
      '2026-11-27',
      60,
      AP,
      'Ananthapuramu',
    );
    expect(m.map((h: any) => h.name)).toEqual(['Govt. General Hospital']);
  });

  it('fetchHospOverpass with a state code: the boundary (upgrade), never the box', async () => {
    const bodies: string[] = [];
    const f = jest.fn(async (url: string, init: any) => {
      bodies.push(bodyOf(init));
      return res({ elements: [{ type: 'relation', id: 2022095, bounds: { minlat: 12.62, minlon: 76.76, maxlat: 19.17, maxlon: 84.77 }, tags: { boundary: 'administrative', admin_level: '4', name: 'Andhra Pradesh' } }, GGH, BLR, BALLUR] });
    });
    const r = await hosp.fetchHospOverpass(AP, '', { fetchImpl: f, now: NOW2, bbox: { south: 12.62, north: 19.17, west: 76.76, east: 84.77 }, mirrors: ['https://op.example'] });
    expect(bodies[0]).toContain('rel["ISO3166-2"="IN-AP"]');
    expect(bodies[0]).not.toContain('12.62');
    expect(r.hospitals.map((h: any) => h.name)).toEqual(['Govt. General Hospital']);
    // legacy box mode (no state code): still filtered by state name
    const g = jest.fn(async () => res({ elements: [GGH, BLR] }));
    const l = await hosp.fetchHospOverpass('Andhra Pradesh', 'x', { fetchImpl: g, bbox: { south: 1, north: 2, west: 3, east: 4 }, mirrors: ['https://op.example'] });
    expect(l.hospitals.map((h: any) => h.name)).toEqual(['Govt. General Hospital']);
  });
});

// ── routes: the reported place end to end ──
const STATE_KEY = { kind: 'hosp', state: 'AP', district: '' };
const MANDAL_KEY = { kind: 'hosp', state: 'AP', district: 'ananthapuramu~anantapur-rural' };
const saveRow = (e: any, t: any, variant: string, data: any, i18n: any = null) =>
  e.DB.raw
    .prepare(
      "INSERT INTO civic_data (kind, state, district, variant, data, sources, status, model, updated_at, i18n, schema_v, origin, free_at) VALUES (?, ?, ?, ?, ?, '[]', 'ok', 'free', ?, ?, 2, 'free', ?)",
    )
    .run(t.kind, t.state, t.district, variant, JSON.stringify(data), Date.UTC(2026, 10, 22), i18n ? JSON.stringify(i18n) : null, Date.UTC(2026, 10, 22));
// What build-267 showed: the 22 Nov state list (with Bengaluru / Hosur rows) copied to the mandal
const OLD_ROW = {
  origin: 'free',
  asOf: '2026-11-22',
  scope: 'state',
  hospitals: [
    { name: 'Government Hospital, Ballur', slug: 'government-hospital-ballur', address: 'Hosur, Krishnagiri, Tamil Nadu 562107', ownership: 'govt', type: 'Government' },
    { name: 'Government Hospital, Bengaluru', slug: 'government-hospital-bengaluru', address: 'Gandhinagar, Bengaluru Urban, Karnataka 560064', ownership: 'govt', type: 'Government' },
    { name: 'Government General Hospital', slug: 'government-general-hospital', address: 'Main Road, Kurnool, Andhra Pradesh, 518001', ownership: 'govt', type: 'Government' },
  ],
};
const env = (extra: any = {}) => ({ DB: makeD1(), FIREBASE_PROJECT_ID: 'outfit-vote-9edca', CIVIC_FREE_GAP_MS: '0', ...extra });
const call = async (e: any, method: string, path: string, opts: { body?: any; fetchImpl?: any } = {}) => {
  const headers: any = { authorization: `Bearer ${token()}` };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const req = new Request(`https://outfit-api.example.workers.dev${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const waits: Promise<any>[] = [];
  const r = await handleRequest(req, e, { waitUntil: (p: Promise<any>) => waits.push(p) }, { fetchImpl: opts.fetchImpl, now: NOW });
  await Promise.all(waits);
  return { status: r.status, json: JSON.parse(await r.text()) };
};
const jwksOr = (f: (url: string, init: any) => any) =>
  jest.fn(async (url: string, init?: any) => {
    if (url === JWKS_URL) return { ok: true, status: 200, headers: { get: () => 'public, max-age=3600' }, json: async () => ({ keys: [jwk] }) };
    return f(url, init);
  });
const MANDAL_PATH = '/v1/civic/data?kind=hosp&state=AP&district=Ananthapuramu&mandal=Anantapur%20Rural&variant=govt';

beforeEach(() => clearJwksCache());

describe('routes: Ananthapuramu > Anantapur Rural (build-267 report)', () => {
  it('a saved row from before the fix: other-state rows never shown (translations too); status partial asks for a re-research', async () => {
    const e = env();
    saveRow(e, MANDAL_KEY, 'govt', OLD_ROW, { te: { hospitals: OLD_ROW.hospitals.map(h => ({ note: `te ${h.name}` })) } });
    const f = jwksOr(() => {
      throw new Error('no fetch on a read');
    });
    const g = await call(e, 'GET', MANDAL_PATH, { fetchImpl: f });
    expect(g.status).toBe(200);
    expect(g.json.data.hospitals.map((h: any) => h.name)).toEqual(['Government General Hospital']);
    expect(g.json.i18n.te.hospitals).toEqual([{ note: 'te Government General Hospital' }]);
    expect(g.json.status).toBe('partial');
  });

  it('re-research: the mandal boundary answers (no state fallback, no other state); Overpass down -> saved list stands', async () => {
    const e = env();
    saveRow(e, MANDAL_KEY, 'govt', OLD_ROW);
    saveRow(e, MANDAL_KEY, 'private', { ...OLD_ROW, hospitals: [] });
    saveRow(e, STATE_KEY, 'govt', OLD_ROW);
    saveRow(e, STATE_KEY, 'private', { ...OLD_ROW, hospitals: [] });
    // Overpass down, Nominatim knows nothing: the saved (filtered) list stays, no AI call
    const down = jwksOr(url => (url.includes('nominatim') ? res([]) : res('busy', 504)));
    const r0 = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'hosp', state: 'AP', district: 'ananthapuramu', mandal: 'anantapur-rural', variant: 'govt' }, fetchImpl: down });
    expect(r0.json).toMatchObject({ ok: true, status: 'saved' });
    expect(down.mock.calls.some((c: any) => /generativelanguage|groq/.test(String(c[0])))).toBe(false);
    // the outdated state row is never copied down to the mandal
    const bodies: string[] = [];
    const up = jwksOr((url, init) => {
      if (url.includes('nominatim')) throw new Error('no Nominatim needed');
      bodies.push(bodyOf(init));
      return res({ elements: [MANDAL_REL, GGH, CDH, AASHA, BLR, BALLUR] });
    });
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'hosp', state: 'AP', district: 'ananthapuramu', mandal: 'anantapur-rural', variant: 'govt' }, fetchImpl: up });
    expect(r.json).toMatchObject({ ok: true, status: 'ready', did: 'research', origin: 'free', scope: 'mandal' });
    expect(bodies[0]).toContain('["ref:LGD:subdistrict"="5330"]');
    const g = await call(e, 'GET', MANDAL_PATH, { fetchImpl: up });
    expect(g.json.status).toBe('ok');
    expect(g.json.data.scope).toBe('mandal');
    expect(g.json.data.v).toBe(research.FREE_HOSP_V);
    expect(g.json.data.hospitals.map((h: any) => h.name)).toEqual(['Government Communicable Diseases Hospital', 'Govt. General Hospital']);
    const p = await call(e, 'GET', MANDAL_PATH.replace('variant=govt', 'variant=private'), { fetchImpl: up });
    expect(p.json.data.hospitals.map((h: any) => h.name)).toEqual(['Aasha Hospitals']);
    const geo = e.DB.raw.prepare("SELECT label, overpass_status FROM civic_geo WHERE place='AP|ananthapuramu~anantapur-rural'").get();
    expect(geo).toEqual({ label: 'osm:relation/10215519 Anantapur Mandal', overpass_status: 'ok' });
  });

  it('an old Nominatim box for the district (the solar park) is not trusted', async () => {
    const e = env();
    e.DB.raw
      .prepare("INSERT INTO civic_geo (place, label, bbox, lat, lon, fetched_at) VALUES ('AP|ananthapuramu', 'Ananthapuramu Ultra Mega Solar Park', ?, 14.0, 78.4, ?)")
      .run(JSON.stringify({ south: 13.98, north: 14.05, west: 78.4, east: 78.45 }), NOW);
    const up = jwksOr(url => {
      if (url.includes('nominatim')) throw new Error('no Nominatim needed');
      return res({ elements: [DISTRICT_REL, GGH, CDH] });
    });
    const db = new Db(e.DB);
    const r = await research.researchFree(db, e, { kind: 'hosp', state: 'AP', district: 'ananthapuramu', variant: 'govt' }, { fetchImpl: up, now: NOW, sleepImpl: async () => {} });
    expect(r).toMatchObject({ ok: true, scope: 'district', count: 2 });
    const geo = e.DB.raw.prepare("SELECT label, bbox FROM civic_geo WHERE place='AP|ananthapuramu'").get();
    expect(geo.label).toBe('osm:relation/2022303 Anantapuramu District');
    expect(JSON.parse(geo.bbox)).toEqual({ south: 13.9, north: 15.25, west: 76.75, east: 78.45 });
  });

  it('cron: outdated free hospital rows are re-fetched first (free sources only)', async () => {
    const e = env();
    saveRow(e, STATE_KEY, 'govt', OLD_ROW);
    saveRow(e, STATE_KEY, 'private', { ...OLD_ROW, hospitals: [] });
    const db = new Db(e.DB);
    const f = jwksOr(url => {
      if (url.includes('nominatim')) {
        const q = new URL(url).searchParams.get('q') || '';
        if (/India$/.test(q)) return res([{ category: 'boundary', display_name: 'Andhra Pradesh, India', boundingbox: ['12.62', '19.17', '76.76', '84.77'] }]);
        return res([
          { osm_type: 'node', osm_id: 7113926692, name: 'Govt. General Hospital', lat: '14.67', lon: '77.59', address: { city: 'Anantapur', state: 'Andhra Pradesh', postcode: '515001' } },
          { osm_type: 'node', osm_id: 900001, name: 'Government Hospital', lat: '12.98', lon: '77.57', address: { suburb: 'Gandhinagar', city: 'Bengaluru', state: 'Karnataka', postcode: '560064' } },
        ]);
      }
      if (/generativelanguage|groq/.test(url)) throw new Error('no AI');
      return res('busy', 504);
    });
    const out = await research.runFreeRefresh(db, e, { fetchImpl: f, now: NOW, sleepImpl: async () => {} });
    expect(out.results.some((x: any) => x.kind === 'hosp' && x.district === '' && x.ok)).toBe(true);
    const row = JSON.parse(e.DB.raw.prepare("SELECT data FROM civic_data WHERE kind='hosp' AND state='AP' AND district='' AND variant='govt'").get().data);
    expect(row.v).toBe(research.FREE_HOSP_V);
    expect(row.hospitals.map((h: any) => h.name)).toEqual(['Govt. General Hospital']);
  });

  it('isOutdatedFreeHosp', () => {
    expect(research.isOutdatedFreeHosp('hosp', 'free', { hospitals: [] })).toBe(true);
    expect(research.isOutdatedFreeHosp('hosp', 'free', { v: research.FREE_HOSP_V })).toBe(false);
    expect(research.isOutdatedFreeHosp('hosp', 'ai', { hospitals: [] })).toBe(false);
    expect(research.isOutdatedFreeHosp('govt', 'free', {})).toBe(false);
  });
});
