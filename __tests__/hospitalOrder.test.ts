// Hospitals tab list order (services/hospitalSearch.orderHospitalRows). Reported: Mumbai showed an
// empty list, and a search ("ent" with Government) hid the area's hospitals. User rule: "location
// wise hospitals show cheyyali" — the picked place's hospitals are always listed; a search only puts
// the matches first, then general govt hospitals that "may treat this — call to confirm", then the rest.
// Rows: real OSM elements of Mumbai City District (__tests__/fixtures/osm-mumbai-city.json) through
// the Worker's own parse (free/hosp.js parseAreaAnswer) and row shape (research.js freeHospData).
export {};
declare const __dirname: string;
const fsMod = require('fs');
const pathMod = require('path');
const hosp = require('../server/worker/src/civic/free/hosp.js');
const research = require('../server/worker/src/civic/research.js');
import { orderHospitalRows } from '../src/services/hospitalSearch';
import {
  hospitalTermsFor,
  specialitiesFor,
} from '../src/services/diseaseSearch';

const FIX = JSON.parse(
  fsMod.readFileSync(
    pathMod.join(__dirname, 'fixtures', 'osm-mumbai-city.json'),
    'utf8',
  ),
);
const parsed = hosp.parseAreaAnswer(FIX, 'MH', '2026-11-28', 1500);
const rowsOf = (variant: string) =>
  research
    .freeHospData(parsed.hospitals, variant, {
      district: 'Mumbai',
      today: '2026-11-28',
      where: 'Mumbai, Maharashtra',
    })
    .hospitals.map((h: any) => ({ h, v: variant }));
const govt = rowsOf('govt');
const priv = rowsOf('private');
const order = (rows: any[], q: string) =>
  orderHospitalRows(rows, q, {
    terms: q.trim() ? hospitalTermsFor(q) : [],
    mayTreat: specialitiesFor(q).length > 0,
  });
const names = (o: { rows: { h: { name: string } }[] }) =>
  o.rows.map(r => r.h.name);

describe('orderHospitalRows (Mumbai City, real OSM rows)', () => {
  it('Government + "ent": the Municipal ENT Hospital first, then may-treat govt hospitals, then the rest; nothing dropped', () => {
    expect(govt.length).toBeGreaterThan(8);
    const o = order(govt, 'ent');
    expect(o.rows[0].h.name).toBe(
      'Atmasingh Jassasingh Bankebihar Municipal ENT Hospital',
    );
    expect(o.rows[0].kind).toBe('match');
    expect(o.matches).toBeGreaterThanOrEqual(1);
    expect(o.rows).toHaveLength(govt.length); // the whole location list, re-ordered
    expect(new Set(names(o))).toEqual(new Set(govt.map((r: any) => r.h.name)));
    // matches, then may-treat, then the rest (never interleaved)
    const RANK: Record<string, number> = { match: 0, maybe: 1, rest: 2 };
    const rank = o.rows.map(r => RANK[r.kind as string]);
    expect(rank).toEqual([...rank].sort((a, b) => a - b));
    expect(o.maybe).toBeGreaterThan(0);
    expect(o.rows.filter(r => r.kind === 'maybe').map(r => r.h.name)).toContain(
      'L.T.Muncipal Medical College and Sion Hospital',
    );
  });

  it('no query: every hospital of the place, source order, all "rest"', () => {
    const o = order(govt, '');
    expect(names(o)).toEqual(govt.map((r: any) => r.h.name));
    expect(o.rows.every(r => r.kind === 'rest' && r.matched.length === 0)).toBe(
      true,
    );
  });

  it('a word nothing states (no speciality): no matches, the place list still shown', () => {
    const o = order(priv, 'zzqqxx');
    expect(o.matches).toBe(0);
    expect(o.maybe).toBe(0);
    expect(o.rows).toHaveLength(priv.length);
    expect(o.rows.length).toBeGreaterThan(0);
  });

  it('private list + "ear": no general govt rows to add, the private list is kept whole', () => {
    const o = order(priv, 'ear');
    expect(o.maybe).toBe(0);
    expect(o.rows).toHaveLength(priv.length);
  });

  it('All (govt + private): a name match first, never a duplicate row', () => {
    const all = [...govt, ...priv];
    const o = order(all, 'Jaslok');
    expect(o.rows[0].h.name).toMatch(/Jaslok/);
    expect(o.rows).toHaveLength(all.length);
  });

  it('empty list stays empty (nothing invented)', () => {
    expect(order([], 'ent').rows).toEqual([]);
  });
});
