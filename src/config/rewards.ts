// Monthly tasks, coins and the reward catalog: ALL values in this one file.
//
// Business note: rewards (clothes, gift vouchers) must be paid for from AdMob income. Keep the
// coin prices high enough that the ads a user watches to earn them pay for the reward, and change
// them here whenever ad income changes. Redemptions are only requests (status 'pending'): an admin
// approves / rejects each one in Admin > Rewards before anything is bought.
//
// firestore.rules mirrors TASK_TARGETS / TASK_COINS / REWARD_COINS (functions monthlyTask* and
// rewardCoins). If you change a number here, change it there too (the rules reject claims that do
// not match, so a mismatch only blocks claims, it never gives free coins).

export type MonthlyTaskId = 'polls' | 'votes' | 'wardrobe' | 'openDays' | 'adsWatched' | 'invites';

export interface MonthlyTask {
  id: MonthlyTaskId;
  title: string;
  target: number;
  coins: number;
  emoji: string;
}

export const MONTHLY_TASKS: MonthlyTask[] = [
  { id: 'polls', title: 'Post 5 outfit polls', target: 5, coins: 50, emoji: '🗳️' },
  { id: 'votes', title: 'Vote on 30 outfits', target: 30, coins: 50, emoji: '👍' },
  { id: 'wardrobe', title: 'Add 10 wardrobe items', target: 10, coins: 40, emoji: '👗' },
  { id: 'openDays', title: 'Open the app on 15 days', target: 15, coins: 60, emoji: '📅' },
  { id: 'adsWatched', title: 'Watch 10 reward videos', target: 10, coins: 50, emoji: '▶️' },
  { id: 'invites', title: 'Invite a friend who joins', target: 1, coins: 100, emoji: '🤝' },
];

// "Double your coins" after claiming a task (one rewarded-interstitial ad, once per task per month)
export const DOUBLE_COINS_ENABLED = true;

export interface RewardItem {
  id: string;
  title: string;
  detail: string;
  coins: number;
  emoji: string;
}

export const REWARD_CATALOG: RewardItem[] = [
  { id: 'amazon100', title: 'Amazon gift voucher ₹100', detail: 'Sent by email after approval', coins: 2000, emoji: '🎁' },
  { id: 'amazon250', title: 'Amazon gift voucher ₹250', detail: 'Sent by email after approval', coins: 4500, emoji: '🎁' },
  { id: 'shirt499', title: 'Shirt (up to ₹499)', detail: 'You pick, we order it to you', coins: 8000, emoji: '👔' },
  { id: 'dress799', title: 'Dress / kurti (up to ₹799)', detail: 'You pick, we order it to you', coins: 12000, emoji: '👗' },
];

export const taskById = (id: string) => MONTHLY_TASKS.find(t => t.id === id);
export const rewardById = (id: string) => REWARD_CATALOG.find(r => r.id === id);
