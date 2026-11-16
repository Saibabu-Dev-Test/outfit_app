// AdMob (react-native-google-mobile-ads), loaded lazily and guarded: if the native module is
// missing or throws, ads simply never show and nothing else breaks. Web: ads.web.ts (no ads).
// Ad unit ids: src/config/ads.ts (the one place to put the real ids).
import { Platform } from 'react-native';
import { isSafeMode } from './safeMode';
import {
  ADS_ENABLED,
  REWARDED_FALLBACK_WAIT_MS,
  REWARDED_LOAD_TIMEOUT_MS,
  adUnitId,
} from '../config/ads';

export type RewardedSlot = 'astroRewarded' | 'poruthamRewarded' | 'earnRewarded';
export type InterstitialSlot = 'earnInterstitial';

// When the last full-screen ad (rewarded or interstitial) was on screen, for frequency caps
let lastFullscreenAt = 0;
export const lastFullscreenAdAt = (): number => lastFullscreenAt;
const markFullscreenShown = (): void => {
  lastFullscreenAt = Date.now();
};

// Last ad outcome per slot, for the Admin screen ("Ads status"): why ads are not showing
export interface AdStatus { slot: string; ok: boolean; message: string; at: number }
const adStatus: Record<string, AdStatus> = {};
export const noteAd = (slot: string, ok: boolean, message: string): void => {
  adStatus[slot] = { slot, ok, message, at: Date.now() };
};
export const adStatuses = (): AdStatus[] => Object.values(adStatus).sort((a, b) => b.at - a.at);

let mod: any = null;
let tried = false;

// Ads stay off until the app has shown its first screen for a while (allowAds, App.tsx), so the
// Mobile Ads SDK (and its WebView) never loads during start-up. Ad slots render nothing until then.
let allowed = false;
let readyResolve: (() => void) | null = null;
const readyPromise = new Promise<void>(r => {
  readyResolve = r;
});
const readyListeners = new Set<() => void>();

export const adsAllowed = (): boolean => allowed;
// Called once by App.tsx after the first screen has settled
export const allowAds = (): void => {
  if (allowed) return;
  allowed = true;
  readyResolve?.();
  readyListeners.forEach(fn => {
    try {
      fn();
    } catch {}
  });
  readyListeners.clear();
};
// For ad slots: re-render when ads become allowed
export const onAdsAllowed = (fn: () => void): (() => void) => {
  if (allowed) {
    fn();
    return () => {};
  }
  readyListeners.add(fn);
  return () => {
    readyListeners.delete(fn);
  };
};
export const whenAdsAllowed = (): Promise<void> => readyPromise;

// The library, or null when it can't load (tests, a broken native module, ads switched off,
// start-up safe mode, or before allowAds())
export const adsModule = (): any => {
  if (!ADS_ENABLED || Platform.OS !== 'android' || !allowed) return null;
  if (isSafeMode()) return null;
  if (tried) return mod;
  tried = true;
  try {
    mod = require('react-native-google-mobile-ads');
    if (!mod || !mod.BannerAd || !mod.RewardedAd) mod = null;
  } catch (e: any) {
    console.warn('Ads unavailable:', e?.message);
    mod = null;
  }
  return mod;
};

export const adsAvailable = (): boolean => !!adsModule();

let initPromise: Promise<boolean> | null = null;
// Starts the Mobile Ads SDK once. Never throws.
export const initAds = (): Promise<boolean> => {
  if (initPromise) return initPromise;
  if (!allowed) return Promise.resolve(false);
  initPromise = (async () => {
    const m = adsModule();
    if (!m) return false;
    try {
      const mobileAds = typeof m.default === 'function' ? m.default : m.MobileAds;
      await mobileAds().initialize();
      return true;
    } catch (e: any) {
      console.warn('Ads init failed:', e?.message);
      return false;
    }
  })();
  return initPromise;
};

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// 'earned'   the user watched the ad to the end
// 'closed'   the ad showed but was closed before the reward
// 'no_ad'    no ad could be loaded / shown (no fill, offline, timeout, module missing)
export type RewardedResult = 'earned' | 'closed' | 'no_ad';

// Loads and shows one rewarded ad. Never throws, always settles.
export const showRewardedAd = (slot: RewardedSlot): Promise<RewardedResult> => {
  // The user asked for it (the app is up by then): fine to start the SDK now
  if (!allowed) allowAds();
  const m = adsModule();
  if (!m) {
    noteAd(slot, false, 'Ads module not available on this build');
    return Promise.resolve('no_ad');
  }
  return new Promise<RewardedResult>(resolve => {
    let done = false;
    let earned = false;
    let shown = false;
    const unsubs: (() => void)[] = [];
    const finish = (r: RewardedResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsubs.forEach(u => {
        try {
          u();
        } catch {}
      });
      resolve(r);
    };
    const timer = setTimeout(() => {
      if (!shown) noteAd(slot, false, 'Timed out: no ad loaded (no fill)');
      if (!shown) finish('no_ad');
    }, REWARDED_LOAD_TIMEOUT_MS);
    try {
      initAds().catch(() => undefined);
      const ad = m.RewardedAd.createForAdRequest(adUnitId(slot));
      const on = (type: any, fn: (p?: any) => void) => {
        const u = ad.addAdEventListener(type, fn);
        if (typeof u === 'function') unsubs.push(u);
      };
      on(m.RewardedAdEventType.LOADED, () => {
        noteAd(slot, true, 'Loaded');
        if (done) return;
        shown = true;
        markFullscreenShown();
        Promise.resolve(ad.show()).catch(() => finish('no_ad'));
      });
      on(m.RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      });
      on(m.AdEventType.CLOSED, () => finish(earned ? 'earned' : 'closed'));
      on(m.AdEventType.ERROR, (err?: any) => {
        noteAd(slot, false, `${err?.code || ''} ${err?.message || 'Ad error'}`.trim());
        finish(shown && earned ? 'earned' : 'no_ad');
      });
      ad.load();
    } catch (e: any) {
      console.warn('Rewarded ad failed:', e?.message);
      finish('no_ad');
    }
  });
};

// "Watch an ad to unlock": true when the content should unlock. No ad available -> unlock anyway
// after a short wait (users are never punished for no fill); closed early -> stays locked.
export const watchAdToUnlock = async (slot: RewardedSlot): Promise<boolean> => {
  const r = await showRewardedAd(slot);
  if (r === 'earned') return true;
  if (r === 'no_ad') {
    await sleep(REWARDED_FALLBACK_WAIT_MS);
    return true;
  }
  return false;
};

// ── Interstitial (one ad after a completed Earn task; never gives coins) ──
// preloadInterstitial() loads it in the background while the user is in a partner wall (nothing is
// shown); showInterstitialAd() shows it when the user leaves, waiting at most waitMs for a load.
type Inter = { slot: InterstitialSlot; ad: any; loaded: boolean; failed: boolean; waiters: (() => void)[]; unsubs: (() => void)[] };
let inter: Inter | null = null;

const dropInter = () => {
  inter?.unsubs.forEach(u => {
    try {
      u();
    } catch {}
  });
  inter = null;
};

export const preloadInterstitial = (slot: InterstitialSlot): void => {
  if (inter && inter.slot === slot && !inter.failed) return;
  dropInter();
  const m = adsModule();
  const unit = adUnitId(slot);
  if (!m || !m.InterstitialAd || !unit) {
    noteAd(slot, false, !unit ? 'No ad unit id for this build' : 'Ads module not available on this build');
    return;
  }
  try {
    initAds().catch(() => undefined);
    const ad = m.InterstitialAd.createForAdRequest(unit);
    const st: Inter = { slot, ad, loaded: false, failed: false, waiters: [], unsubs: [] };
    const wake = () => {
      const w = st.waiters;
      st.waiters = [];
      w.forEach(fn => fn());
    };
    const on = (type: any, fn: (p?: any) => void) => {
      const u = ad.addAdEventListener(type, fn);
      if (typeof u === 'function') st.unsubs.push(u);
    };
    on(m.AdEventType.LOADED, () => {
      st.loaded = true;
      noteAd(slot, true, 'Loaded');
      wake();
    });
    on(m.AdEventType.ERROR, (err?: any) => {
      st.failed = true;
      noteAd(slot, false, `${err?.code || ''} ${err?.message || 'Ad error'}`.trim());
      wake();
    });
    inter = st;
    ad.load();
  } catch (e: any) {
    console.warn('Interstitial load failed:', e?.message);
    dropInter();
  }
};

export type InterstitialResult = 'shown' | 'no_ad';

// Shows the (pre)loaded interstitial. Never throws, always settles: 'shown' after the user closes
// it, 'no_ad' when nothing loaded within waitMs (the caller just carries on).
export const showInterstitialAd = (slot: InterstitialSlot, waitMs: number): Promise<InterstitialResult> => {
  if (!allowed) allowAds();
  if (!inter || inter.slot !== slot || inter.failed) preloadInterstitial(slot);
  const st = inter;
  const m = adsModule();
  if (!st || !m) return Promise.resolve('no_ad');
  return new Promise<InterstitialResult>(resolve => {
    let done = false;
    const finish = (r: InterstitialResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (inter === st) dropInter(); // an interstitial shows once; the next wall preloads a fresh one
      resolve(r);
    };
    const timer = setTimeout(() => finish('no_ad'), waitMs);
    const go = () => {
      if (done) return;
      if (!st.loaded || st.failed) return finish('no_ad');
      clearTimeout(timer); // shown: wait for the user to close it
      try {
        const u1 = st.ad.addAdEventListener(m.AdEventType.CLOSED, () => finish('shown'));
        const u2 = st.ad.addAdEventListener(m.AdEventType.ERROR, () => finish('no_ad'));
        [u1, u2].forEach(u => typeof u === 'function' && st.unsubs.push(u));
        markFullscreenShown();
        Promise.resolve(st.ad.show()).catch(() => finish('no_ad'));
      } catch {
        finish('no_ad');
      }
    };
    if (st.loaded || st.failed) go();
    else st.waiters.push(go);
  });
};
