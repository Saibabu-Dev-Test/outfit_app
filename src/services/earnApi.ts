// Earn tab data (Firestore). Pure maths lives in earnLedger.ts, numbers in config/earn.ts.
//
//   users/{uid}/earnDaily/{yyyy-mm-dd IST}  {adWatched, voted, checkedIn, adsCount, adSkipped, updatedAt}  owner writes
//   users/{uid}/earnings/{id}                ledger; the app may only add small 'pending' ad/vote/checkin
//                                            coins (ids ad_{day}_{n}, vote_{day}, checkin_{day}); survey /
//                                            offer / referral credits and every approval come from the server
//   users/{uid}/earnMeta/main                {surveyAdClearedAt, deviceHash, upiHash, upi, updatedAt}
//   devices/{deviceHash}  {uid}              one account per phone (create-only)
//   upiIds/{sha256(upi)}  {uid}              one account per UPI id (create-only)
//   withdrawals/{id}      {uid, upi, coins, rupees, status, createdAt}  admin pays + marks paid
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import {
  COINS_PER_RUPEE,
  CPX_HASH_ENDPOINT,
  EARN_AD_COINS,
  EARN_CHECKIN_COINS,
  EARN_MAX_ADS_PER_DAY,
  EARN_VOTE_COINS,
  MIN_WITHDRAW_RUPEES,
} from '../config/earn';
import { istDateKey } from '../utils/istDate';
import { isValidUpi, normalizeUpi, sha256Hex } from '../utils/sha256';
import { getDeviceHash } from '../native/deviceId';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { EarnDay, EarnEntry, EMPTY_DAY, Withdrawal, toEarnDay, toEarnEntry } from './earnLedger';

const dayRef = (uid: string, day: string) => doc(db, 'users', uid, 'earnDaily', day);
const earnRef = (uid: string, id: string) => doc(db, 'users', uid, 'earnings', id);
const metaRef = (uid: string) => doc(db, 'users', uid, 'earnMeta', 'main');
const credit = (type: 'ad' | 'vote' | 'checkin', coins: number, day: string) => ({
  type,
  coins,
  rupees: coins / COINS_PER_RUPEE,
  partner: 'app',
  status: 'pending',
  day,
  createdAt: serverTimestamp(),
});

// ── Daily gate ──
export const subscribeEarnDay = (uid: string, day: string, cb: (d: EarnDay) => void): (() => void) => {
  try {
    return onSnapshot(
      dayRef(uid, day),
      s => cb(s.exists() ? toEarnDay(s.data()) : EMPTY_DAY),
      e => {
        console.warn('earn day listen failed:', e?.code, e?.message);
        cb(EMPTY_DAY);
      },
    );
  } catch {
    cb(EMPTY_DAY);
    return () => undefined;
  }
};

// A rewarded ad was watched on the Earn tab: ticks "Watch 1 ad" and adds EARN_AD_COINS (pending) for
// the first EARN_MAX_ADS_PER_DAY ads of the day. skipped: the ad could not load twice; the gate opens
// but no coins are added.
export const recordEarnAd = async (uid: string, opts: { skipped?: boolean } = {}): Promise<number> => {
  const day = istDateKey();
  try {
    return await runTransaction(db, async tx => {
      const s = await tx.get(dayRef(uid, day));
      const d = s.exists() ? toEarnDay(s.data()) : EMPTY_DAY;
      if (opts.skipped || d.adsCount >= EARN_MAX_ADS_PER_DAY) {
        tx.set(
          dayRef(uid, day),
          { adWatched: true, ...(opts.skipped ? { adSkipped: true } : {}), updatedAt: serverTimestamp() },
          { merge: true },
        );
        return 0;
      }
      const n = d.adsCount + 1;
      tx.set(dayRef(uid, day), { adWatched: true, adsCount: n, updatedAt: serverTimestamp() }, { merge: true });
      tx.set(earnRef(uid, `ad_${day}_${n}`), credit('ad', EARN_AD_COINS, day));
      return EARN_AD_COINS;
    });
  } catch (e: any) {
    console.warn('recordEarnAd failed:', e?.code, e?.message);
    return 0;
  }
};

// First outfit vote of the (IST) day. Called from every vote / like path; never throws, one write a day.
let votedSaved = '';
export const markEarnVote = async (uid?: string | null): Promise<void> => {
  if (!uid) return;
  const day = istDateKey();
  if (votedSaved === `${uid}|${day}`) return;
  votedSaved = `${uid}|${day}`;
  try {
    await runTransaction(db, async tx => {
      const s = await tx.get(dayRef(uid, day));
      if (s.exists() && s.data()?.voted === true) return;
      tx.set(dayRef(uid, day), { voted: true, updatedAt: serverTimestamp() }, { merge: true });
      tx.set(earnRef(uid, `vote_${day}`), credit('vote', EARN_VOTE_COINS, day));
    });
  } catch (e: any) {
    votedSaved = '';
    console.warn('markEarnVote failed:', e?.code, e?.message);
  }
};

// Daily check-in (only once the gate is open). Returns the coins added (0 = already done).
export const dailyCheckIn = async (uid: string): Promise<number> => {
  const day = istDateKey();
  try {
    return await runTransaction(db, async tx => {
      const s = await tx.get(dayRef(uid, day));
      const d = s.exists() ? toEarnDay(s.data()) : EMPTY_DAY;
      if (d.checkedIn) return 0;
      if (!d.adWatched || !d.voted) throw new Error('Finish today\'s checklist first.');
      tx.set(dayRef(uid, day), { checkedIn: true, updatedAt: serverTimestamp() }, { merge: true });
      tx.set(earnRef(uid, `checkin_${day}`), credit('checkin', EARN_CHECKIN_COINS, day));
      return EARN_CHECKIN_COINS;
    });
  } catch (e: any) {
    if (!e?.code && e instanceof Error) throw e;
    throw new Error(firestoreErrorMessage(e, 'Check-in'));
  }
};

// ── Ledger ──
export const subscribeEarnings = (uid: string, cb: (entries: EarnEntry[]) => void, max = 300): (() => void) => {
  try {
    return onSnapshot(
      query(collection(db, 'users', uid, 'earnings'), orderBy('createdAt', 'desc'), limit(max)),
      snap => cb(snap.docs.map(d => toEarnEntry(d.id, d.data())).filter((x): x is EarnEntry => !!x)),
      e => {
        console.warn('earnings listen failed:', e?.code, e?.message);
        cb([]);
      },
    );
  } catch {
    cb([]);
    return () => undefined;
  }
};

const toWithdrawal = (id: string, d: any): Withdrawal => ({
  id,
  coins: typeof d?.coins === 'number' ? d.coins : 0,
  rupees: typeof d?.rupees === 'number' ? d.rupees : 0,
  status: d?.status === 'paid' || d?.status === 'rejected' ? d.status : 'pending',
  createdAt: d?.createdAt?.toDate ? d.createdAt.toDate() : null,
});

export const getMyWithdrawals = async (uid: string): Promise<Withdrawal[]> => {
  try {
    const snap = await getDocs(query(collection(db, 'withdrawals'), where('uid', '==', uid), limit(100)));
    return snap.docs.map(d => toWithdrawal(d.id, d.data()));
  } catch (e: any) {
    console.warn('getMyWithdrawals failed:', e?.code, e?.message);
    return [];
  }
};

// ── Survey wall pacing: one ad after each completed survey ──
export interface EarnMeta {
  surveyAdClearedAt: number;
  deviceHash: string | null;
  upi: string | null;
}
export const subscribeEarnMeta = (uid: string, cb: (m: EarnMeta) => void): (() => void) => {
  const empty: EarnMeta = { surveyAdClearedAt: 0, deviceHash: null, upi: null };
  try {
    return onSnapshot(
      metaRef(uid),
      s => {
        const d: any = s.exists() ? s.data() : {};
        cb({
          surveyAdClearedAt: typeof d.surveyAdClearedAt === 'number' ? d.surveyAdClearedAt : 0,
          deviceHash: typeof d.deviceHash === 'string' ? d.deviceHash : null,
          upi: typeof d.upi === 'string' ? d.upi : null,
        });
      },
      () => cb(empty),
    );
  } catch {
    cb(empty);
    return () => undefined;
  }
};

export const clearSurveyAd = async (uid: string, latestSurveyMs: number): Promise<void> => {
  await setDoc(metaRef(uid), { surveyAdClearedAt: latestSurveyMs, updatedAt: serverTimestamp() }, { merge: true });
};

// ── Anti-fraud: one account per phone, one account per UPI id ──
export type BindResult = { ok: true } | { ok: false; message: string };

// Claims devices/{hash} for this account (or confirms it is already ours)
export const bindDevice = async (uid: string): Promise<BindResult> => {
  const { hash } = await getDeviceHash();
  const ref = doc(db, 'devices', hash);
  try {
    const s = await getDoc(ref);
    if (s.exists()) {
      if (s.data()?.uid === uid) return { ok: true };
      return { ok: false, message: 'Earn is already linked to another account on this phone. Only one account per phone can earn.' };
    }
    await runTransaction(db, async tx => {
      const again = await tx.get(ref);
      if (again.exists()) {
        if (again.data()?.uid !== uid) throw Object.assign(new Error('taken'), { taken: true });
        return;
      }
      tx.set(ref, { uid, createdAt: serverTimestamp() });
      tx.set(metaRef(uid), { deviceHash: hash, updatedAt: serverTimestamp() }, { merge: true });
    });
    return { ok: true };
  } catch (e: any) {
    // The rules deny reading another account's device claim
    if (e?.taken || e?.code === 'permission-denied') {
      return { ok: false, message: 'Earn is already linked to another account on this phone. Only one account per phone can earn.' };
    }
    console.warn('bindDevice failed:', e?.code, e?.message);
    return { ok: false, message: 'Could not check this phone. Please check your internet and try again.' };
  }
};

export const upiHash = (upi: string) => sha256Hex(`upi:${normalizeUpi(upi)}`);

// Saves the payout UPI id; refuses one already used by another account
export const saveUpi = async (uid: string, upiRaw: string): Promise<BindResult> => {
  const upi = normalizeUpi(upiRaw);
  if (!isValidUpi(upi)) return { ok: false, message: 'Enter a valid UPI id, like name@okbank.' };
  const h = upiHash(upi);
  const ref = doc(db, 'upiIds', h);
  try {
    await runTransaction(db, async tx => {
      const s = await tx.get(ref);
      if (s.exists() && s.data()?.uid !== uid) throw Object.assign(new Error('taken'), { taken: true });
      if (!s.exists()) tx.set(ref, { uid, createdAt: serverTimestamp() });
      tx.set(metaRef(uid), { upi, upiHash: h, updatedAt: serverTimestamp() }, { merge: true });
    });
    return { ok: true };
  } catch (e: any) {
    if (e?.taken || e?.code === 'permission-denied') {
      return { ok: false, message: 'This UPI id is already linked to another account.' };
    }
    return { ok: false, message: firestoreErrorMessage(e, 'Saving UPI id') };
  }
};

// Withdrawal request (pending until an admin pays it). The server / admin re-checks the balance.
export const requestWithdrawal = async (uid: string, upi: string, rupees: number): Promise<void> => {
  if (rupees < MIN_WITHDRAW_RUPEES) throw new Error(`Minimum withdrawal is ₹${MIN_WITHDRAW_RUPEES}.`);
  try {
    await setDoc(doc(collection(db, 'withdrawals')), {
      uid,
      upi: normalizeUpi(upi),
      rupees,
      coins: rupees * COINS_PER_RUPEE,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Withdrawal request'));
  }
};

// ── CPX secure hash (computed on the server; the secret never ships in the app) ──
export const getCpxHash = async (): Promise<string> => {
  if (!CPX_HASH_ENDPOINT) throw new Error('Surveys are coming soon.');
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Please sign in again.');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(CPX_HASH_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (!j?.hash || typeof j.hash !== 'string') throw new Error('bad response');
    return j.hash;
  } catch {
    throw new Error('Could not open surveys right now. Please try again in a minute.');
  } finally {
    clearTimeout(t);
  }
};

// ── Admin: UPI withdrawal requests ──
export interface AdminWithdrawal extends Withdrawal {
  uid: string;
  upi: string;
}
export const getWithdrawalsForAdmin = async (): Promise<AdminWithdrawal[]> => {
  try {
    const snap = await getDocs(query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'), limit(100)));
    return snap.docs.map(d => {
      const x: any = d.data();
      return { ...toWithdrawal(d.id, x), uid: String(x?.uid || ''), upi: String(x?.upi || '') };
    });
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Loading withdrawals'));
  }
};
// Admin marks a request paid (after sending the money by UPI) or rejected
export const decideWithdrawal = async (id: string, status: 'paid' | 'rejected', adminUid: string): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'withdrawals', id),
      { status, decidedBy: adminUid, decidedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Saving decision'));
  }
};
