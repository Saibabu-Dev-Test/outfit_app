// src/config/firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
