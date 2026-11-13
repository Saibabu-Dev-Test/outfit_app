// Wardrobe on Firestore collection "wardrobe" (Spark plan, no Storage: photos are base64 data URIs).
// New items keep a ~200 px thumbnail in imageData (+ media: 1) and the ~1080 px photo in
// wardrobe/{id}/media/full {imageData, userId, updatedAt}, read only when editing / on the detail
// screen. Older items have the full photo in imageData.
// Since the clear-feed pass: also wardrobe/{id}/media/clear {imageData (~720 px, ~45 KB), userId,
// updatedAt} (+ clear: 1 on the item), which the feed card shows full width.
// My items are cached (memory + AsyncStorage) and refreshed with a delta query
// (updatedAt > last sync), so opening Wardrobe / Me / Stylist again costs ~1 read instead of N.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebaseConfig';
import { MAX_BASE64_CHARS } from '../utils/imagePicker';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { recordTask } from './rewardsApi';
import { awardCoins } from './coinsApi';
import { toDate } from '../utils/date';
import { dominantColor, imageLabels } from '../native/wardrobeVision';
import { tagsFromVision } from '../utils/visionTags';

export interface WardrobeItemPayload {
  userId: number | string;
  name: string;
  category: string;
  subCategory?: string;
  subType?: string; // Shoes / Accessories type, e.g. "Sneakers", "Watches"
  wearType?: string;
  color?: string; // colour name, e.g. "Blue"
  colorHex?: string;
  fabric?: string;
  gender?: string;
  notes?: string;
  isPublic?: boolean; // for a later public feed; default false
  imageUri?: string | null; // base64 data URI (or an existing http/data URL): full photo
  imageThumb?: string | null; // ~200 px thumbnail of imageUri (new picker); enables the media doc
  imageClear?: string | null; // ~720 px clear copy for the feed (media/clear); optional
}

export interface WardrobeItemResponse {
  id: string;
  userId: string;
  name: string;
  category: string;
  subCategory?: string | null;
  subType?: string | null;
  wearType?: string | null;
  color: string | null;
  colorHex?: string | null;
  fabric: string | null;
  gender?: string | null;
  notes?: string | null;
  imageUrl: string | null; // imageData: thumbnail on new items (full photo: getWardrobeFullImage)
  hasMedia: boolean; // full photo in wardrobe/{id}/media/full
  hasClear?: boolean; // ~720 px feed photo in wardrobe/{id}/media/clear
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

const COLL = 'wardrobe';


const toItem = (id: string, d: any): WardrobeItemResponse => ({
  id,
  userId: String(d?.userId ?? ''),
  name: d?.name || d?.subCategory || d?.category || 'Item',
  category: d?.category || '',
  subCategory: d?.subCategory ?? null,
  subType: d?.subType ?? null,
  wearType: d?.wearType ?? null,
  color: d?.color ?? null,
  colorHex: d?.colorHex ?? null,
  fabric: d?.fabric ?? null,
  gender: d?.gender ?? null,
  notes: d?.notes ?? null,
  imageUrl: d?.imageData ?? d?.imageUrl ?? null,
  hasMedia: d?.media === 1,
  hasClear: d?.clear === 1,
  isPublic: d?.isPublic === true,
  createdAt: toDate(d?.createdAt)?.toISOString() || '',
  updatedAt: toDate(d?.updatedAt)?.toISOString() || '',
});

// Only data URIs / http URLs can be stored; local file:// paths cannot
const checkImage = (uri?: string | null): string | null => {
  if (!uri) return null;
  if (!/^(data:|https?:)/.test(uri)) {
    throw new Error('Photo could not be read. Please pick the photo again.');
  }
  if (uri.length > MAX_BASE64_CHARS + 100) {
    throw new Error('This photo is too large to save. Please pick a smaller photo.');
  }
  return uri;
};
const MAX_THUMB_CHARS = 40000;
const okThumb = (t?: string | null): t is string => !!t && /^data:image\//.test(t) && t.length <= MAX_THUMB_CHARS;
const mediaRef = (id: string) => doc(db, COLL, id, 'media', 'full');
const clearRef = (id: string) => doc(db, COLL, id, 'media', 'clear');
// Clear feed photo: a WebP / JPEG data URI of at most 56 KB now (CLEAR_SPEC; 80 KB before) with slack
const MAX_CLEAR_CHARS = 160000;
const okClear = (t?: string | null): t is string => !!t && /^data:image\//.test(t) && t.length <= MAX_CLEAR_CHARS;

// ── Cache of my items ──────────────────────────────────────────────────────
// Stored per user: items (light docs), lastSync (ms of the newest updatedAt seen), at (last check)
interface WardrobeCache {
  uid: string;
  items: WardrobeItemResponse[];
  lastSync: number;
  at: number;
}
const CACHE_KEY = (uid: string) => `outfit:wardrobe:${uid}`;
const FRESH_MS = 5 * 60 * 1000;
let mem: WardrobeCache | null = null;

const sortItems = (items: WardrobeItemResponse[]) =>
  items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

const loadCache = async (uid: string): Promise<WardrobeCache | null> => {
  if (mem?.uid === uid) return mem;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY(uid));
    const c = raw ? (JSON.parse(raw) as WardrobeCache) : null;
    if (c && c.uid === uid && Array.isArray(c.items)) {
      mem = c;
      return c;
    }
  } catch {}
  return null;
};
const saveCache = (c: WardrobeCache) => {
  mem = c;
  AsyncStorage.setItem(CACHE_KEY(c.uid), JSON.stringify(c)).catch(() => undefined);
};
// Local edit: keep the cache in step without another read
const patchCache = (uid: string, fn: (items: WardrobeItemResponse[]) => WardrobeItemResponse[]) => {
  if (mem?.uid !== uid) return;
  saveCache({ ...mem, items: sortItems(fn([...mem.items])) });
};
const updatedMs = (d: any) => toDate(d?.updatedAt)?.getTime() || toDate(d?.createdAt)?.getTime() || 0;

// ── Add item ───────────────────────────────────────────────────────────────
export const addWardrobeItem = async (
  payload: WardrobeItemPayload,
): Promise<WardrobeItemResponse> => {
  const uid = String(payload.userId);
  const full = checkImage(payload.imageUri);
  const split = !!full && okThumb(payload.imageThumb);
  const data: any = {
    userId: uid,
    name: payload.name,
    category: payload.category,
    subCategory: payload.subCategory || null,
    subType: payload.subType || null,
    wearType: payload.wearType || null,
    color: payload.color || null,
    colorHex: payload.colorHex || null,
    fabric: payload.fabric || null,
    gender: payload.gender || null,
    notes: payload.notes || null,
    imageData: split ? payload.imageThumb : full,
    isPublic: payload.isPublic === true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (split) data.media = 1;
  const clear = split && okClear(payload.imageClear) ? payload.imageClear : null;
  if (clear) data.clear = 1;
  try {
    const ref = doc(collection(db, COLL));
    const b = writeBatch(db);
    b.set(ref, data);
    if (split) b.set(mediaRef(ref.id), { imageData: full, userId: uid, updatedAt: serverTimestamp() });
    if (clear) b.set(clearRef(ref.id), { imageData: clear, userId: uid, updatedAt: serverTimestamp() });
    await b.commit();
    recordTask(uid, 'uploaded'); // daily task (never throws)
    awardCoins('upload', `wardrobe_${ref.id}`); // coins (fire-and-forget)
    const now = new Date().toISOString();
    const item = { ...toItem(ref.id, data), createdAt: now, updatedAt: now };
    patchCache(uid, items => [item, ...items.filter(i => i.id !== item.id)]);
    return item;
  } catch (e: any) {
    console.warn('addWardrobeItem failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Saving item'));
  }
};

// ── Items for a user (newest first) ───────────────────────────────────────
// Cached: within 5 minutes no read at all; after that only items changed since the last sync are
// read (index wardrobe userId ASC + updatedAt ASC). force = full reload (pull to refresh; also
// catches items deleted on another device). Throws a readable Error when nothing is cached.
export const getWardrobeItems = async (
  userId: number | string,
  opts: { force?: boolean } = {},
): Promise<WardrobeItemResponse[]> => {
  const uid = String(userId);
  const cached = opts.force ? null : await loadCache(uid);
  if (cached && Date.now() - cached.at < FRESH_MS) return [...cached.items];
  try {
    if (cached && cached.lastSync > 0) {
      try {
        const snap = await getDocs(
          query(
            collection(db, COLL),
            where('userId', '==', uid),
            where('updatedAt', '>', Timestamp.fromMillis(cached.lastSync)),
            orderBy('updatedAt', 'asc'),
            limit(200),
          ),
        );
        let lastSync = cached.lastSync;
        const byId = new Map(cached.items.map(i => [i.id, i]));
        snap.docs.forEach(d => {
          const data = d.data();
          byId.set(d.id, toItem(d.id, data));
          lastSync = Math.max(lastSync, updatedMs(data));
        });
        const items = sortItems(Array.from(byId.values()));
        saveCache({ uid, items, lastSync, at: Date.now() });
        return [...items];
      } catch (e: any) {
        // Index not deployed yet: fall through to the full read
        if (e?.code !== 'failed-precondition') throw e;
        console.warn('wardrobe delta index missing, full read:', e?.message);
      }
    }
    // Only an equality filter, so no composite index is needed; sort here
    const snap = await getDocs(query(collection(db, COLL), where('userId', '==', uid)));
    let lastSync = 0;
    const items = sortItems(
      snap.docs.map(d => {
        const data = d.data();
        lastSync = Math.max(lastSync, updatedMs(data));
        return toItem(d.id, data);
      }),
    );
    saveCache({ uid, items, lastSync, at: Date.now() });
    return [...items];
  } catch (e: any) {
    console.warn('getWardrobeItems failed:', e?.code, e?.message);
    if (cached) return [...cached.items]; // offline: show what we have
    throw new Error(firestoreErrorMessage(e, 'Loading wardrobe'));
  }
};

// True if the user added at least one item today (local time). Uses the cache. Never throws.
export const hasUploadedToday = async (userId: string): Promise<boolean> => {
  try {
    const items = await getWardrobeItems(userId);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return items.some(i => {
      const d = i.createdAt ? new Date(i.createdAt) : null;
      return !!d && d.getTime() >= start.getTime();
    });
  } catch {
    return false;
  }
};

// Full-size photo for editing / the detail screen (1 read). Falls back to the thumbnail.
export const getWardrobeFullImage = async (item: Pick<WardrobeItemResponse, 'id' | 'imageUrl' | 'hasMedia'>): Promise<string | null> => {
  if (!item.hasMedia) return item.imageUrl;
  try {
    const s = await getDoc(mediaRef(item.id));
    const full = s.exists() ? (s.data() as any)?.imageData : null;
    return typeof full === 'string' && full ? full : item.imageUrl;
  } catch (e: any) {
    console.warn('wardrobe full photo failed:', e?.code, e?.message);
    return item.imageUrl;
  }
};

// ── Update item ────────────────────────────────────────────────────────────
export const updateWardrobeItem = async (
  itemId: string | number,
  payload: Partial<WardrobeItemPayload>,
): Promise<WardrobeItemResponse> => {
  const id = String(itemId);
  const changes: any = { updatedAt: serverTimestamp() };
  const fields: (keyof WardrobeItemPayload)[] = [
    'name', 'category', 'subCategory', 'subType', 'wearType', 'color', 'colorHex', 'fabric', 'gender', 'notes',
  ];
  fields.forEach(f => {
    if (payload[f] !== undefined) changes[f] = payload[f] || null;
  });
  if (payload.isPublic !== undefined) changes.isPublic = payload.isPublic;
  let full: string | null = null;
  let clear: string | null = null;
  if (payload.imageUri) {
    full = checkImage(payload.imageUri);
    if (full && okThumb(payload.imageThumb)) {
      changes.imageData = payload.imageThumb;
      changes.media = 1;
      clear = okClear(payload.imageClear) ? payload.imageClear : null;
    } else {
      changes.imageData = full;
      changes.media = 0;
      full = null;
    }
    // New photo: the old clear copy no longer matches
    changes.clear = clear ? 1 : 0;
  }
  try {
    const r = doc(db, COLL, id);
    const b = writeBatch(db);
    b.update(r, changes);
    if (full) b.set(mediaRef(id), { imageData: full, userId: String(payload.userId ?? ''), updatedAt: serverTimestamp() });
    if (clear) b.set(clearRef(id), { imageData: clear, userId: String(payload.userId ?? ''), updatedAt: serverTimestamp() });
    await b.commit();
    const snap = await getDoc(r);
    const item = toItem(id, snap.data());
    patchCache(item.userId, items => items.map(i => (i.id === id ? item : i)));
    return item;
  } catch (e: any) {
    console.warn('updateWardrobeItem failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Updating item'));
  }
};

// ── Delete item ────────────────────────────────────────────────────────────
export const deleteWardrobeItem = async (itemId: string | number): Promise<void> => {
  const id = String(itemId);
  try {
    const b = writeBatch(db);
    b.delete(mediaRef(id));
    b.delete(clearRef(id));
    b.delete(doc(db, COLL, id));
    await b.commit();
    if (mem) patchCache(mem.uid, items => items.filter(i => i.id !== id));
  } catch (e: any) {
    console.warn('deleteWardrobeItem failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Deleting item'));
  }
};

export interface ClothingAnalysisResult {
  category: string;
  subCategory: string;
  wearType: string;
  color: string;
  colorName: string;
  fabric: string;
  name: string;
  confidence: number;
}

// Auto-fill for a new item's photo, on the phone: ML Kit Image Labeling (labels -> category) +
// the photo's main colour (utils/visionTags). null when nothing useful was found or the model is
// not available (the user picks the category and colour). The old plain-http vision server stays
// switched off.
export const analyzeClothingPhoto = async (imageUri: string): Promise<ClothingAnalysisResult | null> => {
  try {
    if (!imageUri || /^data:/i.test(imageUri)) return null;
    const [labels, hex] = await Promise.all([imageLabels(imageUri), dominantColor(imageUri)]);
    return tagsFromVision(labels, hex);
  } catch {
    return null;
  }
};

// ── Old one-time clean-up of separate feed copies (build 94): switched off in build 115 ─────
// Since the "near original" pass the full photo is up to 2048 px / 690 KB and is read only when a
// photo is opened, so the ~1080 px clear copy (media/clear) is what feed cards show again. Deleting
// clear copies would make the feed load the big photos, so this is now a no-op (kept so older
// callers still compile).
export const compactMyClearCopies = async (_uid?: string | null): Promise<number> => 0;
