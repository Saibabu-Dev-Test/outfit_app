// Govt > Promises: Audit India items (free source) + free-tier-only model lists in the app.
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

const { workerFetch } = require('../src/services/workerApi');
const { badgeText } = require('../src/screens/Civic/GovtPromisesBox');
const { civicText } = require('../src/i18n/civicLabels');

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

const openBox = async (lang = 'English') => {
  const GovtPromisesBox = require('../src/screens/Civic/GovtPromisesBox').default;
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(<GovtPromisesBox lang={lang} state="AP" />);
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

// Audit India items in the Govt > Promises box: attribution "Source: Audit India (auditindia.org)",
// the primary source link, their own status wording, and a small note on graded items (EN / TE / HI).
// Also: the app and the laws script use only allow-listed free Gemini models (no alias).
const data = {
  origin: 'free',
  asOf: '2026-08',
  credits: [{ name: 'Audit India', url: 'https://auditindia.org', terms: 'https://auditindia.org/en/terms/' }],
  govt: { party: 'TDP', head: '', year: '2024', term: '', source: 'https://auditindia.org/en/states/andhra-pradesh/#promises' },
  promises: [
    {
      area: 'women',
      text: 'Three free gas cylinders a year',
      status: 'in_progress',
      statusLabel: 'Partly delivered',
      fact: 'Deepam 2.0 launched July 2024.',
      source: 'https://auditindia.org/en/states/andhra-pradesh/#promises',
      date: '2026-08-27',
      ref: 'https://auditindia.org/en/states/andhra-pradesh/#promises',
      refDate: '2024',
      by: 'auditindia',
      graded: true,
      primary: '',
    },
    {
      area: 'health',
      text: 'Ayushman Bharat for senior citizens',
      status: 'no_update',
      statusLabel: 'Too early to assess',
      fact: 'The expansion is under way.',
      source: 'https://auditindia.org/en/fact-checks/promise-2024-ayushman/',
      date: '2026-08-24',
      ref: 'https://www.bjp.org/bjp-manifesto-2024',
      refDate: '2024',
      by: 'auditindia',
      graded: false,
      primary: 'https://www.bjp.org/bjp-manifesto-2024',
    },
  ],
  summary: { total: 2, done: 0, inProgress: 1, notDone: 0, noUpdate: 1 },
};
const answer = async () => ({ kind: 'gprm', state: 'AP', district: '', variant: '', data, i18n: { te: null, hi: null }, sources: [], aiStars: null, status: 'ok', updatedAt: 1, aiConfigured: true, researchConfigured: true });

describe('GovtPromisesBox with Audit India items', () => {
  afterEach(() => workerFetch.mockReset());

  it('English: attribution, primary source, their status wording, graded note only on graded items', async () => {
    workerFetch.mockImplementation(answer);
    const r = await openBox();
    await expandAll(r);
    const txt = textOf(r);
    expect(txt).toMatch(/Source: Audit India \(auditindia\.org\)/);
    expect(txt).toMatch(/Partly delivered/);
    expect(txt).toMatch(/Too early to assess/);
    expect(txt).toMatch(/Primary source: www\.bjp\.org/);
    expect(txt).toMatch(/Audit India's grade — evidence not yet sourced/);
    expect(r.root.findAll(n => n.props.testID === 'prm-graded-0').length).toBeGreaterThan(0);
    expect(r.root.findAll(n => n.props.testID === 'prm-graded-1')).toHaveLength(0);
    expect(r.root.findAll(n => n.props.testID === 'prm-audit-credit').length).toBeGreaterThan(0);
    // Wikipedia note only when Wikipedia items are on screen
    expect(txt).not.toMatch(/Wikipedia article on this election/);
    expect(txt).toMatch(/Total 2 · Done 0 · In progress 1 · Not done 0 · No update 1/);
    r.unmount();
  });

  it('Telugu and Hindi: translated attribution + graded note; their wording kept with our status after it', async () => {
    for (const lang of ['Telugu', 'Hindi']) {
      workerFetch.mockImplementation(answer);
      const r = await openBox(lang);
      await expandAll(r);
      const txt = textOf(r);
      expect(txt).toContain(civicText(lang, 'prmAuditSource'));
      expect(txt).toContain(civicText(lang, 'prmAuditGraded'));
      expect(txt).toContain(`Partly delivered · ${civicText(lang, 'prmInProgress')}`);
      r.unmount();
      workerFetch.mockReset();
    }
    expect(civicText('Telugu', 'prmAuditGraded')).not.toBe(civicText('English', 'prmAuditGraded'));
    expect(civicText('Hindi', 'prmAuditGraded')).not.toBe(civicText('English', 'prmAuditGraded'));
    expect(civicText('Telugu', 'prmAuditSource')).toMatch(/auditindia\.org/);
    expect(civicText('Hindi', 'prmAuditSource')).toMatch(/auditindia\.org/);
  });

  it('badgeText: our label for non-Audit-India items', () => {
    expect(badgeText({ status: 'done', text: 'x', area: 'other', fact: '', source: '', date: '' }, 'English')).toBe('Done');
    expect(badgeText({ status: 'done', statusLabel: 'Delivered', by: 'auditindia', text: 'x', area: 'other', fact: '', source: '', date: '' }, 'English')).toBe('Delivered');
  });
});

describe('free-tier-only model lists outside the Worker', () => {
  it('app config and the laws script list only allow-listed free models, never gemini-flash-latest', () => {
    const { GEMINI_FREE_MODELS } = require('../server/worker/src/civic/gemini.js');
    const { GEMINI_MODELS } = require('../src/config/ai');
    expect(GEMINI_MODELS.length).toBeGreaterThan(0);
    GEMINI_MODELS.forEach((m: string) => expect(GEMINI_FREE_MODELS).toContain(m));
    const fs = require('fs');
    const src = fs.readFileSync(require('path').join((globalThis as any).process.cwd(), 'scripts', 'laws-i18n.js'), 'utf8');
    const list = JSON.parse((/const MODELS = (\[[^\]]*\])/.exec(src) as RegExpExecArray)[1].replace(/'/g, '"'));
    list.forEach((m: string) => expect(GEMINI_FREE_MODELS).toContain(m));
    expect(list).not.toContain('gemini-flash-latest');
    expect(GEMINI_MODELS).not.toContain('gemini-flash-latest');
  });
});
