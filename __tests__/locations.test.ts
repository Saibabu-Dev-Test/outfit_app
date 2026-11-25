// Bundled LGD hierarchy (src/data/locations): 28 states + 8 UTs, every state has districts and every
// district has sub-districts (except the two fully urban LGD districts with none), app state codes match.
import { LGD, districtsOf, filterOptions, findDistrict, placeLabel, subDistrictsOf, subLevelOf } from '../src/data/locations';
import { INDIA_STATES } from '../src/constants/indiaStates';

// LGD itself lists no sub-district for these (fully urban districts)
const NO_SUBDISTRICTS = new Set(['MH:Mumbai', 'WB:Kolkata']);

describe('LGD locations', () => {
  it('has all 28 states and 8 union territories', () => {
    expect(LGD.states.filter(s => s.t === 'state')).toHaveLength(28);
    expect(LGD.states.filter(s => s.t === 'ut')).toHaveLength(8);
    expect(LGD.counts).toMatchObject({ states: 28, uts: 8 });
  });

  it('uses the app state codes (same set as INDIA_STATES)', () => {
    expect(LGD.states.map(s => s.c).sort()).toEqual(INDIA_STATES.map(s => s.code).sort());
    LGD.states.forEach(s => expect(INDIA_STATES.find(x => x.code === s.c)?.type).toBe(s.t));
  });

  it('every state has districts and every district has sub-districts', () => {
    LGD.states.forEach(s => {
      expect(s.d.length).toBeGreaterThan(0);
      s.d.forEach(d => {
        if (NO_SUBDISTRICTS.has(`${s.c}:${d.n}`)) {
          expect(d.s).toHaveLength(0);
        } else {
          expect(`${s.c}:${d.n}:${d.s.length > 0}`).toBe(`${s.c}:${d.n}:true`);
        }
      });
    });
  });

  it('counts in the file match the data, codes are unique, names are not empty', () => {
    const ds = LGD.states.flatMap(s => s.d);
    const ss = ds.flatMap(d => d.s);
    expect(LGD.counts.districts).toBe(ds.length);
    expect(LGD.counts.subdistricts).toBe(ss.length);
    expect(ds.length).toBeGreaterThan(700);
    expect(ss.length).toBeGreaterThan(6000);
    expect(new Set(ds.map(d => d.c)).size).toBe(ds.length);
    expect(new Set(ss.map(x => x[0])).size).toBe(ss.length);
    ss.forEach(x => expect(x[1].trim().length).toBeGreaterThan(0));
  });

  it('level name follows the state (Mandal in AP / TG, Taluk in KA, Tehsil in UP, Block in BR)', () => {
    expect(subLevelOf('AP')).toBe('mandal');
    expect(subLevelOf('TG')).toBe('mandal');
    expect(subLevelOf('KA')).toBe('taluk');
    expect(subLevelOf('UP')).toBe('tehsil');
    expect(subLevelOf('BR')).toBe('block');
  });

  it('real names: Hyderabad district, Telugu names where LGD has them, filter inside the list', () => {
    const hyd = findDistrict('TG', 'hyderabad');
    expect(hyd?.name).toBe('Hyderabad');
    const rr = findDistrict('TG', 'Ranga Reddy');
    expect(rr).toBeTruthy();
    const mandals = subDistrictsOf('TG', rr!.code);
    expect(mandals.map(m => m.name)).toContain('Shamshabad');
    const adb = findDistrict('TG', 'Adilabad')!;
    expect(placeLabel(adb, 'te')).toBe('ఆదిలాబాద్');
    expect(filterOptions(mandals, 'shams').map(m => m.name)).toEqual(['Shamshabad']);
    expect(districtsOf('AP').length).toBeGreaterThanOrEqual(26);
  });
});
