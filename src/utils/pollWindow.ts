// 24-hour polls: circle photo polls take votes for 24 hours after they are posted, then lock
// (firestore.rules checks the same window on circles/{cid}/messages/{mid}/votes). A poll whose
// createdAt is not known yet (just sent, server time pending) counts as open.
export const POLL_VOTE_HOURS = 24;
const WINDOW_MS = POLL_VOTE_HOURS * 60 * 60 * 1000;

export const pollClosesAt = (createdAt: Date | null | undefined): Date | null =>
  createdAt && !isNaN(createdAt.getTime()) ? new Date(createdAt.getTime() + WINDOW_MS) : null;

export const isPollOpen = (createdAt: Date | null | undefined, now: number = Date.now()): boolean => {
  const closes = pollClosesAt(createdAt);
  return !closes || now < closes.getTime();
};

// "23h left" / "45m left" / "" when closed or unknown
export const pollTimeLeft = (createdAt: Date | null | undefined, now: number = Date.now()): string => {
  const closes = pollClosesAt(createdAt);
  if (!closes) return '';
  const ms = closes.getTime() - now;
  if (ms <= 0) return '';
  const h = Math.floor(ms / 3600000);
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.ceil(ms / 60000))}m left`;
};

// Indexes of the leading option(s); [] when nobody voted
export const pollWinners = (counts: number[]): number[] => {
  const max = Math.max(0, ...counts);
  if (!max) return [];
  return counts.map((c, i) => (c === max ? i : -1)).filter(i => i >= 0);
};
