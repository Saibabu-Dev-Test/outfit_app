// Admin › Storage: what the app stores where, and roughly how much. Spark (free) plan only.
//  - Document counts: getCountFromServer() aggregations (1 read per 1000 docs counted).
//  - Bytes: ESTIMATES. A small sample of docs (+ their media/full and media/clear photo docs) is read,
//    sized with utils/storageEstimate (Firestore's size formula, base64 photo ~1 byte per char),
//    and the average is multiplied by the server count. Index storage is not included.
//  - Top users: on demand only (reads up to TOP_USERS_MAX user docs + 2 count queries each).
//  - Device: AsyncStorage keys on this phone (Firestore's own cache here is in memory only).
// Nothing is written. No Cloud Monitoring / paid APIs (they need server credentials).
import {
  collection,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  QueryDocumentSnapshot,
  QuerySnapshot,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebaseConfig';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { average, estimateDocBytes } from '../utils/storageEstimate';

export interface CollectionInfo {
  name: string;
  label: string;
  holds: string; // what is stored there
  media: boolean; // carries base64 photos
}

// Top-level collections (firestore.rules). Ones the admin may not list show as "no access".
export const COLLECTIONS: CollectionInfo[] = [
  { name: 'wardrobe', label: '👗 Wardrobe items', holds: 'thumbnail on the item + media/full (near-original) + media/clear (feed copy)', media: true },
  { name: 'posts', label: '📰 Feed posts', holds: 'thumbnails A–F on the post + media/full photos', media: true },
  { name: 'users', label: '👤 Users', holds: 'profile, avatar (base64), activity / liked / votes subcollections', media: true },
  { name: 'circles', label: '👥 Circles', holds: 'circle info; chat messages (+ photo media) in subcollections', media: true },
  { name: 'birthdays', label: '🎂 Birthdays', holds: 'opt-in birthday listing (name, small avatar, MM-DD)', media: true },
  { name: 'feedback', label: '💬 Feedback', holds: 'feedback posts, screenshots, replies', media: true },
  { name: 'reports', label: '🚩 Reports', holds: 'content reports', media: false },
  { name: 'rewardClaims', label: '🎁 Reward claims', holds: 'monthly reward requests', media: false },
  { name: 'weeklyStars', label: '⭐ Weekly stars', holds: 'weekly star members', media: false },
  { name: 'votes', label: '🗳️ Votes', holds: 'poll votes', media: false },
];

export const STORAGE_KINDS = [
  { icon: '🔥', title: 'Cloud Firestore (free Spark plan)', body: 'Everything: all photos are base64 strings inside Firestore documents (thumbnails on items/posts, full and feed copies in media/ subdocs).' },
  { icon: '🗂️', title: 'Firebase Storage', body: 'Not used (it needs the paid Blaze plan for new projects).' },
  { icon: '🌐', title: 'Firebase Hosting', body: 'APK download page only (10 GB/month transfer free). Not counted here.' },
  { icon: '📱', title: 'On this phone', body: 'AsyncStorage: settings, small caches (stylist answers, translations, astrology), sign-in session. Image cache is managed by Android.' },
];

export interface CollectionStat extends CollectionInfo {
  count: number | null; // null = no access / failed
  avgBytes: number | null; // per document incl. its media docs (sampled)
  estBytes: number | null; // count × avgBytes
  sampled: number;
  error?: string;
}

export interface StorageReport {
  collections: CollectionStat[];
  totalEstBytes: number;
  readsUsed: number; // approximate reads this refresh cost
  at: Date;
}

const SAMPLE = 15;

const countOf = async (name: string): Promise<number> => (await getCountFromServer(collection(db, name))).data().count;

// Average stored bytes of one doc (+ its media docs) from a small sample ordered by document id
const sampleAvg = async (info: CollectionInfo): Promise<{ avg: number; n: number; reads: number }> => {
  const snap = await getDocs(query(collection(db, info.name), orderBy(documentId()), limit(SAMPLE)));
  let reads = Math.max(1, snap.size);
  const sizes = await Promise.all(
    snap.docs.map(async d => {
      let bytes = estimateDocBytes(`${info.name}/${d.id}`, d.data());
      if (info.name === 'wardrobe' || info.name === 'posts') {
        const media = await Promise.allSettled(
          ['full', 'clear'].map(m => getDoc(doc(db, info.name, d.id, 'media', m))),
        );
        media.forEach(r => {
          reads += 1;
          if (r.status === 'fulfilled' && r.value.exists()) {
            bytes += estimateDocBytes(`${info.name}/${d.id}/media/${r.value.id}`, r.value.data());
          }
        });
      }
      return bytes;
    }),
  );
  return { avg: average(sizes), n: sizes.length, reads };
};

export const getStorageReport = async (): Promise<StorageReport> => {
  let readsUsed = 0;
  const collections = await Promise.all(
    COLLECTIONS.map(async (info): Promise<CollectionStat> => {
      const out: CollectionStat = { ...info, count: null, avgBytes: null, estBytes: null, sampled: 0 };
      try {
        out.count = await countOf(info.name);
        readsUsed += Math.max(1, Math.ceil(out.count / 1000));
      } catch (e: any) {
        out.error = e?.code === 'permission-denied' ? 'no access' : firestoreErrorMessage(e, 'Counting');
        return out;
      }
      if (!out.count) {
        out.avgBytes = 0;
        out.estBytes = 0;
        return out;
      }
      try {
        const s = await sampleAvg(info);
        readsUsed += s.reads;
        out.sampled = s.n;
        out.avgBytes = s.avg;
        out.estBytes = Math.round(s.avg * out.count);
      } catch (e: any) {
        out.error = e?.code === 'permission-denied' ? 'size: no access' : 'size: could not sample';
      }
      return out;
    }),
  );
  const totalEstBytes = collections.reduce((s, c) => s + (c.estBytes || 0), 0);
  return { collections, totalEstBytes, readsUsed, at: new Date() };
};

// ── Top users by photos (on demand) ──
export interface TopUser {
  uid: string;
  name: string;
  wardrobe: number;
  posts: number;
  photos: number; // wardrobe items + posts
  estBytes: number; // wardrobe × avg wardrobe item + posts × avg post + their own profile doc
}
export const TOP_USERS_MAX = 300; // user docs read at most (each also costs 2 count reads)

export const getTopUsers = async (
  avgWardrobeBytes: number,
  avgPostBytes: number,
  top = 10,
): Promise<{ users: TopUser[]; scanned: number; readsUsed: number }> => {
  const users: { uid: string; name: string; selfBytes: number }[] = [];
  let last: QueryDocumentSnapshot | null = null;
  try {
    while (users.length < TOP_USERS_MAX) {
      const page = Math.min(100, TOP_USERS_MAX - users.length);
      const q: any = last
        ? query(collection(db, 'users'), orderBy(documentId()), startAfter(last), limit(page))
        : query(collection(db, 'users'), orderBy(documentId()), limit(page));
      const snap: QuerySnapshot = await getDocs(q);
      snap.docs.forEach((d: QueryDocumentSnapshot) => {
        const u: any = d.data() || {};
        users.push({ uid: d.id, name: (u.name || '').trim() || 'Outfit user', selfBytes: estimateDocBytes(`users/${d.id}`, u) });
      });
      if (snap.size < page) break;
      last = snap.docs[snap.docs.length - 1];
    }
  } catch (e: any) {
    throw new Error(firestoreErrorMessage(e, 'Loading users'));
  }
  const rows: TopUser[] = [];
  const BATCH = 10;
  for (let i = 0; i < users.length; i += BATCH) {
    const part = await Promise.all(
      users.slice(i, i + BATCH).map(async u => {
        const [w, p] = await Promise.all([
          getCountFromServer(query(collection(db, 'wardrobe'), where('userId', '==', u.uid)))
            .then(r => r.data().count)
            .catch(() => 0),
          getCountFromServer(query(collection(db, 'posts'), where('userId', '==', u.uid)))
            .then(r => r.data().count)
            .catch(() => 0),
        ]);
        return {
          uid: u.uid,
          name: u.name,
          wardrobe: w,
          posts: p,
          photos: w + p,
          estBytes: Math.round(w * avgWardrobeBytes + p * avgPostBytes + u.selfBytes),
        };
      }),
    );
    rows.push(...part);
  }
  rows.sort((a, b) => b.estBytes - a.estBytes || b.photos - a.photos);
  return { users: rows.slice(0, top), scanned: users.length, readsUsed: users.length + users.length * 2 };
};

// ── This phone ──
export interface LocalCacheInfo {
  keys: number;
  bytes: number; // characters ≈ bytes (UTF-16 on disk can be up to 2×)
  groups: { prefix: string; keys: number; bytes: number }[];
}
const prefixOf = (k: string) => {
  const m = /^([^:.]+[:.][^:.]+)/.exec(k);
  return m ? m[1] : k.split(/[:.]/)[0] || k;
};
export const getLocalCacheInfo = async (): Promise<LocalCacheInfo> => {
  const keys = (await AsyncStorage.getAllKeys()) as string[];
  const groups = new Map<string, { keys: number; bytes: number }>();
  let bytes = 0;
  for (let i = 0; i < keys.length; i += 50) {
    const pairs = await AsyncStorage.multiGet(keys.slice(i, i + 50));
    pairs.forEach(([k, v]) => {
      const b = k.length + (v ? v.length : 0);
      bytes += b;
      const p = prefixOf(k);
      const g = groups.get(p) || { keys: 0, bytes: 0 };
      g.keys += 1;
      g.bytes += b;
      groups.set(p, g);
    });
  }
  return {
    keys: keys.length,
    bytes,
    groups: Array.from(groups.entries())
      .map(([prefix, g]) => ({ prefix, ...g }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8),
  };
};
