// One place for every user-facing auth / Firestore error line.

export const NO_INTERNET = 'No internet connection. Check Wi-Fi or mobile data and try again.';
// Shown when Firestore rules deny a request (rules not published yet, or out of date)
export const SERVER_SETUP_MESSAGE = 'Server rules not published. Please try again later.';
export const TOO_MANY_ATTEMPTS = 'Too many attempts. Try again in a few minutes.';
export const WRONG_PASSWORD = 'Wrong password. Try again or tap Forgot password.';
export const SIGNUP_UNFINISHED = "Sign-up wasn't finished for this Gmail. Tap Create Account to finish.";

export const notRegisteredMessage = (email: string) =>
  `This Gmail (${email}) is not registered. Choose the Gmail you signed up with, or tap Create Account.`;
export const phoneNotRegisteredMessage = (email: string) =>
  `This mobile number is not registered with ${email}.`;
export const alreadyRegisteredMessage = (email?: string) =>
  `This Gmail${email ? ` (${email})` : ''} is already registered. Tap Sign In.`;

// Turn Firestore errors into messages the user can act on
export const firestoreErrorMessage = (error: any, action: string): string => {
  const code: string = String(error?.code || '').replace(/^firestore\//, '');
  switch (code) {
    case 'permission-denied':
      // Rules not published (or blocking): a server problem, not the user's mistake
      console.warn(`${action}: Firestore permission-denied`);
      return `${action} failed. ${SERVER_SETUP_MESSAGE}`;
    case 'unauthenticated':
      return `${action} failed: your session ended. Please sign in again.`;
    case 'unavailable':
    case 'deadline-exceeded':
      return `${action} failed. ${NO_INTERNET}`;
    case 'invalid-argument':
    case 'resource-exhausted':
      return `${action} failed (${code}). The photo may be too large; please pick a smaller photo.`;
    case 'not-found':
      return `${action} failed: it was deleted or no longer exists.`;
    case 'already-exists':
      return `${action} failed: it already exists.`;
    case 'failed-precondition':
      return `${action} failed: the server needs a database index. Please try again later.`;
    case 'aborted':
    case 'cancelled':
      return `${action} was interrupted. Please try again.`;
    case 'internal':
    case 'unknown':
    case 'data-loss':
      return `${action} failed: server error (${code}). Please try again later.`;
    default:
      return `${action} failed${code ? ` (${code})` : ''}: ${error?.message || 'unknown error'}`;
  }
};

// Firebase Auth error code -> message the user can act on (login = Gmail + mobile + password)
export const authErrorMessage = (code: string | undefined, action: string): string => {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return WRONG_PASSWORD;
    case 'auth/user-not-found':
      return 'No account for this Gmail. Tap Create Account.';
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return 'This Google account has no valid Gmail address.';
    case 'auth/email-already-in-use':
    case 'auth/credential-already-in-use':
    case 'auth/provider-already-linked':
      return alreadyRegisteredMessage();
    case 'auth/account-exists-with-different-credential':
      return 'An account with this Gmail already exists. Tap Sign In.';
    case 'auth/user-mismatch':
      return 'A different Google account was chosen. Pick the Gmail shown on screen.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/requires-recent-login':
      return 'For safety, continue with Google again, then retry.';
    case 'auth/too-many-requests':
      return TOO_MANY_ATTEMPTS;
    case 'auth/network-request-failed':
    case 'auth/timeout':
      return NO_INTERNET;
    case 'auth/operation-not-allowed':
      return 'This sign-in method is turned off on the server (enable Google and Email/Password in Firebase Authentication).';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-token-expired':
    case 'auth/invalid-user-token':
      return 'Your session expired. Please sign in again.';
    case 'auth/invalid-api-key':
    case 'auth/app-not-authorized':
    case 'auth/invalid-app-credential':
      return 'App is not authorised with the server (Firebase config). Please update the app.';
    case 'auth/quota-exceeded':
      return 'Server is busy right now. Try again in a few minutes.';
    case 'auth/internal-error':
      return `${action} failed: server error. Please try again.`;
    default:
      return `${action} failed${code ? ` (${code})` : ''}. Please try again.`;
  }
};
