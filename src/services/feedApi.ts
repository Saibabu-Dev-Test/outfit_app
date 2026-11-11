// Public feed: posts/{id} with likes at posts/{id}/likes/{uid}, dislikes at posts/{id}/dislikes/{uid}
// and comments at posts/{id}/comments/{cid}. Photos are base64 data URIs (no Storage on Spark).
// Light doc + media doc (since the free-tier pass): posts/{id} keeps ~200 px thumbnails in
// imageData / morePhotos (+ media: 1), and posts/{id}/media/full {photos: [full A, B...]} holds the
// ~1080 px photos, read only on the detail screen. Older posts have full photos inline (no media).
// Clear feed photos (since the clear-feed pass): {posts|wardrobe}/{id}/media/clear holds ~720 px,
// ~45 KB copies (+ clear: 1 on the parent). Feed cards show these full width (the 200 px thumbnail
// stretched to the screen looked blurry); older items fall back to the full photo, then the thumbnail.
// The feed itself only shows people who share a circle with me (and my own items).
import {
  collection,
  doc,
  getDoc,
  getDocs,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { recordTask } from './rewardsApi';
import { MAX_BASE64_CHARS } from '../utils/imagePicker';
import { toDate } from '../utils/date';
import { inlineAvatar } from './userApi';
import { assertClean } from '../utils/profanity';
import { getUserLite, getUsersLite } from './userCache';
import { getMyCircles } from './circlesApi';
import { cleanAge, myAgeFields } from '../utils/age';

export type FeedKind = 'post' | 'wardrobe';

export interface Post {
  id: string;
  kind: FeedKind; // 'wardrobe' = a public wardrobe photo shown in the feed
  userId: string;
  userName: string;
  userAge?: number | null;
  userAvatar: string | null;
  imageData: string; // first photo (A): thumbnail on new posts, full photo on older ones
  photos: string[]; // all photos A..F (1 for a normal post), same sizes as imageData
  hasMedia: boolean; // full-size photos are in {posts|wardrobe}/{id}/media/full
  hasClear?: boolean; // ~720 px feed photos are in {posts|wardrobe}/{id}/media/clear
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
// One thumbnail (THUMB_SPEC <= 16 KB = ~22K chars) with slack for a picker that overshoots
const MAX_THUMB_CHARS = 40000;
export const MEDIA_FULL = 'full';
export const MEDIA_CLEAR = 'clear';
// One clear feed photo (CLEAR_SPEC <= 80 KB = ~109K chars) with slack
const MAX_CLEAR_CHARS = 160000;

// A photo to post: full size + thumbnail (thumb missing = older picker: stored inline)
export interface PostPhoto {
  full: string;
  thumb?: string;
  clear?: string; // ~720 px feed copy (optional)
}

export type FeedCursor = QueryDocumentSnapshot<DocumentData> | null;

export const FEED_PAGE_SIZE = 10;
const POSTS = 'posts';

const toPost = (id: string, d: any): Post => ({
  id,
  kind: 'post',
  userId: String(d?.userId || ''),
  userName: d?.userName || 'Outfit user',
  userAge: cleanAge(d?.userAge),
  userAvatar: d?.userAvatar || null,
  imageData: d?.imageData || '',
  photos: [d?.imageData || '', ...(Array.isArray(d?.morePhotos) ? d.morePhotos : [])]
    .filter((x: any) => typeof x === 'string' && x)
    .slice(0, MAX_POST_PHOTOS),
  hasMedia: d?.media === 1,
  hasClear: d?.clear === 1,
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
    const list = snap.docs
      .map(d => toPost(d.id, d.data()))
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    rememberPosts(list);
    return list;
  } catch (e: any) {
    return fail(e, 'Loading posts');
  }
};

// One photo = normal post. 2-6 photos = A/B/C... vote post (photos B.. go in morePhotos).
// New layout: thumbnails on the post, full photos in posts/{id}/media/full, one batch.
export const createPost = async (
  me: { uid: string; name?: string | null; avatar?: string | null },
  images: string | (string | PostPhoto)[],
  caption: string,
): Promise<void> => {
  const list: PostPhoto[] = (Array.isArray(images) ? images : [images])
    .filter(Boolean)
    .map(x => (typeof x === 'string' ? { full: x } : x));
  if (!list.length) throw new Error('Pick a photo first.');
  if (list.length > MAX_POST_PHOTOS) throw new Error(`Up to ${MAX_POST_PHOTOS} photos per post.`);
  list.forEach(img => {
    if (!/^data:image\//.test(img.full)) throw new Error('Photo could not be read. Please pick it again.');
    if (img.full.length > MAX_BASE64_CHARS + 100) {
      throw new Error('This photo is too large to post. Please pick a smaller photo.');
    }
  });
  const total = list.reduce((n, x) => n + x.full.length, 0);
  if (total > MAX_POST_TOTAL_CHARS) {
    throw new Error('These photos are too large together. Remove one or pick smaller photos.');
  }
  assertClean(caption, 'Please keep captions respectful 🙏');
  // Split only when every photo has a small thumbnail
  const split = list.every(x => !!x.thumb && /^data:image\//.test(x.thumb) && x.thumb.length <= MAX_THUMB_CHARS);
  const shown = split ? list.map(x => x.thumb as string) : list.map(x => x.full);
  try {
    const data: any = {
      userId: me.uid,
      userName: (me.name || '').trim() || 'Outfit user',
      ...myAgeFields(),
      userAvatar: inlineAvatar(me.avatar),
      imageData: shown[0],
      caption: caption.trim().slice(0, 500),
      likeCount: 0,
      commentCount: 0,
      isPublic: true,
      createdAt: serverTimestamp(),
    };
    if (shown.length > 1) data.morePhotos = shown.slice(1);
    const ref = doc(collection(db, POSTS));
    const b = writeBatch(db);
    if (split) {
      data.media = 1;
      // Clear feed copies only when every photo has one
      const clear = list.every(x => !!x.clear && /^data:image\//.test(x.clear) && x.clear.length <= MAX_CLEAR_CHARS);
      if (clear) data.clear = 1;
      b.set(ref, data);
      b.set(doc(db, POSTS, ref.id, 'media', MEDIA_FULL), {
        photos: list.map(x => x.full),
        userId: me.uid,
        createdAt: serverTimestamp(),
      });
      if (clear) {
        b.set(doc(db, POSTS, ref.id, 'media', MEDIA_CLEAR), {
          photos: list.map(x => x.clear as string),
          userId: me.uid,
          createdAt: serverTimestamp(),
        });
      }
    } else {
      b.set(ref, data);
    }
    await b.commit();
    recordTask(me.uid, 'uploaded'); // daily task (never throws)
  } catch (e: any) {
    fail(e, 'Posting');
  }
};

// Author or admin; the media doc goes in the same batch. Like docs under it are left behind
// (harmless; no Cloud Functions on Spark).
export const deletePost = async (postId: string): Promise<void> => {
  try {
    const b = writeBatch(db);
    b.delete(doc(db, POSTS, postId, 'media', MEDIA_FULL));
    b.delete(doc(db, POSTS, postId, 'media', MEDIA_CLEAR));
    b.delete(doc(db, POSTS, postId));
    await b.commit();
    forgetFullPhotos('post', postId);
  } catch (e: any) {
    fail(e, 'Deleting post');
  }
};

// ── Full-size photos (detail screen only) ───────────────────────────────
const fullCache = new Map<string, string[]>();
const FULL_CACHE_MAX = 30;
const forgetFullPhotos = (kind: FeedKind, id: string) => {
  fullCache.delete(`${kind}_${id}`);
  clearCache.delete(`${kind}_${id}`);
};

// Full photos of a post / wardrobe photo (1 read, cached for the session). Older items without a
// media doc already hold them inline. Never throws: falls back to the thumbnails.
export const getFullPhotos = async (post: Post): Promise<string[]> => {
  if (!post.hasMedia) return post.photos;
  const key = `${post.kind}_${post.id}`;
  const hit = fullCache.get(key);
  if (hit) return hit;
  try {
    const s = await getDoc(doc(db, post.kind === 'post' ? POSTS : 'wardrobe', post.id, 'media', MEDIA_FULL));
    const d: any = s.exists() ? s.data() : null;
    const arr: string[] = (post.kind === 'post' ? (Array.isArray(d?.photos) ? d.photos : []) : [d?.imageData])
      .filter((x: any) => typeof x === 'string' && x);
    if (!arr.length) return post.photos;
    const out = post.photos.map((thumb, i) => arr[i] || thumb);
    if (fullCache.size >= FULL_CACHE_MAX) fullCache.delete(fullCache.keys().next().value as string);
    fullCache.set(key, out);
    return out;
  } catch (e: any) {
    console.warn('full photo load failed:', e?.code, e?.message);
    return post.photos;
  }
};

// ── Clear feed photos (feed cards, full width) ──────────────────────────
const clearCache = new Map<string, string[]>();
const CLEAR_CACHE_MAX = 40;

// ~720 px photos for a feed card (1 read, cached for the session). Older items without a clear
// copy use the full photos (media/full, or inline on the oldest items); the thumbnails are the
// last resort. Never throws.
export const getClearPhotos = async (post: Post): Promise<string[]> => {
  const key = `${post.kind}_${post.id}`;
  const hit = clearCache.get(key);
  if (hit) return hit;
  if (!post.hasClear) return getFullPhotos(post);
  try {
    const s = await getDoc(doc(db, post.kind === 'post' ? POSTS : 'wardrobe', post.id, 'media', MEDIA_CLEAR));
    const d: any = s.exists() ? s.data() : null;
    const arr: string[] = (post.kind === 'post' ? (Array.isArray(d?.photos) ? d.photos : []) : [d?.imageData])
      .filter((x: any) => typeof x === 'string' && x);
    if (!arr.length) return getFullPhotos(post);
    const out = post.photos.map((thumb, i) => arr[i] || thumb);
    if (clearCache.size >= CLEAR_CACHE_MAX) clearCache.delete(clearCache.keys().next().value as string);
    clearCache.set(key, out);
    return out;
  } catch (e: any) {
    console.warn('clear photo load failed:', e?.code, e?.message);
    return getFullPhotos(post);
  }
};

// Posts already loaded in a list, so the detail screen opens without another read
const postCache = new Map<string, Post>();
export const rememberPosts = (list: Post[]) => {
  list.forEach(p => postCache.set(`${p.kind}_${p.id}`, p));
  while (postCache.size > 200) postCache.delete(postCache.keys().next().value as string);
};
export const cachedPost = (kind: FeedKind, id: string): Post | null => postCache.get(`${kind}_${id}`) || null;

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
// me: name/avatar kept on the like doc for the owner's "Liked by" list.
export const toggleLike = async (
  postId: string,
  uid: string,
  clearDislike = false,
  me?: { name?: string | null; avatar?: string | null },
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
      tx.set(likeRef, {
        createdAt: serverTimestamp(),
        name: ((me?.name || '').trim() || 'Outfit user').slice(0, 60),
        avatar: inlineAvatar(me?.avatar),
      });
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
  userAge?: number | null;
  userAvatar: string | null;
  text: string;
  createdAt: Date | null;
  // One level of replies (Instagram style): a reply points at a top-level comment
  parentId: string | null;
  replyCount: number; // top-level comments only
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
export const emitCommentCount = (postId: string, delta: number) =>
  countListeners.forEach(fn => fn(postId, delta));
const emitCount = emitCommentCount;

export const toComment = (id: string, d: any): Comment => ({
  id,
  userId: String(d?.userId || ''),
  userName: d?.userName || 'Outfit user',
  userAge: cleanAge(d?.userAge),
  userAvatar: d?.userAvatar || null,
  text: d?.text || '',
  createdAt: toDate(d?.createdAt),
  parentId: typeof d?.parentId === 'string' && d.parentId ? d.parentId : null,
  replyCount: typeof d?.replyCount === 'number' ? Math.max(0, d.replyCount) : 0,
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
// A reply (parentId) also bumps the parent's replyCount (+ lastReplyId for the rules). Returns the
// new comment (createdAt = now until the server time is read back).
export const addComment = async (
  postId: string,
  me: { uid: string; name?: string | null; avatar?: string | null },
  text: string,
  parentId?: string | null,
): Promise<Comment | null> => {
  const t = text.trim();
  if (!t) return null;
  if (t.length > MAX_COMMENT_CHARS) throw new Error(`Comments can be up to ${MAX_COMMENT_CHARS} characters.`);
  assertClean(t);
  const postRef = doc(db, POSTS, postId);
  const commentRef = doc(collection(db, POSTS, postId, 'comments'));
  const parentRef = parentId ? doc(db, POSTS, postId, 'comments', parentId) : null;
  const data: any = {
    userId: me.uid,
    userName: (me.name || '').trim() || 'Outfit user',
    ...myAgeFields(),
    userAvatar: inlineAvatar(me.avatar),
    text: t,
  };
  if (parentId) data.parentId = parentId;
  try {
    await runTransaction(db, async tx => {
      const post = await tx.get(postRef);
      if (!post.exists()) throw new Error('This post was deleted.');
      const parent = parentRef ? await tx.get(parentRef) : null;
      if (parent && !parent.exists()) throw new Error('That comment was deleted.');
      const current = Math.max(0, Number((post.data() as any)?.commentCount) || 0);
      tx.set(commentRef, { ...data, createdAt: serverTimestamp() });
      tx.update(postRef, { commentCount: current + 1, lastCommentId: commentRef.id });
      if (parentRef && parent) {
        const replies = Math.max(0, Number((parent.data() as any)?.replyCount) || 0);
        tx.update(parentRef, { replyCount: replies + 1, lastReplyId: commentRef.id });
      }
    });
    emitCount(postId, 1);
    return toComment(commentRef.id, { ...data, createdAt: new Date() });
  } catch (e: any) {
    if (!e?.code && e instanceof Error) throw e;
    return fail(e, 'Commenting');
  }
};

// Comment author, post owner, admin (or the parent comment's author for a reply). Count goes down
// by 1 in the same transaction (a reply also takes 1 off its parent's replyCount). Deleting a
// top-level comment first deletes its replies one by one, so every count stays exact.
export const deleteComment = async (postId: string, commentId: string): Promise<void> => {
  const postRef = doc(db, POSTS, postId);
  const commentRef = doc(db, POSTS, postId, 'comments', commentId);
  try {
    const replies = await getDocs(
      query(collection(db, POSTS, postId, 'comments'), where('parentId', '==', commentId), limit(200)),
    );
    for (const r of replies.docs) await deleteComment(postId, r.id);
    let counted = false;
    await runTransaction(db, async tx => {
      const post = await tx.get(postRef);
      const comment = await tx.get(commentRef);
      if (!comment.exists()) return;
      const parentId = (comment.data() as any)?.parentId;
      const parentRef = typeof parentId === 'string' && parentId ? doc(db, POSTS, postId, 'comments', parentId) : null;
      const parent = parentRef ? await tx.get(parentRef) : null;
      tx.delete(commentRef);
      const current = post.exists() ? Math.max(0, Number((post.data() as any)?.commentCount) || 0) : 0;
      // Skip the count if the post is gone or the count is already 0
      if (current > 0) {
        tx.update(postRef, { commentCount: current - 1, lastCommentId: commentId });
        counted = true;
      }
      const rc = parent?.exists() ? Math.max(0, Number((parent.data() as any)?.replyCount) || 0) : 0;
      if (parentRef && rc > 0) tx.update(parentRef, { replyCount: rc - 1, lastReplyId: commentId });
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
    hasMedia: d?.media === 1,
    hasClear: d?.clear === 1,
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
// users/{uid}/liked ordered by createdAt (single-field index, automatic: no composite index).
// The last result is cached (memory + AsyncStorage) so Me › Likes shows at once; the screen then
// refreshes in the background. A slow / offline network never leaves it spinning: after
// LIKES_TIMEOUT_MS the cached (or empty) list is returned.
const LIKES_CACHE_KEY = (uid: string) => `outfit:likes:${uid}`;
const LIKES_CACHE_MAX = 30;
const LIKES_TIMEOUT_MS = 8000;
const likesMem = new Map<string, Post[]>();

const reviveLiked = (x: any): Post => ({ ...x, createdAt: x?.createdAt ? new Date(x.createdAt) : null });

// Cached likes: memory first, then AsyncStorage. null = never loaded on this phone. Never throws.
export const getCachedLikedItems = async (uid: string): Promise<Post[] | null> => {
  const hit = likesMem.get(uid);
  if (hit) return hit;
  try {
    const raw = await AsyncStorage.getItem(LIKES_CACHE_KEY(uid));
    const arr = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(arr)) return null;
    const list = arr.map(reviveLiked).filter((p: Post) => !!p?.id && !!p?.imageData);
    likesMem.set(uid, list);
    rememberPosts(list);
    return list;
  } catch {
    return null;
  }
};

const saveLikedCache = (uid: string, list: Post[]) => {
  likesMem.set(uid, list);
  AsyncStorage.setItem(LIKES_CACHE_KEY(uid), JSON.stringify(list.slice(0, LIKES_CACHE_MAX))).catch(() => undefined);
};

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> =>
  Promise.race([p, new Promise<typeof TIMED_OUT>(resolve => setTimeout(() => resolve(TIMED_OUT), ms))]);
const TIMED_OUT = Symbol('timeout');

const loadLikedItems = async (uid: string, max: number): Promise<Post[]> => {
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
  if (!refs.length) return [];
  // Items I've already seen this session need no read
  const items = await Promise.all(
    refs.map(r => {
      const known = cachedPost(r.kind, r.refId);
      if (known) return Promise.resolve(known);
      return r.kind === 'post' ? getPost(r.refId).catch(() => null) : getWardrobeAsPost(r.refId);
    }),
  );
  return items.filter((x): x is Post => !!x && !!x.imageData);
};

// Fresh list (also updates the cache). Resolves within LIKES_TIMEOUT_MS with the cached list
// (or []) when the network is slow. Throws a readable Error only when nothing is cached.
export const getLikedItems = async (uid: string, max = 60): Promise<Post[]> => {
  const cached = await getCachedLikedItems(uid);
  try {
    const r = await withTimeout(loadLikedItems(uid, max), LIKES_TIMEOUT_MS);
    if (r === TIMED_OUT) return cached || [];
    rememberPosts(r);
    saveLikedCache(uid, r);
    return r;
  } catch (e: any) {
    if (cached) return cached;
    throw e;
  }
};

// ── Circle feed: posts + public wardrobe photos from people who share a circle with me ──
// (and my own), newest first. Queries use userId in [<= 30 circle mates] per chunk, so they read
// only circle items (indexes: posts userId ASC + createdAt DESC; wardrobe isPublic ASC + userId ASC
// + createdAt DESC). Until those indexes are deployed each chunk falls back to one unsorted read
// (limit 100) sorted on the phone.
type SourceName = 'posts' | 'wardrobe';
interface Source {
  name: SourceName;
  uids: string[]; // userId in [...] (max 30)
  cursor: FeedCursor;
  buffer: { id: string; data: any; at: number }[];
  done: boolean;
  fallback: boolean; // no composite index yet: one bigger unsorted read, sorted here
}

const IN_MAX = 30; // Firestore 'in' limit
const MAX_CHUNKS = 10; // up to 300 circle mates in the feed

const newSource = (name: SourceName, uids: string[]): Source => ({
  name,
  uids,
  cursor: null,
  buffer: [],
  done: false,
  fallback: false,
});

const fillSource = async (s: Source): Promise<void> => {
  if (s.done || s.fallback) return;
  const base = collection(db, s.name === 'posts' ? POSTS : 'wardrobe');
  const at = (d: any) => toDate(d?.createdAt)?.getTime() || 0;
  // Global feed (no uids): every user's public wardrobe photos + all posts, newest first.
  // Index used: wardrobe isPublic ASC + createdAt DESC (firestore.indexes.json); posts: createdAt only.
  const filters: any[] = !s.uids.length
    ? s.name === 'wardrobe'
      ? [where('isPublic', '==', true)]
      : []
    : s.name === 'wardrobe'
      ? [where('isPublic', '==', true), where('userId', 'in', s.uids)]
      : [where('userId', 'in', s.uids)];
  try {
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
    // failed-precondition = composite index not deployed yet: one unsorted read, sorted here
    console.warn(`${s.name} circle feed query failed, using fallback:`, e?.code, e?.message);
    s.fallback = true;
    s.done = true;
    try {
      const snap = await getDocs(query(base, ...filters, limit(100)));
      snap.docs.forEach(d => s.buffer.push({ id: d.id, data: d.data(), at: at(d.data()) }));
      s.buffer.sort((a, b) => b.at - a.at);
    } catch (e2: any) {
      console.warn(`${s.name} circle feed fallback failed:`, e2?.code, e2?.message);
      if (s.name === 'posts') throw e2;
    }
  }
};

// People who share a circle with me (+ me). Never throws (no circles = only my own items).
const circleMates = async (meUid?: string): Promise<string[]> => {
  if (!meUid) return [];
  const ids = new Set<string>([meUid]);
  try {
    const circles = await getMyCircles(meUid);
    circles.forEach(c => c.memberIds.forEach(id => id && ids.add(id)));
  } catch (e: any) {
    console.warn('circle feed: circles failed:', e?.code, e?.message);
  }
  return Array.from(ids);
};

export type FeedScope = 'everyone' | 'circles';

export class FeedLoader {
  private sources: Source[] | null = null;
  private meUid?: string;
  // How many circle mates (me excluded) the feed covers; set after the first page
  circleMateCount = 0;

  private scope: FeedScope;
  constructor(meUid?: string, scope: FeedScope = 'everyone') {
    this.meUid = meUid;
    this.scope = scope;
  }

  get hasMore(): boolean {
    return !this.sources || this.sources.some(s => !s.done || s.buffer.length > 0);
  }

  private async init(): Promise<Source[]> {
    if (this.sources) return this.sources;
    if (this.scope === 'everyone') {
      // Everyone's public looks (new users see a full feed from day one)
      this.circleMateCount = 0;
      this.sources = [newSource('posts', []), newSource('wardrobe', [])];
      return this.sources;
    }
    const uids = await circleMates(this.meUid);
    this.circleMateCount = Math.max(0, uids.length - 1);
    const chunks: string[][] = [];
    for (let i = 0; i < uids.length && chunks.length < MAX_CHUNKS; i += IN_MAX) chunks.push(uids.slice(i, i + IN_MAX));
    this.sources = chunks.flatMap(c => [newSource('posts', c), newSource('wardrobe', c)]);
    return this.sources;
  }

  // Next page (newest first across all sources)
  async next(n = FEED_PAGE_SIZE): Promise<Post[]> {
    const sources = await this.init();
    const picked: { src: SourceName; id: string; data: any; at: number }[] = [];
    try {
      while (picked.length < n) {
        // Every source that might hold a newer item needs a non-empty buffer
        await Promise.all(sources.filter(s => !s.buffer.length && !s.done).map(fillSource));
        const live = sources.filter(s => s.buffer.length);
        if (!live.length) break;
        live.sort((a, b) => b.buffer[0].at - a.buffer[0].at);
        const s = live[0];
        const top = s.buffer.shift()!;
        picked.push({ src: s.name, ...top });
      }
    } catch (e: any) {
      if (!picked.length) return fail(e, 'Loading feed');
    }
    const owners = await getUsersLite(picked.map(p => String(p.data?.userId || '')));
    const out: Post[] = [];
    picked.forEach(p => {
      const uid = String(p.data?.userId || '');
      const owner = owners.get(uid);
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
    rememberPosts(out);
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
    const list = snap.docs
      .map(d => wardrobeToPost(d.id, d.data(), owner))
      .filter(p => !!p.imageData)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    rememberPosts(list);
    return list;
  } catch (e: any) {
    return fail(e, 'Loading wardrobe');
  }
};
