// Google Sign-In in the browser (Firebase signInWithPopup; redirect when popups can't open,
// e.g. some iOS Safari / home-screen app cases). Same result shape as googleAuth.ts, so authApi
// runs the same Google + mobile + password flow, ending with a google.com token for the rules.
import {
  getAdditionalUserInfo,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  UserCredential,
} from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { NO_INTERNET } from '../utils/firebaseErrors';

export interface GoogleAccountResult {
  email?: string;
  idToken?: string;
  name?: string | null;
  message?: string;
  cancelled?: boolean;
  isNew?: boolean; // Firebase user was created by this sign-in
}

const REDIRECT_FLAG = 'outfit.googleRedirect';
const TOKEN_MAX_AGE_MS = 45 * 60 * 1000;

const session = (): any => (globalThis as any).sessionStorage;

const provider = () => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
};

// Result that came back from a redirect sign-in (used by the next "Continue with Google" tap)
let cached: (GoogleAccountResult & { at: number }) | null = null;

// Started at page load: finishes a pending redirect sign-in and also preloads Google's sign-in
// iframe, so the popup opens right away on the first tap (browsers block late popups).
const redirectResult: Promise<UserCredential | null> = getRedirectResult(auth).catch((e: any) => {
  console.warn('Google redirect result error:', e?.code, e?.message);
  return null;
});

const fromCredential = (res: UserCredential): GoogleAccountResult => {
  const cred = GoogleAuthProvider.credentialFromResult(res);
  const email = (res.user.email || '').toLowerCase();
  const idToken = cred?.idToken;
  if (!email || !idToken) {
    return { message: 'Google sign-in did not return an ID token. Try again.' };
  }
  return {
    email,
    idToken,
    name: res.user.displayName ?? null,
    isNew: !!getAdditionalUserInfo(res)?.isNewUser,
  };
};

export const configureGoogleSignIn = () => {};

export const googleErrorMessage = (error: any): string => {
  const code = String(error?.code ?? '');
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return '';
    case 'auth/network-request-failed':
      return NO_INTERNET;
    case 'auth/unauthorized-domain':
      return 'This website is not allowed to use Google sign-in yet (add it to Firebase Auth > Authorized domains).';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is turned off in Firebase.';
  }
  return `Google sign-in failed${code ? ` (${code})` : ''}. Try again.`;
};

// After a redirect sign-in the page reloads signed in. authApi.restoreSession calls this first:
// true = this session came from a redirect, not a finished login (it signs out and the next
// "Continue with Google" tap reuses the cached Google token). Never throws.
export const consumeRedirectSignIn = async (): Promise<boolean> => {
  let flagged = false;
  try {
    flagged = session()?.getItem(REDIRECT_FLAG) === '1';
    if (flagged) session()?.removeItem(REDIRECT_FLAG);
  } catch {
    // storage blocked
  }
  if (!flagged) return false;
  const res = await redirectResult;
  if (res) {
    const r = fromCredential(res);
    if (r.idToken) cached = { ...r, at: Date.now() };
  }
  return true;
};

// Opens the Google account chooser. Must start right from the tap (no await before the popup),
// or Safari blocks it. Never throws.
export const getGoogleAccount = async (_silentFirst = false): Promise<GoogleAccountResult> => {
  if (cached && Date.now() - cached.at < TOKEN_MAX_AGE_MS) {
    const r = cached;
    cached = null;
    return r;
  }
  cached = null;
  try {
    const res = await signInWithPopup(auth, provider());
    return fromCredential(res);
  } catch (error: any) {
    const code = String(error?.code ?? '');
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      // Fall back to a full-page redirect; the page reloads and the user taps Continue again
      try {
        session()?.setItem(REDIRECT_FLAG, '1');
        await signInWithRedirect(auth, provider());
        return { cancelled: true, message: '' };
      } catch (e2: any) {
        console.warn('Google redirect error:', e2?.code, e2?.message);
        return { message: googleErrorMessage(e2) };
      }
    }
    console.warn('Google popup error:', code, error?.message);
    const message = googleErrorMessage(error);
    return { cancelled: !message, message };
  }
};

// Nothing to sign out of on the web besides Firebase (authApi signs out of Firebase itself)
export const googleSignOut = async (): Promise<void> => {
  cached = null;
};
