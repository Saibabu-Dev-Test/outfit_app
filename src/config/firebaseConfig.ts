// src/config/firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// src/config/firebaseConfig.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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

export const auth = getAuth(app);

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

const firebaseConfig = {
  apiKey: "AIzaSyC-Cz1LycZ5ALMdQk9z9ee4NX7jIxASJas",
  authDomain: "outfit-vote-9edca.firebaseapp.com",
  projectId: "outfit-vote-9edca",
  storageBucket: "outfit-vote-9edca.firebasestorage.app",
  messagingSenderId: "791853722614",
  appId: "1:791853722614:web:ec7e14c0375f504249b5d7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
