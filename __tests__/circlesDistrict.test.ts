// Circles > Discover / Nearby: district keys, geocode parsing, filtering and the in-app join rule.
import {
  canJoinWithoutCode,
  cleanDistrictName,
  districtFromGeocode,
  districtKey,
  filterDistrictCircles,
  filterNearbyCircles,
} from '../src/utils/district';
import { cityDistrict, findCity } from '../src/constants/indianCities';

const HYD = { lat: 17.385, lng: 78.4867 };
const NEAR = { lat: 17.4, lng: 78.5 }; // ~2 km
const FAR = { lat: 17.6, lng: 78.5 }; // ~24 km

const circles = [
  { id: 'a', isPrivate: false, districtKey: 'hyderabad', location: NEAR },
  { id: 'b', isPrivate: false, districtKey: 'rangareddy', location: HYD },
  { id: 'c', isPrivate: true, districtKey: 'hyderabad', location: HYD },
  { id: 'd', isPrivate: false, districtKey: null, location: null }, // legacy: no district, no location
  { id: 'e', isPrivate: false, districtKey: 'hyderabad', location: FAR },
];

describe('district keys', () => {
  it('normalizes spelling, "district" suffix and aliases', () => {
    expect(cleanDistrictName('Ranga Reddy District')).toBe('Ranga Reddy');
    expect(districtKey('Ranga Reddy District')).toBe(districtKey('Rangareddy'));
    expect(districtKey('Hanamkonda')).toBe(districtKey('Hanumakonda'));
    expect(districtKey('')).toBe('');
  });
  it('city table gives a district (override or city name)', () => {
    expect(cityDistrict(findCity('Secunderabad, Telangana')!)).toBe('Hyderabad');
    expect(cityDistrict(findCity('Warangal')!)).toBe('Warangal');
  });
  it('parses Nominatim and BigDataCloud responses', () => {
    expect(districtFromGeocode({ address: { state_district: 'Hyderabad District', state: 'Telangana' } })).toEqual({
      district: 'Hyderabad',
      districtKey: 'hyderabad',
      state: 'Telangana',
    });
    expect(
      districtFromGeocode({
        principalSubdivision: 'Telangana',
        localityInfo: { administrative: [{ adminLevel: 4, name: 'Telangana' }, { adminLevel: 5, name: 'Warangal' }] },
      })?.districtKey,
    ).toBe('warangal');
    expect(districtFromGeocode(null)).toBeNull();
  });
});

describe('filtering', () => {
  it('Discover: public circles of my district only (private + legacy excluded)', () => {
    expect(filterDistrictCircles(circles, 'Hyderabad').map(c => c.id)).toEqual(['a', 'e']);
    expect(filterDistrictCircles(circles, null)).toEqual([]);
  });
  it('Nearby: public located circles within 3 km, nearest first', () => {
    const out = filterNearbyCircles(circles, HYD.lat, HYD.lng, 3);
    expect(out.map(c => c.id)).toEqual(['b', 'a']);
    expect(out[1].distanceKm).toBeGreaterThan(1);
    expect(out[1].distanceKm).toBeLessThan(3);
  });
  it('join without code: my district or within 3 km; never private', () => {
    expect(canJoinWithoutCode(circles[4], { districtKey: 'hyderabad' }, 3)).toBe(true); // far, same district
    expect(canJoinWithoutCode(circles[1], { districtKey: 'hyderabad', coords: HYD }, 3)).toBe(true); // nearby
    expect(canJoinWithoutCode(circles[1], { districtKey: 'hyderabad', coords: FAR }, 3)).toBe(false);
    expect(canJoinWithoutCode(circles[2], { districtKey: 'hyderabad', coords: HYD }, 3)).toBe(false); // private
    expect(canJoinWithoutCode(circles[3], { districtKey: 'hyderabad', coords: HYD }, 3)).toBe(false); // legacy
  });
});
