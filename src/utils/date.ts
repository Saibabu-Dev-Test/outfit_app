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
