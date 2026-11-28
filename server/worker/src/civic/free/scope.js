// Keeps a hospital list inside the place the user picked (pure: tested in __tests__/civicHospScope.test.ts).
//   1. inState(): a row is dropped when anything about it names ANOTHER state: its OSM / Nominatim
//      state (addr:state, address.state, ISO3166-2-lvl4), its 6-digit PIN code (India Post PIN
//      prefixes, below) or its address text ("..., Bengaluru Urban, Karnataka 560064"). A bounding
//      box / radius reaches into the neighbours (Andhra Pradesh's box holds Bengaluru and Hosur), so
//      every free / AI / cached row passes this check before it is saved AND when it is read.
//   2. lgdPlace(): the LGD codes of the picked district / mandal (civic/lgd.js, from the app's own
//      LGD picker data). OpenStreetMap tags Indian boundaries with ref:LGD:district /
//      ref:LGD:subdistrict, so Overpass can be asked for the exact boundary (no name guessing:
//      the app's "Ananthapuramu" / "Anantapur Rural" are OSM's "Anantapuramu District" /
//      "Anantapur Mandal").
//   3. nameVariants(): spelling variants for the name fallback (Ananthapuramu ~ Anantapuramu ~ Anantapur).
import { LGD } from '../lgd.js';

// India Post PIN prefixes (first 3 digits) per state / UT code. Generous on purpose (shared
// ranges are listed for both sides): a PIN only ever REMOVES a row when it cannot be in the state.
// Source: India Post PIN code zones (indiapost.gov.in), e.g. AP 515-535, Telangana 500-509.
const R = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
export const PIN_PREFIXES = {
  DL: R(110, 110),
  HR: [...R(121, 136)],
  PB: [...R(140, 160)],
  CH: [160],
  HP: [...R(171, 177)],
  JK: [...R(180, 194)],
  LA: [194],
  UP: [...R(201, 285)],
  UK: [...R(244, 263)],
  RJ: [...R(301, 345)],
  GJ: [...R(360, 396)],
  DH: [362, 396],
  MH: [...R(400, 445)],
  GA: [403],
  MP: [...R(450, 488)],
  CG: [...R(490, 497)],
  TG: [...R(500, 509)],
  // 507: the Polavaram-project mandals moved from Khammam (Telangana) to Andhra Pradesh in 2014
  AP: [507, ...R(515, 535)],
  KA: [...R(560, 591)],
  TN: [...R(600, 643)],
  PY: [533, 605, 607, 609, 673],
  KL: [...R(670, 695)],
  LD: [682],
  WB: [...R(700, 743)],
  SK: [737],
  AN: [744],
  OD: [...R(751, 770)],
  AS: [...R(781, 788)],
  AR: [...R(790, 792)],
  ML: [793, 794],
  MN: [795],
  MZ: [796],
  NL: [797, 798],
  TR: [799],
  BR: [...R(800, 855)],
  JH: [...R(813, 835)],
};

// OSM / Nominatim ISO 3166-2 codes per app state code (old and new codes both seen in OSM)
export const ISO_CODES = {
  TG: ['IN-TG', 'IN-TS'],
  CG: ['IN-CG', 'IN-CT'],
  UK: ['IN-UK', 'IN-UT'],
  OD: ['IN-OD', 'IN-OR'],
  DH: ['IN-DH', 'IN-DN', 'IN-DD'],
};
export const isoCodesOf = code => ISO_CODES[code] || [`IN-${code}`];

// State names as OSM / Nominatim / the AI write them (normalised: lowercase letters only)
const STATE_NAMES = {
  AP: ['andhra pradesh'],
  AR: ['arunachal pradesh'],
  AS: ['assam'],
  BR: ['bihar'],
  CG: ['chhattisgarh', 'chattisgarh'],
  GA: ['goa'],
  GJ: ['gujarat'],
  HR: ['haryana'],
  HP: ['himachal pradesh'],
  JH: ['jharkhand'],
  KA: ['karnataka'],
  KL: ['kerala'],
  MP: ['madhya pradesh'],
  MH: ['maharashtra'],
  MN: ['manipur'],
  ML: ['meghalaya'],
  MZ: ['mizoram'],
  NL: ['nagaland'],
  OD: ['odisha', 'orissa'],
  PB: ['punjab'],
  RJ: ['rajasthan'],
  SK: ['sikkim'],
  TN: ['tamil nadu', 'tamilnadu'],
  TG: ['telangana'],
  TR: ['tripura'],
  UP: ['uttar pradesh'],
  UK: ['uttarakhand', 'uttaranchal'],
  WB: ['west bengal'],
  AN: ['andaman and nicobar islands', 'andaman and nicobar'],
  CH: ['chandigarh'],
  DH: ['dadra and nagar haveli and daman and diu', 'dadra and nagar haveli', 'daman and diu'],
  DL: ['delhi', 'nct of delhi', 'national capital territory of delhi'],
  JK: ['jammu and kashmir'],
  LA: ['ladakh'],
  LD: ['lakshadweep'],
  PY: ['puducherry', 'pondicherry'],
};
const norm = v =>
  String(v || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z]+/g, '');
const NORM_NAMES = Object.fromEntries(Object.entries(STATE_NAMES).map(([c, ns]) => [c, ns.map(norm)]));

/** App state code of a state name ("Karnataka" -> KA), or '' (pure). */
export function stateCodeOfName(name) {
  const n = norm(name);
  if (!n) return '';
  const hit = Object.entries(NORM_NAMES).find(([, ns]) => ns.includes(n));
  return hit ? hit[0] : '';
}

// Whole-word state names in free text, longest first ("Andhra Pradesh" before "Pradesh"-less ones)
const TEXT_NAMES = Object.entries(STATE_NAMES)
  .flatMap(([c, ns]) => ns.map(n => [c, n]))
  .sort((a, b) => b[1].length - a[1].length);
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TEXT_RES = TEXT_NAMES.map(([c, n]) => [c, new RegExp(`(^|[^a-z])${reEsc(n).replace(/ /g, '[\\s-]*')}([^a-z]|$)`, 'i')]);

/** State codes named in an address text (pure). "Delhi Road" style street names count too; see inState. */
export function statesInText(text) {
  let t = ` ${String(text || '').toLowerCase().replace(/&/g, ' and ')} `;
  const out = new Set();
  TEXT_RES.forEach(([c, re]) => {
    if (re.test(t)) {
      out.add(c);
      t = t.replace(re, ' '); // "Andhra Pradesh" must not also count as another "... Pradesh"
    }
  });
  return [...out];
}

/** 6-digit Indian PIN codes in a text (pure). "Tamil Nadu 562107" -> ['562107'] */
export const pinsInText = text => (String(text || '').match(/(?<!\d)[1-9]\d{2}\s?\d{3}(?!\d)/g) || []).map(p => p.replace(/\s/g, ''));

/** Can this PIN be in the state? Unknown state code = no opinion (true). (pure) */
export function pinInState(pin, code) {
  const p = String(pin || '').replace(/\s/g, '');
  const list = PIN_PREFIXES[code];
  if (!/^[1-9]\d{5}$/.test(p) || !list) return true;
  return list.includes(Number(p.slice(0, 3)));
}

/**
 * true when nothing about the row says it is outside the state (pure). row: { state, iso, postcode,
 * address, name } (all optional). A row that names this state in its address keeps a stray other
 * state name ("... Delhi Road, ..., Andhra Pradesh"); a PIN outside the state always drops it.
 */
export function inState(row, code) {
  if (!code || !NORM_NAMES[code]) return true;
  const r = row || {};
  const iso = String(r.iso || '').toUpperCase();
  if (iso && /^IN-[A-Z]{2}$/.test(iso) && !isoCodesOf(code).includes(iso)) return false;
  const st = norm(r.state);
  if (st && !NORM_NAMES[code].includes(st)) {
    const other = stateCodeOfName(r.state);
    if (other && other !== code) return false;
  }
  const pins = [r.postcode, ...pinsInText(r.address)].filter(Boolean);
  if (pins.some(p => !pinInState(p, code))) return false;
  const named = statesInText(r.address);
  if (named.length && !named.includes(code)) return false;
  return true;
}

/** A stored hospital (cleanHosp shape: name, address, district ...) inside the state? (pure) */
export const storedInState = (h, code) => inState({ address: [h && h.address, h && h.district].filter(Boolean).join(', ') }, code);

/**
 * A stored hospital row read back from D1 (or about to be saved), filtered to the state (pure).
 * i18n: { lang: translated copy } aligned BY POSITION with data.hospitals: the same rows are
 * dropped from each copy (a copy of another length is left alone; the app falls back to English).
 * -> { data, i18n, dropped }
 */
export function scopeHospRow(data, i18n, code) {
  if (!data || !Array.isArray(data.hospitals)) return { data, i18n, dropped: 0 };
  const keep = data.hospitals.map(h => storedInState(h, code));
  const dropped = keep.filter(k => !k).length;
  if (!dropped) return { data, i18n, dropped: 0 };
  const pick = arr => arr.filter((_, i) => keep[i]);
  const outI18n = {};
  Object.entries(i18n || {}).forEach(([lang, tr]) => {
    outI18n[lang] =
      tr && Array.isArray(tr.hospitals) && tr.hospitals.length === keep.length ? { ...tr, hospitals: pick(tr.hospitals) } : tr;
  });
  return { data: { ...data, hospitals: pick(data.hospitals) }, i18n: outI18n, dropped };
}

// ── names ──
const slugOf = v =>
  String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
// Spelling key: "Ananthapuramu" / "Anantapuram" / "Anantapur" -> "anantapur"
const LEVEL_WORDS = /\b(district|mandal|taluka?|tehsil|tahsil|block|circle|sub[- ]?division)\b/g;
export const spellKey = v =>
  String(v || '')
    .toLowerCase()
    .replace(LEVEL_WORDS, ' ')
    .replace(/[^a-z]/g, '')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/bh/g, 'b')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/(.)\1+/g, '$1')
    .replace(/(amu|am|mu|u)$/, '');

/** Same place name, spelt differently? ("Ananthapuramu" ~ "Anantapur" ~ "Anantapuramu District") (pure) */
export const sameName = (a, b) => {
  const x = spellKey(a);
  const y = spellKey(b);
  return !!x && x.length >= 4 && x === y;
};

/**
 * Overpass name regex for a district / mandal name: the name as given, without "th", with the
 * usual Telugu / Tamil endings (-u, -mu, -am) on or off, each with an optional level word.
 * "Ananthapuramu" -> ^(ananthapuramu|anantapuramu|ananthapur|anantapur|...)( district| mandal)?$ (pure)
 */
export function nameVariants(name) {
  const base = String(name || '')
    .toLowerCase()
    .replace(LEVEL_WORDS, ' ')
    .replace(/[^a-z .]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base) return [];
  const forms = new Set([base]);
  const noTh = base.replace(/th/g, 't');
  const stems = [base, noTh, noTh.replace(/t(?!h)/g, 'th')];
  stems.forEach(s => {
    forms.add(s);
    // Telugu / Tamil endings on or off (single-word names only: "Anantapur Urban" stays as it is)
    const root = s.replace(/(amu|am|mu|u)$/, '');
    if (!/ /.test(s) && root.length >= 4) ['', 'u', 'am', 'amu', 'mu'].forEach(e => forms.add(root + e));
  });
  return [...forms].filter(f => f.length >= 3).slice(0, 16);
}
export const nameRegex = name => {
  const v = nameVariants(name).map(x => reEsc(x).replace(/ /g, '[ -]?'));
  // optional " city" before the level word: the app's "Mumbai" is OSM's "Mumbai City District"
  return v.length ? `^(${v.join('|')})( city)?( (district|mandal|taluka?|tehsil|block|circle))?$` : '';
};

/**
 * The LGD district of the state (other than `picked`) that a Nominatim / OSM district name is,
 * spelt the same ("Mumbai Suburban District" when Mumbai was picked), or null (pure). A plain
 * substring check let Mumbai Suburban rows into the Mumbai (City) list.
 */
export function otherDistrictOf(stateCode, picked, districtName) {
  const st = LGD[stateCode];
  if (!st || !districtName) return null;
  const hit = Object.values(st.d).find(([, n]) => !sameName(n, picked) && sameName(n, districtName));
  return hit ? { code: hit[0], name: hit[1] } : null;
}

/**
 * LGD codes of a picked place (pure). state code, district / mandal slug or name ->
 * { state: lgd|null, district: { code, name }|null, mandal: { code, name }|null }. Unknown slugs
 * fall back to a spelling match ("anantapur" -> Ananthapuramu 502).
 */
export function lgdPlace(stateCode, district = '', mandal = '') {
  const st = LGD[stateCode];
  const out = { state: st ? st.lgd : null, district: null, mandal: null };
  if (!st || !district) return out;
  const dk = slugOf(district);
  let dEntry = st.d[dk] ? [dk, st.d[dk]] : null;
  if (!dEntry) dEntry = Object.entries(st.d).find(([, v]) => sameName(v[1], district)) || null;
  if (!dEntry) return out;
  const [, [dCode, dName, subs]] = dEntry;
  out.district = { code: dCode, name: dName };
  if (mandal) {
    const mk = slugOf(mandal);
    const hit = subs[mk] !== undefined ? [mk, subs[mk]] : Object.entries(subs).find(([k]) => sameName(k.replace(/-/g, ' '), mandal));
    if (hit) out.mandal = { code: hit[1], name: hit[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) };
  }
  return out;
}
