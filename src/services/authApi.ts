// Login = Google account on this device + mobile number + password (no OTP/SMS).
// Firebase user = Google provider + Email/Password provider (same Gmail address).
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  User,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authErrorMessage, firestoreErrorMessage, SERVER_SETUP_MESSAGE } from '../utils/firebaseErrors';
import { lookupReferralCode, saveReferral } from './rewardsApi';
import { getGoogleAccount, googleSignOut } from './googleAuth';

export interface AuthResponse {
  message: string;
  user?: {
    id: string;
    phoneNumber: string;
    email: string;
    createdAt?: any;
  };
}

// Result of a "Continue with Google" step
export interface GoogleStepResponse {
  message: string;
  email?: string; // set on success
  name?: string | null;
  cancelled?: boolean;
}

// +919876543210 -> 9876543210 (other countries keep their code: +14155550100 -> 14155550100)
export const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return phone.trim().startsWith('+91') ? digits.slice(2) : digits;
};

const NOT_LINKED = 'This mobile number is not linked to this Google account';

const silentSignOut = async () => {
  try {
    await signOut(auth);
  } catch {
    // ignore
  }
};

// Reads users/{uid}; data is undefined when the read itself failed (code says why)
const readUserDoc = async (uid: string): Promise<{ data?: any; code?: string }> => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return { data: snap.exists() ? snap.data() || {} : {} };
  } catch (e: any) {
    console.warn('users doc read failed:', e?.code, e?.message);
    return { code: e?.code || 'unknown' };
  }
};

// Read failure -> message. permission-denied is a server problem, not the user's.
const readFailMessage = (code?: string, what = 'check your mobile number') =>
  code === 'permission-denied'
    ? SERVER_SETUP_MESSAGE
    : `Could not ${what}. Check your internet and try again.`;

const hasPasswordProvider = (user: User) =>
  user.providerData.some(p => p.providerId === 'password');

// Google picker (or silent) -> Firebase signInWithCredential
const googleFirebaseSignIn = async (
  silentFirst: boolean,
): Promise<{ user?: User; email?: string; name?: string | null; res?: GoogleStepResponse }> => {
  const g = await getGoogleAccount(silentFirst);
  if (!g.email || !g.idToken) {
    return { res: { message: g.message || 'Google sign-in failed', cancelled: g.cancelled } };
  }
  try {
    const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(g.idToken));
    return { user: cred.user, email: g.email, name: g.name };
  } catch (error: any) {
    console.warn('Firebase Google sign-in error:', error?.code, error?.message);
    return { res: { message: authErrorMessage(error?.code, 'Google sign-in failed') } };
  }
};

// LOGIN step 1: get the Google email on this device (no Firebase sign-in yet)
export const pickGoogleAccountForLogin = async (silentFirst = true): Promise<GoogleStepResponse> => {
  const g = await getGoogleAccount(silentFirst);
  if (!g.email) return { message: g.message || 'Google sign-in failed', cancelled: g.cancelled };
  return { message: 'Google account selected', email: g.email, name: g.name };
};

// LOGIN step 2: Google email + password, then the mobile must match users/{uid}.phone
export const loginWithGoogleEmailPhoneAndPassword = async ({
  email,
  phoneNumber,
  password,
}: {
  email: string;
  phoneNumber: string;
  password: string;
}): Promise<AuthResponse> => {
  let user: User;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    user = cred.user;
  } catch (error: any) {
    console.warn('Firebase Login Error:', error?.code, error?.message);
    return { message: authErrorMessage(error?.code, 'Login failed') };
  }

  const { data, code } = await readUserDoc(user.uid);
  if (data === undefined) {
    await silentSignOut();
    return { message: readFailMessage(code) };
  }
  if (!data.phone) {
    await silentSignOut();
    return { message: 'Sign-up was not finished for this Google account. New here? Sign up' };
  }
  if (data.phone !== normalizePhone(phoneNumber)) {
    await silentSignOut();
    return { message: NOT_LINKED };
  }

  return {
    message: 'Login successful!',
    user: {
      id: user.uid,
      phoneNumber: data.phoneNumber || phoneNumber,
      email: user.email ?? email,
      createdAt: data.createdAt,
    },
  };
};

// SIGN UP step 1: Google -> Firebase. Stops if this Google account already finished sign-up.
export const startGoogleSignUp = async (): Promise<GoogleStepResponse> => {
  const r = await googleFirebaseSignIn(false);
  if (!r.user) return r.res!;
  const { data } = await readUserDoc(r.user.uid);
  if (data?.phone && hasPasswordProvider(r.user)) {
    await silentSignOut();
    return { message: 'This Google account is already registered. Please sign in.' };
  }
  return { message: 'Google account connected', email: r.email, name: r.name };
};

// SIGN UP step 2: claim phones/{digits}, add password to the Google user, save profile
export const completeSignUp = async ({
  phoneNumber,
  password,
  name,
  gender,
  referralCode,
}: {
  phoneNumber: string;
  password: string;
  name?: string;
  gender?: string;
  referralCode?: string;
}): Promise<AuthResponse> => {
  const user = auth.currentUser;
  const email = user?.email?.toLowerCase();
  if (!user || !email) {
    return { message: 'Please continue with Google first' };
  }
  const digits = normalizePhone(phoneNumber);
  const phoneRef = doc(db, 'phones', digits);

  // 0) Optional referral code must be valid before anything is written
  let referrerId: string | null = null;
  if (referralCode?.trim()) {
    const ref = await lookupReferralCode(referralCode, user.uid);
    if (!ref.ok) return { message: ref.message };
    referrerId = ref.referrerId;
  }

  // 1) Is the number free? Only "taken" when phones/{digits} belongs to another uid.
  //    Same uid = an earlier sign-up stopped half way, so continue.
  let claimedNow = false;
  try {
    const snap = await getDoc(phoneRef);
    if (snap.exists() && snap.data()?.uid !== user.uid) {
      return { message: 'This mobile number is already registered. Please sign in.' };
    }
    if (!snap.exists()) {
      // Rules allow create only if the doc doesn't exist yet
      await setDoc(phoneRef, { uid: user.uid, createdAt: serverTimestamp() });
      claimedNow = true;
    }
  } catch (e: any) {
    console.warn('phones claim failed:', e?.code, e?.message);
    if (e?.code === 'permission-denied') {
      // Someone may have claimed it a moment ago; otherwise the rules are the problem
      try {
        const again = await getDoc(phoneRef);
        if (again.exists() && again.data()?.uid !== user.uid) {
          return { message: 'This mobile number is already registered. Please sign in.' };
        }
      } catch (e2: any) {
        console.warn('phones re-check failed:', e2?.code, e2?.message);
      }
      return { message: SERVER_SETUP_MESSAGE };
    }
    return { message: firestoreErrorMessage(e, 'Checking mobile number') };
  }

  // 2) Add email/password (same Gmail) to the Google user
  try {
    const cred = EmailAuthProvider.credential(email, password);
    if (hasPasswordProvider(user)) {
      // Earlier sign-up stopped half way: confirm it's the same password
      await reauthenticateWithCredential(user, cred);
    } else {
      await linkWithCredential(user, cred);
    }
  } catch (error: any) {
    console.warn('Link password error:', error?.code, error?.message);
    if (claimedNow) {
      await deleteDoc(phoneRef).catch(() => {});
    }
    return { message: authErrorMessage(error?.code, 'Sign up failed') };
  }

  // 3) Profile (login needs users/{uid}.phone, so this must succeed)
  const formatted = phoneNumber.startsWith('+') ? phoneNumber : `+${digits}`;
  const profile: any = {
    phone: digits,
    phoneNumber: formatted,
    email,
    isPublic: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (name?.trim()) profile.name = name.trim();
  if (gender) profile.gender = gender;
  try {
    await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
  } catch (e: any) {
    console.warn('users doc save failed:', e?.code, e?.message);
    return { message: `${firestoreErrorMessage(e, 'Saving profile')} Tap Sign Up again to retry.` };
  }

  // 4) Referral (create-only, never blocks sign-up)
  if (referrerId && referralCode) {
    await saveReferral(user.uid, referralCode, referrerId);
  }

  return {
    message: 'Registration successful!',
    user: { id: user.uid, phoneNumber: formatted, email, createdAt: new Date() },
  };
};

// FORGOT step 1: Google -> Firebase; the account must have finished sign-up
export const startForgotPassword = async (): Promise<GoogleStepResponse> => {
  const r = await googleFirebaseSignIn(false);
  if (!r.user) return r.res!;
  const { data, code } = await readUserDoc(r.user.uid);
  if (data === undefined) {
    await silentSignOut();
    return { message: readFailMessage(code, 'load your account') };
  }
  if (!data.phone) {
    await silentSignOut();
    return { message: 'No account found for this Google account. New here? Sign up' };
  }
  return { message: 'Google account verified', email: r.email, name: r.name };
};

// FORGOT step 2: mobile must match, then set the new password. Signs out after.
export const resetPasswordWithPhone = async ({
  phoneNumber,
  newPassword,
}: {
  phoneNumber: string;
  newPassword: string;
}): Promise<{ message: string; success: boolean }> => {
  const user = auth.currentUser;
  if (!user?.email) return { message: 'Please continue with Google first', success: false };

  const { data, code } = await readUserDoc(user.uid);
  if (data === undefined) {
    return { message: readFailMessage(code), success: false };
  }
  if (!data.phone || data.phone !== normalizePhone(phoneNumber)) {
    return { message: NOT_LINKED, success: false };
  }

  try {
    if (hasPasswordProvider(user)) {
      await updatePassword(user, newPassword);
    } else {
      await linkWithCredential(user, EmailAuthProvider.credential(user.email, newPassword));
    }
  } catch (error: any) {
    console.warn('Update password error:', error?.code, error?.message);
    return { message: authErrorMessage(error?.code, 'Could not change password'), success: false };
  }

  await silentSignOut();
  return { message: 'Password changed. Sign in with your new password.', success: true };
};

// Leaving sign-up / forgot half way: drop the Firebase session (keeps Google on device)
export const cancelAuthFlow = async (): Promise<void> => {
  await silentSignOut();
};

// "Use another account": sign out of Google and Firebase
export const switchGoogleAccount = async (): Promise<void> => {
  await googleSignOut();
  await silentSignOut();
};

export interface ProfileStat {
  label: string;
  value: string;
}

export interface UserProfile {
  id: string;
  phoneNumber: string;
  name?: string;
  dob?: string;
  timeOfBirth?: string;
  rashi?: string;
  language?: string;
  gender?: string;
  bio?: string;
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  stats?: ProfileStat[];
  styleDna?: string[];
}

export interface ProfileResponse {
  message: string;
  user: UserProfile;
}

// Saved session on app start: the persisted Firebase user, if sign-up was finished.
// 'none' = show login, 'offline' = couldn't read the profile (still a finished account).
export type RestoreResult =
  | { status: 'ok'; user: UserProfile & { email?: string } }
  | { status: 'none' };

export const restoreSession = async (user: User): Promise<RestoreResult> => {
  const { data, code } = await readUserDoc(user.uid);
  if (data === undefined) {
    // Offline etc.: trust a finished account (password linked), fill the profile later
    if (code !== 'permission-denied' && hasPasswordProvider(user)) {
      return { status: 'ok', user: { id: user.uid, phoneNumber: '', email: user.email ?? undefined } };
    }
    return { status: 'none' };
  }
  if (!data.phone || !hasPasswordProvider(user)) {
    // Half-finished sign-up: drop the session so the login screen starts clean
    await silentSignOut();
    return { status: 'none' };
  }
  return {
    status: 'ok',
    user: {
      id: user.uid,
      phoneNumber: data.phoneNumber || `+${data.phone}`,
      email: user.email ?? undefined,
      name: data.name,
      gender: data.gender,
      rashi: data.rashi,
      avatarUrl: data.avatarUrl ?? null,
      dob: data.dob,
      language: data.language,
      timeOfBirth: data.timeOfBirth,
      bio: data.bio,
    },
  };
};

// App keys in AsyncStorage (Firebase's own session key is removed by signOut)
const clearAppStorage = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter(k => k.startsWith('outfit:'));
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch (e: any) {
    console.warn('Clear storage failed:', e?.message);
  }
};

export const logoutUser = async (): Promise<{ message: string; success: boolean }> => {
  await clearAppStorage();
  // Also sign out of Google so the next login can pick an account
  await googleSignOut();
  try {
    await signOut(auth);
    return { message: 'Logged out successfully', success: true };
  } catch {
    return { message: 'Logged out locally', success: true };
  }
};

export interface UpdateProfilePayload {
  userId?: number | string;
  name?: string;
  dob?: string;
  timeOfBirth?: string;
  rashi?: string;
  language?: string;
  gender?: string;
  bio?: string;
  phoneNumber?: string;
  avatarUrl?: string | null;
}
