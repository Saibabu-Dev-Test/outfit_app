import { latestTopLevel, mergeComments, replyParentId, replyTotal, threadComments } from '../src/utils/commentThreads';

const c = (id: string, t: number, parentId?: string, replyCount?: number) => ({
  id,
  createdAt: new Date(t * 1000),
  parentId: parentId ?? null,
  replyCount,
});

describe('commentThreads', () => {
  const list = [c('r2', 5, 'a'), c('b', 2), c('a', 1, undefined, 2), c('r1', 3, 'a'), c('x', 4, 'gone'), c('d', 6)];

  it('groups one level of replies under their parent, oldest first', () => {
    const { top, replies, orphans } = threadComments(list);
    expect(top.map(x => x.id)).toEqual(['a', 'b', 'd']);
    expect(replies.a.map(x => x.id)).toEqual(['r1', 'r2']);
    expect(replies.b).toBeUndefined();
    expect(orphans.map(x => x.id)).toEqual(['x']);
  });

  it('previews the latest top-level comments only', () => {
    expect(latestTopLevel(list, 2).map(x => x.id)).toEqual(['b', 'd']);
  });

  it('merges pages by id and keeps a pending (no timestamp) comment last', () => {
    const merged = mergeComments([c('a', 1), c('b', 2)], [{ id: 'new', createdAt: null }, c('b', 2)]);
    expect(merged.map(x => x.id)).toEqual(['a', 'b', 'new']);
  });

  it('replies to a reply attach to the top-level parent', () => {
    expect(replyParentId(c('r1', 3, 'a'))).toBe('a');
    expect(replyParentId(c('a', 1))).toBe('a');
  });

  it('reply totals never go below what is loaded', () => {
    expect(replyTotal(c('a', 1, undefined, 2), 1)).toBe(2);
    expect(replyTotal(c('a', 1), 3)).toBe(3);
  });
});
