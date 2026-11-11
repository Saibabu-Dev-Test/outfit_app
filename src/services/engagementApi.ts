// Comments and reactions for things other than feed posts:
//   wardrobe/{id}/comments/{cid}                        (public wardrobe photos in the feed)
//   circles/{cid}/messages/{mid}/comments/{commentId}   (circle photo / A-F posts)
//   circles/{cid}/messages/{mid}/reactions/{uid}        {type: 'like' | 'dislike', updatedAt}
// Feed posts keep their own counters in feedApi.ts.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  QueryDocumentSnapshot,
  runTransaction,
  startAfter,
  where,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { assertClean } from '../utils/profanity';
import { inlineAvatar } from './userApi';
import {
  Comment,
  COMMENTS_LIMIT,
  MAX_COMMENT_CHARS,
  addComment as addPostComment,
  deleteComment as deletePostComment,
  emitCommentCount,
  subscribeComments as subscribePostComments,
  toComment as feedToComment,
} from './feedApi';
import { myAgeFields } from '../utils/age';

export type CommentTarget =
  | { kind: 'post'; id: string }
  | { kind: 'wardrobe'; id: string }
  | { kind: 'circle'; circleId: string; id: string };

const commentsCol = (t: CommentTarget) =>
  t.kind === 'circle'
    ? collection(db, 'circles', t.circleId, 'messages', t.id, 'comments')
    : collection(db, t.kind === 'post' ? 'posts' : 'wardrobe', t.id, 'comments');

const toComment = feedToComment;

export const subscribeTargetComments = (
  t: CommentTarget,
  onData: (list: Comment[]) => void,
  onError: (msg: string) => void,
): Unsubscribe => {
  if (t.kind === 'post') return subscribePostComments(t.id, onData, onError);
  return onSnapshot(
    query(commentsCol(t), orderBy('createdAt', 'asc'), limit(COMMENTS_LIMIT)),
    snap => onData(snap.docs.map(d => toComment(d.id, d.data({ serverTimestamps: 'estimate' })))),
    e => {
      console.warn('comments listener failed:', (e as any)?.code, e?.message);
      onError(firestoreErrorMessage(e, 'Loading comments'));
    },
  );
};

// parentId: a reply (posts and wardrobe photos only; one level). Returns the new comment.
export const addTargetComment = async (
  t: CommentTarget,
  me: { uid: string; name?: string | null; avatar?: string | null },
  text: string,
  parentId?: string | null,
): Promise<Comment | null> => {
  if (t.kind === 'post') return addPostComment(t.id, me, text, parentId);
  const x = text.trim();
  if (!x) return null;
  if (x.length > MAX_COMMENT_CHARS) throw new Error(`Comments can be up to ${MAX_COMMENT_CHARS} characters.`);
  assertClean(x);
  const data: any = {
    userId: me.uid,
    userName: (me.name || '').trim() || 'Outfit user',
    ...myAgeFields(),
    userAvatar: inlineAvatar(me.avatar),
    text: x,
  };
  try {
    if (parentId && t.kind === 'wardrobe') {
      // Reply + parent replyCount (+1, lastReplyId for the rules) in one transaction
      const ref = doc(commentsCol(t));
      const parentRef = doc(commentsCol(t), parentId);
      await runTransaction(db, async tx => {
        const parent = await tx.get(parentRef);
        if (!parent.exists()) throw new Error('That comment was deleted.');
        const rc = Math.max(0, Number((parent.data() as any)?.replyCount) || 0);
        tx.set(ref, { ...data, parentId, createdAt: serverTimestamp() });
        tx.update(parentRef, { replyCount: rc + 1, lastReplyId: ref.id });
      });
      emitCommentCount(t.id, 1);
      return toComment(ref.id, { ...data, parentId, createdAt: new Date() });
    }
    const ref = await addDoc(commentsCol(t), { ...data, createdAt: serverTimestamp() });
    if (t.kind === 'wardrobe') emitCommentCount(t.id, 1);
    return toComment(ref.id, { ...data, createdAt: new Date() });
  } catch (e: any) {
    if (!e?.code && e instanceof Error) throw e;
    console.warn('comment failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Commenting'));
  }
};

export const deleteTargetComment = async (t: CommentTarget, commentId: string): Promise<void> => {
  if (t.kind === 'post') return deletePostComment(t.id, commentId);
  try {
    if (t.kind === 'wardrobe') {
      // Replies first (each takes 1 off the parent's replyCount), then the comment itself
      const replies = await getDocs(query(commentsCol(t), where('parentId', '==', commentId), limit(200)));
      for (const r of replies.docs) await deleteTargetComment(t, r.id);
      const ref = doc(commentsCol(t), commentId);
      let gone = false;
      await runTransaction(db, async tx => {
        const c = await tx.get(ref);
        if (!c.exists()) return;
        const pid = (c.data() as any)?.parentId;
        const parentRef = typeof pid === 'string' && pid ? doc(commentsCol(t), pid) : null;
        const parent = parentRef ? await tx.get(parentRef) : null;
        tx.delete(ref);
        gone = true;
        const rc = parent?.exists() ? Math.max(0, Number((parent.data() as any)?.replyCount) || 0) : 0;
        if (parentRef && rc > 0) tx.update(parentRef, { replyCount: rc - 1, lastReplyId: commentId });
      });
      if (gone) emitCommentCount(t.id, -1);
      return;
    }
    await deleteDoc(doc(commentsCol(t), commentId));
  } catch (e: any) {
    if (!e?.code && e instanceof Error) throw e;
    throw new Error(firestoreErrorMessage(e, 'Deleting comment'));
  }
};

// Never throws
export const countTargetComments = async (t: CommentTarget): Promise<number> => {
  try {
    return (await getCountFromServer(commentsCol(t))).data().count;
  } catch {
    return 0;
  }
};

// ── Circle reactions (like / dislike), live ─────────────────────────────
export type Reaction = 'like' | 'dislike';
export interface ReactionTally {
  likes: number;
  dislikes: number;
  mine: Reaction | null;
}

export const subscribeReactions = (
  circleId: string,
  messageId: string,
  myUid: string | undefined,
  onData: (t: ReactionTally) => void,
): Unsubscribe => {
  try {
    return onSnapshot(
      collection(db, 'circles', circleId, 'messages', messageId, 'reactions'),
      snap => {
        let likes = 0;
        let dislikes = 0;
        let mine: Reaction | null = null;
        snap.docs.forEach(d => {
          const type = (d.data() as any)?.type;
          if (type === 'like') likes += 1;
          if (type === 'dislike') dislikes += 1;
          if (d.id === myUid && (type === 'like' || type === 'dislike')) mine = type;
        });
        onData({ likes, dislikes, mine });
      },
      e => console.warn('reactions listener failed:', (e as any)?.code, e?.message),
    );
  } catch (e: any) {
    console.warn('subscribeReactions failed:', e?.code, e?.message);
    return () => {};
  }
};

// Same reaction again removes it; the other one replaces it
export const setReaction = async (
  circleId: string,
  messageId: string,
  uid: string,
  type: Reaction,
  current: Reaction | null,
): Promise<void> => {
  const ref = doc(db, 'circles', circleId, 'messages', messageId, 'reactions', uid);
  try {
    if (current === type) await deleteDoc(ref);
    else await setDoc(ref, { type, updatedAt: serverTimestamp() });
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Reacting'));
  }
};

// ── Paged comments for the inline feed card (posts + wardrobe photos) ──
export const COMMENTS_PAGE = 20;
export type CommentCursor = QueryDocumentSnapshot | null;

// Latest few comments, newest first in the query (the card shows the latest 2 top-level ones)
export const fetchLatestComments = async (t: CommentTarget, n = 10): Promise<Comment[]> => {
  try {
    const snap = await getDocs(query(commentsCol(t), orderBy('createdAt', 'desc'), limit(n)));
    return snap.docs.map(d => toComment(d.id, d.data()));
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Loading comments'));
  }
};

// Oldest first, page by page. Replies come back too (the caller threads them; a reply is always
// newer than its parent so the parent is already loaded).
export const fetchCommentsPage = async (
  t: CommentTarget,
  cursor: CommentCursor,
  pageSize = COMMENTS_PAGE,
): Promise<{ items: Comment[]; cursor: CommentCursor; hasMore: boolean }> => {
  try {
    const base = [orderBy('createdAt', 'asc'), ...(cursor ? [startAfter(cursor)] : []), limit(pageSize)];
    const snap = await getDocs(query(commentsCol(t), ...(base as any)));
    const docs = snap.docs;
    return {
      items: docs.map(d => toComment(d.id, d.data())),
      cursor: docs.length ? docs[docs.length - 1] : cursor,
      hasMore: docs.length === pageSize,
    };
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Loading comments'));
  }
};

// All replies of one comment (single-field equality: no composite index needed), sorted by caller
export const fetchReplies = async (t: CommentTarget, parentId: string): Promise<Comment[]> => {
  try {
    const snap = await getDocs(query(commentsCol(t), where('parentId', '==', parentId), limit(COMMENTS_LIMIT)));
    return snap.docs.map(d => toComment(d.id, d.data()));
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Loading replies'));
  }
};
