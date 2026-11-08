// Small in-memory cache of other users' public info (name, avatar, isPublic) for feeds.
// A private profile can't be read (rules), so it comes back as null.
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

export interface UserLite {
  id: string;
  name: string;
  avatarUrl: string | null;
  isPublic: boolean;
}

const cache = new Map<string, { at: number; v: UserLite | null }>();
const inflight = new Map<string, Promise<UserLite | null>>();
const TTL = 10 * 60 * 1000;

export const getUserLite = async (uid: string): Promise<UserLite | null> => {
  if (!uid) return null;
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const running = inflight.get(uid);
  if (running) return running;
  const p = (async () => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      const d: any = snap.exists() ? snap.data() : null;
      const v: UserLite | null = d
        ? {
            id: uid,
            name: (d?.name || '').trim() || 'Outfit user',
            avatarUrl: d?.avatarUrl || null,
            isPublic: d?.isPublic !== false,
          }
        : null;
      cache.set(uid, { at: Date.now(), v });
      return v;
    } catch {
      // permission-denied = private profile
      cache.set(uid, { at: Date.now(), v: null });
      return null;
    } finally {
      inflight.delete(uid);
    }
  })();
  inflight.set(uid, p);
  return p;
};

export const getUsersLite = async (uids: string[]): Promise<Map<string, UserLite | null>> => {
  const out = new Map<string, UserLite | null>();
  await Promise.all(Array.from(new Set(uids)).map(async u => out.set(u, await getUserLite(u))));
  return out;
};

export const forgetUserLite = (uid: string) => cache.delete(uid);
