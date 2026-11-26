// All-India "best hospitals" list for the Hospitals tab, from ONE public, citable source:
// NIRF India Rankings 2025, Medical (Ministry of Education), top 50:
// https://www.nirfindia.org/Rankings/2025/MedicalRanking.html
// NIRF ranks medical institutions on teaching, research, outcomes, outreach and perception. It is a
// teaching + research ranking, NOT a treatment-quality rating; the app says so next to every rank.
// Specialities are marked only where an institute's public identity is a speciality institute
// (NIMHANS, Sree Chitra, ILBS, GCRI); every other entry is a general multi-speciality institution.
// Pure data + bestHospitalsFor(), tested in __tests__/diseaseSearch.test.ts.
import type { Speciality } from './diseases';
import { DiseaseMatch, bestDisease } from '../services/diseaseSearch';

export const NIRF_SOURCE_URL = 'https://www.nirfindia.org/Rankings/2025/MedicalRanking.html';
export const NIRF_SOURCE_LABEL = 'NIRF 2025 Medical rank';
export const NIRF_NOTE = 'NIRF rank (teaching + research ranking, not a treatment-quality rating)';

export interface NirfHospital {
  rank: number;
  nirfId: string; // NIRF institute ID
  name: string; // as listed by NIRF
  city: string;
  state: string;
  stateCode: string; // app state code (constants/indiaStates.ts)
  score: number; // NIRF 2025 Medical score (out of 100)
  specialities: Speciality[]; // [] = general multi-speciality
  sourceUrl: string;
  sourceLabel: string;
}

const H = (rank: number, nirfId: string, name: string, city: string, state: string, stateCode: string, score: number, specialities: Speciality[] = []): NirfHospital => ({
  rank,
  nirfId,
  name,
  city,
  state,
  stateCode,
  score,
  specialities,
  sourceUrl: NIRF_SOURCE_URL,
  sourceLabel: NIRF_SOURCE_LABEL,
});

export const NIRF_MEDICAL_2025: NirfHospital[] = [
  H(1, 'IR-D-N-15', 'All India Institute of Medical Sciences, Delhi', 'New Delhi', 'Delhi', 'DL', 91.8),
  H(2, 'IR-D-U-0079', 'Post Graduate Institute of Medical Education and Research', 'Chandigarh', 'Chandigarh', 'CH', 82.58),
  H(3, 'IR-D-C-45654', 'Christian Medical College', 'Vellore', 'Tamil Nadu', 'TN', 76.48),
  H(4, 'IR-D-U-0368', 'Jawaharlal Institute of Post Graduate Medical Education & Research', 'Puducherry', 'Puducherry', 'PY', 73.3),
  H(5, 'IR-D-N-33', 'Sanjay Gandhi Postgraduate Institute of Medical Sciences', 'Lucknow', 'Uttar Pradesh', 'UP', 70.09),
  H(6, 'IR-D-U-0500', 'Banaras Hindu University', 'Varanasi', 'Uttar Pradesh', 'UP', 70.05),
  H(7, 'IR-D-U-0236', 'National Institute of Mental Health & Neuro Sciences, Bangalore', 'Bengaluru', 'Karnataka', 'KA', 69.77, ['Psychiatry', 'Neurology', 'Neurosurgery']),
  H(8, 'IR-D-U-0523', "King George's Medical University", 'Lucknow', 'Uttar Pradesh', 'UP', 68.77),
  H(9, 'IR-D-U-0436', 'Amrita Vishwa Vidyapeetham', 'Coimbatore', 'Tamil Nadu', 'TN', 68.52),
  H(10, 'IR-D-C-7242', 'Kasturba Medical College, Manipal', 'Manipal', 'Karnataka', 'KA', 68.05),
  H(11, 'IR-D-I-1441', 'Saveetha Institute of Medical and Technical Sciences', 'Chennai', 'Tamil Nadu', 'TN', 66.5),
  H(12, 'IR-D-I-1110', 'Dr. D. Y. Patil Vidyapeeth', 'Pune', 'Maharashtra', 'MH', 65.17),
  H(13, 'IR-D-U-0691', 'All India Institute of Medical Sciences Rishikesh', 'Rishikesh', 'Uttarakhand', 'UK', 65.02),
  H(14, 'IR-D-U-0688', 'All India Institute of Medical Sciences Bhubaneswar', 'Khordha', 'Odisha', 'OD', 64.31),
  H(15, 'IR-D-U-0363', "Siksha 'O' Anusandhan", 'Bhubaneswar', 'Odisha', 'OD', 63.73),
  H(16, 'IR-D-C-49008', 'Madras Medical College & Government General Hospital, Chennai', 'Chennai', 'Tamil Nadu', 'TN', 63.71),
  H(17, 'IR-D-U-0266', 'Sree Chitra Tirunal Institute for Medical Sciences and Technology, Thiruvananthapuram', 'Thiruvananthapuram', 'Kerala', 'KL', 63.36, [
    'Cardiology',
    'Cardiothoracic Surgery',
    'Neurology',
    'Neurosurgery',
  ]),
  H(18, 'IR-D-U-0473', 'S.R.M. Institute of Science and Technology', 'Chennai', 'Tamil Nadu', 'TN', 63.22),
  H(19, 'IR-D-U-0689', 'All India Institute of Medical Sciences Jodhpur', 'Jodhpur', 'Rajasthan', 'RJ', 63.18),
  H(20, 'IR-D-U-0295', 'Datta Meghe Institute of Higher Education and Research', 'Wardha', 'Maharashtra', 'MH', 62.37),
  H(21, 'IR-D-I-1486', 'Sri Ramachandra Institute of Higher Education and Research', 'Chennai', 'Tamil Nadu', 'TN', 61.54),
  H(22, 'IR-D-C-32922', 'Vardhman Mahavir Medical College & Safdarjung Hospital', 'New Delhi', 'Delhi', 'DL', 61.5),
  H(23, 'IR-D-C-16428', 'Institute of Post Graduate Medical Education & Research', 'Kolkata', 'West Bengal', 'WB', 61.07),
  H(24, 'IR-D-U-0356', 'Kalinga Institute of Industrial Technology', 'Bhubaneswar', 'Odisha', 'OD', 61.0),
  H(25, 'IR-D-U-0687', 'All India Institute of Medical Sciences Bhopal', 'Bhopal', 'Madhya Pradesh', 'MP', 60.15),
  H(26, 'IR-D-C-6414', 'Maulana Azad Medical College', 'Delhi', 'Delhi', 'DL', 59.47),
  H(27, 'IR-D-U-0686', 'All India Institute of Medical Sciences Patna', 'Patna', 'Bihar', 'BR', 59.24),
  H(28, 'IR-D-U-0106', 'Institute of Liver and Biliary Sciences', 'New Delhi', 'Delhi', 'DL', 59.22, ['Hepatology', 'Gastroenterology', 'Liver Transplant']),
  H(29, 'IR-D-U-0496', 'Aligarh Muslim University', 'Aligarh', 'Uttar Pradesh', 'UP', 58.82),
  H(30, 'IR-D-C-40453', "St. John's Medical College", 'Bengaluru', 'Karnataka', 'KA', 58.74),
  H(31, 'IR-D-U-0690', 'All India Institute of Medical Sciences Raipur', 'Raipur', 'Chhattisgarh', 'CG', 58.44),
  H(32, 'IR-D-C-22461', 'Lady Hardinge Medical College', 'New Delhi', 'Delhi', 'DL', 57.98),
  H(33, 'IR-D-U-0168', 'Maharishi Markandeshwar', 'Ambala', 'Haryana', 'HR', 56.68),
  H(34, 'IR-D-C-29442', 'Govt. Medical College & Hospital', 'Chandigarh', 'Chandigarh', 'CH', 56.67),
  H(35, 'IR-D-C-7251', 'Kasturba Medical College, Mangalore', 'Mangaluru', 'Karnataka', 'KA', 56.45),
  H(36, 'IR-D-C-29255', 'Dayanand Medical College', 'Ludhiana', 'Punjab', 'PB', 55.65),
  H(37, 'IR-D-C-35009', 'JSS Medical College, Mysore', 'Mysuru', 'Karnataka', 'KA', 55.51),
  H(38, 'IR-D-I-1409', 'University College of Medical Sciences', 'Delhi', 'Delhi', 'DL', 54.21),
  H(39, 'IR-D-N-17', 'Sawai Man Singh Medical College', 'Jaipur', 'Rajasthan', 'RJ', 52.69),
  H(40, 'IR-D-U-0107', 'Jamia Hamdard', 'New Delhi', 'Delhi', 'DL', 52.57),
  H(41, 'IR-D-C-16424', 'Medical College, Kolkata', 'Kolkata', 'West Bengal', 'WB', 52.54),
  H(42, 'IR-D-C-47762', 'Mahatma Gandhi Medical College and Research Institute', 'Puducherry', 'Puducherry', 'PY', 52.42),
  H(43, 'IR-D-C-45515', 'PSG Institute of Medical Sciences and Research', 'Coimbatore', 'Tamil Nadu', 'TN', 52.41),
  H(44, 'IR-D-C-5838', 'Gujarat Cancer & Research Institute', 'Ahmedabad', 'Gujarat', 'GJ', 52.15, ['Oncology']),
  H(45, 'IR-D-C-6051', 'B. J. Medical College', 'Ahmedabad', 'Gujarat', 'GJ', 51.84),
  H(46, 'IR-D-C-24503', 'Jawaharlal Nehru Medical College', 'Belagavi', 'Karnataka', 'KA', 51.7),
  H(47, 'IR-D-C-29209', 'Christian Medical College, Brown Road, Ludhiana', 'Ludhiana', 'Punjab', 'PB', 51.47),
  H(48, 'IR-D-C-30588', 'Osmania Medical College', 'Hyderabad', 'Telangana', 'TG', 51.46),
  H(49, 'IR-D-U-0451', 'Chettinad Academy of Research and Education', 'Kelambakkam', 'Tamil Nadu', 'TN', 51.41),
  H(50, 'IR-D-C-40345', 'M. S. Ramaiah Medical College', 'Bengaluru', 'Karnataka', 'KA', 50.91),
];

export interface RankedNirfHospital extends NirfHospital {
  reason: 'specialist' | 'general'; // specialist = speciality institute for this disease
  sameState: boolean;
}

export interface BestHospitals {
  match: DiseaseMatch | null;
  specialities: Speciality[];
  emergency: boolean;
  hospitals: RankedNirfHospital[];
}

// Disease match + its specialities + NIRF institutions: speciality institutes whose speciality fits
// first, then general multi-speciality institutions by NIRF rank. With `state` (app code like 'TG'
// or a state name), the same-state ones come first inside each group. Speciality institutes for
// other specialities are left out (NIMHANS is not listed for a kidney stone).
export function bestHospitalsFor(query: string, opts: { state?: string; limit?: number } = {}): BestHospitals {
  const match = bestDisease(query);
  if (!match) return { match: null, specialities: [], emergency: false, hospitals: [] };
  const sp = match.disease.specialities;
  const st = (opts.state || '').trim().toLowerCase();
  const inState = (h: NirfHospital) => !!st && (h.stateCode.toLowerCase() === st || h.state.toLowerCase() === st);
  const rows: RankedNirfHospital[] = NIRF_MEDICAL_2025.filter(h => !h.specialities.length || h.specialities.some(s => sp.includes(s))).map(h => ({
    ...h,
    reason: h.specialities.length ? 'specialist' : 'general',
    sameState: inState(h),
  }));
  const group = (h: RankedNirfHospital) => (h.reason === 'specialist' ? 0 : 2) + (h.sameState ? 0 : 1);
  rows.sort((a, b) => group(a) - group(b) || a.rank - b.rank);
  return { match, specialities: sp, emergency: !!match.disease.emergency, hospitals: rows.slice(0, opts.limit ?? 5) };
}
