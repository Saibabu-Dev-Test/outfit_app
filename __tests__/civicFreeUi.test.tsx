// Civic client for free sources + languages: header language chip (Govt / Hospitals / Laws) with the
// 12 app languages and "Also show English"; OpenStreetMap hospital rows (name, address, tap-to-call,
// map link, Govt / Private / "Likely private · ownership not confirmed" / "Type not listed", source + date); Govt Collector / SP "Public info not
// available" + district website; Laws Telugu / Hindi static text filled. Worker calls are mocked.
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return { SafeAreaView: RN.View, SafeAreaProvider: RN.View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'U' } }) }));
jest.mock('../src/services/adminSystem', () => ({ isOwnerUser: () => true }));
jest.mock('../src/services/workerApi', () => {
  class WorkerError extends Error {
    status = 0;
  }
  return { workerFetch: jest.fn(), WorkerError };
});

const SRC = { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/node/1', date: '2026-11-22' };
const FREE_HOSP = {
  origin: 'free',
  asOf: '2026-11-22',
  src: SRC,
  hospitals: [
    { name: 'Government General Hospital Kurnool', slug: 'ggh', type: '', district: '', address: 'Hospital Rd, Kurnool', phone: '+91 8518 222222', emergency24x7: false, specialities: [], schemes: [], website: '', mapUrl: 'https://www.openstreetmap.org/?mlat=15.8&mlon=78.0', note: '', ownership: 'govt', lat: 15.8, lon: 78.0, osmUrl: 'https://www.openstreetmap.org/node/1', src: SRC },
    { name: 'Sunrise Clinic', slug: 'sunrise', type: '', district: '', address: '', phone: '', emergency24x7: false, specialities: [], schemes: [], website: '', mapUrl: 'https://maps.example/2', note: '', ownership: 'unknown', osmUrl: 'https://www.openstreetmap.org/way/2', src: null },
  ],
};
const FREE_GOVT = {
  origin: 'free',
  asOf: '2026-11-22',
  overview: 'Andhra Pradesh is a state in India.',
  leaders: { governor: 'G', chiefMinister: { name: 'CM Name', party: 'P', role: '' }, deputyCMs: [], ministers: [] },
  district: { headquarters: 'Kurnool', collector: '', sp: '', policeCommissioner: '', mps: [], mlas: [] },
  offices: [{ name: 'Kurnool district official website', what: 'District administration (Collectorate) portal', address: '', phone: '', website: 'https://kurnool.ap.gov.in' }],
  schemes: [],
  grievance: [],
  election: { lastAssembly: '', lastLokSabha: '', next: '', voterHelpline: '', ceoWebsite: '' },
  departments: [],
  services: [],
  helplines: [],
  src: { overview: { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Andhra_Pradesh', date: '2026-11-22' }, leaders: { name: 'Wikidata + Wikipedia', url: 'https://www.wikidata.org/wiki/Q1159', date: '2026-11-22' } },
};
const resp = (kind: string, state: string, variant: string, data: any) => ({
  kind,
  state,
  district: 'kurnool',
  variant,
  data,
  i18n: { te: null, hi: null },
  sources: [],
  aiStars: null,
  status: 'ok',
  updatedAt: 1,
  aiConfigured: true,
  researchConfigured: true,
  freeSources: true,
});

const { workerFetch } = require('../src/services/workerApi');
workerFetch.mockImplementation(async (path: string) => {
  const u = new URL(`https://x${path}`);
  if (path.startsWith('/v1/civic/data')) {
    const kind = u.searchParams.get('kind') || '';
    const variant = u.searchParams.get('variant') || '';
    if (kind === 'hosp') return resp('hosp', 'AP', variant, variant === 'govt' ? FREE_HOSP : { origin: 'free', hospitals: [] });
    if (kind === 'govt') return resp('govt', 'AP', '', FREE_GOVT);
    return resp(kind, 'AP', '', null);
  }
  if (path.startsWith('/v1/civic/reviews')) return { item: '', count: 0, avg: null, reviews: [], mine: null };
  return { ok: true, status: 'ok', did: 'nothing' };
});

const textOf = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root
    .findAll(n => (n.type as any) === 'Text' || (n.type as any)?.displayName === 'Text')
    .map(n => [].concat(n.props.children ?? '').join(''))
    .join('\n');

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
const byId = (r: ReactTestRenderer.ReactTestRenderer, id: string) => r.root.findAll(n => n.props.testID === id && typeof n.type !== 'string');

jest.setTimeout(30000);

beforeEach(async () => {
  await AsyncStorage.setItem('outfit.civic.place', JSON.stringify({ state: 'AP', district: 'Kurnool' }));
  const { setAppLanguage } = require('../src/i18n/appLanguage');
  const { setCivicShowEnglish } = require('../src/i18n/civicEnglish');
  await ReactTestRenderer.act(async () => {
    setAppLanguage('English');
    setCivicShowEnglish(true);
  });
});
afterEach(async () => {
  await ReactTestRenderer.act(async () => {
    mounted.splice(0).forEach(r => r.unmount());
  });
});

describe('language chip', () => {
  it('opens the 12 app languages; picking one sets the app language; English switch toggles', async () => {
    const LanguageChip = require('../src/screens/Civic/LanguageChip').default;
    const { APP_LANGUAGES, getAppLanguage } = require('../src/i18n/appLanguage');
    const { getCivicShowEnglish } = require('../src/i18n/civicEnglish');
    const r = await mount(<LanguageChip lang="English" />);
    expect(APP_LANGUAGES).toHaveLength(12);
    const modal = () => r.root.findAll(n => typeof n.props.visible === 'boolean' && n.props.onRequestClose)[0];
    expect(modal().props.visible).toBe(false);
    await ReactTestRenderer.act(async () => byId(r, 'civic-lang-chip')[0].props.onPress());
    expect(modal().props.visible).toBe(true);
    APP_LANGUAGES.forEach((l: string) => expect(byId(r, `civic-lang-${l}`).length).toBeGreaterThan(0));
    expect(textOf(r)).toMatch(/తెలుగు/);
    expect(textOf(r)).toMatch(/हिन्दी/);
    await ReactTestRenderer.act(async () => byId(r, 'civic-lang-Telugu')[0].props.onPress());
    expect(getAppLanguage()).toBe('Telugu');
    expect(modal().props.visible).toBe(false);
    await ReactTestRenderer.act(async () => byId(r, 'civic-lang-chip')[0].props.onPress());
    const sw = r.root.findAll(n => n.props.testID === 'civic-lang-english' && typeof n.props.onValueChange === 'function')[0];
    expect(sw.props.value).toBe(true);
    await ReactTestRenderer.act(async () => sw.props.onValueChange(false));
    expect(getCivicShowEnglish()).toBe(false);
  });

  it('is in the Govt, Hospitals and Laws headers (with the Moderate badge for the owner)', async () => {
    for (const name of ['GovtScreen', 'HospitalsScreen', 'LawsScreen']) {
      const Screen = require(`../src/screens/Civic/${name}`).default;
      const r = await mount(<Screen />);
      await flush();
      expect(byId(r, 'civic-lang-chip').length).toBeGreaterThan(0);
      if (name !== 'LawsScreen') expect(textOf(r)).toMatch(/Moderate/);
    }
  });

  it('the chip shows the current language in its own script', async () => {
    const LanguageChip = require('../src/screens/Civic/LanguageChip').default;
    const r = await mount(<LanguageChip lang="Hindi" />);
    expect(textOf(r)).toMatch(/🌐 हिन्दी/);
  });
});

describe('free-source hospital rows', () => {
  it('name, address, tap-to-call (tel:), map link, type label and source + date', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    const { FreeHospitalRow } = require('../src/screens/Civic/civicFreeParts');
    const r = await mount(<FreeHospitalRow h={FREE_HOSP.hospitals[0]} lang="English" />);
    const txt = textOf(r);
    expect(txt).toMatch(/Government General Hospital Kurnool/);
    expect(txt).toMatch(/Hospital Rd, Kurnool/);
    expect(txt).toMatch(/🏷️ Govt/);
    expect(txt).toMatch(/Source: OpenStreetMap · 2026-11-22/);
    await ReactTestRenderer.act(async () => byId(r, 'hosp-call')[0].props.onPress());
    expect(spy).toHaveBeenCalledWith('tel:+918518222222');
    await ReactTestRenderer.act(async () => byId(r, 'hosp-map')[0].props.onPress());
    expect(spy).toHaveBeenCalledWith('https://www.openstreetmap.org/?mlat=15.8&mlon=78.0');
    spy.mockRestore();
  });

  it('unknown ownership = "Likely private · ownership not confirmed" (govt-looking name = "Type not listed"); private = Private; no phone = public info not available', async () => {
    const { FreeHospitalRow, hospTypeKey } = require('../src/screens/Civic/civicFreeParts');
    expect(hospTypeKey({ ownership: 'govt' })).toBe('typeGovt');
    expect(hospTypeKey({ ownership: 'private' })).toBe('typePrivate');
    expect(hospTypeKey({ ownership: 'unknown' })).toBe('typeNotListed');
    expect(hospTypeKey({ ownership: 'unknown', name: 'Sunrise Clinic' })).toBe('typePrivateLikely');
    expect(hospTypeKey({ ownership: 'unknown', name: 'Area Hospital, Tenali' })).toBe('typeNotListed');
    expect(hospTypeKey({ ownership: 'unknown', name: 'Vijaya PHC' })).toBe('typeNotListed');
    expect(hospTypeKey({ name: 'Sunrise Clinic' })).toBe('typeNotListed'); // no OSM ownership field
    expect(hospTypeKey({})).toBe('typeNotListed');
    const r = await mount(<FreeHospitalRow h={FREE_HOSP.hospitals[1]} lang="English" />);
    const txt = textOf(r);
    expect(txt).toMatch(/Likely private · ownership not confirmed/);
    expect(txt).not.toMatch(/🏷️ Private\b/);
    expect(txt).toMatch(/Phone: Public info not available/);
    expect(byId(r, 'hosp-call')).toHaveLength(0);
    expect(txt).toMatch(/openstreetmap\.org/); // OSM page as the source when no src
    const { CIVIC_LABELS } = require('../src/i18n/civicLabels');
    expect(CIVIC_LABELS.Telugu.typeNotListed).toBeTruthy();
    expect(CIVIC_LABELS.Hindi.typeNotListed).toBeTruthy();
    expect(CIVIC_LABELS.Telugu.typePrivateLikely).not.toBe(CIVIC_LABELS.English.typePrivateLikely);
    expect(CIVIC_LABELS.Hindi.typePrivateLikely).not.toBe(CIVIC_LABELS.English.typePrivateLikely);
  });

  it('Hospitals screen renders free rows (no "Research paused")', async () => {
    const HospitalsScreen = require('../src/screens/Civic/HospitalsScreen').default;
    const r = await mount(<HospitalsScreen />);
    await flush();
    const txt = textOf(r);
    expect(txt).toMatch(/Government General Hospital Kurnool/);
    expect(txt).toMatch(/Sunrise Clinic/);
    expect(txt).toMatch(/Likely private · ownership not confirmed/);
    expect(txt).not.toMatch(/Research paused/);
    expect(txt).not.toMatch(/Timings: Public info not available/); // compact free row, not the AI card
  });
});

describe('Govt free sources', () => {
  it('section source lines; Collector / SP = public info not available + district website', async () => {
    const GovtScreen = require('../src/screens/Civic/GovtScreen').default;
    const r = await mount(<GovtScreen />);
    await flush();
    const txt = textOf(r);
    expect(txt).toMatch(/Source: Wikipedia · 2026-11-22/);
    expect(txt).toMatch(/Source: Wikidata \+ Wikipedia · 2026-11-22/);
    expect(r.root.findAll(n => n.props.testID === 'govt-not-listed' && typeof n.type === 'string')).toHaveLength(2);
    expect(txt).toMatch(/District website/);
    expect(txt).not.toMatch(/Research paused/);
    const { districtSiteOf } = require('../src/screens/Civic/civicFreeParts');
    expect(districtSiteOf(FREE_GOVT as any)).toBe('https://kurnool.ap.gov.in');
    expect(districtSiteOf(null)).toBe('');
  });
});

describe('Laws Telugu / Hindi static text', () => {
  const { PLAIN_TE } = require('../src/data/laws/plain.te');
  const { PLAIN_HI } = require('../src/data/laws/plain.hi');
  const { CURATED } = require('../src/data/laws/curated');
  const laws = require('../src/services/laws');

  it('every curated section has a Telugu and Hindi title + summary in its own script', () => {
    const ids = laws.allSections().filter((s: any) => s.act !== 'BNS').map((s: any) => s.id);
    expect(ids.length).toBe(CURATED.length);
    expect(ids.length).toBeGreaterThanOrEqual(50);
    ids.forEach((id: string) => {
      expect(PLAIN_TE[id].t).toMatch(/[\u0C00-\u0C7F]/);
      expect(PLAIN_TE[id].x).toMatch(/[\u0C00-\u0C7F]/);
      expect(PLAIN_HI[id].t).toMatch(/[\u0900-\u097F]/);
      expect(PLAIN_HI[id].x).toMatch(/[\u0900-\u097F]/);
    });
  });

  it('BNS rows reuse the Offence guide Telugu / Hindi (same section)', () => {
    const { OFFENCE_GUIDE } = require('../src/data/laws/offenceGuide');
    const murder = OFFENCE_GUIDE.find((g: any) => g.id === 'murder');
    const row = laws.allSections().find((s: any) => s.act === 'BNS' && /^103/.test(s.section));
    expect(row.plain.te.t).toBe(murder.t.te);
    expect(row.plain.hi.x).toBe(murder.x.hi);
    expect(Object.keys(PLAIN_TE).length).toBeGreaterThan(150);
    expect(Object.keys(PLAIN_HI).length).toBe(Object.keys(PLAIN_TE).length);
  });

  it('Laws list is searchable in Telugu / Hindi and shows Telugu with English', async () => {
    expect(laws.searchLaws('వరకట్నం').length).toBeGreaterThan(0);
    expect(laws.searchLaws('दहेज').length).toBeGreaterThan(0);
    const { setAppLanguage } = require('../src/i18n/appLanguage');
    await ReactTestRenderer.act(async () => setAppLanguage('Telugu'));
    const LawsScreen = require('../src/screens/Civic/LawsScreen').default;
    const r = await mount(<LawsScreen />);
    const sections = r.root.findAll(n => typeof n.props.onPress === 'function' && n.findAll(c => /అన్ని సెక్షన్లు|All sections/.test([].concat(c.props.children ?? '').join(''))).length > 0);
    if (sections.length) await ReactTestRenderer.act(async () => sections[sections.length - 1].props.onPress());
    // the list opens in Telugu (sections with Telugu text first), English under each line
    const first = textOf(r);
    expect(first).toMatch(/హత్య|దొంగతనం|మోసం/);
    const input = r.root.findAll(n => typeof n.props.onChangeText === 'function' && /^వెతకండి:/.test(String(n.props.placeholder || '')))[0];
    await ReactTestRenderer.act(async () => input.props.onChangeText('సమాచారం అడగడం'));
    const txt = textOf(r);
    expect(txt).toMatch(/సమాచారం అడగడం/);
    expect(txt).toMatch(/Asking for information/);
  });
});
