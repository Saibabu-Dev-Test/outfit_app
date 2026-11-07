// Reports for moderators: reports/{id} {circleId, messageId?, postId?, commentId?, reporterId, reason, createdAt}
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { toDate } from '../utils/date';

export const REPORT_REASONS = [
  'Spam or scam',
  'Nudity or sexual content',
  'Harassment or bullying',
  'Hate speech',
  'Violence or dangerous content',
  'Something else',
];

export interface Report {
  id: string;
  circleId: string | null;
  messageId: string | null;
  postId: string | null;
  commentId: string | null;
  reporterId: string;
  reason: string;
  createdAt: Date | null;
}

export const createReport = async (
  target: { circleId?: string | null; messageId?: string | null; postId?: string | null; commentId?: string | null },
  reporterId: string,
  reason: string,
): Promise<void> => {
  const data: any = {
    circleId: target.circleId || null,
    reporterId,
    reason: reason.slice(0, 200),
    createdAt: serverTimestamp(),
  };
  if (target.messageId) data.messageId = target.messageId;
  if (target.postId) data.postId = target.postId;
  if (target.postId && target.commentId) data.commentId = target.commentId;
  try {
    await addDoc(collection(db, 'reports'), data);
  } catch (e: any) {
    console.warn('createReport failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Reporting'));
  }
};

// Admin only (rules)
export const getReports = async (): Promise<Report[]> => {
  try {
    const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(200)));
    return snap.docs.map(d => {
      const x: any = d.data();
      return {
        id: d.id,
        circleId: x?.circleId || null,
        messageId: x?.messageId || null,
        postId: x?.postId || null,
        commentId: x?.commentId || null,
        reporterId: String(x?.reporterId || ''),
        reason: x?.reason || '',
        createdAt: toDate(x?.createdAt),
      };
    });
  } catch (e: any) {
    console.warn('getReports failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Loading reports'));
  }
};

export const deleteReport = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'reports', id));
  } catch (e: any) {
    console.warn('deleteReport failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Dismissing report'));
  }
};
