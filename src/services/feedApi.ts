// Public feed: posts/{id} with likes at posts/{id}/likes/{uid} and comments at posts/{id}/comments/{cid}. Photo is a base64 data URI (no Storage).
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
  increment,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { MAX_BASE64_CHARS } from '../utils/imagePicker';
import { toDate } from '../utils/date';
import { inlineAvatar } from './userApi';
import { assertClean } from '../utils/profanity';

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  imageData: string;
  caption: string;
  likeCount: number;
  commentCount: number;
  createdAt: Date | null;
}

export type FeedCursor = QueryDocumentSnapshot<DocumentData> | null;

export const FEED_PAGE_SIZE = 10;
const POSTS = 'posts';

const toPost = (id: string, d: any): Post => ({
  id,
  userId: String(d?.userId || ''),
  userName: d?.userName || 'Outfit user',
  userAvatar: d?.userAvatar || null,
  imageData: d?.imageData || '',
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

export const createPost = async (
  me: { uid: string; name?: string | null; avatar?: string | null },
  imageData: string,
  caption: string,
): Promise<void> => {
  if (!/^data:image\//.test(imageData)) throw new Error('Photo could not be read. Please pick it again.');
  if (imageData.length > MAX_BASE64_CHARS + 100) {
    throw new Error('This photo is too large to post. Please pick a smaller photo.');
  }
  assertClean(caption, 'Please keep captions respectful 🙏');
  try {
    await addDoc(collection(db, POSTS), {
      userId: me.uid,
      userName: (me.name || '').trim() || 'Outfit user',
      userAvatar: inlineAvatar(me.avatar),
      imageData,
      caption: caption.trim().slice(0, 500),
      likeCount: 0,
      commentCount: 0,
      isPublic: true,
      createdAt: serverTimestamp(),
    });
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

// Which of these posts the user has liked. Never throws.
export const getLikedPostIds = async (postIds: string[], uid: string): Promise<Set<string>> => {
  const liked = new Set<string>();
  await Promise.all(
    postIds.map(async id => {
      try {
        const s = await getDoc(doc(db, POSTS, id, 'likes', uid));
        if (s.exists()) liked.add(id);
      } catch (e: any) {
        console.warn('like check failed:', e?.code, e?.message);
      }
    }),
  );
  return liked;
};

// Like / unlike in one transaction: like doc + likeCount stay in step
export const toggleLike = async (
  postId: string,
  uid: string,
): Promise<{ liked: boolean; likeCount: number }> => {
  const postRef = doc(db, POSTS, postId);
  const likeRef = doc(db, POSTS, postId, 'likes', uid);
  try {
    return await runTransaction(db, async tx => {
      const post = await tx.get(postRef);
      if (!post.exists()) throw new Error('This post was deleted.');
      const like = await tx.get(likeRef);
      const current = Math.max(0, Number((post.data() as any)?.likeCount) || 0);
      if (like.exists()) {
        tx.delete(likeRef);
        tx.update(postRef, { likeCount: increment(-1) });
        return { liked: false, likeCount: Math.max(0, current - 1) };
      }
      tx.set(likeRef, { createdAt: serverTimestamp() });
      tx.update(postRef, { likeCount: increment(1) });
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
