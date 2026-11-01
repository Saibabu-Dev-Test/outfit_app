import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut
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

const phoneToEmail = (phone: string): string => {
  const cleanNum = phone.replace('+91', '').replace(/\s/g, '');
  return `${cleanNum}@outfit.app`;
};  

export const loginWithPhoneAndPassword = async ({ 
  phoneNumber, 
  password 
}: { 
  phoneNumber: string; 
  password: string; 
}): Promise<AuthResponse> => {
  try {
    const email = phoneToEmail(phoneNumber);
    
    // Firebase Direct Login
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Firestore nundi extra details teesukovadam
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};

    return {
      message: 'Login successful!',
      user: {
        id: user.uid,
        phoneNumber: userData.phoneNumber || phoneNumber,
        email: user.email!,
        createdAt: userData.createdAt
      }
    };
  } catch (error: any) {
    let msg = 'Login failed';
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      msg = 'Invalid mobile number or password';
    } else if (error.code === 'auth/invalid-email') {
      msg = 'Invalid mobile number format';
    }
    throw new Error(msg);
  }
};

export const registerWithPhoneAndPassword = async ({ 
  phoneNumber, 
  password 
}: { 
  phoneNumber: string; 
  password: string; 
}): Promise<AuthResponse> => {
  try {
    const email = phoneToEmail(phoneNumber);
    
    // Firebase Direct Registration
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Firestore lo user data save cheyyadam
    await setDoc(doc(db, 'users', user.uid), {
      phoneNumber: phoneNumber,
      email: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return {
      message: 'Registration successful!',
      user: {
        id: user.uid,
        phoneNumber: phoneNumber,
        email: email,
        createdAt: new Date()
      }
    };
  } catch (error: any) {
    let msg = 'Registration failed';
    if (error.code === 'auth/email-already-in-use') {
      msg = 'This mobile number is already registered';
    } else if (error.code === 'auth/weak-password') {
      msg = 'Password should be at least 6 characters';
    }
    throw new Error(msg);
  }
};

export interface ProfileStat {
  label: string;
  value: string;
}

export interface UserProfile {
  id: number | string;
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
  } catch (error) {
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



