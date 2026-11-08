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

export const follow = async (me: PersonLite, target: PersonLite): Promise<void> => {
  if (!me.uid || !target.uid || me.uid === target.uid) return;
  const b = writeBatch(db);
  b.set(doc(db, 'users', me.uid, 'following', target.uid), entry(target));
  b.set(doc(db, 'users', target.uid, 'followers', me.uid), entry(me));
  try {
    await b.commit();
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
  } catch (e: any) {
    console.warn('unfollow failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Unfollowing'));
  }
};

// Never throws
export const isFollowing = async (meUid: string, targetUid: string): Promise<boolean> => {
  try {
    return (await getDoc(doc(db, 'users', meUid, 'following', targetUid))).exists();
  } catch {
    return false;
  }
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
