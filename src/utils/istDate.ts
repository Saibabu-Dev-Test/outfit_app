// India Standard Time (Asia/Kolkata, UTC+05:30, no daylight saving) date keys, independent of the
// phone's own timezone. The Earn daily gate resets at 00:00 IST.
const IST_OFFSET_MS = 330 * 60 * 1000;

// 'YYYY-MM-DD' of the IST calendar day containing `d`
export const istDateKey = (d: Date | number = new Date()): string => {
  const t = (typeof d === 'number' ? d : d.getTime()) + IST_OFFSET_MS;
  const x = new Date(t);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, '0');
  const day = String(x.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Milliseconds until the next 00:00 IST
export const msUntilIstMidnight = (now: Date | number = new Date()): number => {
  const t = (typeof now === 'number' ? now : now.getTime()) + IST_OFFSET_MS;
  const dayMs = 86400000;
  return dayMs - (t % dayMs);
};
