// Coin rewards (Firestore only, no Cloud Functions):
//   users/{uid}/coinEvents/{type}_{targetId}  {type, points, createdAt}  create-only, once per action+target
//   users/{uid}.coins                           increment(points), in the same batch as the event doc,
//   users/{uid}.coinEvent                       naming that event (firestore.rules coinsOk checks it)
// Likes on posts / wardrobe photos also add 1 to the OWNER's users/{owner}.likesReceived in the same
// batch (users.likeEvent names the liker's new coin event; firestore.rules likesReceivedOk), so a
// like counts once per person per photo. The flip shows the coin of the owner's like level.
// awardCoins is fire-and-forget: it never throws and never blocks the like / upload / share.
import { doc, getDoc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import { COIN_POINTS, CoinAction, tierFor } from '../config/coins';
import { LikeLevel, likeLevelFor, likeLevelLabel } from '../config/likeLevels';
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

export type LikeTargetKind = 'post' | 'wardrobe';

// Owner of a post / wardrobe photo, '' when unknown. Never throws.
const ownerOfTarget = async (kind: LikeTargetKind, id: string): Promise<string> => {
  try {
    const snap = await getDoc(doc(db, kind === 'post' ? 'posts' : 'wardrobe', id));
    return String((snap.data() as any)?.userId || '');
  } catch {
    return '';
  }
};

// Total likes this user has received ("likesReceived"), null when it can't be read
// (private profile). Never throws.
export const loadLikesReceived = async (uid: string): Promise<number | null> => {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return Math.max(0, Number((snap.data() as any)?.likesReceived) || 0);
  } catch {
    return null;
  }
};

// "Gold like" etc. under the flipping coin
export const likeCaption = (level: LikeLevel) => `❤️ ${likeLevelLabel(level)} like`;

interface LikeInfo {
  kind: LikeTargetKind;
  id: string;
  owner?: string | null;
}

interface AwardOpts {
  // Show the flip (with this line under the coin) even when no coins are added
  // (already awarded today / earlier): the Home colour vote flips on every vote.
  flipCaption?: string;
}

const doAward = async (type: CoinAction, targetId: string, like?: LikeInfo, opts?: AwardOpts) => {
  const uid = auth?.currentUser?.uid;
  if (!uid || !targetId) return;
  const eventId = coinEventId(type, targetId);
  const key = `${uid}/${eventId}`;
  // Likes: the owner's level decides the coin face (Bronze when unknown)
  let owner = '';
  if (like) owner = like.owner || (await ownerOfTarget(like.kind, like.id));
  const countForOwner = !!like && !!owner && owner !== uid;
  const likeFlip = async (earned: number, total: number) => {
    const received = countForOwner ? await loadLikesReceived(owner) : null;
    const level = likeLevelFor(received ?? 0);
    showCoinFlip({ earned, total, tier: tierFor(total), face: level, caption: likeCaption(level) });
  };
  const plainFlip = (earned: number, total: number) =>
    showCoinFlip({ earned, total, tier: tierFor(total), caption: opts?.flipCaption });
  if (tried.has(key)) {
    // Already rewarded (this session): a like (or a flipCaption award) still gets its flip, with no new coins
    if (like) await likeFlip(0, (await loadCoinTotal(uid)) ?? 0);
    else if (opts?.flipCaption) plainFlip(0, (await loadCoinTotal(uid)) ?? 0);
    return;
  }
  tried.add(key);
  const points = COIN_POINTS[type];
  const before = (await loadCoinTotal(uid)) ?? 0;
  const commit = async (withOwner: boolean) => {
    const b = writeBatch(db);
    b.set(doc(db, 'users', uid, 'coinEvents', eventId), { type, points, createdAt: serverTimestamp() });
    b.set(doc(db, 'users', uid), { coins: increment(points), coinEvent: eventId }, { merge: true });
    if (withOwner) b.update(doc(db, 'users', owner), { likesReceived: increment(1), likeEvent: eventId });
    await b.commit();
  };
  try {
    try {
      await commit(countForOwner);
    } catch (e: any) {
      // Owner count refused (rules not deployed yet / owner doc missing): still give the coins
      if (!countForOwner || (e?.code !== 'permission-denied' && e?.code !== 'not-found')) throw e;
      await commit(false);
    }
  } catch (e: any) {
    // permission-denied here usually means this event was already awarded (create-only)
    if (e?.code !== 'permission-denied') console.warn('awardCoins failed:', e?.code, e?.message);
    if (like) await likeFlip(0, before);
    else if (opts?.flipCaption) plainFlip(0, before);
    return;
  }
  const total = before + points;
  setKnownCoinTotal(total);
  if (like) await likeFlip(points, total);
  else plainFlip(points, total);
};

// A like on a post / wardrobe photo: +1 coin for me (once per photo), +1 likesReceived for the
// owner, and a coin flip with the owner's like-level coin EVERY time. Fire-and-forget, never throws.
export const awardLikeCoins = (kind: LikeTargetKind, id: string | null | undefined, owner?: string | null): void => {
  try {
    if (!id) return;
    const t = String(id);
    chain = chain.then(() => doAward('like', `${kind}_${t}`, { kind, id: t, owner })).catch(() => undefined);
  } catch {}
};

// Fire-and-forget: call it after the like / upload / share succeeded. Never throws, never awaits.
export const awardCoins = (type: CoinAction, targetId: string | null | undefined): void => {
  try {
    if (!targetId) return;
    const t = String(targetId);
    chain = chain.then(() => doAward(type, t)).catch(() => undefined);
  } catch {}
};

// Home "today's colour" vote: coin flip + sound on EVERY vote; +1 coin only on the first vote of the
// local day (users/{uid}/coinEvents/vote_colour_{YYYY-MM-DD} is create-only, so it is once per day
// even across devices / reinstalls). Later votes that day (changing the colour) flip with no coin.
// Fire-and-forget, never throws.
export const colourVoteCoinTarget = (day: string) => `colour_${day}`;
export const COLOUR_VOTE_CAPTION = "🎨 Today's colour voted";

export const awardColourVoteCoin = (day: string | null | undefined): void => {
  try {
    if (!day) return;
    const t = colourVoteCoinTarget(String(day));
    chain = chain
      .then(() => doAward('vote', t, undefined, { flipCaption: COLOUR_VOTE_CAPTION }))
      .catch(() => undefined);
  } catch {}
};
