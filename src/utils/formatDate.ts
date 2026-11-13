// One place for how dates are SHOWN to users: DD-MM-YYYY (e.g. "23-11-1995").
// Storage stays ISO 'YYYY-MM-DD' in Firestore; these helpers only change display and parse input.
// Pure (no RN / Firebase imports) so it is easy to test.

const pad2 = (n: number) => String(n).padStart(2, '0');
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/;

const asDate = (v: any): Date | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v?.toDate === 'function') return v.toDate(); // Firestore Timestamp
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/**
 * Any date -> 'DD-MM-YYYY'.
 * - ISO string 'YYYY-MM-DD' (or an ISO datetime) is reformatted as-is, with no timezone shift,
 *   so a stored DOB '1995-11-23' always shows '23-11-1995'.
 * - Date / Firestore Timestamp / epoch ms use the device's local calendar day.
 * Returns '' for missing or invalid input.
 */
export const formatDate = (v: any): string => {
  if (typeof v === 'string') {
    const s = v.trim();
    const m = ISO_RE.exec(s);
    if (m && s.length <= 10) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s; // already DD-MM-YYYY
    if (m) {
      // full ISO datetime: show the local day
      const d = new Date(s);
      if (!isNaN(d.getTime())) return formatDate(d);
      return `${m[3]}-${m[2]}-${m[1]}`;
    }
    return '';
  }
  const d = asDate(v);
  if (!d) return '';
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
};

/** Day and month only, for birthdays shown without the year: 'MM-DD' (stored md) or ISO -> 'DD-MM' */
export const formatDayMonth = (v: any): string => {
  if (typeof v === 'string') {
    const md = /^(\d{2})-(\d{2})$/.exec(v.trim());
    if (md) return `${md[2]}-${md[1]}`;
  }
  const full = formatDate(v);
  return full ? full.slice(0, 5) : '';
};

/** 'DD-MM-YYYY' or 'DD/MM/YYYY' or 'D.M.YYYY' typed by a user -> ISO 'YYYY-MM-DD' (null if not a real date) */
export const parseDisplayDate = (input: string | null | undefined): string | null => {
  const s = (input || '').trim();
  let y: number, mo: number, d: number;
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (dmy) {
    d = Number(dmy[1]);
    mo = Number(dmy[2]);
    y = Number(dmy[3]);
  } else if (iso) {
    y = Number(iso[1]);
    mo = Number(iso[2]);
    d = Number(iso[3]);
  } else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad2(mo)}-${pad2(d)}`;
};

/** Month key 'YYYY-MM' -> 'MM-YYYY' (same day-month-year order as formatDate) */
export const formatMonth = (ym: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})$/.exec((ym || '').trim());
  return m ? `${m[2]}-${m[1]}` : ym || '';
};
