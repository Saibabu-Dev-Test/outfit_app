// Earn tab: ALL values in this one file (coins, revenue split, holds, partner ids).
//
// Money rules (agreed with the owner):
//   - Ad income (AdMob) goes 100% to the owner. Users only get small coin rewards for ads / votes /
//     check-ins (paid out of the owner's ad income).
//   - Survey (CPX Research) and offerwall (Offerwall.GG) payouts: the user gets USER_SHARE (65%),
//     the owner keeps the rest (35%).
//   - Survey / offer credits are held (status 'pending') for HOLD_DAYS_MIN..HOLD_DAYS_MAX days before
//     they become withdrawable (partners can reverse fraudulent completions in that window).
//   - Approved credits are written ONLY by the server (postback handler / admin). The app can only
//     add small 'pending' coin entries whose amounts firestore.rules check against these numbers.
//
// firestore.rules mirrors EARN_AD_COINS / EARN_VOTE_COINS / EARN_CHECKIN_COINS / EARN_MAX_ADS_PER_DAY
// and MIN_WITHDRAW_RUPEES / COINS_PER_RUPEE (functions earn*). Change both together.

// 100 coins = ₹1
export const COINS_PER_RUPEE = 100;

// Survey / offer revenue split
export const USER_SHARE = 0.65;
export const OWNER_SHARE = 1 - USER_SHARE;

// Survey / offer credits stay pending this many days (server picks within the range per partner)
export const HOLD_DAYS_MIN = 3;
export const HOLD_DAYS_MAX = 7;

// Small coin rewards (owner-funded from ad income)
export const EARN_AD_COINS = 2; // per rewarded ad watched on the Earn tab
export const EARN_MAX_ADS_PER_DAY = 10; // coin-paying ads per day
export const EARN_VOTE_COINS = 1; // first outfit vote of the day
export const EARN_CHECKIN_COINS = 5; // daily check-in
export const EARN_REFERRAL_COINS = 100; // to BOTH the inviter and the new user (server-credited)

// Withdrawals (UPI), approved by an admin
export const MIN_WITHDRAW_RUPEES = 50;

// ── Partners ──
// TODO(CPX): put the real CPX Research app id here (publisher dashboard > Apps). Not a secret.
// The CPX "secure hash" key IS a secret: it lives only on the server (server/earn/), never here.
export const CPX_APP_ID: string = 'CPX_APP_ID_PLACEHOLDER';
// HTTPS endpoint that returns { hash } for the signed-in user: the Worker 'outfit-api'
// (server/worker, GET|POST /cpxHash; 503 until the CPX_SECURE_HASH Worker secret is set).
// Surveys stay "coming soon" until CPX_APP_ID is filled too.
export const CPX_HASH_ENDPOINT: string = 'https://outfit-api.babusai927.workers.dev/cpxHash';

// TODO(Offerwall.GG): the offerwall link from the Offerwall.GG dashboard, with {uid} where the user
// id goes, e.g. 'https://offerwall.gg/wall/XXXX?user_id={uid}'. Empty = "coming soon".
export const OFFERWALL_GG_URL: string = '';

// BitLabs (surveys + offers in one wall). The app/API token is PUBLIC (it is in every wall link),
// so it is fine in git. The BitLabs Secret Key and S2S key are secrets: server only (server/earn/,
// secrets.BITLABS_SECRET), never here. Empty token = "coming soon".
export const BITLABS_TOKEN: string = '68646bb9-fb3b-45db-8043-a92bd5a2ba21';

export const coinsToRupees = (coins: number): number => Math.round((coins / COINS_PER_RUPEE) * 100) / 100;
export const rupeesText = (coins: number): string => `₹${coinsToRupees(coins).toFixed(2)}`;

// User's coins for a partner payout given in rupees (what the partner pays the app)
export const userCoinsForPayout = (payoutRupees: number): number =>
  Math.max(0, Math.floor(payoutRupees * USER_SHARE * COINS_PER_RUPEE));

export const isCpxConfigured = () => !!CPX_APP_ID && !CPX_APP_ID.includes('PLACEHOLDER') && !!CPX_HASH_ENDPOINT;

// CPX survey wall link. hash comes from the server (never computed in the app).
export const cpxWallUrl = (uid: string, hash: string): string =>
  'https://offers.cpx-research.com/index.php' +
  `?app_id=${encodeURIComponent(CPX_APP_ID)}` +
  `&ext_user_id=${encodeURIComponent(uid)}` +
  `&secure_hash=${encodeURIComponent(hash)}`;

export const offerwallUrl = (uid: string): string | null =>
  OFFERWALL_GG_URL ? OFFERWALL_GG_URL.replace('{uid}', encodeURIComponent(uid)) : null;

export const isBitlabsConfigured = (): boolean => !!BITLABS_TOKEN && !BITLABS_TOKEN.includes('PLACEHOLDER');

// BitLabs web offer wall link (developer.bitlabs.ai/docs/iframeweb-integration: uid + token are the
// only mandatory params). uid comes back to the server as [%USER:UID%] in the reward callback.
export const bitlabsWallUrl = (uid: string): string =>
  'https://web.bitlabs.ai/' +
  `?uid=${encodeURIComponent(uid)}` +
  `&token=${encodeURIComponent(BITLABS_TOKEN)}`;
