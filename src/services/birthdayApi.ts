// 🎂 Birthdays (opt-in, default OFF): Home card with birthdays today and the next 7 days, wishes
// with @name replies, and the daily "Happy birthday to all" circle for same-day birthdays.
//
// Firestore (free Spark plan, cheap reads):
//   birthdays/{uid}                       {name, avatar, md: 'MM-DD', updatedAt}
//       exists only while the user has "Show my birthday" ON. Day and month only: never the year,
//       never the age. Rules check md against the user's own users/{uid}.dob.
//       Home reads it with ONE query: where md in [today .. +7 days] (8 keys), cached per day.
//   birthdays/{uid}/wishes/{autoId}       {userId, userName, userAvatar, text, day: 'YYYY-MM-DD',
//                                          replyToUid, replyToName, createdAt}
//       `day` is that year's birthday; wishes are accepted from 7 days before until the day ends.
//   bdayCircles/{YYYY-MM-DD}/messages/{autoId}  {userId, userName, userAvatar, type, text, imageData, createdAt}
//       readable / writable only by users whose opted-in birthday is that day, and only around
//       that day (rules), so it disappears the next day without any TTL / cleanup job.
// Notifications: a wish (and an @reply) writes users/{to}/activity {type: 'wish' | 'mention'}, which
// the app's activity watcher turns into a local notification (services/activityWatcher.ts).
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { assertClean } from '../utils/profanity';
import { localDateKey, toDate } from '../utils/date';
import { inlineAvatar, saveUserProfile } from './userApi';
import { logActivity } from './activityApi';

export const BIRTHDAYS = 'birthdays';
export const BDAY_CIRCLES = 'bdayCircles';
export const BIRTHDAY_DAYS_AHEAD = 7;
export const WISH_MAX = 300;
export const BDAY_MSG_MAX = 1000;
export const BDAY_PHOTO_MAX_CHARS = 150000; // POLL_SPEC photo (~80 KB WebP -> ~109K chars) + slack

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// 'YYYY-MM-DD' (date of birth) -> 'MM-DD'; null when missing / invalid
export const mdFromDob = (dob?: string | null): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dob || '').trim());
  if (!m) return null;
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${m[2]}-${m[3]}`;
};

// '11-14' -> '14 Nov' (day and month only)
export const mdLabel = (md: string): string => {
  const [m, d] = md.split('-').map(Number);
  return m >= 1 && m <= 12 ? `${d} ${MONTHS[m - 1]}` : md;
};

// The 'MM-DD' keys that have their birthday on this calendar date. 29 Feb birthdays are
// celebrated on 28 Feb in non-leap years.
export const mdKeysOn = (date: Date): string[] => {
  const md = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return md === '02-28' && !isLeap(date.getFullYear()) ? [md, '02-29'] : [md];
};

export interface BirthdayDay {
  dateKey: string; // 'YYYY-MM-DD' (local)
  inDays: number; // 0 = today
  mds: string[];
}

// Today and the next `days` days, with the birthday keys of each (today first)
export const upcomingDays = (today: Date = new Date(), days = BIRTHDAY_DAYS_AHEAD): BirthdayDay[] => {
  const out: BirthdayDay[] = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    out.push({ dateKey: localDateKey(d), inDays: i, mds: mdKeysOn(d) });
  }
  return out;
};

// The birthday this wish / page belongs to: this year's date for `md` when it is today or still
// ahead (or was yesterday: one grace day so late notifications still open the right wishes),
// else next year's.
export const birthdayDateFor = (md: string, today: Date = new Date()): string => {
  const [m, d] = md.split('-').map(Number);
  const on = (y: number) => {
    const day = m === 2 && d === 29 && !isLeap(y) ? 28 : d;
    return new Date(y, m - 1, day);
  };
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterday = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() - 1);
  const thisYear = on(t0.getFullYear());
  if (thisYear.getTime() >= yesterday.getTime()) return localDateKey(thisYear);
  return localDateKey(on(t0.getFullYear() + 1));
};

// Whole days from today (local) to 'YYYY-MM-DD'
export const daysUntil = (dateKey: string, today: Date = new Date()): number => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86400000);
};

export interface BirthdayEntry {
  uid: string;
  name: string;
  avatar: string | null;
  md: string;
  dateKey: string;
  inDays: number;
}

// Sorted: today first, then by days to go, then name
export const entriesFor = (docs: { uid: string; d: any }[], today: Date = new Date()): BirthdayEntry[] => {
  const days = upcomingDays(today);
  const out: BirthdayEntry[] = [];
  docs.forEach(({ uid, d }) => {
    const md = typeof d?.md === 'string' ? d.md : '';
    const day = days.find(x => x.mds.includes(md));
    if (!day) return;
    out.push({
      uid,
      name: (typeof d?.name === 'string' && d.name.trim()) || 'Outfit user',
      avatar: typeof d?.avatar === 'string' ? d.avatar : null,
      md,
      dateKey: day.dateKey,
      inDays: day.inDays,
    });
  });
  return out.sort((a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name));
};

// ── My listing ("Show my birthday") ──
export interface MyBirthday {
  on: boolean;
  md: string | null;
}
const myCache = new Map<string, MyBirthday>();

export const getMyBirthday = async (uid: string): Promise<MyBirthday> => {
  const hit = myCache.get(uid);
  if (hit) return hit;
  try {
    const s = await getDoc(doc(db, BIRTHDAYS, uid));
    const v: MyBirthday = s.exists() ? { on: true, md: String((s.data() as any)?.md || '') || null } : { on: false, md: null };
    myCache.set(uid, v);
    return v;
  } catch {
    return { on: false, md: null };
  }
};

// Turns the listing on (writes / refreshes birthdays/{uid}) or off (deletes it), and saves
// users/{uid}.showBirthday. Needs a valid date of birth to turn on. Throws a readable Error.
export const setBirthdayListing = async (
  uid: string,
  on: boolean,
  p: { dob?: string | null; name?: string | null; avatar?: string | null },
): Promise<void> => {
  const md = mdFromDob(p.dob);
  if (on && !md) throw new Error('Add your date of birth in Edit profile first.');
  try {
    await saveUserProfile(uid, { showBirthday: on } as any);
    if (on && md) {
      await setDoc(doc(db, BIRTHDAYS, uid), {
        name: ((p.name || '').trim() || 'Outfit user').slice(0, 60),
        avatar: inlineAvatar(p.avatar),
        md,
        updatedAt: serverTimestamp(),
      });
      myCache.set(uid, { on: true, md });
    } else {
      await deleteDoc(doc(db, BIRTHDAYS, uid));
      myCache.set(uid, { on: false, md: null });
    }
    listCache.clear();
  } catch (e: any) {
    throw new Error(e?.code ? firestoreErrorMessage(e, 'Saving birthday setting') : e?.message || 'Please try again.');
  }
};

// ── Home card: one query per day ──
const listCache = new Map<string, Promise<BirthdayEntry[]>>();

export const getUpcomingBirthdays = (today: Date = new Date()): Promise<BirthdayEntry[]> => {
  const key = localDateKey(today);
  let p = listCache.get(key);
  if (!p) {
    const mds = Array.from(new Set(upcomingDays(today).flatMap(d => d.mds))); // <= 9 keys (Firestore 'in' max 30)
    p = getDocs(query(collection(db, BIRTHDAYS), where('md', 'in', mds), limit(100)))
      .then(snap => entriesFor(snap.docs.map(s => ({ uid: s.id, d: s.data() })), today))
      .catch(e => {
        listCache.delete(key);
        console.warn('getUpcomingBirthdays failed:', e?.code, e?.message);
        return [];
      });
    listCache.clear();
    listCache.set(key, p);
  }
  return p;
};

export const getBirthday = async (uid: string): Promise<{ name: string; avatar: string | null; md: string } | null> => {
  try {
    const s = await getDoc(doc(db, BIRTHDAYS, uid));
    if (!s.exists()) return null;
    const d: any = s.data();
    return { name: d?.name || 'Outfit user', avatar: d?.avatar || null, md: String(d?.md || '') };
  } catch {
    return null;
  }
};

// ── Wishes ──
export interface ChatAuthorLite {
  uid: string;
  name?: string | null;
  avatar?: string | null;
}

export interface Wish {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  text: string;
  day: string;
  replyToUid: string | null;
  replyToName: string | null;
  createdAt: Date | null;
}

const toWish = (id: string, d: any): Wish => ({
  id,
  userId: String(d?.userId || ''),
  userName: d?.userName || 'Outfit user',
  userAvatar: d?.userAvatar || null,
  text: d?.text || '',
  day: d?.day || '',
  replyToUid: d?.replyToUid || null,
  replyToName: d?.replyToName || null,
  createdAt: toDate(d?.createdAt),
});

// Wishes for one birthday, oldest first (single-field equality query: no composite index)
export const subscribeWishes = (
  birthdayUid: string,
  day: string,
  onData: (list: Wish[]) => void,
  onError: (msg: string) => void,
): (() => void) =>
  onSnapshot(
    query(collection(db, BIRTHDAYS, birthdayUid, 'wishes'), where('day', '==', day), limit(200)),
    snap => {
      const list = snap.docs.map(s => toWish(s.id, s.data({ serverTimestamps: 'estimate' })));
      list.sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
      onData(list);
    },
    e => onError(firestoreErrorMessage(e, 'Loading wishes')),
  );

// "@Name " at the start of a reply
export const mentionPrefix = (name: string) => `@${(name || '').trim().split(/\s+/)[0] || 'friend'} `;

// Splits text into plain / @mention parts for bold rendering
export const mentionParts = (text: string): { text: string; mention: boolean }[] => {
  const out: { text: string; mention: boolean }[] = [];
  const re = /@[^\s@.,!?]+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), mention: false });
    out.push({ text: m[0], mention: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), mention: false });
  return out;
};

export const sendWish = async (
  birthdayUid: string,
  day: string,
  me: ChatAuthorLite,
  text: string,
  replyTo?: { uid: string; name: string } | null,
): Promise<void> => {
  const t = (text || '').trim();
  if (!t || !me.uid) return;
  assertClean(t, 'Please keep wishes respectful 🙏');
  const data: any = {
    userId: me.uid,
    userName: ((me.name || '').trim() || 'Outfit user').slice(0, 60),
    userAvatar: inlineAvatar(me.avatar),
    text: t.slice(0, WISH_MAX),
    day,
    replyToUid: replyTo?.uid || null,
    replyToName: replyTo ? (replyTo.name || '').slice(0, 60) : null,
    createdAt: serverTimestamp(),
  };
  try {
    await addDoc(collection(db, BIRTHDAYS, birthdayUid, 'wishes'), data);
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Sending wish'));
  }
  const actor = { uid: me.uid, name: me.name, avatar: me.avatar };
  // The birthday person hears about every wish; a tagged person hears about the reply
  // (activity target = whose birthday page to open)
  const target = { kind: 'birthday' as const, id: birthdayUid };
  if (birthdayUid !== me.uid) logActivity(birthdayUid, actor, 'wish', target, t);
  if (replyTo?.uid && replyTo.uid !== me.uid && replyTo.uid !== birthdayUid) {
    logActivity(replyTo.uid, actor, 'mention', target, t);
  }
};

export const deleteWish = async (birthdayUid: string, id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, BIRTHDAYS, birthdayUid, 'wishes', id));
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Deleting'));
  }
};

// ── "Happy birthday to all" circle (same-day birthdays only) ──
export interface BdayMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  type: 'text' | 'image';
  text: string;
  imageData: string | null;
  createdAt: Date | null;
}

const toBdayMsg = (id: string, d: any): BdayMessage => ({
  id,
  userId: String(d?.userId || ''),
  userName: d?.userName || 'Outfit user',
  userAvatar: d?.userAvatar || null,
  type: d?.type === 'image' ? 'image' : 'text',
  text: d?.text || '',
  imageData: typeof d?.imageData === 'string' ? d.imageData : null,
  createdAt: toDate(d?.createdAt),
});

// Is today my (opted-in) birthday? Then today's circle is mine to see.
export const isMyBirthdayToday = (my: MyBirthday, today: Date = new Date()): boolean =>
  !!my.on && !!my.md && mdKeysOn(today).includes(my.md);

// Newest first (for an inverted list); 100 at most to keep reads low
export const subscribeBdayCircle = (
  day: string,
  onData: (list: BdayMessage[]) => void,
  onError: (msg: string) => void,
): (() => void) =>
  onSnapshot(
    query(collection(db, BDAY_CIRCLES, day, 'messages'), orderBy('createdAt', 'desc'), limit(100)),
    snap => onData(snap.docs.map(s => toBdayMsg(s.id, s.data({ serverTimestamps: 'estimate' })))),
    e => onError(firestoreErrorMessage(e, 'Loading the birthday circle')),
  );

const bdayAuthor = (me: ChatAuthorLite) => ({
  userId: me.uid,
  userName: ((me.name || '').trim() || 'Outfit user').slice(0, 60),
  userAvatar: inlineAvatar(me.avatar),
  createdAt: serverTimestamp(),
});

export const sendBdayText = async (day: string, me: ChatAuthorLite, text: string): Promise<void> => {
  const t = (text || '').trim();
  if (!t) return;
  assertClean(t, 'Please keep messages respectful 🙏');
  try {
    await addDoc(collection(db, BDAY_CIRCLES, day, 'messages'), { ...bdayAuthor(me), type: 'text', text: t.slice(0, BDAY_MSG_MAX) });
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Sending message'));
  }
};

export const sendBdayPhoto = async (day: string, me: ChatAuthorLite, imageData: string): Promise<void> => {
  if (!/^data:image\//.test(imageData)) throw new Error('Photo could not be read. Please pick it again.');
  if (imageData.length > BDAY_PHOTO_MAX_CHARS) throw new Error('This photo is too large to send. Please pick a smaller photo.');
  try {
    await addDoc(collection(db, BDAY_CIRCLES, day, 'messages'), { ...bdayAuthor(me), type: 'image', imageData });
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Sending photo'));
  }
};

export const deleteBdayMessage = async (day: string, id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, BDAY_CIRCLES, day, 'messages', id));
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Deleting'));
  }
};
