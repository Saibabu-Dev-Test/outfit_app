// AdMob (react-native-google-mobile-ads), guarded so ads can NEVER crash the app:
// - the library is required lazily inside try/catch (missing native module, web, old phone -> no ads)
// - every call resolves (false / null) instead of throwing; failures are only console.warn'ed
// - full-screen ads are paced by ADS in src/config/ads.ts (last-shown times kept in AsyncStorage)
// Formats: Rewarded + Rewarded interstitial (highest eCPM, only on the user's own tap or with a
// "No thanks" intro), Native (post-style feed cards), Interstitial (after posting, >= 5 min apart),
// App open (on return to the app, >= 4 h apart).
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ADS, AdFormat, adUnitId } from '../config/ads';

let lib: any | null | undefined;
// The library module, or null when ads are unavailable on this device / build
export const adsLib = (): any | null => {
  if (lib !== undefined) return lib;
  if (Platform.OS !== 'android') return (lib = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    lib = require('react-native-google-mobile-ads');
  } catch (e: any) {
    console.warn('Ads unavailable:', e?.message);
    lib = null;
  }
  return lib;
};

let initPromise: Promise<boolean> | null = null;
// Starts the Mobile Ads SDK once (in the background). Never throws.
export const initAds = (): Promise<boolean> => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const L = adsLib();
      if (!L) return false;
      const mobileAds = L.default || L.MobileAds;
      try {
        await mobileAds().setRequestConfiguration({
          // Fashion / astrology app for adults and teens: no mature ads
          maxAdContentRating: L.MaxAdContentRating?.PG ?? 'PG',
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        });
      } catch {}
      await mobileAds().initialize();
      return true;
    } catch (e: any) {
      console.warn('Ads init failed:', e?.message);
      return false;
    }
  })();
  return initPromise;
};

export const unitFor = (f: AdFormat): string | null => {
  try {
    return adsLib() ? adUnitId(f) : null;
  } catch {
    return null;
  }
};

// ── Pacing ──
const KEY = 'ads.lastShown.v1';
let last: Record<string, number> = {};
let lastLoaded = false;
let fullscreenOpen = false;
const loadLast = async () => {
  if (lastLoaded) return;
  lastLoaded = true;
  try {
    last = JSON.parse((await AsyncStorage.getItem(KEY)) || '{}') || {};
  } catch {
    last = {};
  }
};
const markShown = (kind: string) => {
  const now = Date.now();
  last[kind] = now;
  last.any = now;
  AsyncStorage.setItem(KEY, JSON.stringify(last)).catch(() => {});
};
const since = (kind: string) => Date.now() - (last[kind] || 0);
export const isFullscreenAdOpen = () => fullscreenOpen;

// Loads + shows one full-screen ad. resolve(true) when it was shown (and, for rewarded formats,
// the reward was earned). Times out after 12 s of loading.
const showFullscreen = (format: 'rewarded' | 'rewardedInterstitial' | 'interstitial' | 'appOpen'): Promise<boolean> =>
  new Promise(resolve => {
    let done = false;
    let earned = false;
    const subs: Array<() => void> = [];
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      fullscreenOpen = false;
      subs.forEach(u => {
        try {
          u();
        } catch {}
      });
      resolve(ok);
    };
    try {
      const L = adsLib();
      const unit = unitFor(format);
      if (!L || !unit || fullscreenOpen) return finish(false);
      const Cls =
        format === 'rewarded'
          ? L.RewardedAd
          : format === 'rewardedInterstitial'
          ? L.RewardedInterstitialAd
          : format === 'interstitial'
          ? L.InterstitialAd
          : L.AppOpenAd;
      const rewardedKind = format === 'rewarded' || format === 'rewardedInterstitial';
      const ad = Cls.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: false });
      const LOADED = rewardedKind ? L.RewardedAdEventType.LOADED : L.AdEventType.LOADED;
      const timer = setTimeout(() => finish(false), 12000);
      subs.push(() => clearTimeout(timer));
      subs.push(
        ad.addAdEventListener(LOADED, () => {
          clearTimeout(timer);
          try {
            fullscreenOpen = true;
            markShown(format);
            ad.show().catch(() => finish(false));
          } catch {
            finish(false);
          }
        }),
      );
      if (rewardedKind) {
        subs.push(ad.addAdEventListener(L.RewardedAdEventType.EARNED_REWARD, () => (earned = true)));
      }
      subs.push(ad.addAdEventListener(L.AdEventType.CLOSED, () => finish(rewardedKind ? earned : true)));
      subs.push(
        ad.addAdEventListener(L.AdEventType.ERROR, (e: any) => {
          console.warn(`Ad ${format} error:`, e?.message);
          finish(false);
        }),
      );
      initAds().then(() => {
        try {
          ad.load();
        } catch {
          finish(false);
        }
      });
    } catch (e: any) {
      console.warn(`Ad ${format} failed:`, e?.message);
      finish(false);
    }
  });

// User tapped "Watch ad for ...": true only when the reward was earned
export const showRewardedAd = async (): Promise<boolean> => {
  await loadLast();
  return showFullscreen('rewarded');
};

// Rewarded interstitial: call only after the intro (RewardedIntroModal) was not declined
export const showRewardedInterstitialAd = async (): Promise<boolean> => {
  await loadLast();
  const ok = await showFullscreen('rewardedInterstitial');
  // No fill: fall back to a normal rewarded ad so the user still gets the reward they chose
  return ok || showFullscreen('rewarded');
};

// After a natural break (e.g. a poll was posted). Silently skipped when paced out.
export const maybeShowInterstitial = async (): Promise<boolean> => {
  await loadLast();
  if (since('interstitial') < ADS.interstitialMinGapMs || since('any') < ADS.anyFullscreenGapMs) return false;
  return showFullscreen('interstitial');
};

// ── App open: on return to the app after >= 30 s away, at most once per 4 h ──
let appOpenStarted = false;
// Leaving for the camera / photo picker / Google sign-in is not "coming back to the app"
let suppressUntil = 0;
export const pauseAppOpenAds = (ms = 10 * 60 * 1000) => {
  suppressUntil = Date.now() + ms;
};
export const startAppOpenAds = () => {
  if (appOpenStarted) return;
  appOpenStarted = true;
  let wentAway = 0;
  try {
    AppState.addEventListener('change', async (s: AppStateStatus) => {
      try {
        if (s === 'background') {
          if (!fullscreenOpen) wentAway = Date.now();
          return;
        }
        if (s !== 'active' || !wentAway) return;
        const away = Date.now() - wentAway;
        wentAway = 0;
        if (away < ADS.appOpenMinAwayMs || fullscreenOpen) return;
        if (Date.now() < suppressUntil) {
          suppressUntil = 0;
          return;
        }
        await loadLast();
        if (since('appOpen') < ADS.appOpenMinGapMs || since('any') < ADS.anyFullscreenGapMs) return;
        showFullscreen('appOpen');
      } catch {}
    });
  } catch {}
};
