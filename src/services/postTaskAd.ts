// One ad after a completed Earn task (pure logic, no Firebase / ads SDK; used by EarnWallScreen).
//
// Owner revenue only: the post-task ad NEVER gives the user coins (it is not recorded in the earn
// ledger). It is never shown when a wall opens, so nothing stands between the user and a task.
// When the user leaves a partner wall (Done / back / header arrow):
//   1. at most one full-screen ad per POST_TASK_AD_MIN_GAP_MS (2 min), counting rewarded ads too;
//   2. a new task credit for this user since the wall opened (a survey / offer entry in their
//      earnings ledger the wall didn't have when it opened, or the wall's own in-page reward
//      message) -> show one ad;
//   3. no completion seen (postbacks not deployed yet / late) -> show one ad only when the user
//      spent at least POST_TASK_AD_MIN_WALL_MS (60 s) in the wall;
//   4. one decision per close, so never more than one ad per close.
import { POST_TASK_AD_MIN_GAP_MS, POST_TASK_AD_MIN_WALL_MS } from '../config/ads';
import type { EarnEntry } from './earnLedger';

export type PostTaskAdReason = 'completion' | 'time_in_wall' | 'capped' | 'too_short';

// Ledger entries that come from a partner task (not app coins like ads, votes, check-ins)
const isTaskCredit = (e: EarnEntry) => (e.type === 'survey' || e.type === 'offer') && e.status !== 'reversed';

export const taskCreditIds = (entries: EarnEntry[]): Set<string> => new Set(entries.filter(isTaskCredit).map(e => e.id));

// Was a task credited since the wall opened? `before` = task credit ids when the wall opened (null
// when that read failed: then only entries created after openedAt count).
export const hasNewTaskCredit = ({
  before,
  after,
  openedAt,
}: {
  before: Set<string> | null;
  after: EarnEntry[];
  openedAt: number;
}): boolean =>
  after.some(e => {
    if (!isTaskCredit(e)) return false;
    if (before) return !before.has(e.id);
    return !!e.createdAt && e.createdAt.getTime() >= openedAt;
  });

// Partner walls may post a message to the page host when a reward is earned. Recognised only when
// it clearly says so (an event / type / name of reward / complete / conversion); anything else is
// ignored.
const REWARD_EVENT = /^(reward(ed)?|on_?reward|survey_?(complete|completed)|offer_?(complete|completed)|task_?(complete|completed)|conversion|complete|completed)$/i;
export const isPartnerRewardMessage = (data: unknown): boolean => {
  let v: any = data;
  if (typeof v === 'string') {
    const t = v.trim();
    if (REWARD_EVENT.test(t)) return true;
    try {
      v = JSON.parse(t);
    } catch {
      return false;
    }
  }
  if (!v || typeof v !== 'object') return false;
  return ['event', 'type', 'name', 'action'].some(k => typeof v[k] === 'string' && REWARD_EVENT.test(v[k].trim()));
};

export interface PostTaskAdInput {
  openedAt: number; // ms, when the wall opened
  closedAt: number; // ms, when the user left it
  completed: boolean; // a task completion / credit was seen (step 2)
  lastAdAt: number; // ms, last full-screen ad (0 = none)
}

export const postTaskAdDecision = ({ openedAt, closedAt, completed, lastAdAt }: PostTaskAdInput): { show: boolean; reason: PostTaskAdReason } => {
  if (lastAdAt > 0 && closedAt - lastAdAt < POST_TASK_AD_MIN_GAP_MS) return { show: false, reason: 'capped' };
  if (completed) return { show: true, reason: 'completion' };
  if (closedAt - openedAt >= POST_TASK_AD_MIN_WALL_MS) return { show: true, reason: 'time_in_wall' };
  return { show: false, reason: 'too_short' };
};

// The completion check needs a network read only when the time rule alone wouldn't already show
// the ad and the cap allows one
export const needsCreditCheck = (i: Omit<PostTaskAdInput, 'completed'>): boolean =>
  postTaskAdDecision({ ...i, completed: false }).reason === 'too_short';
