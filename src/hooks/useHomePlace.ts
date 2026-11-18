// Place for the Home daily guide (weather card + Rahu kalam): the phone's approximate location when
// the user allows it, else Hyderabad. Location is read silently only when permission is already
// granted; the first time, the weather card asks politely (askNeeded) and the user taps Allow.
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApproxLocation, hasLocationPermission } from '../native/location';
import { HYDERABAD } from '../utils/astro';

const ASKED_KEY = 'outfitpref:homeWeatherLocAsked';
const LAST_KEY = 'outfitpref:homeWeatherLastCoords';

export interface HomePlace {
  lat: number;
  lng: number;
  source: 'device' | 'default';
}

export const DEFAULT_HOME_PLACE: HomePlace = {
  lat: HYDERABAD.lat,
  lng: HYDERABAD.lng,
  source: 'default',
};

export const useHomePlace = () => {
  const [place, setPlace] = useState<HomePlace>(DEFAULT_HOME_PLACE);
  const [askNeeded, setAskNeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const last = await AsyncStorage.getItem(LAST_KEY);
        if (last && alive.current) {
          const c = JSON.parse(last);
          if (Number.isFinite(c?.lat) && Number.isFinite(c?.lng))
            setPlace({ lat: c.lat, lng: c.lng, source: 'device' });
        }
      } catch {}
      if (await hasLocationPermission()) {
        const r = await getApproxLocation();
        if (r.ok && alive.current) {
          setPlace({ lat: r.coords.lat, lng: r.coords.lng, source: 'device' });
          AsyncStorage.setItem(LAST_KEY, JSON.stringify(r.coords)).catch(
            () => undefined,
          );
        }
        return;
      }
      const asked = await AsyncStorage.getItem(ASKED_KEY).catch(() => null);
      if (!asked && alive.current) setAskNeeded(true);
    })();
    return () => {
      alive.current = false;
    };
  }, []);

  // User tapped "Allow location" / "Use my location"
  const requestLocation = useCallback(
    async (rationale: {
      title: string;
      message: string;
      allow?: string;
      notNow?: string;
    }) => {
      setAskNeeded(false);
      AsyncStorage.setItem(ASKED_KEY, '1').catch(() => undefined);
      setBusy(true);
      try {
        const r = await getApproxLocation(rationale);
        if (r.ok && alive.current) {
          setPlace({ lat: r.coords.lat, lng: r.coords.lng, source: 'device' });
          AsyncStorage.setItem(LAST_KEY, JSON.stringify(r.coords)).catch(
            () => undefined,
          );
        }
        return r;
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [],
  );

  // User tapped "Not now": keep Hyderabad, don't ask again (a small "Use my location" link stays)
  const dismissAsk = useCallback(() => {
    setAskNeeded(false);
    AsyncStorage.setItem(ASKED_KEY, '1').catch(() => undefined);
  }, []);

  return { place, askNeeded, busy, requestLocation, dismissAsk };
};
