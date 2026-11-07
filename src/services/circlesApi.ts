// Circles (group chats) on Firestore. Photos are base64 data URIs inside the message doc (Spark plan, no Storage).
//   circles/{id}                          circle doc
//   circles/{id}/messages/{msgId}         chat messages (text | image | poll)
//   circles/{id}/messages/{msgId}/votes/{uid}   one poll vote per user
//   inviteCodes/{code}                    -> { circleId } so private circles can be joined by code
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { MAX_BASE64_CHARS } from '../utils/imagePicker';
import { toDate } from '../utils/date';
import { inlineAvatar } from './userApi';

export interface Circle {
  id: string;
  name: string;
  description: string;
  emoji: string;
  isPrivate: boolean;
  ownerId: string;
  memberIds: string[];
  inviteCode: string;
  createdAt: Date | null;
  lastMessageAt: Date | null;
}

export type PollKind = 'buy' | 'wear';

export interface PollOption {
  imageData: string;
  label: string;
}

export interface Poll {
  question: string;
  kind: PollKind;
  options: PollOption[];
}

export type MessageType = 'text' | 'image' | 'poll';

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  text?: string;
  imageData?: string;
  type: MessageType;
  poll?: Poll;
  createdAt: Date | null;
}

export interface ChatAuthor {
  uid: string;
  name?: string | null;
  avatar?: string | null;
}

export const POLL_QUESTIONS: Record<PollKind, string> = {
  buy: 'Which should I buy?',
  wear: 'Which should I wear?',
};

// A whole message doc must stay under Firestore's 1 MiB limit
export const MAX_POLL_TOTAL_CHARS = 900000;

const CIRCLES = 'circles';
const CODES = 'inviteCodes';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

const toCircle = (id: string, d: any): Circle => ({
  id,
  name: d?.name || 'Circle',
  description: d?.description || '',
  emoji: d?.emoji || '👗',
  isPrivate: d?.isPrivate === true,
  ownerId: String(d?.ownerId || ''),
  memberIds: Array.isArray(d?.memberIds) ? d.memberIds.map(String) : [],
  inviteCode: d?.inviteCode || '',
  createdAt: toDate(d?.createdAt),
  lastMessageAt: toDate(d?.lastMessageAt),
});

const toMessage = (id: string, d: any): ChatMessage => {
  const type: MessageType = d?.type === 'image' || d?.type === 'poll' ? d.type : 'text';
  const m: ChatMessage = {
    id,
    userId: String(d?.userId || ''),
    userName: d?.userName || 'Member',
    userAvatar: d?.userAvatar || null,
    type,
    createdAt: toDate(d?.createdAt),
  };
  if (typeof d?.text === 'string') m.text = d.text;
  if (typeof d?.imageData === 'string') m.imageData = d.imageData;
  if (type === 'poll' && d?.poll && Array.isArray(d.poll.options)) {
    const kind: PollKind = d.poll.kind === 'wear' ? 'wear' : 'buy';
    m.poll = {
      question: d.poll.question || POLL_QUESTIONS[kind],
      kind,
      options: d.poll.options.map((o: any) => ({ imageData: o?.imageData || '', label: o?.label || '' })),
    };
  }
  return m;
};

const byRecent = (a: Circle, b: Circle) =>
  (b.lastMessageAt?.getTime() || b.createdAt?.getTime() || 0) -
  (a.lastMessageAt?.getTime() || a.createdAt?.getTime() || 0);

const randomCode = (): string => {
  let out = '';
  for (let i = 0; i < 6; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
};

export const normalizeCode = (code: string): string => code.replace(/\s/g, '').toUpperCase();

const fail = (e: any, action: string): never => {
  console.warn(`${action} failed:`, e?.code, e?.message);
  throw new Error(firestoreErrorMessage(e, action));
};

// ── Circles ────────────────────────────────────────────────────────────────

export const createCircle = async (
  input: { name: string; description: string; emoji: string; isPrivate: boolean },
  uid: string,
): Promise<Circle> => {
  const name = input.name.trim();
  if (!name) throw new Error('Please give your circle a name.');
  try {
    // Pick an unused invite code
    let code = '';
    for (let i = 0; i < 6 && !code; i++) {
      const candidate = randomCode();
      const taken = await getDoc(doc(db, CODES, candidate));
      if (!taken.exists()) code = candidate;
    }
    if (!code) throw new Error('Could not create an invite code. Please try again.');

    const ref = doc(collection(db, CIRCLES));
    const data = {
      name: name.slice(0, 60),
      description: input.description.trim().slice(0, 300),
      emoji: input.emoji || '👗',
      isPrivate: input.isPrivate,
      ownerId: uid,
      memberIds: [uid],
      inviteCode: code,
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
    };
    const batch = writeBatch(db);
    batch.set(ref, data);
    batch.set(doc(db, CODES, code), { circleId: ref.id, createdBy: uid, createdAt: serverTimestamp() });
    await batch.commit();
    const now = new Date();
    return { ...toCircle(ref.id, data), createdAt: now, lastMessageAt: now };
  } catch (e: any) {
    if (!e?.code && e instanceof Error) throw e;
    return fail(e, 'Creating circle');
  }
};

// Circles the user belongs to (array-contains only: no composite index)
export const getMyCircles = async (uid: string): Promise<Circle[]> => {
  try {
    const snap = await getDocs(query(collection(db, CIRCLES), where('memberIds', 'array-contains', uid)));
    return snap.docs.map(d => toCircle(d.id, d.data())).sort(byRecent);
  } catch (e: any) {
    return fail(e, 'Loading your circles');
  }
};

// Public circles for Discover (equality only; sorted on the device)
export const getDiscoverCircles = async (): Promise<Circle[]> => {
  try {
    const snap = await getDocs(query(collection(db, CIRCLES), where('isPrivate', '==', false), limit(100)));
    return snap.docs
      .map(d => toCircle(d.id, d.data()))
      .sort((a, b) => b.memberIds.length - a.memberIds.length || byRecent(a, b));
  } catch (e: any) {
    return fail(e, 'Loading circles');
  }
};

// Admin only: every circle, private ones included
export const getAllCircles = async (): Promise<Circle[]> => {
  try {
    const snap = await getDocs(query(collection(db, CIRCLES), limit(300)));
    return snap.docs.map(d => toCircle(d.id, d.data())).sort(byRecent);
  } catch (e: any) {
    return fail(e, 'Loading all circles');
  }
};

// Live circle doc. onError gets a readable message (e.g. private circle you are not in).
export const subscribeCircle = (
  circleId: string,
  onData: (c: Circle | null) => void,
  onError: (msg: string, code?: string) => void,
): Unsubscribe => {
  try {
    return onSnapshot(
      doc(db, CIRCLES, circleId),
      snap => onData(snap.exists() ? toCircle(snap.id, snap.data()) : null),
      e => {
        console.warn('subscribeCircle error:', e?.code, e?.message);
        onError(firestoreErrorMessage(e, 'Loading circle'), e?.code);
      },
    );
  } catch (e: any) {
    onError(firestoreErrorMessage(e, 'Loading circle'), e?.code);
    return () => {};
  }
};

export const joinPublicCircle = async (circleId: string, uid: string): Promise<void> => {
  try {
    await updateDoc(doc(db, CIRCLES, circleId), { memberIds: arrayUnion(uid) });
  } catch (e: any) {
    fail(e, 'Joining circle');
  }
};

// Join any circle (private or public) with its 6-character code. Returns the circle id.
export const joinWithCode = async (rawCode: string, uid: string): Promise<string> => {
  const code = normalizeCode(rawCode);
  if (code.length !== 6) throw new Error('Invite codes have 6 characters.');
  let circleId = '';
  try {
    const snap = await getDoc(doc(db, CODES, code));
    circleId = snap.exists() ? String((snap.data() as any)?.circleId || '') : '';
  } catch (e: any) {
    fail(e, 'Checking code');
  }
  if (!circleId) throw new Error('No circle found for this code. Check the code and try again.');
  try {
    // lastJoin proves to the rules that this user knows the invite code
    await updateDoc(doc(db, CIRCLES, circleId), {
      memberIds: arrayUnion(uid),
      lastJoin: { uid, code },
    });
  } catch (e: any) {
    if (e?.code === 'not-found') throw new Error('This circle no longer exists.');
    fail(e, 'Joining circle');
  }
  return circleId;
};

export const leaveCircle = async (circleId: string, uid: string): Promise<void> => {
  try {
    await updateDoc(doc(db, CIRCLES, circleId), { memberIds: arrayRemove(uid) });
  } catch (e: any) {
    fail(e, 'Leaving circle');
  }
};

const deleteInBatches = async (refs: any[]) => {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach(r => batch.delete(r));
    await batch.commit();
  }
};

// Owner or admin. Deletes messages + poll votes first (no Cloud Functions), then the code and the circle.
export const deleteCircle = async (circle: Circle): Promise<void> => {
  try {
    const msgs = await getDocs(collection(db, CIRCLES, circle.id, 'messages'));
    const refs: any[] = [];
    for (const m of msgs.docs) {
      if ((m.data() as any)?.type === 'poll') {
        try {
          const votes = await getDocs(collection(m.ref, 'votes'));
          votes.docs.forEach(v => refs.push(v.ref));
        } catch (e: any) {
          console.warn('deleteCircle votes:', e?.code, e?.message);
        }
      }
    }
    msgs.docs.forEach(m => refs.push(m.ref));
    await deleteInBatches(refs);
  } catch (e: any) {
    // Keep going: the circle itself is what matters
    console.warn('deleteCircle messages cleanup:', e?.code, e?.message);
  }
  if (circle.inviteCode) {
    try {
      await deleteDoc(doc(db, CODES, circle.inviteCode));
    } catch (e: any) {
      console.warn('deleteCircle invite code:', e?.code, e?.message);
    }
  }
  try {
    await deleteDoc(doc(db, CIRCLES, circle.id));
  } catch (e: any) {
    fail(e, 'Deleting circle');
  }
};

// ── Messages ───────────────────────────────────────────────────────────────

// Newest first, last 100 messages, live
export const subscribeMessages = (
  circleId: string,
  onData: (msgs: ChatMessage[]) => void,
  onError: (msg: string) => void,
): Unsubscribe => {
  try {
    return onSnapshot(
      query(collection(db, CIRCLES, circleId, 'messages'), orderBy('createdAt', 'desc'), limit(100)),
      snap =>
        onData(snap.docs.map(d => toMessage(d.id, d.data({ serverTimestamps: 'estimate' })))),
      e => {
        console.warn('subscribeMessages error:', e?.code, e?.message);
        onError(firestoreErrorMessage(e, 'Loading messages'));
      },
    );
  } catch (e: any) {
    onError(firestoreErrorMessage(e, 'Loading messages'));
    return () => {};
  }
};

const bumpLastMessage = async (circleId: string) => {
  try {
    await updateDoc(doc(db, CIRCLES, circleId), { lastMessageAt: serverTimestamp() });
  } catch (e: any) {
    console.warn('lastMessageAt update failed:', e?.code, e?.message);
  }
};

const authorFields = (me: ChatAuthor) => ({
  userId: me.uid,
  userName: (me.name || '').trim() || 'Member',
  userAvatar: inlineAvatar(me.avatar),
  createdAt: serverTimestamp(),
});

const checkImage = (uri: string, max = MAX_BASE64_CHARS + 100) => {
  if (!/^data:image\//.test(uri)) throw new Error('Photo could not be read. Please pick it again.');
  if (uri.length > max) throw new Error('This photo is too large to send. Please pick a smaller photo.');
};

export const sendTextMessage = async (circleId: string, me: ChatAuthor, text: string): Promise<void> => {
  const t = text.trim();
  if (!t) return;
  try {
    await addDoc(collection(db, CIRCLES, circleId, 'messages'), {
      ...authorFields(me),
      type: 'text',
      text: t.slice(0, 2000),
    });
  } catch (e: any) {
    fail(e, 'Sending message');
  }
  bumpLastMessage(circleId);
};

export const sendImageMessage = async (
  circleId: string,
  me: ChatAuthor,
  imageData: string,
  caption?: string,
): Promise<void> => {
  checkImage(imageData);
  try {
    const data: any = { ...authorFields(me), type: 'image', imageData };
    if (caption && caption.trim()) data.text = caption.trim().slice(0, 500);
    await addDoc(collection(db, CIRCLES, circleId, 'messages'), data);
  } catch (e: any) {
    fail(e, 'Sending photo');
  }
  bumpLastMessage(circleId);
};

export const sendPollMessage = async (
  circleId: string,
  me: ChatAuthor,
  kind: PollKind,
  options: PollOption[],
): Promise<void> => {
  if (options.length < 2 || options.length > 4) throw new Error('A poll needs 2 to 4 photos.');
  options.forEach(o => checkImage(o.imageData));
  const total = options.reduce((n, o) => n + o.imageData.length, 0);
  if (total > MAX_POLL_TOTAL_CHARS) {
    throw new Error('These photos are too large together. Remove one or pick smaller photos.');
  }
  try {
    await addDoc(collection(db, CIRCLES, circleId, 'messages'), {
      ...authorFields(me),
      type: 'poll',
      poll: {
        question: POLL_QUESTIONS[kind],
        kind,
        options: options.map(o => ({ imageData: o.imageData, label: o.label.trim().slice(0, 40) })),
      },
    });
  } catch (e: any) {
    fail(e, 'Sending poll');
  }
  bumpLastMessage(circleId);
};

// Author, circle owner or admin
export const deleteMessage = async (circleId: string, message: ChatMessage): Promise<void> => {
  const ref = doc(db, CIRCLES, circleId, 'messages', message.id);
  if (message.type === 'poll') {
    try {
      const votes = await getDocs(collection(ref, 'votes'));
      await deleteInBatches(votes.docs.map(v => v.ref));
    } catch (e: any) {
      console.warn('deleteMessage votes cleanup:', e?.code, e?.message);
    }
  }
  try {
    await deleteDoc(ref);
  } catch (e: any) {
    fail(e, 'Deleting message');
  }
};

// Admin: delete a reported message by id
export const deleteMessageById = async (circleId: string, messageId: string): Promise<void> => {
  try {
    const snap = await getDoc(doc(db, CIRCLES, circleId, 'messages', messageId));
    if (!snap.exists()) return;
    await deleteMessage(circleId, toMessage(snap.id, snap.data()));
  } catch (e: any) {
    if (!e?.code && e instanceof Error) throw e;
    fail(e, 'Deleting message');
  }
};

// ── Poll votes ─────────────────────────────────────────────────────────────

export interface PollTally {
  counts: number[];
  total: number;
  myVote: number | null;
}

export const subscribePollVotes = (
  circleId: string,
  messageId: string,
  optionCount: number,
  myUid: string | undefined,
  onData: (t: PollTally) => void,
): Unsubscribe => {
  try {
    return onSnapshot(
      collection(db, CIRCLES, circleId, 'messages', messageId, 'votes'),
      snap => {
        const counts = new Array(optionCount).fill(0);
        let myVote: number | null = null;
        snap.docs.forEach(d => {
          const idx = (d.data() as any)?.optionIndex;
          if (typeof idx === 'number' && idx >= 0 && idx < optionCount) {
            counts[idx] += 1;
            if (d.id === myUid) myVote = idx;
          }
        });
        onData({ counts, total: counts.reduce((a, b) => a + b, 0), myVote });
      },
      e => console.warn('subscribePollVotes error:', e?.code, e?.message),
    );
  } catch (e: any) {
    console.warn('subscribePollVotes failed:', e?.code, e?.message);
    return () => {};
  }
};

// One doc per user: voting again overwrites the old choice
export const castPollVote = async (
  circleId: string,
  messageId: string,
  uid: string,
  optionIndex: number,
): Promise<void> => {
  try {
    await setDoc(doc(db, CIRCLES, circleId, 'messages', messageId, 'votes', uid), {
      optionIndex,
      updatedAt: serverTimestamp(),
    });
  } catch (e: any) {
    fail(e, 'Voting');
  }
};
