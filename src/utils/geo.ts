// Geohash (base32) + distance helpers for "Nearby circles". No SDK, no paid API.
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export const encodeGeohash = (lat: number, lng: number, precision = 6): string => {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch = (ch << 1) | 1;
        lngMin = mid;
      } else {
        ch = ch << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch = (ch << 1) | 1;
        latMin = mid;
      } else {
        ch = ch << 1;
        latMax = mid;
      }
    }
    even = !even;
    if (++bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
};

// Cell size in degrees for a precision
const cellSize = (precision: number) => {
  const bits = precision * 5;
  const lngBits = Math.ceil(bits / 2);
  const latBits = Math.floor(bits / 2);
  return { dLat: 180 / 2 ** latBits, dLng: 360 / 2 ** lngBits };
};

// Geohash prefixes (at this precision) of every cell that touches the box of radiusKm around
// (lat, lng): the cell itself plus its neighbours (more columns near the poles / for big radii)
export const geohashNeighbours = (lat: number, lng: number, precision: number, radiusKm = 3): string[] => {
  const { dLat, dLng } = cellSize(precision);
  const kmLat = radiusKm / 111.32;
  const kmLng = radiusKm / (111.32 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  // Sample points every half cell across the box, always including both edges
  const span = (from: number, to: number, step: number): number[] => {
    const pts: number[] = [];
    for (let v = from; v < to; v += step) pts.push(v);
    pts.push(to);
    return pts;
  };
  const out = new Set<string>();
  for (const la of span(lat - kmLat, lat + kmLat, dLat / 2)) {
    for (const lo of span(lng - kmLng, lng + kmLng, dLng / 2)) {
      const cla = Math.max(-89.9999, Math.min(89.9999, la));
      let clo = lo;
      if (clo > 180) clo -= 360;
      if (clo < -180) clo += 360;
      out.add(encodeGeohash(cla, clo, precision));
    }
  }
  return [...out];
};

// Great-circle distance in km
export const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
};

// ~100 m: 3 decimal places (0.001° ≈ 111 m north-south)
export const roundCoord = (v: number): number => Math.round(v * 1000) / 1000;

export const mapsUrl = (lat: number, lng: number): string =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

// Android: geo: URI opens the user's maps app (with a label)
export const geoUri = (lat: number, lng: number, label: string): string =>
  `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`;
