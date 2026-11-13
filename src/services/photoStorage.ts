// Pluggable photo storage with automatic free-tier fallback (chain + limits in config/storage.ts).
//
//   pickProvider(media)  -> the provider new uploads go to right now
//   placePhoto(dataUri)  -> { provider: 'firebase', inline: dataUri }  (save inline as before)
//                         | { provider, url }                        (save the URL + provider)
//   recordUpload(...)    -> stats/storage/providers/{id} {bytesUsed, fileCount, lastUpload, days}
//
// Firebase stays first. When its counter reaches SWITCH_AT (95%) of the free limit, or a Firestore
// write fails with resource-exhausted (markFull), new uploads continue on the next configured
// provider. Old photos are never moved or deleted. Never throws for stats; placePhoto throws only
// when every provider failed (the caller shows the error).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDocs, increment, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { CHAIN, MediaType, ProviderConfig, ProviderId, SWITCH_AT, isConfigured } from '../config/storage';
import { localDateKey } from '../utils/date';

export interface ProviderStats {
  bytesUsed: number;
  fileCount: number;
  lastUpload: Date | null;
  full: boolean;
  days: Record<string, number>; // 'YYYY-MM-DD' -> bytes uploaded that day (last ~30 days)
}

const STATS_COL = () => collection(db, 'stats', 'storage', 'providers');
const statsRef = (id: ProviderId) => doc(db, 'stats', 'storage', 'providers', id);
const FULL_KEY = 'storage.full.v1';

let statsCache: { at: number; data: Record<string, ProviderStats> } | null = null;
let localFull: Record<string, boolean> | null = null;

const loadLocalFull = async () => {
  if (localFull) return localFull;
  try {
    localFull = JSON.parse((await AsyncStorage.getItem(FULL_KEY)) || '{}') || {};
  } catch {
    localFull = {};
  }
  return localFull!;
};

const toStats = (d: any): ProviderStats => ({
  bytesUsed: typeof d?.bytesUsed === 'number' ? d.bytesUsed : 0,
  fileCount: typeof d?.fileCount === 'number' ? d.fileCount : 0,
  lastUpload: d?.lastUpload?.toDate ? d.lastUpload.toDate() : null,
  full: d?.full === true,
  days: d?.days && typeof d.days === 'object' ? d.days : {},
});

export const getStorageStats = async (maxAgeMs = 10 * 60 * 1000): Promise<Record<string, ProviderStats>> => {
  if (statsCache && Date.now() - statsCache.at < maxAgeMs) return statsCache.data;
  const data: Record<string, ProviderStats> = {};
  try {
    const snap = await getDocs(STATS_COL());
    snap.docs.forEach(d => (data[d.id] = toStats(d.data())));
  } catch (e: any) {
    console.warn('storage stats failed:', e?.code, e?.message);
  }
  statsCache = { at: Date.now(), data };
  return data;
};

export type ProviderStatus = 'active' | 'standby' | 'full' | 'needs setup';

export const providerStatus = (
  p: ProviderConfig,
  s: ProviderStats | undefined,
  activeId: ProviderId | null,
): ProviderStatus => {
  if (!isConfigured(p)) return 'needs setup';
  if (s?.full || (s && s.bytesUsed >= p.freeBytes * SWITCH_AT)) return 'full';
  return p.id === activeId ? 'active' : 'standby';
};

// The provider new uploads go to right now (null: everything is full / not configured)
export const pickProvider = async (media: MediaType = 'image', stats?: Record<string, ProviderStats>): Promise<ProviderConfig | null> => {
  const st = stats || (await getStorageStats());
  const lf = await loadLocalFull();
  for (const p of CHAIN) {
    if (!isConfigured(p) || !p.media.includes(media)) continue;
    const s = st[p.id];
    if (lf[p.id] || s?.full) continue;
    if (s && s.bytesUsed >= p.freeBytes * SWITCH_AT) continue;
    return p;
  }
  return null;
};

// A provider said "quota exceeded": skip it from now on (this phone + shared stats doc)
export const markFull = async (id: ProviderId): Promise<void> => {
  try {
    const lf = await loadLocalFull();
    lf[id] = true;
    await AsyncStorage.setItem(FULL_KEY, JSON.stringify(lf));
    statsCache = null;
    await setDoc(statsRef(id), { full: true, fullAt: serverTimestamp() }, { merge: true });
  } catch {}
};

export const isQuotaError = (e: any): boolean =>
  /resource-exhausted|quota|limit exceeded|storage limit|insufficient storage|413|402/i.test(
    `${e?.code || ''} ${e?.message || ''} ${e?.status || ''}`,
  );

// Approximate decoded size of a base64 data URI
export const dataUriBytes = (uri: string): number => {
  const i = uri.indexOf(',');
  const b64 = i >= 0 ? uri.length - i - 1 : uri.length;
  return Math.round((b64 * 3) / 4);
};

// +bytes on the provider's counter (and today's daily total, for the "switches in ~N days" estimate)
export const recordUpload = async (id: ProviderId, bytes: number, files = 1): Promise<void> => {
  try {
    await setDoc(
      statsRef(id),
      {
        bytesUsed: increment(Math.max(0, Math.round(bytes))),
        fileCount: increment(files),
        lastUpload: serverTimestamp(),
        days: { [localDateKey()]: increment(Math.max(0, Math.round(bytes))) },
      },
      { merge: true },
    );
    statsCache = null;
  } catch (e: any) {
    console.warn('storage usage update failed:', e?.code, e?.message);
  }
};

// ── Adapters (public config only) ──
const dataUriParts = (uri: string) => {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(uri);
  return m ? { mime: m[1], b64: m[2] } : null;
};
const extOf = (mime: string) => (mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg');
const fileName = (prefix: string, mime: string) =>
  `${prefix}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extOf(mime)}`;

const fetchJson = async (url: string, init: RequestInit): Promise<any> => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal });
    const text = await r.text();
    let body: any = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
    if (!r.ok) {
      const err: any = new Error(body?.error?.message || body?.message || body?.raw || `HTTP ${r.status}`);
      err.status = r.status;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(t);
  }
};

const uploadCloudinary = async (p: ProviderConfig, dataUri: string, folder: string): Promise<string> => {
  const form = new FormData();
  form.append('file', dataUri);
  form.append('upload_preset', p.config.uploadPreset);
  form.append('folder', `${p.config.folder || 'outfit'}/${folder}`);
  const res = await fetchJson(`https://api.cloudinary.com/v1_1/${encodeURIComponent(p.config.cloudName)}/image/upload`, {
    method: 'POST',
    body: form as any,
  });
  if (!res?.secure_url) throw new Error('Cloudinary did not return a URL');
  return res.secure_url;
};

const uploadSupabase = async (p: ProviderConfig, dataUri: string, folder: string): Promise<string> => {
  const parts = dataUriParts(dataUri);
  if (!parts) throw new Error('Bad photo');
  const path = fileName(folder, parts.mime);
  const base = p.config.url.replace(/\/$/, '');
  const blob = await (await fetch(dataUri)).blob();
  await fetchJson(`${base}/storage/v1/object/${p.config.bucket}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${p.config.anonKey}`, apikey: p.config.anonKey, 'Content-Type': parts.mime },
    body: blob as any,
  });
  return `${base}/storage/v1/object/public/${p.config.bucket}/${path}`;
};

const uploadAppwrite = async (p: ProviderConfig, dataUri: string, folder: string): Promise<string> => {
  const parts = dataUriParts(dataUri);
  if (!parts) throw new Error('Bad photo');
  const endpoint = p.config.endpoint.replace(/\/$/, '');
  const id = `f${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const form = new FormData();
  form.append('fileId', id);
  form.append('file', { uri: dataUri, name: fileName(folder, parts.mime).split('/').pop(), type: parts.mime } as any);
  await fetchJson(`${endpoint}/storage/buckets/${p.config.bucketId}/files`, {
    method: 'POST',
    headers: { 'X-Appwrite-Project': p.config.projectId },
    body: form as any,
  });
  return `${endpoint}/storage/buckets/${p.config.bucketId}/files/${id}/view?project=${p.config.projectId}`;
};

const uploadImgbb = async (p: ProviderConfig, dataUri: string): Promise<string> => {
  const parts = dataUriParts(dataUri);
  if (!parts) throw new Error('Bad photo');
  const form = new FormData();
  form.append('image', parts.b64);
  const res = await fetchJson(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(p.config.apiKey)}`, {
    method: 'POST',
    body: form as any,
  });
  const url = res?.data?.url || res?.data?.display_url;
  if (!url) throw new Error('ImgBB did not return a URL');
  return url;
};

const uploadTo = (p: ProviderConfig, dataUri: string, folder: string): Promise<string> => {
  switch (p.id) {
    case 'cloudinary':
      return uploadCloudinary(p, dataUri, folder);
    case 'supabase':
      return uploadSupabase(p, dataUri, folder);
    case 'appwrite':
      return uploadAppwrite(p, dataUri, folder);
    case 'imgbb':
      return uploadImgbb(p, dataUri);
    default:
      return Promise.reject(new Error(`${p.name} needs setup`));
  }
};

export type Placed = { provider: 'firebase'; inline: string } | { provider: ProviderId; url: string };

// Where this new photo goes. Firebase -> keep it inline (the caller writes it to Firestore as before
// and calls recordUpload('firebase', ...) after the write). Others -> uploaded here, usage recorded.
export const placePhoto = async (dataUri: string, folder: 'wardrobe' | 'posts' | 'circles'): Promise<Placed> => {
  const stats = await getStorageStats();
  let lastErr: any = null;
  const tried = new Set<string>();
  for (let i = 0; i < CHAIN.length; i++) {
    const p = await pickProvider('image', stats);
    if (!p || tried.has(p.id)) break;
    tried.add(p.id);
    if (p.id === 'firebase') return { provider: 'firebase', inline: dataUri };
    try {
      const url = await uploadTo(p, dataUri, folder);
      recordUpload(p.id, dataUriBytes(dataUri));
      return { provider: p.id, url };
    } catch (e: any) {
      lastErr = e;
      console.warn(`upload to ${p.id} failed:`, e?.message);
      if (isQuotaError(e)) {
        await markFull(p.id);
        stats[p.id] = { ...(stats[p.id] || toStats({})), full: true };
        continue;
      }
      throw new Error('Could not upload the photo. Please check your internet and try again.');
    }
  }
  throw new Error(lastErr?.message ? `Photo storage is full: ${lastErr.message}` : 'Photo storage is full. Please try again later.');
};

// Estimate for Admin > Storage: average bytes/day over the last 14 days with uploads
export const dailyRate = (s: ProviderStats | undefined): number => {
  if (!s) return 0;
  const today = new Date();
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    sum += s.days[localDateKey(d)] || 0;
  }
  return sum / 14;
};

