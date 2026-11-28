// Render smoke tests for the new civic UI: Laws > Offence guide card (BNS rows, simple punishment,
// BNSS complaint steps, sources), Govt > previous vs present comparison (side by side, sources +
// dates, no verdict), Hospitals > Govt / Private / All filter, "where to go for" search and
// "Public info not available". Worker calls are mocked.
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const HOSP = {
  govt: {
    hospitals: [
      {
        name: 'GGH Kurnool',
        slug: 'ggh-kurnool',
        type: 'Government General Hospital',
        district: 'Kurnool',
        address: 'Kurnool',
        phone: '',
        emergency24x7: true,
        specialities: ['Cardiology'],
        schemes: ['Dr NTR Vaidya Seva'],
        website: '',
        note: '',
        timings: '',
        specialFor: ['Cardiac surgery'],
        facilities: ['ICU'],
        doctors: [],
        sources: ['https://ggh.example.gov.in'],
      },
    ],
  },
  private: {
    hospitals: [
      { name: 'City Eye Care', slug: 'city-eye', type: 'Private', district: '', address: '', phone: '0851', emergency24x7: false, specialities: ['Ophthalmology'], schemes: [], website: '', note: '' },
    ],
  },
};
const CMP = {
  asOf: '2026-11',
  previous: { label: '2019-2024', head: 'A', party: 'P1', from: '2019-05', to: '2024-06', source: 'https://example.gov.in/a' },
  present: { label: '2024-', head: 'B', party: 'P2', from: '2024-06', to: '', source: 'https://example.gov.in/b' },
  rows: [
    { area: 'schemes', topic: 'Old-age pension', previous: { text: 'Rs 3,000 a month', source: 'https://example.gov.in/p1', date: '2024-01-01' }, present: { text: 'Rs 4,000 a month', source: 'https://example.gov.in/p2', date: '2024-07-01' } },
    { area: 'started', topic: 'New scheme Z', previous: null, present: { text: 'Started 2025', source: 'https://example.gov.in/z', date: '2025-01-01' } },
  ],
};
// Test fixture only (never shipped as app data)
const PRM = {
  asOf: '2026-11',
  govt: { party: 'Party X alliance', head: 'Leader Y', year: '2024', term: '2024-2029', source: 'https://example.org/manifesto.pdf' },
  promises: [
    { area: 'welfare', text: 'Old-age pension Rs 4,000 a month', status: 'done', fact: 'Pension raised to Rs 4,000 from July 2024 by GO 43', source: 'https://example.gov.in/go43', date: '2024-07-01' },
    { area: 'youth', text: '20 lakh jobs in five years', status: 'in_progress', fact: 'Skill census started', source: 'https://example.gov.in/skill', date: '2025-03' },
    { area: 'women', text: 'Free bus travel for women', status: 'no_update', fact: '', source: '', date: '' },
  ],
  summary: { total: 999, done: 999, inProgress: 0, notDone: 0, noUpdate: 0 },
};
const resp = (kind: string, state: string, variant: string, data: any) => ({
  kind,
  state,
  district: '',
  variant,
  data,
  i18n: { te: null, hi: null },
  sources: [{ url: 'https://example.gov.in/a', title: 'Source A' }],
  aiStars: null,
  status: 'ok',
  updatedAt: 1,
  aiConfigured: true,
});

const { workerFetch } = require('../src/services/workerApi');
workerFetch.mockImplementation(async (path: string) => {
  const u = new URL(`https://x${path}`);
  if (path.startsWith('/v1/civic/data')) {
    const kind = u.searchParams.get('kind') || '';
    const variant = u.searchParams.get('variant') || '';
    const state = u.searchParams.get('state') || '';
    if (kind === 'gcmp') return resp('gcmp', state, '', CMP);
    if (kind === 'gprm') return resp('gprm', state, '', state === 'AP' ? PRM : null);
    if (kind === 'hosp') return resp('hosp', state, variant, (HOSP as any)[variant]);
    return resp('govt', state, '', null);
  }
  if (path.startsWith('/v1/civic/reviews')) return { item: '', count: 0, avg: null, reviews: [], mine: null };
  return { ok: true, status: 'ok', did: 'nothing' };
});

const textOf = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root
    .findAll(n => (n.type as any) === 'Text' || (n.type as any)?.displayName === 'Text')
    .map(n => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children ?? '')))
    .join('\n');

const pressByText = async (r: ReactTestRenderer.ReactTestRenderer, re: RegExp) => {
  const t = r.root.findAll(n => typeof n.props.onPress === 'function' && n.findAll(c => typeof c.props.children !== 'undefined' && re.test(String([].concat(c.props.children).join('')))).length > 0);
  expect(t.length).toBeGreaterThan(0);
  await ReactTestRenderer.act(async () => {
    t[t.length - 1].props.onPress();
  });
};

// HeadlineCard rows open their details (sources, dates, ...) on tap: open every row
const expandAll = async (r: ReactTestRenderer.ReactTestRenderer) => {
  const fns = new Set<() => void>();
  r.root.findAll(n => n.props.testID === 'headline-toggle' && typeof n.type !== 'string' && typeof n.props.onPress === 'function' && !n.props.disabled).forEach(n => fns.add(n.props.onPress));
  await ReactTestRenderer.act(async () => fns.forEach(f => f()));
};

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
const mount = async (el: React.ReactElement) => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(el);
  });
  mounted.push(r);
  return r;
};

const flush = () => ReactTestRenderer.act(async () => new Promise<void>(res => setTimeout(() => res(), 0)));

// First test cold-loads the large BNS offence data; CI runners are slower than local.
jest.setTimeout(30000);

describe('civic screens render', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('outfit.civic.place', JSON.stringify({ state: 'AP', district: '' }));
  });
  afterEach(async () => {
    await ReactTestRenderer.act(async () => {
      mounted.splice(0).forEach(r => r.unmount());
    });
  });

  it('Laws: offence guide card shows BNS rows, simple punishment, BNSS steps and sources', async () => {
    const LawsScreen = require('../src/screens/Civic/LawsScreen').default;
    const r = await mount(<LawsScreen />);
    await pressByText(r, /Offence guide \(BNS 2023\)/);
    let txt = textOf(r);
    expect(txt).toMatch(/replaced the IPC from 1 July 2024/);
    expect(txt).toMatch(/Murder/);
    const search = r.root.findAll(n => n.props.placeholder && /Search an offence/.test(n.props.placeholder))[0];
    await ReactTestRenderer.act(async () => {
      search.props.onChangeText('ipc 420');
    });
    await pressByText(r, /^Cheating \/ fraud$/);
    txt = textOf(r);
    expect(txt).toMatch(/BNS 318\(4\)/);
    expect(txt).toMatch(/Jail: up to 7 years/);
    expect(txt).toMatch(/BNSS s\.173\(1\)/);
    expect(txt).toMatch(/BNSS s\.223/);
    expect(txt).toMatch(/BNSS First Schedule \(NCRB\)/);
  });

  it('Govt: previous vs present comparison side by side with dates and sources, no verdict', async () => {
    const GovtCompareBox = require('../src/screens/Civic/GovtCompareBox').default;
    const r = await mount(<GovtCompareBox lang="English" state="AP" />);
    expect(workerFetch.mock.calls.some((c: any[]) => String(c[0]).includes('kind=gcmp'))).toBe(false); // closed: no request
    await pressByText(r, /Show comparison/);
    await flush();
    await expandAll(r);
    const txt = textOf(r);
    expect(txt).toMatch(/Previous government/);
    expect(txt).toMatch(/Rs 3,000 a month/);
    expect(txt).toMatch(/Rs 4,000 a month/);
    expect(txt).toMatch(/2024-07-01/);
    expect(txt).toMatch(/example\.gov\.in/);
    expect(txt).toMatch(/No matching item with a public source/);
    expect(txt).not.toMatch(/better|best|winner/i);
    await pressByText(r, /Centre \(India\)/);
    await flush();
    expect(workerFetch.mock.calls.some((c: any[]) => String(c[0]).includes('kind=gcmp') && String(c[0]).includes('state=IN'))).toBe(true);
  });

  it('Govt: promises tracker with real counts from the list, status filter, sources + dates; no data = no numbers', async () => {
    const GovtPromisesBox = require('../src/screens/Civic/GovtPromisesBox').default;
    const r = await mount(<GovtPromisesBox lang="English" state="AP" />);
    expect(workerFetch.mock.calls.some((c: any[]) => String(c[0]).includes('kind=gprm'))).toBe(false); // closed: no request
    await pressByText(r, /Show promises/);
    await flush();
    await expandAll(r);
    let txt = textOf(r);
    expect(txt).toMatch(/Party X alliance/);
    expect(txt).toMatch(/Leader Y/);
    expect(txt).toMatch(/Manifesto 2024 \(2024-2029\): example\.org/);
    // counts computed from the promises on screen, never the stored / model summary
    expect(txt).toMatch(/Total 3 · Done 1 · In progress 1 · Not done 0 · No update 1/);
    expect(txt).not.toMatch(/999/);
    expect(txt).toMatch(/Pension raised to Rs 4,000/);
    expect(txt).toMatch(/example\.gov\.in · 📅 2024-07-01/);
    expect(txt).toMatch(/Free bus travel for women/);
    await pressByText(r, /^Done 1$/);
    txt = textOf(r);
    expect(txt).toMatch(/Old-age pension Rs 4,000 a month/);
    expect(txt).not.toMatch(/20 lakh jobs/);
    await pressByText(r, /Centre \(India\)/);
    await flush();
    expect(workerFetch.mock.calls.some((c: any[]) => String(c[0]).includes('kind=gprm') && String(c[0]).includes('state=IN'))).toBe(true);
    txt = textOf(r);
    expect(txt).not.toMatch(/Total \d/);
    expect(txt).toMatch(/Collecting info for this place|No researched promises yet/); // researching / no data yet, never numbers
  });

  it('Hospitals: Govt / Private / All, where-to-go search, public info not available', async () => {
    const HospitalsScreen = require('../src/screens/Civic/HospitalsScreen').default;
    const r = await mount(<HospitalsScreen />);
    await flush();
    await expandAll(r);
    let txt = textOf(r);
    expect(txt).toMatch(/GGH Kurnool/);
    expect(txt).not.toMatch(/City Eye Care/);
    expect(txt).toMatch(/Timings: Public info not available/);
    await pressByText(r, /^All$/);
    await flush();
    txt = textOf(r);
    expect(txt).toMatch(/GGH Kurnool/);
    expect(txt).toMatch(/City Eye Care/);
    const input = r.root.findAll(n => n.props.placeholder && /Disease or speciality/.test(n.props.placeholder))[0];
    await ReactTestRenderer.act(async () => {
      input.props.onChangeText('eye');
    });
    txt = textOf(r);
    expect(txt).toMatch(/City Eye Care/);
    expect(txt).toMatch(/Matches: Ophthalmology/);
    // the match comes first; the rest of the place's list stays below it (never hidden by a search)
    expect(txt).toMatch(/GGH Kurnool/);
    expect(txt.indexOf('City Eye Care')).toBeLessThan(txt.indexOf('GGH Kurnool'));
  });

  it('Telugu app language: offence guide shows Telugu AND English, labels too', async () => {
    const { setAppLanguage } = require('../src/i18n/appLanguage');
    await ReactTestRenderer.act(async () => setAppLanguage('Telugu'));
    const LawsScreen = require('../src/screens/Civic/LawsScreen').default;
    const r = await mount(<LawsScreen />);
    await pressByText(r, /నేరాల గైడ్/);
    const search = r.root.findAll(n => n.props.placeholder && /నేరం వెతకండి/.test(n.props.placeholder))[0];
    await ReactTestRenderer.act(async () => {
      search.props.onChangeText('దొంగతనం');
    });
    await pressByText(r, /^దొంగతనం$/);
    const txt = textOf(r);
    expect(txt).toMatch(/^దొంగతనం$/m);
    expect(txt).toMatch(/^Theft$/m);
    expect(txt).toMatch(/జైలు: /);
    expect(txt).toMatch(/Jail: /);
    expect(txt).toMatch(/జీరో FIR/);
    expect(txt).toMatch(/Zero FIR/);
    await ReactTestRenderer.act(async () => setAppLanguage('English'));
  });
});
