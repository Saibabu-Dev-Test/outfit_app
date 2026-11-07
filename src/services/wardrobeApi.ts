// Wardrobe on Firestore collection "wardrobe"; photo is a base64 data URI in each item's imageData (Spark plan, no Storage)
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { BACKEND_IP } from '../config/apiConfig';
import { MAX_BASE64_CHARS } from '../utils/imagePicker';
import { firestoreErrorMessage } from '../utils/firebaseErrors';
import { recordTask } from './rewardsApi';
import { toDate } from '../utils/date';

export interface WardrobeItemPayload {
  userId: number | string;
  name: string;
  category: string;
  subCategory?: string;
  wearType?: string;
  color?: string; // colour name, e.g. "Blue"
  colorHex?: string;
  fabric?: string;
  gender?: string;
  notes?: string;
  isPublic?: boolean; // for a later public feed; default false
  imageUri?: string | null; // base64 data URI (or an existing http/data URL)
}

export interface WardrobeItemResponse {
  id: string;
  userId: string;
  name: string;
  category: string;
  subCategory?: string | null;
  wearType?: string | null;
  color: string | null;
  colorHex?: string | null;
  fabric: string | null;
  gender?: string | null;
  notes?: string | null;
  imageUrl: string | null; // same as imageData, for screens
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
  wearType: d?.wearType ?? null,
  color: d?.color ?? null,
  colorHex: d?.colorHex ?? null,
  fabric: d?.fabric ?? null,
  gender: d?.gender ?? null,
  notes: d?.notes ?? null,
  imageUrl: d?.imageData ?? d?.imageUrl ?? null,
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

// ── Add item ───────────────────────────────────────────────────────────────
export const addWardrobeItem = async (
  payload: WardrobeItemPayload,
): Promise<WardrobeItemResponse> => {
  const uid = String(payload.userId);
  const imageData = checkImage(payload.imageUri);
  const data = {
    userId: uid,
    name: payload.name,
    category: payload.category,
    subCategory: payload.subCategory || null,
    wearType: payload.wearType || null,
    color: payload.color || null,
    colorHex: payload.colorHex || null,
    fabric: payload.fabric || null,
    gender: payload.gender || null,
    notes: payload.notes || null,
    imageData,
    isPublic: payload.isPublic === true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    const r = await addDoc(collection(db, COLL), data);
    recordTask(uid, 'uploaded'); // daily task (never throws)
    const now = new Date().toISOString();
    return { ...toItem(r.id, data), createdAt: now, updatedAt: now };
  } catch (e: any) {
    console.warn('addWardrobeItem failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Saving item'));
  }
};

// ── Items for a user (newest first) ───────────────────────────────────────
export const getWardrobeItems = async (
  userId: number | string,
): Promise<WardrobeItemResponse[]> => {
  try {
    // Only an equality filter, so no composite index is needed; sort here
    const snap = await getDocs(query(collection(db, COLL), where('userId', '==', String(userId))));
    const items = snap.docs.map(d => toItem(d.id, d.data()));
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return items;
  } catch (e: any) {
    console.warn('getWardrobeItems failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Loading wardrobe'));
  }
};

// True if the user added at least one item today (local time). Never throws.
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

// ── Update item ────────────────────────────────────────────────────────────
export const updateWardrobeItem = async (
  itemId: string | number,
  payload: Partial<WardrobeItemPayload>,
): Promise<WardrobeItemResponse> => {
  const id = String(itemId);
  const changes: any = { updatedAt: serverTimestamp() };
  const fields: (keyof WardrobeItemPayload)[] = [
    'name', 'category', 'subCategory', 'wearType', 'color', 'colorHex', 'fabric', 'gender', 'notes',
  ];
  fields.forEach(f => {
    if (payload[f] !== undefined) changes[f] = payload[f] || null;
  });
  if (payload.isPublic !== undefined) changes.isPublic = payload.isPublic;
  if (payload.imageUri) changes.imageData = checkImage(payload.imageUri);
  try {
    const r = doc(db, COLL, id);
    await updateDoc(r, changes);
    const snap = await getDoc(r);
    return toItem(id, snap.data());
  } catch (e: any) {
    console.warn('updateWardrobeItem failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Updating item'));
  }
};

// ── Delete item ────────────────────────────────────────────────────────────
export const deleteWardrobeItem = async (itemId: string | number): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLL, String(itemId)));
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

// Optional AI vision server. Returns null if it is not reachable (4s timeout).
export const analyzeClothingPhoto = async (
  imageUri: string,
): Promise<ClothingAnalysisResult | null> => {
  const uriParts = imageUri.split('.');
  const ext = uriParts[uriParts.length - 1] || 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const url = `http://${BACKEND_IP}:8000/api/vision/analyze-clothing`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      name: `photo_${Date.now()}.${ext}`,
      type: mimeType,
    } as any);
    const res = await fetch(url, { method: 'POST', body: formData, signal: controller.signal });
    if (!res.ok) return null;
    const json = await res.json();
    const analysis = json?.analysis || json;
    return analysis && analysis.category ? (analysis as ClothingAnalysisResult) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
