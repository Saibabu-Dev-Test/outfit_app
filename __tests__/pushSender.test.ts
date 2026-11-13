import { LIKE_LEVELS as TS_LEVELS } from '../src/config/likeLevels';
import { isPollOpen, pollTimeLeft, pollWinners } from '../src/utils/pollWindow';
import { isSenderLive, tokenDocId } from '../src/services/pushApi';
const { LIKE_LEVELS, groupByOwner, messagesFor, isDeadToken } = require('../scripts/push/lib');

describe('push sender helpers', () => {
  it('like levels match the app', () => {
    expect(LIKE_LEVELS.map((l: any) => [l.level, l.min])).toEqual(TS_LEVELS.map(l => [l.level, l.min]));
  });
  it('groups activity per owner and counts distinct likers', () => {
    const g = groupByOwner([
      { owner: 'u1', type: 'like', actorId: 'a' },
      { owner: 'u1', type: 'like', actorId: 'a' },
      { owner: 'u1', type: 'like', actorId: 'b' },
      { owner: 'u1', type: 'comment', actorId: 'c', actorName: 'Ravi' },
      { owner: 'u2', type: 'follow', actorId: 'd' },
      { owner: null, type: 'like' },
    ]);
    expect(g.size).toBe(2);
    expect(g.get('u1').likes).toBe(3);
    expect(g.get('u1').likers.size).toBe(2);
  });
  it('builds a coin-level like push with the coin flip payload, plus one summary', () => {
    const g = groupByOwner([
      { owner: 'u1', type: 'like', actorId: 'a' },
      { owner: 'u1', type: 'like', actorId: 'b' },
      { owner: 'u1', type: 'comment', actorId: 'c', actorName: 'Ravi' },
    ]).get('u1');
    const m = messagesFor(g, 5000);
    expect(m[0].title).toContain('Gold');
    expect(m[0].body).toContain('2 people');
    expect(JSON.parse(m[0].payload)).toEqual({ t: 'coinRain', level: 'gold', count: 2 });
    expect(m[1].body).toBe('Ravi: 1 new comment');
    expect(m[1].payload).toBeNull();
  });
  it('dead token codes', () => {
    expect(isDeadToken('messaging/registration-token-not-registered')).toBe(true);
    expect(isDeadToken('messaging/internal-error')).toBe(false);
  });
  it('sender heartbeat and token ids', () => {
    const now = 1_000_000_000;
    expect(isSenderLive(now - 60 * 60 * 1000, now)).toBe(true);
    expect(isSenderLive(now - 3 * 60 * 60 * 1000, now)).toBe(false);
    expect(isSenderLive(null, now)).toBe(false);
    expect(tokenDocId('abc')).toMatch(/^t_[a-z0-9]{1,40}$/);
    expect(tokenDocId('abc')).toBe(tokenDocId('abc'));
    expect(tokenDocId('abc')).not.toBe(tokenDocId('abd'));
  });
});

describe('24-hour polls', () => {
  const created = new Date(2026, 10, 12, 10, 0, 0);
  it('open for 24 h, then locked', () => {
    expect(isPollOpen(created, created.getTime() + 23 * 3600000)).toBe(true);
    expect(isPollOpen(created, created.getTime() + 24 * 3600000)).toBe(false);
    expect(isPollOpen(null)).toBe(true);
  });
  it('time left and winners', () => {
    expect(pollTimeLeft(created, created.getTime() + 2 * 3600000)).toBe('22h left');
    expect(pollTimeLeft(created, created.getTime() + 23.5 * 3600000)).toBe('30m left');
    expect(pollTimeLeft(created, created.getTime() + 25 * 3600000)).toBe('');
    expect(pollWinners([3, 5, 5])).toEqual([1, 2]);
    expect(pollWinners([0, 0])).toEqual([]);
  });
});
