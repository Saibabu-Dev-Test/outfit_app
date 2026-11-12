// Coin rewards (Firestore only, no Cloud Functions):
//   users/{uid}/coinEvents/{type}_{targetId}  {type, points, createdAt}  create-only, once per action+target
//   users/{uid}.coins                           increment(points), in the same batch as the event doc,
//   users/{uid}.coinEvent                       naming that event (firestore.rules coinsOk checks it)
// awardCoins is fire-and-forget: it never throws and never blocks the like / upload / share.
import { doc, getDoc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import { COIN_POINTS, CoinAction, tierFor } from '../config/coins';
import { getKnownCoinTotal, setKnownCoinTotal, showCoinFlip } from './coinBus';

const cleanId = (s: string) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 200);

// Same id rules as firestore.rules (type + '_' + target)
export const coinEventId = (type: CoinAction, targetId: string) => `${type}_${cleanId(targetId) || 'x'}`;

// Small stable hash for share targets that are text (e.g. the message shared)
export const hashKey = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const tried = new Set<string>(); // per session: never write the same event twice
let loadedFor: string | null = null;

// Cached total for this user, or null when not loaded yet
export const cachedCoinTotal = (uid?: string | null): number | null => {
  const id = uid || auth?.currentUser?.uid;
  return id && loadedFor === id ? getKnownCoinTotal() : null;
};

// The signed-in user's coin total (cached after the first read). Never throws.
export const loadCoinTotal = async (uid?: string | null): Promise<number | null> => {
  const id = uid || auth?.currentUser?.uid;
  if (!id) return null;
  if (loadedFor === id && getKnownCoinTotal() !== null) return getKnownCoinTotal();
  try {
    const snap = await getDoc(doc(db, 'users', id));
    const n = Number((snap.data() as any)?.coins) || 0;
    loadedFor = id;
    setKnownCoinTotal(Math.max(0, n));
    return Math.max(0, n);
  } catch (e: any) {
    console.warn('loadCoinTotal failed:', e?.code, e?.message);
    return null;
  }
};

// One award at a time so the local total stays in step
let chain: Promise<unknown> = Promise.resolve();

const doAward = async (type: CoinAction, targetId: string) => {
  const uid = auth?.currentUser?.uid;
  if (!uid || !targetId) return;
  const eventId = coinEventId(type, targetId);
  const key = `${uid}/${eventId}`;
  if (tried.has(key)) return;
  tried.add(key);
  const points = COIN_POINTS[type];
  const before = (await loadCoinTotal(uid)) ?? 0;
  try {
    const b = writeBatch(db);
    b.set(doc(db, 'users', uid, 'coinEvents', eventId), { type, points, createdAt: serverTimestamp() });
    b.set(doc(db, 'users', uid), { coins: increment(points), coinEvent: eventId }, { merge: true });
    await b.commit();
  } catch (e: any) {
    // permission-denied here usually means this event was already awarded (create-only)
    if (e?.code !== 'permission-denied') console.warn('awardCoins failed:', e?.code, e?.message);
    return;
  }
  const total = before + points;
  setKnownCoinTotal(total);
  showCoinFlip({ earned: points, total, tier: tierFor(total) });
};

// Fire-and-forget: call it after the like / upload / share succeeded. Never throws, never awaits.
export const awardCoins = (type: CoinAction, targetId: string | null | undefined): void => {
  try {
    if (!targetId) return;
    const t = String(targetId);
    chain = chain.then(() => doAward(type, t)).catch(() => undefined);
  } catch {}
};
