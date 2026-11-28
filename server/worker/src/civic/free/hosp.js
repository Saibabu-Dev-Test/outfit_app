// Hospitals tab from FREE, keyless OpenStreetMap sources (no AI, no API key):
//   Fast path: Nominatim search (nominatim.openstreetmap.org, ODbL). One lookup for the district's
//     bounding box, then a few bounded searches ("hospital", "government hospital", "primary health
//     centre"), sequential with >= 1 s between requests (Nominatim usage policy: max 1 req/s,
//     identifying User-Agent, no bulk use; results are cached in D1 by the caller).
//   Slow upgrade (optional, not awaited on the fast path): Overpass API, every hospital / clinic /
//     health centre in the bounding box, first mirror that answers.
//   District / mandal (state.code given): Overpass AREA query on the exact OSM boundary, found by
//     its LGD code (ref:LGD:district / ref:LGD:subdistrict, free/scope.js lgdPlace) or, without a
//     code, by name variants inside the state ("Ananthapuramu" ~ "Anantapuramu District"). Nominatim
//     is the fallback when Overpass does not answer.
// Every row is kept inside the picked state (free/scope.js inState: addr:state / ISO code / PIN /
// address text): a bounding box reaches into the neighbours (AP's box holds Bengaluru and Hosur).
// Each item: { name, type: govt|private|unknown, address, phone, lat, lon, mapUrl, osmUrl, src }.
// Never throws: { ok, hospitals, bbox, place, src, error }.
import { firstOk, getJson, isoDay, sleep } from './http.js';
import { inState, isoCodesOf, lgdPlace, nameRegex, otherDistrictOf, spellKey, stateCodeOfName } from './scope.js';

export const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
export const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
// "municipal hospital": city-corporation hospitals (Mumbai's BMC / MCGM) rarely say "government"
export const HOSP_QUERIES = ['hospital', 'government hospital', 'municipal hospital', 'primary health centre'];
const OSM_SRC = 'OpenStreetMap (Nominatim)';

const nameOf = v => (v && typeof v === 'object' ? v.name || '' : String(v || ''));
// "kurnool" / "east-godavari" -> "Kurnool" / "East Godavari"
export const titleCase = s =>
  String(s || '')
    .replace(/-/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

export const mapUrlOf = (lat, lon) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
export const osmUrlOf = (type, id) => `https://www.openstreetmap.org/${type}/${id}`;

const GOVT_RE =
  /\b(government|goverment|govermment|govt\.?|gov\.?|ggh|phc|chc|uphc|cphc|area hospital|district hospital|general hospital|primary health|community health|urban health|health (sub )?centre|sub[- ]?centre|esic?|esis|railway hospital|teaching hospital|medical college hospital|government medical college|aiims|civil hospital|taluk hospital|mandal hospital|cghs|apsrtc hospital|tsrtc hospital|police hospital|military hospital|naval hospital|army hospital|air force hospital|command hospital|base hospital|cantonment (general )?hospital|inhs)(?![a-z])/i;
// Municipal / city-corporation hospitals: Mumbai's BMC (MCGM) runs KEM, Sion (LTMG), Nair, Cooper and
// the "Municipal Maternity Homes"; OSM often tags them with no operator at all, only the name
// ("L.T.Muncipal Medical College and Sion Hospital", "Welkarwadi BMC Hospital"). Also railway
// (Central / Western Railway, "... Railway Hospital"), ESIS / ESIC and defence (INHS, Command Hospital).
const CIVIC_RE =
  /\b(municipal|muncipal|municiple|municipality|corporation hospital|nagar ?palika|nagar nigam|mahanagar ?palika|bmc|mcgm|ghmc|gvmc|bbmp|mcd|ndmc|kmc hospital|pmc hospital|central railway|western railway|southern railway|eastern railway|northern railway|south central railway|railway (general |divisional |central )?hospital|employees'? state insurance|cantonment board)(?![a-z])/i;
// Public hospitals that OSM usually maps with no operator tag and no "government" in the name
// (each is a state / municipal / central government hospital: names as mapped in OSM, checked
// against the hospital's own site or the state / municipal health department list).
const KNOWN_PUBLIC_RE =
  /\b(k\.? ?e\.? ?m\.? hospital|king edward memorial hospital|seth g\.? ?s\.? medical|j\.? ?j\.? hospital|sir j\.? ?j\.?|grant medical college|st\.? george('?s)? hospital|gokuldas tejpal|g\.? ?t\.? hospital|cama (and alb(l)?ess? )?hospital|cooper hospital|nair hospital|b\.? ?y\.? ?l\.? nair|sion hospital|lokmanya tilak (municipal )?(general )?hospital|rajawadi hospital|bhabha hospital|sassoon|osmania general|gandhi hospital|niloufer|nizam'?s institute of medical sciences|stanley (medical college|hospital)|kilpauk medical|rajiv gandhi government general|sskm|r\.? ?g\.? kar|nil ratan sircar|n\.? ?r\.? ?s\.? medical|calcutta medical college|safdarjung|ram manohar lohia|dr\.? rml|lok nayak|g\.? ?t\.? ?b\.? hospital|guru teg bahadur hospital|lady hardinge|victoria hospital|bowring|vani vilas|king george'?s medical|kgmu|balrampur hospital|sms hospital|sawai man singh|pmch|patna medical college|igims)(?![a-z])/i;
const PRIVATE_RE = /\b(pvt\.?|private|ltd\.?|llp)\b/i;
const OP_GOVT = /^(government|governmental|public|state|state_government|central_government|national|municipal|municipality|local_government|military|railway|esi|esic)$/;
const OP_PRIVATE = /^(private|private_non_profit|business|charity|ngo|religious|community|cooperative|trust)$/;
// operator / healthcare:operator values that name a public body ("Brihanmumbai Municipal Corporation",
// "Government of Maharashtra", "Indian Railways", "ESIC", "Indian Navy")
const OP_NAME_GOVT =
  /\b(municipal|corporation of|mahanagar|nagar ?(palika|nigam)|government|govt\.?|ministry|department of health|directorate of|state of|indian railways?|railway|esic|esis|employees'? state insurance|indian (army|navy|air force)|armed forces|defence|cantonment|bmc|mcgm|ghmc|bbmp|mcd|ndmc|nhm|national health mission)\b/i;

/**
 * govt | private | unknown from the OSM tags (operator:type, healthcare:operator:type,
 * ownership), the operator name (a municipal corporation / government / railways / ESIC / defence),
 * then the name / description text (pure: tested). 'unknown' = no tag and no govt / private word:
 * the app shows those under Private as "Likely private · ownership not confirmed", never as a
 * confirmed private hospital.
 */
export function classifyHospital(name, tags = {}) {
  const t = tags || {};
  const ops = [t['operator:type'], t['healthcare:operator:type'], t.ownership].map(v => String(v || '').toLowerCase().trim()).filter(Boolean);
  if (ops.some(op => OP_GOVT.test(op))) return 'govt';
  if (ops.some(op => OP_PRIVATE.test(op))) return 'private';
  const opName = [t.operator, t['healthcare:operator']].filter(Boolean).join(' ');
  if (opName && OP_NAME_GOVT.test(opName)) return 'govt';
  const text = [name, t.description, opName, t['name:en'], t.official_name].filter(Boolean).join(' ');
  if (GOVT_RE.test(text) || CIVIC_RE.test(text) || KNOWN_PUBLIC_RE.test(text)) return 'govt';
  if (PRIVATE_RE.test(text)) return 'private';
  return 'unknown';
}

const townOf = a => (a && (a.city || a.town || a.village || a.suburb || a.city_district || a.county)) || '';

/** Address line from Nominatim's addressdetails (pure). */
export function addressOf(a = {}, fallback = '') {
  if (!a || typeof a !== 'object') return '';
  const parts = [a.house_number, a.road, a.neighbourhood || a.suburb, a.village || a.town || a.city, a.state_district || a.county, a.state, a.postcode];
  const seen = new Set();
  const out = parts.map(x => String(x || '').trim()).filter(x => x && !seen.has(x) && seen.add(x));
  return out.length ? out.join(', ') : String(fallback || '');
}

const GENERIC = /^(hospital|government hospital|govt\.? hospital|primary health cent(re|er)|phc|chc|community health cent(re|er)|health cent(re|er)|clinic)$/i;

/** One Nominatim jsonv2 result -> hospital item, or null when it has no usable name (pure: tested). */
export function nominatimItem(x, today) {
  if (!x || !x.osm_type || !x.osm_id) return null;
  const tags = x.extratags || {};
  let name = String(x.name || (x.namedetails && x.namedetails.name) || '')
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, '');
  if (!name) return null;
  const town = townOf(x.address);
  // "Government Hospital" alone says nothing about where: add the town ("Government Hospital, Adoni")
  if (GENERIC.test(name)) {
    if (!town) return null;
    name = `${name.replace(/^\w/, c => c.toUpperCase())}, ${town}`;
  }
  const lat = Number(x.lat);
  const lon = Number(x.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const osmUrl = osmUrlOf(x.osm_type, x.osm_id);
  return {
    id: `${x.osm_type}/${x.osm_id}`,
    name,
    type: classifyHospital(name, tags),
    address: addressOf(x.address, x.display_name),
    phone: String(tags.phone || tags['contact:phone'] || tags['contact:mobile'] || '').trim(),
    website: String(tags.website || tags['contact:website'] || '').trim(),
    lat,
    lon,
    mapUrl: mapUrlOf(lat, lon),
    osmUrl,
    src: { name: OSM_SRC, url: osmUrl, date: today },
  };
}

const rankType = t => (t === 'govt' ? 0 : t === 'private' ? 1 : 2);
const codeOfState = state => (state && typeof state === 'object' && state.code ? state.code : stateCodeOfName(nameOf(state)));

/**
 * Sorted (govt, private, not stated; then by name) and capped PER SIDE: up to `max` govt and up to
 * `max` others. One global cap after a govt-first sort used to leave the Private list empty for a
 * whole state (Andhra Pradesh: 79 govt of 119 results -> top 60 all govt). (pure: tested)
 */
export function capBySide(items, max = 60) {
  const sorted = [...items].sort((a, b) => rankType(a.type) - rankType(b.type) || a.name.localeCompare(b.name));
  return [...sorted.filter(h => h.type === 'govt').slice(0, max), ...sorted.filter(h => h.type !== 'govt').slice(0, max)];
}

// "Anantapuramu District" ~ "Ananthapuramu"; "Nellore District" ~ "Sri Potti Sriramulu Nellore" (pure)
export const nameOverlap = (a, b) => {
  const x = spellKey(a);
  const y = spellKey(b);
  return !x || !y || x.includes(y) || y.includes(x);
};

/** One Nominatim result inside the state (state / ISO3166-2-lvl4 / PIN / address text)? (pure) */
export const nominatimInState = (x, code) => {
  const a = (x && x.address) || {};
  return inState({ state: a.state, iso: a['ISO3166-2-lvl4'], postcode: a.postcode, address: addressOf(a, x && x.display_name) }, code);
};

/**
 * Results of several searches -> one list, deduped by OSM id (pure: tested). Results outside the
 * state are dropped (free/scope.js inState; a state / district bounding box is a rectangle that
 * reaches into neighbours: "Hospital, Hyderabad" or Bengaluru in Andhra Pradesh). district (name):
 * a result whose Nominatim district (state_district) is another district is dropped too. Govt
 * first, then by name; capped per side.
 */
export function mergeHospitals(lists, today, max = 60, stateName = '', district = '') {
  const code = typeof stateName === 'object' ? codeOfState(stateName) : stateCodeOfName(stateName);
  const seen = new Map();
  lists.flat().forEach(x => {
    if (!x) return;
    if (code && !nominatimInState(x, code)) return;
    const sd = x.address && x.address.state_district;
    // another district: its name is not like the picked one, or it IS another LGD district of the
    // state ("Mumbai Suburban District" overlaps "Mumbai" as text, but is its own district)
    if (district && sd && (!nameOverlap(sd, district) || (code && otherDistrictOf(code, district, sd)))) return;
    const it = nominatimItem(x, today);
    if (it && !seen.has(it.id)) seen.set(it.id, it);
  });
  return capBySide([...seen.values()], max);
}

// Nominatim boundingbox ["south","north","west","east"] -> { south, north, west, east } numbers
export const bboxOf = bb => {
  if (!Array.isArray(bb) || bb.length !== 4) return null;
  const [south, north, west, east] = bb.map(Number);
  return [south, north, west, east].every(Number.isFinite) ? { south, north, west, east } : null;
};
// Nominatim viewbox = left,top,right,bottom
export const viewboxOf = b => `${b.west},${b.north},${b.east},${b.south}`;

const nomUrl = params => `${NOMINATIM}?${new URLSearchParams({ format: 'jsonv2', ...params }).toString()}`;

/** Bounding box of the mandal (sub-district) / district / state via Nominatim (pure query list: tested). */
export const areaQueries = (stateName, districtName, mandalName = '') =>
  mandalName && districtName
    ? [`${mandalName}, ${districtName} district, ${stateName}, India`, `${mandalName}, ${districtName}, ${stateName}, India`]
    : districtName
      ? [`${districtName} district, ${stateName}, India`, `${districtName}, ${stateName}, India`]
      : [`${stateName}, India`];

export async function lookupArea(stateName, districtName, opts, mandalName = '') {
  const { fetchImpl, timeoutMs, gapMs, sleepImpl } = opts;
  const tries = areaQueries(stateName, districtName, mandalName);
  for (let i = 0; i < tries.length; i += 1) {
    if (i > 0) await sleepImpl(gapMs);
    const r = await getJson(nomUrl({ q: tries[i], limit: '3', countrycodes: 'in' }), { fetchImpl, timeoutMs });
    // no answer at all (network / timeout): Nominatim is unreachable, do not keep asking
    if (!r.ok && !r.status) return { ok: false, error: r.error || 'nominatim unreachable', unreachable: true, requests: i + 1 };
    if (!r.ok || !Array.isArray(r.data)) continue;
    // an area only: a boundary (else a place). Never a landuse / amenity that shares the name
    // ("Ananthapuramu district" once matched "Ananthapuramu Ultra Mega Solar Park": a 5 km box)
    const hit = r.data.find(x => x && x.category === 'boundary') || r.data.find(x => x && x.category === 'place');
    const bbox = hit ? bboxOf(hit.boundingbox) : null;
    if (bbox) return { ok: true, bbox, label: hit.display_name || tries[i], requests: i + 1 };
  }
  return { ok: false, error: 'area not found', requests: tries.length };
}

/**
 * Hospitals of a district (fast path, Nominatim only). state: { name } or a state name; district:
 * slug or name (optional). opts: fetchImpl, now, timeoutMs (per request), gapMs (between
 * requests, >= 1000 for the public Nominatim), sleepImpl, queries, max, mandal (sub-district slug or
 * name: the search is bounded to the mandal's area, looked up as "<mandal>, <district> district,
 * <state>"; no area found = "hospital in <mandal>, <district>, <state>").
 */
export async function fetchHospFree(state, district, opts = {}) {
  const {
    fetchImpl = fetch,
    now = Date.now(),
    timeoutMs = 6000,
    gapMs = 1100,
    sleepImpl = sleep,
    queries = HOSP_QUERIES,
    max = 60,
    bbox = null, // cached district bbox (civic_geo): skips the area lookup
    mandal = '',
    // Overpass area query on the exact boundary first (district / mandal of a state with a code)
    areaFirst = !!(state && typeof state === 'object' && state.code && district),
    areaTimeoutMs = 20000,
    mirrors = OVERPASS_MIRRORS,
  } = opts;
  const today = isoDay(now);
  const stateName = nameOf(state).trim();
  if (!stateName) return { ok: false, hospitals: [], error: 'no state' };
  const districtName = titleCase(district);
  const mandalName = districtName ? titleCase(mandal) : '';
  const o = { fetchImpl, timeoutMs, gapMs, sleepImpl };
  const place = [mandalName, districtName, stateName].filter(Boolean).join(', ');
  let areaBox = null;
  if (areaFirst) {
    const a = await fetchHospArea(state, district, mandal, { fetchImpl, now, timeoutMs: areaTimeoutMs, mirrors, max });
    if (a.ok) return { ok: true, hospitals: a.hospitals, bbox: a.bbox, place, src: a.src, boundary: a.boundary, errors: [] };
    // the boundary is mapped and holds no hospital: a wider level answers (no Nominatim guess)
    if (a.boundary) return { ok: false, hospitals: [], bbox: a.bbox, place, boundary: a.boundary, error: 'no hospitals found' };
    areaBox = a.bbox || null;
  }
  const area = bbox || areaBox ? { ok: true, bbox: bbox || areaBox, requests: 0 } : await lookupArea(stateName, districtName, o, mandalName);
  if (area.unreachable) return { ok: false, hospitals: [], bbox: null, place, error: area.error };
  const lists = [];
  const errors = [];
  let made = area.requests > 0;
  for (const q of queries) {
    if (made) await sleepImpl(gapMs); // 1 req/s, sequential (no wait before the very first request)
    made = true;
    const params = { q, addressdetails: '1', extratags: '1', limit: '40', countrycodes: 'in' };
    if (area.ok) Object.assign(params, { viewbox: viewboxOf(area.bbox), bounded: '1' });
    else params.q = `${q} in ${place}`;
    const r = await getJson(nomUrl(params), { fetchImpl, timeoutMs });
    if (r.ok && Array.isArray(r.data)) lists.push(r.data);
    else errors.push(`${q}: ${r.error || 'bad response'}`);
  }
  // strict: inside the state, and (district level) inside the district by Nominatim's own district
  const lg = lgdPlace(codeOfState(state), district, '');
  const hospitals = mergeHospitals(lists, today, max, { code: codeOfState(state), name: stateName }, districtName && !mandalName ? (lg.district && lg.district.name) || districtName : '');
  const src = { name: OSM_SRC, url: 'https://www.openstreetmap.org/copyright', date: today };
  if (!hospitals.length) return { ok: false, hospitals: [], bbox: area.ok ? area.bbox : null, place, src, error: errors[0] || area.error || 'no hospitals found' };
  return { ok: true, hospitals, bbox: area.ok ? area.bbox : null, place, src, errors };
}

// Overpass QL: hospitals / clinics / health centres in the bbox (south,west,north,east). Legacy:
// only for a caller with no state code; a bbox always needs the state filter after it.
export const overpassQuery = b =>
  `[out:json][timeout:25];(nwr["amenity"="hospital"](${b.south},${b.west},${b.north},${b.east});nwr["healthcare"~"^(hospital|centre)$"](${b.south},${b.west},${b.north},${b.east});wr["landuse"~"^hospital",i]["name"](${b.south},${b.west},${b.north},${b.east}););out center tags 1500;`;

// Also the named hospital GROUNDS (landuse=hospital, also mistyped "hospital Grounds"): some big
// public hospitals are mapped only as their campus (Mumbai's "King Edward Memorial Hospital" = KEM:
// way 113561413, landuse="hospital Grounds", no amenity).
// Duplicates (the campus + the building, a node + a way) are merged by dedupeNearby. Cap 1500: a
// metro district holds 300+ rows (300 used to cut the list at an arbitrary point).
export const HOSP_IN_AREA =
  '(nwr["amenity"="hospital"](area.a);nwr["healthcare"~"^(hospital|centre)$"](area.a);wr["landuse"~"^hospital",i]["name"](area.a););out center tags 1500;';
const qv = v => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
// exact tag values (an indexed lookup; a regex on ISO3166-2 scans every boundary and times out)
const stateRel = code => `(${isoCodesOf(code).map(c => `rel["ISO3166-2"="${c}"]["admin_level"="4"]["boundary"="administrative"];`).join('')})`;

/**
 * Overpass QL for the hospitals INSIDE one boundary (pure: tested). The boundary relation(s) are
 * printed first with their bounds (`.b out tags bb`), then every hospital / health centre whose
 * point lies in the boundary (`map_to_area`): never a bounding box, so nothing from a neighbour.
 *   state:     rel admin_level 4 with the state's ISO 3166-2 code
 *   district:  rel ref:LGD:district = code, else admin_level 5 / 6 / 8 named like the district inside
 *              the state (a city district is sometimes mapped only as the city: level 6 / 8)
 *   mandal:    rel ref:LGD:subdistrict = code, else admin_level 6 named like the mandal inside the district
 * where = { code, district: { code?, name }?, mandal: { code?, name }? }. '' when nothing to ask.
 */
export function overpassAreaQuery(where) {
  const w = where || {};
  if (!w.code) return '';
  const st = stateRel(w.code);
  const dist = d =>
    d.code ? `rel["boundary"="administrative"]["ref:LGD:district"="${Number(d.code)}"]` : `rel(area.st)["boundary"="administrative"]["admin_level"~"^(5|6|8)$"]["name"~"${qv(nameRegex(d.name))}",i]`;
  const sub = m =>
    m.code ? `rel["boundary"="administrative"]["ref:LGD:subdistrict"="${Number(m.code)}"]` : `rel(area.d)["boundary"="administrative"]["admin_level"="6"]["name"~"${qv(nameRegex(m.name))}",i]`;
  const parts = [`[out:json][timeout:${w.district ? 60 : 90}];`];
  const needSt = !!(w.district && !w.district.code);
  if (needSt) parts.push(`${st}->.s;.s map_to_area->.st;`);
  if (w.mandal && w.district) {
    if (!w.mandal.code) parts.push(`${dist(w.district)}->.dr;.dr map_to_area->.d;`);
    parts.push(`${sub(w.mandal)}->.b;`);
  } else if (w.district) {
    parts.push(`${dist(w.district)}->.b;`);
  } else {
    parts.push(`${st}->.b;`);
  }
  parts.push('.b out tags bb;.b map_to_area->.a;', HOSP_IN_AREA);
  return parts.join('');
}

/** Overpass element -> hospital item, or null (pure: tested). */
export function overpassItem(el, today) {
  if (!el || !el.type || !el.id) return null;
  const tags = el.tags || {};
  const name = String(tags.name || tags['name:en'] || '').trim();
  const lat = Number(el.lat !== undefined ? el.lat : el.center && el.center.lat);
  const lon = Number(el.lon !== undefined ? el.lon : el.center && el.center.lon);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const town = tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || '';
  // "Government Hospital" alone says nothing about where: add the town (else the suburb / district)
  const where = town || tags['addr:suburb'] || tags['addr:district'] || '';
  const fullName = GENERIC.test(name) ? (where ? `${name}, ${where}` : '') : name;
  if (!fullName) return null;
  const osmUrl = osmUrlOf(el.type, el.id);
  // addr:full is often only a door number ("11-106-1"): the rest of the address is added after it
  // (district / state / PIN as tagged: what the state check and the user read)
  const addr = [tags['addr:full'], tags['addr:housenumber'], tags['addr:place'], tags['addr:street'], tags['addr:suburb'], town, tags['addr:district'], tags['addr:state'], tags['addr:postcode']]
    .map(x => String(x || '').trim())
    .reduce((out, x) => (x && !out.some(y => y.toLowerCase().split(/,\s*/).includes(x.toLowerCase())) ? [...out, x] : out), [])
    .join(', ');
  return {
    id: `${el.type}/${el.id}`,
    name: fullName,
    type: classifyHospital(fullName, tags),
    address: addr,
    phone: String(tags.phone || tags['contact:phone'] || tags['contact:mobile'] || '').trim(),
    website: String(tags.website || tags['contact:website'] || '').trim(),
    lat,
    lon,
    mapUrl: mapUrlOf(lat, lon),
    osmUrl,
    src: { name: 'OpenStreetMap (Overpass)', url: osmUrl, date: today },
  };
}

/** One Overpass element inside the state (addr:state / is_in:state / addr:postcode / address)? (pure) */
export const overpassInState = (el, item, code) => {
  const t = (el && el.tags) || {};
  return inState({ state: t['addr:state'] || t['is_in:state'], postcode: t['addr:postcode'], address: [item && item.address, t['addr:district']].filter(Boolean).join(', ') }, code);
};

const BOUNDARY_TAGS = el => el && el.type === 'relation' && el.tags && el.tags.boundary === 'administrative' && el.bounds;
const bboxOfBounds = b => (b && [b.minlat, b.maxlat, b.minlon, b.maxlon].every(Number.isFinite) ? { south: b.minlat, north: b.maxlat, west: b.minlon, east: b.maxlon } : null);

/** Overpass answer of overpassAreaQuery -> { boundary, bbox, hospitals } inside the state (pure: tested). */
export function parseAreaAnswer(data, code, today, max = 200) {
  const els = (data && Array.isArray(data.elements) && data.elements) || [];
  const rels = els.filter(BOUNDARY_TAGS);
  const rel = rels[0] || null;
  const boundary = rel ? { id: rel.id, name: rel.tags.name || '', level: rel.tags.admin_level || '', lgd: rel.tags['ref:LGD:subdistrict'] || rel.tags['ref:LGD:district'] || '' } : null;
  const bbox = rel ? bboxOfBounds(rel.bounds) : null;
  const seen = new Map();
  const grounds = new Set();
  els.forEach(el => {
    if (BOUNDARY_TAGS(el)) return;
    const it = overpassItem(el, today);
    if (it && !seen.has(it.id) && (!code || overpassInState(el, it, code))) {
      seen.set(it.id, it);
      const t = el.tags || {};
      if (/^hospital/i.test(String(t.landuse || '')) && t.amenity !== 'hospital' && !t.healthcare) grounds.add(it.id);
    }
  });
  return { boundary, bbox, hospitals: capBySide(dedupeNearby([...seen.values()], grounds), max) };
}

// "Sion Hospital" mapped twice (a node and the building), or the campus (landuse=hospital) and the
// hospital inside it: one row. Same name key within ~600 m; the hospital itself (not the grounds)
// and the row with more details (phone / address) is kept, and its ownership is the stronger of
// the two ('govt' / 'private' over 'unknown'). (pure: tested)
const dupKey = n =>
  String(n || '')
    .toLowerCase()
    .replace(/\b(hospital|hospitals|the|and|&|of|memorial|mumbai|ltd|pvt)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');
const near = (a, b) => Math.abs(a.lat - b.lat) < 0.0055 && Math.abs(a.lon - b.lon) < 0.0055;
const detail = (h, grounds) => (grounds.has(h.id) ? 0 : 4) + (h.phone ? 1 : 0) + (h.address ? 1 : 0) + (h.website ? 1 : 0);
export function dedupeNearby(items, grounds = new Set()) {
  const out = [];
  items.forEach(h => {
    const k = dupKey(h.name);
    const i = k.length >= 3 ? out.findIndex(o => dupKey(o.name) === k && near(o, h)) : -1;
    if (i < 0) {
      out.push(h);
      return;
    }
    const o = out[i];
    const keep = detail(h, grounds) > detail(o, grounds) ? h : o;
    const other = keep === h ? o : h;
    out[i] = keep.type === 'unknown' && other.type !== 'unknown' ? { ...keep, type: other.type } : keep;
  });
  return out;
}

/**
 * Hospitals inside the exact OSM boundary of a state / district / mandal (Overpass area query,
 * first mirror that answers). state: { code, name }. district / mandal: slugs or names. The LGD
 * codes come from lgdPlace (the app's LGD picker data). Never throws:
 * { ok, hospitals, bbox, boundary, mirror, src, error } (boundary null = no such boundary in OSM).
 */
export async function fetchHospArea(state, district, mandal, opts = {}) {
  const { fetchImpl = fetch, now = Date.now(), timeoutMs = 25000, mirrors = OVERPASS_MIRRORS, max = 200 } = opts;
  const code = codeOfState(state);
  const today = isoDay(now);
  if (!code) return { ok: false, hospitals: [], boundary: null, error: 'no state code' };
  const lg = lgdPlace(code, district, mandal);
  const dName = (lg.district && lg.district.name) || titleCase(district);
  const where = { code };
  if (district) where.district = lg.district ? { code: lg.district.code, name: dName } : { name: dName };
  if (district && mandal) where.mandal = lg.mandal ? { code: lg.mandal.code, name: lg.mandal.name } : { name: titleCase(mandal) };
  const ask = w =>
    firstOk(mirrors, {
      fetchImpl,
      timeoutMs,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassAreaQuery(w))}`,
    });
  let r = await ask(where);
  if (!r.ok || !r.data || !Array.isArray(r.data.elements)) return { ok: false, hospitals: [], boundary: null, error: r.error || 'overpass unavailable', unreachable: true };
  let p = parseAreaAnswer(r.data, code, today, max);
  const leaf = where.mandal || where.district;
  if (!p.boundary && leaf && leaf.code) {
    // no boundary carries that LGD code in OSM: once more by name (variants) inside the parent
    const byName = { ...where, ...(where.mandal ? { mandal: { name: where.mandal.name } } : { district: { name: where.district.name } }) };
    const r2 = await ask(byName);
    if (r2.ok && r2.data && Array.isArray(r2.data.elements)) {
      r = r2;
      p = parseAreaAnswer(r2.data, code, today, max);
    }
  }
  const src = { name: 'OpenStreetMap (Overpass)', url: 'https://www.openstreetmap.org/copyright', date: today };
  if (!p.boundary) return { ok: false, hospitals: [], boundary: null, bbox: null, mirror: r.url, error: 'boundary not found' };
  return { ok: p.hospitals.length > 0, hospitals: p.hospitals, bbox: p.bbox, boundary: p.boundary, mirror: r.url, src, ...(p.hospitals.length ? {} : { error: 'no hospitals found' }) };
}

/**
 * Slow upgrade: every hospital / health centre in the bbox from Overpass (first mirror that
 * answers). Pass the bbox from fetchHospFree, or state + district to look it up. Not for the
 * request path: run it in waitUntil / cron and merge into the cached list.
 */
export async function fetchHospOverpass(state, district, opts = {}) {
  const { fetchImpl = fetch, now = Date.now(), timeoutMs = 30000, gapMs = 1100, sleepImpl = sleep, mirrors = OVERPASS_MIRRORS, max = 200 } = opts;
  const today = isoDay(now);
  const code = codeOfState(state);
  if (state && typeof state === 'object' && state.code) {
    // exact boundary (state / district / mandal), never a box
    const a = await fetchHospArea(state, district, district ? opts.mandal || '' : '', { fetchImpl, now, timeoutMs, mirrors, max });
    return { ...a, bbox: a.bbox || opts.bbox || null };
  }
  let bbox = opts.bbox || null;
  if (!bbox) {
    const area = await lookupArea(nameOf(state).trim(), titleCase(district), { fetchImpl, timeoutMs: Math.min(timeoutMs, 8000), gapMs, sleepImpl }, district ? titleCase(opts.mandal || '') : '');
    if (!area.ok) return { ok: false, hospitals: [], error: area.error };
    bbox = area.bbox;
  }
  const r = await firstOk(mirrors, {
    fetchImpl,
    timeoutMs,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(overpassQuery(bbox))}`,
  });
  if (!r.ok || !r.data || !Array.isArray(r.data.elements)) return { ok: false, hospitals: [], bbox, error: r.error || 'overpass unavailable' };
  // a box reaches into the neighbours: keep only rows inside the state
  const p = parseAreaAnswer(r.data, code, today, max);
  const hospitals = p.hospitals;
  return { ok: hospitals.length > 0, hospitals, bbox, mirror: r.url, src: { name: 'OpenStreetMap (Overpass)', url: 'https://www.openstreetmap.org/copyright', date: today }, ...(hospitals.length ? {} : { error: 'no hospitals found' }) };
}
