// Admin tracking > 💰 Earnings (owner only). Real numbers from the earn ledger the partner
// postbacks write on the Worker 'outfit-api' (D1 table earnings; GET /v1/admin/earnings, owner check
// on the Worker from the verified Firebase token). Nothing is sampled or estimated: an empty ledger
// shows zeros and "No earnings yet". Partner names are fine here (admin only), never on the Earn tab.
import { workerFetch } from './workerApi';

export type EarnPartner = 'bitlabs' | 'cpx' | 'offerwall';
export const EARN_PARTNERS: EarnPartner[] = ['offerwall', 'bitlabs', 'cpx'];
export const EARN_PARTNER_LABEL: Record<EarnPartner, string> = {
  bitlabs: 'BitLabs',
  cpx: 'CPX Research',
  offerwall: 'Offerwall.GG',
};

// What the partner says the task was (older rows: the ledger type survey / offer)
export const CATEGORY_LABEL: Record<string, string> = {
  survey: '📝 Surveys',
  offer: '🎯 Offers',
  game: '🎮 Games',
  quiz: '❓ Quizzes / tests',
  receipt: '🧾 Receipts',
  other: '• Other',
};
export const categoryLabel = (c: string | null | undefined): string => CATEGORY_LABEL[c || 'other'] || `• ${c}`;

// Rupee amounts. tasks / payout / user / owner = credits still standing (pending + approved).
export interface EarnBucket {
  tasks: number;
  payout: number; // full partner payout ₹
  user: number; // users' share ₹
  owner: number; // owner's share ₹
  pending: number;
  approved: number;
  reversed: number;
  reversedPayout: number;
}

export interface EarnRecent {
  id: string;
  user: string; // short uid only
  partner: string;
  category: string | null;
  status: 'pending' | 'approved' | 'reversed' | string;
  payout: number;
  userRupees: number;
  ownerRupees: number;
  taskName: string | null;
  activity: string | null;
  createdAt: number;
}

export interface EarningsReport {
  partners: Record<EarnPartner, EarnBucket & { configured: boolean }>;
  byCategory: Record<string, EarnBucket>;
  byPartnerCategory: Record<string, EarnBucket>;
  total: EarnBucket;
  today: EarnBucket & { since: number };
  month: EarnBucket & { since: number };
  recent: EarnRecent[];
  at: number;
}

export const EMPTY_BUCKET: EarnBucket = { tasks: 0, payout: 0, user: 0, owner: 0, pending: 0, approved: 0, reversed: 0, reversedPayout: 0 };

export const rupees = (n: number | null | undefined): string => `₹${(Number(n) || 0).toFixed(2)}`;

export const hasEarnings = (r: EarningsReport | null): boolean =>
  !!r && (r.total.tasks > 0 || r.total.reversed > 0 || r.recent.length > 0);

export const STATUS_ICON: Record<string, string> = { pending: '⏳', approved: '✅', reversed: '↩️' };

// Throws a readable message (403 = not the owner; 404 = the Worker is older than this app)
export const getEarningsReport = async (): Promise<EarningsReport> => {
  try {
    return await workerFetch<EarningsReport>('/v1/admin/earnings');
  } catch (e: any) {
    if (e?.status === 403) throw new Error('Owner only.');
    if (e?.status === 404) throw new Error('The earn server needs the latest update (deploy the outfit-api Worker).');
    throw new Error(e?.message || 'Earn server not reachable.');
  }
};
