import {
  MONTHLY_TASKS,
  REWARDS,
  TASK_COINS,
  canRedeem,
  coinBalance,
  monthDayRange,
  monthKey,
  rewardClaimId,
  taskEventId,
  taskProgress,
} from '../src/config/monthlyTasks';

describe('monthly tasks and rewards', () => {
  it('has 7 tasks and 4 rewards with fixed numbers (must match firestore.rules)', () => {
    expect(MONTHLY_TASKS).toHaveLength(7);
    expect(REWARDS).toHaveLength(4);
    expect(TASK_COINS).toBe(100);
    expect(REWARDS.map(r => [r.id, r.cost])).toEqual([
      ['badge', 300],
      ['spotlight', 800],
      ['stylist', 1500],
      ['voucher', 3000],
    ]);
    expect(new Set(MONTHLY_TASKS.map(t => t.id)).size).toBe(7);
  });
  it('month keys and ranges', () => {
    expect(monthKey(new Date(2026, 10, 12))).toBe('2026-11');
    expect(monthDayRange('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' });
    expect(monthDayRange('2028-02').last).toBe('2028-02-29');
  });
  it('progress', () => {
    const vote = MONTHLY_TASKS.find(t => t.id === 'vote15')!;
    expect(taskProgress(vote, { voted: 3 })).toEqual({ done: 3, complete: false, pct: 0.2 });
    expect(taskProgress(vote, { voted: 20 }).complete).toBe(true);
    expect(taskProgress(vote, {}).done).toBe(0);
  });
  it('ids (rules use the same shapes)', () => {
    expect(taskEventId('2026-11', 'vote15')).toBe('task_2026-11_vote15');
    expect(taskEventId('2026-11', 'vote15')).toMatch(/^task_[0-9]{4}-[0-9]{2}_[A-Za-z0-9]{1,20}$/);
    expect(rewardClaimId('abc', '2026-11', 'badge')).toBe('abc_2026-11_badge');
  });
  it('balance and redeem', () => {
    expect(coinBalance(1000, 300)).toBe(700);
    expect(coinBalance(100, 300)).toBe(0);
    expect(canRedeem(REWARDS[0], 300, 0)).toBe(true);
    expect(canRedeem(REWARDS[0], 500, 300)).toBe(false);
  });
});
