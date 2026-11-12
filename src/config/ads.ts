// AdMob: the ONE place for the app id and every ad unit id.
//
// Release builds use the real ids below. Debug builds (__DEV__) always use Google's official TEST
// ids, so testing on your own phone never counts as self-clicks on the publisher account.
// The app id is ALSO read by the Android SDK at start-up (keep all three equal):
//   android/app/src/main/AndroidManifest.xml  meta-data com.google.android.gms.ads.APPLICATION_ID
//   app.json                                   "react-native-google-mobile-ads".android_app_id
// A missing or malformed app id there crashes the app at launch, so never leave it empty.

export type AdSlot = 'feedNative' | 'circlesBanner' | 'searchBanner' | 'pollBanner' | 'astroRewarded' | 'poruthamRewarded';

// Real ids (AdMob > Apps > Outfit). Unit names as in the AdMob console.
export const REAL_ADS = {
  appId: 'ca-app-pub-6289221123241733~9168675820',
  feedNative: 'ca-app-pub-6289221123241733/4435223895', // feed_native (Native advanced): Feed, after every 5 posts
  circlesBanner: 'ca-app-pub-6289221123241733/6542512483', // circles_banner (Banner): under the Circles list
  searchBanner: 'ca-app-pub-6289221123241733/8214686801', // search_banner (Banner): people search
  // Polls in circle chats: uses the circles banner unit until a poll_banner unit is made in AdMob
  pollBanner: 'ca-app-pub-6289221123241733/6542512483',
  astroRewarded: 'ca-app-pub-6289221123241733/3122142221', // astro_rewarded (Rewarded): "See full reading"
  poruthamRewarded: 'ca-app-pub-6289221123241733/4303361956', // porutham_rewarded (Rewarded): full Pelli Porutham
} as const;

// Google's official test ids (Android): https://developers.google.com/admob/android/test-ads
export const TEST_ADS = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  feedNative: 'ca-app-pub-3940256099942544/2247696110',
  circlesBanner: 'ca-app-pub-3940256099942544/9214589741',
  searchBanner: 'ca-app-pub-3940256099942544/9214589741',
  pollBanner: 'ca-app-pub-3940256099942544/9214589741',
  astroRewarded: 'ca-app-pub-3940256099942544/5224354917',
  poruthamRewarded: 'ca-app-pub-3940256099942544/5224354917',
} as const;

// true forces test ad units in release builds too (e.g. a build for testers). Normally false.
export const FORCE_TEST_ADS = false;

// Kill switch: false hides every ad (rewarded content then unlocks after a short wait)
export const ADS_ENABLED = true;

// A sponsored card after every N posts in the Feed
export const FEED_AD_EVERY = 5;

// Rewarded ads: give up loading after this long and unlock anyway (never punish users for no fill)
export const REWARDED_LOAD_TIMEOUT_MS = 15000;
// Short wait shown before unlocking when no ad could be shown
export const REWARDED_FALLBACK_WAIT_MS = 2500;

declare const __DEV__: boolean | undefined;
const isDev = typeof __DEV__ !== 'undefined' && !!__DEV__;

export const usingTestAds = (): boolean => FORCE_TEST_ADS || isDev;

// The unit id for a slot: Google test ids in debug builds, the real ids in release builds
export const adUnitId = (slot: AdSlot, opts: { test?: boolean } = {}): string =>
  (opts.test ?? usingTestAds()) ? TEST_ADS[slot] : REAL_ADS[slot];
