// Web: browser geolocation (low accuracy is enough; rounded to ~100 m before saving)
export interface LatLng {
  lat: number;
  lng: number;
}
export type LocationResult = { ok: true; coords: LatLng } | { ok: false; message: string };

export const getApproxLocation = (): Promise<LocationResult> =>
  new Promise(resolve => {
    const geo: any = (globalThis as any).navigator?.geolocation;
    if (!geo) {
      resolve({ ok: false, message: 'This browser can’t share your location.' });
      return;
    }
    geo.getCurrentPosition(
      (p: any) => resolve({ ok: true, coords: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      (e: any) =>
        resolve({
          ok: false,
          message: e?.code === 1 ? 'Allow location for this site to find circles near you.' : 'Could not get your location.',
        }),
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 10 * 60 * 1000 },
    );
  });
