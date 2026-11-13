// Monthly tasks + coin rewards (config/monthlyTasks.ts has the numbers; firestore.rules checks them).
//   progress   users/{uid}/days/{YYYY-MM-DD} of this month + users/{uid}/coinEvents of this month
//   claim      users/{uid}/coinEvents/task_{YYYY-MM}_{taskId} + users.coins += TASK_COINS (one batch)
//   redeem     rewardClaims/{uid}_{YYYY-MM}_{rewardId} 'pending' + users.coinsSpent += cost (one batch)
//   admin      approve: claim -> 'approved'; reject: claim -> 'rejected' + users.coinsSpent -= cost
import {
  Timestamp,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import {
  ClaimStatus,
  EMPTY_COUNTS,
  MonthCounts,
  MonthlyTask,
  Reward,
  TASK_COINS,
  monthDayRange,
  monthKey,
  rewardClaimId,
  taskEventId,
} from '../config/monthlyTasks';
import { tierFor } from '../config/coins';
import { toDate } from '../utils/date';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { setKnownCoinTotal, showCoinFlip } from './coinBus';

export interface MonthState {
  month: string;
  counts: MonthCounts;
  claimed: Set<string>; // task ids already claimed this month
  coins: number;
  coinsSpent: number;
}

export interface RewardClaim {
  id: string;
  uid: string;
  name: string;
  rewardId: string;
  title: string;
  cost: number;
  month: string;
  status: ClaimStatus;
  createdAt: Date | null;
  decidedAt: Date | null;
}

const toClaim = (id: string, d: any): RewardClaim => ({
  id,
  uid: String(d?.uid || ''),
  name: String(d?.name || 'Outfit user'),
  rewardId: String(d?.rewardId || ''),
  title: String(d?.title || ''),
  cost: Number(d?.cost) || 0,
  month: String(d?.month || ''),
  status: d?.status === 'approved' || d?.status === 'rejected' ? d.status : 'pending',
  createdAt: toDate(d?.createdAt),
  decidedAt: toDate(d?.decidedAt),
});

// This month's counts for the 7 tasks, the claimed tasks and the coin balance. Never throws
// (anything unreadable counts as 0).
export const getMonthState = async (uid: string, month: string = monthKey()): Promise<MonthState> => {
  const counts: MonthCounts = { ...EMPTY_COUNTS };
  const claimed = new Set<string>();
  let coins = 0;
  let coinsSpent = 0;
  const { first, last } = monthDayRange(month);
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  await Promise.all([
    getDocs(query(collection(db, 'users', uid, 'days'), where(documentId(), '>=', first), where(documentId(), '<=', last)))
      .then(snap =>
        snap.forEach(d => {
          const x = d.data() as any;
          if (x?.opened === true) counts.opened++;
          if (x?.voted === true) counts.voted++;
          if (x?.uploaded === true) counts.uploaded++;
          if (x?.opened === true && x?.voted === true && x?.uploaded === true) counts.fullDay++;
        }),
      )
      .catch(e => console.warn('month days failed:', e?.code, e?.message)),
    getDocs(query(collection(db, 'users', uid, 'coinEvents'), where('createdAt', '>=', Timestamp.fromDate(start)), limit(2000)))
      .then(snap =>
        snap.forEach(d => {
          const t = (d.data() as any)?.type;
          if (t === 'like') counts.like++;
          else if (t === 'upload') counts.upload++;
          else if (t === 'share') counts.share++;
          else if (t === 'task' && d.id.startsWith(`task_${month}_`)) claimed.add(d.id.slice(`task_${month}_`.length));
        }),
      )
      .catch(e => console.warn('month coin events failed:', e?.code, e?.message)),
    getDoc(doc(db, 'users', uid))
      .then(s => {
        const x = s.data() as any;
        coins = Math.max(0, Number(x?.coins) || 0);
        coinsSpent = Math.max(0, Number(x?.coinsSpent) || 0);
      })
      .catch(() => undefined),
  ]);
  return { month, counts, claimed, coins, coinsSpent };
};

// Claims a finished task's coins (once a month). Returns the new coin total.
export const claimTaskCoins = async (uid: string, task: MonthlyTask, state: MonthState): Promise<number> => {
  const eventId = taskEventId(state.month, task.id);
  const b = writeBatch(db);
  b.set(doc(db, 'users', uid, 'coinEvents', eventId), { type: 'task', points: TASK_COINS, createdAt: serverTimestamp() });
  b.set(doc(db, 'users', uid), { coins: increment(TASK_COINS), coinEvent: eventId }, { merge: true });
  try {
    await b.commit();
  } catch (e: any) {
    throw new Error(e?.code === 'permission-denied' ? 'Already claimed this month.' : firestoreErrorMessage(e, 'Claiming'));
  }
  const total = state.coins + TASK_COINS;
  setKnownCoinTotal(total);
  showCoinFlip({ earned: TASK_COINS, total, tier: tierFor(total) });
  return total;
};

// Redeems a reward (pending until an admin approves). One claim per reward per month.
export const redeemReward = async (uid: string, name: string, reward: Reward, month: string = monthKey()): Promise<void> => {
  const cid = rewardClaimId(uid, month, reward.id);
  const b = writeBatch(db);
  b.set(doc(db, 'rewardClaims', cid), {
    uid,
    name: (name || 'Outfit user').slice(0, 80),
    rewardId: reward.id,
    title: reward.title.slice(0, 80),
    cost: reward.cost,
    month,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  b.set(doc(db, 'users', uid), { coinsSpent: increment(reward.cost), rewardClaim: cid }, { merge: true });
  try {
    await b.commit();
  } catch (e: any) {
    throw new Error(
      e?.code === 'permission-denied' ? 'Not enough coins, or already redeemed this month.' : firestoreErrorMessage(e, 'Redeeming'),
    );
  }
};

export const getMyClaims = async (uid: string): Promise<RewardClaim[]> => {
  try {
    const snap = await getDocs(query(collection(db, 'rewardClaims'), where('uid', '==', uid), limit(50)));
    return snap.docs.map(d => toClaim(d.id, d.data())).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  } catch (e: any) {
    console.warn('my claims failed:', e?.code, e?.message);
    return [];
  }
};

// Admin: pending claims, oldest first
export const getPendingClaims = async (): Promise<RewardClaim[]> => {
  try {
    const snap = await getDocs(query(collection(db, 'rewardClaims'), where('status', '==', 'pending'), limit(200)));
    return snap.docs.map(d => toClaim(d.id, d.data())).sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Loading reward claims'));
  }
};

// Admin: approve, or reject with the coins given back
export const decideClaim = async (claim: RewardClaim, approve: boolean, adminUid: string): Promise<void> => {
  const b = writeBatch(db);
  b.update(doc(db, 'rewardClaims', claim.id), {
    status: approve ? 'approved' : 'rejected',
    decidedAt: serverTimestamp(),
    decidedBy: adminUid,
  });
  if (!approve) b.update(doc(db, 'users', claim.uid), { coinsSpent: increment(-claim.cost), refundClaim: claim.id });
  try {
    await b.commit();
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, approve ? 'Approving' : 'Rejecting'));
  }
};
