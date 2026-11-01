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

export const getUserProfile = async (
  userId?: number | string
): Promise<ProfileResponse> => {
  const urls = getAuthBaseUrls();
  let lastError: Error | null = null;

  for (const baseUrl of urls) {
    try {
      const endpoint = userId
        ? `${baseUrl}/api/user/profile/${userId}`
        : `${baseUrl}/api/user/profile`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'x-user-id': String(userId) } : {}),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch user profile');
      }

      return data;
    } catch (err: any) {
      lastError = err;
      if (err.message && err.message !== 'Failed to fetch' && !err.message.includes('Network request failed')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Unable to connect to backend server to fetch profile details.');
};

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

export const updateUserProfile = async (
  payload: UpdateProfilePayload
): Promise<ProfileResponse> => {
  const urls = getAuthBaseUrls();
  let lastError: Error | null = null;

  for (const baseUrl of urls) {
    try {
      const endpoint = payload.userId
        ? `${baseUrl}/api/user/profile/${payload.userId}`
        : `${baseUrl}/api/user/profile`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(payload.userId ? { 'x-user-id': String(payload.userId) } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update user profile');
      }

      return data;
    } catch (err: any) {
      lastError = err;
      if (err.message && err.message !== 'Failed to fetch' && !err.message.includes('Network request failed')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Unable to connect to backend server to update profile details.');
};

export interface AvatarUploadResponse {
  message: string;
  avatarUrl: string;
  user?: UserProfile;
}

export interface ImageFileParam {
  uri: string;
  name?: string;
  type?: string;
  base64?: string;
}

export const uploadProfileAvatar = async (
  userId?: number | string,
  imageFile?: ImageFileParam
): Promise<AvatarUploadResponse> => {
  const urls = getAuthBaseUrls();
  let lastError: Error | null = null;

  for (const baseUrl of urls) {
    try {
      const endpoint = userId
        ? `${baseUrl}/api/user/profile/${userId}/avatar`
        : `${baseUrl}/api/user/profile/avatar`;

      let body: any;
      let headers: Record<string, string> = {
        ...(userId ? { 'x-user-id': String(userId) } : {}),
      };

    if (imageFile?.uri) {
  const formData = new FormData();

  formData.append('avatar', {
    uri: imageFile.uri,
    name: imageFile.name || 'avatar.jpg',
    type: imageFile.type || 'image/jpeg',
  } as any);

  if (userId) {
    formData.append('userId', String(userId));
  }

  body = formData;
     } else if (imageFile?.base64) {
  headers['Content-Type'] = 'application/json';

  body = JSON.stringify({
    imageBase64: imageFile.base64,
    fileName: imageFile.name || 'avatar.jpg',
    userId,
  });
}

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
      });

      const responseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        const cleanMsg = responseText.replace(/<[^>]*>?/gm, '').trim();
        throw new Error(
          `Server response (${response.status}): ${cleanMsg.slice(0, 150) || 'Invalid server response'}`
        );
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to upload profile photo');
      }

      return data;

    } catch (err: any) {
      lastError = err;
      if (err.message && err.message !== 'Failed to fetch' && !err.message.includes('Network request failed')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Unable to connect to backend server to upload profile photo.');
};



