// src/config/firebaseConfig.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
import { secureAuthStorage } from '../native/sessionVault';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyC-Cz1LycZ5ALMdQk9z9ee4NX7jIxASJas',
  authDomain: 'outfit-vote-9edca.firebaseapp.com',
  projectId: 'outfit-vote-9edca',
  storageBucket: 'outfit-vote-9edca.firebasestorage.app',
  messagingSenderId: '791853722614',
  appId: '1:791853722614:web:ec7e14c0375f504249b5d7',
};

// Reuse the app on Fast Refresh instead of initializing twice (that throws)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Keep the user signed in across app restarts (getAuth alone = memory only on RN).
// getReactNativePersistence lives in the RN build of firebase/auth but not in its TS types.
// secureAuthStorage = AsyncStorage, except that with the fingerprint lock on the session is kept
// encrypted by a Keystore key and auth can't read it until the fingerprint unlocks it.
const getRNPersistence: ((storage: any) => any) | undefined = (FirebaseAuth as any)
  .getReactNativePersistence;
let authInstance: Auth;
try {
  authInstance = getRNPersistence
    ? initializeAuth(app, { persistence: getRNPersistence(secureAuthStorage) })
    : getAuth(app);
} catch {
  // Already initialized (Fast Refresh)
  authInstance = getAuth(app);
}
export const auth = authInstance;

// React Native can't use Firestore's default WebChannel transport reliably.
// Long polling fixes "client is offline" / hanging getDoc errors.
let firestore: Firestore;
try {
  firestore = initializeFirestore(app, { experimentalForceLongPolling: true });
} catch {
  // Already initialized (Fast Refresh)
  firestore = getFirestore(app);
}
export const db = firestore;

// ProfileScreen imports this; it was missing before
export const storage = getStorage(app);
