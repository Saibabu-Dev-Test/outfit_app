// "Wear today" votes on someone's wardrobe, like a daily vote: friends pick which of the owner's
// clothes they should wear today. users/{ownerId}/wearVotes/{date}_{voterId} {voterId, itemId, date, updatedAt}
// One vote per voter per owner per day (picking another item replaces it); the owner can't vote on
// their own clothes, and only public items of open profiles can be voted on (see firestore.rules).
// Likes on wardrobe items reuse wardrobe/{id}/likes (feedApi.toggleWardrobeLike).
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { markEarnVote } from './earnApi';

export interface WearTally {
  date: string; // YYYY-MM-DD (voter's local day)
  counts: Record<string, number>; // itemId -> votes today
  total: number;
  myItemId: string | null; // what I voted for today
}

export const emptyWearTally = (date: string): WearTally => ({ date, counts: {}, total: 0, myItemId: null });

const votesCol = (ownerId: string) => collection(db, 'users', ownerId, 'wearVotes');
const voteId = (date: string, voterId: string) => `${date}_${voterId}`;

// Today's votes for one owner (equality filter only: no composite index needed)
export const getWearTally = async (ownerId: string, date: string, myUid?: string): Promise<WearTally> => {
  try {
    const snap = await getDocs(query(votesCol(ownerId), where('date', '==', date)));
    const t = emptyWearTally(date);
    snap.docs.forEach(d => {
      const v: any = d.data();
      const itemId = typeof v?.itemId === 'string' ? v.itemId : '';
      if (!itemId) return;
      t.counts[itemId] = (t.counts[itemId] || 0) + 1;
      t.total += 1;
      if (myUid && v?.voterId === myUid) t.myItemId = itemId;
    });
    return t;
  } catch (e: any) {
    console.warn('getWearTally failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Loading wear votes'));
  }
};

// Vote (or change today's vote) for one of the owner's items
export const castWearVote = async (ownerId: string, voterId: string, itemId: string, date: string): Promise<void> => {
  if (ownerId === voterId) throw new Error("You can't vote on your own clothes.");
  try {
    await setDoc(doc(votesCol(ownerId), voteId(date, voterId)), {
      voterId,
      itemId,
      date,
      updatedAt: serverTimestamp(),
    });
  } catch (e: any) {
    console.warn('castWearVote failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Voting'));
  }
  markEarnVote(voterId); // Earn tab: today's "vote on 1 outfit"
};

// Take back today's vote
export const removeWearVote = async (ownerId: string, voterId: string, date: string): Promise<void> => {
  try {
    await deleteDoc(doc(votesCol(ownerId), voteId(date, voterId)));
  } catch (e: any) {
    console.warn('removeWearVote failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Removing vote'));
  }
};

// Item with the most votes today (ties: the first of `itemIds`, i.e. newest). null when no votes.
export const topWearItem = (t: WearTally, itemIds: string[]): string | null => {
  let best: string | null = null;
  let bestCount = 0;
  itemIds.forEach(id => {
    const c = t.counts[id] || 0;
    if (c > bestCount) {
      best = id;
      bestCount = c;
    }
  });
  return best;
};
