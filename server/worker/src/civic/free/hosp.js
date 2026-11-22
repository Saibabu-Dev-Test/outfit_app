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
  /\b(government|govt\.?|gov\.?|ggh|phc|chc|uphc|cphc|area hospital|district hospital|general hospital|primary health|community health|urban health|health (sub )?centre|sub[- ]?centre|esic?|railway hospital|teaching hospital|medical college hospital|aiims|civil hospital|taluk hospital|mandal hospital)(?![a-z])/i;
const PRIVATE_RE = /\b(pvt\.?|private|ltd\.?|llp)\b/i;

/** govt | private | unknown from the OSM tags (operator:type) or the name / description (pure: tested). */
export function classifyHospital(name, tags = {}) {
  const t = tags || {};
  const op = String(t['operator:type'] || '').toLowerCase();
  if (/^(government|public|state|national|municipal)$/.test(op)) return 'govt';
  if (/^(private|private_non_profit|business|charity|ngo|religious|community)$/.test(op)) return 'private';
  const text = [name, t.description, t.operator].filter(Boolean).join(' ');
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
  let name = String(x.name || (x.namedetails && x.namedetails.name) || '').trim();
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

/** Results of several searches -> one list, deduped by OSM id (pure: tested). Govt first, then by name. */
export function mergeHospitals(lists, today, max = 60) {
  const seen = new Map();
  lists.flat().forEach(x => {
    const it = nominatimItem(x, today);
    if (it && !seen.has(it.id)) seen.set(it.id, it);
  });
  const rank = t => (t === 'govt' ? 0 : t === 'private' ? 1 : 2);
  return [...seen.values()].sort((a, b) => rank(a.type) - rank(b.type) || a.name.localeCompare(b.name)).slice(0, max);
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

/** Bounding box of the district (or of the state when no district) via Nominatim. */
export async function lookupArea(stateName, districtName, opts) {
  const { fetchImpl, timeoutMs, gapMs, sleepImpl } = opts;
  const tries = districtName
    ? [`${districtName} district, ${stateName}, India`, `${districtName}, ${stateName}, India`]
    : [`${stateName}, India`];
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
 * requests, >= 1000 for the public Nominatim), sleepImpl, queries, max.
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
  } = opts;
  const today = isoDay(now);
  const stateName = nameOf(state).trim();
  if (!stateName) return { ok: false, hospitals: [], error: 'no state' };
  const districtName = titleCase(district);
  const o = { fetchImpl, timeoutMs, gapMs, sleepImpl };
  const area = bbox ? { ok: true, bbox, requests: 0 } : await lookupArea(stateName, districtName, o);
  const place = [districtName, stateName].filter(Boolean).join(', ');
  if (area.unreachable) return { ok: false, hospitals: [], bbox: null, place, error: area.error };
  const lists = [];
  const errors = [];
  let made = area.requests > 0;
  for (const q of queries) {
    if (made) await sleepImpl(gapMs); // 1 req/s, sequential (no wait before the very first request)
    made = true;
    const params = { q, addressdetails: '1', extratags: '1', limit: '40', countrycodes: 'in' };
    if (area.ok) Object.assign(params, { viewbox: viewboxOf(area.bbox), bounded: '1' });
    else params.q = `${q} in ${[districtName, stateName].filter(Boolean).join(', ')}`;
    const r = await getJson(nomUrl(params), { fetchImpl, timeoutMs });
    if (r.ok && Array.isArray(r.data)) lists.push(r.data);
    else errors.push(`${q}: ${r.error || 'bad response'}`);
  }
  const hospitals = mergeHospitals(lists, today, max);
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
    const area = await lookupArea(nameOf(state).trim(), titleCase(district), { fetchImpl, timeoutMs: Math.min(timeoutMs, 8000), gapMs, sleepImpl });
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
  const rank = t => (t === 'govt' ? 0 : t === 'private' ? 1 : 2);
  const hospitals = [...seen.values()].sort((a, b) => rank(a.type) - rank(b.type) || a.name.localeCompare(b.name)).slice(0, max);
  return { ok: hospitals.length > 0, hospitals, bbox, mirror: r.url, src: { name: 'OpenStreetMap (Overpass)', url: 'https://www.openstreetmap.org/copyright', date: today }, ...(hospitals.length ? {} : { error: 'no hospitals found' }) };
}
