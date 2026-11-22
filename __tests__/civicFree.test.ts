// Free civic sources (server/worker/src/civic/free): Govt from Wikidata + Wikipedia, hospitals from
// OpenStreetMap (Nominatim fast path, Overpass upgrade), official static info. fetch is mocked.
const free = require('../server/worker/src/civic/free/index.js');
const hosp = require('../server/worker/src/civic/free/hosp.js');
const staticMod = require('../server/worker/src/civic/free/staticInfo.js');
const { FREE_UA } = require('../server/worker/src/civic/free/http.js');

const NOW = Date.UTC(2026, 10, 22, 10, 0, 0);
const res = (body: any, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
const lit = (v: string) => ({ type: 'literal', value: v });
const rows = (bindings: any[]) => ({ results: { bindings } });

// ── Govt fixtures ──
const OFFICES = rows([
  { ol: lit('Governor of Andhra Pradesh'), p: lit('http://www.wikidata.org/entity/Q1'), pLabel: lit('S. Abdul Nazeer'), start: lit('2023-02-24T00:00:00Z') },
  { ol: lit('Chief Minister of Andhra Pradesh'), p: lit('http://www.wikidata.org/entity/Q2'), pLabel: lit('N. Chandrababu Naidu'), start: lit('2024-06-12T00:00:00Z'), partyLabel: lit('Telugu Desam Party') },
  { ol: lit('Deputy Chief Minister of Andhra Pradesh'), p: lit('http://www.wikidata.org/entity/Q3'), pLabel: lit('Pawan Kalyan'), start: lit('2024-06-12T00:00:00Z'), partyLabel: lit('Janasena Party') },
]);
const STATE = rows([
  { kind: lit('state'), capLabel: lit('Amaravati'), pop: lit('49386799'), web: lit('http://www.ap.gov.in'), article: lit('https://en.wikipedia.org/wiki/Andhra_Pradesh') },
  { kind: lit('item'), xl: lit('2024 Andhra Pradesh Legislative Assembly election'), date: lit('2024-05-13T00:00:00Z'), article: lit('https://en.wikipedia.org/wiki/2024_Andhra_Pradesh_Legislative_Assembly_election') },
  { kind: lit('item'), xl: lit('2019 Andhra Pradesh Legislative Assembly election'), date: lit('2019-04-11T00:00:00Z') },
  { kind: lit('item'), xl: lit('2024 Indian general election in Andhra Pradesh'), date: lit('2024-05-13T00:00:00Z') },
  { kind: lit('item'), xl: lit('Fourth Naidu ministry'), date: lit('2024-06-12T00:00:00Z'), article: lit('https://en.wikipedia.org/wiki/Fourth_Naidu_ministry') },
]);
const DISTRICT = rows([
  { d: lit('http://www.wikidata.org/entity/Q15395'), dLabel: lit('Kurnool district'), hqLabel: lit('Kurnool'), web: lit('http://kurnool.ap.gov.in'), article: lit('https://en.wikipedia.org/wiki/Kurnool_district') },
]);
const MINISTRY_HTML = `<table class="wikitable"><tbody>
<tr><th>Minister</th><th>Portfolio</th><th>Party</th></tr>
<tr><td colspan="3">Chief Minister</td></tr>
<tr><td>N. Chandrababu Naidu</td><td>General Administration</td><td>TDP</td></tr>
<tr><td colspan="3">Deputy Chief Minister</td></tr>
<tr><td>Pawan Kalyan</td><td>Panchayat Raj</td><td>JSP</td></tr>
<tr><td colspan="2">Cabinet Ministers</td><td></td></tr>
<tr><td>Nara Lokesh<sup class="reference">[1]</sup></td><td>Education</td><td>TDP</td></tr>
</tbody></table>`;
const LS_HTML = `<table class="wikitable"><tbody>
<tr><th>No.</th><th>Constituency</th><th>Name</th><th>Party</th></tr>
<tr><td>1</td><td>Kurnool</td><td>Bastipati Nagaraju</td><td>TDP</td></tr>
<tr><td>2</td><td>Guntur</td><td>Pemmasani Chandrasekhar</td><td>TDP</td></tr>
</tbody></table>`;
const MLA_HTML = `<table class="wikitable"><tbody>
<tr><th>District</th><th>Constituency</th><th>Winner Candidate</th><th>Winner Party</th></tr>
<tr><td>Kurnool</td><td>Kurnool</td><td>T. G. Bharath</td><td>TDP</td></tr>
<tr><td>Guntur</td><td>Guntur East</td><td>Mohammed Naseer</td><td>TDP</td></tr>
</tbody></table>`;

function govtFetch(opts: { wikidataDown?: boolean } = {}) {
  const calls: { url: string; init: any }[] = [];
  const f = jest.fn(async (url: string, init: any) => {
    calls.push({ url, init });
    const u = new URL(url);
    if (u.host === 'query.wikidata.org') {
      if (opts.wikidataDown) return res('busy', 503);
      const q = u.searchParams.get('query') || '';
      if (q.includes('Deputy Chief Minister|Administrator')) return res(OFFICES);
      if (q.includes('BIND("state"')) return res(STATE);
      if (q.includes('wdt:P150 ?d')) return res(DISTRICT);
      return res(rows([]));
    }
    if (u.pathname === '/w/api.php') {
      const page = u.searchParams.get('page');
      const prop = u.searchParams.get('prop');
      const section = u.searchParams.get('section');
      if (prop === 'sections') {
        if (page === 'List_of_members_of_the_18th_Lok_Sabha') return res({ parse: { sections: [{ line: 'Assam', index: '2' }, { line: 'Andhra Pradesh', index: '3' }] } });
        if (page === '2024_Andhra_Pradesh_Legislative_Assembly_election') return res({ parse: { sections: [{ line: 'Results', index: '4' }, { line: 'Results by constituency', index: '5' }] } });
        return res({ parse: { sections: [] } });
      }
      if (page === 'List_of_members_of_the_18th_Lok_Sabha' && section === '3') return res({ parse: { text: LS_HTML } });
      if (page === '2024_Andhra_Pradesh_Legislative_Assembly_election' && section === '5') return res({ parse: { text: MLA_HTML } });
      if (page === 'Fourth_Naidu_ministry') return res({ parse: { text: MINISTRY_HTML } });
      return res({ error: 'missing' }, 404);
    }
    if (u.pathname.startsWith('/api/rest_v1/page/summary/')) return res({ extract: 'Kurnool district is a district in the Rayalaseema region of Andhra Pradesh.' });
    return res('not found', 404);
  });
  return { f, calls };
}

describe('civic free: govt (Wikidata + Wikipedia)', () => {
  const AP = { code: 'AP', name: 'Andhra Pradesh' };

  test('state + district from free sources, with static helplines / schemes', async () => {
    const { f, calls } = govtFetch();
    const r = await free.fetchGovtFree(AP, 'kurnool', { fetchImpl: f, now: NOW });
    expect(r.ok).toBe(true);
    const d = r.data;
    expect(d.origin).toBe('free');
    expect(d.asOf).toBe('2026-11-22');
    expect(d.overview).toMatch(/Kurnool district/);
    expect(d.leaders.governor).toBe('S. Abdul Nazeer');
    expect(d.leaders.chiefMinister).toMatchObject({ name: 'N. Chandrababu Naidu', party: 'Telugu Desam Party' });
    expect(d.leaders.deputyCMs).toEqual([{ name: 'Pawan Kalyan', party: 'JSP', role: 'Panchayat Raj' }]);
    expect(d.leaders.ministers).toEqual([{ name: 'Nara Lokesh', party: 'TDP', role: 'Education' }]);
    expect(d.district.headquarters).toBe('Kurnool');
    expect(d.district.collector).toBe('');
    expect(d.district.mlas).toEqual([{ name: 'T. G. Bharath', constituency: 'Kurnool', party: 'TDP' }]);
    expect(d.district.mps).toEqual([{ name: 'Bastipati Nagaraju', constituency: 'Kurnool', party: 'TDP' }]);
    expect(d.offices.map((o: any) => o.website)).toEqual(['https://kurnool.ap.gov.in', 'https://www.ap.gov.in']);
    expect(d.election.lastAssembly).toBe('2024 Andhra Pradesh Legislative Assembly election (2024-05-13)');
    expect(d.election.next).toBe('Assembly: due by 2029 (5-year term); Lok Sabha: due by 2029');
    expect(d.election.voterHelpline).toBe('1950');
    expect(d.helplines.map((h: any) => h.number)).toEqual(expect.arrayContaining(['112', '108', '181', '1098', '1930', '1950', '14555']));
    expect(d.schemes).toBe(staticMod.CENTRAL_SCHEMES);
    expect(d.grievance[0].website).toBe('https://pgportal.gov.in');
    expect(d.src.leaders).toEqual({ name: 'Wikidata + Wikipedia', url: 'https://en.wikipedia.org/wiki/Fourth_Naidu_ministry', date: '2026-11-22' });
    expect(r.sources.map((s: any) => s.url)).toContain('https://pgportal.gov.in');
    // every request identifies the app (Wikimedia policy)
    expect(calls.length).toBeGreaterThan(5);
    calls.forEach(c => expect(c.init.headers['User-Agent']).toBe(FREE_UA));
  });

  test('state only: no district lookups', async () => {
    const { f, calls } = govtFetch();
    const r = await free.fetchGovtFree(AP, '', { fetchImpl: f, now: NOW });
    expect(r.ok).toBe(true);
    expect(r.data.district.mlas).toEqual([]);
    expect(calls.some(c => c.url.includes('Lok_Sabha'))).toBe(false);
  });

  test('Wikidata down -> not ok (caller falls back), unknown state -> not ok', async () => {
    const { f } = govtFetch({ wikidataDown: true });
    expect(await free.fetchGovtFree(AP, 'kurnool', { fetchImpl: f, now: NOW })).toMatchObject({ ok: false });
    expect(await free.fetchGovtFree({ code: 'XX', name: 'Nowhere' }, '', { fetchImpl: f, now: NOW })).toEqual({ ok: false, error: 'no wikidata item for state' });
  });
});

// ── Hospitals fixtures (Nominatim jsonv2) ──
const nom = (type: string, id: number, name: string, extra: any = {}) => ({
  osm_type: type,
  osm_id: id,
  name,
  lat: '15.83',
  lon: '78.04',
  category: 'amenity',
  type: 'hospital',
  display_name: `${name}, Kurnool, Andhra Pradesh, India`,
  address: { road: 'Main Road', city: 'Kurnool', state_district: 'Kurnool District', state: 'Andhra Pradesh', postcode: '518001' },
  extratags: null,
  ...extra,
});
const AREA = [{ category: 'boundary', type: 'administrative', display_name: 'Kurnool District, Andhra Pradesh, India', boundingbox: ['15.13', '15.96', '76.97', '78.27'] }];

function hospFetch({ areaFound = true } = {}) {
  const urls: string[] = [];
  const f = jest.fn(async (url: string) => {
    urls.push(url);
    const u = new URL(url);
    const q = u.searchParams.get('q') || '';
    if (/India$/.test(q)) return res(areaFound ? AREA : []);
    if (/^hospital/.test(q))
      return res([
        nom('node', 1, 'Government General Hospital', { extratags: { 'contact:phone': '+91 8518 222222' } }),
        nom('node', 2, 'Sukheebhava Hospital'),
        nom('way', 3, 'hospital', { address: {} }), // generic name, no town -> dropped
        nom('node', 4, 'Sai Clinic', { extratags: { 'operator:type': 'private', phone: '+91 99999 00000' } }),
      ]);
    if (/^government hospital/.test(q)) return res([nom('node', 1, 'Government General Hospital'), nom('node', 5, 'Government Hospital', { address: { town: 'Adoni' } })]);
    if (/^primary health centre/.test(q)) return res([nom('node', 6, 'Primary Health Centre', { category: 'healthcare', address: { village: 'Nannur', state: 'Andhra Pradesh' }, extratags: { description: 'Primary Health Centre' } })]);
    return res([]);
  });
  return { f, urls };
}

describe('civic free: hospitals (OpenStreetMap)', () => {
  test('Nominatim fast path: bounded to the district, sequential at <= 1 req/s, deduped and classified', async () => {
    const { f, urls } = hospFetch();
    const gaps: number[] = [];
    const r = await free.fetchHospFree({ name: 'Andhra Pradesh' }, 'kurnool', { fetchImpl: f, now: NOW, sleepImpl: async (ms: number) => gaps.push(ms) });
    expect(r.ok).toBe(true);
    expect(r.place).toBe('Kurnool, Andhra Pradesh');
    expect(r.bbox).toEqual({ south: 15.13, north: 15.96, west: 76.97, east: 78.27 });
    // 1 area lookup + 3 searches, each search waits >= 1 s
    expect(urls).toHaveLength(4);
    expect(gaps).toEqual([1100, 1100, 1100]);
    urls.slice(1).forEach(x => {
      const u = new URL(x);
      expect(u.origin + u.pathname).toBe(hosp.NOMINATIM);
      expect(u.searchParams.get('viewbox')).toBe('76.97,15.96,78.27,15.13');
      expect(u.searchParams.get('bounded')).toBe('1');
      expect(u.searchParams.get('format')).toBe('jsonv2');
      expect(u.searchParams.get('extratags')).toBe('1');
    });
    const byId = Object.fromEntries(r.hospitals.map((h: any) => [h.id, h]));
    expect(Object.keys(byId).sort()).toEqual(['node/1', 'node/2', 'node/4', 'node/5', 'node/6']);
    expect(byId['node/1']).toMatchObject({
      name: 'Government General Hospital',
      type: 'govt',
      phone: '+91 8518 222222',
      address: 'Main Road, Kurnool, Kurnool District, Andhra Pradesh, 518001',
      lat: 15.83,
      lon: 78.04,
      mapUrl: 'https://www.openstreetmap.org/?mlat=15.83&mlon=78.04#map=17/15.83/78.04',
      src: { name: 'OpenStreetMap (Nominatim)', url: 'https://www.openstreetmap.org/node/1', date: '2026-11-22' },
    });
    expect(byId['node/2'].type).toBe('unknown');
    expect(byId['node/4']).toMatchObject({ type: 'private', phone: '+91 99999 00000' });
    expect(byId['node/5'].name).toBe('Government Hospital, Adoni');
    expect(byId['node/6']).toMatchObject({ name: 'Primary Health Centre, Nannur', type: 'govt' });
    // govt first
    expect(r.hospitals.slice(0, 3).every((h: any) => h.type === 'govt')).toBe(true);
  });

  test('district not found -> unbounded "<query> in District, State" searches', async () => {
    const { f, urls } = hospFetch({ areaFound: false });
    const r = await free.fetchHospFree('Andhra Pradesh', 'Kurnool', { fetchImpl: f, now: NOW, sleepImpl: async () => {} });
    expect(r.ok).toBe(true);
    expect(r.bbox).toBeNull();
    const searches = urls.filter(x => !/India$/.test(new URL(x).searchParams.get('q') || ''));
    expect(searches.map(x => new URL(x).searchParams.get('q'))).toEqual(['hospital in Kurnool, Andhra Pradesh', 'government hospital in Kurnool, Andhra Pradesh', 'primary health centre in Kurnool, Andhra Pradesh']);
    searches.forEach(x => expect(new URL(x).searchParams.get('viewbox')).toBeNull());
  });

  test('network down -> not ok, never throws', async () => {
    const f = jest.fn(async () => {
      throw new Error('ECONNRESET');
    });
    const r = await free.fetchHospFree('Andhra Pradesh', 'kurnool', { fetchImpl: f, now: NOW, sleepImpl: async () => {} });
    expect(r).toMatchObject({ ok: false, hospitals: [] });
    expect(await free.fetchHospFree('', 'x', { fetchImpl: f })).toMatchObject({ ok: false, error: 'no state' });
  });

  test('classifyHospital', () => {
    expect(hosp.classifyHospital('GGH Kurnool')).toBe('govt');
    expect(hosp.classifyHospital('Area Hospital, Adoni')).toBe('govt');
    expect(hosp.classifyHospital('Vijaya PHC')).toBe('govt');
    expect(hosp.classifyHospital('Govind Hospital')).toBe('unknown');
    expect(hosp.classifyHospital('KIMS Pvt Ltd')).toBe('private');
    expect(hosp.classifyHospital('City Care', { 'operator:type': 'government' })).toBe('govt');
    expect(hosp.classifyHospital('Government Hospital', { 'operator:type': 'private' })).toBe('private');
  });

  test('Overpass upgrade: POST, falls back to the next mirror', async () => {
    const seen: string[] = [];
    const f = jest.fn(async (url: string, init: any) => {
      seen.push(url);
      expect(init.method).toBe('POST');
      expect(decodeURIComponent(init.body)).toContain('nwr["amenity"="hospital"](15.13,76.97,15.96,78.27)');
      if (url === hosp.OVERPASS_MIRRORS[0]) return res('gateway timeout', 504);
      return res({
        elements: [
          { type: 'node', id: 10, lat: 15.8, lon: 78.0, tags: { amenity: 'hospital', name: 'District Hospital', 'addr:city': 'Kurnool', phone: '08518-1' } },
          { type: 'node', id: 13, lat: 15.6, lon: 78.2, tags: { amenity: 'hospital', name: 'Government Hospital', 'addr:town': 'Adoni' } },
          { type: 'way', id: 11, center: { lat: 15.7, lon: 78.1 }, tags: { amenity: 'hospital', name: 'Medicover Hospitals', 'operator:type': 'private' } },
          { type: 'node', id: 12, lat: 15.7, lon: 78.1, tags: { amenity: 'hospital' } }, // no name
        ],
      });
    });
    const r = await free.fetchHospOverpass('Andhra Pradesh', 'kurnool', { fetchImpl: f, now: NOW, bbox: { south: 15.13, north: 15.96, west: 76.97, east: 78.27 } });
    expect(seen).toEqual(hosp.OVERPASS_MIRRORS.slice(0, 2));
    expect(r.ok).toBe(true);
    expect(r.mirror).toBe(hosp.OVERPASS_MIRRORS[1]);
    expect(r.hospitals.map((h: any) => [h.name, h.type, h.osmUrl])).toEqual([
      ['District Hospital', 'govt', 'https://www.openstreetmap.org/node/10'],
      ['Government Hospital, Adoni', 'govt', 'https://www.openstreetmap.org/node/13'],
      ['Medicover Hospitals', 'private', 'https://www.openstreetmap.org/way/11'],
    ]);
  });

  test('Overpass: every mirror down -> not ok', async () => {
    const f = jest.fn(async () => res('busy', 429));
    const r = await free.fetchHospOverpass('Andhra Pradesh', 'kurnool', { fetchImpl: f, bbox: { south: 1, north: 2, west: 3, east: 4 } });
    expect(r).toMatchObject({ ok: false, hospitals: [] });
    expect(f).toHaveBeenCalledTimes(3);
  });
});

describe('civic free: static official info', () => {
  const s = free.staticInfo;
  test('national helplines', () => {
    const nums = Object.fromEntries(s.HELPLINES.map((h: any) => [h.number, h.name]));
    ['112', '108', '181', '1098', '1930', '1950', '14555'].forEach(n => expect(nums[n]).toBeTruthy());
    expect(nums['14555']).toMatch(/Ayushman/);
  });
  test('schemes: PM-JAY, PM-KISAN, NSAP, PMAY, NFSA on official .gov.in sites', () => {
    const names = s.CENTRAL_SCHEMES.map((x: any) => x.name).join(' | ');
    ['PM-JAY', 'PM-KISAN', 'NSAP', 'PMAY', 'NFSA'].forEach(n => expect(names).toContain(n));
    s.CENTRAL_SCHEMES.forEach((x: any) => {
      expect(x.website).toMatch(/^https:\/\/[a-z0-9.-]+\.gov\.in$/);
      expect(x.level).toBe('central');
    });
  });
  test('CPGRAMS + voter', () => {
    expect(s.CPGRAMS_URL).toBe('https://pgportal.gov.in');
    expect(s.GRIEVANCE[0].website).toBe('https://pgportal.gov.in');
    expect(s.VOTER).toEqual({ helpline: '1950', website: 'https://voters.eci.gov.in' });
  });
  test('Collector / SP never guessed', () => {
    expect(s.districtOfficials('Kurnool', 'http://kurnool.ap.gov.in')).toEqual({
      collector: 'Public info not available',
      sp: 'Public info not available',
      hint: 'See the official Kurnool district website: https://kurnool.ap.gov.in',
    });
    expect(s.districtOfficials().hint).toMatch(/official district website/);
  });
});
