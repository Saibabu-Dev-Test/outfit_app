// Circles (group chats) on Firestore. Photos are base64 data URIs inside the message doc (Spark plan, no Storage).
//   circles/{id}                          circle doc
//   circles/{id}/messages/{msgId}         chat messages (text | image | poll)
//   circles/{id}/messages/{msgId}/votes/{uid}   one poll vote per user
//   inviteCodes/{code}                    -> { circleId } so any circle can be joined by code
//   circleNames/{nameId}                  -> { circleId, ownerId, createdAt } unique circle names
// circles/{id}.isPublic (= !isPrivate). Circles screen tabs:
//   Mine:     circles I belong to.
//   Discover: public circles of my district (circles/{id}.district / districtKey / state, set on
//             create from the creator's location or profile district), location on or off.
//   Nearby:   public circles with a location (optional, ~100 m + geohash) within NEARBY_KM (3 km).
// Public circles are joined without a code (my district or within 3 km, checked in the app);
// private circles are never listed and are joined only with the invite code / link (joinWithCode).
// Legacy circles without a district simply don't show in Discover.
// The owner can edit name / description / emoji (updateCircleDetails) and switch public <-> private
// (updateCircleVisibility: public saves the district and, when known, the approximate location).
// Names are unique (case-insensitive, trimmed, spaces collapsed): circles/{id}.nameLower is the
// normalized name, circles/{id}.nameKey the circleNames doc id, both written in the same transaction
// as the circleNames doc (Firestore rules check the pairing).
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
  runTransaction,
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
import { awardCoins } from './coinsApi';
import { db } from '../config/firebaseConfig';
import { splitChatPhoto } from './photoSplit';
import { dataUriBytes, isQuotaError, markFull, placePhoto, recordUpload } from './photoStorage';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { MAX_BASE64_CHARS } from '../utils/imagePicker';
import { toDate } from '../utils/date';
import { inlineAvatar } from './userApi';
import { assertClean } from '../utils/profanity';
import { encodeGeohash, geohashNeighbours, haversineKm, roundCoord } from '../utils/geo';
import { DistrictInfo, canJoinWithoutCode, filterDistrictCircles, filterNearbyCircles } from '../utils/district';
import { getApproxLocation } from '../native/location';
import { cleanAge, myAgeFields } from '../utils/age';
import { markEarnVote } from './earnApi';

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
  // circleNames doc id (null for legacy circles created before unique names)
  nameKey: string | null;
  // Distance limit in km (null = no limit: everyone can see and join it)
  radiusKm: number | null;
  // District (Discover). null on legacy circles created before districts.
  district: string | null;
  districtKey: string | null;
  state: string | null;
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
  userAge?: number | null;
  userAvatar: string | null;
  text?: string;
  imageData?: string; // photo shown in the chat (clear copy on new messages)
  hasFull?: boolean; // near-original photo in messages/{id}/media/full (getMessageFullPhoto)
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
const NAMES = 'circleNames';
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
  nameKey: typeof d?.nameKey === 'string' && d.nameKey ? d.nameKey : null,
  radiusKm: typeof d?.radiusKm === 'number' && d.radiusKm > 0 ? d.radiusKm : null,
  district: typeof d?.district === 'string' && d.district ? d.district : null,
  districtKey: typeof d?.districtKey === 'string' && d.districtKey ? d.districtKey : null,
  state: typeof d?.state === 'string' && d.state ? d.state : null,
});

const districtFields = (d?: DistrictInfo | null) =>
  d && d.districtKey ? { district: d.district, districtKey: d.districtKey, state: d.state || '' } : {};

const toMessage = (id: string, d: any): ChatMessage => {
  const type: MessageType = d?.type === 'image' || d?.type === 'poll' ? d.type : 'text';
  const m: ChatMessage = {
    id,
    userId: String(d?.userId || ''),
    userName: d?.userName || 'Member',
    userAge: cleanAge(d?.userAge),
    userAvatar: d?.userAvatar || null,
    type,
    createdAt: toDate(d?.createdAt),
  };
  if (typeof d?.text === 'string') m.text = d.text;
  if (typeof d?.imageData === 'string') m.imageData = d.imageData;
  if (d?.full === 1) m.hasFull = true;
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

// ── Unique names ───────────────────────────────────────────────────────────

export const MAX_NAME_CHARS = 60;

// What we save / show: trimmed, runs of whitespace collapsed to one space, max 60 chars
export const cleanCircleName = (name: string): string =>
  String(name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_CHARS).trim();

// Uniqueness key: the cleaned name in lower case ("  Office   LOOKS " -> "office looks")
export const normalizeCircleName = (name: string): string => cleanCircleName(name).toLowerCase();

// circleNames doc id for a normalized name. Firestore ids can't contain "/" and can't be "." / ".."
// or look like __x__, so those characters are %-escaped ("%" first, so the mapping stays one-to-one).
export const circleNameDocId = (key: string): string => {
  let id = key.replace(/%/g, '%25').replace(/\//g, '%2F');
  if (id === '.' || id === '..' || /^__.*__$/.test(id)) {
    id = id.replace(/[._]/g, c => (c === '.' ? '%2E' : '%5F'));
  }
  return id;
};

export const nameTakenMessage = (name: string) =>
  `A circle called "${cleanCircleName(name)}" already exists. Please choose a different name.`;

// Common spellings of a name for the legacy exact-match query (Firestore 'in' takes up to 30):
// as typed, lower, UPPER, Title Case, Sentence case
export const nameVariants = (display: string): string[] => {
  const lower = display.toLowerCase();
  const title = lower.replace(/(^|\s)(\S)/g, (_m, sp, ch) => sp + ch.toUpperCase());
  const sentence = lower.charAt(0).toUpperCase() + lower.slice(1);
  return Array.from(new Set([display, lower, display.toUpperCase(), title, sentence])).filter(Boolean);
};

// Circles created before circleNames existed have no name doc. Best-effort check against them:
// public circles with the same nameLower or a common spelling of the name, plus my own circles (private
// circles of other people can't be queried under the read rules). Errors never block.
const legacyNameTaken = async (display: string, key: string, uid: string, exceptId?: string): Promise<boolean> => {
  const col = collection(db, CIRCLES);
  const other = (id: string) => id !== exceptId;
  const checks: Promise<boolean>[] = [
    getDocs(query(col, where('isPrivate', '==', false), where('nameLower', '==', key), limit(3))).then(sn =>
      sn.docs.some(d => other(d.id)),
    ),
    getDocs(
      query(col, where('isPrivate', '==', false), where('name', 'in', nameVariants(display)), limit(3)),
    ).then(sn => sn.docs.some(d => other(d.id))),
    getDocs(query(col, where('memberIds', 'array-contains', uid))).then(sn =>
      sn.docs.some(d => other(d.id) && normalizeCircleName((d.data() as any)?.name || '') === key),
    ),
  ];
  const results = await Promise.all(
    checks.map(p =>
      p.catch((e: any) => {
        console.warn('Circle name check failed:', e?.code, e?.message);
        return false;
      }),
    ),
  );
  return results.some(Boolean);
};

// Is this name free? (For an inline hint before saving; create / rename check again atomically.)
export const isCircleNameAvailable = async (name: string, uid: string, exceptCircleId?: string): Promise<boolean> => {
  const display = cleanCircleName(name);
  const key = display.toLowerCase();
  if (!key) return false;
  try {
    const snap = await getDoc(doc(db, NAMES, circleNameDocId(key)));
    if (snap.exists() && String((snap.data() as any)?.circleId || '') !== exceptCircleId) return false;
  } catch (e: any) {
    console.warn('Circle name lookup failed:', e?.code, e?.message);
  }
  return !(await legacyNameTaken(display, key, uid, exceptCircleId));
};

// A write was denied: was it because the name doc was taken in the meantime?
const nameDocTakenBy = async (nameId: string, circleId: string): Promise<boolean> => {
  try {
    const snap = await getDoc(doc(db, NAMES, nameId));
    return snap.exists() && String((snap.data() as any)?.circleId || '') !== circleId;
  } catch {
    return false;
  }
};

// ── Create ─────────────────────────────────────────────────────────────────

const DISTRICT_NEEDED =
  `Public circles show in Discover to people of your district. Turn on Location or choose your ` +
  `district on the Discover tab, or make the circle private (joined with the invite code).`;
const LOCATION_NEEDED = 'This needs your approximate location. Turn on Location and try again.';

export const createCircle = async (
  input: {
    name: string;
    description: string;
    emoji: string;
    isPrivate: boolean;
    // Optional (public only): also shows in Nearby. Rounded to ~100 m before saving.
    location?: { lat: number; lng: number } | null;
    // Public circles: creator's district (from location, else profile). Required for public.
    district?: DistrictInfo | null;
    // Legacy distance limit (public circles only; needs location). null = no limit.
    radiusKm?: number | null;
  },
  uid: string,
): Promise<Circle> => {
  const name = cleanCircleName(input.name);
  if (!name) throw new Error('Please give your circle a name.');
  const nameLower = name.toLowerCase();
  const nameKey = circleNameDocId(nameLower);
  if (!input.isPrivate && !input.district?.districtKey) throw new Error(DISTRICT_NEEDED);
  const radiusKm = !input.isPrivate && input.radiusKm ? input.radiusKm : null;
  const ref = doc(collection(db, CIRCLES));
  try {
    if (await legacyNameTaken(name, nameLower, uid)) throw new Error(nameTakenMessage(name));

    // Pick an unused invite code
    let code = '';
    for (let i = 0; i < 6 && !code; i++) {
      const candidate = randomCode();
      const taken = await getDoc(doc(db, CODES, candidate));
      if (!taken.exists()) code = candidate;
    }
    if (!code) throw new Error('Could not create an invite code. Please try again.');

    const loc =
      !input.isPrivate && input.location
        ? { lat: roundCoord(input.location.lat), lng: roundCoord(input.location.lng) }
        : null;
    const data: any = {
      name,
      nameLower,
      nameKey,
      description: input.description.trim().slice(0, 300),
      emoji: input.emoji || '👗',
      isPrivate: input.isPrivate,
      isPublic: !input.isPrivate,
      ...(input.isPrivate ? {} : districtFields(input.district)),
      ...(loc ? locationFields(loc) : {}),
      ...(loc && radiusKm ? { radiusKm } : {}),
      ownerId: uid,
      memberIds: [uid],
      inviteCode: code,
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
    };
    // Circle + invite code + name doc together. The name doc is read inside the transaction, and the
    // rules only allow creating it when it does not exist yet, so two people can't take one name.
    const nameRef = doc(db, NAMES, nameKey);
    await runTransaction(db, async tx => {
      const existing = await tx.get(nameRef);
      if (existing.exists()) throw new Error(nameTakenMessage(name));
      tx.set(ref, data);
      tx.set(doc(db, CODES, code), { circleId: ref.id, createdBy: uid, createdAt: serverTimestamp() });
      tx.set(nameRef, { circleId: ref.id, ownerId: uid, createdAt: serverTimestamp() });
    });
    const now = new Date();
    return { ...toCircle(ref.id, data), createdAt: now, lastMessageAt: now };
  } catch (e: any) {
    if (!e?.code && e instanceof Error) throw e;
    if (e?.code === 'permission-denied' && (await nameDocTakenBy(nameKey, ref.id))) {
      throw new Error(nameTakenMessage(name));
    }
    return fail(e, 'Creating circle');
  }
};

// ── Edit (owner) ───────────────────────────────────────────────────────────

// Owner: change name / description / emoji. A new name must be free (circleNames doc, plus the
// legacy check); the old name doc is deleted and the new one created in the same transaction.
// Legacy circles get their name doc (and nameLower / nameKey) on the first save, when the name is free.
export const updateCircleDetails = async (
  circleId: string,
  input: { name: string; description: string; emoji: string },
  uid: string,
): Promise<void> => {
  const name = cleanCircleName(input.name);
  if (!name) throw new Error('Please give your circle a name.');
  const nameLower = name.toLowerCase();
  const nameKey = circleNameDocId(nameLower);
  const circleRef = doc(db, CIRCLES, circleId);
  try {
    const before = await getDoc(circleRef);
    if (!before.exists()) throw new Error('This circle no longer exists.');
    const cur: any = before.data();
    if (String(cur?.ownerId || '') !== uid) throw new Error('Only the circle owner can edit it.');
    const oldLower = typeof cur?.nameLower === 'string' ? cur.nameLower : normalizeCircleName(cur?.name || '');
    if (nameLower !== oldLower && (await legacyNameTaken(name, nameLower, uid, circleId))) {
      throw new Error(nameTakenMessage(name));
    }

    await runTransaction(db, async tx => {
      // Reads first (transaction rule), then writes
      const cs = await tx.get(circleRef);
      if (!cs.exists()) throw new Error('This circle no longer exists.');
      const c: any = cs.data();
      if (String(c?.ownerId || '') !== uid) throw new Error('Only the circle owner can edit it.');
      const curLower = typeof c?.nameLower === 'string' ? c.nameLower : normalizeCircleName(c?.name || '');
      const oldKey = typeof c?.nameKey === 'string' && c.nameKey ? c.nameKey : circleNameDocId(curLower);
      const newRef = doc(db, NAMES, nameKey);
      const oldRef = doc(db, NAMES, oldKey);
      const ns = await tx.get(newRef);
      const os = oldKey !== nameKey ? await tx.get(oldRef) : null;

      const nameChanged = name !== String(c?.name || '') || nameLower !== curLower;
      const takenByOther = ns.exists() && String((ns.data() as any)?.circleId || '') !== circleId;
      const update: any = {
        description: input.description.trim().slice(0, 300),
        emoji: input.emoji || c?.emoji || '👗',
      };
      if (takenByOther) {
        if (nameChanged) throw new Error(nameTakenMessage(name));
        // Legacy duplicate keeping its unchanged name: save the other fields only
      } else {
        Object.assign(update, { name, nameLower, nameKey });
        if (!ns.exists()) tx.set(newRef, { circleId, ownerId: uid, createdAt: serverTimestamp() });
        if (os && os.exists() && String((os.data() as any)?.circleId || '') === circleId) tx.delete(oldRef);
      }
      tx.update(circleRef, update);
    });
  } catch (e: any) {
    if (!e?.code && e instanceof Error) throw e;
    if (e?.code === 'permission-denied' && (await nameDocTakenBy(nameKey, circleId))) {
      throw new Error(nameTakenMessage(name));
    }
    fail(e, 'Saving circle');
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

// Discover: public circles of my district (isPublic == true && districtKey == X; equality-only, so
// Firestore's single-field indexes serve it, plus a composite in firestore.indexes.json). Circles
// I'm already in are included (shown as members).
export const getDistrictCircles = async (myDistrictKey: string): Promise<Circle[]> => {
  if (!myDistrictKey) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, CIRCLES),
        where('isPublic', '==', true),
        where('districtKey', '==', myDistrictKey),
        limit(200),
      ),
    );
    return filterDistrictCircles(snap.docs.map(d => toCircle(d.id, d.data())), myDistrictKey).sort(byRecent);
  } catch (e: any) {
    return fail(e, 'Loading circles in your district');
  }
};

export const NEARBY_KM = 3;

// Distance within which a public circle can be joined without its code: its legacy distance limit
// if smaller, otherwise NEARBY_KM. (Rules: circles joinedNearby, with ~0.5 km slack for rounding.)
export const joinRadiusKm = (c: Pick<Circle, 'radiusKm'>): number =>
  c.radiusKm && c.radiusKm < NEARBY_KM ? c.radiusKm : NEARBY_KM;

// Public circles within NEARBY_KM (3 km) of me, nearest first. Geohash prefix range queries over the
// precision-5 cells covering the 3 km box (index: circles isPrivate ASC + geohash ASC), then an
// exact great-circle distance filter. If that index isn't deployed, falls back to public circles
// filtered on the phone. (isPrivate == false because the read rule is written on isPrivate.)
export const getNearbyCircles = async (lat: number, lng: number): Promise<Circle[]> => {
  const col = collection(db, CIRCLES);
  const within = (cs: Circle[]): Circle[] => filterNearbyCircles(cs, lat, lng, NEARBY_KM);
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

// Owner (or admin): switch public <-> private, or refresh a public circle's location.
// Private: removes location, geohash and the distance limit (no longer in Nearby; the invite code
// still works). Public: needs the approximate location (rounded to ~100 m) so the circle shows to
// people within NEARBY_KM; optional legacy distance limit (radiusKm; null = no limit).
export const updateCircleVisibility = async (
  circleId: string,
  isPrivate: boolean,
  location?: { lat: number; lng: number } | null,
  radiusKm?: number | null,
  district?: DistrictInfo | null,
): Promise<void> => {
  const data: any = { isPrivate, isPublic: !isPrivate };
  if (!isPrivate && district?.districtKey) Object.assign(data, districtFields(district));
  if (isPrivate || !location) {
    data.location = deleteField();
    data.geohash = deleteField();
    data.cosLat = deleteField();
    data.radiusKm = deleteField();
  } else {
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

// Owner / admin: public circle, save my current approximate location as the circle's location.
export const setCircleLocationHere = async (circleId: string): Promise<void> => {
  const loc = await getApproxLocation();
  if (!loc.ok) throw new Error(`${LOCATION_NEEDED}\n${loc.message}`);
  await updateCircleVisibility(circleId, false, loc.coords, null);
};

// Clears location / distance limit. NOTE: a public circle without a location no longer shows in
// Nearby (code-only); prefer updateCircleVisibility / setCircleLocationHere.
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

// Join without a code (Discover / Nearby / circle screen): public circles only, and (checked here
// in the app) only when the circle is in my district or within NEARBY_KM of me. me.districtKey comes
// from districtApi.resolveMyPlace; the location is read only when the district doesn't match.
// Private circles are joined only with the invite link / code (joinWithCode).
export const joinCircle = async (
  circle: Circle,
  uid: string,
  me: { districtKey?: string | null; coords?: { lat: number; lng: number } | null } = {},
): Promise<void> => {
  const codeHint = 'Ask a member for the invite link or code.';
  if (circle.isPrivate) throw new Error(`${circle.name} is private. Join it with an invite code.`);
  let coords = me.coords || null;
  if (!canJoinWithoutCode(circle, { districtKey: me.districtKey, coords }, NEARBY_KM) && circle.location && !coords) {
    const loc = await getApproxLocation();
    if (loc.ok) coords = loc.coords;
  }
  if (!canJoinWithoutCode(circle, { districtKey: me.districtKey, coords }, NEARBY_KM)) {
    const inDistrict = circle.district ? ` (${circle.district} district)` : '';
    const dist =
      circle.location && coords
        ? ` You are about ${formatKm(haversineKm(coords.lat, coords.lng, circle.location.lat, circle.location.lng))} away.`
        : '';
    throw new Error(
      `${circle.name}${inDistrict} can be joined by people of its district or within ${NEARBY_KM} km.${dist} ${codeHint}`,
    );
  }
  try {
    await updateDoc(doc(db, CIRCLES, circle.id), {
      memberIds: arrayUnion(uid),
      lastJoin: coords
        ? { uid, lat: roundCoord(coords.lat), lng: roundCoord(coords.lng) }
        : { uid, districtKey: me.districtKey || '' },
    });
  } catch (e: any) {
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
  // Then free the name (only if the name doc points at this circle; legacy circles may have none)
  try {
    const nameId = circle.nameKey || circleNameDocId(normalizeCircleName(circle.name));
    const ns = await getDoc(doc(db, NAMES, nameId));
    if (ns.exists() && String((ns.data() as any)?.circleId || '') === circle.id) {
      await deleteDoc(ns.ref);
    }
  } catch (e: any) {
    console.warn('deleteCircle name:', e?.code, e?.message);
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
  ...myAgeFields(),
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
  fullImage?: string | null,
): Promise<void> => {
  checkImage(imageData);
  if (fullImage) checkImage(fullImage);
  if (caption) assertClean(caption, 'Please keep messages respectful 🙏');
  // Small copy in the message (chat list), near-original photo in media/full (opened on tap)
  const photo = await splitChatPhoto(imageData, fullImage);
  // Photo storage chain: the near-original copy goes to the first free provider with room
  // (Firebase -> inline in media/full as before; another provider -> its URL in media/full).
  // Chat photos are hidden after 60 days (utils/photoExpiry); nothing is moved or deleted.
  let fullStored: string | null = photo.full || null;
  if (photo.full) {
    const placed = await placePhoto(photo.full, 'circles');
    if (placed.provider !== 'firebase') fullStored = (placed as { url: string }).url;
  }
  try {
    const data: any = { ...authorFields(me), type: 'image', imageData: photo.inline };
    if (caption && caption.trim()) data.text = caption.trim().slice(0, 500);
    const ref = doc(collection(db, CIRCLES, circleId, 'messages'));
    const b = writeBatch(db);
    if (photo.full) {
      data.full = 1;
      b.set(ref, data);
      b.set(doc(db, CIRCLES, circleId, 'messages', ref.id, 'media', 'full'), {
        imageData: fullStored,
        userId: me.uid,
        createdAt: serverTimestamp(),
      });
    } else {
      b.set(ref, data);
    }
    await b.commit();
    recordUpload('firebase', dataUriBytes(photo.inline) + (fullStored && fullStored === photo.full ? dataUriBytes(photo.full) : 0));
    awardCoins('upload', `msg_${circleId}_${ref.id}`); // coins (fire-and-forget)
  } catch (e: any) {
    if (isQuotaError(e)) markFull('firebase'); // next photos go to the next provider
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
    const ref = await addDoc(collection(db, CIRCLES, circleId, 'messages'), {
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
    awardCoins('upload', `msg_${circleId}_${ref.id}`); // coins (fire-and-forget)
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
    if (message.hasFull) {
      const b = writeBatch(db);
      b.delete(doc(ref, 'media', 'full'));
      b.delete(ref);
      await b.commit();
    } else {
      await deleteDoc(ref);
    }
  } catch (e: any) {
    fail(e, 'Deleting message');
  }
};

// Near-original photo of an image message (1 read, cached for the session). Never throws: falls
// back to the photo shown in the chat.
const msgFullCache = new Map<string, string>();
export const getMessageFullPhoto = async (circleId: string, message: ChatMessage): Promise<string> => {
  const shown = message.imageData || '';
  if (!message.hasFull) return shown;
  const key = `${circleId}_${message.id}`;
  const hit = msgFullCache.get(key);
  if (hit) return hit;
  try {
    const s = await getDoc(doc(db, CIRCLES, circleId, 'messages', message.id, 'media', 'full'));
    const full = s.exists() ? (s.data() as any)?.imageData : null;
    if (typeof full !== 'string' || !full) return shown;
    if (msgFullCache.size >= 12) msgFullCache.delete(msgFullCache.keys().next().value as string);
    msgFullCache.set(key, full);
    return full;
  } catch (e: any) {
    console.warn('message full photo failed:', e?.code, e?.message);
    return shown;
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
  // +1 coin on my first vote on this poll (coinEvents/vote_poll_<circleId>_<msgId>) + coin flip
  awardCoins('vote', `poll_${circleId}_${messageId}`);
  markEarnVote(uid); // Earn tab: today's "vote on 1 outfit"
};
