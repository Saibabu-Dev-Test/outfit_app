// Mandal (sub-district: Mandal / Tehsil / Taluk / Block ...) inside the civic place key. A mandal row
// is stored with district = "<district slug>~<mandal slug>" (civic_data has no mandal column; no
// migration needed), so a mandal, its district and its state are three separate rows. Only Govt and
// Hospitals take a mandal; the app sends it as its own `mandal` param and gets it echoed back split.
export const MANDAL_KINDS = new Set(['govt', 'hosp']);
export const MANDAL_SEP = '~';

export const placeKey = (district, mandal) => (district && mandal ? `${district}${MANDAL_SEP}${mandal}` : district || '');

/** "ranga-reddy~shamshabad" -> { district: 'ranga-reddy', mandal: 'shamshabad' } (pure: tested) */
export function splitPlace(key) {
  const [district = '', mandal = ''] = String(key || '').split(MANDAL_SEP);
  return { district, mandal: district ? mandal : '' };
}

// Level a stored row was asked for
export const levelOf = key => {
  const p = splitPlace(key);
  return p.mandal ? 'mandal' : p.district ? 'district' : 'state';
};

// Target as the app sees it: plain district + mandal (never the joined key)
export const publicTarget = t => {
  const p = splitPlace(t.district);
  return { kind: t.kind, state: t.state, district: p.district, mandal: p.mandal, variant: t.variant };
};

// The state's own word for the sub-district level (Census of India 2011; same as the app's
// scripts/lgd/build-locations.py LEVEL). Used in prompts and Wikipedia titles ("Shamshabad mandal").
const LEVEL = {
  AP: 'mandal', TG: 'mandal', KA: 'taluk', KL: 'taluk', TN: 'taluk', PY: 'taluk', MH: 'taluka', GJ: 'taluka', GA: 'taluka', DH: 'taluka',
  BR: 'block', JH: 'block', WB: 'block', ML: 'block', MZ: 'block', TR: 'block', AS: 'circle', AR: 'circle', NL: 'circle',
  MN: 'subdivision', SK: 'subdivision', DL: 'subdivision', LD: 'subdivision',
};
export const subLevelWord = stateCode => LEVEL[stateCode] || 'tehsil';
