// Audit India promises source (server/worker/src/civic/free/auditindia.js): parsers vs saved
// fixture pages (__tests__/fixtures/auditindia), status mapping, fetch with cache + polite gap,
// merge / dedupe with the Wikipedia items, and the cleaner keeping attribution fields.
// fetch is mocked; nothing goes to the network.
declare const __dirname: string;
const fs = require('fs');
const path = require('path');
const ai = require('../server/worker/src/civic/free/auditindia.js');
const research = require('../server/worker/src/civic/research.js');
const { placeByCode } = require('../server/worker/src/civic/states.js');

const FIX = path.join(__dirname, 'fixtures', 'auditindia');
const fixture = (f: string) => fs.readFileSync(path.join(FIX, f), 'utf8');
const STATE_AP = fixture('state-andhra-pradesh.html');
const FC_LIST = fixture('fact-checks-list.html');
const FC_PAGE = fixture('fact-check-ayushman-2024.html');
const NOW = Date.UTC(2026, 10, 26, 6, 0, 0);

const page = (body: string, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => body });

describe('Audit India parsers (fixtures)', () => {
  it('state page: government terms newest first, labels, graded flag, data date', () => {
    const g = ai.parseStatePage(STATE_AP);
    expect(g.map((x: any) => `${x.party} ${x.year}`)).toEqual(['TDP 2024', 'YSRCP 2019']);
    expect(g[0]).toMatchObject({ title: 'NDA AP Super Six Manifesto 2024', graded: true });
    expect(g[0].promises).toHaveLength(10);
    expect(g[1].promises).toHaveLength(11);
    expect(g[0].promises[0]).toMatchObject({ category: 'Women & Social Welfare', label: 'Partly delivered', primary: '' });
    expect(g[0].promises[0].text).toMatch(/^Give every household three free gas cylinders a year/);
    new Set(g[1].promises.map((p: any) => p.label)).forEach(l => expect(['Delivered', 'Not delivered', 'Partly delivered']).toContain(l));
    expect(ai.dataDate(STATE_AP)).toBe('2026-08-27');
    expect(ai.parseStatePage('<html>no promises here</html>')).toEqual([]);
  });

  it('fact-check list: promise pages by year, de-duplicated', () => {
    const byYear = ai.parseFactCheckList(FC_LIST + FC_LIST);
    expect(Object.keys(byYear).sort()).toEqual(['2019', '2024']);
    expect(byYear['2024']).toHaveLength(3);
    expect(byYear['2019']).toHaveLength(2);
    byYear['2024'].forEach((p: string) => expect(p).toMatch(/^\/en\/fact-checks\/promise-2024-[a-z0-9-]+\/$/));
  });

  it('fact-check page: ClaimReview text, party, dates, primary source, delivery label', () => {
    const p = ai.parseFactCheckPage(FC_PAGE);
    expect(p).toMatchObject({
      party: 'Bharatiya Janata Party',
      promised: '2024-04-14',
      primary: 'https://www.bjp.org/bjp-manifesto-2024',
      label: 'Too early to assess',
      checked: '2026-08-24',
    });
    expect(p.text).toMatch(/^Ayushman for Senior Citizens/);
    expect(ai.parseFactCheckPage('<html></html>')).toBeNull();
  });

  it('status mapping keeps to their wording; slugs; dates', () => {
    expect(ai.mapStatus('Delivered')).toBe('done');
    expect(ai.mapStatus('Partly delivered')).toBe('in_progress');
    expect(ai.mapStatus('In progress')).toBe('in_progress');
    expect(ai.mapStatus('Not delivered')).toBe('not_done');
    expect(ai.mapStatus('Too early to assess')).toBe('no_update');
    expect(ai.mapStatus('Unverifiable')).toBe('no_update');
    expect(ai.aiSlug({ code: 'AP', name: 'Andhra Pradesh' })).toBe('andhra-pradesh');
    expect(ai.aiSlug({ code: 'DL', name: 'Delhi' })).toBe('delhi-nct');
    expect(ai.dayOf('24 Sept 2026')).toBe('2026-09-24');
    expect(ai.dayOf('nothing')).toBe('');
  });
});

describe('fetchPromisesAuditIndia', () => {
  it('state: newest term only, Audit India page as source, graded flag, credits + terms', async () => {
    const urls: string[] = [];
    const fetchImpl = jest.fn(async (url: string, init: any) => {
      urls.push(url);
      expect(init.headers['User-Agent']).toBeTruthy();
      return page(STATE_AP);
    });
    const r = await ai.fetchPromisesAuditIndia(placeByCode('AP', 'gprm'), { fetchImpl, now: NOW, gapMs: 0 });
    expect(urls).toEqual(['https://auditindia.org/en/states/andhra-pradesh/']);
    expect(r).toMatchObject({ ok: true, year: '2024', party: 'TDP', partial: false });
    expect(r.data.credits).toEqual([{ name: 'Audit India', url: 'https://auditindia.org', terms: 'https://auditindia.org/en/terms/' }]);
    expect(r.data.promises).toHaveLength(10);
    r.data.promises.forEach((p: any) => {
      expect(p).toMatchObject({ by: 'auditindia', graded: true, source: 'https://auditindia.org/en/states/andhra-pradesh/#promises', date: '2026-08-27', refDate: '2024' });
      expect(['Delivered', 'Partly delivered', 'Not delivered']).toContain(p.statusLabel);
      expect(p.status).toBe(ai.mapStatus(p.statusLabel));
    });
    expect(r.sources.map((s: any) => s.url)).toEqual(expect.arrayContaining(['https://auditindia.org', 'https://auditindia.org/en/terms/']));
  });

  it('state page down or empty: no items, never invented', async () => {
    expect(await ai.fetchPromisesAuditIndia(placeByCode('AP', 'gprm'), { fetchImpl: async () => page('', 503), now: NOW, gapMs: 0 })).toMatchObject({ ok: false });
    expect(await ai.fetchPromisesAuditIndia(placeByCode('AP', 'gprm'), { fetchImpl: async () => page('<html></html>'), now: NOW, gapMs: 0 })).toMatchObject({ ok: false });
  });

  it('centre: newest year, a few pages per call (gap between requests), cached pages reused, partial flagged', async () => {
    const rows = new Map<string, { text: string; at: number }>();
    const cache = { get: async (k: string) => rows.get(k) || null, set: async (k: string, t: string) => void rows.set(k, { text: t, at: NOW }) };
    const urls: string[] = [];
    const sleeps: number[] = [];
    const fetchImpl = async (url: string) => {
      urls.push(url);
      return page(url.endsWith('/en/fact-checks/') ? FC_LIST : FC_PAGE);
    };
    const opts = { fetchImpl, now: NOW, cache, maxPages: 2, gapMs: 1000, sleepImpl: async (ms: number) => void sleeps.push(ms) };
    const r = await ai.fetchPromisesAuditIndia(placeByCode('IN', 'gprm'), opts);
    expect(urls).toHaveLength(3); // list + 2 of the 3 newest-year pages
    expect(urls.slice(1).every(u => /promise-2024-/.test(u))).toBe(true);
    expect(sleeps).toEqual([1000, 1000]);
    expect(r).toMatchObject({ ok: true, year: '2024', party: 'Bharatiya Janata Party', partial: true });
    expect(r.data.aiPartial).toBe(true);
    expect(r.data.promises[0]).toMatchObject({ by: 'auditindia', statusLabel: 'Too early to assess', status: 'no_update', primary: 'https://www.bjp.org/bjp-manifesto-2024', ref: 'https://www.bjp.org/bjp-manifesto-2024', graded: false });
    // second call: the list + the 2 pages come from the cache, only the 3rd page is fetched
    urls.length = 0;
    const r2 = await ai.fetchPromisesAuditIndia(placeByCode('IN', 'gprm'), opts);
    expect(urls).toHaveLength(1);
    expect(r2).toMatchObject({ ok: true, partial: false });
    expect(r2.data.aiPartial).toBeUndefined();
  });
});

describe('merge / dedupe with Wikipedia items', () => {
  it('samePromise: containment or most meaningful words shared', () => {
    expect(ai.samePromise('Free bus travel for women in RTC buses', 'free bus travel for women')).toBe(true);
    expect(ai.samePromise('Rs 15,000 a year to every farmer under Rythu Bharosa', 'Rythu Bharosa: Rs 15,000 a year for farmers')).toBe(true);
    expect(ai.samePromise('Free bus travel for women', 'Three free gas cylinders a year')).toBe(false);
    expect(ai.samePromise('', 'x')).toBe(false);
  });

  it('Audit India first, Wikipedia items added only when not the same promise, capped', () => {
    const a = [{ text: 'Free bus travel for women in RTC buses', by: 'auditindia' }, { text: 'Three free gas cylinders a year' }];
    const w = [{ text: 'free bus travel for women' }, { text: 'Unemployment allowance of Rs 3,000 a month' }, { text: '' }, null];
    expect(ai.mergePromises(a, w).map((p: any) => p.text)).toEqual(['Free bus travel for women in RTC buses', 'Three free gas cylinders a year', 'Unemployment allowance of Rs 3,000 a month']);
    expect(ai.mergePromises(a, w, 2)).toHaveLength(2);
    expect(ai.mergePromises(null, null)).toEqual([]);
  });

  it('fetchPromisesKeyless: Wikipedia down -> Audit India alone; cleaner keeps by / statusLabel / graded / primary / credits', async () => {
    const fetchImpl = async (url: string) => (/auditindia\.org/.test(url) ? page(STATE_AP) : page('', 503));
    const r = await research.fetchPromisesKeyless(null, placeByCode('AP', 'gprm'), { fetchImpl, now: NOW, request: true, sleepImpl: async () => undefined });
    expect(r).toMatchObject({ ok: true, by: 'auditindia' });
    const d = research.cleanPromises(r.data);
    expect(d.origin).toBe('free');
    expect(d.credits).toEqual([{ name: 'Audit India', url: 'https://auditindia.org', terms: 'https://auditindia.org/en/terms/' }]);
    expect(d.promises.length).toBeGreaterThan(0);
    d.promises.forEach((p: any) => expect(p).toMatchObject({ by: 'auditindia', graded: true }));
    expect(d.promises.some((p: any) => p.statusLabel === 'Partly delivered' && p.status === 'in_progress')).toBe(true);
    expect(d.summary.total).toBe(d.promises.length);
    // attribution fields are never translated
    ['statusLabel', 'by', 'graded', 'primary', 'credits'].forEach(k => expect(research.PRM_FIXED.has(k)).toBe(true));
  });

  it('both free sources down: no data', async () => {
    const r = await research.fetchPromisesKeyless(null, placeByCode('AP', 'gprm'), { fetchImpl: async () => page('', 503), now: NOW, sleepImpl: async () => undefined });
    expect(r.ok).toBe(false);
  });

  it('cleaner: a non-Audit-India item never gets credits; an Audit India item without kept evidence still links Audit India', () => {
    const base = { govt: { party: 'X', head: '', year: '2024', term: '', source: 'https://example.org/m' } };
    const plain = research.cleanPromises({ ...base, credits: [{ name: 'Audit India', url: 'https://auditindia.org' }], promises: [{ area: 'other', text: 'Build roads', status: 'no_update', ref: 'https://example.org/m', refDate: '2024' }] });
    expect(plain.credits).toBeUndefined();
    const aiItem = research.cleanPromises({
      ...base,
      credits: [{ name: 'Audit India', url: 'https://auditindia.org' }],
      promises: [{ area: 'other', text: 'Build roads', status: 'done', statusLabel: 'Delivered', fact: '', source: 'https://auditindia.org/en/states/x/#promises', date: '', ref: 'https://example.org/m', refDate: '2024', by: 'auditindia', graded: true, primary: '' }],
    });
    expect(aiItem.promises[0]).toMatchObject({ by: 'auditindia', status: 'no_update', statusLabel: 'Delivered', source: 'https://auditindia.org/en/states/x/#promises', graded: true });
    expect(aiItem.credits).toHaveLength(1);
  });
});

export {};
