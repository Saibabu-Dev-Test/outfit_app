// Admin stats: how many users, by gender and age group. Spark-friendly: one server count for the
// total, then a one-time paged read of users/ by the admin (rules: isAdmin() may read every user),
// counted on the phone. Gender uses the same mapping as the wardrobe (genderKey), age comes from
// users/{uid}.dob ('YYYY-MM-DD', ageFromDob). Nothing is written.
import {
  collection,
  documentId,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  QueryDocumentSnapshot,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { genderKey } from '../constants/wardrobe';
import { ageFromDob } from './userApi';
import { localDateKey } from '../utils/date';

export type GenderGroup = 'female' | 'male' | 'other';
export type AgeGroup = 'under18' | '18-24' | '25-34' | '35+' | 'unknown';

export const GENDER_GROUPS: GenderGroup[] = ['female', 'male', 'other'];
export const AGE_GROUPS: AgeGroup[] = ['under18', '18-24', '25-34', '35+', 'unknown'];
export const GENDER_LABEL: Record<GenderGroup, string> = {
  female: '👩 Girls (female)',
  male: '👨 Boys (male)',
  other: '❔ Other / not set',
};
export const AGE_LABEL: Record<AgeGroup, string> = {
  under18: 'Under 18',
  '18-24': '18-24',
  '25-34': '25-34',
  '35+': '35+',
  unknown: 'Age unknown',
};

type AgeCounts = Record<AgeGroup, number>;

export interface UserStats {
  total: number; // server count of users/
  counted: number; // users read for the breakdown
  gender: Record<GenderGroup, number>;
  age: AgeCounts; // everyone
  ageByGender: Record<GenderGroup, AgeCounts>;
  at: Date;
}

const PAGE = 300;
const MAX_USERS = 5000; // ~5000 reads at most per refresh (Spark: 50k reads / day)

const emptyAges = (): AgeCounts => ({ under18: 0, '18-24': 0, '25-34': 0, '35+': 0, unknown: 0 });

export const ageGroupOf = (dob?: string | null): AgeGroup => {
  const age = ageFromDob(dob);
  if (age === null) return 'unknown';
  if (age < 18) return 'under18';
  if (age <= 24) return '18-24';
  if (age <= 34) return '25-34';
  return '35+';
};

export const genderGroupOf = (gender?: string | null): GenderGroup => genderKey(gender) || 'other';

// Admin only. Throws a readable message when the read is refused or fails.
export const getUserStats = async (): Promise<UserStats> => {
  const col = collection(db, 'users');
  const stats: UserStats = {
    total: 0,
    counted: 0,
    gender: { female: 0, male: 0, other: 0 },
    age: emptyAges(),
    ageByGender: { female: emptyAges(), male: emptyAges(), other: emptyAges() },
    at: new Date(),
  };
  try {
    stats.total = (await getCountFromServer(col)).data().count;
  } catch (e: any) {
    console.warn('users count failed:', e?.code, e?.message);
  }
  try {
    let last: QueryDocumentSnapshot | null = null;
    while (stats.counted < MAX_USERS) {
      const q: any = last
        ? query(col, orderBy(documentId()), startAfter(last), limit(PAGE))
        : query(col, orderBy(documentId()), limit(PAGE));
      const snap = await getDocs(q);
      snap.docs.forEach((d: any) => {
        const u = d.data() || {};
        const g = genderGroupOf(u.gender);
        const a = ageGroupOf(u.dob);
        stats.gender[g] += 1;
        stats.age[a] += 1;
        stats.ageByGender[g][a] += 1;
        stats.counted += 1;
      });
      if (snap.docs.length < PAGE) break;
      last = snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot;
    }
  } catch (e: any) {
    console.warn('users read for stats failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Loading user stats'));
  }
  if (!stats.total) stats.total = stats.counted;
  stats.at = new Date();
  return stats;
};

// ── 👥 Users (Me tab, admins only): four server-side count() aggregations, no user docs read ──
// (Spark: each count costs 1 read per 1000 users matched.) Active today uses users/{uid}.lastLoginDate
// ('YYYY-MM-DD', written once a day by recordDailyLogin together with lastActive), so every app
// version counts. "This week" starts Monday 00:00 local time.
export interface UserCounts {
  total: number | null;
  newToday: number | null;
  newThisWeek: number | null;
  activeToday: number | null;
  at: Date;
}

export const startOfToday = (now: Date = new Date()): Date =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate());

export const startOfWeek = (now: Date = new Date()): Date => {
  const d = startOfToday(now);
  const back = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - back);
  return d;
};

const countOf = async (q: any): Promise<number | null> => {
  try {
    return (await getCountFromServer(q)).data().count;
  } catch (e: any) {
    console.warn('user count failed:', e?.code, e?.message);
    return null;
  }
};

// Admin only (rules: isAdmin() may read every user). Throws when every count is refused.
export const getUserCounts = async (): Promise<UserCounts> => {
  const col = collection(db, 'users');
  const now = new Date();
  const [total, newToday, newThisWeek, activeToday] = await Promise.all([
    countOf(col),
    countOf(query(col, where('createdAt', '>=', Timestamp.fromDate(startOfToday(now))))),
    countOf(query(col, where('createdAt', '>=', Timestamp.fromDate(startOfWeek(now))))),
    countOf(query(col, where('lastLoginDate', '==', localDateKey(now)))),
  ]);
  if (total === null && newToday === null && newThisWeek === null && activeToday === null) {
    throw new Error('Could not load user counts (admins only). Pull down to try again.');
  }
  return { total, newToday, newThisWeek, activeToday, at: new Date() };
};
