// Pure logic for the Earn ledger (no Firebase): entry shape, totals, breakdown, gate state.
// Ledger docs: users/{uid}/earnings/{id}
//   { type: ad|vote|survey|offer|checkin|referral, coins, rupees, partner, status: pending|approved|reversed,
//     createdAt, holdUntil? }
import { COINS_PER_RUPEE, coinsToRupees } from '../config/earn';

export type EarnType = 'ad' | 'vote' | 'survey' | 'offer' | 'checkin' | 'referral';
export type EarnStatus = 'pending' | 'approved' | 'reversed';
export const EARN_TYPES: EarnType[] = ['ad', 'vote', 'survey', 'offer', 'checkin', 'referral'];

export const EARN_TYPE_LABEL: Record<EarnType, string> = {
  ad: 'Ads watched',
  vote: 'Outfit votes',
  survey: 'Surveys',
  offer: 'Offers',
  checkin: 'Check-ins',
  referral: 'Referrals',
};
export const EARN_TYPE_ICON: Record<EarnType, string> = {
  ad: '▶️',
  vote: '👍',
  survey: '📝',
  offer: '🎯',
  checkin: '📅',
  referral: '🤝',
};

export interface EarnEntry {
  id: string;
  type: EarnType;
  coins: number;
  rupees: number;
  partner: string;
  status: EarnStatus;
  createdAt: Date | null;
  holdUntil: Date | null;
}

export interface Withdrawal {
  id: string;
  coins: number;
  rupees: number;
  status: 'pending' | 'paid' | 'rejected';
  createdAt: Date | null;
}

export interface EarnSummary {
  totalCoins: number; // approved + pending (reversed never counts)
  approvedCoins: number;
  pendingCoins: number;
  withdrawnCoins: number; // paid + pending withdrawal requests
  withdrawableCoins: number; // approved - withdrawn
  totalRupees: number;
  withdrawableRupees: number;
  pendingRupees: number;
  tasksCompleted: number; // non-reversed entries
  byType: Record<EarnType, { count: number; coins: number }>;
}

const num = (v: any) => (typeof v === 'number' && isFinite(v) ? v : 0);
const asDate = (v: any): Date | null =>
  v?.toDate ? v.toDate() : v instanceof Date ? v : typeof v === 'number' ? new Date(v) : null;

// Firestore data -> entry (unknown types / statuses are dropped by the caller)
export const toEarnEntry = (id: string, d: any): EarnEntry | null => {
  const type = d?.type;
  const status = d?.status;
  if (!EARN_TYPES.includes(type)) return null;
  if (!['pending', 'approved', 'reversed'].includes(status)) return null;
  const coins = Math.max(0, Math.floor(num(d.coins)));
  return {
    id,
    type,
    coins,
    rupees: typeof d.rupees === 'number' ? d.rupees : coinsToRupees(coins),
    partner: typeof d.partner === 'string' ? d.partner : 'app',
    status,
    createdAt: asDate(d.createdAt),
    holdUntil: asDate(d.holdUntil),
  };
};

export const summarize = (entries: EarnEntry[], withdrawals: Withdrawal[] = []): EarnSummary => {
  const byType = Object.fromEntries(EARN_TYPES.map(t => [t, { count: 0, coins: 0 }])) as EarnSummary['byType'];
  let approved = 0;
  let pending = 0;
  let tasks = 0;
  for (const e of entries) {
    if (e.status === 'reversed') continue;
    tasks++;
    byType[e.type].count++;
    byType[e.type].coins += e.coins;
    if (e.status === 'approved') approved += e.coins;
    else pending += e.coins;
  }
  const withdrawn = withdrawals.filter(w => w.status !== 'rejected').reduce((s, w) => s + w.coins, 0);
  const withdrawable = Math.max(0, approved - withdrawn);
  return {
    totalCoins: approved + pending,
    approvedCoins: approved,
    pendingCoins: pending,
    withdrawnCoins: withdrawn,
    withdrawableCoins: withdrawable,
    totalRupees: coinsToRupees(approved + pending),
    withdrawableRupees: coinsToRupees(withdrawable),
    pendingRupees: coinsToRupees(pending),
    tasksCompleted: tasks,
    byType,
  };
};

// ── Daily gate: users/{uid}/earnDaily/{yyyy-mm-dd IST} ──
export interface EarnDay {
  adWatched: boolean;
  voted: boolean;
  checkedIn: boolean;
  adsCount: number; // coin-paying ads watched today
}
export const EMPTY_DAY: EarnDay = { adWatched: false, voted: false, checkedIn: false, adsCount: 0 };
export const toEarnDay = (d: any): EarnDay => ({
  adWatched: d?.adWatched === true,
  voted: d?.voted === true,
  checkedIn: d?.checkedIn === true,
  adsCount: Math.max(0, Math.floor(num(d?.adsCount))),
});
export const isUnlocked = (d: EarnDay) => d.adWatched && d.voted;

// After every completed survey, one ad must play before the next survey opens.
// surveyAdClearedAt = createdAt (ms) of the newest survey that was already "paid" with an ad.
export const surveyAdOwed = (entries: EarnEntry[], surveyAdClearedAt: number): boolean => {
  const newest = latestSurveyAt(entries);
  return newest > surveyAdClearedAt;
};
export const latestSurveyAt = (entries: EarnEntry[]): number =>
  entries
    .filter(e => e.type === 'survey' && e.status !== 'reversed')
    .reduce((m, e) => Math.max(m, e.createdAt ? e.createdAt.getTime() : 0), 0);

// Withdrawal request validity (the server checks again)
export const withdrawCheck = (
  rupees: number,
  summary: EarnSummary,
  minRupees: number,
): { ok: true; coins: number } | { ok: false; message: string } => {
  if (!Number.isInteger(rupees) || rupees <= 0) return { ok: false, message: 'Enter a whole rupee amount.' };
  if (rupees < minRupees) return { ok: false, message: `Minimum withdrawal is ₹${minRupees}.` };
  const coins = rupees * COINS_PER_RUPEE;
  if (coins > summary.withdrawableCoins) {
    return { ok: false, message: `You can withdraw up to ₹${Math.floor(summary.withdrawableRupees)} now.` };
  }
  return { ok: true, coins };
};
