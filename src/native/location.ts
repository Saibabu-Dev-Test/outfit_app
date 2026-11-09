// Approximate location for "Nearby circles" (Android: LocationModule.kt, coarse permission)
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

export interface LatLng {
  lat: number;
  lng: number;
}
export type LocationResult = { ok: true; coords: LatLng } | { ok: false; message: string };

const Native: { getApproxLocation?: () => Promise<{ lat: number; lng: number }> } | undefined =
  NativeModules.OutfitLocation;

// Asks the permission if needed, then reads an approximate fix. Never throws.
export const getApproxLocation = async (): Promise<LocationResult> => {
  if (Platform.OS !== 'android' || !Native?.getApproxLocation) {
    return { ok: false, message: 'Location needs the latest app.' };
  }
  try {
    const perm = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
    if (!(await PermissionsAndroid.check(perm))) {
      const r = await PermissionsAndroid.request(perm, {
        title: 'Find circles near you',
        message: 'Outfit uses your approximate location (about 100 m) to show public circles within 3 km.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      });
      if (r !== PermissionsAndroid.RESULTS.GRANTED) {
        return {
          ok: false,
          message:
            r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
              ? 'Location is blocked for Outfit. Allow it in Settings → Apps → Outfit → Permissions.'
              : 'Location permission is needed to find circles near you.',
        };
      }
    }
    const c = await Native.getApproxLocation();
    return { ok: true, coords: { lat: Number(c.lat), lng: Number(c.lng) } };
  } catch (e: any) {
    if (e?.code === 'LOCATION_OFF') return { ok: false, message: 'Turn on Location in your phone settings and try again.' };
    if (e?.code === 'NO_PERMISSION') return { ok: false, message: 'Location permission is needed to find circles near you.' };
    return { ok: false, message: e?.message || 'Could not get your location.' };
  }
};
