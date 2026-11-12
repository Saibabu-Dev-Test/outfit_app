// My district (Circles > Discover, circle create, in-app join checks).
//   Location allowed: approximate location -> free reverse geocode (Nominatim, BigDataCloud as
//   fallback; no API key) -> saved on users/{uid} (district, districtKey, districtState, districtSource).
//   Location off: the district saved on the profile, else the district of the profile's city
//   (placeOfBirth, constants/indianCities.ts), else null (the screen asks the user to pick one).
import { getApproxLocation, hasLocationPermission, LatLng } from '../native/location';
import { getUserProfile, saveUserProfile } from './userApi';
import { findCity, cityDistrict } from '../constants/indianCities';
import { DistrictInfo, districtFromGeocode, makeDistrict } from '../utils/district';
import { roundCoord } from '../utils/geo';

export interface MyDistrict extends DistrictInfo {
  source: 'location' | 'picked' | 'profileCity';
}
export interface MyPlace {
  district: MyDistrict | null;
  coords: LatLng | null; // only when location is allowed and on
}

const UA = 'OutfitApp/1.0 (Android; circles district lookup)';
const geoCache = new Map<string, DistrictInfo | null>();

const fetchJson = async (url: string, headers: Record<string, string> = {}): Promise<any> => {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(() => ctrl?.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: ctrl?.signal as any });
    return r.ok ? await r.json() : null;
  } finally {
    clearTimeout(t);
  }
};

// Reverse geocode to a district (cached per ~1 km cell for this app session). null when unknown.
export const reverseGeocodeDistrict = async (lat: number, lng: number): Promise<DistrictInfo | null> => {
  const key = `${Math.round(lat * 100)},${Math.round(lng * 100)}`;
  if (geoCache.has(key)) return geoCache.get(key) || null;
  const la = roundCoord(lat);
  const lo = roundCoord(lng);
  let out: DistrictInfo | null = null;
  try {
    out = districtFromGeocode(
      await fetchJson(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${la}&lon=${lo}&zoom=10&addressdetails=1&accept-language=en`,
        { 'User-Agent': UA },
      ),
    );
  } catch (e: any) {
    console.warn('Nominatim reverse geocode failed:', e?.message);
  }
  if (!out) {
    try {
      out = districtFromGeocode(
        await fetchJson(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${la}&longitude=${lo}&localityLanguage=en`,
        ),
      );
    } catch (e: any) {
      console.warn('BigDataCloud reverse geocode failed:', e?.message);
    }
  }
  if (out) geoCache.set(key, out);
  return out;
};

// The profile's district: saved one, else its city's district
export const profileDistrict = (p: {
  district?: string;
  districtState?: string;
  districtSource?: string;
  placeOfBirth?: string;
}): MyDistrict | null => {
  const saved = makeDistrict(p.district, p.districtState);
  if (saved) return { ...saved, source: p.districtSource === 'location' ? 'location' : 'picked' };
  const city = findCity(p.placeOfBirth);
  const fromCity = city ? makeDistrict(cityDistrict(city), city.state) : null;
  return fromCity ? { ...fromCity, source: 'profileCity' } : null;
};

const saveDistrict = async (uid: string, d: DistrictInfo, source: 'location' | 'picked') => {
  await saveUserProfile(uid, {
    district: d.district,
    districtKey: d.districtKey,
    districtState: d.state || '',
    districtSource: source,
  });
};

// My district + coords. Never prompts for location unless askLocation (Nearby / create).
export const resolveMyPlace = async (uid: string, askLocation = false): Promise<MyPlace> => {
  const profile = await getUserProfile(uid);
  let coords: LatLng | null = null;
  if (askLocation || (await hasLocationPermission())) {
    const loc = await getApproxLocation();
    if (loc.ok) coords = loc.coords;
  }
  if (coords) {
    const d = await reverseGeocodeDistrict(coords.lat, coords.lng);
    if (d) {
      if (profile.districtKey !== d.districtKey || profile.districtSource !== 'location') {
        saveDistrict(uid, d, 'location').catch(e => console.warn('Saving district failed:', e?.message));
      }
      return { district: { ...d, source: 'location' }, coords };
    }
  }
  return { district: profileDistrict(profile), coords };
};

// User picked a district (or a city -> its district) while location is off
export const pickMyDistrict = async (uid: string, cityOrDistrictLabel: string): Promise<MyDistrict | null> => {
  const city = findCity(cityOrDistrictLabel);
  const d = city
    ? makeDistrict(cityDistrict(city), city.state)
    : makeDistrict(cityOrDistrictLabel.split(',')[0], cityOrDistrictLabel.split(',')[1]);
  if (!d) return null;
  await saveDistrict(uid, d, 'picked');
  return { ...d, source: 'picked' };
};
