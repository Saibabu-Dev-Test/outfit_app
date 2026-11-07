// Local calendar date as YYYY-MM-DD (toISOString is UTC and gives the wrong day in IST before 5:30 AM)
export const localDateKey = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const yesterdayKey = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateKey(d);
};

export const greetingForNow = (d: Date = new Date()): string => {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
};

// Firestore Timestamp | Date | string | number -> Date | null
export const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

// "now", "5m", "3h", "2d", then a short date
export const timeAgo = (v: any): string => {
  const d = toDate(v);
  if (!d) return '';
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (secs < 60) return 'now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  if (secs < 7 * 86400) return `${Math.floor(secs / 86400)}d`;
  return d.toLocaleDateString();
};

// "14:05" for chat bubbles
export const clockTime = (v: any): string => {
  const d = toDate(v);
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
