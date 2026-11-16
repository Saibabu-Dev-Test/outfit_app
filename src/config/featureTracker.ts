// Admin tracking: every feature the owner asked for, with where it stands. Shown on
// Admin tracking (Me > 📊 Admin tracking). Update this list with each release.
// Earn sources are not hand-written: earnFeatures() works their status out from the real config
// (config/earn.ts) and, when the owner's Earnings report has loaded, from the Worker's secrets.
import { bitlabsWallUrl, isBitlabsConfigured, isCpxConfigured, offerwallUrl } from './earn';
export type FeatureStatus = 'live' | 'in_review' | 'owner_todo';

export interface TrackedFeature {
  title: string;
  status: FeatureStatus;
  pr?: number;
  note?: string;
}

export const FEATURE_STATUS_LABEL: Record<FeatureStatus, string> = {
  live: '✅ Live',
  in_review: '🟡 In this update',
  owner_todo: '🔴 Needs you',
};

export const TRACKED_FEATURES: TrackedFeature[] = [
  { title: 'Startup crash hardening', status: 'live', pr: 18 },
  { title: 'Crash reporter', status: 'live', pr: 19 },
  { title: 'Multi-shot, photo viewer, Wear-today votes', status: 'live', pr: 8 },
  { title: 'Astrology ad unlock', status: 'live', pr: 20 },
  { title: 'Like coin levels', status: 'live', pr: 21 },
  { title: 'Like notification coin flips', status: 'live', pr: 22 },
  { title: 'Monthly tasks + coin rewards (admin approvals)', status: 'live', pr: 23 },
  { title: 'Function planner + weather', status: 'live', pr: 24 },
  { title: 'Wardrobe quick add (10 photos) + storage size', status: 'live', pr: 25 },
  { title: 'Push notifications + 24 h polls', status: 'live', pr: 26 },
  { title: 'Profile style chips and Fabric Type removed', status: 'in_review', pr: 27 },
  { title: 'Wardrobe labels English by default + App language', status: 'in_review', pr: 27 },
  { title: 'Smaller coins, soft slow coin flip and sound', status: 'live', pr: 29 },
  { title: 'Photo background: Original / Blur (level) / Remove BG', status: 'in_review', pr: 27 },
  { title: 'Clearer photos (sharper grid and feed copies)', status: 'in_review', pr: 27 },
  { title: 'Rings: finger, ear, nose, toe, couple rings', status: 'in_review', pr: 27 },
  { title: "Today's pick removed everywhere", status: 'live', pr: 27 },
  { title: 'Astro tab: astrology first, festivals after', status: 'in_review', pr: 27 },
  { title: 'Poll ads in circle chats + ads status for admin', status: 'in_review', pr: 27 },
  { title: 'Admin tracking screen + admin can remove any wardrobe item', status: 'in_review', pr: 27 },
  { title: 'Terms & About this app (Settings)', status: 'in_review', pr: 27 },
  { title: 'Sign up required before upload, vote, like, comment', status: 'in_review', pr: 27 },
  { title: 'Astrology: free summary; full astrology, festivals and Porutham after 1 ad a day (IST)', status: 'in_review' },
  { title: 'Admin tracking: 💰 Earnings from partner credits (owner only)', status: 'in_review' },
  { title: 'Admin tracking: tap any number to open its list (owner only)', status: 'in_review' },
  { title: 'Earn tab open to every user: no daily ad + vote gate, no ad before surveys; every card shows at once', status: 'in_review', pr: 61 },
  {
    title: 'Push notifications on phones',
    status: 'owner_todo',
    note: 'Enable the FCM API and give the deployer service account its two roles in Google Cloud',
  },
  {
    title: 'Real ads filling',
    status: 'owner_todo',
    note: 'AdMob: app approved and linked to the Play Store listing, app-ads.txt on the website, payments set up',
  },
];

// ── Earn sources ──
const WORKER = 'https://outfit-api.babusai927.workers.dev';
export const POSTBACK_URLS = {
  offerwall: `${WORKER}/offerwallPostback?user={userId}&tx={transactionId}&amount={currencyAmount}&status={status}&sig={signature}&payout={payoutUsd}&test={test}&offerName={offerName}`,
  bitlabs: `${WORKER}/bitlabsPostback?uid=[%USER:UID%]&val=[%VALUE:USD%]&tx=[%TX%]&type=[%ACTIVITY:TYPE%]&ref=[%REF%]`,
  cpx: `${WORKER}/cpxPostback?user_id={user_id}&trans_id={trans_id}&amount_local={amount_local}&status={status}&hash={secure_hash}`,
};

export interface EarnConfigState {
  // app side (public values in config/earn.ts): the wall opens in this build
  app: { offerwall: boolean; bitlabs: boolean; cpx: boolean };
  // Worker secret set (credits are recorded); undefined = not known yet (report not loaded)
  worker?: Partial<Record<'offerwall' | 'bitlabs' | 'cpx', boolean>>;
}

export const currentEarnConfig = (): EarnConfigState['app'] => ({
  offerwall: !!offerwallUrl('x'),
  bitlabs: isBitlabsConfigured() && !!bitlabsWallUrl('x'),
  cpx: isCpxConfigured(),
});

// Live = the wall opens in this release AND (as far as we know) credits are recorded.
// Needs you = the exact step only the owner can do.
export const earnFeatures = ({ app, worker = {} }: EarnConfigState): TrackedFeature[] => {
  const credits = (p: 'offerwall' | 'bitlabs' | 'cpx', secret: string, url: string): Pick<TrackedFeature, 'status' | 'note'> =>
    worker[p] === false
      ? { status: 'owner_todo', note: `Wall opens in the app, but credits are not recorded yet: add the Worker secret ${secret} on outfit-api and set the postback URL ${url}` }
      : {
          status: 'live',
          note: worker[p] === true ? 'Wall open in the app; credits recorded on the earn server' : `Wall open in the app; credits need ${secret} on the Worker (see 💰 Earnings: Credits ON/OFF)`,
        };
  const offers: TrackedFeature = app.offerwall
    ? { title: 'Earn: 🎯 Offers (Offerwall.GG)', pr: 56, ...credits('offerwall', 'OFFERWALL_GG_SECRET', POSTBACK_URLS.offerwall) }
    : { title: 'Earn: 🎯 Offers (Offerwall.GG)', status: 'owner_todo', note: 'Put the Offerwall.GG wall link in OFFERWALL_GG_URL (src/config/earn.ts)' };
  const wall: TrackedFeature = app.bitlabs
    ? { title: 'Earn: 📋 Surveys, offers & games (BitLabs)', pr: 47, ...credits('bitlabs', 'BITLABS_SECRET', POSTBACK_URLS.bitlabs) }
    : { title: 'Earn: 📋 Surveys, offers & games (BitLabs)', status: 'owner_todo', note: 'Put the BitLabs app token in BITLABS_TOKEN (src/config/earn.ts)' };
  const surveys: TrackedFeature = app.cpx
    ? { title: 'Earn: 📝 Surveys (CPX Research)', ...credits('cpx', 'CPX_SECURE_HASH', POSTBACK_URLS.cpx) }
    : {
        title: 'Earn: 📝 Surveys (CPX Research)',
        status: 'owner_todo',
        note: `Shows "Coming soon" on the Earn tab. Needs the CPX app id in CPX_APP_ID (src/config/earn.ts), the CPX secure hash as the Worker secret CPX_SECURE_HASH (powers ${WORKER}/cpxHash), and the postback URL ${POSTBACK_URLS.cpx} in the CPX dashboard`,
      };
  const gamesLive = (app.offerwall && worker.offerwall !== false) || (app.bitlabs && worker.bitlabs !== false);
  const games: TrackedFeature = gamesLive
    ? {
        title: 'Earn: 🎮 Games',
        status: 'live',
        pr: 61,
        note: app.bitlabs
          ? 'Own 🎮 Games card: opens the BitLabs wall on its games tab (display_mode=gaming). Keep Games switched on for the placement in the BitLabs dashboard'
          : 'Own 🎮 Games card: opens the Offerwall.GG wall (games are listed there)',
      }
    : { title: 'Earn: 🎮 Games', status: 'owner_todo', note: 'Games come from the Offerwall.GG and BitLabs walls: finish their credit setup above' };
  const quizzes: TrackedFeature = {
    title: 'Earn: 🧠 Quizzes & learning',
    status: 'owner_todo',
    note: 'Shows "Coming soon" on the Earn tab. None of the current partners gives a quiz / learn-and-earn wall link (Offerwall.GG has a quizzes category only in its server-side offers API). Pick a quiz partner, or ask us to build a quiz list from the Offerwall.GG API; any credit a partner labels quiz shows under Quizzes / tests in 💰 Earnings',
  };
  return [
    offers,
    wall,
    surveys,
    games,
    quizzes,
    { title: 'Earn: 📅 Daily check-in, 📺 ads, 🤝 invite friends, 💸 UPI withdrawal', status: 'live', note: 'Open to every signed-in user (no daily gate). Ads are an optional card (+2 coins, 10 a day)' },
  ];
};
