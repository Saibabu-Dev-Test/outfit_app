// Shared task pool data (Firestore reads + the server's claim / complete endpoints).
//
//   taskPool/{day}                 {budgetCoins, claimMinutes, perUserCap, paidCoins, holds}  admin sets the first three
//   taskPool/{day}/slots/{slotId}  {taskType, rewardCoins, status, claimedBy, claimExpiresAt}   admin adds / removes open slots
//   taskPool/{day}/users/{uid}     {claims, done}                                              server only, I read mine
//
// The app never writes a claim or coins: claim / complete go to the server (server/earn/taskPool.js),
// which checks everything inside one Firestore transaction.
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import { PoolTaskType, TASK_POOL_ENDPOINT } from '../config/earn';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import {
  PoolDay,
  PoolSlot,
  PoolUserDay,
  checkNewSlots,
  checkPoolSettings,
  toPoolDay,
  toPoolSlot,
  toPoolUserDay,
} from './taskPoolLogic';

const dayRef = (day: string) => doc(db, 'taskPool', day);
const slotsCol = (day: string) => collection(db, 'taskPool', day, 'slots');

export const subscribePoolDay = (day: string, cb: (d: PoolDay | null) => void): (() => void) => {
  try {
    return onSnapshot(
      dayRef(day),
      s => cb(s.exists() ? toPoolDay(s.data()) : null),
      () => cb(null),
    );
  } catch {
    cb(null);
    return () => undefined;
  }
};

export const subscribePoolSlots = (day: string, cb: (s: PoolSlot[]) => void): (() => void) => {
  try {
    return onSnapshot(
      query(slotsCol(day), limit(300)),
      snap => cb(snap.docs.map(d => toPoolSlot(d.id, d.data())).filter((x): x is PoolSlot => !!x)),
      () => cb([]),
    );
  } catch {
    cb([]);
    return () => undefined;
  }
};

export const subscribeMyPoolDay = (day: string, uid: string, cb: (u: PoolUserDay) => void): (() => void) => {
  try {
    return onSnapshot(
      doc(db, 'taskPool', day, 'users', uid),
      s => cb(toPoolUserDay(s.exists() ? s.data() : null)),
      () => cb(toPoolUserDay(null)),
    );
  } catch {
    cb(toPoolUserDay(null));
    return () => undefined;
  }
};

const callPool = async (fn: 'taskPoolClaim' | 'taskPoolComplete', day: string, slotId: string): Promise<any> => {
  if (!TASK_POOL_ENDPOINT) throw new Error('Shared tasks are coming soon.');
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Please sign in again.');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(`${TASK_POOL_ENDPOINT.replace(/\/+$/, '')}/${fn}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, slotId }),
      signal: ctl.signal,
    });
    let j: any = null;
    try {
      j = await r.json();
    } catch {
      j = null;
    }
    if (!r.ok || !j?.ok) throw new Error(j?.message || 'Please try again in a minute.');
    return j;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Please check your internet and try again.');
    throw e instanceof Error ? e : new Error('Please try again in a minute.');
  } finally {
    clearTimeout(t);
  }
};

// Take one open slot. Returns when the claim ends (ms).
export const claimPoolSlot = async (day: string, slotId: string): Promise<{ expiresAt: number; rewardCoins: number }> => {
  const j = await callPool('taskPoolClaim', day, slotId);
  return { expiresAt: Number(j.expiresAt) || 0, rewardCoins: Number(j.rewardCoins) || 0 };
};

// Task done: the server checks it and adds the coins (pending). Returns the coins added.
export const completePoolSlot = async (day: string, slotId: string): Promise<number> => {
  const j = await callPool('taskPoolComplete', day, slotId);
  return Number(j.coins) || 0;
};

// ── Admin ──
export const savePoolSettings = async (
  day: string,
  adminUid: string,
  s: { budgetCoins: number; claimMinutes: number; perUserCap: number },
): Promise<void> => {
  try {
    await runTransaction(db, async tx => {
      const cur = await tx.get(dayRef(day));
      const paid = cur.exists() ? toPoolDay(cur.data())?.paidCoins || 0 : 0;
      const c = checkPoolSettings(s.budgetCoins, s.claimMinutes, s.perUserCap, paid);
      if (!c.ok) throw Object.assign(new Error(c.message), { local: true });
      const fields = { ...s, updatedAt: serverTimestamp(), updatedBy: adminUid };
      if (cur.exists()) tx.update(dayRef(day), fields);
      else tx.set(dayRef(day), { ...fields, paidCoins: 0 });
    });
  } catch (e: any) {
    if (e?.local) throw e;
    throw new Error(firestoreErrorMessage(e, 'Saving shared tasks'));
  }
};

export const addPoolSlots = async (day: string, taskType: PoolTaskType, rewardCoins: number, count: number): Promise<void> => {
  const c = checkNewSlots(rewardCoins, count);
  if (!c.ok) throw new Error(c.message);
  try {
    // Small batches (rules evaluate isAdmin() per write)
    for (let i = 0; i < count; i += 10) {
      const b = writeBatch(db);
      for (let j = i; j < Math.min(count, i + 10); j++) {
        b.set(doc(slotsCol(day)), {
          taskType,
          rewardCoins,
          status: 'open',
          claimedBy: null,
          claimExpiresAt: null,
          createdAt: serverTimestamp(),
        });
      }
      await b.commit();
    }
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Adding slots'));
  }
};

// Only open (or expired) slots can be removed
export const deletePoolSlot = async (day: string, slotId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'taskPool', day, 'slots', slotId));
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Removing slot'));
  }
};
