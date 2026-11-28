// Mumbai hospitals (reported: Maharashtra > Mumbai showed no hospitals / no government hospitals).
// Causes: BMC (municipal), railway, ESIS and defence hospitals carry no operator tag and no
// "government" in the name; KEM is mapped only as its campus (landuse="hospital Grounds"); Overpass
// output was cut at 300 rows; the district name fallback only tried admin_level 5 and "Mumbai" never
// matched OSM's "Mumbai City District"; Nominatim rows of Mumbai Suburban passed the Mumbai district
// check (substring). Fixture: real OSM elements of Mumbai City District (ref:LGD:district=482,
// __tests__/fixtures/osm-mumbai-city.json). Nominatim rows below are synthetic (shape as returned).
export {};
declare const __dirname: string;
const fsMod = require('fs');
const pathMod = require('path');
const hosp = require('../server/worker/src/civic/free/hosp.js');
const scope = require('../server/worker/src/civic/free/scope.js');
const research = require('../server/worker/src/civic/research.js');

const FIX = JSON.parse(
  fsMod.readFileSync(
    pathMod.join(__dirname, 'fixtures', 'osm-mumbai-city.json'),
    'utf8',
  ),
);
const parsed = hosp.parseAreaAnswer(FIX, 'MH', '2026-11-28', 1500);
const typeOf = (name: string) => {
  const hit = parsed.hospitals.filter((h: any) => h.name === name);
  expect(hit.length).toBeGreaterThan(0);
  return hit[0].type;
};

describe('Mumbai City District: govt hospitals from real OSM rows', () => {
  it('reads the exact boundary', () => {
    expect(parsed.boundary).toEqual(
      expect.objectContaining({
        name: 'Mumbai City District',
        lgd: '482',
        level: '5',
      }),
    );
  });

  it('KEM, Sion, Nair, JJ and the Municipal ENT Hospital are govt (no operator tag in OSM)', () => {
    [
      'King Edward Memorial Hospital',
      'L.T.Muncipal Medical College and Sion Hospital',
      'Sion Hospital',
      'BYL Nair hospital',
      'Nair Hospital',
      'J. J. Hospital',
      'Atmasingh Jassasingh Bankebihar Municipal ENT Hospital',
    ].forEach(n => expect([n, typeOf(n)]).toEqual([n, 'govt']));
  });

  it('BMC, railway, ESIS and naval hospitals are govt; Bombay Hospital / Jaslok / Saifee are not', () => {
    [
      'Welkarwadi BMC Hospital',
      'Dr. Babasaheb Ambedkar Memorial Central Railway Hospital',
      'ESIS Hospital WORLI',
      'INHS Asvini Naval Hospital',
    ].forEach(n => expect([n, typeOf(n)]).toEqual([n, 'govt']));
    [
      'Jaslok Hospital and Research Centre',
      'Saifee Hospital',
      'Bombay Hospital and Medical Research Center',
      'Siddivinayak Healthcare Pvt Ltd',
    ].forEach(n => expect([n, typeOf(n)]).not.toEqual([n, 'govt']));
    expect(typeOf('Saifee Hospital')).toBe('private'); // operator:type=private
  });

  it('KEM campus (landuse="hospital Grounds") kept; with its building it is one row (the hospital, not the grounds)', () => {
    expect(
      parsed.hospitals.filter((h: any) => /King Edward/.test(h.name)),
    ).toHaveLength(1);
    const building = {
      type: 'way',
      id: 113570526,
      center: { lat: 19.0016989, lon: 72.8418315 },
      tags: {
        'alt_name:en': 'KEM Hospital',
        building: 'hospital',
        layer: '1',
        name: 'King Edward Memorial Hospital',
        amenity: 'hospital',
      },
    };
    const p = hosp.parseAreaAnswer(
      { elements: [...FIX.elements, building] },
      'MH',
      '2026-11-28',
      1500,
    );
    const kem = p.hospitals.filter((h: any) => /King Edward/.test(h.name));
    expect(kem).toHaveLength(1);
    expect(kem[0].id).toBe('way/113570526');
    expect(kem[0].type).toBe('govt');
  });

  it('"Sion Hospital" mapped as a node and a way ~200 m apart is one row', () => {
    expect(
      parsed.hospitals.filter((h: any) => h.name === 'Sion Hospital'),
    ).toHaveLength(1);
  });

  it('tags win over names: operator:type=private stays private whatever the name says', () => {
    expect(
      hosp.classifyHospital('Municipal Nursing Home', {
        'operator:type': 'private',
      }),
    ).toBe('private');
    expect(
      hosp.classifyHospital('Some Hospital', {
        operator: 'Brihanmumbai Municipal Corporation',
      }),
    ).toBe('govt');
    expect(hosp.classifyHospital('Goverment hospital', {})).toBe('govt'); // as mapped in Mumbai Suburban
    expect(hosp.classifyHospital('Apollo Clinic', {})).toBe('unknown');
  });

  it('area query: hospital grounds included, no 300 cap', () => {
    expect(hosp.HOSP_IN_AREA).toContain(
      'wr["landuse"~"^hospital",i]["name"](area.a)',
    );
    expect(hosp.HOSP_IN_AREA).toContain('out center tags 1500;');
    expect(hosp.HOSP_IN_AREA).not.toContain(' 300;');
  });
});

describe('district name fallback', () => {
  it('"Mumbai" matches OSM\'s "Mumbai City District", never "Mumbai Suburban District"', () => {
    const re = new RegExp(scope.nameRegex('Mumbai'), 'i');
    expect(re.test('Mumbai City District')).toBe(true);
    expect(re.test('Mumbai City')).toBe(true);
    expect(re.test('Mumbai')).toBe(true);
    expect(re.test('Mumbai Suburban District')).toBe(false);
  });

  it('name query (no LGD boundary): admin_level 5, 6 or 8', () => {
    const q = hosp.overpassAreaQuery({
      code: 'MH',
      district: { name: 'Mumbai' },
    });
    expect(q).toContain('["admin_level"~"^(5|6|8)$"]["name"~"^(mumbai|');
    expect(q).toContain(')( city)?( (district|');
  });

  it('otherDistrictOf: the LGD district a name is (Mumbai Suburban for a Mumbai pick), else null', () => {
    expect(
      scope.otherDistrictOf('MH', 'Mumbai', 'Mumbai Suburban District'),
    ).toEqual({ code: 483, name: 'Mumbai Suburban' });
    expect(
      scope.otherDistrictOf('MH', 'Mumbai', 'Mumbai City District'),
    ).toBeNull();
    expect(
      scope.otherDistrictOf(
        'MH',
        'Mumbai Suburban',
        'Mumbai Suburban District',
      ),
    ).toBeNull();
    expect(scope.otherDistrictOf('MH', 'Mumbai Suburban', 'Mumbai')).toEqual({
      code: 482,
      name: 'Mumbai',
    });
  });
});

describe('Nominatim: Mumbai Suburban rows never leak into Mumbai (City)', () => {
  let n = 0;
  const nm = (
    name: string,
    sd: string,
    extra: Record<string, string> = {},
  ) => ({
    osm_type: 'node',
    osm_id: 900000 + (n += 1),
    lat: '19.05',
    lon: '72.85',
    name,
    category: 'amenity',
    type: 'hospital',
    address: {
      suburb: 'x',
      city: 'Mumbai',
      state_district: sd,
      state: 'Maharashtra',
      'ISO3166-2-lvl4': 'IN-MH',
      postcode: '400050',
    },
    extratags: extra,
  });
  const rows = [
    nm('Bhabha Hospital, Bandra', 'Mumbai Suburban District'),
    nm('Lilavati Hospital', 'Mumbai Suburban District'),
    nm('Cama and Albless Hospital', 'Mumbai City District'),
    nm('Masina Hospital', 'Mumbai'),
    nm('Civil Hospital, Thane', 'Thane District'),
  ];
  const namesOf = (l: any[]) => l.map(h => h.name).sort();

  it('picked Mumbai: City rows kept, Suburban and Thane rows dropped', () => {
    const out = hosp.mergeHospitals(
      [rows],
      '2026-11-28',
      60,
      { code: 'MH', name: 'Maharashtra' },
      'Mumbai',
    );
    expect(namesOf(out)).toEqual([
      'Cama and Albless Hospital',
      'Masina Hospital',
    ]);
    expect(out.find((h: any) => /Cama/.test(h.name)).type).toBe('govt');
  });

  it('picked Mumbai Suburban: Suburban rows kept, City rows dropped', () => {
    const out = hosp.mergeHospitals(
      [rows],
      '2026-11-28',
      60,
      { code: 'MH', name: 'Maharashtra' },
      'Mumbai Suburban',
    );
    expect(namesOf(out)).toEqual([
      'Bhabha Hospital, Bandra',
      'Lilavati Hospital',
    ]);
  });

  it('Nominatim also asks for municipal hospitals', () => {
    expect(hosp.HOSP_QUERIES).toContain('municipal hospital');
  });
});

describe('research.js: saved rows re-fetched, cron upgrade retried', () => {
  it('FREE_HOSP_V 3: a v2 free hospital row is outdated', () => {
    expect(research.FREE_HOSP_V).toBe(3);
    expect(
      research.isOutdatedFreeHosp('hosp', 'free', { v: 2, hospitals: [] }),
    ).toBe(true);
    expect(
      research.isOutdatedFreeHosp('hosp', 'free', { v: 3, hospitals: [] }),
    ).toBe(false);
  });

  it('cron: a failed Overpass upgrade is picked again after ~1 h (not a week), 90 s per mirror', async () => {
    expect(research.FREE_CRON_OVERPASS_TIMEOUT_MS).toBe(90000);
    expect(research.FREE_OVERPASS_RETRY_MS).toBe(3600 * 1000);
    const NOW = 1_800_000_000_000;
    const calls: { sql: string; binds: any[] }[] = [];
    const db = {
      first: async (sql: string, ...binds: any[]) => {
        calls.push({ sql, binds });
        return null;
      },
      run: async () => ({}),
      all: async () => [],
    };
    await research.runFreeRefresh(
      db,
      {},
      {
        now: NOW,
        fetchImpl: async () => {
          throw new Error('no fetch');
        },
      },
    );
    const geo = calls.find(c => /FROM civic_geo/.test(c.sql))!;
    expect(geo.sql).toMatch(
      /overpass_status, ''\) <> 'ok' AND g\.overpass_at < \?/,
    );
    expect(geo.binds).toEqual([
      NOW - research.CIVIC_FREE_REFRESH_MS,
      NOW - 3600 * 1000,
    ]);
  });
});
