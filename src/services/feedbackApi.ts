// Feedback & suggestions board: feedback/{autoId}
// {uid, name, type, text, image, appVersion, platform, createdAt, status:'new',
//  isPublic, likeCount, replyCount, lastReplyId?, quoteOf?: {id, uid, name, text}, editedAt?}
//   feedback/{id}/likes/{uid}      one like per user ({createdAt}); likeCount changes with it
//   feedback/{id}/replies/{autoId} {uid, name, text, createdAt, editedAt?}; replyCount changes with it
// Everyone signed in sees public feedback (isPublic == true) and can like / reply / quote it.
// Authors see their own (public or not); admins (users.role 'admin' or listed in config/admins)
// see ALL feedback and change its status. Authors edit / delete only their own items.
// Old feedback written before the board has no isPublic, so it stays admin + author only.
// Lists page 10 at a time (PAGE_SIZE).
import { Platform } from 'react-native';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  QueryConstraint,
  QueryDocumentSnapshot,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { toDate } from '../utils/date';
import { assertClean } from '../utils/profanity';
import { getAdminUids } from './adminConfig';
import { recordActivity } from './activityApi';

export const FEEDBACK_TYPES = ['Suggestion', 'Complaint', 'Bug', 'Other'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export const FEEDBACK_STATUSES = ['new', 'read', 'done'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_MAX_TEXT = 1000;
// Same limit as a poll photo (POLL_PICK.maxChars); firestore.rules checks it too
export const FEEDBACK_MAX_IMAGE = 145000;
export const APP_VERSION = '1.0.0';

export const FEEDBACK_PAGE_SIZE = 10;
export const FEEDBACK_REPLY_MAX = 500;
export const FEEDBACK_QUOTE_SNIPPET = 200;

export interface FeedbackQuote {
  id: string;
  uid: string;
  name: string;
  text: string;
}

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
  isPublic: boolean;
  likeCount: number;
  replyCount: number;
  quoteOf: FeedbackQuote | null;
  editedAt: Date | null;
}

export interface FeedbackReply {
  id: string;
  uid: string;
  name: string;
  text: string;
  createdAt: Date | null;
  editedAt: Date | null;
}

export type FeedbackCursor = QueryDocumentSnapshot | null;

export interface Page<T> {
  items: T[];
  cursor: FeedbackCursor;
  hasMore: boolean;
}

const num = (v: any) => (typeof v === 'number' && v > 0 ? Math.floor(v) : 0);

const toFeedback = (id: string, x: any): Feedback => ({
  id,
  uid: String(x?.uid || ''),
  name: String(x?.name || ''),
  type: String(x?.type || 'Other'),
  text: String(x?.text || ''),
  image: typeof x?.image === 'string' ? x.image : null,
  appVersion: String(x?.appVersion || ''),
  platform: String(x?.platform || ''),
  status: String(x?.status || 'new'),
  createdAt: toDate(x?.createdAt),
  isPublic: x?.isPublic === true,
  likeCount: num(x?.likeCount),
  replyCount: num(x?.replyCount),
  quoteOf:
    x?.quoteOf && typeof x.quoteOf.id === 'string'
      ? {
          id: x.quoteOf.id,
          uid: String(x.quoteOf.uid || ''),
          name: String(x.quoteOf.name || ''),
          text: String(x.quoteOf.text || ''),
        }
      : null,
  editedAt: toDate(x?.editedAt),
});

const toReply = (id: string, x: any): FeedbackReply => ({
  id,
  uid: String(x?.uid || ''),
  name: String(x?.name || ''),
  text: String(x?.text || ''),
  createdAt: toDate(x?.createdAt),
  editedAt: toDate(x?.editedAt),
});

const failWith = (e: any, action: string): never => {
  console.warn(`${action} failed:`, e?.code, e?.message);
  throw new Error(firestoreErrorMessage(e, action));
};

const cleanText = (raw: string, max: number): string => {
  const t = (raw || '').trim();
  if (!t) throw new Error('Please write your message.');
  if (t.length > max) throw new Error(`Please keep it under ${max} characters.`);
  assertClean(t, 'Please keep your message respectful 🙏');
  return t;
};

// Snippet stored on a quote (the original may be edited or deleted later)
export const quoteFrom = (f: Feedback): FeedbackQuote => ({
  id: f.id,
  uid: f.uid,
  name: (f.name || 'Outfit user').slice(0, 80),
  text: f.text.length > FEEDBACK_QUOTE_SNIPPET ? `${f.text.slice(0, FEEDBACK_QUOTE_SNIPPET - 1)}…` : f.text,
});

export const submitFeedback = async (input: {
  uid: string;
  name?: string | null;
  type: FeedbackType;
  text: string;
  image?: string | null;
  isPublic?: boolean; // shown on the board (default true); false = only admins and me
  quoteOf?: FeedbackQuote | null;
}): Promise<void> => {
  const text = cleanText(input.text, FEEDBACK_MAX_TEXT);
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
      isPublic: input.isPublic !== false,
      likeCount: 0,
      replyCount: 0,
      ...(input.quoteOf ? { quoteOf: input.quoteOf } : {}),
    });
  } catch (e: any) {
    console.warn('submitFeedback failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Sending feedback'));
  }
  // Tell the admin(s): an activity doc each (config/admins; skipped when it's missing). Best effort.
  getAdminUids()
    .then(admins =>
      Promise.all(
        admins
          .filter(a => a !== input.uid)
          .map(a => recordActivity(a, { uid: input.uid, name: input.name }, 'feedback', null, `${input.type}: ${text}`)),
      ),
    )
    .catch(() => undefined);
};

// Admin only (rules)
export const getFeedback = async (): Promise<Feedback[]> => {
  try {
    const snap = await getDocs(query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(200)));
    return snap.docs.map(d => toFeedback(d.id, d.data()));
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

// ── Board ──────────────────────────────────────────────────────────────────

// 'board' = public feedback, 'mine' = my own (public or not), 'all' = everything (admins only)
export type FeedbackScope = 'board' | 'mine' | 'all';

export const getFeedbackPage = async (
  scope: FeedbackScope,
  uid: string | null | undefined,
  cursor: FeedbackCursor = null,
): Promise<Page<Feedback>> => {
  const cons: QueryConstraint[] = [];
  if (scope === 'board') cons.push(where('isPublic', '==', true));
  if (scope === 'mine') {
    if (!uid) return { items: [], cursor: null, hasMore: false };
    cons.push(where('uid', '==', uid));
  }
  cons.push(orderBy('createdAt', 'desc'));
  if (cursor) cons.push(startAfter(cursor));
  cons.push(limit(FEEDBACK_PAGE_SIZE));
  try {
    const snap = await getDocs(query(collection(db, 'feedback'), ...cons));
    const docs = snap.docs;
    return {
      items: docs.map(d => toFeedback(d.id, d.data())),
      cursor: docs.length ? docs[docs.length - 1] : cursor,
      hasMore: docs.length === FEEDBACK_PAGE_SIZE,
    };
  } catch (e: any) {
    // Index not deployed yet: first page without the sort, sorted here (no paging)
    if (e?.code === 'failed-precondition' && !cursor) {
      try {
        const eq = cons.filter((c: any) => c?.type === 'where');
        const snap = await getDocs(query(collection(db, 'feedback'), ...eq, limit(50)));
        const items = snap.docs
          .map(d => toFeedback(d.id, d.data()))
          .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
        return { items, cursor: null, hasMore: false };
      } catch (e2: any) {
        console.warn('feedback fallback failed:', e2?.code, e2?.message);
      }
    }
    return failWith(e, 'Loading feedback');
  }
};

export const getFeedbackById = async (id: string): Promise<Feedback | null> => {
  try {
    const s = await getDoc(doc(db, 'feedback', id));
    return s.exists() ? toFeedback(s.id, s.data()) : null;
  } catch (e: any) {
    console.warn('getFeedbackById failed:', e?.code, e?.message);
    return null;
  }
};

// Author only: text, type and board visibility (status, likes and replies stay)
export const updateFeedback = async (
  id: string,
  changes: { text: string; type: FeedbackType; isPublic: boolean },
): Promise<void> => {
  const text = cleanText(changes.text, FEEDBACK_MAX_TEXT);
  try {
    await updateDoc(doc(db, 'feedback', id), {
      text,
      type: changes.type,
      isPublic: changes.isPublic,
      editedAt: serverTimestamp(),
    });
  } catch (e: any) {
    failWith(e, 'Saving feedback');
  }
};

// Author or admin. Likes and replies under it are removed first (best effort, no Cloud Functions).
export const deleteFeedback = async (id: string): Promise<void> => {
  const ref = doc(db, 'feedback', id);
  for (const sub of ['likes', 'replies']) {
    try {
      const snap = await getDocs(collection(ref, sub));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e: any) {
      console.warn(`deleteFeedback ${sub} cleanup:`, e?.code, e?.message);
    }
  }
  try {
    await deleteDoc(ref);
  } catch (e: any) {
    failWith(e, 'Deleting feedback');
  }
};

// ── Likes (one per user) ───────────────────────────────────────────────────

export const hasLikedFeedback = async (id: string, uid: string | null | undefined): Promise<boolean> => {
  if (!uid) return false;
  try {
    return (await getDoc(doc(db, 'feedback', id, 'likes', uid))).exists();
  } catch {
    return false;
  }
};

// Like / unlike: the like doc and likeCount change in one write (rules check both)
export const setFeedbackLike = async (id: string, uid: string, like: boolean): Promise<void> => {
  const batch = writeBatch(db);
  const likeRef = doc(db, 'feedback', id, 'likes', uid);
  if (like) batch.set(likeRef, { createdAt: serverTimestamp() });
  else batch.delete(likeRef);
  batch.update(doc(db, 'feedback', id), { likeCount: increment(like ? 1 : -1) });
  try {
    await batch.commit();
  } catch (e: any) {
    failWith(e, like ? 'Liking' : 'Removing like');
  }
};

// ── Replies ────────────────────────────────────────────────────────────────

export const getReplies = async (
  feedbackId: string,
  cursor: FeedbackCursor = null,
): Promise<Page<FeedbackReply>> => {
  const cons: QueryConstraint[] = [orderBy('createdAt', 'asc')];
  if (cursor) cons.push(startAfter(cursor));
  cons.push(limit(FEEDBACK_PAGE_SIZE));
  try {
    const snap = await getDocs(query(collection(db, 'feedback', feedbackId, 'replies'), ...cons));
    const docs = snap.docs;
    return {
      items: docs.map(d => toReply(d.id, d.data())),
      cursor: docs.length ? docs[docs.length - 1] : cursor,
      hasMore: docs.length === FEEDBACK_PAGE_SIZE,
    };
  } catch (e: any) {
    return failWith(e, 'Loading replies');
  }
};

export const addReply = async (
  feedbackId: string,
  me: { uid: string; name?: string | null },
  rawText: string,
): Promise<FeedbackReply> => {
  const text = cleanText(rawText, FEEDBACK_REPLY_MAX);
  const ref = doc(collection(db, 'feedback', feedbackId, 'replies'));
  const name = String(me.name || '').trim().slice(0, 80) || 'Outfit user';
  const batch = writeBatch(db);
  batch.set(ref, { uid: me.uid, name, text, createdAt: serverTimestamp() });
  batch.update(doc(db, 'feedback', feedbackId), { replyCount: increment(1), lastReplyId: ref.id });
  try {
    await batch.commit();
  } catch (e: any) {
    failWith(e, 'Sending reply');
  }
  return { id: ref.id, uid: me.uid, name, text, createdAt: new Date(), editedAt: null };
};

// Reply author only
export const editReply = async (feedbackId: string, replyId: string, rawText: string): Promise<string> => {
  const text = cleanText(rawText, FEEDBACK_REPLY_MAX);
  try {
    await updateDoc(doc(db, 'feedback', feedbackId, 'replies', replyId), { text, editedAt: serverTimestamp() });
  } catch (e: any) {
    failWith(e, 'Saving reply');
  }
  return text;
};

// Reply author, feedback author or admin
export const deleteReply = async (feedbackId: string, replyId: string): Promise<void> => {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'feedback', feedbackId, 'replies', replyId));
  batch.update(doc(db, 'feedback', feedbackId), { replyCount: increment(-1), lastReplyId: replyId });
  try {
    await batch.commit();
  } catch (e: any) {
    failWith(e, 'Deleting reply');
  }
};
