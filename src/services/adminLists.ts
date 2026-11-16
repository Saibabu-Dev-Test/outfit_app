// Admin tracking drill-downs (owner only, Admin tracking > tap a number): the real documents behind
// each count on that screen, read page by page from Firestore with the same filters as the counts
// in adminStats.ts (getUserCounts / getAppCounts). Rules: isAdmin() (the owner is an admin) may read
// every user, wardrobe item and circle; posts are readable by any signed-in user. Nothing is written.
import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  QueryDocumentSnapshot,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { localDateKey } from '../utils/date';
import { startOfToday, startOfWeek } from './adminStats';

export type AdminListKind = 'users' | 'usersNewToday' | 'usersNewWeek' | 'usersActiveToday' | 'wardrobe' | 'posts' | 'circles';

export const ADMIN_LIST_TITLE: Record<AdminListKind, string> = {
  users: 'Registered users',
  usersNewToday: 'New today',
  usersNewWeek: 'New this week (since Mon)',
  usersActiveToday: 'Active today',
  wardrobe: 'Wardrobe items',
  posts: 'Posts & polls',
  circles: 'Circles',
};

export interface AdminListRow {
  id: string;
  title: string; // name / caption / circle name
  subtitle: string; // joined + last active / owner + date
  image: string | null; // photo when there is one (avatar, thumbnail)
  emoji?: string; // circles
  at: number; // sort key (ms), 0 when unknown
  // where a tap goes
  open: { screen: 'UserProfile'; params: { userId: string } } | { screen: 'PostDetail'; params: { kind: 'post' | 'wardrobe'; id: string } } | { screen: 'CircleInfo'; params: { circleId: string } };
}

export interface AdminListPage {
  rows: AdminListRow[];
  cursor: QueryDocumentSnapshot | null; // null = no more
}

// Users are few and light: read all of them (pages of 300, same cap as Admin > Stats).
// Wardrobe items and posts carry inline photos, so they come 25 at a time with "Load more".
const USER_PAGE = 300;
const MAX_USERS = 5000;
export const MEDIA_PAGE = 25;

export const toMs = (v: any): number => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
};

export const shortDate = (ms: number): string => {
  if (!ms) return '—';
  const d = new Date(ms);
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return `${d.getDate()} ${m} ${d.getFullYear()}`;
};

// Only real images (data: / http(s):) are shown; anything else = no photo
export const imageOf = (v: any): string | null => (typeof v === 'string' && /^(data:image\/|https?:\/\/)/i.test(v) ? v : null);

export const userRow = (id: string, u: any): AdminListRow => {
  const joined = toMs(u?.createdAt);
  const last = typeof u?.lastActive === 'string' ? u.lastActive : typeof u?.lastLoginDate === 'string' ? u.lastLoginDate : '';
  const name = typeof u?.name === 'string' && u.name.trim() ? u.name.trim() : 'No name';
  return {
    id,
    title: name,
    subtitle: `@${id.slice(0, 6)} · Joined ${shortDate(joined)} · Last active ${last || '—'}`,
    image: imageOf(u?.avatarUrl),
    at: joined,
    open: { screen: 'UserProfile', params: { userId: id } },
  };
};

export const wardrobeRow = (id: string, w: any): AdminListRow => ({
  id,
  title: [w?.name, w?.category].filter((x: any) => typeof x === 'string' && x).join(' · ') || 'Item',
  subtitle: `${w?.isPublic ? 'Public' : 'Private'} · by @${String(w?.userId || '').slice(0, 6)} · ${shortDate(toMs(w?.createdAt))}`,
  image: imageOf(w?.imageData),
  at: toMs(w?.createdAt),
  open: { screen: 'PostDetail', params: { kind: 'wardrobe', id } },
});

export const postRow = (id: string, p: any): AdminListRow => {
  const n = 1 + (Array.isArray(p?.morePhotos) ? p.morePhotos.length : 0);
  return {
    id,
    title: (typeof p?.caption === 'string' && p.caption.trim()) || (n > 1 ? `Poll (${n} photos)` : 'Photo post'),
    subtitle: `${p?.userName || 'Someone'} · ${n > 1 ? `poll A–${String.fromCharCode(64 + n)} · ` : ''}❤ ${Number(p?.likeCount) || 0} · 💬 ${Number(p?.commentCount) || 0} · ${shortDate(toMs(p?.createdAt))}`,
    image: imageOf(p?.imageData),
    at: toMs(p?.createdAt),
    open: { screen: 'PostDetail', params: { kind: 'post', id } },
  };
};

export const circleRow = (id: string, c: any): AdminListRow => ({
  id,
  title: (typeof c?.name === 'string' && c.name) || 'Circle',
  subtitle: `${c?.isPrivate ? '🔒 Private' : 'Public'} · ${Array.isArray(c?.memberIds) ? c.memberIds.length : 0} members · ${shortDate(toMs(c?.createdAt))}`,
  image: null,
  emoji: typeof c?.emoji === 'string' ? c.emoji : '👥',
  at: toMs(c?.lastMessageAt) || toMs(c?.createdAt),
  open: { screen: 'CircleInfo', params: { circleId: id } },
});

const byNewest = (a: AdminListRow, b: AdminListRow) => b.at - a.at;

// Every user matching the card's filter (same filters as getUserCounts), newest first
const loadUsers = async (kind: AdminListKind, now: Date): Promise<AdminListRow[]> => {
  const col = collection(db, 'users');
  if (kind === 'usersNewToday' || kind === 'usersNewWeek') {
    const since = kind === 'usersNewToday' ? startOfToday(now) : startOfWeek(now);
    const snap = await getDocs(query(col, where('createdAt', '>=', Timestamp.fromDate(since)), limit(MAX_USERS)));
    return snap.docs.map((d: any) => userRow(d.id, d.data())).sort(byNewest);
  }
  if (kind === 'usersActiveToday') {
    const snap = await getDocs(query(col, where('lastLoginDate', '==', localDateKey(now)), limit(MAX_USERS)));
    return snap.docs.map((d: any) => userRow(d.id, d.data())).sort(byNewest);
  }
  // All users, including ones without createdAt (paged by id, like Admin > Stats)
  const rows: AdminListRow[] = [];
  let last: QueryDocumentSnapshot | null = null;
  while (rows.length < MAX_USERS) {
    const q: any = last ? query(col, orderBy(documentId()), startAfter(last), limit(USER_PAGE)) : query(col, orderBy(documentId()), limit(USER_PAGE));
    const snap = await getDocs(q);
    snap.docs.forEach((d: any) => rows.push(userRow(d.id, d.data())));
    if (snap.docs.length < USER_PAGE) break;
    last = snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot;
  }
  return rows.sort(byNewest);
};

// One page of the list. Users and circles come whole (cursor null); wardrobe / posts come newest
// first, a page at a time (both always get a server createdAt when they are created).
export const loadAdminList = async (kind: AdminListKind, cursor: QueryDocumentSnapshot | null = null, now: Date = new Date()): Promise<AdminListPage> => {
  try {
    if (kind === 'users' || kind === 'usersNewToday' || kind === 'usersNewWeek' || kind === 'usersActiveToday') {
      return { rows: await loadUsers(kind, now), cursor: null };
    }
    if (kind === 'circles') {
      const snap = await getDocs(query(collection(db, 'circles'), limit(500)));
      return { rows: snap.docs.map((d: any) => circleRow(d.id, d.data())).sort(byNewest), cursor: null };
    }
    const name = kind === 'wardrobe' ? 'wardrobe' : 'posts';
    const col = collection(db, name);
    const q: any = cursor
      ? query(col, orderBy('createdAt', 'desc'), startAfter(cursor), limit(MEDIA_PAGE))
      : query(col, orderBy('createdAt', 'desc'), limit(MEDIA_PAGE));
    const snap = await getDocs(q);
    const rows = snap.docs.map((d: any) => (kind === 'wardrobe' ? wardrobeRow(d.id, d.data()) : postRow(d.id, d.data())));
    return {
      rows,
      cursor: snap.docs.length < MEDIA_PAGE ? null : (snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot),
    };
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, `Loading ${ADMIN_LIST_TITLE[kind].toLowerCase()}`));
  }
};
