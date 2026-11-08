// Feedback & suggestions: feedback/{autoId}
// {uid, name, type, text, image, appVersion, platform, createdAt, status:'new'}.
// Users create their own; only admins (users/{uid}.role == 'admin') read them and change status.
import { Platform } from 'react-native';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { toDate } from '../utils/date';
import { assertClean } from '../utils/profanity';

export const FEEDBACK_TYPES = ['Suggestion', 'Complaint', 'Bug', 'Other'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export const FEEDBACK_STATUSES = ['new', 'read', 'done'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_MAX_TEXT = 1000;
// Same limit as a poll photo (POLL_PICK.maxChars); firestore.rules checks it too
export const FEEDBACK_MAX_IMAGE = 145000;
export const APP_VERSION = '1.0.0';

export interface Feedback {
  id: string;
  uid: string;
  name: string;
  type: string;
  text: string;
  image: string | null;
  appVersion: string;
  platform: string;
  status: FeedbackStatus | string;
  createdAt: Date | null;
}

export const submitFeedback = async (input: {
  uid: string;
  name?: string | null;
  type: FeedbackType;
  text: string;
  image?: string | null;
}): Promise<void> => {
  const text = input.text.trim();
  if (!text) throw new Error('Please write your message.');
  if (text.length > FEEDBACK_MAX_TEXT) throw new Error(`Please keep it under ${FEEDBACK_MAX_TEXT} characters.`);
  assertClean(text, 'Please keep your message respectful 🙏');
  const image = input.image || null;
  if (image && image.length > FEEDBACK_MAX_IMAGE) {
    throw new Error('This screenshot is too large. Please pick a smaller one.');
  }
  try {
    await addDoc(collection(db, 'feedback'), {
      uid: input.uid,
      name: String(input.name || '').slice(0, 80),
      type: input.type,
      text,
      image,
      appVersion: APP_VERSION,
      platform: String(Platform.OS).slice(0, 20),
      createdAt: serverTimestamp(),
      status: 'new',
    });
  } catch (e: any) {
    console.warn('submitFeedback failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Sending feedback'));
  }
};

// Admin only (rules)
export const getFeedback = async (): Promise<Feedback[]> => {
  try {
    const snap = await getDocs(query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(200)));
    return snap.docs.map(d => {
      const x: any = d.data();
      return {
        id: d.id,
        uid: String(x?.uid || ''),
        name: String(x?.name || ''),
        type: String(x?.type || 'Other'),
        text: String(x?.text || ''),
        image: typeof x?.image === 'string' ? x.image : null,
        appVersion: String(x?.appVersion || ''),
        platform: String(x?.platform || ''),
        status: String(x?.status || 'new'),
        createdAt: toDate(x?.createdAt),
      };
    });
  } catch (e: any) {
    console.warn('getFeedback failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Loading feedback'));
  }
};

export const setFeedbackStatus = async (id: string, status: FeedbackStatus): Promise<void> => {
  try {
    await updateDoc(doc(db, 'feedback', id), { status });
  } catch (e: any) {
    console.warn('setFeedbackStatus failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Updating feedback'));
  }
};
