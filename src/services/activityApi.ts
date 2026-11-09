// "Who liked my photos" (Instagram style activity):
//   users/{ownerUid}/activity/{autoId}
//     {type: 'like' | 'dislike' | 'comment' | 'follow' | 'feedback', actorId, actorName, actorAvatar,
//      targetKind: 'post' | 'wardrobe' | null, targetId, thumbnail, text, createdAt}
// Written by the actor (rules: actorId == me, owner != me). Only the owner reads / deletes.
// Every write is best-effort: it never throws and never blocks the like / comment / follow.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { toDate } from '../utils/date';
import { inlineAvatar } from './userApi';
import { getUserLite } from './userCache';
import type { FeedKind } from './feedApi';

export type ActivityType = 'like' | 'dislike' | 'comment' | 'follow' | 'feedback';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  actorId: string;
  actorName: string;
  actorAvatar: string | null;
  targetKind: FeedKind | null;
  targetId: string | null;
  thumbnail: string | null;
  text: string;
  createdAt: Date | null;
}

export interface Actor {
  uid: string;
  name?: string | null;
  avatar?: string | null;
}

export const ACTIVITY_LIMIT = 50;
const MAX_TEXT = 120;
const MAX_THUMB_URL = 2000;

// Only a real (short) URL goes in the activity doc; base64 photos are loaded by the list instead
export const cheapThumbnail = (img?: string | null): string | null =>
  img && /^https?:\/\//i.test(img) && img.length <= MAX_THUMB_URL ? img : null;

// Owner of a post / wardrobe photo (one read). '' when it can't be read.
const ownerOf = async (kind: FeedKind, id: string): Promise<string> => {
  try {
    const s = await getDoc(doc(db, kind === 'post' ? 'posts' : 'wardrobe', id));
    return s.exists() ? String((s.data() as any)?.userId || '') : '';
  } catch {
    return '';
  }
};

// Best-effort activity write. Skipped when I'm the owner. Never throws.
export const recordActivity = async (
  ownerUid: string | null | undefined,
  actor: Actor,
  type: ActivityType,
  target?: { kind: FeedKind; id: string; thumbnail?: string | null } | null,
  text?: string,
): Promise<void> => {
  try {
    if (!actor?.uid) return;
    let owner = ownerUid || '';
    if (!owner && target) owner = await ownerOf(target.kind, target.id);
    if (!owner || owner === actor.uid) return;
    const data: any = {
      type,
      actorId: actor.uid,
      actorName: ((actor.name || '').trim() || 'Outfit user').slice(0, 60),
      actorAvatar: inlineAvatar(actor.avatar),
      targetKind: target?.kind || null,
      targetId: target?.id || null,
      thumbnail: cheapThumbnail(target?.thumbnail),
      text: (text || '').trim().slice(0, MAX_TEXT),
      createdAt: serverTimestamp(),
    };
    await addDoc(collection(db, 'users', owner, 'activity'), data);
  } catch (e: any) {
    console.warn('activity write failed:', e?.code, e?.message);
  }
};

// Fire and forget (callers never wait on it)
export const logActivity = (...args: Parameters<typeof recordActivity>): void => {
  recordActivity(...args).catch(() => undefined);
};

const toItem = (id: string, d: any): ActivityItem => ({
  id,
  type: ['like', 'dislike', 'comment', 'follow', 'feedback'].includes(d?.type) ? d.type : 'like',
  actorId: String(d?.actorId || ''),
  actorName: d?.actorName || 'Outfit user',
  actorAvatar: d?.actorAvatar || null,
  targetKind: d?.targetKind === 'post' || d?.targetKind === 'wardrobe' ? d.targetKind : null,
  targetId: typeof d?.targetId === 'string' && d.targetId ? d.targetId : null,
  thumbnail: d?.thumbnail || null,
  text: d?.text || '',
  createdAt: toDate(d?.createdAt),
});

// My activity, newest first (~50). Repeats (same person, same action, same photo) show once.
export const getMyActivity = async (uid: string, max = ACTIVITY_LIMIT): Promise<ActivityItem[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'activity'), orderBy('createdAt', 'desc'), limit(max)),
    );
    const seen = new Set<string>();
    const out: ActivityItem[] = [];
    snap.docs.forEach(d => {
      const a = toItem(d.id, d.data({ serverTimestamps: 'estimate' }));
      // Comments are all different; likes / follows only count once
      const key = a.type === 'comment' || a.type === 'feedback' ? a.id : `${a.type}:${a.actorId}:${a.targetKind}:${a.targetId}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(a);
    });
    return out;
  } catch (e: any) {
    console.warn('getMyActivity failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Loading activity'));
  }
};

export const deleteActivity = async (uid: string, id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'users', uid, 'activity', id));
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Deleting'));
  }
};

export const activityLine = (a: ActivityItem): string => {
  const what = a.targetKind === 'wardrobe' ? 'wardrobe photo' : 'photo';
  switch (a.type) {
    case 'dislike':
      return `${a.actorName} disliked your ${what}`;
    case 'comment':
      return `${a.actorName} commented on your ${what}${a.text ? `: "${a.text}"` : ''}`;
    case 'follow':
      return `${a.actorName} started following you`;
    case 'feedback':
      return `${a.actorName} sent feedback${a.text ? `: "${a.text}"` : ''}`;
    default:
      return `${a.actorName} liked your ${what}`;
  }
};

// Thumbnail for a row without one in the doc: the photo itself, one read per photo per session
const thumbCache = new Map<string, Promise<string | null>>();
export const getTargetThumbnail = (kind: FeedKind, id: string): Promise<string | null> => {
  const key = `${kind}:${id}`;
  let p = thumbCache.get(key);
  if (!p) {
    p = getDoc(doc(db, kind === 'post' ? 'posts' : 'wardrobe', id))
      .then(s => {
        if (!s.exists()) return null;
        const d: any = s.data();
        return (d?.imageData || d?.imageUrl || null) as string | null;
      })
      .catch(() => null);
    thumbCache.set(key, p);
  }
  return p;
};

// ── "Liked by" list: {posts|wardrobe}/{id}/likes/{uid} ──
export interface Liker {
  uid: string;
  name: string;
  avatar: string | null;
  createdAt: Date | null;
}

// Name / avatar from the like doc (new likes), else the user's profile, else my activity docs
// (private profiles can't be read). Never throws for a single person.
export const getLikers = async (kind: FeedKind, id: string, myUid?: string, max = 200): Promise<Liker[]> => {
  let docs: { uid: string; d: any }[] = [];
  try {
    const snap = await getDocs(query(collection(db, kind === 'post' ? 'posts' : 'wardrobe', id, 'likes'), limit(max)));
    docs = snap.docs.map(s => ({ uid: s.id, d: s.data({ serverTimestamps: 'estimate' }) }));
  } catch (e: any) {
    console.warn('getLikers failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Loading likes'));
  }
  // Names I already got through activity (covers private profiles)
  const fromActivity = new Map<string, { name: string; avatar: string | null }>();
  if (myUid) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'users', myUid, 'activity'),
          where('targetId', '==', id),
          where('type', '==', 'like'),
          limit(max),
        ),
      );
      snap.docs.forEach(s => {
        const x: any = s.data();
        if (x?.actorId) fromActivity.set(String(x.actorId), { name: x.actorName || '', avatar: x.actorAvatar || null });
      });
    } catch {
      // optional
    }
  }
  const out = await Promise.all(
    docs.map(async ({ uid, d }): Promise<Liker> => {
      let name: string = (d?.name || '').trim();
      let avatar: string | null = d?.avatar || null;
      if (!name) {
        const u = await getUserLite(uid);
        const a = fromActivity.get(uid);
        name = u?.name || a?.name || 'Outfit user';
        avatar = avatar || u?.avatarUrl || a?.avatar || null;
      }
      return { uid, name, avatar, createdAt: toDate(d?.createdAt) };
    }),
  );
  return out.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
};
