// Hospitals tab: "Where to go for X" search over public-source data, and the facts-only count.
import { expandQuery, factsCount, searchHospitals, sortByFacts } from '../src/services/hospitalSearch';
import type { Hospital } from '../src/services/civicApi';

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
  H({ name: 'NIMS', slug: 'nims', specialities: ['Cardiology', 'Nephrology'], facilities: ['ICU', 'Cath lab', 'Dialysis'], specialFor: ['Kidney transplant'] }),
  H({ name: 'MNJ Cancer Hospital', slug: 'mnj', specialities: ['Medical Oncology', 'Radiation Oncology'], facilities: ['Radiotherapy'] }),
  H({ name: 'Sarojini Devi Eye Hospital', slug: 'sdeh', specialities: ['Ophthalmology'], note: 'Free cataract treatment camps' }),
  H({ name: 'Area Hospital', slug: 'area', specialities: ['General Medicine'], doctors: [{ name: 'Dr X', speciality: 'ENT', qualification: '', experience: '', source: 'https://x.in' }] }),
];

describe('hospital search', () => {
  it('expands everyday words (EN / TE / HI) to speciality words', () => {
    expect(expandQuery('heart')).toEqual(expect.arrayContaining(['heart', 'cardio']));
    expect(expandQuery('గుండె')).toEqual(expect.arrayContaining(['cardio']));
    expect(expandQuery('किडनी')).toEqual(expect.arrayContaining(['nephro', 'dialysis']));
    expect(expandQuery('')).toEqual([]);
  });

  it('matches only what the public data lists; special-for ranks first', () => {
    expect(searchHospitals(list, 'heart').map(m => m.h.slug)).toEqual(['nims']);
    const k = searchHospitals(list, 'kidney');
    expect(k[0].h.slug).toBe('nims');
    expect(k[0].matched).toEqual(expect.arrayContaining(['Kidney transplant', 'Nephrology', 'Dialysis']));
    expect(searchHospitals(list, 'cancer')[0].h.slug).toBe('mnj');
    expect(searchHospitals(list, 'కంటి')[0].h.slug).toBe('sdeh');
    expect(searchHospitals(list, 'ear').map(m => m.h.slug)).toEqual(['area']); // doctor's listed speciality
    expect(searchHospitals(list, 'unknownthing')).toEqual([]);
    // short term 'ent' is whole-word only: "treatment" in a note does not count as ENT
    expect(searchHospitals([list[2]], 'ent')).toEqual([]);
    expect(searchHospitals(list, '').length).toBe(list.length);
  });

  it('facts count = listed specialities + facilities (no rating); stable sort', () => {
    expect(factsCount(list[0])).toEqual({ specialities: 2, facilities: 3, total: 5 });
    expect(factsCount(H({ specialities: ['A', 'a', ''] }))).toEqual({ specialities: 1, facilities: 0, total: 1 });
    expect(sortByFacts(list.map(h => ({ h }))).map(r => r.h.slug)).toEqual(['nims', 'mnj', 'sdeh', 'area']);
  });
});
