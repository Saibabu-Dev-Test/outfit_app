// Disease search (EN / everyday words / Telugu / Hindi, misspellings) -> specialities -> hospital
// search terms, and the all-India NIRF 2025 Medical list (bestHospitalsFor).
import { DISEASES } from '../src/data/diseases';
import {
  SPECIALITY_TERMS,
  diseaseName,
  editDistance,
  hospitalTermsFor,
  normalize,
  searchDiseases,
  specialitiesFor,
  stripFillers,
} from '../src/services/diseaseSearch';
import { searchHospitals } from '../src/services/hospitalSearch';
import { NIRF_MEDICAL_2025, NIRF_NOTE, NIRF_SOURCE_URL, bestHospitalsFor } from '../src/data/topHospitalsIndia';
import type { Hospital } from '../src/services/civicApi';

const top = (q: string) => searchDiseases(q, 1)[0];
const topId = (q: string) => top(q)?.disease.id;

describe('disease dictionary', () => {
  it('has 400+ unique diseases, each with a name and at least one speciality', () => {
    expect(DISEASES.length).toBeGreaterThanOrEqual(400);
    expect(new Set(DISEASES.map(d => d.id)).size).toBe(DISEASES.length);
    DISEASES.forEach(d => {
      expect(d.en.trim()).not.toBe('');
      expect(d.specialities.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('every speciality used maps to hospital search terms', () => {
    const used = new Set(DISEASES.flatMap(d => d.specialities));
    used.forEach(s => expect((SPECIALITY_TERMS[s] || []).length).toBeGreaterThan(0));
    Object.values(SPECIALITY_TERMS).forEach(ts => ts.forEach(t => expect(t).toBe(t.toLowerCase())));
  });

  it('Telugu / Hindi lists start with the script name when present', () => {
    DISEASES.forEach(d => {
      if (d.te.length && d.te.some(x => /[\u0c00-\u0c7f]/.test(x))) expect(d.te[0]).toMatch(/[\u0c00-\u0c7f]/);
      if (d.hi.length && d.hi.some(x => /[\u0900-\u097f]/.test(x))) expect(d.hi[0]).toMatch(/[\u0900-\u097f]/);
    });
  });
});

describe('normalize / edit distance', () => {
  it('lowercases, strips punctuation, folds nukta + chandrabindu, keeps Indic marks', () => {
    expect(normalize('  Kidney-Stone!!  ')).toBe('kidney stone');
    expect(normalize('ज़हर')).toBe(normalize('जहर'));
    expect(normalize('आँख')).toBe(normalize('आंख'));
    expect(normalize('గుండె   నొప్పి।')).toBe('గుండె నొప్పి');
    expect(stripFillers('best hospital for sugar problem')).toBe('sugar');
    expect(stripFillers('కిడ్నీ వ్యాధి')).toBe('కిడ్నీ');
  });
  it('Damerau-Levenshtein with a bound', () => {
    expect(editDistance('diabtes', 'diabetes')).toBe(1);
    expect(editDistance('cnacer', 'cancer')).toBe(1); // swap
    expect(editDistance('abc', 'xyz123', 1)).toBeGreaterThan(1);
  });
});

describe('disease search', () => {
  it('required examples', () => {
    const sugar = top('sugar');
    expect(sugar.disease.en).toBe('Diabetes');
    expect(sugar.disease.specialities).toEqual(['Endocrinology', 'General Medicine']);
    expect(sugar.score).toBe(1);

    const ks = top('kidney stone');
    expect(ks.disease.en).toBe('Kidney stone');
    expect(ks.disease.specialities).toEqual(['Urology', 'Nephrology']);

    const hp = top('గుండె నొప్పి');
    expect(hp.disease.en).toBe('Heart pain');
    expect(hp.disease.specialities).toEqual(['Cardiology', 'Emergency Medicine']);

    const pathri = top('पथरी');
    expect(pathri.disease.en).toBe('Kidney stone');
    expect(specialitiesFor('पथरी')).toEqual(['Urology', 'Nephrology']);
  });

  it('BP, cancer and other everyday words', () => {
    expect(top('BP').disease.id).toBe('hypertension');
    expect(top('high bp').disease.specialities).toContain('Cardiology');
    expect(topId('cancer')).toBe('cancer');
    expect(specialitiesFor('cancer')).toEqual(['Oncology']);
    expect(topId('piles')).toBe('piles');
    expect(topId('jaundice')).toBe('jaundice');
    expect(topId('heart attack')).toBe('heart-attack');
    expect(topId('Kidney Stones')).toBe('kidney-stone');
    expect(topId('best hospital for sugar problem')).toBe('diabetes');
    expect(topId('severe chest pain since morning')).toBe('heart-pain');
  });

  it('misspellings', () => {
    expect(topId('diabtes')).toBe('diabetes');
    expect(topId('kidny stone')).toBe('kidney-stone');
    expect(topId('cancr')).toBe('cancer');
    expect(topId('jaundise')).toBe('jaundice');
    expect(topId('astma')).toBe('asthma');
    expect(top('diabtes').score).toBeLessThan(1);
  });

  it('Telugu and Hindi, script and typed in English', () => {
    expect(topId('shugar')).toBe('diabetes');
    expect(topId('షుగర్')).toBe('diabetes');
    expect(topId('gunde noppi')).toBe('heart-pain');
    expect(topId('pathri')).toBe('kidney-stone');
    expect(topId('peeliya')).toBe('jaundice');
    expect(topId('पीलिया')).toBe('jaundice');
    expect(topId('కామెర్లు')).toBe('jaundice');
    expect(topId('బీపీ')).toBe('hypertension');
    expect(topId('मधुमेह')).toBe('diabetes');
    expect(topId('कैंसर')).toBe('cancer');
    expect(topId('పాము కాటు')).toBe('snake-bite');
    expect(topId('पित्त की पथरी')).toBe('gallstones'); // longer phrase beats 'पथरी'
    expect(topId('कैन्सर')).toBe('cancer'); // Hindi spelling variant (fuzzy)
  });

  it('emergency flags', () => {
    ['heart attack', 'stroke', 'chest pain', 'snake bite', 'poisoning', 'burns', 'పాము కాటు', 'लकवा', 'vada debba'].forEach(q =>
      expect(top(q).disease.emergency).toBe(true),
    );
    ['sugar', 'kidney stone', 'acne', 'cataract'].forEach(q => expect(top(q).disease.emergency).toBeUndefined());
  });

  it('no match', () => {
    expect(searchDiseases('')).toEqual([]);
    expect(searchDiseases('   ')).toEqual([]);
    expect(searchDiseases('unknownthing')).toEqual([]);
    expect(searchDiseases('xqzv')).toEqual([]);
    expect(specialitiesFor('qwertyuiop')).toEqual([]);
  });

  it('ranked results with matched alias', () => {
    const r = searchDiseases('stone', 5);
    expect(r[0].disease.id).toBe('kidney-stone');
    expect(r[0].matchedAlias).toBe('stone');
    for (let i = 1; i < r.length; i++) expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score);
  });

  it('disease name in the app language', () => {
    const d = top('sugar').disease;
    expect(diseaseName(d, 'Telugu')).toBe('షుగర్');
    expect(diseaseName(d, 'Hindi')).toBe('मधुमेह');
    expect(diseaseName(d, 'English')).toBe('Diabetes');
    expect(diseaseName(d, 'Tamil')).toBe('Diabetes');
  });
});

describe('hospital terms from disease search', () => {
  const H = (o: Partial<Hospital>): Hospital => ({
    name: 'H',
    slug: 'h',
    type: '',
    district: '',
    address: '',
    phone: '',
    emergency24x7: false,
    specialities: [],
    schemes: [],
    website: '',
    note: '',
    ...o,
  });
  const list = [
    H({ name: 'Uro Centre', slug: 'uro', specialities: ['Urology'] }),
    H({ name: 'Endo Clinic', slug: 'endo', specialities: ['Endocrinology'] }),
    H({ name: 'Eye Hospital', slug: 'eye', specialities: ['Ophthalmology'] }),
  ];
  it('uses disease -> speciality terms, falls back to the old expansion', () => {
    expect(hospitalTermsFor('pathri')).toEqual(expect.arrayContaining(['urolog', 'nephro']));
    expect(searchHospitals(list, 'pathri', hospitalTermsFor('pathri')).map(m => m.h.slug)).toEqual(['uro']);
    expect(searchHospitals(list, 'diabtes', hospitalTermsFor('diabtes')).map(m => m.h.slug)).toEqual(['endo']);
    expect(searchHospitals(list, 'unknownthing', hospitalTermsFor('unknownthing'))).toEqual([]);
    expect(hospitalTermsFor('heart')).toEqual(expect.arrayContaining(['cardio', 'heart']));
  });
});

describe('best hospitals in India (NIRF 2025 Medical)', () => {
  it('has the top 50 with source', () => {
    expect(NIRF_MEDICAL_2025).toHaveLength(50);
    expect(NIRF_MEDICAL_2025.map(h => h.rank)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    NIRF_MEDICAL_2025.forEach(h => {
      expect(h.sourceUrl).toBe(NIRF_SOURCE_URL);
      expect(h.sourceLabel).toBe('NIRF 2025 Medical rank');
    });
    expect(NIRF_MEDICAL_2025[0]).toMatchObject({ name: 'All India Institute of Medical Sciences, Delhi', score: 91.8, stateCode: 'DL' });
    expect(NIRF_NOTE).toMatch(/not a treatment-quality rating/);
  });

  it('specialist institutes first when their speciality matches', () => {
    const heart = bestHospitalsFor('గుండె నొప్పి');
    expect(heart.match?.disease.id).toBe('heart-pain');
    expect(heart.emergency).toBe(true);
    expect(heart.hospitals[0].rank).toBe(17); // Sree Chitra
    expect(heart.hospitals[0].reason).toBe('specialist');
    expect(heart.hospitals.slice(1).map(h => h.rank)).toEqual([1, 2, 3, 4]);

    expect(bestHospitalsFor('cancer').hospitals[0].rank).toBe(44); // GCRI
    expect(bestHospitalsFor('fatty liver').hospitals[0].rank).toBe(28); // ILBS
    expect(bestHospitalsFor('depression').hospitals[0].rank).toBe(7); // NIMHANS
    const stroke = bestHospitalsFor('stroke').hospitals.map(h => h.rank);
    expect(stroke.slice(0, 2)).toEqual([7, 17]);
  });

  it('general by NIRF rank; unrelated specialist institutes left out', () => {
    const ks = bestHospitalsFor('kidney stone');
    expect(ks.specialities).toEqual(['Urology', 'Nephrology']);
    expect(ks.emergency).toBe(false);
    expect(ks.hospitals.map(h => h.rank)).toEqual([1, 2, 3, 4, 5]);
    const all = bestHospitalsFor('kidney stone', { limit: 50 }).hospitals.map(h => h.rank);
    [7, 17, 28, 44].forEach(r => expect(all).not.toContain(r));
    expect(all).toHaveLength(46);
  });

  it('same state first (code or name)', () => {
    const tg = bestHospitalsFor('sugar', { state: 'TG' }).hospitals;
    expect(tg[0]).toMatchObject({ rank: 48, sameState: true });
    expect(tg.slice(1).map(h => h.rank)).toEqual([1, 2, 3, 4]);
    const tn = bestHospitalsFor('sugar', { state: 'Tamil Nadu', limit: 3 }).hospitals.map(h => h.rank);
    expect(tn).toEqual([3, 9, 11]);
    // specialist (other state) still before same-state general
    expect(bestHospitalsFor('heart attack', { state: 'TG' }).hospitals.map(h => h.rank).slice(0, 2)).toEqual([17, 48]);
  });

  it('no match -> nothing', () => {
    expect(bestHospitalsFor('unknownthing')).toEqual({ match: null, specialities: [], emergency: false, hospitals: [] });
  });
});
