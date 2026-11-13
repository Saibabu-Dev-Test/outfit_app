// Monthly tasks -> coins -> rewards (Firestore only, no Cloud Functions; values in config/rewards.ts).
//   users/{uid}/months/{YYYY-MM}  {polls, votes, wardrobe, openDays, adsWatched: int,
//                                  lastOpenDay: 'YYYY-MM-DD', claimed: [taskId], doubled: [taskId],
//                                  inviteRef?: referral doc id, updatedAt}
//   users/{uid}/wallet/main       {coins, earned, spent, lastKind, lastMonth, lastTask, lastRedemption, updatedAt}
//   redemptions/{id}              {uid, userName, rewardId, title, coins, contact, note, status:'pending', createdAt}
// firestore.rules: counters only go up by 1 per write, openDays once per day, a task is claimed once
// per month and only when its target is reached, coins change only together with a claim / double /
// redemption in the same batch. Admins approve / reject redemptions (Admin screen).
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { localDateKey } from '../utils/date';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { MONTHLY_TASKS, MonthlyTaskId, rewardById, taskById } from '../config/rewards';

export type CounterField = 'polls' | 'votes' | 'wardrobe' | 'adsWatched';

export interface MonthState {
  month: string;
  counts: Record<MonthlyTaskId, number>;
  claimed: string[];
  doubled: string[];
}

export interface Wallet {
  coins: number;
  earned: number;
  spent: number;
}

export interface Redemption {
  id: string;
  uid: string;
  userName: string;
  rewardId: string;
  title: string;
  coins: number;
  contact: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  createdAt: Date | null;
}

// 'YYYY-MM' of a local date
export const monthKey = (d: Date = new Date()): string => localDateKey(d).slice(0, 7);

const monthRef = (uid: string, m: string) => doc(db, 'users', uid, 'months', m);
const walletRef = (uid: string) => doc(db, 'users', uid, 'wallet', 'main');

const num = (v: any) => (typeof v === 'number' && isFinite(v) ? v : 0);
const toDate = (v: any): Date | null => (v?.toDate ? v.toDate() : v instanceof Date ? v : null);

// One write at a time per device so each write moves a counter by at most 1 (rules)
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
};

// +1 on a monthly counter (never throws, never blocks the caller)
export const recordMonthlyProgress = (uid: string, field: CounterField, _n = 1): Promise<void> =>
  serial(async () => {
    try {
      await setDoc(monthRef(uid, monthKey()), { [field]: increment(1), updatedAt: serverTimestamp() }, { merge: true });
    } catch (e: any) {
      console.warn('monthly progress failed:', field, e?.code, e?.message);
    }
  });

// Counts today as an "app open day" once
let lastOpenSaved = '';
export const recordMonthlyOpen = (uid: string): Promise<void> =>
  serial(async () => {
    const today = localDateKey();
    if (lastOpenSaved === `${uid}|${today}`) return;
    try {
      const m = monthKey();
      const snap = await getDoc(monthRef(uid, m));
      if (snap.exists() && snap.data()?.lastOpenDay === today) {
        lastOpenSaved = `${uid}|${today}`;
        return;
      }
      await setDoc(monthRef(uid, m), { openDays: increment(1), lastOpenDay: today, updatedAt: serverTimestamp() }, { merge: true });
      lastOpenSaved = `${uid}|${today}`;
    } catch (e: any) {
      console.warn('monthly open failed:', e?.code, e?.message);
    }
  });

// Friends who joined with my link this month (referrals/{newUid} naming me); first id for the claim
const invitesThisMonth = async (uid: string): Promise<{ count: number; firstId: string | null }> => {
  try {
    const snap = await getDocs(query(collection(db, 'referrals'), where('referrerId', '==', uid), limit(50)));
    const m = monthKey();
    const ids = snap.docs.filter(d => {
      const t = toDate(d.data()?.createdAt);
      return t ? monthKey(t) === m : false;
    });
    return { count: ids.length, firstId: ids[0]?.id || null };
  } catch {
    return { count: 0, firstId: null };
  }
};

export const getMonthState = async (uid: string): Promise<MonthState & { inviteRef: string | null }> => {
  const m = monthKey();
  let d: any = {};
  try {
    const snap = await getDoc(monthRef(uid, m));
    d = snap.exists() ? snap.data() : {};
  } catch (e: any) {
    console.warn('getMonthState failed:', e?.code, e?.message);
  }
  const inv = await invitesThisMonth(uid);
  return {
    month: m,
    counts: {
      polls: num(d.polls),
      votes: num(d.votes),
      wardrobe: num(d.wardrobe),
      openDays: num(d.openDays),
      adsWatched: num(d.adsWatched),
      invites: inv.count,
    },
    claimed: Array.isArray(d.claimed) ? d.claimed : [],
    doubled: Array.isArray(d.doubled) ? d.doubled : [],
    inviteRef: inv.firstId,
  };
};

export const getWallet = async (uid: string): Promise<Wallet> => {
  try {
    const snap = await getDoc(walletRef(uid));
    const d: any = snap.exists() ? snap.data() : {};
    return { coins: num(d.coins), earned: num(d.earned), spent: num(d.spent) };
  } catch {
    return { coins: 0, earned: 0, spent: 0 };
  }
};

export const progressOf = (s: MonthState, id: MonthlyTaskId) => {
  const t = taskById(id)!;
  const c = Math.min(s.counts[id] || 0, t.target);
  return { count: c, target: t.target, done: c >= t.target, claimed: s.claimed.includes(id), pct: c / t.target };
};

// Claim a finished task's coins (once per month). Returns the coins added.
export const claimTask = (uid: string, id: MonthlyTaskId): Promise<number> =>
  serial(async () => {
    const t = taskById(id);
    if (!t) throw new Error('Unknown task.');
    const s = await getMonthState(uid);
    if (s.claimed.includes(id)) throw new Error('Already claimed this month.');
    if ((s.counts[id] || 0) < t.target) throw new Error('Finish the task first.');
    try {
      const b = writeBatch(db);
      const monthData: any = { claimed: arrayUnion(id), updatedAt: serverTimestamp() };
      if (id === 'invites' && s.inviteRef) monthData.inviteRef = s.inviteRef;
      b.set(monthRef(uid, s.month), monthData, { merge: true });
      b.set(
        walletRef(uid),
        {
          coins: increment(t.coins),
          earned: increment(t.coins),
          lastKind: 'claim',
          lastMonth: s.month,
          lastTask: id,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await b.commit();
      return t.coins;
    } catch (e: any) {
      throw new Error(firestoreErrorMessage(e, 'Claiming coins'));
    }
  });

// After a rewarded-interstitial ad: the same coins once more (once per task per month)
export const doubleTask = (uid: string, id: MonthlyTaskId): Promise<number> =>
  serial(async () => {
    const t = taskById(id);
    if (!t) return 0;
    const m = monthKey();
    try {
      const b = writeBatch(db);
      b.set(monthRef(uid, m), { doubled: arrayUnion(id), adsWatched: increment(1), updatedAt: serverTimestamp() }, { merge: true });
      b.set(
        walletRef(uid),
        {
          coins: increment(t.coins),
          earned: increment(t.coins),
          lastKind: 'double',
          lastMonth: m,
          lastTask: id,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await b.commit();
      return t.coins;
    } catch (e: any) {
      console.warn('double coins failed:', e?.code, e?.message);
      return 0;
    }
  });

// Spend coins on a catalog reward: creates a pending request for the admins
export const redeemReward = (
  uid: string,
  userName: string,
  rewardId: string,
  contact: string,
  note: string,
): Promise<void> =>
  serial(async () => {
    const r = rewardById(rewardId);
    if (!r) throw new Error('Unknown reward.');
    const w = await getWallet(uid);
    if (w.coins < r.coins) throw new Error(`You need ${r.coins - w.coins} more coins.`);
    const c = contact.trim();
    if (c.length < 5) throw new Error('Please add an email or phone number so we can send it.');
    try {
      const ref = doc(collection(db, 'redemptions'));
      const b = writeBatch(db);
      b.set(ref, {
        uid,
        userName: (userName || 'User').slice(0, 60),
        rewardId: r.id,
        title: r.title,
        coins: r.coins,
        contact: c.slice(0, 120),
        note: note.trim().slice(0, 300),
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      b.set(
        walletRef(uid),
        {
          coins: increment(-r.coins),
          spent: increment(r.coins),
          lastKind: 'redeem',
          lastRedemption: ref.id,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await b.commit();
    } catch (e: any) {
      throw new Error(firestoreErrorMessage(e, 'Redeeming'));
    }
  });

export const toRedemption = (id: string, d: any): Redemption => ({
  id,
  uid: String(d?.uid || ''),
  userName: d?.userName || 'User',
  rewardId: String(d?.rewardId || ''),
  title: d?.title || '',
  coins: num(d?.coins),
  contact: d?.contact || '',
  note: d?.note || '',
  status: ['approved', 'rejected', 'fulfilled'].includes(d?.status) ? d.status : 'pending',
  createdAt: toDate(d?.createdAt),
});

export const getMyRedemptions = async (uid: string): Promise<Redemption[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'redemptions'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(20)),
    );
    return snap.docs.map(d => toRedemption(d.id, d.data()));
  } catch (e: any) {
    console.warn('getMyRedemptions failed:', e?.code, e?.message);
    return [];
  }
};

// Admin: newest requests first (pending ones on top in the screen)
export const getRedemptionsForAdmin = async (): Promise<Redemption[]> => {
  try {
    const snap = await getDocs(query(collection(db, 'redemptions'), orderBy('createdAt', 'desc'), limit(100)));
    return snap.docs.map(d => toRedemption(d.id, d.data()));
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Loading reward requests'));
  }
};

// Admin decision. Rejecting gives the coins back to the user (same batch).
export const decideRedemption = async (
  r: Redemption,
  status: 'approved' | 'rejected' | 'fulfilled',
  adminUid: string,
): Promise<void> => {
  try {
    const b = writeBatch(db);
    b.update(doc(db, 'redemptions', r.id), { status, decidedBy: adminUid, decidedAt: serverTimestamp() });
    if (status === 'rejected' && r.status === 'pending') {
      b.set(
        walletRef(r.uid),
        {
          coins: increment(r.coins),
          spent: increment(-r.coins),
          lastKind: 'refund',
          lastRedemption: r.id,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
    await b.commit();
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Saving decision'));
  }
};

export { MONTHLY_TASKS };
