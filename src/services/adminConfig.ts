// Public list of admin uids: config/admins {uids: string[], updatedAt}
// Signed-in users can read it (users can't query users by role); only admins write it.
// AdminScreen adds the signed-in admin automatically, so the owner only has to open Admin once.
import { arrayUnion, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

let cache: { at: number; uids: string[] } | null = null;
const TTL = 10 * 60 * 1000;

// Admin uids, [] when the doc is missing or unreadable. Never throws.
export const getAdminUids = async (): Promise<string[]> => {
  if (cache && Date.now() - cache.at < TTL) return cache.uids;
  try {
    const s = await getDoc(doc(db, 'config', 'admins'));
    const raw = s.exists() ? (s.data() as any)?.uids : null;
    const uids = Array.isArray(raw) ? raw.filter((u: any) => typeof u === 'string' && u).slice(0, 20) : [];
    cache = { at: Date.now(), uids };
    return uids;
  } catch (e: any) {
    console.warn('config/admins read failed:', e?.code, e?.message);
    return [];
  }
};

// Adds me to config/admins (rules: admins only). Never throws.
export const registerAdmin = async (uid: string | null | undefined): Promise<void> => {
  if (!uid) return;
  try {
    const current = await getAdminUids();
    if (current.includes(uid)) return;
    await setDoc(doc(db, 'config', 'admins'), { uids: arrayUnion(uid), updatedAt: serverTimestamp() }, { merge: true });
    cache = null;
  } catch (e: any) {
    console.warn('config/admins write failed:', e?.code, e?.message);
  }
};
