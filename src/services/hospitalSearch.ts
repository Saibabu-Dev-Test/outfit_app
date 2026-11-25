// Hospitals tab: "Where to go for X" search and the facts-only count, over the hospitals already
// loaded from the Worker (public-source data). Pure functions (tested in __tests__/hospitalSearch.test.ts).
// A hospital matches only on what its public data states (specialities, special-for diseases,
// publicly listed doctors' specialities, facilities, type, name, note). Nothing is inferred about
// quality; the count is the number of listed specialities + facilities, never a rating.
import type { Hospital } from './civicApi';

// Everyday words (English / Telugu / Hindi) -> speciality words found in hospital data
export const DISEASE_MAP: { words: string[]; terms: string[] }[] = [
  { words: ['heart', 'cardiac', 'chest pain', 'bp', 'గుండె', 'दिल', 'हृदय'], terms: ['cardio', 'cardiac', 'heart', 'cath'] },
  { words: ['kidney', 'renal', 'dialysis', 'urine', 'stone', 'కిడ్నీ', 'మూత్రపిండ', 'డయాలసిస్', 'किडनी', 'गुर्दा', 'डायलिसिस'], terms: ['nephro', 'urolog', 'kidney', 'dialysis', 'renal'] },
  { words: ['cancer', 'tumour', 'tumor', 'క్యాన్సర్', 'కేన్సర్', 'कैंसर'], terms: ['onco', 'cancer', 'radiotherapy', 'radiation', 'chemo'] },
  { words: ['eye', 'vision', 'cataract', 'కన్ను', 'కంటి', 'आँख', 'आंख', 'मोतियाबिंद'], terms: ['ophthal', 'eye', 'cataract', 'retina'] },
  { words: ['delivery', 'pregnancy', 'pregnant', 'maternity', 'ప్రసవం', 'కాన్పు', 'గర్భ', 'प्रसव', 'गर्भ', 'डिलीवरी'], terms: ['obstet', 'gynae', 'gynec', 'maternity', 'labour', 'labor', 'mch'] },
  { words: ['child', 'children', 'baby', 'kids', 'newborn', 'పిల్ల', 'శిశు', 'बच्चे', 'बच्चा', 'शिशु'], terms: ['paediat', 'pediat', 'neonat', 'nicu', 'child'] },
  { words: ['bone', 'fracture', 'joint', 'knee', 'spine', 'back pain', 'ఎముక', 'మోకాలు', 'हड्डी', 'घुटना'], terms: ['ortho', 'trauma', 'joint', 'spine'] },
  { words: ['brain', 'stroke', 'paralysis', 'fits', 'seizure', 'headache', 'మెదడు', 'పక్షవాతం', 'दिमाग', 'लकवा', 'पक्षाघात'], terms: ['neuro', 'stroke'] },
  { words: ['lung', 'lungs', 'breathing', 'asthma', 'tb', 'tuberculosis', 'cough', 'ఊపిరి', 'ఆస్తమా', 'క్షయ', 'सांस', 'दमा', 'टीबी'], terms: ['pulmo', 'chest', 'respiratory', 'tb', 'tuberculosis'] },
  { words: ['stomach', 'liver', 'gastric', 'digestion', 'కడుపు', 'కాలేయ', 'పేగు', 'पेट', 'लीवर', 'जिगर'], terms: ['gastro', 'hepat', 'liver'] },
  { words: ['skin', 'చర్మ', 'त्वचा'], terms: ['dermat', 'skin'] },
  { words: ['teeth', 'tooth', 'dental', 'పన్ను', 'పళ్ల', 'दांत', 'दाँत'], terms: ['dental', 'dentist', 'maxillofacial'] },
  { words: ['ear', 'nose', 'throat', 'చెవి', 'ముక్కు', 'गला', 'कान', 'नाक'], terms: ['ent', 'otorhino', 'otolaryng'] },
  { words: ['mental', 'depression', 'anxiety', 'stress', 'మానసిక', 'मानसिक', 'तनाव'], terms: ['psychiat', 'mental', 'psycholog'] },
  { words: ['diabetes', 'sugar', 'thyroid', 'షుగర్', 'మధుమేహ', 'थायरॉइड', 'मधुमेह', 'शुगर'], terms: ['endocrin', 'diabet', 'thyroid'] },
  { words: ['accident', 'emergency', 'injury', 'trauma', 'ప్రమాదం', 'గాయ', 'दुर्घटना', 'चोट'], terms: ['trauma', 'emergency', 'casualty', 'icu'] },
  { words: ['burn', 'burns', 'కాలిన', 'जलना', 'जले'], terms: ['burn', 'plastic'] },
  { words: ['women', 'periods', 'uterus', 'మహిళ', 'స్త్రీ', 'महिला', 'स्त्री'], terms: ['gynae', 'gynec', 'obstet'] },
];

const low = (s?: string) => (s || '').toLowerCase().trim();

// The search terms for a query: its own words + the speciality words of any matching everyday word
export const expandQuery = (query: string): string[] => {
  const q = low(query);
  if (!q) return [];
  const out = new Set<string>();
  const tokens = q.split(/[\s,]+/).filter(w => w.length >= 2);
  tokens.forEach(w => out.add(w));
  // Whole words only ('heart' must not pick up 'ear'); a longer word may extend it ('kidneys')
  const hit = (w: string) =>
    w.includes(' ') ? q.includes(w) : tokens.some(t => t === w || (w.length >= 4 && t.startsWith(w))) || (q.length >= 3 && w.startsWith(q));
  DISEASE_MAP.forEach(d => {
    if (d.words.some(hit)) d.terms.forEach(t => out.add(t));
  });
  return [...out];
};

// Short terms ('ent', 'tb', 'icu') match whole words only, so 'ent' does not match 'treatment'
const hasTerm = (value: string, term: string): boolean =>
  /^[a-z]{1,3}$/.test(term) ? new RegExp(`(^|[^a-z])${term}([^a-z]|$)`).test(value) : value.includes(term);

export interface HospMatch<T extends Hospital = Hospital> {
  h: T;
  matched: string[]; // the hospital's own listed values that matched
  score: number;
}

// Field weights: what a source says the hospital is special for > specialities / doctors > facilities
const fieldsOf = (h: Hospital): [string, number][] => [
  ...(h.specialFor || []).map(v => [v, 3] as [string, number]),
  ...(h.specialities || []).map(v => [v, 2] as [string, number]),
  ...(h.doctors || []).map(d => [d.speciality, 2] as [string, number]),
  ...(h.facilities || []).map(v => [v, 1] as [string, number]),
  [h.type || '', 1],
  [h.name || '', 1],
  [h.note || '', 1],
];

// `terms` (optional): search terms already worked out for the query, e.g. by the disease search
// (services/diseaseSearch.hospitalTermsFor); default is expandQuery(query).
export function searchHospitals<T extends Hospital>(list: T[], query: string, terms: string[] = expandQuery(query)): HospMatch<T>[] {
  if (!terms.length) return list.map(h => ({ h, matched: [], score: 0 }));
  const out: HospMatch<T>[] = [];
  list.forEach(h => {
    let score = 0;
    const matched: string[] = [];
    fieldsOf(h).forEach(([v, w]) => {
      const lv = low(v);
      if (lv && terms.some(t => hasTerm(lv, t))) {
        score += w;
        if (!matched.includes(v) && w >= 1 && v !== h.name && v !== h.note) matched.push(v);
      }
    });
    if (score > 0) out.push({ h, matched: matched.slice(0, 6), score });
  });
  return out.sort((a, b) => b.score - a.score);
}

// Facts-only count: number of distinct specialities + facilities a public source lists (not a rating)
export const factsCount = (h: Hospital): { specialities: number; facilities: number; total: number } => {
  const sp = new Set((h.specialities || []).map(low).filter(Boolean)).size;
  const fa = new Set((h.facilities || []).map(low).filter(Boolean)).size;
  return { specialities: sp, facilities: fa, total: sp + fa };
};

// Stable sort by the count, most first (ties keep the source order)
export function sortByFacts<T extends { h: Hospital }>(rows: T[]): T[] {
  return rows
    .map((r, i) => ({ r, i, n: factsCount(r.h).total }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map(x => x.r);
}

// React keys for the hospital rows: `${variant}:${slug}` (falls back to the OSM page / name / index),
// made unique with a "#n" suffix when two rows share one. Duplicate keys make React re-order native
// children, which on Fabric (Android) crashes with "addViewAt: failed to insert view into parent".
export function uniqueRowKeys<T extends { v: string; h: Pick<Hospital, 'slug' | 'name'> & { osmUrl?: string } }>(rows: T[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((r, i) => {
    const base = `${r.v}:${r.h.slug || r.h.osmUrl || r.h.name || `row${i}`}`;
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n ? `${base}#${n}` : base;
  });
}
