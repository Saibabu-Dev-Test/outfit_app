// Pure helpers for the admin Storage panel (no Firebase imports, easy to test).
// Firestore bills stored bytes per document roughly as: document name + 32, plus for each field its
// name length + 1 and its value size (string: UTF-8 bytes + 1, number: 8, boolean / null: 1,
// timestamp: 8, map / array: sum of entries). See firebase.google.com/docs/firestore/storage-size.
// Index entries are NOT included, so real usage is somewhat higher; the panel labels this.

export const GIB = 1024 * 1024 * 1024;

// Spark (free) plan quotas for Cloud Firestore
export const FREE_TIER = {
  storageBytes: GIB, // 1 GiB stored data
  readsPerDay: 50000,
  writesPerDay: 20000,
  deletesPerDay: 20000,
} as const;

const utf8Len = (s: string): number => {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
};

export const valueBytes = (v: any): number => {
  if (v === null || v === undefined || typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 8;
  if (typeof v === 'string') return utf8Len(v) + 1;
  if (v instanceof Date || typeof v?.toDate === 'function' || typeof v?.toMillis === 'function') return 8;
  if (Array.isArray(v)) return v.reduce((s, x) => s + valueBytes(x), 0);
  if (typeof v === 'object') {
    if (typeof v.latitude === 'number' && typeof v.longitude === 'number') return 16; // GeoPoint
    return Object.keys(v).reduce((s, k) => s + utf8Len(k) + 1 + valueBytes(v[k]), 0);
  }
  return 8;
};

/** Estimated stored size of one document (path like 'wardrobe/abc'), excluding indexes */
export const estimateDocBytes = (path: string, data: Record<string, any> | null | undefined): number => {
  const name = path.split('/').reduce((s, seg) => s + utf8Len(seg) + 1, 16);
  return name + 32 + valueBytes(data || {});
};

export const average = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** 0..100, rounded to 1 decimal, never NaN */
export const percentOf = (used: number, limit: number): number =>
  limit > 0 && Number.isFinite(used) ? Math.round((Math.max(0, used) / limit) * 1000) / 10 : 0;

/** 1536 -> '1.5 KB', 3.2e6 -> '3.1 MB' (binary units) */
export const formatBytes = (n: number | null | undefined): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let v = Math.max(0, n);
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${i === 0 ? Math.round(v) : v.toFixed(v < 10 ? 2 : 1)} ${u[i]}`;
};
