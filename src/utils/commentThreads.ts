// One-level (Instagram style) comment threading helpers. Pure functions, no Firebase.
// A reply has parentId = a top-level comment's id; replies to replies are re-pointed at the
// top-level parent by the caller (see replyParentId).

export interface ThreadComment {
  id: string;
  parentId?: string | null;
  replyCount?: number;
  createdAt: Date | null;
}

const time = (c: ThreadComment) => (c.createdAt ? c.createdAt.getTime() : Number.MAX_SAFE_INTEGER);
const byTime = (a: ThreadComment, b: ThreadComment) => time(a) - time(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Merge two lists by id (later list wins), oldest first
export function mergeComments<T extends ThreadComment>(a: T[], b: T[]): T[] {
  const m = new Map<string, T>();
  a.forEach(c => m.set(c.id, c));
  b.forEach(c => m.set(c.id, c));
  return [...m.values()].sort(byTime);
}

// Top-level comments (oldest first) + replies grouped under their parent (oldest first).
// A reply whose parent is not in the list is kept in `orphans` (never shown as top level).
export function threadComments<T extends ThreadComment>(
  list: T[],
): { top: T[]; replies: Record<string, T[]>; orphans: T[] } {
  const sorted = [...list].sort(byTime);
  const top = sorted.filter(c => !c.parentId);
  const ids = new Set(top.map(c => c.id));
  const replies: Record<string, T[]> = {};
  const orphans: T[] = [];
  sorted
    .filter(c => !!c.parentId)
    .forEach(c => {
      const p = c.parentId as string;
      if (!ids.has(p)) {
        orphans.push(c);
        return;
      }
      (replies[p] = replies[p] || []).push(c);
    });
  return { top, replies, orphans };
}

// The latest `n` top-level comments, oldest first (feed card preview)
export function latestTopLevel<T extends ThreadComment>(list: T[], n = 2): T[] {
  return threadComments(list).top.slice(-n);
}

// Replying to a reply attaches to that reply's parent (one level only)
export function replyParentId(c: ThreadComment): string {
  return c.parentId || c.id;
}

// "View N replies": the larger of the stored count and what is loaded
export function replyTotal(parent: ThreadComment, loaded: number): number {
  return Math.max(Number(parent.replyCount) || 0, loaded);
}
