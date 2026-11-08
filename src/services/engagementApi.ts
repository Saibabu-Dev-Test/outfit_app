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
  limit,
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
import { toDate } from '../utils/date';
import { inlineAvatar } from './userApi';
import {
  Comment,
  COMMENTS_LIMIT,
  MAX_COMMENT_CHARS,
  addComment as addPostComment,
  deleteComment as deletePostComment,
  subscribeComments as subscribePostComments,
} from './feedApi';

export type CommentTarget =
  | { kind: 'post'; id: string }
  | { kind: 'wardrobe'; id: string }
  | { kind: 'circle'; circleId: string; id: string };

const commentsCol = (t: CommentTarget) =>
  t.kind === 'circle'
    ? collection(db, 'circles', t.circleId, 'messages', t.id, 'comments')
    : collection(db, t.kind === 'post' ? 'posts' : 'wardrobe', t.id, 'comments');

const toComment = (id: string, d: any): Comment => ({
  id,
  userId: String(d?.userId || ''),
  userName: d?.userName || 'Outfit user',
  userAvatar: d?.userAvatar || null,
  text: d?.text || '',
  createdAt: toDate(d?.createdAt),
});

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

export const addTargetComment = async (
  t: CommentTarget,
  me: { uid: string; name?: string | null; avatar?: string | null },
  text: string,
): Promise<void> => {
  if (t.kind === 'post') return addPostComment(t.id, me, text);
  const x = text.trim();
  if (!x) return;
  if (x.length > MAX_COMMENT_CHARS) throw new Error(`Comments can be up to ${MAX_COMMENT_CHARS} characters.`);
  assertClean(x);
  try {
    await addDoc(commentsCol(t), {
      userId: me.uid,
      userName: (me.name || '').trim() || 'Outfit user',
      userAvatar: inlineAvatar(me.avatar),
      text: x,
      createdAt: serverTimestamp(),
    });
  } catch (e: any) {
    console.warn('comment failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Commenting'));
  }
};

export const deleteTargetComment = async (t: CommentTarget, commentId: string): Promise<void> => {
  if (t.kind === 'post') return deletePostComment(t.id, commentId);
  try {
    await deleteDoc(doc(commentsCol(t), commentId));
  } catch (e: any) {
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
