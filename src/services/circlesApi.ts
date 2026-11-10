// Circles (group chats) on Firestore. Photos are base64 data URIs inside the message doc (Spark plan, no Storage).
//   circles/{id}                          circle doc
//   circles/{id}/messages/{msgId}         chat messages (text | image | poll)
//   circles/{id}/messages/{msgId}/votes/{uid}   one poll vote per user
//   inviteCodes/{code}                    -> { circleId } so private circles can be joined by code
// circles/{id}.isPublic (= !isPrivate). The owner can switch a circle between public and private
// later (updateCircleVisibility). Public circles are listed in Discover; private ones are joined with
// the invite link / code. Nearby (Circles > 📍 Nearby): a public circle created with "Show in Nearby"
// saves its approximate location (~100 m) + geohash; getNearbyCircles lists public circles within
// NEARBY_KM (3 km). Legacy: older public circles with a distance limit (radiusKm) stay out of
// Discover (members share the invite code) until the owner clears the limit (removeCircleLocation).
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
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
import { assertClean } from '../utils/profanity';
import { encodeGeohash, geohashNeighbours, haversineKm, roundCoord } from '../utils/geo';
import { getApproxLocation } from '../native/location';

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
  location: { lat: number; lng: number } | null;
  geohash: string | null;
  // Distance limit in km (null = no limit: everyone can see and join it)
  radiusKm: number | null;
  distanceKm?: number; // Nearby list only
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
// Photo polls / multi-photo posts: up to 6 photos labelled A-F
export const MAX_POLL_OPTIONS = 6;
export const POLL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

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
  location:
    d?.location && typeof d.location.lat === 'number' && typeof d.location.lng === 'number'
      ? { lat: d.location.lat, lng: d.location.lng }
      : null,
  geohash: typeof d?.geohash === 'string' ? d.geohash : null,
  radiusKm: typeof d?.radiusKm === 'number' && d.radiusKm > 0 ? d.radiusKm : null,
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

// Circle invite link (opens the app on Android): outfit://join/CODE
export const circleInviteLink = (code: string) => `outfit://join/${normalizeCode(code)}`;

// Invite code from a link or pasted text (outfit://join/CODE, ...?circle=CODE, or the bare code). '' when none.
export const codeFromInvite = (text: string | null | undefined): string => {
  if (!text) return '';
  const m =
    text.match(/outfit:\/\/join\/([A-Za-z0-9]{6})\b/) ||
    text.match(/[?&]circle=([A-Za-z0-9]{6})\b/) ||
    text.trim().match(/^([A-Za-z0-9]{6})$/);
  return m ? m[1].toUpperCase() : '';
};

const fail = (e: any, action: string): never => {
  console.warn(`${action} failed:`, e?.code, e?.message);
  throw new Error(firestoreErrorMessage(e, action));
};

// ── Circles ────────────────────────────────────────────────────────────────

// Distance limits the creator can pick (km). DEFAULT_RADIUS_KM is preselected.
export const RADIUS_OPTIONS = [1, 3, 5, 10];
export const DEFAULT_RADIUS_KM = 3;
export const MAX_RADIUS_KM = 10;

// Location fields saved on a circle (rounded to ~100 m). cosLat lets the rules check a join
// distance without trigonometry.
const locationFields = (loc: { lat: number; lng: number }) => ({
  location: loc,
  geohash: encodeGeohash(loc.lat, loc.lng, 6),
  cosLat: Math.round(Math.cos((loc.lat * Math.PI) / 180) * 10000) / 10000,
});

export const formatKm = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

export const createCircle = async (
  input: {
    name: string;
    description: string;
    emoji: string;
    isPrivate: boolean;
    // Optional: shown in Nearby (public circles only). Rounded to ~100 m before saving.
    location?: { lat: number; lng: number } | null;
    // Optional distance limit (public circles only; needs location). null = no limit.
    radiusKm?: number | null;
  },
  uid: string,
): Promise<Circle> => {
  const name = input.name.trim();
  if (!name) throw new Error('Please give your circle a name.');
  const radiusKm = !input.isPrivate && input.radiusKm ? input.radiusKm : null;
  if (radiusKm && !input.location) {
    throw new Error('A distance limit needs your location. Turn on Location, or choose "No limit".');
  }
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
    const loc =
      !input.isPrivate && input.location
        ? { lat: roundCoord(input.location.lat), lng: roundCoord(input.location.lng) }
        : null;
    const data: any = {
      name: name.slice(0, 60),
      description: input.description.trim().slice(0, 300),
      emoji: input.emoji || '👗',
      isPrivate: input.isPrivate,
      isPublic: !input.isPrivate,
      ...(loc ? locationFields(loc) : {}),
      ...(loc && radiusKm ? { radiusKm } : {}),
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
    // Legacy circles with a distance limit are left out (joined with the invite code)
    return snap.docs
      .map(d => toCircle(d.id, d.data()))
      .filter(c => !c.radiusKm)
      .sort((a, b) => b.memberIds.length - a.memberIds.length || byRecent(a, b));
  } catch (e: any) {
    return fail(e, 'Loading circles');
  }
};

export const NEARBY_KM = 3;

// Public circles within NEARBY_KM (3 km) of me, nearest first. Geohash prefix range queries over the
// precision-5 cells covering the 3 km box (index: circles isPrivate ASC + geohash ASC), then an
// exact great-circle distance filter. If that index isn't deployed, falls back to public circles
// filtered on the phone. (isPrivate == false because the read rule is written on isPrivate.)
export const getNearbyCircles = async (lat: number, lng: number): Promise<Circle[]> => {
  const col = collection(db, CIRCLES);
  const within = (cs: Circle[]): Circle[] => {
    const seen = new Set<string>();
    const out: Circle[] = [];
    cs.forEach(c => {
      if (seen.has(c.id) || c.isPrivate || !c.location) return;
      seen.add(c.id);
      const km = haversineKm(lat, lng, c.location.lat, c.location.lng);
      if (km <= NEARBY_KM) out.push({ ...c, distanceKm: km });
    });
    return out.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  };
  try {
    const cells = geohashNeighbours(lat, lng, 5, NEARBY_KM);
    const snaps = await Promise.all(
      cells.map(h =>
        getDocs(
          query(
            col,
            where('isPrivate', '==', false),
            where('geohash', '>=', h),
            where('geohash', '<=', h + '~'),
            limit(100),
          ),
        ),
      ),
    );
    return within(snaps.flatMap(sn => sn.docs.map(d => toCircle(d.id, d.data()))));
  } catch (e: any) {
    // failed-precondition = composite index missing (firestore.indexes.json not deployed)
    console.warn('Nearby geohash query failed, using fallback:', e?.code, e?.message);
  }
  try {
    const snap = await getDocs(query(col, where('isPrivate', '==', false), limit(500)));
    return within(snap.docs.map(d => toCircle(d.id, d.data())));
  } catch (e: any) {
    return fail(e, 'Loading nearby circles');
  }
};

// Owner (or admin, once the rules allow it): switch public <-> private after creation.
// Private: removes location, geohash and the distance limit (no longer in Discover or Nearby;
// invite code still works).
// Public: optional approximate location (rounded to ~100 m) and distance limit (radiusKm, needs the
// location; null = no limit).
export const updateCircleVisibility = async (
  circleId: string,
  isPrivate: boolean,
  location?: { lat: number; lng: number } | null,
  radiusKm?: number | null,
): Promise<void> => {
  const data: any = { isPrivate, isPublic: !isPrivate };
  if (isPrivate) {
    data.location = deleteField();
    data.geohash = deleteField();
    data.cosLat = deleteField();
    data.radiusKm = deleteField();
  } else if (location) {
    const loc = { lat: roundCoord(location.lat), lng: roundCoord(location.lng) };
    Object.assign(data, locationFields(loc));
    data.radiusKm = radiusKm ? radiusKm : deleteField();
  }
  try {
    await updateDoc(doc(db, CIRCLES, circleId), data);
  } catch (e: any) {
    fail(e, 'Updating circle');
  }
};

// Owner: clear a legacy distance limit / location (public circle then shows in Discover for everyone)
export const removeCircleLocation = async (circleId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, CIRCLES, circleId), {
      location: deleteField(),
      geohash: deleteField(),
      cosLat: deleteField(),
      radiusKm: deleteField(),
    });
  } catch (e: any) {
    fail(e, 'Updating circle');
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

// Join from Discover / the circle screen. A legacy circle with a distance limit needs the user's
// location (Location on) and the user within radiusKm; the approximate location (~100 m) goes into
// lastJoin so the rules can check it. Far away: join with the invite code a member shares instead.
export const joinCircle = async (circle: Circle, uid: string): Promise<void> => {
  if (circle.isPrivate) throw new Error('This circle is private. Join it with an invite code.');
  if (!circle.radiusKm || !circle.location) return joinPublicCircle(circle.id, uid);
  const loc = await getApproxLocation();
  if (!loc.ok) {
    throw new Error(
      `${circle.name} is only for people within ${circle.radiusKm} km. Turn on Location to join.\n${loc.message}`,
    );
  }
  const km = haversineKm(loc.coords.lat, loc.coords.lng, circle.location.lat, circle.location.lng);
  if (km > circle.radiusKm) {
    throw new Error(
      `${circle.name} is only for people within ${circle.radiusKm} km, and you are about ${formatKm(km)} away. Ask a member for the invite link or code.`,
    );
  }
  try {
    await updateDoc(doc(db, CIRCLES, circle.id), {
      memberIds: arrayUnion(uid),
      lastJoin: { uid, lat: roundCoord(loc.coords.lat), lng: roundCoord(loc.coords.lng) },
    });
  } catch (e: any) {
    if (e?.code === 'permission-denied') {
      throw new Error(`You need to be within ${circle.radiusKm} km of ${circle.name} to join. Ask a member for the invite code.`);
    }
    fail(e, 'Joining circle');
  }
};

// Join any circle (private or public) with its 6-character code. Returns the circle id.
export const joinWithCode = async (rawCode: string, uid: string): Promise<string> => {
  // Accepts the bare code or a pasted invite link / message (outfit://join/CODE)
  const code = codeFromInvite(rawCode) || normalizeCode(rawCode);
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
      const t = (m.data() as any)?.type;
      if (t === 'poll' || t === 'image') {
        for (const sub of t === 'poll' ? ['votes', 'reactions', 'comments'] : ['reactions', 'comments']) {
          try {
            const docs = await getDocs(collection(m.ref, sub));
            docs.docs.forEach(v => refs.push(v.ref));
          } catch (e: any) {
            console.warn(`deleteCircle ${sub}:`, e?.code, e?.message);
          }
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
  assertClean(t, 'Please keep messages respectful 🙏');
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
  if (caption) assertClean(caption, 'Please keep messages respectful 🙏');
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
  if (options.length < 2 || options.length > MAX_POLL_OPTIONS) {
    throw new Error(`A poll needs 2 to ${MAX_POLL_OPTIONS} photos.`);
  }
  options.forEach(o => checkImage(o.imageData));
  options.forEach(o => assertClean(o.label || '', 'Please keep poll labels respectful 🙏'));
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
        // Empty labels become A, B, C...
        options: options.map((o, i) => ({
          imageData: o.imageData,
          label: (o.label || '').trim().slice(0, 40) || POLL_LETTERS[i],
        })),
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
  // Votes, reactions and comments under the message (best effort; no Cloud Functions)
  if (message.type !== 'text') {
    for (const sub of message.type === 'poll' ? ['votes', 'reactions', 'comments'] : ['reactions', 'comments']) {
      try {
        const docs = await getDocs(collection(ref, sub));
        await deleteInBatches(docs.docs.map(v => v.ref));
      } catch (e: any) {
        console.warn(`deleteMessage ${sub} cleanup:`, e?.code, e?.message);
      }
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
