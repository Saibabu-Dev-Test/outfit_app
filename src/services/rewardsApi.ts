// Daily tasks, points, referrals and weekly celebrities (all Firestore, no Cloud Functions).
//   users/{uid}/days/{yyyy-mm-dd}  {opened, voted, uploaded, updatedAt}
//   users/{uid}/weeks/{mondayKey}  {fullDays, lastDay, updatedAt}  (days with all 3 tasks)
//   users/{uid}.points             increment(), only together with a day doc change (rules check it)
//   referralCodes/{code} -> {uid}  referrals/{newUid} {referrerId, code, createdAt}
//   weeklyStars/{mondayKey}/members/{uid} {name, avatar, completedDays, createdAt}
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { lastWeekKey, localDateKey, weekDayKeys, weekKeyFor } from '../utils/date';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { inlineAvatar } from './userApi';

export type DailyTask = 'opened' | 'voted' | 'uploaded';
export const DAILY_TASKS: DailyTask[] = ['opened', 'voted', 'uploaded'];
export const TASK_POINTS = 10;
export const ALL_TASKS_BONUS = 20;
export const REFERRAL_POINTS = 50; // per friend who joined (counted, never written)
// Days in a Mon-Sun week with all 3 tasks done to become a weekly celebrity.
// If you change this, change WEEKLY_REQUIRED_DAYS in firestore.rules too.
export const WEEKLY_REQUIRED_DAYS = 7;

export interface DayState {
  opened: boolean;
  voted: boolean;
  uploaded: boolean;
}

const EMPTY_DAY: DayState = { opened: false, voted: false, uploaded: false };

const toDay = (d: any): DayState => ({
  opened: d?.opened === true,
  voted: d?.voted === true,
  uploaded: d?.uploaded === true,
});

export const isFullDay = (d: DayState) => d.opened && d.voted && d.uploaded;

// Points a day is worth (same formula as firestore.rules dayScore)
export const dayScore = (d: DayState): number =>
  (d.opened ? TASK_POINTS : 0) +
  (d.voted ? TASK_POINTS : 0) +
  (d.uploaded ? TASK_POINTS : 0) +
  (isFullDay(d) ? ALL_TASKS_BONUS : 0);

const dayRef = (uid: string, day: string) => doc(db, 'users', uid, 'days', day);
const weekRef = (uid: string, week: string) => doc(db, 'users', uid, 'weeks', week);

// Today's checklist. Never throws.
export const getDay = async (uid: string, day = localDateKey()): Promise<DayState> => {
  try {
    const snap = await getDoc(dayRef(uid, day));
    return snap.exists() ? toDay(snap.data()) : { ...EMPTY_DAY };
  } catch (e: any) {
    console.warn('getDay failed:', e?.code, e?.message);
    return { ...EMPTY_DAY };
  }
};

// One task write at a time per device, so the rules' point math always matches
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
};

type StarProfile = { name?: string | null; avatar?: string | null };
let starProfile: StarProfile = {};
// Home passes the name/avatar used on the celebrities card
export const setStarProfile = (p: StarProfile) => {
  starProfile = { ...starProfile, ...p };
};

export interface TaskResult {
  day: DayState;
  pointsAdded: number;
  error?: string;
}

// Marks a task done for today: day doc + points (+ week counter) in one batch. Never throws.
export const recordTask = (uid: string, task: DailyTask): Promise<TaskResult> =>
  serial(async () => {
    const today = localDateKey();
    const week = weekKeyFor();
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const snap = await getDoc(dayRef(uid, today));
        const before = snap.exists() ? toDay(snap.data()) : { ...EMPTY_DAY };
        if (before[task]) return { day: before, pointsAdded: 0 };
        const after: DayState = { ...before, [task]: true };
        const delta = dayScore(after) - dayScore(before);
        const becameFull = isFullDay(after) && !isFullDay(before);

        const batch = writeBatch(db);
        batch.set(dayRef(uid, today), { ...after, updatedAt: serverTimestamp() }, { merge: true });
        batch.set(
          doc(db, 'users', uid),
          { points: increment(delta), pointsDay: today },
          { merge: true },
        );
        let fullDays = 0;
        if (becameFull) {
          const w = await getDoc(weekRef(uid, week));
          fullDays = (w.exists() ? Number((w.data() as any)?.fullDays) || 0 : 0) + 1;
          batch.set(weekRef(uid, week), { fullDays, lastDay: today, updatedAt: serverTimestamp() });
        }
        await batch.commit();
        if (becameFull && fullDays >= WEEKLY_REQUIRED_DAYS) {
          await claimWeeklyStar(uid, week);
        }
        return { day: after, pointsAdded: delta };
      } catch (e: any) {
        console.warn(`recordTask ${task} failed:`, e?.code, e?.message);
        // A parallel write from another device changed the day: re-read and retry once
        if (attempt === 0 && e?.code !== 'unavailable') continue;
        return { day: await getDay(uid, today), pointsAdded: 0, error: firestoreErrorMessage(e, 'Saving task') };
      }
    }
    return { day: await getDay(uid, today), pointsAdded: 0 };
  });

export const getPoints = async (uid: string): Promise<number> => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const p = snap.exists() ? (snap.data() as any)?.points : 0;
    return typeof p === 'number' ? p : 0;
  } catch (e: any) {
    console.warn('getPoints failed:', e?.code, e?.message);
    return 0;
  }
};

// ── Weekly celebrities ───────────────────────────────────────────────────

export interface WeeklyStar {
  uid: string;
  name: string;
  avatar: string | null;
  completedDays: number;
}

// Writes weeklyStars/{week}/members/{uid} once the week is complete. Never throws.
export const claimWeeklyStar = async (uid: string, week: string): Promise<boolean> => {
  try {
    const mine = doc(db, 'weeklyStars', week, 'members', uid);
    if ((await getDoc(mine)).exists()) return true;
    const w = await getDoc(weekRef(uid, week));
    const fullDays = w.exists() ? Number((w.data() as any)?.fullDays) || 0 : 0;
    if (fullDays < WEEKLY_REQUIRED_DAYS) return false;
    let { name, avatar } = starProfile;
    if (!name) {
      const u = await getDoc(doc(db, 'users', uid));
      const d: any = u.exists() ? u.data() : {};
      name = d?.name;
      avatar = avatar ?? d?.avatarUrl;
    }
    await setDoc(mine, {
      name: (name || '').trim().slice(0, 60) || 'Outfit user',
      avatar: inlineAvatar(avatar),
      completedDays: fullDays,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (e: any) {
    console.warn('claimWeeklyStar failed:', e?.code, e?.message);
    return false;
  }
};

// Claims this week and last week if they are complete but not written yet (e.g. offline before)
export const checkWeeklyStars = async (uid: string): Promise<void> => {
  await claimWeeklyStar(uid, lastWeekKey());
  await claimWeeklyStar(uid, weekKeyFor());
};

// Last week's celebrities for the Home card. Never throws.
export const getLastWeekStars = async (max = 30): Promise<WeeklyStar[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'weeklyStars', lastWeekKey(), 'members'), limit(max)),
    );
    return snap.docs.map(d => {
      const x: any = d.data();
      return {
        uid: d.id,
        name: x?.name || 'Outfit user',
        avatar: x?.avatar || null,
        completedDays: Number(x?.completedDays) || 0,
      };
    });
  } catch (e: any) {
    console.warn('getLastWeekStars failed:', e?.code, e?.message);
    return [];
  }
};

// ⭐ badge: a celebrity of last week (or of this week once finished). Never throws.
export const isWeeklyStar = async (uid: string): Promise<boolean> => {
  try {
    for (const week of [lastWeekKey(), weekKeyFor()]) {
      if ((await getDoc(doc(db, 'weeklyStars', week, 'members', uid))).exists()) return true;
    }
  } catch (e: any) {
    console.warn('isWeeklyStar failed:', e?.code, e?.message);
  }
  return false;
};

// ── Referrals ────────────────────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const newCode = () =>
  Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export const normalizeReferralCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

// The user's own 6-char code, created once. Throws a readable Error.
export const ensureReferralCode = async (uid: string): Promise<string> => {
  let lastError: any = null;
  try {
    const u = await getDoc(doc(db, 'users', uid));
    const existing = u.exists() ? (u.data() as any)?.referralCode : null;
    if (typeof existing === 'string' && existing.length === 6) return existing;
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Loading invite code'));
  }
  for (let i = 0; i < 4; i++) {
    const code = newCode();
    try {
      const codeRef = doc(db, 'referralCodes', code);
      if ((await getDoc(codeRef)).exists()) continue; // taken, try another
      const batch = writeBatch(db);
      batch.set(codeRef, { uid, createdAt: serverTimestamp() });
      batch.set(doc(db, 'users', uid), { referralCode: code }, { merge: true });
      await batch.commit();
      return code;
    } catch (e: any) {
      lastError = e;
      console.warn('ensureReferralCode failed:', e?.code, e?.message);
    }
  }
  throw new Error(firestoreErrorMessage(lastError, 'Creating invite code'));
};

export type ReferralLookup =
  | { ok: true; referrerId: string }
  | { ok: false; message: string };

// Checks a code typed at sign-up. selfUid blocks using your own code.
export const lookupReferralCode = async (code: string, selfUid?: string): Promise<ReferralLookup> => {
  const c = normalizeReferralCode(code);
  if (c.length !== 6) return { ok: false, message: 'Referral code must be 6 letters/numbers' };
  try {
    const snap = await getDoc(doc(db, 'referralCodes', c));
    const referrerId = snap.exists() ? (snap.data() as any)?.uid : null;
    if (!referrerId) return { ok: false, message: 'Referral code not found. Check it or leave it empty.' };
    if (selfUid && referrerId === selfUid) return { ok: false, message: "You can't use your own referral code" };
    return { ok: true, referrerId };
  } catch (e: any) {
    return { ok: false, message: firestoreErrorMessage(e, 'Checking referral code') };
  }
};

// referrals/{newUid}: create-only, written by the new user. Never throws.
export const saveReferral = async (newUid: string, code: string, referrerId: string): Promise<boolean> => {
  if (!referrerId || referrerId === newUid) return false;
  try {
    await setDoc(doc(db, 'referrals', newUid), {
      referrerId,
      code: normalizeReferralCode(code),
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (e: any) {
    console.warn('saveReferral failed:', e?.code, e?.message);
    return false;
  }
};

// "Friends joined: N". Never throws.
export const countFriendsJoined = async (uid: string): Promise<number> => {
  try {
    const snap = await getCountFromServer(
      query(collection(db, 'referrals'), where('referrerId', '==', uid)),
    );
    return snap.data().count;
  } catch (e: any) {
    console.warn('countFriendsJoined failed:', e?.code, e?.message);
    return 0;
  }
};

// ── This week (Achievements) ────────────────────────────────────────────
export interface WeekProgress {
  week: string; // Monday key
  fullDays: number; // days with all 3 tasks (counter doc)
  days: { key: string; state: DayState }[]; // Mon..Sun
}

// Never throws
export const getWeekProgress = async (uid: string): Promise<WeekProgress> => {
  const week = weekKeyFor();
  const keys = weekDayKeys(week);
  const today = localDateKey();
  const [w, days] = await Promise.all([
    getDoc(weekRef(uid, week)).catch(() => null),
    Promise.all(keys.map(k => (k <= today ? getDay(uid, k) : Promise.resolve({ ...EMPTY_DAY })))),
  ]);
  const counted = w && w.exists() ? Number((w.data() as any)?.fullDays) || 0 : 0;
  const fromDays = days.filter(isFullDay).length;
  return {
    week,
    fullDays: Math.max(counted, fromDays),
    days: keys.map((key, i) => ({ key, state: days[i] })),
  };
};
