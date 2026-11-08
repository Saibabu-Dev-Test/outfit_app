// Public feed: posts/{id} with likes at posts/{id}/likes/{uid}, dislikes at posts/{id}/dislikes/{uid}
// and comments at posts/{id}/comments/{cid}. Photo is a base64 data URI (no Storage).
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  onSnapshot,
  setDoc,
  getCountFromServer,
  writeBatch,
  increment,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { recordTask } from './rewardsApi';
import { MAX_BASE64_CHARS } from '../utils/imagePicker';
import { toDate } from '../utils/date';
import { inlineAvatar } from './userApi';
import { assertClean } from '../utils/profanity';
import { getUserLite, getUsersLite } from './userCache';

export type FeedKind = 'post' | 'wardrobe';

export interface Post {
  id: string;
  kind: FeedKind; // 'wardrobe' = a public wardrobe photo shown in the feed
  userId: string;
  userName: string;
  userAvatar: string | null;
  imageData: string; // first photo (A)
  photos: string[]; // all photos A..F (1 for a normal post)
  caption: string;
  likeCount: number;
  commentCount: number;
  createdAt: Date | null;
}

// Multi-photo posts: up to 6 photos labelled A-F, one vote per user
export const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
export const MAX_POST_PHOTOS = 6;
// Whole post doc must stay under Firestore's 1 MiB
export const MAX_POST_TOTAL_CHARS = 900000;

export type FeedCursor = QueryDocumentSnapshot<DocumentData> | null;

export const FEED_PAGE_SIZE = 10;
const POSTS = 'posts';

const toPost = (id: string, d: any): Post => ({
  id,
  kind: 'post',
  userId: String(d?.userId || ''),
  userName: d?.userName || 'Outfit user',
  userAvatar: d?.userAvatar || null,
  imageData: d?.imageData || '',
  photos: [d?.imageData || '', ...(Array.isArray(d?.morePhotos) ? d.morePhotos : [])]
    .filter((x: any) => typeof x === 'string' && x)
    .slice(0, MAX_POST_PHOTOS),
  caption: d?.caption || '',
  likeCount: typeof d?.likeCount === 'number' ? Math.max(0, d.likeCount) : 0,
  // Older posts have no commentCount: treat as 0
  commentCount: typeof d?.commentCount === 'number' ? Math.max(0, d.commentCount) : 0,
  createdAt: toDate(d?.createdAt),
});

const fail = (e: any, action: string): never => {
  console.warn(`${action} failed:`, e?.code, e?.message);
  throw new Error(firestoreErrorMessage(e, action));
};

// Newest first, 10 per page; pass the last cursor to get the next page
export const getFeedPage = async (
  cursor: FeedCursor = null,
): Promise<{ posts: Post[]; cursor: FeedCursor; hasMore: boolean }> => {
  try {
    const base = collection(db, POSTS);
    const q = cursor
      ? query(base, orderBy('createdAt', 'desc'), startAfter(cursor), limit(FEED_PAGE_SIZE))
      : query(base, orderBy('createdAt', 'desc'), limit(FEED_PAGE_SIZE));
    const snap = await getDocs(q);
    const docs = snap.docs;
    return {
      posts: docs.map(d => toPost(d.id, d.data({ serverTimestamps: 'estimate' }))),
      cursor: docs.length ? docs[docs.length - 1] : cursor,
      hasMore: docs.length === FEED_PAGE_SIZE,
    };
  } catch (e: any) {
    return fail(e, 'Loading feed');
  }
};

// Posts by one user (equality only, sorted here: no composite index)
export const getUserPosts = async (userId: string): Promise<Post[]> => {
  try {
    const snap = await getDocs(query(collection(db, POSTS), where('userId', '==', userId), limit(120)));
    return snap.docs
      .map(d => toPost(d.id, d.data()))
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  } catch (e: any) {
    return fail(e, 'Loading posts');
  }
};

// One photo = normal post. 2-6 photos = A/B/C... vote post (photos B.. go in morePhotos).
export const createPost = async (
  me: { uid: string; name?: string | null; avatar?: string | null },
  images: string | string[],
  caption: string,
): Promise<void> => {
  const list = (Array.isArray(images) ? images : [images]).filter(Boolean);
  if (!list.length) throw new Error('Pick a photo first.');
  if (list.length > MAX_POST_PHOTOS) throw new Error(`Up to ${MAX_POST_PHOTOS} photos per post.`);
  list.forEach(img => {
    if (!/^data:image\//.test(img)) throw new Error('Photo could not be read. Please pick it again.');
    if (img.length > MAX_BASE64_CHARS + 100) {
      throw new Error('This photo is too large to post. Please pick a smaller photo.');
    }
  });
  const total = list.reduce((n, x) => n + x.length, 0);
  if (total > MAX_POST_TOTAL_CHARS) {
    throw new Error('These photos are too large together. Remove one or pick smaller photos.');
  }
  assertClean(caption, 'Please keep captions respectful 🙏');
  try {
    const data: any = {
      userId: me.uid,
      userName: (me.name || '').trim() || 'Outfit user',
      userAvatar: inlineAvatar(me.avatar),
      imageData: list[0],
      caption: caption.trim().slice(0, 500),
      likeCount: 0,
      commentCount: 0,
      isPublic: true,
      createdAt: serverTimestamp(),
    };
    if (list.length > 1) data.morePhotos = list.slice(1);
    await addDoc(collection(db, POSTS), data);
    recordTask(me.uid, 'uploaded'); // daily task (never throws)
  } catch (e: any) {
    fail(e, 'Posting');
  }
};

// Author or admin. Like docs under it are left behind (harmless; no Cloud Functions on Spark).
export const deletePost = async (postId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, POSTS, postId));
  } catch (e: any) {
    fail(e, 'Deleting post');
  }
};

// ── "Likes" list: users/{uid}/liked/{p_|w_}{id} {kind, refId, createdAt} ──
export const likedKey = (kind: FeedKind, id: string) => `${kind === 'post' ? 'p' : 'w'}_${id}`;

// Likes from before the Likes list existed: add them once per session. Never throws.
const backfilled = new Set<string>();
const backfillLiked = (uid: string, kind: FeedKind, id: string) => {
  const key = likedKey(kind, id);
  if (backfilled.has(key)) return;
  backfilled.add(key);
  const ref = doc(db, 'users', uid, 'liked', key);
  getDoc(ref)
    .then(s => (s.exists() ? undefined : setDoc(ref, { kind, refId: id, createdAt: serverTimestamp() })))
    .catch(e => console.warn('liked backfill failed:', e?.code, e?.message));
};

// Which of these posts the user has liked. Never throws.
export const getLikedPostIds = async (postIds: string[], uid: string): Promise<Set<string>> => {
  const liked = new Set<string>();
  await Promise.all(
    postIds.map(async id => {
      try {
        const s = await getDoc(doc(db, POSTS, id, 'likes', uid));
        if (s.exists()) {
          liked.add(id);
          backfillLiked(uid, 'post', id);
        }
      } catch (e: any) {
        console.warn('like check failed:', e?.code, e?.message);
      }
    }),
  );
  return liked;
};

// Like / unlike in one transaction: like doc + likeCount stay in step.
// clearDislike: the user has disliked this post, so liking also removes the dislike (like XOR dislike).
export const toggleLike = async (
  postId: string,
  uid: string,
  clearDislike = false,
): Promise<{ liked: boolean; likeCount: number }> => {
  const postRef = doc(db, POSTS, postId);
  const likeRef = doc(db, POSTS, postId, 'likes', uid);
  const dislikeRef = doc(db, POSTS, postId, 'dislikes', uid);
  try {
    return await runTransaction(db, async tx => {
      const post = await tx.get(postRef);
      if (!post.exists()) throw new Error('This post was deleted.');
      const like = await tx.get(likeRef);
      const current = Math.max(0, Number((post.data() as any)?.likeCount) || 0);
      // users/{uid}/liked/p_{postId} keeps the "Likes" list
      const mineRef = doc(db, 'users', uid, 'liked', likedKey('post', postId));
      if (like.exists()) {
        tx.delete(likeRef);
        tx.update(postRef, { likeCount: increment(-1) });
        tx.delete(mineRef);
        return { liked: false, likeCount: Math.max(0, current - 1) };
      }
      tx.set(likeRef, { createdAt: serverTimestamp() });
      tx.update(postRef, { likeCount: increment(1) });
      tx.set(mineRef, { kind: 'post', refId: postId, createdAt: serverTimestamp() });
      if (clearDislike) tx.delete(dislikeRef);
      return { liked: true, likeCount: current + 1 };
    });
  } catch (e: any) {
    if (!e?.code && e instanceof Error) throw e;
    return fail(e, 'Liking');
  }
};

// ── Comments ──────────────────────────────────────────────────────────
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  text: string;
  createdAt: Date | null;
}

export const MAX_COMMENT_CHARS = 300;
export const COMMENTS_LIMIT = 100;

// Tiny listener so the feed can update its 💬 count after a comment is added or deleted
type CountListener = (postId: string, delta: number) => void;
const countListeners = new Set<CountListener>();
export const onCommentCountChange = (fn: CountListener): (() => void) => {
  countListeners.add(fn);
  return () => {
    countListeners.delete(fn);
  };
};
const emitCount = (postId: string, delta: number) => countListeners.forEach(fn => fn(postId, delta));

const toComment = (id: string, d: any): Comment => ({
  id,
  userId: String(d?.userId || ''),
  userName: d?.userName || 'Outfit user',
  userAvatar: d?.userAvatar || null,
  text: d?.text || '',
  createdAt: toDate(d?.createdAt),
});

export const getPost = async (postId: string): Promise<Post | null> => {
  try {
    const s = await getDoc(doc(db, POSTS, postId));
    return s.exists() ? toPost(s.id, s.data()) : null;
  } catch (e: any) {
    return fail(e, 'Loading post');
  }
};

// Live list, oldest first (max 100). Returns unsubscribe.
export const subscribeComments = (
  postId: string,
  onData: (list: Comment[]) => void,
  onError: (msg: string) => void,
): (() => void) =>
  onSnapshot(
    query(collection(db, POSTS, postId, 'comments'), orderBy('createdAt', 'asc'), limit(COMMENTS_LIMIT)),
    snap => onData(snap.docs.map(d => toComment(d.id, d.data({ serverTimestamps: 'estimate' })))),
    e => {
      console.warn('comments listener failed:', (e as any)?.code, e?.message);
      onError(firestoreErrorMessage(e, 'Loading comments'));
    },
  );

// Comment + commentCount (+1) in one transaction. lastCommentId lets the rules check the new comment.
export const addComment = async (
  postId: string,
  me: { uid: string; name?: string | null; avatar?: string | null },
  text: string,
): Promise<void> => {
  const t = text.trim();
  if (!t) return;
  if (t.length > MAX_COMMENT_CHARS) throw new Error(`Comments can be up to ${MAX_COMMENT_CHARS} characters.`);
  assertClean(t);
  const postRef = doc(db, POSTS, postId);
  const commentRef = doc(collection(db, POSTS, postId, 'comments'));
  try {
    await runTransaction(db, async tx => {
      const post = await tx.get(postRef);
      if (!post.exists()) throw new Error('This post was deleted.');
      const current = Math.max(0, Number((post.data() as any)?.commentCount) || 0);
      tx.set(commentRef, {
        userId: me.uid,
        userName: (me.name || '').trim() || 'Outfit user',
        userAvatar: inlineAvatar(me.avatar),
        text: t,
        createdAt: serverTimestamp(),
      });
      tx.update(postRef, { commentCount: current + 1, lastCommentId: commentRef.id });
    });
    emitCount(postId, 1);
  } catch (e: any) {
    if (!e?.code && e instanceof Error) throw e;
    fail(e, 'Commenting');
  }
};

// Comment author, post owner or admin. Count goes down by 1 in the same transaction.
export const deleteComment = async (postId: string, commentId: string): Promise<void> => {
  const postRef = doc(db, POSTS, postId);
  const commentRef = doc(db, POSTS, postId, 'comments', commentId);
  try {
    let counted = false;
    await runTransaction(db, async tx => {
      const post = await tx.get(postRef);
      const comment = await tx.get(commentRef);
      if (!comment.exists()) return;
      tx.delete(commentRef);
      const current = post.exists() ? Math.max(0, Number((post.data() as any)?.commentCount) || 0) : 0;
      // Skip the count if the post is gone or the count is already 0
      if (current > 0) {
        tx.update(postRef, { commentCount: current - 1, lastCommentId: commentId });
        counted = true;
      }
    });
    if (counted) emitCount(postId, -1);
  } catch (e: any) {
    if (!e?.code && e instanceof Error) throw e;
    fail(e, 'Deleting comment');
  }
};

// ── A/B/C votes on multi-photo posts: posts/{id}/votes/{uid} {option, updatedAt} ──
export interface VoteTally {
  counts: number[];
  total: number;
  myVote: number | null;
}

// Count per option + my vote. Never throws.
export const getPostVotes = async (postId: string, optionCount: number, uid?: string): Promise<VoteTally> => {
  const labels = OPTION_LABELS.slice(0, optionCount);
  const votesCol = collection(db, POSTS, postId, 'votes');
  try {
    const [counts, mine] = await Promise.all([
      Promise.all(
        labels.map(l =>
          getCountFromServer(query(votesCol, where('option', '==', l)))
            .then(r => r.data().count)
            .catch(() => 0),
        ),
      ),
      uid ? getDoc(doc(votesCol, uid)).catch(() => null) : Promise.resolve(null),
    ]);
    const opt = mine && mine.exists() ? (mine.data() as any)?.option : null;
    const idx = typeof opt === 'string' ? labels.indexOf(opt) : -1;
    return { counts, total: counts.reduce((a, b) => a + b, 0), myVote: idx >= 0 ? idx : null };
  } catch (e: any) {
    console.warn('getPostVotes failed:', e?.code, e?.message);
    return { counts: labels.map(() => 0), total: 0, myVote: null };
  }
};

// One doc per user: voting again replaces the old choice
export const castPostVote = async (postId: string, uid: string, optionIndex: number): Promise<void> => {
  const option = OPTION_LABELS[optionIndex];
  if (!option) throw new Error('Pick a photo to vote.');
  try {
    await setDoc(doc(db, POSTS, postId, 'votes', uid), { option, updatedAt: serverTimestamp() });
  } catch (e: any) {
    fail(e, 'Voting');
  }
};

// ── Public wardrobe photos in the feed ──────────────────────────────────
// wardrobe/{id}/likes/{uid} + users/{uid}/liked/w_{id}; counts come from count queries.
export const wardrobeToPost = (id: string, d: any, owner?: { name?: string; avatarUrl?: string | null } | null): Post => {
  const img = d?.imageData || d?.imageUrl || '';
  const label = [d?.color && !String(d.color).startsWith('#') ? d.color : '', d?.name || d?.category || '']
    .filter(Boolean)
    .join(' ');
  return {
    id,
    kind: 'wardrobe',
    userId: String(d?.userId || ''),
    userName: owner?.name || 'Outfit user',
    userAvatar: owner?.avatarUrl || null,
    imageData: img,
    photos: img ? [img] : [],
    caption: label ? `👗 ${label}${d?.category && d?.name !== d?.category ? ` · ${d.category}` : ''}` : '',
    likeCount: 0,
    commentCount: 0,
    createdAt: toDate(d?.createdAt),
  };
};

const countOf = async (q: any): Promise<number> => {
  try {
    return (await getCountFromServer(q)).data().count;
  } catch {
    return 0;
  }
};

// Likes/comments counts + my like for wardrobe photos. Never throws.
export const getWardrobeStats = async (
  itemId: string,
  uid?: string,
): Promise<{ likeCount: number; commentCount: number; liked: boolean }> => {
  const [likeCount, commentCount, liked] = await Promise.all([
    countOf(collection(db, 'wardrobe', itemId, 'likes')),
    countOf(collection(db, 'wardrobe', itemId, 'comments')),
    uid
      ? getDoc(doc(db, 'wardrobe', itemId, 'likes', uid))
          .then(s => s.exists())
          .catch(() => false)
      : Promise.resolve(false),
  ]);
  if (liked && uid) backfillLiked(uid, 'wardrobe', itemId);
  return { likeCount, commentCount, liked };
};

export const toggleWardrobeLike = async (
  itemId: string,
  uid: string,
  likedNow: boolean,
  clearDislike = false,
): Promise<boolean> => {
  const b = writeBatch(db);
  const likeRef = doc(db, 'wardrobe', itemId, 'likes', uid);
  const mineRef = doc(db, 'users', uid, 'liked', likedKey('wardrobe', itemId));
  if (likedNow) {
    b.delete(likeRef);
    b.delete(mineRef);
  } else {
    b.set(likeRef, { createdAt: serverTimestamp() });
    b.set(mineRef, { kind: 'wardrobe', refId: itemId, createdAt: serverTimestamp() });
    if (clearDislike) b.delete(doc(db, 'wardrobe', itemId, 'dislikes', uid));
  }
  try {
    await b.commit();
    return !likedNow;
  } catch (e: any) {
    return fail(e, 'Liking');
  }
};

// ── Dislikes (posts and wardrobe photos): {posts|wardrobe}/{id}/dislikes/{uid} {createdAt} ──
// One doc per user. Like XOR dislike: disliking removes the user's like in the same write,
// liking removes the dislike (toggleLike / toggleWardrobeLike with clearDislike).
const dislikeRef = (kind: FeedKind, id: string, uid: string) =>
  doc(db, kind === 'post' ? POSTS : 'wardrobe', id, 'dislikes', uid);

// Dislike count + my dislike. Never throws.
export const getDislikeState = async (
  kind: FeedKind,
  id: string,
  uid?: string,
): Promise<{ dislikeCount: number; disliked: boolean }> => {
  const [dislikeCount, disliked] = await Promise.all([
    countOf(collection(db, kind === 'post' ? POSTS : 'wardrobe', id, 'dislikes')),
    uid
      ? getDoc(dislikeRef(kind, id, uid))
          .then(s => s.exists())
          .catch(() => false)
      : Promise.resolve(false),
  ]);
  return { dislikeCount, disliked };
};

// Dislike / un-dislike. Returns the new state; likeCount only for posts (wardrobe counts are queries).
export const toggleDislike = async (
  kind: FeedKind,
  id: string,
  uid: string,
  dislikedNow: boolean,
  likedNow: boolean,
): Promise<{ disliked: boolean; liked: boolean; likeCount?: number }> => {
  const ref = dislikeRef(kind, id, uid);
  try {
    if (kind === 'post') {
      const postRef = doc(db, POSTS, id);
      const likeRef = doc(db, POSTS, id, 'likes', uid);
      return await runTransaction(db, async tx => {
        const post = await tx.get(postRef);
        if (!post.exists()) throw new Error('This post was deleted.');
        const like = await tx.get(likeRef);
        const current = Math.max(0, Number((post.data() as any)?.likeCount) || 0);
        if (dislikedNow) {
          tx.delete(ref);
          return { disliked: false, liked: like.exists(), likeCount: current };
        }
        tx.set(ref, { createdAt: serverTimestamp() });
        if (like.exists()) {
          tx.delete(likeRef);
          tx.update(postRef, { likeCount: increment(-1) });
          tx.delete(doc(db, 'users', uid, 'liked', likedKey('post', id)));
          return { disliked: true, liked: false, likeCount: Math.max(0, current - 1) };
        }
        return { disliked: true, liked: false, likeCount: current };
      });
    }
    const b = writeBatch(db);
    if (dislikedNow) {
      b.delete(ref);
    } else {
      b.set(ref, { createdAt: serverTimestamp() });
      if (likedNow) {
        b.delete(doc(db, 'wardrobe', id, 'likes', uid));
        b.delete(doc(db, 'users', uid, 'liked', likedKey('wardrobe', id)));
      }
    }
    await b.commit();
    return { disliked: !dislikedNow, liked: dislikedNow ? likedNow : false };
  } catch (e: any) {
    if (!e?.code && e instanceof Error) throw e;
    return fail(e, 'Disliking');
  }
};

export const getWardrobeAsPost = async (itemId: string): Promise<Post | null> => {
  try {
    const s = await getDoc(doc(db, 'wardrobe', itemId));
    if (!s.exists()) return null;
    const d: any = s.data();
    const owner = await getUserLite(String(d?.userId || ''));
    return wardrobeToPost(s.id, d, owner);
  } catch (e: any) {
    console.warn('getWardrobeAsPost failed:', e?.code, e?.message);
    return null;
  }
};

// ── Liked items list ────────────────────────────────────────────────────
export const getLikedItems = async (uid: string, max = 60): Promise<Post[]> => {
  let refs: { kind: FeedKind; refId: string }[] = [];
  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'liked'), orderBy('createdAt', 'desc'), limit(max)),
    );
    refs = snap.docs
      .map(d => d.data() as any)
      .filter(x => (x?.kind === 'post' || x?.kind === 'wardrobe') && typeof x?.refId === 'string')
      .map(x => ({ kind: x.kind, refId: x.refId }));
  } catch (e: any) {
    return fail(e, 'Loading likes');
  }
  const items = await Promise.all(
    refs.map(r => (r.kind === 'post' ? getPost(r.refId).catch(() => null) : getWardrobeAsPost(r.refId))),
  );
  return items.filter((x): x is Post => !!x && !!x.imageData);
};

// ── Mixed feed: public posts + public wardrobe photos, newest first, only from public profiles ──
type SourceName = 'posts' | 'wardrobe';
interface Source {
  name: SourceName;
  cursor: FeedCursor;
  buffer: { id: string; data: any; at: number }[];
  done: boolean;
  fallback: boolean; // no composite index yet: one bigger unsorted read, sorted here
}

const newSource = (name: SourceName): Source => ({ name, cursor: null, buffer: [], done: false, fallback: false });

const fillSource = async (s: Source): Promise<void> => {
  if (s.done) return;
  const base = collection(db, s.name === 'posts' ? POSTS : 'wardrobe');
  const at = (d: any) => toDate(d?.createdAt)?.getTime() || 0;
  if (s.fallback) return;
  try {
    const filters: any[] = s.name === 'wardrobe' ? [where('isPublic', '==', true)] : [];
    const q = s.cursor
      ? query(base, ...filters, orderBy('createdAt', 'desc'), startAfter(s.cursor), limit(FEED_PAGE_SIZE))
      : query(base, ...filters, orderBy('createdAt', 'desc'), limit(FEED_PAGE_SIZE));
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      const data = d.data({ serverTimestamps: 'estimate' });
      s.buffer.push({ id: d.id, data, at: at(data) });
    });
    if (snap.docs.length) s.cursor = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < FEED_PAGE_SIZE) s.done = true;
  } catch (e: any) {
    if (s.name === 'wardrobe' && e?.code === 'failed-precondition') {
      // Index wardrobe (isPublic ASC, createdAt DESC) not created yet
      console.warn('wardrobe feed index missing, using fallback:', e?.message);
      s.fallback = true;
      s.done = true;
      try {
        const snap = await getDocs(query(base, where('isPublic', '==', true), limit(100)));
        snap.docs.forEach(d => s.buffer.push({ id: d.id, data: d.data(), at: at(d.data()) }));
        s.buffer.sort((a, b) => b.at - a.at);
      } catch (e2: any) {
        console.warn('wardrobe feed fallback failed:', e2?.code, e2?.message);
      }
      return;
    }
    if (s.name === 'wardrobe') {
      console.warn('wardrobe feed failed:', e?.code, e?.message);
      s.done = true;
      return;
    }
    throw e;
  }
};

export class FeedLoader {
  private sources: Source[] = [newSource('posts'), newSource('wardrobe')];
  private meUid?: string;

  constructor(meUid?: string) {
    this.meUid = meUid;
  }

  get hasMore(): boolean {
    return this.sources.some(s => !s.done || s.buffer.length > 0);
  }

  // Next page (newest first across both sources)
  async next(n = FEED_PAGE_SIZE): Promise<Post[]> {
    const picked: { src: SourceName; id: string; data: any; at: number }[] = [];
    try {
      while (picked.length < n) {
        // Every source that might hold a newer item needs a non-empty buffer
        await Promise.all(this.sources.filter(s => !s.buffer.length && !s.done).map(fillSource));
        const live = this.sources.filter(s => s.buffer.length);
        if (!live.length) break;
        live.sort((a, b) => b.buffer[0].at - a.buffer[0].at);
        const s = live[0];
        const top = s.buffer.shift()!;
        picked.push({ src: s.name, ...top });
      }
    } catch (e: any) {
      if (!picked.length) return fail(e, 'Loading feed');
    }
    // Only public profiles (and my own items)
    const owners = await getUsersLite(picked.map(p => String(p.data?.userId || '')));
    const out: Post[] = [];
    picked.forEach(p => {
      const uid = String(p.data?.userId || '');
      const owner = owners.get(uid);
      const mine = !!this.meUid && uid === this.meUid;
      if (!mine && (!owner || !owner.isPublic)) return;
      if (p.src === 'posts') {
        const post = toPost(p.id, p.data);
        if (owner) {
          post.userName = owner.name || post.userName;
          post.userAvatar = owner.avatarUrl || post.userAvatar;
        }
        if (post.imageData) out.push(post);
      } else {
        const w = wardrobeToPost(p.id, p.data, owner);
        if (w.imageData) out.push(w);
      }
    });
    return out;
  }
}

// Public wardrobe items of one user as feed posts (equality filters only)
export const getUserPublicWardrobePosts = async (userId: string): Promise<Post[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'wardrobe'), where('userId', '==', userId), where('isPublic', '==', true)),
    );
    const owner = await getUserLite(userId);
    return snap.docs
      .map(d => wardrobeToPost(d.id, d.data(), owner))
      .filter(p => !!p.imageData)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  } catch (e: any) {
    return fail(e, 'Loading wardrobe');
  }
};
