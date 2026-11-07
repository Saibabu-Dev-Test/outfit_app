// Google Sign-In on the device (free GoogleSignin API, no SMS/OTP)
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

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
}

// Native error -> message the user can act on
export const googleErrorMessage = (error: any): string => {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.SIGN_IN_CANCELLED:
        return 'Google sign-in was cancelled';
      case statusCodes.IN_PROGRESS:
        return 'Google sign-in is already in progress';
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Google Play Services is missing or out of date on this phone. Update it and try again.';
      case '10': // Android CommonStatusCodes.DEVELOPER_ERROR
        return 'Google sign-in not configured: add SHA-1 in Firebase';
    }
  }
  if (String(error?.message || '').includes('DEVELOPER_ERROR')) {
    return 'Google sign-in not configured: add SHA-1 in Firebase';
  }
  if (String(error?.message || '').toLowerCase().includes('network')) {
    return 'Network error. Please check your internet connection';
  }
  return `Google sign-in failed${error?.code ? ` (${error.code})` : ''}`;
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
        return { cancelled: true, message: 'Google sign-in was cancelled' };
      }
      data = res.data;
    }

    const email: string | undefined = data?.user?.email;
    const idToken: string | undefined = data?.idToken ?? undefined;
    if (!email || !idToken) {
      return { message: 'Google sign-in not configured: add SHA-1 in Firebase' };
    }
    return { email: email.toLowerCase(), idToken, name: data?.user?.name ?? null };
  } catch (error: any) {
    console.warn('Google Sign-In error:', error?.code, error?.message);
    return {
      cancelled: isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED,
      message: googleErrorMessage(error),
    };
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
