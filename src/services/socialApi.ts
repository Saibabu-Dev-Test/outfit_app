// Follow / unfollow and counts.
//   users/{uid}/followers/{followerUid}  {name, avatar, createdAt}  (the follower's info)
//   users/{uid}/following/{targetUid}    {name, avatar, createdAt}  (the target's info)
// Both docs are written (or deleted) together by the follower; rules check the pair.
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { inlineAvatar } from './userApi';
import { toDate } from '../utils/date';

export interface PersonLite {
  uid: string;
  name?: string | null;
  avatar?: string | null;
}

export interface FollowEntry {
  uid: string;
  name: string;
  avatar: string | null;
  createdAt: Date | null;
}

const entry = (p: PersonLite) => ({
  name: ((p.name || '').trim() || 'Outfit user').slice(0, 60),
  avatar: inlineAvatar(p.avatar),
  createdAt: serverTimestamp(),
});

// Follow state shared by every PostCard / profile on screen: one read per author per session,
// and a follow on one card updates the others.
type FollowListener = (meUid: string, targetUid: string, following: boolean) => void;
const followListeners = new Set<FollowListener>();
const followCache = new Map<string, Promise<boolean>>();
const followKey = (meUid: string, targetUid: string) => `${meUid}:${targetUid}`;
export const onFollowChange = (fn: FollowListener): (() => void) => {
  followListeners.add(fn);
  return () => {
    followListeners.delete(fn);
  };
};
const setFollowState = (meUid: string, targetUid: string, following: boolean) => {
  followCache.set(followKey(meUid, targetUid), Promise.resolve(following));
  followListeners.forEach(fn => fn(meUid, targetUid, following));
};

export const follow = async (me: PersonLite, target: PersonLite): Promise<void> => {
  if (!me.uid || !target.uid || me.uid === target.uid) return;
  const b = writeBatch(db);
  b.set(doc(db, 'users', me.uid, 'following', target.uid), entry(target));
  b.set(doc(db, 'users', target.uid, 'followers', me.uid), entry(me));
  try {
    await b.commit();
    setFollowState(me.uid, target.uid, true);
  } catch (e: any) {
    console.warn('follow failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Following'));
  }
};

export const unfollow = async (meUid: string, targetUid: string): Promise<void> => {
  const b = writeBatch(db);
  b.delete(doc(db, 'users', meUid, 'following', targetUid));
  b.delete(doc(db, 'users', targetUid, 'followers', meUid));
  try {
    await b.commit();
    setFollowState(meUid, targetUid, false);
  } catch (e: any) {
    console.warn('unfollow failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Unfollowing'));
  }
};

// Never throws. Always reads fresh (and refreshes the shared cache).
export const isFollowing = async (meUid: string, targetUid: string): Promise<boolean> => {
  try {
    const f = (await getDoc(doc(db, 'users', meUid, 'following', targetUid))).exists();
    followCache.set(followKey(meUid, targetUid), Promise.resolve(f));
    return f;
  } catch {
    return false;
  }
};

// Cached version for feed cards (many cards, same author). Never throws.
export const isFollowingCached = (meUid: string, targetUid: string): Promise<boolean> => {
  const key = followKey(meUid, targetUid);
  let p = followCache.get(key);
  if (!p) {
    p = isFollowing(meUid, targetUid);
    followCache.set(key, p);
  }
  return p;
};

const count = async (q: any): Promise<number> => {
  try {
    return (await getCountFromServer(q)).data().count;
  } catch (e: any) {
    console.warn('count failed:', e?.code, e?.message);
    return 0;
  }
};

export interface ProfileCounts {
  posts: number;
  wardrobe: number;
  followers: number;
  following: number;
}

// Counts for a profile header. Other users: public wardrobe items only. Never throws.
export const getProfileCounts = async (uid: string, isMe: boolean): Promise<ProfileCounts> => {
  const wardrobeQ = isMe
    ? query(collection(db, 'wardrobe'), where('userId', '==', uid))
    : query(collection(db, 'wardrobe'), where('userId', '==', uid), where('isPublic', '==', true));
  const [posts, wardrobe, followers, following] = await Promise.all([
    count(query(collection(db, 'posts'), where('userId', '==', uid))),
    count(wardrobeQ),
    count(collection(db, 'users', uid, 'followers')),
    count(collection(db, 'users', uid, 'following')),
  ]);
  return { posts, wardrobe, followers, following };
};

export const getFollowList = async (uid: string, mode: 'followers' | 'following'): Promise<FollowEntry[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, mode), orderBy('createdAt', 'desc'), limit(300)),
    );
    return snap.docs.map(d => {
      const x: any = d.data();
      return { uid: d.id, name: x?.name || 'Outfit user', avatar: x?.avatar || null, createdAt: toDate(x?.createdAt) };
    });
  } catch (e: any) {
    console.warn('getFollowList failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, mode === 'followers' ? 'Loading followers' : 'Loading following'));
  }
};
