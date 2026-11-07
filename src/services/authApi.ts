import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';

export interface AuthResponse {
  message: string;
  user?: {
    id: string;
    phoneNumber: string;
    email: string;
    createdAt?: any;
  };
}

// +919876543210 -> 9876543210@outfit.app (same format existing accounts use)
// Other countries keep their code so numbers can't collide: 14155550100@outfit.app
const phoneToEmail = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  const local = phone.trim().startsWith('+91') ? digits.slice(2) : digits;
  return `${local}@outfit.app`;
};

// Firebase error code -> message the user can act on
const authErrorMessage = (code: string | undefined, fallback: string): string => {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'Invalid mobile number or password';
    case 'auth/invalid-email':
      return 'Invalid mobile number format';
    case 'auth/email-already-in-use':
      return 'This mobile number is already registered. Please sign in.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is disabled in Firebase. Enable it in Firebase Console > Authentication > Sign-in method.';
    case 'auth/user-disabled':
      return 'This account has been disabled';
    default:
      return code ? `${fallback} (${code})` : fallback;
  }
};

export const loginWithPhoneAndPassword = async ({
  phoneNumber,
  password,
}: {
  phoneNumber: string;
  password: string;
}): Promise<AuthResponse> => {
  let user;
  try {
    const email = phoneToEmail(phoneNumber);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    user = userCredential.user;
  } catch (error: any) {
    console.warn('Firebase Login Error:', error?.code, error?.message);
    // Return instead of throw so the screen never crashes
    return { message: authErrorMessage(error?.code, 'Login failed') };
  }

  // Auth already succeeded. A Firestore problem must NOT turn this into "Login failed".
  let userData: any = {};
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    userData = userDoc.exists() ? userDoc.data() : {};
  } catch (error: any) {
    console.warn('Firestore profile read failed (login continues):', error?.code, error?.message);
  }

  return {
    message: 'Login successful!',
    user: {
      id: user.uid,
      phoneNumber: userData?.phoneNumber || phoneNumber,
      email: user.email ?? '',
      createdAt: userData?.createdAt,
    },
  };
};

export const registerWithPhoneAndPassword = async ({
  phoneNumber,
  password,
}: {
  phoneNumber: string;
  password: string;
}): Promise<AuthResponse> => {
  const email = phoneToEmail(phoneNumber);
  let user;
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    user = userCredential.user;
  } catch (error: any) {
    console.warn('Firebase Register Error:', error?.code, error?.message);
    return { message: authErrorMessage(error?.code, 'Registration failed') };
  }

  // Account exists now; saving the profile doc is best-effort
  try {
    await setDoc(doc(db, 'users', user.uid), {
      phoneNumber,
      email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.warn('Firestore profile save failed (account still created):', error?.code, error?.message);
  }

  return {
    message: 'Registration successful!',
    user: {
      id: user.uid,
      phoneNumber,
      email,
      createdAt: new Date(),
    },
  };
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

export const logoutUser = async (): Promise<{ message: string; success: boolean }> => {
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
