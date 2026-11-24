// Hospitals tab > "Best in India for <disease>": official government package rates for the
// procedures that treat the matched disease, so people can compare a private hospital's quote.
// Data (bundled, never invented, each file carries its source URL + date):
//  - PM-JAY (Ayushman Bharat) HBP 2022, NHA Annexure-1, 1,949 packages, NRP + Tier1/2/3 city price
//    (data/pmjay/hbp2022.json)
//  - CGHS rates (OM 03.10.2025, in force 13.10.2025), 1,998 items, Tier I/II/III city x
//    Non-NABH / NABH / Super Speciality, semi-private ward (data/cghs/rates.json)
// These are what the scheme pays an empanelled hospital, not what every private hospital charges.
// Pure functions (tested in __tests__/procedureRates.test.ts).
import type { Disease, Speciality } from '../data/diseases';
import { bestDisease, normalize } from './diseaseSearch';
import pmjayRaw from '../data/pmjay/hbp2022.json';
import cghsRaw from '../data/cghs/rates.json';

export type RateScheme = 'PM-JAY' | 'CGHS';

export interface RateRow {
  code: string;
  name: string;
  specialty: string;
  package?: string; // PM-JAY package the procedure belongs to ('Appendicectomy' for 'Lap')
  rates?: Record<string, number>;
  rateType?: 'perDay' | 'text';
  rateText?: string;
  perDay?: Record<string, Record<string, number>>;
}

export interface RateFile {
  source: string;
  asOf: string;
  note: string;
  tiers: string[];
  procedures: RateRow[];
}

export const PMJAY = pmjayRaw as unknown as RateFile;
export const CGHS = cghsRaw as unknown as RateFile;

export interface RateHit {
  scheme: RateScheme;
  row: RateRow;
  score: number;
}

// Words in procedure names that say nothing about the disease
const STOP = new Set(['of', 'the', 'and', 'with', 'or', 'in', 'for', 'to', 'a', 'an', 'on', 'by', 'disease', 'disorder', 'pain', 'problem', 'syndrome', 'acute', 'chronic', 'infection', 'blood', 'high', 'low', 'other']);

// Extra treatment words per disease id: the procedure names rarely repeat the lay disease name
export const TREATMENT_WORDS: Record<string, string[]> = {
  'kidney-stone': ['nephrolithotomy', 'lithotripsy', 'ureteroscop', 'pcnl', 'eswl', 'urs', 'calculus', 'calculi', 'pyelolithotomy', 'ureterolithotomy'],
  diabetes: ['diabetic', 'diabetes', 'hba1c', 'glycosylated', 'blood glucose'],
  hypertension: ['accelerated hypertension', 'hypertensive'],
  cataract: ['phaco', 'cataract', 'iol', 'sics'],
  'heart-attack': ['ptca', 'coronary angioplasty', 'cabg', 'thrombolysis (for mi)', 'coronary', 'myocardial infarction'],
  'heart-pain': ['ptca', 'angioplasty', 'coronary angiography', 'cabg'],
  'heart-disease': ['ptca', 'angioplasty', 'coronary', 'cabg'],
  'heart-failure': ['heart failure', 'cardiac failure'],
  appendicitis: ['appendic'],
  piles: ['haemorrhoid', 'hemorrhoid', 'piles', 'fistula in ano', 'fissure in ano'],
  'kidney-transplant': ['renal transplant', 'kidney transplant'],
  'knee-replacement': ['knee replacement', 'knee arthroplasty', 'tkr'],
  hernia: ['hernia', 'herniorrhaphy', 'hernioplasty'],
  gallstones: ['cholecystectomy', 'cholelithiasis'],
  'knee-pain': ['knee', 'arthroplasty', 'arthroscop'],
  fracture: ['fracture', 'orif', 'k-wire', 'nailing', 'plating'],
  dialysis: ['dialysis', 'haemodialysis', 'hemodialysis'],
  'kidney-disease': ['dialysis', 'haemodialysis', 'hemodialysis', 'renal transplant', 'kidney transplant'],
};

const words = (s: string): string[] =>
  normalize(s)
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 3 && !STOP.has(w));

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

// A procedure's specialty fits a disease speciality when their first 5 letters agree
// ("Urology" ~ "Urology", "Neuro-Surgery Procedure" ~ "Neurosurgery", "Gastroenterolo gy" ~ "Gastroenterology")
export const specialtyFits = (procSpecialty: string, sp: Speciality[]): boolean => {
  const p = squash(procSpecialty);
  return sp.some(s => {
    const k = squash(s).slice(0, 5);
    return !!k && p.includes(k);
  });
};

// Search terms for a disease: its curated treatment words, else the words of its English name
// (aliases are lay words like 'sugar' or 'bleeding' and pull in unrelated packages)
export const rateTermsFor = (d: Disease): string[] => {
  const curated = TREATMENT_WORDS[d.id];
  return curated && curated.length ? [...curated] : [...new Set(words(d.en))];
};

const hasWord = (name: string, term: string): boolean =>
  term.length <= 4 ? new RegExp(`(^|[^a-z])${term}([^a-z]|$)`).test(name) : name.includes(term);

function rank(scheme: RateScheme, file: RateFile, d: Disease, limit: number): RateHit[] {
  const terms = rateTermsFor(d);
  if (!terms.length) return [];
  const out: RateHit[] = [];
  file.procedures.forEach(row => {
    const n = normalize(`${row.package || ''} ${row.name}`);
    const hits = terms.filter(t => hasWord(n, t)).length;
    if (!hits) return;
    const fits = specialtyFits(row.specialty || '', d.specialities);
    const curated = !!TREATMENT_WORDS[d.id];
    // Outside the disease's departments only a curated treatment word counts
    if (!fits && !curated) return;
    const hasPrice = !!row.rates && Object.keys(row.rates).length > 0;
    out.push({ scheme, row, score: Math.min(hits, 2) * 2 + (fits ? 3 : 0) + (hasPrice ? 1 : 0) });
  });
  return out.sort((a, b) => b.score - a.score || a.row.code.localeCompare(b.row.code)).slice(0, limit);
}

export interface RatesResult {
  disease: Disease | null;
  pmjay: RateHit[];
  cghs: RateHit[];
}

export function ratesFor(query: string, limit = 3): RatesResult {
  const m = bestDisease(query);
  if (!m || m.score < 0.4) return { disease: null, pmjay: [], cghs: [] };
  return { disease: m.disease, pmjay: rank('PM-JAY', PMJAY, m.disease, limit), cghs: rank('CGHS', CGHS, m.disease, limit) };
}

// Display name: PM-JAY rows add their package when the procedure name alone is short ('Lap')
export const rowTitle = (r: RateRow): string => {
  const pkg = (r.package || '').trim();
  if (!pkg || normalize(r.name).includes(normalize(pkg))) return r.name;
  return r.name.length < 45 ? `${pkg} - ${r.name}` : r.name;
};

const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trim()}…` : s);

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

// Short price line for a row: city tiers (PM-JAY: Tier1/2/3; CGHS: NABH Tier I/II/III), or the
// source's own text for per-cycle / per-day items
export function priceLine(hit: RateHit): string {
  const r = hit.row;
  if (r.rateType === 'text') return clip(r.rateText || '');
  if (r.rateType === 'perDay' && r.perDay) {
    const t1 = r.perDay['Tier1 (X)'] || Object.values(r.perDay)[0];
    const ward = t1 && (t1['Routine Ward'] ?? Object.values(t1)[0]);
    return typeof ward === 'number' ? `${inr(ward)} / day (ward, Tier1)` : '';
  }
  const rates = r.rates || {};
  const keys =
    hit.scheme === 'PM-JAY'
      ? [['Tier1 (X)', 'X'], ['Tier2 (Y)', 'Y'], ['Tier3 (Z)', 'Z']]
      : [['Tier I (X City) | NABH', 'X'], ['Tier II (Y City) | NABH', 'Y'], ['Tier III (Z City) | NABH', 'Z']];
  return keys
    .filter(([k]) => typeof rates[k] === 'number')
    .map(([k, l]) => `${l} ${inr(rates[k])}`)
    .join(' · ');
}
