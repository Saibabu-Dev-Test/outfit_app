// Shown when Firestore rules deny a request (rules not published yet, or out of date)
export const SERVER_SETUP_MESSAGE = 'Server setup incomplete (Firestore rules). Please try again later.';

// Turn Firestore errors into messages the user can act on
export const firestoreErrorMessage = (error: any, action: string): string => {
  const code: string = error?.code || '';
  if (code === 'permission-denied') {
    // Rules not published (or blocking): a server problem, not the user's mistake
    console.warn(`${action}: Firestore permission-denied`);
    return `${action} failed. ${SERVER_SETUP_MESSAGE}`;
  }
  if (code === 'unavailable') {
    return `${action} failed: you seem to be offline. Please check your internet.`;
  }
  if (code === 'invalid-argument' || code === 'resource-exhausted') {
    return `${action} failed (${code}). The photo may be too large; please pick a smaller photo.`;
  }
  return `${action} failed${code ? ` (${code})` : ''}: ${error?.message || 'Unknown error'}`;
};

// Firebase Auth error code -> message the user can act on (login is Google email + mobile + password)
export const authErrorMessage = (code: string | undefined, fallback: string): string => {
  switch (code) {
    case 'auth/wrong-password':
      return 'Wrong password. Try again or use Forgot password.';
    case 'auth/user-not-found':
      return 'No account found for this Google account. New here? Sign up';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      // Firebase hides which one it is (email enumeration protection)
      return 'Wrong password, or no account for this Google account yet. New here? Sign up';
    case 'auth/invalid-email':
      return 'This Google account has no valid email';
    case 'auth/email-already-in-use':
    case 'auth/credential-already-in-use':
    case 'auth/provider-already-linked':
      return 'This Google account is already registered. Please sign in.';
    case 'auth/account-exists-with-different-credential':
      return 'An account with this email already exists. Please sign in.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters';
    case 'auth/requires-recent-login':
      return 'Please continue with Google again, then retry.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is disabled in Firebase. Enable Google and Email/Password in Firebase Console > Authentication > Sign-in method.';
    case 'auth/user-disabled':
      return 'This account has been disabled';
    default:
      return code ? `${fallback} (${code})` : fallback;
  }
};
