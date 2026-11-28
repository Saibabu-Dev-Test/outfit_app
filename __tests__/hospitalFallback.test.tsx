// "Where to go for…" fallback: when no hospital in the list states the searched speciality ("ear" ->
// ENT), the general / multi-speciality government hospitals in the list are shown labelled "May treat
// this — call to confirm", never as a claim; PHCs / CHCs and private rows are not used. Worker mocked.
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generalGovtHospitals } from '../src/services/hospitalSearch';
import type { Hospital } from '../src/services/civicApi';

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

const H = (name: string, o: Partial<Hospital> = {}): Hospital => ({
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  type: '',
  district: '',
  address: '',
  phone: '',
  emergency24x7: false,
  specialities: [],
  schemes: [],
  website: '',
  note: '',
  ...o,
});

describe('generalGovtHospitals', () => {
  const rows = [
    { v: 'govt', h: H('Primary Health Centre, Chandur', { ownership: 'govt' }) },
    { v: 'govt', h: H('Area Hospital, Tenali', { ownership: 'govt' }) },
    { v: 'govt', h: H('Community Health Centre, Ponnur', { ownership: 'govt' }) },
    { v: 'govt', h: H('Government General Hospital, Guntur', { ownership: 'govt' }) },
    { v: 'govt', h: H('AIIMS Mangalagiri', { ownership: 'govt' }) },
    { v: 'govt', h: H('Guntur Medical College', { ownership: 'govt' }) },
    { v: 'govt', h: H('District Hospital, Narasaraopet', { ownership: 'govt' }) },
    { v: 'private', h: H('Sai Multi Speciality Hospital', { ownership: 'unknown' }) },
  ];
  it('picks general / multi-speciality govt hospitals, most comprehensive first, no PHC / CHC / private', () => {
    expect(generalGovtHospitals(rows).map(r => r.h.name)).toEqual([
      'AIIMS Mangalagiri',
      'Guntur Medical College',
      'Government General Hospital, Guntur',
      'District Hospital, Narasaraopet',
      'Area Hospital, Tenali',
    ]);
  });
  it('is empty when the list has none (no invented hospitals)', () => {
    expect(generalGovtHospitals(rows.filter(r => r.v === 'private'))).toEqual([]);
    expect(generalGovtHospitals([])).toEqual([]);
  });
  it('caps the count', () => {
    expect(generalGovtHospitals(rows, 2).length).toBe(2);
  });
});

const free = (name: string, id: number, ownership: 'govt' | 'unknown') => ({
  ...H(name, { ownership }),
  type: ownership === 'govt' ? 'Government' : '',
  osmUrl: `https://www.openstreetmap.org/node/${id}`,
  src: { name: 'OpenStreetMap (Nominatim)', url: `https://www.openstreetmap.org/node/${id}`, date: '2026-11-25' },
  sources: [`https://www.openstreetmap.org/node/${id}`],
});
const DATA: Record<string, any> = {
  govt: { origin: 'free', asOf: '2026-11-25', hospitals: [free('Government General Hospital, Guntur', 1, 'govt'), free('Primary Health Centre, Chandur', 2, 'govt'), free('Area Hospital, Tenali', 3, 'govt')] },
  private: { origin: 'free', asOf: '2026-11-25', hospitals: [free('Sai Hospital', 4, 'unknown')] },
};
const { workerFetch } = require('../src/services/workerApi');
workerFetch.mockImplementation(async (path: string) => {
  const u = new URL(`https://x${path}`);
  if (path.startsWith('/v1/civic/data')) {
    const variant = u.searchParams.get('variant') || '';
    return { kind: 'hosp', state: 'AP', district: '', variant, data: DATA[variant], i18n: { te: null, hi: null }, sources: [], aiStars: null, status: 'ok', updatedAt: 1, aiConfigured: false, origin: 'free' };
  }
  if (path.startsWith('/v1/civic/reviews')) return { item: '', count: 0, avg: null, reviews: [], mine: null };
  return { ok: true, status: 'ok', did: 'nothing' };
});

const flush = () => ReactTestRenderer.act(async () => new Promise<void>(res => setTimeout(() => res(), 0)));
const textOf = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root
    .findAll(n => (n.type as any) === 'Text')
    .map(n => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children ?? '')))
    .join('\n');

jest.setTimeout(30000);

describe('Hospitals: "ear" with the Government filter', () => {
  let r: ReactTestRenderer.ReactTestRenderer;
  beforeEach(async () => {
    await AsyncStorage.setItem('outfit.civic.place', JSON.stringify({ state: 'AP', district: '' }));
    const HospitalsScreen = require('../src/screens/Civic/HospitalsScreen').default;
    await ReactTestRenderer.act(async () => {
      r = ReactTestRenderer.create(<HospitalsScreen />);
    });
    await flush();
  });
  afterEach(async () => {
    await ReactTestRenderer.act(async () => r.unmount());
  });

  const search = async (q: string) => {
    const input = r.root.findAll(n => n.props.placeholder && /Disease or speciality/.test(n.props.placeholder))[0];
    await ReactTestRenderer.act(async () => input.props.onChangeText(q));
  };

  it('shows general govt hospitals as "may treat this — call to confirm", with the department, not the dead end', async () => {
    await search('ear');
    const txt = textOf(r);
    expect(txt).toMatch(/General \/ multi-speciality government hospitals that may treat this/);
    expect(txt).toMatch(/Departments to see: ENT/);
    expect(txt).toMatch(/Government General Hospital, Guntur/);
    expect(txt).toMatch(/Area Hospital, Tenali/);
    expect(txt).not.toMatch(/Try another word/);
    // the PHC is not a "may treat" row, but stays in the place's list after them
    expect(txt).toMatch(/Primary Health Centre, Chandur/);
    expect(txt.indexOf('Area Hospital, Tenali')).toBeLessThan(txt.indexOf('Primary Health Centre, Chandur'));
    expect(r.root.findAll(n => n.props.testID === 'hosp-may-treat' && typeof n.type !== 'string').length).toBe(2);
    expect(txt).toMatch(/May treat this — call to confirm \(no public source states it\)/);
    expect(txt).not.toMatch(/Matches:/);
  });

  it('keeps the plain "no match" note when nothing general is in the list (Private only)', async () => {
    const pr = r.root.findAll(n => typeof n.props.onPress === 'function' && n.findAll(c => /^Private$/.test(String([].concat(c.props.children ?? '').join('')))).length > 0);
    await ReactTestRenderer.act(async () => pr[pr.length - 1].props.onPress());
    await flush();
    await search('ear');
    const txt = textOf(r);
    expect(txt).toMatch(/Try another word/);
    expect(txt).not.toMatch(/may treat this/i);
    // the Private list of the place is still shown under the note
    expect(txt).toMatch(/Sai Hospital/);
  });

  it('an unknown word with no disease match keeps the plain "no match" note', async () => {
    await search('zzqqxx');
    expect(textOf(r)).toMatch(/Try another word/);
    expect(textOf(r)).not.toMatch(/may treat this/i);
  });
});
