// Disease / symptom search for the Hospitals "Where to go for…" box: English, everyday words,
// Telugu and Hindi (script + typed-in-English spellings), with misspelling tolerance.
// Order: exact name / alias -> phrase inside the query (or query inside a longer name) -> fuzzy
// (Damerau-Levenshtein, bounded by length). Pure functions, tested in __tests__/diseaseSearch.test.ts.
// It only says which department to see; it never diagnoses.
import { DISEASES, Disease, Speciality } from '../data/diseases';
import { expandQuery } from './hospitalSearch';

export type { Disease, Speciality } from '../data/diseases';

export interface DiseaseMatch {
  disease: Disease;
  score: number; // 1 = exact name / alias; lower = phrase or fuzzy match
  matchedAlias: string; // the dictionary name that matched (as written in the dictionary)
}

// Canonical speciality -> words found in hospital data (specialities, facilities, doctors, type).
// Short terms (<= 3 letters) match whole words only (see hospitalSearch.hasTerm).
export const SPECIALITY_TERMS: Record<Speciality, string[]> = {
  Cardiology: ['cardio', 'cardiac', 'heart', 'cath'],
  'Cardiothoracic Surgery': ['cardiothoracic', 'ctvs', 'cardiac surg', 'thoracic', 'bypass'],
  'Emergency Medicine': ['emergency', 'casualty', 'trauma', 'icu', 'critical care'],
  Endocrinology: ['endocrin', 'diabet', 'thyroid'],
  'General Medicine': ['general medicine', 'internal medicine', 'physician'],
  'General Surgery': ['general surg', 'laparoscop'],
  Nephrology: ['nephro', 'kidney', 'dialysis', 'renal'],
  Urology: ['urolog', 'lithotripsy', 'prostate', 'kidney'],
  Oncology: ['onco', 'cancer', 'radiotherapy', 'radiation', 'chemo'],
  Neurology: ['neuro', 'stroke'],
  Neurosurgery: ['neurosurg', 'neuro', 'spine'],
  Psychiatry: ['psychiat', 'mental', 'psycholog', 'deaddiction', 'de-addiction'],
  Pulmonology: ['pulmo', 'chest', 'respiratory', 'tb', 'tuberculosis'],
  Gastroenterology: ['gastro', 'endoscop', 'digestive'],
  Hepatology: ['hepat', 'liver'],
  'Liver Transplant': ['liver transplant', 'hepat', 'liver'],
  Orthopaedics: ['ortho', 'trauma', 'joint', 'spine', 'bone'],
  Rheumatology: ['rheumat', 'arthritis', 'immunolog'],
  Dermatology: ['dermat', 'skin', 'venereolog', 'cosmetolog'],
  Ophthalmology: ['ophthal', 'eye', 'cataract', 'retina'],
  ENT: ['ent', 'otorhino', 'otolaryng'],
  Dentistry: ['dental', 'dentist', 'maxillofacial'],
  'Obstetrics & Gynaecology': ['obstet', 'gynae', 'gynec', 'maternity', 'labour', 'labor', 'mch'],
  Paediatrics: ['paediat', 'pediat', 'child', 'neonat', 'nicu'],
  Neonatology: ['neonat', 'nicu', 'newborn', 'sncu'],
  'Infectious Diseases': ['infectious', 'infection', 'fever', 'communicable'],
  Haematology: ['haemat', 'hemat', 'blood bank', 'thalass'],
  'Plastic Surgery': ['plastic', 'burn', 'reconstruct'],
  'Vascular Surgery': ['vascular'],
  'Physical Medicine & Rehabilitation': ['physio', 'rehab', 'physical medicine'],
  Geriatrics: ['geriat', 'elderly'],
};

// Lowercase, Unicode NFC, drop punctuation / zero-width joiners, fold Hindi nukta, chandrabindu and
// half-nasal spellings (Hindi + Telugu),
// collapse spaces. Telugu / Devanagari letters and vowel signs are kept.
export const normalize = (s: string): string =>
  (s || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\u093c/g, '') // nukta: ज़ -> ज
    .replace(/\u0901/g, '\u0902') // chandrabindu -> anusvara: आँख -> आंख
    .replace(/[\u0919\u091e\u0923\u0928\u092e]\u094d(?=[\u0915-\u0939])/g, '\u0902') // half nasal -> anusvara: कैन्सर -> कैंसर
    .replace(/[\u0c19\u0c1e\u0c23\u0c28\u0c2e]\u0c4d(?=[\u0c15-\u0c39])/g, '\u0c02') // Telugu: న్స -> ంస
    .replace(/[!-/:-@[-`{-~\u0964\u0965\u2018-\u201f\u2026\u2013\u2014\u00b7\u2022]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Filler words people add around a disease ("best hospital for sugar problem", "కిడ్నీ వ్యాధి")
const STOP = new Set(
  [
    'problem', 'problems', 'disease', 'diseases', 'issue', 'issues', 'treatment', 'treatments', 'hospital', 'hospitals',
    'best', 'good', 'top', 'doctor', 'doctors', 'specialist', 'for', 'near', 'me', 'my', 'a', 'the', 'and', 'with',
    'have', 'having', 'i', 'clinic', 'care', 'centre', 'center', 'cure', 'symptoms', 'symptom',
    'vyadhi', 'samasya', 'bimari', 'ilaj', 'ka', 'ki', 'ke', 'hai',
    'వ్యాధి', 'సమస్య', 'ఆసుపత్రి', 'హాస్పిటల్', 'డాక్టర్', 'చికిత్స', 'కి', 'కు', 'ఉంది',
    'रोग', 'बीमारी', 'समस्या', 'अस्पताल', 'डॉक्टर', 'इलाज', 'का', 'की', 'के', 'लिए', 'है', 'में',
  ].map(normalize),
);

// Words too general to pick a disease on their own ("pain" must not jump to "heart pain")
const GENERIC = new Set(
  [
    'pain', 'ache', 'dard', 'noppi', 'నొప్పి', 'दर्द', 'water', 'food', 'hospital', 'test', 'severe', 'high', 'low', 'sudden',
    'bite', 'kaatu', 'కాటు', 'attack', 'manta', 'మంట', 'जलन', 'jalan', 'in', 'of', 'blood', 'leg', 'hand', 'body',
  ].map(normalize),
);

export const stripFillers = (q: string): string => {
  const kept = normalize(q)
    .split(' ')
    .filter(t => t && !STOP.has(t));
  return kept.join(' ');
};

// Optimal string alignment (Damerau-Levenshtein with adjacent swaps), stopping early past `max`
export function editDistance(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  const A = [...a];
  const B = [...b];
  if (Math.abs(A.length - B.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: B.length + 1 }, (_, j) => j);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= B.length; j++) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && A[i - 1] === B[j - 2] && A[i - 2] === B[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[B.length];
}

// How many typos a string of this length may have
const allowedEdits = (len: number): number => (len < 5 ? 0 : len <= 8 ? 1 : len <= 14 ? 2 : 3);

interface IndexEntry {
  d: Disease;
  name: string; // as written
  norm: string;
  tokens: string[];
  len: number; // code points
}

let INDEX: IndexEntry[] | null = null;
const EXACT = new Map<string, IndexEntry[]>();

const index = (): IndexEntry[] => {
  if (INDEX) return INDEX;
  INDEX = [];
  DISEASES.forEach(d => {
    const seen = new Set<string>();
    [d.en, ...d.aliases, ...d.te, ...d.hi].forEach(name => {
      const norm = normalize(name);
      if (!norm || seen.has(norm)) return;
      seen.add(norm);
      const e: IndexEntry = { d, name, norm, tokens: norm.split(' '), len: [...norm].length };
      INDEX!.push(e);
      EXACT.set(norm, [...(EXACT.get(norm) || []), e]);
    });
  });
  return INDEX;
};

// A query token stands for a dictionary token when equal, or when it extends a 4+ letter token
// ('kidneys' -> 'kidney', 'కిడ్నీలో' -> 'కిడ్నీ')
const tokEq = (q: string, n: string): boolean => q === n || ([...n].length >= 4 && q.startsWith(n));

// Index of the first place `needle` occurs as a run inside `hay`, or -1
const findRun = (hay: string[], needle: string[]): number => {
  for (let i = 0; i + needle.length <= hay.length; i++) {
    if (needle.every((t, k) => tokEq(hay[i + k], t))) return i;
  }
  return -1;
};

function scoreQuery(q: string, best: Map<string, DiseaseMatch>): void {
  if (!q) return;
  const put = (e: IndexEntry, score: number) => {
    const cur = best.get(e.d.id);
    if (!cur || score > cur.score) best.set(e.d.id, { disease: e.d, score, matchedAlias: e.name });
  };
  (EXACT.get(q) || []).forEach(e => put(e, 1));
  const qt = q.split(' ');
  const qlen = [...q].length;
  const k = allowedEdits(qlen);
  const specific = qt.some(t => !GENERIC.has(t) && !STOP.has(t));
  index().forEach(e => {
    if (e.norm === q) return;
    // 1) the dictionary name sits inside the query ("severe chest pain since morning")
    if (findRun(qt, e.tokens) >= 0) {
      put(e, 0.75 + 0.2 * (e.tokens.length / qt.length) - 0.01);
      return;
    }
    // 2) the query is the start of / a run inside a longer name ("kidney st" -> "kidney stone")
    if (qlen >= 3 && specific && findRun(e.tokens, qt) >= 0) {
      put(e, 0.55 + 0.2 * (qt.length / e.tokens.length));
      return;
    }
    // 3) whole-query typo match ("diabtes", "kidny stone", "cancr")
    if (k > 0 && Math.abs(e.len - qlen) <= k) {
      const dist = editDistance(q, e.norm, k);
      if (dist <= k) put(e, 0.6 * (1 - dist / Math.max(qlen, e.len)));
    }
  });
  // 4) one misspelt word inside a longer query ("my diabtes is high")
  if (qt.length > 1) {
    qt.forEach(t => {
      const tl = [...t].length;
      const tk = allowedEdits(tl);
      if (!tk) return;
      index().forEach(e => {
        if (e.tokens.length !== 1 || Math.abs(e.len - tl) > tk) return;
        const dist = editDistance(t, e.norm, tk);
        if (dist <= tk) put(e, 0.45 * (1 - dist / Math.max(tl, e.len)));
      });
    });
  }
}

// Ranked diseases for a query (best first). Ties keep the dictionary order (common ones first).
export function searchDiseases(query: string, limit = 5): DiseaseMatch[] {
  index();
  const raw = normalize(query);
  if (!raw) return [];
  const best = new Map<string, DiseaseMatch>();
  scoreQuery(raw, best);
  const stripped = stripFillers(query);
  if (stripped && stripped !== raw) scoreQuery(stripped, best);
  const order = new Map(DISEASES.map((d, i) => [d.id, i]));
  return [...best.values()]
    .filter(m => m.score >= 0.25)
    .sort((a, b) => b.score - a.score || (order.get(a.disease.id) || 0) - (order.get(b.disease.id) || 0))
    .slice(0, limit);
}

export const bestDisease = (query: string): DiseaseMatch | null => searchDiseases(query, 1)[0] || null;

// Specialities to see for a query (from the best match), in order; [] when nothing matches
export const specialitiesFor = (query: string): Speciality[] => bestDisease(query)?.disease.specialities || [];

export const termsForSpecialities = (sp: Speciality[]): string[] => [...new Set(sp.flatMap(s => SPECIALITY_TERMS[s] || []))];

// Search terms for the hospital list: disease -> speciality terms first, plus the old word expansion
// (hospitalSearch.expandQuery); just the old expansion when no disease matches.
export function hospitalTermsFor(query: string): string[] {
  const old = expandQuery(query);
  const m = bestDisease(query);
  if (!m || m.score < 0.4) return old;
  return [...new Set([...termsForSpecialities(m.disease.specialities), ...old])];
}

// The disease name in the app language (Telugu / Hindi script when the dictionary has one)
export function diseaseName(d: Disease, lang: string): string {
  const script = (xs: string[], re: RegExp) => xs.find(x => re.test(x));
  if (lang === 'Telugu') return script(d.te, /[\u0c00-\u0c7f]/) || d.en;
  if (lang === 'Hindi') return script(d.hi, /[\u0900-\u097f]/) || d.en;
  return d.en;
}
