// Districts for Circles > Discover (public circles of the user's own district) and the in-app join
// checks (same district, or within NEARBY_KM of a located public circle). Pure helpers, no SDK.
import { haversineKm } from './geo';

export interface DistrictInfo {
  district: string; // display name, e.g. 'Ranga Reddy'
  districtKey: string; // match key, e.g. 'rangareddy' (circles are queried on this)
  state: string | null;
}

// Common alternate spellings -> one key (old city names, Nominatim vs. official spellings)
const KEY_ALIASES: Record<string, string> = {
  hanamkonda: 'hanumakonda',
  warangalurban: 'hanumakonda',
  warangalrural: 'warangal',
  bangalore: 'bengaluruurban',
  bangaloreurban: 'bengaluruurban',
  bengaluru: 'bengaluruurban',
  bangalorerural: 'bengalururural',
  gurgaon: 'gurugram',
  bombay: 'mumbai',
  mumbaicity: 'mumbai',
  mumbaisuburban: 'mumbai',
  calcutta: 'kolkata',
  madras: 'chennai',
  rajahmundry: 'eastgodavari',
  rajamahendravaram: 'eastgodavari',
  vizag: 'visakhapatnam',
  ysr: 'kadapa',
  ysrkadapa: 'kadapa',
  cuddapah: 'kadapa',
  noida: 'gautambuddhanagar',
  sripottisriramulunellore: 'nellore',
  nelloredistrict: 'nellore',
};

// 'Ranga Reddy District' -> 'Ranga Reddy' (display)
export const cleanDistrictName = (name?: string | null): string =>
  String(name || '')
    .replace(/\s+/g, ' ')
    .replace(/\b(district|dist\.?|zilla|jilla)$/i, '')
    .replace(/[,\s]+$/, '')
    .trim()
    .slice(0, 60);

// Match key: lower case letters only ('Ranga Reddy' == 'Rangareddy'), aliases folded
export const districtKey = (name?: string | null): string => {
  const k = cleanDistrictName(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z]/g, '');
  return KEY_ALIASES[k] || k;
};

export const makeDistrict = (name?: string | null, state?: string | null): DistrictInfo | null => {
  const district = cleanDistrictName(name);
  const key = districtKey(district);
  return key ? { district, districtKey: key, state: (state || '').trim() || null } : null;
};

// District from a Nominatim (address.state_district / county / city ...) or BigDataCloud
// (localityInfo.administrative, adminLevel 5 = district in India) reverse-geocode response.
export const districtFromGeocode = (json: any): DistrictInfo | null => {
  if (!json || typeof json !== 'object') return null;
  const a = json.address;
  if (a && typeof a === 'object') {
    const name = a.state_district || a.county || a.district || a.city_district || a.city || a.town;
    return makeDistrict(name, a.state);
  }
  const admin: any[] = Array.isArray(json?.localityInfo?.administrative) ? json.localityInfo.administrative : [];
  const lvl5 = admin.find(x => Number(x?.adminLevel) === 5 && x?.name);
  const name = lvl5?.name || json.city || json.locality;
  return makeDistrict(name, json.principalSubdivision);
};

// ── Filtering (Discover / Nearby / join checks) ────────────────────────────

export interface CircleGeoFields {
  id: string;
  isPrivate: boolean;
  districtKey?: string | null;
  location?: { lat: number; lng: number } | null;
  memberIds?: string[];
}

// Discover: public circles of this district (legacy circles without a district never match)
export const filterDistrictCircles = <T extends CircleGeoFields>(circles: T[], myDistrictKey?: string | null): T[] => {
  const k = districtKey(myDistrictKey);
  if (!k) return [];
  const seen = new Set<string>();
  return circles.filter(c => {
    if (seen.has(c.id) || c.isPrivate || !c.districtKey || districtKey(c.districtKey) !== k) return false;
    seen.add(c.id);
    return true;
  });
};

// Nearby: public, located circles within km of (lat, lng), nearest first, with distanceKm
export const filterNearbyCircles = <T extends CircleGeoFields>(
  circles: T[],
  lat: number,
  lng: number,
  km: number,
): (T & { distanceKm: number })[] => {
  const seen = new Set<string>();
  const out: (T & { distanceKm: number })[] = [];
  circles.forEach(c => {
    if (seen.has(c.id) || c.isPrivate || !c.location) return;
    seen.add(c.id);
    const d = haversineKm(lat, lng, c.location.lat, c.location.lng);
    if (d <= km) out.push({ ...c, distanceKm: d });
  });
  return out.sort((a, b) => a.distanceKm - b.distanceKm);
};

// In-app rule for joining without a code: public AND (my district OR within km of its location).
// Private circles: code / invite link only.
export const canJoinWithoutCode = (
  c: CircleGeoFields,
  me: { districtKey?: string | null; coords?: { lat: number; lng: number } | null },
  km: number,
): boolean => {
  if (c.isPrivate) return false;
  const mine = districtKey(me.districtKey);
  if (mine && c.districtKey && districtKey(c.districtKey) === mine) return true;
  if (c.location && me.coords) {
    return haversineKm(me.coords.lat, me.coords.lng, c.location.lat, c.location.lng) <= km;
  }
  return false;
};
