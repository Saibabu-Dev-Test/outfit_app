// Laws tab search (src/services/laws.ts) over src/data/laws: section numbers, old IPC numbers,
// words, act filter, and the data's basic shape.
import { allSections, countByAct, limitationFor, maxJailYears, searchLaws, sectionById } from '../src/services/laws';
import { ACTS, LAW_DISCLAIMER } from '../src/data/laws/acts';
import { HELPLINES } from '../src/data/laws/contacts';

describe('laws data', () => {
  it('has unique ids, every act present, and an official source on each section', () => {
    const all = allSections();
    expect(all.length).toBeGreaterThan(400);
    expect(new Set(all.map(s => s.id)).size).toBe(all.length);
    const counts = countByAct();
    ACTS.forEach(a => expect(counts[a.id]).toBeGreaterThan(0));
    all.forEach(s => {
      expect(s.title.trim()).not.toBe('');
      expect(s.source).toMatch(/^https:\/\//);
    });
  });

  it('keeps the disclaimer and the emergency helplines', () => {
    expect(LAW_DISCLAIMER).toMatch(/not legal advice/i);
    const nums = HELPLINES.map(h => h.number);
    ['112', '108', '1930', '181', '1098', '15100'].forEach(n => expect(nums).toContain(n));
  });
});

describe('searchLaws', () => {
  it('section number puts that section first (318 -> BNS 318, not old IPC 318)', () => {
    const r = searchLaws('318');
    expect(r[0].act).toBe('BNS');
    expect(r[0].section.startsWith('318')).toBe(true);
    expect(searchLaws('318(4)')[0].id).toBe('BNS-318(4)');
  });

  it('old IPC number finds the new BNS section', () => {
    expect(searchLaws('ipc 420')[0].id).toBe('BNS-318(4)');
    expect(searchLaws('IPC 302')[0].section.startsWith('103')).toBe(true);
    expect(searchLaws('420').map(s => s.id)).toContain('BNS-318(4)');
  });

  it('words match titles and meanings, all words required', () => {
    const r = searchLaws('murder');
    expect(r.length).toBeGreaterThan(0);
    expect(r.slice(0, 3).some(s => /murder/i.test(s.title))).toBe(true);
    expect(searchLaws('identity theft').map(s => s.id)).toContain('IT-66C');
    expect(searchLaws('zzqx nothing here')).toEqual([]);
  });

  it('act filter and max', () => {
    const it = searchLaws('', 'IT');
    expect(it.length).toBe(countByAct().IT);
    it.forEach(s => expect(s.act).toBe('IT'));
    expect(searchLaws('', 'ALL', 5)).toHaveLength(5);
    expect(sectionById('IT-66C')?.act).toBe('IT');
    expect(sectionById('nope')).toBeNull();
  });

  it('jail years and limitation helpers', () => {
    expect(maxJailYears('Imprisonment for 7 years and fine')).toBe(7);
    expect(maxJailYears('Fine')).toBe(0);
    expect(maxJailYears('Death or imprisonment for life')).toBeNull();
    expect(typeof limitationFor('Imprisonment for 7 years')).toBe('string');
  });
});

describe('plain-language layer (plain.en/te/hi.ts)', () => {
  const { PLAIN_EN } = require('../src/data/laws/plain.en');
  const { PLAIN_TE } = require('../src/data/laws/plain.te');
  const { PLAIN_HI } = require('../src/data/laws/plain.hi');
  const laws = require('../src/services/laws');

  it('every generated key is a real section id, with a title', () => {
    const ids = new Set(laws.allSections().map((s: any) => s.id));
    [PLAIN_EN, PLAIN_TE, PLAIN_HI].forEach((m: any) =>
      Object.entries(m).forEach(([id, v]: [string, any]) => {
        expect(ids.has(id)).toBe(true);
        expect(String(v.t).trim()).not.toBe('');
      }),
    );
  });

  it('plainTitle falls back to the legal title; ids are unique', () => {
    const all = laws.allSections();
    expect(new Set(all.map((s: any) => s.id)).size).toBe(all.length);
    const s = all[0];
    expect(laws.plainTitle({ ...s, plain: undefined }, 'te')).toBe(s.title);
    expect(laws.plainTitle({ ...s, plain: { en: { t: 'Plain', x: '' } } }, 'te')).toBe('Plain');
    expect(laws.plainTitle({ ...s, plain: { en: { t: 'Plain', x: '' }, te: { t: 'తెలుగు', x: '' } } }, 'te')).toBe('తెలుగు');
  });
});
