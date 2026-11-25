// India's administrative hierarchy for the location pickers: 28 states + 8 UTs -> every district ->
// every sub-district (Mandal / Tehsil / Taluk / Taluka / Block / Circle / Sub-division: the state's
// own name for the level). Official Local Government Directory (LGD) data, codes + names only, with
// Telugu / Hindi names where the LGD export has them (README.md in this folder: source + date).
// Regenerate: python3 scripts/lgd/build-locations.py (never edit india.json by hand).
import raw from './india.json';

export type SubLevel = 'mandal' | 'tehsil' | 'taluk' | 'taluka' | 'block' | 'circle' | 'subdivision';

// [LGD code, English name, Telugu name?, Hindi name?]
export type SubDistrictRow = [number, string, string?, string?];

export interface LgdDistrict {
  c: number;
  n: string;
  te?: string;
  hi?: string;
  s: SubDistrictRow[];
}

export interface LgdState {
  c: string; // app state code (src/constants/indiaStates.ts)
  lgd: number;
  n: string;
  t: 'state' | 'ut';
  lv: SubLevel;
  d: LgdDistrict[];
}

export interface LgdData {
  source: string;
  observed: string;
  counts: { states: number; uts: number; districts: number; subdistricts: number };
  states: LgdState[];
}

export const LGD = raw as unknown as LgdData;

// Picker item: what a list shows and what a selection stores
export interface PlaceOption {
  code: number;
  name: string;
  te?: string;
  hi?: string;
}

const byState = new Map<string, LgdState>(LGD.states.map(s => [s.c, s]));

export const lgdState = (code: string): LgdState | undefined => byState.get(code);

export const districtsOf = (stateCode: string): PlaceOption[] =>
  (lgdState(stateCode)?.d || []).map(d => ({ code: d.c, name: d.n, te: d.te, hi: d.hi }));

export const lgdDistrict = (stateCode: string, districtCode: number): LgdDistrict | undefined =>
  (lgdState(stateCode)?.d || []).find(d => d.c === districtCode);

export const subDistrictsOf = (stateCode: string, districtCode: number): PlaceOption[] =>
  (lgdDistrict(stateCode, districtCode)?.s || []).map(([code, name, te, hi]) => ({ code, name, te: te || undefined, hi: hi || undefined }));

export const subLevelOf = (stateCode: string): SubLevel => lgdState(stateCode)?.lv || 'tehsil';

const norm = (v: string) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// A district saved before the picker (free text, e.g. "hyderabad"): the LGD district of that name
export const findDistrict = (stateCode: string, name: string): PlaceOption | undefined => {
  const n = norm(name);
  if (!n) return undefined;
  return districtsOf(stateCode).find(d => norm(d.name) === n);
};

export const findSubDistrict = (stateCode: string, districtCode: number, name: string): PlaceOption | undefined => {
  const n = norm(name);
  if (!n) return undefined;
  return subDistrictsOf(stateCode, districtCode).find(d => norm(d.name) === n);
};

// Name in the app language when the LGD has it (Telugu / Hindi), else English
export const placeLabel = (o: PlaceOption, code: string): string => (code === 'te' && o.te) || (code === 'hi' && o.hi) || o.name;

// Filter-as-you-type inside a list: matches the English or the local name (never a free value)
export const filterOptions = (list: PlaceOption[], q: string): PlaceOption[] => {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return list;
  const n = norm(s);
  return list.filter(o => (n && norm(o.name).includes(n)) || (o.te || '').includes(s) || (o.hi || '').includes(s));
};
