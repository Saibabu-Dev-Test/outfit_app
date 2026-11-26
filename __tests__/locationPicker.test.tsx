// State -> District -> Mandal picker (LocationPicker) + scope fallback (useScopeLevel) on Hospitals
// and Govt: values are only chosen from the LGD lists (filter box never becomes a value), the level
// label follows the state, saved typed districts are matched or dropped, a mandal without data shows
// the district with "No data for <mandal>, showing <district> district", and the state when the
// district is empty too. Worker calls mocked.
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlacePicker, scopeNote, validPlace } from '../src/screens/Civic/LocationPicker';
import { answerFor, requestFor, shownLevel } from '../src/screens/Civic/useScopeLevel';
import { findDistrict, findSubDistrict } from '../src/data/locations';

jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return { SafeAreaView: RN.View, SafeAreaProvider: RN.View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'U' } }) }));
jest.mock('../src/services/adminSystem', () => ({ isOwnerUser: () => false }));
jest.mock('../src/services/workerApi', () => {
  class WorkerError extends Error {
    status = 0;
  }
  return { workerFetch: jest.fn(), WorkerError };
});

const RR = findDistrict('TG', 'Ranga Reddy')!;
const SHAM = findSubDistrict('TG', RR.code, 'Shamshabad')!;

const flush = () => ReactTestRenderer.act(async () => new Promise<void>(res => setTimeout(() => res(), 0)));
const textOf = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root
    .findAll(n => (n.type as any) === 'Text')
    .map(n => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children ?? '')))
    .join('\n');
const byId = (r: ReactTestRenderer.ReactTestRenderer, id: string) => r.root.findAll(n => n.props.testID === id && typeof n.type !== 'string');
const press = async (r: ReactTestRenderer.ReactTestRenderer, id: string) => {
  const n = byId(r, id).find(x => typeof x.props.onPress === 'function');
  expect(n).toBeTruthy();
  await ReactTestRenderer.act(async () => n!.props.onPress());
};

jest.setTimeout(30000);

describe('validPlace (saved place made valid against LGD)', () => {
  it('a typed district from older versions becomes the LGD district, an unknown one is dropped', () => {
    expect(validPlace({ state: 'AP', district: 'kurnool' })).toMatchObject({ state: 'AP', district: 'Kurnool', mandal: '' });
    expect(validPlace({ state: 'AP', district: 'kurnool' }).districtCode).toBeGreaterThan(0);
    expect(validPlace({ state: 'AP', district: 'not a district' })).toEqual({ state: 'AP', district: '', mandal: '' });
    expect(validPlace({ state: 'XX', district: 'kurnool' })).toEqual({ state: '', district: '', mandal: '' });
    expect(validPlace({ state: 'TG', district: 'Ranga Reddy', districtCode: RR.code, mandal: 'Shamshabad', mandalCode: SHAM.code })).toMatchObject({ mandal: 'Shamshabad', mandalCode: SHAM.code });
    // a mandal that is not in that district is dropped
    expect(validPlace({ state: 'TG', district: 'Ranga Reddy', mandal: 'Nowhere' })).toMatchObject({ district: 'Ranga Reddy', mandal: '' });
  });
});

describe('scope note + level', () => {
  const place = { state: 'TG', district: 'Ranga Reddy', districtCode: RR.code, mandal: 'Shamshabad', mandalCode: SHAM.code };
  it('says what is shown instead', () => {
    expect(scopeNote('English', place, 'mandal', 'Telangana')).toBe('');
    expect(scopeNote('English', place, 'district', 'Telangana')).toBe('No data for Shamshabad, showing Ranga Reddy district');
    expect(scopeNote('English', place, 'state', 'Telangana')).toBe('No data for Shamshabad or Ranga Reddy district, showing Telangana');
    expect(scopeNote('English', { ...place, mandal: '', mandalCode: undefined }, 'state', 'Telangana')).toBe('No data for Ranga Reddy district, showing Telangana');
  });
  it('Worker data.scope wins; an older Worker asked for a mandal answered for the district', () => {
    const req = requestFor(place, 'mandal');
    expect(req).toEqual({ level: 'mandal', district: 'Ranga Reddy', mandal: 'Shamshabad' });
    expect(shownLevel(req, 'district')).toBe('district');
    expect(shownLevel(req, undefined)).toBe('district');
    expect(shownLevel(requestFor(place, 'district'), undefined)).toBe('district');
    expect(answerFor({ state: 'TG', district: 'ranga-reddy', mandal: 'shamshabad' }, 'TG', req)).toBe(true);
    expect(answerFor({ state: 'TG', district: 'ranga-reddy' }, 'TG', req)).toBe(false);
  });
});

describe('PlacePicker', () => {
  const mountPicker = async (place: any) => {
    const onChange = jest.fn();
    let r!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      r = ReactTestRenderer.create(<PlacePicker lang="English" place={place} onChange={onChange} />);
    });
    return { r, onChange };
  };

  it('no free text: typing only filters the list, a value is set only by tapping an option', async () => {
    const { r, onChange } = await mountPicker({ state: 'TG', district: '', mandal: '' });
    await press(r, 'pick-district-open');
    const filter = byId(r, 'pick-district-filter').find(n => typeof n.props.onChangeText === 'function')!;
    await ReactTestRenderer.act(async () => filter.props.onChangeText('ranga red'));
    expect(onChange).not.toHaveBeenCalled();
    const opts = r.root.findAll(n => typeof n.props.testID === 'string' && n.props.testID.startsWith('pick-district-opt-') && typeof n.props.onPress === 'function');
    expect(new Set(opts.map(o => o.props.testID))).toEqual(new Set([`pick-district-opt-${RR.code}`]));
    await ReactTestRenderer.act(async () => opts[0].props.onPress());
    expect(onChange).toHaveBeenCalledWith({ state: 'TG', district: 'Ranga Reddy', districtCode: RR.code, mandal: '' });
    // a picker has no free-text value input: the only TextInputs are the list filters
    const inputs = r.root.findAll(n => typeof n.props.onChangeText === 'function' && typeof n.type !== 'string');
    inputs.forEach(i => expect(String(i.props.testID)).toMatch(/-filter$/));
    act0(r);
  });

  it('third level is called Mandal in Telangana and Taluk in Karnataka; lists every mandal of the district', async () => {
    const { r, onChange } = await mountPicker({ state: 'TG', district: 'Ranga Reddy', districtCode: RR.code, mandal: '' });
    expect(textOf(r)).toMatch(/Choose Mandal/);
    await press(r, 'pick-mandal-open');
    await press(r, `pick-mandal-opt-${SHAM.code}`);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mandal: 'Shamshabad', mandalCode: SHAM.code }));
    act0(r);
    const blr = findDistrict('KA', 'Mysuru') || findDistrict('KA', 'Mysore');
    const k = await mountPicker({ state: 'KA', district: blr!.name, districtCode: blr!.code, mandal: '' });
    expect(textOf(k.r)).toMatch(/Choose Taluk/);
    act0(k.r);
  });

  it('district with no sub-districts in LGD (Mumbai) says so; mandal stays optional', async () => {
    const mum = findDistrict('MH', 'Mumbai')!;
    const { r } = await mountPicker({ state: 'MH', district: 'Mumbai', districtCode: mum.code, mandal: '' });
    expect(textOf(r)).toMatch(/No Taluka list for this district/);
    act0(r);
  });
});

function act0(r: ReactTestRenderer.ReactTestRenderer) {
  ReactTestRenderer.act(() => r.unmount());
}

// Hospital rows (OpenStreetMap shape)
const osm = (name: string, id: number) => ({
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  type: 'Government',
  district: '',
  address: 'Telangana',
  phone: '',
  emergency24x7: false,
  specialities: [],
  schemes: [],
  website: '',
  note: '',
  ownership: 'govt',
  osmUrl: `https://www.openstreetmap.org/node/${id}`,
  src: { name: 'OpenStreetMap (Nominatim)', url: `https://www.openstreetmap.org/node/${id}`, date: '2026-11-25' },
  sources: [],
});

describe('Hospitals + Govt scope fallback', () => {
  const { workerFetch } = require('../src/services/workerApi');
  const calls: string[] = [];
  let answer: (u: URL) => any;
  beforeEach(() => {
    calls.length = 0;
    workerFetch.mockReset();
    workerFetch.mockImplementation(async (path: string) => {
      const u = new URL(`https://x${path}`);
      if (path.startsWith('/v1/civic/data')) {
        calls.push(`${u.searchParams.get('kind')}|${u.searchParams.get('district') || ''}|${u.searchParams.get('mandal') || ''}`);
        const base = {
          kind: u.searchParams.get('kind'),
          state: u.searchParams.get('state'),
          district: u.searchParams.get('district') || '',
          mandal: u.searchParams.get('mandal') || '',
          variant: u.searchParams.get('variant') || '',
          i18n: { te: null, hi: null },
          sources: [],
          aiStars: null,
          status: 'ok',
          updatedAt: 1764028800000,
          aiConfigured: false,
          researchConfigured: true,
          freeSources: true,
          answeredBy: 'free',
        };
        return { ...base, ...answer(u) };
      }
      if (path.startsWith('/v1/civic/reviews')) return { item: '', count: 0, avg: null, reviews: [], mine: null };
      return { ok: true, status: 'ok', did: 'nothing' };
    });
  });
  const mount = async (name: string) => {
    await AsyncStorage.setItem('outfit.civic.place', JSON.stringify({ state: 'TG', district: 'Ranga Reddy', districtCode: RR.code, mandal: 'Shamshabad', mandalCode: SHAM.code }));
    const Screen = require(`../src/screens/Civic/${name}`).default;
    let r!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      r = ReactTestRenderer.create(<Screen />);
    });
    for (let i = 0; i < 6; i++) await flush();
    return r;
  };

  it('Hospitals: Worker answered the mandal with the district list (scope) = visible note, no placeholder', async () => {
    answer = u => ({ data: { origin: 'free', scope: u.searchParams.get('mandal') ? 'district' : 'district', hospitals: [osm('Area Hospital, Shadnagar', 1)] } });
    const r = await mount('HospitalsScreen');
    expect(calls).toContain('hosp|ranga-reddy|shamshabad');
    expect(textOf(r)).toMatch(/No data for Shamshabad, showing Ranga Reddy district/);
    expect(textOf(r)).toMatch(/Answered by: Free public sources/);
    expect(textOf(r)).toMatch(/Area Hospital, Shadnagar/);
    act0(r);
  });

  it('Hospitals: mandal list empty = the app asks for the district, then the state when that is empty too', async () => {
    answer = u => (u.searchParams.get('district') ? { data: { origin: 'free', hospitals: [] } } : { data: { origin: 'free', hospitals: [osm('Gandhi Hospital', 2)] } });
    const r = await mount('HospitalsScreen');
    expect(calls).toEqual(expect.arrayContaining(['hosp|ranga-reddy|shamshabad', 'hosp|ranga-reddy|', 'hosp||']));
    expect(textOf(r)).toMatch(/No data for Shamshabad or Ranga Reddy district, showing Telangana/);
    expect(textOf(r)).toMatch(/Gandhi Hospital/);
    expect(textOf(r)).not.toMatch(/Research paused/);
    act0(r);
  });

  it('Govt: mandal facts shown when the Worker has them; none = district note', async () => {
    answer = () => ({
      data: {
        origin: 'free',
        scope: 'mandal',
        overview: 'Ranga Reddy district.',
        schemes: [],
        departments: [],
        services: [],
        helplines: [],
        mandal: { name: 'Shamshabad', overview: 'Shamshabad is a mandal in Ranga Reddy district.', mlas: [], src: { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Shamshabad', date: '2026-11-25' } },
      },
    });
    const r = await mount('GovtScreen');
    expect(calls).toContain('govt|ranga-reddy|shamshabad');
    expect(byId(r, 'govt-mandal').length).toBeGreaterThan(0);
    expect(textOf(r)).toMatch(/Shamshabad is a mandal/);
    expect(textOf(r)).not.toMatch(/No data for Shamshabad/);
    act0(r);
    answer = () => ({ data: { origin: 'free', scope: 'district', overview: 'Ranga Reddy district.', schemes: [], departments: [], services: [], helplines: [], district: { headquarters: 'Hyderabad', collector: '', sp: '', policeCommissioner: '', mps: [], mlas: [] }, mandal: null } });
    const r2 = await mount('GovtScreen');
    expect(textOf(r2)).toMatch(/No data for Shamshabad, showing Ranga Reddy district/);
    act0(r2);
  });
});
