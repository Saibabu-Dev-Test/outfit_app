// Google Sign-In on the device (free GoogleSignin API, no SMS/OTP)
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { NO_INTERNET } from '../utils/firebaseErrors';

// Web client (client_type 3) from android/app/google-services.json
const WEB_CLIENT_ID =
  '791853722614-o1h6cd69kp84opf0c7nlcv6sc0hehfpb.apps.googleusercontent.com';

let configured = false;
export const configureGoogleSignIn = () => {
  if (configured) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  configured = true;
};

export interface GoogleAccountResult {
  email?: string;
  idToken?: string;
  name?: string | null;
  message?: string; // set when it failed
  cancelled?: boolean;
  isNew?: boolean; // web only: Firebase user was created by the Google popup itself
}

// Web only (redirect sign-in). The Android app never signs in through a redirect.
export const consumeRedirectSignIn = async (): Promise<boolean> => false;

// Native error -> message the user can act on ('' = cancelled, show nothing)
export const googleErrorMessage = (error: any): string => {
  const code = String(error?.code ?? '');
  const msg = String(error?.message || '');
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return '';
      case statusCodes.IN_PROGRESS:
        return 'Google sign-in is already open.';
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Google Play Services is missing or out of date on this phone. Update it from Play Store and try again.';
    }
  }
  switch (code) {
    case '12501': // user closed the picker
      return '';
    case '7': // NETWORK_ERROR
      return NO_INTERNET;
    case '10': // DEVELOPER_ERROR
    case '12500': // SIGN_IN_FAILED (usually the same config problem)
      return 'Google sign-in is not set up for this app build (DEVELOPER_ERROR: SHA-1 missing in Firebase).';
    case '8': // INTERNAL_ERROR
      return 'Google sign-in had an internal error. Try again.';
    case '5': // INVALID_ACCOUNT
      return 'This Google account cannot be used. Choose another Gmail.';
  }
  if (msg.includes('DEVELOPER_ERROR')) {
    return 'Google sign-in is not set up for this app build (DEVELOPER_ERROR: SHA-1 missing in Firebase).';
  }
  if (msg.toLowerCase().includes('network')) return NO_INTERNET;
  return `Google sign-in failed${code ? ` (code ${code})` : ''}. Try again.`;
};

// Gets the Google account on this device. silentFirst reuses an existing sign-in.
// Never throws.
export const getGoogleAccount = async (silentFirst = false): Promise<GoogleAccountResult> => {
  try {
    configureGoogleSignIn();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    let data: any = null;
    if (silentFirst && GoogleSignin.hasPreviousSignIn()) {
      try {
        const silent = await GoogleSignin.signInSilently();
        if (silent.type === 'success') data = silent.data;
      } catch {
        // fall back to the account picker
      }
    }
    if (!data) {
      const res = await GoogleSignin.signIn();
      if (!isSuccessResponse(res)) {
        return { cancelled: true, message: '' };
      }
      data = res.data;
    }

    const email: string | undefined = data?.user?.email;
    const idToken: string | undefined = data?.idToken ?? undefined;
    if (!email || !idToken) {
      return { message: 'Google sign-in is not set up for this app build (no ID token: check the web client ID / SHA-1 in Firebase).' };
    }
    return { email: email.toLowerCase(), idToken, name: data?.user?.name ?? null };
  } catch (error: any) {
    console.warn('Google Sign-In error:', error?.code, error?.message);
    const message = googleErrorMessage(error);
    return { cancelled: !message, message };
  }
};

// Lets the user pick another Google account next time. Never throws.
export const googleSignOut = async (): Promise<void> => {
  try {
    configureGoogleSignIn();
    await GoogleSignin.signOut();
  } catch (e: any) {
    console.warn('Google signOut failed:', e?.code, e?.message);
  }
};
