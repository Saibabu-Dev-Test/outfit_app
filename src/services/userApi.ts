// Profile + daily streak in Firestore users/{uid}. Avatar is a base64 data URI in users/{uid}.avatarUrl
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { localDateKey, yesterdayKey } from '../utils/date';
import { MAX_BASE64_CHARS } from '../utils/imagePicker';
import type { StoredAstroChart } from './birthProfile';

export interface StoredProfile {
  name?: string;
  phoneNumber?: string;
  phone?: string; // login key (digits), written only at sign up
  dob?: string;
  timeOfBirth?: string;
  placeOfBirth?: string; // 'City, State' from constants/indianCities.ts
  rashi?: string;
  language?: string;
  gender?: string;
  maritalStatus?: string; // 'Single' | 'Married' | 'Prefer not to say' (astrology relationship wording)
  astroChart?: StoredAstroChart | null; // auto-filled birth chart (services/birthProfile.ts)
  birthConfirmed?: boolean; // user ticked "Confirm birth details"
  birthConfirmedKey?: string | null; // birthKey() of the details that were confirmed
  bio?: string;
  avatarUrl?: string | null;
  isPublic?: boolean; // public profile; default true
  nameLower?: string; // lowercase name for prefix search
  role?: string; // 'admin' is set by hand in the Firebase console; the app never writes it
  lastLoginDate?: string;
  streak?: number;
  stylePrefs?: string[]; // multi-select style preference
}

// Style preference options (Profile > Style preference)
export const STYLE_OPTIONS = [
  'Casual',
  'Formal',
  'Ethnic / Traditional',
  'Streetwear',
  'Sporty',
  'Party',
  'Minimal',
  'Trendy / Fashion-forward',
  'Business casual',
  'Bohemian',
  'Classic',
  'Indo-western',
];

// Age in years from 'YYYY-MM-DD' (null when missing or invalid)
export const ageFromDob = (dob?: string | null, now: Date = new Date()): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dob || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  let age = now.getFullYear() - y;
  if (now.getMonth() < mo || (now.getMonth() === mo && now.getDate() < d)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
};

const PROFILE_KEYS: (keyof StoredProfile)[] = [
  'name', 'phoneNumber', 'phone', 'dob', 'timeOfBirth', 'placeOfBirth', 'rashi', 'language', 'gender', 'maritalStatus', 'astroChart', 'birthConfirmed', 'birthConfirmedKey',
  'bio', 'avatarUrl', 'isPublic', 'nameLower', 'role', 'lastLoginDate', 'streak', 'stylePrefs',
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
  delete clean.role; // rules reject role changes; never send it
  if (typeof clean.name === 'string') clean.nameLower = clean.name.trim().toLowerCase();
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
    // lastActive: once a day (admin 👥 Users counts active-today with lastLoginDate, same value)
    const update: any = { lastLoginDate: today, lastActive: today, streak };
    if (typeof data?.isPublic !== 'boolean') update.isPublic = true;
    // Backfill the search field for profiles saved before Phase 2
    if (typeof data?.name === 'string' && data.name.trim() && typeof data?.nameLower !== 'string') {
      update.nameLower = data.name.trim().toLowerCase();
    }
    await setDoc(doc(db, 'users', uid), update, { merge: true });
    return { streak, lastLoginDate: today };
  } catch (e: any) {
    console.warn('recordDailyLogin failed:', e?.code, e?.message);
    return { streak: 1, lastLoginDate: today };
  }
};

// Avatars bigger than this are not copied onto messages/posts (keeps docs small)
export const MAX_INLINE_AVATAR = 60000;
export const inlineAvatar = (uri?: string | null): string | null =>
  uri && uri.length <= MAX_INLINE_AVATAR ? uri : null;

// Role from users/{uid}.role. Never throws.
export const getMyRole = async (uid?: string | null): Promise<string | null> => {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const role = snap.exists() ? (snap.data() as any)?.role : null;
    return typeof role === 'string' ? role : null;
  } catch (e: any) {
    console.warn('getMyRole failed:', e?.code, e?.message);
    return null;
  }
};

export interface PublicUser {
  id: string;
  name: string;
  bio: string;
  rashi: string;
  avatarUrl: string | null;
  isPublic: boolean;
  stylePrefs: string[];
}

const toPublicUser = (id: string, d: any): PublicUser => ({
  id,
  name: (d?.name || '').trim() || 'Outfit user',
  bio: d?.bio || '',
  rashi: d?.rashi || '',
  avatarUrl: d?.avatarUrl || null,
  isPublic: d?.isPublic !== false,
  stylePrefs: Array.isArray(d?.stylePrefs) ? d.stylePrefs.filter((x: any) => typeof x === 'string') : [],
});

export type PublicUserResult =
  | { status: 'ok'; user: PublicUser }
  | { status: 'private' | 'missing' | 'error'; user: null; message?: string };

// Another user's profile. Rules deny reading a private profile, which we report as 'private'.
export const getPublicUser = async (uid: string): Promise<PublicUserResult> => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return { status: 'missing', user: null };
    return { status: 'ok', user: toPublicUser(uid, snap.data()) };
  } catch (e: any) {
    if (e?.code === 'permission-denied') return { status: 'private', user: null };
    console.warn('getPublicUser failed:', e?.code, e?.message);
    return { status: 'error', user: null, message: firestoreErrorMessage(e, 'Loading profile') };
  }
};

// Public profiles whose name starts with the text. Throws a readable Error.
// Uses isPublic == true + a range on nameLower (composite index users: isPublic ASC, nameLower ASC).
// Without that index it falls back to scanning public profiles on the device.
export const searchUsers = async (text: string, max = 20): Promise<PublicUser[]> => {
  const p = text.trim().toLowerCase();
  if (!p) return [];
  const users = collection(db, 'users');
  try {
    const snap = await getDocs(
      query(
        users,
        where('isPublic', '==', true),
        where('nameLower', '>=', p),
        where('nameLower', '<=', p + '\uf8ff'),
        orderBy('nameLower'),
        limit(max),
      ),
    );
    return snap.docs.map(d => toPublicUser(d.id, d.data()));
  } catch (e: any) {
    if (e?.code !== 'failed-precondition') {
      console.warn('searchUsers failed:', e?.code, e?.message);
      throw new Error(firestoreErrorMessage(e, 'Search'));
    }
  }
  // Index not created yet: filter public profiles here
  try {
    const snap = await getDocs(query(users, where('isPublic', '==', true), limit(300)));
    return snap.docs
      .map(d => ({ d, nl: String((d.data() as any)?.nameLower || (d.data() as any)?.name || '').toLowerCase() }))
      .filter(x => x.nl.startsWith(p))
      .sort((a, b) => a.nl.localeCompare(b.nl))
      .slice(0, max)
      .map(x => toPublicUser(x.d.id, x.d.data()));
  } catch (e: any) {
    console.warn('searchUsers fallback failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Search'));
  }
};
