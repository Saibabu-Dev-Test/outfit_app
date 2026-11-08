// src/config/firebaseConfig.web.ts — browser build (GitHub Pages PWA).
// Same Firebase project as the Android app. Login is kept by the browser (browserLocalPersistence),
// there is no fingerprint vault on the web.
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  initializeAuth,
} from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyC-Cz1LycZ5ALMdQk9z9ee4NX7jIxASJas',
  authDomain: 'outfit-vote-9edca.firebaseapp.com',
  projectId: 'outfit-vote-9edca',
  storageBucket: 'outfit-vote-9edca.firebasestorage.app',
  messagingSenderId: '791853722614',
  appId: '1:791853722614:web:ec7e14c0375f504249b5d7',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: browserLocalPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch {
  authInstance = getAuth(app);
}
export const auth = authInstance;

let firestore: Firestore;
try {
  // Browsers behind some proxies/antivirus can't use WebChannel streaming: detect and fall back
  firestore = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
} catch {
  firestore = getFirestore(app);
}
export const db = firestore;

// No Firebase Storage (Spark plan): photos are base64 in Firestore. Kept for the same exports.
export const storage = null as any;
