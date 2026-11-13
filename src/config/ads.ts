// ALL AdMob ids and ad pacing in one place.
//
// TODO(AdMob): these are Google's official TEST ids (they always fill with "Test Ad" creatives and
// never pay). To earn money:
//   1. Create a free AdMob account (admob.google.com), add the Android app "Outfit Vote"
//      (package com.saibabu.outfit) and copy its App ID (ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY).
//   2. Create one ad unit per format below (Native advanced, Rewarded, Rewarded interstitial,
//      Interstitial, App open, Banner) and paste the unit ids into ADMOB_UNITS.
//   3. Put the App ID in ADMOB_APP_ID here AND in app.json ("react-native-google-mobile-ads"
//      .android_app_id) AND android/app/src/main/AndroidManifest.xml (APPLICATION_ID meta-data).
//   4. Set USE_TEST_ADS = false. Never click your own real ads (AdMob bans accounts for it).
export const USE_TEST_ADS = true;

export const ADMOB_APP_ID = 'ca-app-pub-3940256099942544~3347511713'; // TEST app id

// Google's official Android test unit ids
const TEST_UNITS = {
  native: 'ca-app-pub-3940256099942544/2247696110',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
  rewardedInterstitial: 'ca-app-pub-3940256099942544/5354046379',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  appOpen: 'ca-app-pub-3940256099942544/9257395921',
  banner: 'ca-app-pub-3940256099942544/9214589741',
};

// TODO(AdMob): your real unit ids (leave '' until created; '' falls back to the test id while
// USE_TEST_ADS is true and disables that format when it is false)
const REAL_UNITS: typeof TEST_UNITS = {
  native: '',
  rewarded: '',
  rewardedInterstitial: '',
  interstitial: '',
  appOpen: '',
  banner: '',
};

export type AdFormat = keyof typeof TEST_UNITS;
export const adUnitId = (f: AdFormat): string | null =>
  USE_TEST_ADS ? REAL_UNITS[f] || TEST_UNITS[f] : REAL_UNITS[f] || null;

// Pacing (kept non-annoying and inside AdMob policy: every full-screen ad follows a natural
// break or a user's own tap, never on top of typing, never inside chat)
export const ADS = {
  // Native post-style card after every N feed posts (repeats)
  feedEvery: 5,
  // Native card after every N rows in other long lists (circles, user search)
  listEvery: 8,
  // Interstitial (e.g. after posting a poll): at most once per this many ms
  interstitialMinGapMs: 5 * 60 * 1000,
  // App-open ad when coming back to the app: at most once per 4 hours, only after >= 30 s away
  appOpenMinGapMs: 4 * 60 * 60 * 1000,
  appOpenMinAwayMs: 30 * 1000,
  // No full-screen ad within this long after another one
  anyFullscreenGapMs: 90 * 1000,
  // Rewarded-interstitial intro countdown (policy: the user can say "No thanks" before it plays)
  rewardedInterstitialIntroSec: 5,
};
