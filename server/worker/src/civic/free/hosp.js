// Hospitals tab from FREE, keyless OpenStreetMap sources (no AI, no API key):
//   Fast path: Nominatim search (nominatim.openstreetmap.org, ODbL). One lookup for the district's
//     bounding box, then a few bounded searches ("hospital", "government hospital", "primary health
//     centre"), sequential with >= 1 s between requests (Nominatim usage policy: max 1 req/s,
//     identifying User-Agent, no bulk use; results are cached in D1 by the caller).
//   Slow upgrade (optional, not awaited on the fast path): Overpass API, every hospital / clinic /
//     health centre in the bounding box, first mirror that answers.
// Each item: { name, type: govt|private|unknown, address, phone, lat, lon, mapUrl, osmUrl, src }.
// Never throws: { ok, hospitals, bbox, place, src, error }.
import { firstOk, getJson, isoDay, sleep } from './http.js';

export const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
export const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
export const HOSP_QUERIES = ['hospital', 'government hospital', 'primary health centre'];
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
  /\b(government|govt\.?|gov\.?|ggh|phc|chc|uphc|cphc|area hospital|district hospital|general hospital|primary health|community health|urban health|health (sub )?centre|sub[- ]?centre|esic?|railway hospital|teaching hospital|medical college hospital|government medical college|aiims|civil hospital|taluk hospital|mandal hospital|cghs|apsrtc hospital|tsrtc hospital|police hospital|military hospital|naval hospital|army hospital)(?![a-z])/i;
const PRIVATE_RE = /\b(pvt\.?|private|ltd\.?|llp)\b/i;
const OP_GOVT = /^(government|public|state|national|municipal|military)$/;
const OP_PRIVATE = /^(private|private_non_profit|business|charity|ngo|religious|community|cooperative)$/;

/**
 * govt | private | unknown from the OSM tags (operator:type, healthcare:operator:type,
 * ownership), then the name / description / operator text (pure: tested). 'unknown' = no tag and
 * no govt / private word: the app shows those under Private as "Likely private · ownership not
 * confirmed", never as a confirmed private hospital.
 */
export function classifyHospital(name, tags = {}) {
  const t = tags || {};
  const ops = [t['operator:type'], t['healthcare:operator:type'], t.ownership].map(v => String(v || '').toLowerCase().trim()).filter(Boolean);
  if (ops.some(op => OP_GOVT.test(op))) return 'govt';
  if (ops.some(op => OP_PRIVATE.test(op))) return 'private';
  const text = [name, t.description, t.operator, t['healthcare:operator']].filter(Boolean).join(' ');
  if (GOVT_RE.test(text)) return 'govt';
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
const normState = v =>
  String(v || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z]/g, '');

/**
 * Sorted (govt, private, not stated; then by name) and capped PER SIDE: up to `max` govt and up to
 * `max` others. One global cap after a govt-first sort used to leave the Private list empty for a
 * whole state (Andhra Pradesh: 79 govt of 119 results -> top 60 all govt). (pure: tested)
 */
export function capBySide(items, max = 60) {
  const sorted = [...items].sort((a, b) => rankType(a.type) - rankType(b.type) || a.name.localeCompare(b.name));
  return [...sorted.filter(h => h.type === 'govt').slice(0, max), ...sorted.filter(h => h.type !== 'govt').slice(0, max)];
}

/**
 * Results of several searches -> one list, deduped by OSM id (pure: tested). Results whose address
 * names another state are dropped (a state / district bounding box is a rectangle that reaches into
 * neighbours: "Hospital, Hyderabad" in Andhra Pradesh). Govt first, then by name; capped per side.
 */
export function mergeHospitals(lists, today, max = 60, stateName = '') {
  const want = normState(stateName);
  const seen = new Map();
  lists.flat().forEach(x => {
    const st = normState(x && x.address && x.address.state);
    if (want && st && st !== want) return;
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
    const hit = r.data.find(x => x && x.category === 'boundary') || r.data[0];
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
  } = opts;
  const today = isoDay(now);
  const stateName = nameOf(state).trim();
  if (!stateName) return { ok: false, hospitals: [], error: 'no state' };
  const districtName = titleCase(district);
  const mandalName = districtName ? titleCase(mandal) : '';
  const o = { fetchImpl, timeoutMs, gapMs, sleepImpl };
  const area = bbox ? { ok: true, bbox, requests: 0 } : await lookupArea(stateName, districtName, o, mandalName);
  const place = [mandalName, districtName, stateName].filter(Boolean).join(', ');
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
  const hospitals = mergeHospitals(lists, today, max, stateName);
  const src = { name: OSM_SRC, url: 'https://www.openstreetmap.org/copyright', date: today };
  if (!hospitals.length) return { ok: false, hospitals: [], bbox: area.ok ? area.bbox : null, place, src, error: errors[0] || area.error || 'no hospitals found' };
  return { ok: true, hospitals, bbox: area.ok ? area.bbox : null, place, src, errors };
}

// Overpass QL: hospitals / clinics / health centres in the bbox (south,west,north,east)
export const overpassQuery = b =>
  `[out:json][timeout:25];(nwr["amenity"="hospital"](${b.south},${b.west},${b.north},${b.east});nwr["healthcare"~"^(hospital|centre)$"](${b.south},${b.west},${b.north},${b.east}););out center tags 300;`;

/** Overpass element -> hospital item, or null (pure: tested). */
export function overpassItem(el, today) {
  if (!el || !el.type || !el.id) return null;
  const tags = el.tags || {};
  const name = String(tags.name || tags['name:en'] || '').trim();
  const lat = Number(el.lat !== undefined ? el.lat : el.center && el.center.lat);
  const lon = Number(el.lon !== undefined ? el.lon : el.center && el.center.lon);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const town = tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || '';
  const fullName = GENERIC.test(name) ? (town ? `${name}, ${town}` : '') : name;
  if (!fullName) return null;
  const osmUrl = osmUrlOf(el.type, el.id);
  const addr = [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], town, tags['addr:postcode']].filter(Boolean).join(', ');
  return {
    id: `${el.type}/${el.id}`,
    name: fullName,
    type: classifyHospital(fullName, tags),
    address: tags['addr:full'] || addr,
    phone: String(tags.phone || tags['contact:phone'] || tags['contact:mobile'] || '').trim(),
    website: String(tags.website || tags['contact:website'] || '').trim(),
    lat,
    lon,
    mapUrl: mapUrlOf(lat, lon),
    osmUrl,
    src: { name: 'OpenStreetMap (Overpass)', url: osmUrl, date: today },
  };
}

/**
 * Slow upgrade: every hospital / health centre in the bbox from Overpass (first mirror that
 * answers). Pass the bbox from fetchHospFree, or state + district to look it up. Not for the
 * request path: run it in waitUntil / cron and merge into the cached list.
 */
export async function fetchHospOverpass(state, district, opts = {}) {
  const { fetchImpl = fetch, now = Date.now(), timeoutMs = 30000, gapMs = 1100, sleepImpl = sleep, mirrors = OVERPASS_MIRRORS, max = 200 } = opts;
  const today = isoDay(now);
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
  const seen = new Map();
  r.data.elements.forEach(el => {
    const it = overpassItem(el, today);
    if (it && !seen.has(it.id)) seen.set(it.id, it);
  });
  const hospitals = capBySide([...seen.values()], max);
  return { ok: hospitals.length > 0, hospitals, bbox, mirror: r.url, src: { name: 'OpenStreetMap (Overpass)', url: 'https://www.openstreetmap.org/copyright', date: today }, ...(hospitals.length ? {} : { error: 'no hospitals found' }) };
}
