// Hospitals tab child structure stays stable (Fabric "addViewAt: failed to insert view into parent at
// index N" crash on Android, seen with the Private filter for Andhra Pradesh): unique keys even when
// two rows share a slug, removeClippedSubviews off, always-mounted containers, empty results as stable
// elements, toggling Government / Private / All with empty and non-empty lists. Worker calls mocked.
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uniqueRowKeys } from '../src/services/hospitalSearch';

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

const osm = (name: string, slug: string, id: number, ownership: 'govt' | 'private' | 'unknown') => ({
  name,
  slug,
  type: ownership === 'govt' ? 'Government' : ownership === 'private' ? 'Private' : '',
  district: '',
  address: 'Guntur, Andhra Pradesh',
  phone: '',
  emergency24x7: false,
  specialities: [],
  schemes: [],
  website: '',
  note: '',
  ownership,
  lat: 16.3,
  lon: 80.4,
  osmUrl: `https://www.openstreetmap.org/node/${id}`,
  src: { name: 'OpenStreetMap (Nominatim)', url: `https://www.openstreetmap.org/node/${id}`, date: '2026-11-25' },
  sources: [`https://www.openstreetmap.org/node/${id}`],
});

// AP: non-empty lists, two private rows with one slug (old cached rows can carry duplicates)
const DATA: Record<string, Record<string, any>> = {
  AP: {
    govt: { origin: 'free', asOf: '2026-11-25', hospitals: [osm('Government General Hospital, Guntur', 'ggh-guntur', 1, 'govt'), osm('Area Hospital, Tenali', 'area-tenali', 2, 'govt')] },
    private: {
      origin: 'free',
      asOf: '2026-11-25',
      hospitals: [
        ...Array.from({ length: 18 }, (_, i) => osm(`Private Clinic ${i}`, `private-clinic-${i}`, 100 + i, 'unknown')),
        osm('Sai Hospital', 'sai-hospital', 200, 'private'),
        osm('Sai Hospital', 'sai-hospital', 201, 'private'),
      ],
    },
  },
  // TS: both lists empty
  TS: { govt: { origin: 'free', asOf: '2026-11-25', hospitals: [] }, private: { origin: 'free', asOf: '2026-11-25', hospitals: [] } },
};

const { workerFetch } = require('../src/services/workerApi');
workerFetch.mockImplementation(async (path: string) => {
  const u = new URL(`https://x${path}`);
  if (path.startsWith('/v1/civic/data')) {
    const state = u.searchParams.get('state') || '';
    const variant = u.searchParams.get('variant') || '';
    const data = DATA[state]?.[variant] ?? null;
    return { kind: 'hosp', state, district: '', variant, data, i18n: { te: null, hi: null }, sources: [], aiStars: null, status: 'ok', updatedAt: 1, aiConfigured: false, origin: 'free' };
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
const pressByText = async (r: ReactTestRenderer.ReactTestRenderer, re: RegExp) => {
  const t = r.root.findAll(n => typeof n.props.onPress === 'function' && n.findAll(c => typeof c.props.children !== 'undefined' && re.test(String([].concat(c.props.children).join('')))).length > 0);
  expect(t.length).toBeGreaterThan(0);
  await ReactTestRenderer.act(async () => {
    t[t.length - 1].props.onPress();
  });
  await flush();
};
const byTestId = (r: ReactTestRenderer.ReactTestRenderer, id: string) => r.root.findAll(n => n.props.testID === id && typeof n.type !== 'string');
// The ScrollView content's direct children (host views): the same count whatever the state
const scrollChildCount = (r: ReactTestRenderer.ReactTestRenderer) => {
  const json: any = r.toJSON();
  const find = (n: any): any => (!n || typeof n !== 'object' ? null : n.props?.testID === 'hosp-scroll' ? n : (n.children || []).map(find).find(Boolean) || null);
  const sv = find(Array.isArray(json) ? { children: json } : json);
  expect(sv).toBeTruthy();
  const content = (sv.children || []).find((c: any) => c && typeof c === 'object' && c.type === 'View') || sv;
  return (content.children || []).length;
};

jest.setTimeout(30000);

describe('uniqueRowKeys', () => {
  it('keeps keys unique and stable when rows share a slug', () => {
    const rows = [
      { v: 'private', h: { slug: 'sai', name: 'Sai' } },
      { v: 'private', h: { slug: 'sai', name: 'Sai' } },
      { v: 'govt', h: { slug: 'sai', name: 'Sai' } },
      { v: 'private', h: { slug: '', name: '', osmUrl: 'https://www.openstreetmap.org/node/9' } },
      { v: 'private', h: { slug: '', name: '' } },
    ];
    const keys = uniqueRowKeys(rows);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(['private:sai', 'private:sai#1', 'govt:sai', 'private:https://www.openstreetmap.org/node/9', 'private:row4']);
    expect(uniqueRowKeys(rows)).toEqual(keys);
  });
});

describe('Hospitals tab child structure', () => {
  let errors: jest.SpyInstance;
  const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
  const mount = async (state: string) => {
    await AsyncStorage.setItem('outfit.civic.place', JSON.stringify({ state, district: '' }));
    const HospitalsScreen = require('../src/screens/Civic/HospitalsScreen').default;
    let r!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      r = ReactTestRenderer.create(<HospitalsScreen />);
    });
    mounted.push(r);
    await flush();
    await flush();
    return r;
  };
  beforeEach(() => {
    errors = jest.spyOn(console, 'error');
  });
  afterEach(async () => {
    await ReactTestRenderer.act(async () => {
      mounted.splice(0).forEach(r => r.unmount());
    });
    const keyErrors = errors.mock.calls.filter(c => /same key|unique "key"/i.test(String(c[0])));
    errors.mockRestore();
    expect(keyErrors).toEqual([]);
  });

  it('toggles Government / Private / All with non-empty lists (duplicate slugs, 20+ rows) without unstable children', async () => {
    const r = await mount('AP');
    const sv = r.root.findAll(n => n.props.testID === 'hosp-scroll')[0];
    expect(sv.props.removeClippedSubviews).toBe(false);
    const base = scrollChildCount(r);
    expect(textOf(r)).toMatch(/Government General Hospital, Guntur/);
    await pressByText(r, /^Private$/);
    let txt = textOf(r);
    expect(txt).toMatch(/Private Clinic 17/);
    expect(txt.match(/Sai Hospital/g)?.length).toBe(2);
    expect(scrollChildCount(r)).toBe(base);
    await pressByText(r, /^All$/);
    txt = textOf(r);
    expect(txt).toMatch(/Government General Hospital, Guntur/);
    expect(txt).toMatch(/Sai Hospital/);
    expect(scrollChildCount(r)).toBe(base);
    // search: non-empty, then empty, then cleared
    const input = r.root.findAll(n => n.props.placeholder && /Disease or speciality/.test(n.props.placeholder))[0];
    await ReactTestRenderer.act(async () => input.props.onChangeText('Sai'));
    expect(textOf(r)).toMatch(/Sai Hospital/);
    expect(scrollChildCount(r)).toBe(base);
    await ReactTestRenderer.act(async () => input.props.onChangeText('zzqqxx'));
    // no match: the note, and the place's list stays (a search never empties it)
    expect(textOf(r)).toMatch(/Try another word/);
    expect(textOf(r)).toMatch(/Sai Hospital/);
    expect(scrollChildCount(r)).toBe(base);
    await ReactTestRenderer.act(async () => input.props.onChangeText(''));
    await pressByText(r, /^Government$/);
    expect(textOf(r)).not.toMatch(/Sai Hospital/);
    expect(scrollChildCount(r)).toBe(base);
    // every hosp-list container is always mounted
    expect(byTestId(r, 'hosp-list').length).toBe(1);
    expect(byTestId(r, 'hosp-status').length).toBe(1);
    expect(byTestId(r, 'hosp-best').length).toBe(1);
  });

  it('empty results keep the same structure across filters', async () => {
    const r = await mount('TS');
    const base = scrollChildCount(r);
    for (const f of [/^Private$/, /^All$/, /^Government$/, /^Private$/]) {
      await pressByText(r, f);
      expect(scrollChildCount(r)).toBe(base);
      expect(byTestId(r, 'hosp-list').length).toBe(1);
    }
    expect(textOf(r)).not.toMatch(/Sai Hospital/);
  });
});
