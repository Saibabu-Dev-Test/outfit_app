// Profile + daily streak in Firestore users/{uid}. Avatar is a base64 data URI in users/{uid}.avatarUrl
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { localDateKey, yesterdayKey } from '../utils/date';
import { MAX_BASE64_CHARS } from '../utils/imagePicker';

export interface StoredProfile {
  name?: string;
  phoneNumber?: string;
  dob?: string;
  timeOfBirth?: string;
  rashi?: string;
  language?: string;
  gender?: string;
  bio?: string;
  avatarUrl?: string | null;
  isPublic?: boolean; // for a later public feed; default true
  lastLoginDate?: string;
  streak?: number;
}

const PROFILE_KEYS: (keyof StoredProfile)[] = [
  'name', 'phoneNumber', 'dob', 'timeOfBirth', 'rashi', 'language', 'gender',
  'bio', 'avatarUrl', 'isPublic', 'lastLoginDate', 'streak',
];

// Returns {} when missing or on error (never throws)
export const getUserProfile = async (uid: string): Promise<StoredProfile> => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return {};
    const data: any = snap.data() || {};
    const out: StoredProfile = {};
    PROFILE_KEYS.forEach(k => {
      if (data[k] !== undefined && data[k] !== null) (out as any)[k] = data[k];
    });
    return out;
  } catch (e: any) {
    console.warn('getUserProfile failed:', e?.code, e?.message);
    return {};
  }
};

// Merge into users/{uid}. Throws Error with a readable message.
export const saveUserProfile = async (uid: string, data: StoredProfile): Promise<void> => {
  const clean: any = {};
  Object.entries(data).forEach(([k, v]) => {
    if (v !== undefined) clean[k] = v;
  });
  try {
    await setDoc(doc(db, 'users', uid), { ...clean, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e: any) {
    console.warn('saveUserProfile failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Saving profile'));
  }
};

// Save avatar data URI on the user doc
export const uploadAvatar = async (uid: string, dataUri: string): Promise<string> => {
  if (dataUri.length > MAX_BASE64_CHARS + 100) {
    throw new Error('This photo is too large to save. Please pick a smaller photo.');
  }
  await saveUserProfile(uid, { avatarUrl: dataUri });
  return dataUri;
};

// Marks today's login and updates the consecutive-day streak. Never throws.
export const recordDailyLogin = async (
  uid: string,
): Promise<{ streak: number; lastLoginDate: string }> => {
  const today = localDateKey();
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const data: any = snap.exists() ? snap.data() : {};
    const last: string | undefined = data?.lastLoginDate;
    const prevStreak: number = typeof data?.streak === 'number' ? data.streak : 0;
    if (last === today) return { streak: Math.max(prevStreak, 1), lastLoginDate: today };
    const streak = last === yesterdayKey() ? prevStreak + 1 : 1;
    const update: any = { lastLoginDate: today, streak };
    if (typeof data?.isPublic !== 'boolean') update.isPublic = true;
    await setDoc(doc(db, 'users', uid), update, { merge: true });
    return { streak, lastLoginDate: today };
  } catch (e: any) {
    console.warn('recordDailyLogin failed:', e?.code, e?.message);
    return { streak: 1, lastLoginDate: today };
  }
};
