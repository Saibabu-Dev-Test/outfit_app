// Monthly tasks and coin rewards: one place for every number.
// If you change TASK_COINS or a reward cost, change taskCoins / rewardCost in firestore.rules too.
//
// Tasks (7): progress is counted on the phone from this month's daily task days
// (users/{uid}/days) and coin events (users/{uid}/coinEvents). A finished task is claimed once a
// month for TASK_COINS coins (coin event task_{YYYY-MM}_{taskId}, create-only).
// Rewards (4): redeemed with coins (users.coinsSpent grows by the cost in the same write that
// creates rewardClaims/{uid}_{YYYY-MM}_{rewardId}, status 'pending'); an admin approves or
// rejects (reject refunds the coins). Lifetime coins (and the coin tier) never go down.

export type TaskSource = 'opened' | 'voted' | 'uploaded' | 'fullDay' | 'like' | 'upload' | 'share';

export interface MonthlyTask {
  id: string;
  emoji: string;
  title: string;
  target: number;
  source: TaskSource;
}

export const TASK_COINS = 100;

export const MONTHLY_TASKS: MonthlyTask[] = [
  { id: 'open20', emoji: '📅', title: 'Open Outfit on 20 days', target: 20, source: 'opened' },
  { id: 'vote15', emoji: '🎨', title: "Vote today's colour on 15 days", target: 15, source: 'voted' },
  { id: 'upload10d', emoji: '👗', title: 'Upload a look on 10 days', target: 10, source: 'uploaded' },
  { id: 'full7', emoji: '🔥', title: 'All 3 daily tasks on 7 days', target: 7, source: 'fullDay' },
  { id: 'like30', emoji: '❤️', title: 'Like 30 new photos', target: 30, source: 'like' },
  { id: 'post10', emoji: '📸', title: 'Post 10 photos or polls', target: 10, source: 'upload' },
  { id: 'share3', emoji: '📤', title: 'Share Outfit 3 times', target: 3, source: 'share' },
];

export interface Reward {
  id: string;
  emoji: string;
  title: string;
  description: string;
  cost: number;
}

export const REWARDS: Reward[] = [
  { id: 'badge', emoji: '🎖️', title: 'Style Star badge', description: 'A star badge on your profile for the month', cost: 300 },
  { id: 'spotlight', emoji: '🔦', title: 'Feed spotlight', description: 'Your best look featured at the top of the Feed for a day', cost: 800 },
  { id: 'stylist', emoji: '🤖', title: 'AI stylist plus', description: 'Unlimited AI stylist questions for a month', cost: 1500 },
  { id: 'voucher', emoji: '🎁', title: '₹100 shopping voucher', description: 'Sent to you by the Outfit team after approval', cost: 3000 },
];

export type ClaimStatus = 'pending' | 'approved' | 'rejected';

// Local month key YYYY-MM
export const monthKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// First and last day keys of a month (for the days query)
export const monthDayRange = (month: string): { first: string; last: string } => {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  return { first: `${month}-01`, last: `${month}-${String(days).padStart(2, '0')}` };
};

export type MonthCounts = Record<TaskSource, number>;

export const EMPTY_COUNTS: MonthCounts = { opened: 0, voted: 0, uploaded: 0, fullDay: 0, like: 0, upload: 0, share: 0 };

export const taskProgress = (task: MonthlyTask, counts: Partial<MonthCounts>): { done: number; complete: boolean; pct: number } => {
  const done = Math.max(0, Math.floor(Number(counts[task.source]) || 0));
  return { done: Math.min(done, task.target), complete: done >= task.target, pct: Math.min(1, done / task.target) };
};

export const taskEventId = (month: string, taskId: string) => `task_${month}_${taskId}`;
export const rewardClaimId = (uid: string, month: string, rewardId: string) => `${uid}_${month}_${rewardId}`;

// Coins left to spend
export const coinBalance = (coins: number, spent: number): number =>
  Math.max(0, (Number(coins) || 0) - (Number(spent) || 0));

export const canRedeem = (reward: Reward, coins: number, spent: number): boolean => coinBalance(coins, spent) >= reward.cost;

export const rewardById = (id: string): Reward | undefined => REWARDS.find(r => r.id === id);
