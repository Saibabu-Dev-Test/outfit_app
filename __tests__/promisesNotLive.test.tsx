// Govt > Promises when the Worker cannot serve it: a Worker deployed before kind 'gprm' answers
// 400 "bad kind / state / district / variant" -> a friendly "not live on the server yet" line, any
// other failure -> "no data yet". Never the raw error text, never counts / numbers.
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return { SafeAreaView: RN.View, SafeAreaProvider: RN.View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'U' } }) }));
jest.mock('../src/services/adminSystem', () => ({ isOwnerUser: () => false }));
jest.mock('../src/services/workerApi', () => {
  class WorkerError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return { workerFetch: jest.fn(), WorkerError };
});

const { workerFetch, WorkerError } = require('../src/services/workerApi');
const { promisesNotice } = require('../src/screens/Civic/GovtPromisesBox');

const textOf = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root
    .findAll(n => (n.type as any) === 'Text' || (n.type as any)?.displayName === 'Text')
    .map(n => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children ?? '')))
    .join('\n');

const flush = () => ReactTestRenderer.act(async () => new Promise<void>(res => setTimeout(() => res(), 0)));

// HeadlineCard rows open their details (sources, dates, ...) on tap: open every row
const expandAll = async (r: ReactTestRenderer.ReactTestRenderer) => {
  const fns = new Set<() => void>();
  r.root.findAll(n => n.props.testID === 'headline-toggle' && typeof n.type !== 'string' && typeof n.props.onPress === 'function' && !n.props.disabled).forEach(n => fns.add(n.props.onPress));
  await ReactTestRenderer.act(async () => fns.forEach(f => f()));
};

const openBox = async () => {
  const GovtPromisesBox = require('../src/screens/Civic/GovtPromisesBox').default;
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(<GovtPromisesBox lang="English" state="AP" />);
  });
  const btn = r.root.findAll(n => typeof n.props.onPress === 'function')[0];
  await ReactTestRenderer.act(async () => {
    btn.props.onPress();
  });
  await flush();
  await flush();
  return r;
};

jest.setTimeout(30000);

describe('promisesNotice', () => {
  it('maps bad / unknown kind and an old server to "not live", other errors to "no data yet"', () => {
    expect(promisesNotice('error', 'bad kind / state / district / variant', false)).toBe('notLive');
    expect(promisesNotice('error', 'Unknown kind: gprm', false)).toBe('notLive');
    expect(promisesNotice('serverOld', '', false)).toBe('notLive');
    expect(promisesNotice('error', 'HTTP 500', false)).toBe('noData');
    expect(promisesNotice('error', '', false)).toBe('noData');
    // researched promises on screen (or still loading / collecting) = no notice
    expect(promisesNotice('error', 'bad kind', true)).toBeNull();
    expect(promisesNotice('loading', '', false)).toBeNull();
    expect(promisesNotice('collecting', '', false)).toBeNull();
    expect(promisesNotice('ready', '', false)).toBeNull();
  });
});

describe('GovtPromisesBox when the Worker fails', () => {
  afterEach(() => workerFetch.mockReset());

  it('production Worker without kind gprm: friendly "not live yet", no raw error, no numbers', async () => {
    workerFetch.mockImplementation(async () => {
      throw new WorkerError(400, 'bad kind / state / district / variant');
    });
    const r = await openBox();
    const txt = textOf(r);
    expect(txt).toMatch(/Promises feature is not live on the server yet/);
    expect(txt).toMatch(/No data yet/);
    expect(txt).not.toMatch(/bad kind/);
    expect(txt).not.toMatch(/Could not load/);
    expect(txt).not.toMatch(/Total \d/);
    expect(r.root.findAll(n => n.props.testID === 'prm-notlive').length).toBeGreaterThan(0);
    r.unmount();
  });

  it('any other error: "no data yet", never the raw error text', async () => {
    workerFetch.mockImplementation(async () => {
      throw new WorkerError(500, 'HTTP 500 internal');
    });
    const r = await openBox();
    const txt = textOf(r);
    expect(txt).toMatch(/No data yet for this government/);
    expect(txt).not.toMatch(/HTTP 500/);
    expect(txt).not.toMatch(/Could not load/);
    expect(txt).not.toMatch(/Total \d/);
    r.unmount();
  });
});

describe('GovtPromisesBox with promises from the free Wikipedia fallback', () => {
  afterEach(() => workerFetch.mockReset());

  it('shows each promise with where it is stated (source + date) and the free-source note; status stays "No update"', async () => {
    const data = {
      origin: 'free',
      asOf: '2026-11',
      govt: { party: 'INC', head: 'A. Revanth Reddy', year: '2023', term: '', source: 'https://en.wikipedia.org/wiki/2023_Telangana_Legislative_Assembly_election#Manifesto_2' },
      promises: [
        { area: 'farmers', text: 'Farmers will receive ₹15,000 each year.', status: 'no_update', fact: '', source: '', date: '', ref: 'https://www.indiatoday.in/six-guarantees', refDate: '2023-09-17' },
      ],
      summary: { total: 1, done: 0, inProgress: 0, notDone: 0, noUpdate: 1 },
    };
    workerFetch.mockImplementation(async () => ({ kind: 'gprm', state: 'AP', district: '', variant: '', data, i18n: { te: null, hi: null }, sources: [], aiStars: null, status: 'ok', updatedAt: 1, aiConfigured: true, researchConfigured: true }));
    const r = await openBox();
    await expandAll(r);
    const txt = textOf(r);
    expect(txt).toMatch(/Wikipedia article on this election \(free source\)/);
    expect(txt).toMatch(/Farmers will receive ₹15,000 each year\./);
    expect(txt).toMatch(/www\.indiatoday\.in · 📅 2023-09-17/);
    expect(txt).toMatch(/Total 1 · Done 0 · In progress 0 · Not done 0 · No update 1/);
    r.unmount();
  });
});
