// AdMob: the ONE place for the app id and every ad unit id.
//
// Release builds use the real ids below. Debug builds (__DEV__) always use Google's official TEST
// ids, so testing on your own phone never counts as self-clicks on the publisher account.
// The app id is ALSO read by the Android SDK at start-up (keep all three equal):
//   android/app/src/main/AndroidManifest.xml  meta-data com.google.android.gms.ads.APPLICATION_ID
//   app.json                                   "react-native-google-mobile-ads".android_app_id
// A missing or malformed app id there crashes the app at launch, so never leave it empty.

export type AdSlot =
  | 'feedNative'
  | 'circlesBanner'
  | 'searchBanner'
  | 'pollBanner'
  | 'astroRewarded'
  | 'poruthamRewarded'
  | 'earnRewarded'
  | 'earnInterstitial';

// Real ids (AdMob > Apps > Outfit). Unit names as in the AdMob console.
export const REAL_ADS = {
  appId: 'ca-app-pub-8006246175093661~4589468267',
  feedNative: 'ca-app-pub-8006246175093661/9650223257', // feed_native (Native advanced): Feed, after every 5 posts
  circlesBanner: 'ca-app-pub-8006246175093661/4345035031', // circles_banner (Banner): under the Circles list
  searchBanner: 'ca-app-pub-8006246175093661/1718871690', // search_banner (Banner): people search
  // Polls in circle chats: uses the circles banner unit until a poll_banner unit is made in AdMob
  pollBanner: 'ca-app-pub-8006246175093661/9905142618',
  astroRewarded: 'ca-app-pub-8006246175093661/8348090730', // astro_rewarded (Rewarded): "See full reading"
  poruthamRewarded: 'ca-app-pub-8006246175093661/4708656255', // porutham_rewarded (Rewarded): full Pelli Porutham
  // TODO(AdMob): make an earn_rewarded (Rewarded) unit and put it here. Until then the Earn tab
  // reuses astro_rewarded, and only when USE_TEST_ADS_EARN is false.
  earnRewarded: 'ca-app-pub-8006246175093661/8348090730',
  // earn_interstitial (Interstitial): shown when a partner wall opens and after a completed Earn task
  // (owner revenue only, no coins).
  earnInterstitial: 'ca-app-pub-8006246175093661/2080802534',
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
  earnRewarded: 'ca-app-pub-3940256099942544/5224354917',
  earnInterstitial: 'ca-app-pub-3940256099942544/1033173712',
} as const;

// true forces test ad units in release builds too (e.g. a build for testers). Normally false.
export const FORCE_TEST_ADS = false;

// Earn tab (rewarded ad + the interstitials when a task starts / after it is completed): Google TEST ads in every build while the Earn tab is
// being tested (no own-click risk on the real account). Set false once a real earn_rewarded unit is in
// REAL_ADS.earnRewarded.
export const USE_TEST_ADS_EARN = false;

// Kill switch: false hides every ad (rewarded content then unlocks after a short wait)
export const ADS_ENABLED = true;

// A sponsored card after every N posts in the Feed
export const FEED_AD_EVERY = 5;

// Rewarded ads: give up loading after this long and unlock anyway (never punish users for no fill)
export const REWARDED_LOAD_TIMEOUT_MS = 15000;
// Short wait shown before unlocking when no ad could be shown
export const REWARDED_FALLBACK_WAIT_MS = 2500;

// ── Earn task ads (partner walls) ── owner revenue only: they never give coins.
// 1. Start ad: one interstitial when the user opens a partner wall (Offers, Surveys & offers, Games,
//    Surveys), shown before the wall opens. At most one start ad per START_TASK_AD_MIN_GAP_MS
//    (between separate wall opens); if none loads within START_TASK_AD_LOAD_WAIT_MS the wall opens anyway.
// 2. Completion ad: one interstitial when the user leaves a partner wall after a task (a new credit,
//    or >= POST_TASK_AD_MIN_WALL_MS in the wall). At most one per POST_TASK_AD_MIN_GAP_MS between
//    completion ads, so a start ad and a completion ad for the same task can both show.
// 3. Never two full-screen ads (rewarded or interstitial) within AD_MIN_SPACING_MS of each other.
export const START_TASK_AD_MIN_GAP_MS = 2 * 60 * 1000;
export const START_TASK_AD_LOAD_WAIT_MS = 3000;
export const POST_TASK_AD_MIN_GAP_MS = 2 * 60 * 1000;
export const AD_MIN_SPACING_MS = 10 * 1000;
// No task completion seen (postbacks not deployed / not arrived yet): show the ad only when the
// user spent at least this long in the wall
export const POST_TASK_AD_MIN_WALL_MS = 60 * 1000;
// How long closing a wall may wait for the "new credit?" check and for the ad to load before the
// user simply goes back to Earn without an ad
export const POST_TASK_CREDIT_CHECK_MS = 2500;
export const POST_TASK_AD_LOAD_WAIT_MS = 3000;
// Pause before the ad appears, so the tap that closed the wall can't land on the ad
export const POST_TASK_AD_TAP_GUARD_MS = 600;

declare const __DEV__: boolean | undefined;
const isDev = typeof __DEV__ !== 'undefined' && !!__DEV__;

export const usingTestAds = (): boolean => FORCE_TEST_ADS || isDev;

// The unit id for a slot: Google test ids in debug builds, the real ids in release builds
const EARN_SLOTS: AdSlot[] = ['earnRewarded', 'earnInterstitial'];
export const adUnitId = (slot: AdSlot, opts: { test?: boolean } = {}): string =>
  (opts.test ?? (usingTestAds() || (EARN_SLOTS.includes(slot) && USE_TEST_ADS_EARN))) ? TEST_ADS[slot] : REAL_ADS[slot];
