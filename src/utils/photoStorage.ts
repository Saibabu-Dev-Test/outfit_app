// Photo storage sizes. Photos are kept as base64 data URIs in Firestore (Spark plan, no Cloud
// Storage): each wardrobe photo is a thumbnail (item doc) + full photo (media/full) + optional
// clear feed copy (media/clear). These helpers say how much a batch will take, so Quick add can
// show it and skip anything that would not fit in a Firestore document (1 MiB).

export const FIRESTORE_DOC_LIMIT = 1048576; // bytes
const DOC_SLACK = 4096; // other fields in the same doc

// Bytes a base64 data URI takes as a string in Firestore (1 byte per character)
export const storedChars = (uri?: string | null): number => (uri ? uri.length : 0);

// Bytes of the decoded image (what the photo itself weighs)
export const imageBytes = (uri?: string | null): number => {
  if (!uri) return 0;
  const i = uri.indexOf('base64,');
  if (i < 0) return 0;
  const b64 = uri.slice(i + 7);
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
};

export interface StoredPhoto {
  dataUri: string;
  thumbUri?: string;
  clearUri?: string;
}

// Firestore bytes one picked photo will use (all its copies)
export const photoStoredBytes = (p: StoredPhoto): number => storedChars(p.dataUri) + storedChars(p.thumbUri) + storedChars(p.clearUri);

export const batchStoredBytes = (list: StoredPhoto[]): number => list.reduce((s, p) => s + photoStoredBytes(p), 0);

// Every copy fits in its own document
export const fitsInFirestore = (p: StoredPhoto): boolean =>
  [p.dataUri, p.thumbUri, p.clearUri].every(u => storedChars(u) <= FIRESTORE_DOC_LIMIT - DOC_SLACK);

export const formatBytes = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return '0 KB';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};
