// Login = Google account on this device + mobile number + password (no OTP/SMS).
// Firebase user = Google provider + Email/Password provider (same Gmail address).
// Firestore rules accept only sessions whose token says sign_in_provider == 'google.com',
// so every flow here ends with a Google re-auth (password checks switch the token to 'password').
import {
  deleteUser,
  EmailAuthProvider,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  linkWithCredential,
  OAuthCredential,
  reauthenticateWithCredential,
  signInWithCredential,
  signOut,
  updatePassword,
  User,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  alreadyRegisteredMessage,
  authErrorMessage,
  firestoreErrorMessage,
  NO_INTERNET,
  notRegisteredMessage,
  phoneNotRegisteredMessage,
  SERVER_SETUP_MESSAGE,
  SIGNUP_UNFINISHED,
  TOO_MANY_ATTEMPTS,
  WRONG_PASSWORD,
} from '../utils/firebaseErrors';
import { lookupReferralCode, saveReferral } from './rewardsApi';
import { consumeRedirectSignIn, getGoogleAccount, googleSignOut } from './googleAuth';
import { Platform } from 'react-native';
import { wipeForPasswordLogin } from '../native/sessionVault';

export interface AuthResponse {
  message: string;
  // Set when the password itself was wrong (used for the 5-tries lock)
  wrongPassword?: boolean;
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

// 9876543210 -> +91 98765 43210 (for messages)
const prettyPhone = (e164: string): string => {
  const d = normalizePhone(e164);
  if (e164.trim().startsWith('+91') && d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  return e164.startsWith('+') ? e164 : `+${d}`;
};

export const SIM_RESET_MESSAGE =
  'Insert the SIM card of your registered mobile number to reset the password.';

const silentSignOut = async () => {
  try {
    await signOut(auth);
  } catch {
    // ignore
  }
};

// ── Google ID token kept in memory for the current flow (valid ~1 h; reused for re-auth) ──
let pendingGoogle: { email: string; idToken: string; name: string | null; at: number } | null = null;
const GOOGLE_TOKEN_MAX_AGE_MS = 45 * 60 * 1000;
// Forgot password: registered number of the Gmail checked in step 1 (digits)
let forgotPhone: { email: string; phone: string } | null = null;

const clearFlowState = () => {
  pendingGoogle = null;
  forgotPhone = null;
};

// Google credential for `email`: cached token, else silent refresh (picker only if needed)
const googleCredentialFor = async (
  email: string,
): Promise<{ cred?: OAuthCredential; message?: string }> => {
  if (pendingGoogle && pendingGoogle.email === email && Date.now() - pendingGoogle.at < GOOGLE_TOKEN_MAX_AGE_MS) {
    return { cred: GoogleAuthProvider.credential(pendingGoogle.idToken) };
  }
  const g = await getGoogleAccount(true);
  if (!g.email || !g.idToken) {
    return { message: g.message || `Continue with Google (${email}) again.` };
  }
  if (g.email !== email) {
    return { message: `You chose ${g.email}. Tap Change and pick ${email}.` };
  }
  pendingGoogle = { email: g.email, idToken: g.idToken, name: g.name ?? null, at: Date.now() };
  return { cred: GoogleAuthProvider.credential(g.idToken) };
};

// Which provider the current ID token was minted for ('google.com', 'password', ...)
const tokenProvider = async (user: User, force: boolean): Promise<string | null> => {
  try {
    return (await user.getIdTokenResult(force)).signInProvider;
  } catch (e: any) {
    console.warn('getIdTokenResult failed:', e?.code);
    return cachedTokenProvider(user);
  }
};

// Offline fallback: read sign_in_provider from the cached ID token (no network)
const cachedTokenProvider = (user: User): string | null => {
  try {
    const jwt: string | undefined = (user as any)?.stsTokenManager?.accessToken;
    const decode: ((s: string) => string) | undefined = (globalThis as any).atob;
    if (!jwt || !decode) return null;
    let part = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (part.length % 4) part += '=';
    return JSON.parse(decode(part))?.firebase?.sign_in_provider ?? null;
  } catch {
    return null;
  }
};

// Make the session token google.com again (after link / password check / updatePassword)
const endWithGoogleToken = async (
  user: User,
  email: string,
): Promise<{ ok: boolean; message?: string }> => {
  if ((await tokenProvider(user, false)) !== 'google.com') {
    const gc = await googleCredentialFor(email);
    if (!gc.cred) return { ok: false, message: gc.message };
    try {
      await reauthenticateWithCredential(user, gc.cred);
    } catch (e: any) {
      console.warn('Google re-auth failed:', e?.code, e?.message);
      return { ok: false, message: authErrorMessage(e?.code, 'Google check') };
    }
  }
  const provider = await tokenProvider(user, true);
  console.log('Session token provider:', provider);
  if (provider !== 'google.com') {
    return { ok: false, message: 'Could not finish the Google check. Try again.' };
  }
  return { ok: true };
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
const readFailMessage = (code?: string) =>
  code === 'permission-denied'
    ? SERVER_SETUP_MESSAGE
    : code === 'unavailable' || code === 'deadline-exceeded'
      ? NO_INTERNET
      : firestoreErrorMessage({ code }, 'Checking your account');

const hasPasswordProvider = (user: User) =>
  user.providerData.some(p => p.providerId === 'password');

// Google picker (or silent) -> Firebase signInWithCredential (token: google.com)
const googleFirebaseSignIn = async (
  silentFirst: boolean,
): Promise<{ user?: User; isNew?: boolean; email?: string; name?: string | null; res?: GoogleStepResponse }> => {
  const g = await getGoogleAccount(silentFirst);
  if (!g.email || !g.idToken) {
    return { res: { message: g.message || '', cancelled: g.cancelled || !g.message } };
  }
  pendingGoogle = { email: g.email, idToken: g.idToken, name: g.name ?? null, at: Date.now() };
  try {
    const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(g.idToken));
    return {
      user: cred.user,
      // Web: the Google popup already created the Firebase user, so ask it too
      isNew: !!getAdditionalUserInfo(cred)?.isNewUser || !!g.isNew,
      email: g.email,
      name: g.name,
    };
  } catch (error: any) {
    console.warn('Firebase Google sign-in error:', error?.code, error?.message);
    const code = error?.code;
    const message =
      code === 'auth/invalid-credential'
        ? 'Google sign-in was rejected by the server. Tap Continue with Google again.'
        : authErrorMessage(code, 'Google sign-in');
    return { res: { message } };
  }
};

// Gmail has no finished account: sign out, drop a just-created empty user, show the picker next time
const rejectUnregistered = async (user: User, isNew: boolean | undefined, email: string) => {
  if (isNew) {
    await deleteUser(user).catch(() => {});
  }
  await silentSignOut();
  await googleSignOut();
  clearFlowState();
  return { message: notRegisteredMessage(email) };
};

// ── LOGIN ──────────────────────────────────────────────────────────────
// Step 1: Google account on this device; it must be registered. Ends signed out of
// Firebase (no session until the password is checked).
export const pickGoogleAccountForLogin = async (silentFirst = true): Promise<GoogleStepResponse> => {
  const r = await googleFirebaseSignIn(silentFirst);
  if (!r.user) return r.res!;
  const email = r.email!;
  const { data, code } = await readUserDoc(r.user.uid);
  if (data === undefined) {
    await silentSignOut();
    return { message: readFailMessage(code) };
  }
  if (!data.phone) return rejectUnregistered(r.user, r.isNew, email);
  await silentSignOut();
  return { message: 'Google account selected', email, name: r.name };
};

// Step 2: Google -> users/{uid} -> mobile -> password -> back to a google.com token
export const loginWithGoogleEmailPhoneAndPassword = async ({
  email,
  phoneNumber,
  password,
}: {
  email: string;
  phoneNumber: string;
  password: string;
}): Promise<AuthResponse> => {
  const gc = await googleCredentialFor(email);
  if (!gc.cred) return { message: gc.message || `Continue with Google (${email}) again.` };

  let user: User;
  let isNew = false;
  try {
    const cred = await signInWithCredential(auth, gc.cred);
    user = cred.user;
    isNew = !!getAdditionalUserInfo(cred)?.isNewUser;
  } catch (error: any) {
    console.warn('Login Google step error:', error?.code, error?.message);
    pendingGoogle = null;
    return { message: authErrorMessage(error?.code, 'Google sign-in') };
  }

  const { data, code } = await readUserDoc(user.uid);
  if (data === undefined) {
    await silentSignOut();
    return { message: readFailMessage(code) };
  }
  if (!data.phone) return rejectUnregistered(user, isNew, email);
  if (data.phone !== normalizePhone(phoneNumber)) {
    await silentSignOut();
    return { message: phoneNotRegisteredMessage(email) };
  }
  if (!hasPasswordProvider(user)) {
    await silentSignOut();
    return { message: SIGNUP_UNFINISHED };
  }

  // Password check (token becomes 'password' for a moment)
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, password));
  } catch (error: any) {
    const c = error?.code;
    console.warn('Password check failed:', c);
    await silentSignOut();
    if (c === 'auth/wrong-password' || c === 'auth/invalid-credential' || c === 'auth/invalid-login-credentials') {
      return { message: WRONG_PASSWORD, wrongPassword: true };
    }
    if (c === 'auth/too-many-requests') return { message: TOO_MANY_ATTEMPTS };
    if (c === 'auth/user-mismatch' || c === 'auth/user-not-found') return { message: SIGNUP_UNFINISHED };
    return { message: authErrorMessage(c, 'Password check') };
  }

  const g = await endWithGoogleToken(user, email);
  if (!g.ok) {
    await silentSignOut();
    return { message: g.message || 'Could not finish the Google check. Try again.' };
  }
  clearFlowState();

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

// ── SIGN UP ────────────────────────────────────────────────────────────
// Step 1: Google -> Firebase (kept signed in for step 2). Stops if already registered.
export const startGoogleSignUp = async (): Promise<GoogleStepResponse> => {
  const r = await googleFirebaseSignIn(false);
  if (!r.user) return r.res!;
  const { data, code } = await readUserDoc(r.user.uid);
  if (data === undefined) {
    await silentSignOut();
    return { message: readFailMessage(code) };
  }
  if (data.phone && hasPasswordProvider(r.user)) {
    await silentSignOut();
    return { message: alreadyRegisteredMessage(r.email) };
  }
  return { message: 'Google account connected', email: r.email, name: r.name };
};

// Step 2: claim phones/{digits} (google.com token), add the password, re-auth with Google,
// then save the profile (also needs the google.com token)
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
    return { message: 'Please continue with Google first.' };
  }
  // A restored session may carry a password token; rules need google.com
  const g0 = await endWithGoogleToken(user, email);
  if (!g0.ok) return { message: g0.message || 'Continue with Google again.' };

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
      return { message: 'This mobile number is already registered with another Gmail. Tap Sign In.' };
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
          return { message: 'This mobile number is already registered with another Gmail. Tap Sign In.' };
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
    const c = error?.code;
    console.warn('Link password error:', c, error?.message);
    // Token may now be 'password': get google.com back before touching Firestore
    await endWithGoogleToken(user, email);
    if (claimedNow) {
      await deleteDoc(phoneRef).catch(() => {});
    }
    if (hasPasswordProvider(user) && (c === 'auth/wrong-password' || c === 'auth/invalid-credential')) {
      return { message: 'This Gmail already has a password from an earlier sign-up. Enter that password.' };
    }
    return { message: authErrorMessage(c, 'Sign up') };
  }
  console.log('Token provider after password link:', await tokenProvider(user, false));

  // 3) Back to a google.com token (rules reject 'password' tokens)
  const g = await endWithGoogleToken(user, email);
  if (!g.ok) {
    return { message: `${g.message || 'Google check failed.'} Tap Create Account again to finish.` };
  }

  // 4) Profile (login needs users/{uid}.phone, so this must succeed)
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
  if (Platform.OS === 'web') {
    // A browser can't read the SIM: the number was typed, not checked
    profile.phoneVerified = false;
    profile.signupSource = 'web';
  }
  try {
    await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
  } catch (e: any) {
    console.warn('users doc save failed:', e?.code, e?.message);
    return { message: `${firestoreErrorMessage(e, 'Saving profile')} Tap Create Account again to retry.` };
  }

  // 5) Referral (create-only, never blocks sign-up)
  if (referrerId && referralCode) {
    await saveReferral(user.uid, referralCode, referrerId);
  }
  clearFlowState();

  return {
    message: 'Registration successful!',
    user: { id: user.uid, phoneNumber: formatted, email, createdAt: new Date() },
  };
};

// ── FORGOT PASSWORD ────────────────────────────────────────────────────
// Step 1: Google -> must be registered. Ends signed out (no session without a password).
export const startForgotPassword = async (): Promise<GoogleStepResponse> => {
  const r = await googleFirebaseSignIn(false);
  if (!r.user) return r.res!;
  const email = r.email!;
  const { data, code } = await readUserDoc(r.user.uid);
  if (data === undefined) {
    await silentSignOut();
    return { message: readFailMessage(code) };
  }
  if (!data.phone) return rejectUnregistered(r.user, r.isNew, email);
  forgotPhone = { email, phone: data.phone };
  await silentSignOut();
  return { message: 'Google account verified', email, name: r.name };
};

// Step 2 (right after the SIM picker): picked number must be the registered one.
// Returns an error line, or null when it matches. Runs in the app only.
export const checkResetSim = (email: string, pickedE164: string): string | null => {
  if (!forgotPhone || forgotPhone.email !== email) return 'Continue with Google again.';
  if (normalizePhone(pickedE164) !== forgotPhone.phone) {
    return `This SIM's number (${prettyPhone(pickedE164)}) isn't the one registered with ${email}. Insert the registered SIM.`;
  }
  return null;
};

// Step 3: Google again -> mobile must match -> new password. Signs out after.
export const resetPasswordWithPhone = async ({
  email,
  phoneNumber,
  newPassword,
}: {
  email: string;
  phoneNumber: string;
  newPassword: string;
}): Promise<{ message: string; success: boolean }> => {
  const simError = checkResetSim(email, phoneNumber);
  if (simError) return { message: simError, success: false };

  const gc = await googleCredentialFor(email);
  if (!gc.cred) return { message: gc.message || 'Continue with Google again.', success: false };
  let user: User;
  try {
    user = (await signInWithCredential(auth, gc.cred)).user;
  } catch (error: any) {
    console.warn('Reset Google step error:', error?.code, error?.message);
    pendingGoogle = null;
    return { message: authErrorMessage(error?.code, 'Google sign-in'), success: false };
  }

  const { data, code } = await readUserDoc(user.uid);
  if (data === undefined) {
    await silentSignOut();
    return { message: readFailMessage(code), success: false };
  }
  if (!data.phone) {
    await silentSignOut();
    return { message: notRegisteredMessage(email), success: false };
  }
  if (data.phone !== normalizePhone(phoneNumber)) {
    await silentSignOut();
    return {
      message: `This SIM's number (${prettyPhone(phoneNumber)}) isn't the one registered with ${email}. Insert the registered SIM.`,
      success: false,
    };
  }

  const setPassword = () =>
    hasPasswordProvider(user)
      ? updatePassword(user, newPassword)
      : linkWithCredential(user, EmailAuthProvider.credential(email, newPassword));
  try {
    try {
      await setPassword();
    } catch (e: any) {
      if (e?.code !== 'auth/requires-recent-login') throw e;
      const fresh = await googleCredentialFor(email);
      if (!fresh.cred) throw e;
      await reauthenticateWithCredential(user, fresh.cred);
      await setPassword();
    }
  } catch (error: any) {
    console.warn('Update password error:', error?.code, error?.message);
    await silentSignOut();
    return { message: authErrorMessage(error?.code, 'Changing password'), success: false };
  }

  // updatePassword switches the token to 'password'; restore google.com, then sign out so
  // the user signs in with the new password
  const g = await endWithGoogleToken(user, email);
  if (!g.ok) console.warn('Post-reset Google check failed:', g.message);
  await silentSignOut();
  clearFlowState();
  return { message: 'Password changed. Sign in with your new password.', success: true };
};

// Leaving sign-up / forgot half way: drop the Firebase session (keeps Google on device)
export const cancelAuthFlow = async (): Promise<void> => {
  clearFlowState();
  await silentSignOut();
};

// "Use another account": sign out of Google and Firebase
export const switchGoogleAccount = async (): Promise<void> => {
  clearFlowState();
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
  stylePrefs?: string[];
  isPublic?: boolean;
}

export interface ProfileResponse {
  message: string;
  user: UserProfile;
}

// Saved session on app start: the persisted Firebase user, if sign-up was finished and
// the token was minted by Google sign-in. Anything else signs out -> login screen.
export type RestoreResult =
  | { status: 'ok'; user: UserProfile & { email?: string } }
  | { status: 'none' };

export const restoreSession = async (user: User): Promise<RestoreResult> => {
  // Web: a session that only came back from a Google redirect is not a finished login
  if (await consumeRedirectSignIn()) {
    await silentSignOut();
    return { status: 'none' };
  }
  const provider = await tokenProvider(user, false);
  if (provider !== 'google.com') {
    console.warn('Restored session is not a Google session:', provider);
    await silentSignOut();
    return { status: 'none' };
  }
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
  clearFlowState();
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

// "Use password instead" / fingerprints changed: end the session but keep the app lock setting,
// so the next full login (Google + mobile + password) is stored encrypted again.
export const signOutKeepLock = async (): Promise<void> => {
  clearFlowState();
  await wipeForPasswordLogin();
  await googleSignOut();
  await silentSignOut();
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
