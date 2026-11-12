// Admin tracking: every feature the owner asked for, with where it stands. Shown on
// Admin tracking (Me > 📊 Admin tracking). Update this list with each release.
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
  { title: 'Smaller coins, soft slow coin flip and sound', status: 'in_review', pr: 27 },
  { title: 'Photo background: Original / Blur (level) / Remove BG', status: 'in_review', pr: 27 },
  { title: 'Clearer photos (sharper grid and feed copies)', status: 'in_review', pr: 27 },
  { title: 'Rings: finger, ear, nose, toe, couple rings', status: 'in_review', pr: 27 },
  { title: "Today's pick removed from Me", status: 'in_review', pr: 27 },
  { title: 'Astro tab: astrology first, festivals after', status: 'in_review', pr: 27 },
  { title: 'Poll ads in circle chats + ads status for admin', status: 'in_review', pr: 27 },
  { title: 'Admin tracking screen + admin can remove any wardrobe item', status: 'in_review', pr: 27 },
  { title: 'Terms & About this app (Settings)', status: 'in_review', pr: 27 },
  { title: 'Sign up required before upload, vote, like, comment', status: 'in_review', pr: 27 },
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
