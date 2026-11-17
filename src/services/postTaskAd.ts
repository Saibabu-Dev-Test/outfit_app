// Earn task ads (pure logic, no Firebase / ads SDK; used by EarnScreen and EarnWallScreen).
//
// Owner revenue only: these ads NEVER give the user coins (they are not recorded in the earn ledger).
// Start ad (EarnScreen, before a partner wall opens: Offers, Surveys & offers, Games, Surveys):
//   one interstitial, at most one per START_TASK_AD_MIN_GAP_MS (2 min) between separate wall opens;
//   when no ad loads within START_TASK_AD_LOAD_WAIT_MS (3 s) the wall opens anyway.
// Completion ad (EarnWallScreen, when the user leaves a partner wall: Done / back / header arrow):
//   1. at most one completion ad per POST_TASK_AD_MIN_GAP_MS (2 min), so the start ad of the same
//      task never blocks it;
//   2. a new task credit for this user since the wall opened (a survey / offer entry in their
//      earnings ledger the wall didn't have when it opened, or the wall's own in-page reward
//      message) -> show one ad;
//   3. no completion seen (postbacks not deployed yet / late) -> show one ad only when the user
//      spent at least POST_TASK_AD_MIN_WALL_MS (60 s) in the wall;
//   4. one decision per close, so never more than one ad per close.
// Both: never two full-screen ads (rewarded or interstitial) within AD_MIN_SPACING_MS (10 s).
import { AD_MIN_SPACING_MS, POST_TASK_AD_MIN_GAP_MS, POST_TASK_AD_MIN_WALL_MS, START_TASK_AD_MIN_GAP_MS } from '../config/ads';
import type { EarnEntry } from './earnLedger';

export type PostTaskAdReason = 'completion' | 'time_in_wall' | 'capped' | 'too_soon' | 'too_short';
export type StartTaskAdReason = 'start' | 'capped' | 'too_soon';

// When the last start / completion ad was shown this session (0 = none). Only shown ads count.
const shownAt = { start: 0, completion: 0 };
export const lastStartAdAt = (): number => shownAt.start;
export const lastPostTaskAdAt = (): number => shownAt.completion;
export const noteTaskAdShown = (kind: 'start' | 'completion', at: number = Date.now()): void => {
  shownAt[kind] = at;
};

const tooSoon = (now: number, lastAdAt: number) => lastAdAt > 0 && now - lastAdAt < AD_MIN_SPACING_MS;

// Start ad when a partner wall is opened. lastAdAt = last full-screen ad of any kind.
export const startTaskAdDecision = ({
  now,
  lastStartAt,
  lastAdAt,
}: {
  now: number;
  lastStartAt: number;
  lastAdAt: number;
}): { show: boolean; reason: StartTaskAdReason } => {
  if (tooSoon(now, lastAdAt)) return { show: false, reason: 'too_soon' };
  if (lastStartAt > 0 && now - lastStartAt < START_TASK_AD_MIN_GAP_MS) return { show: false, reason: 'capped' };
  return { show: true, reason: 'start' };
};

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
  lastAdAt: number; // ms, last full-screen ad of any kind (0 = none): 10 s spacing
  lastPostTaskAt?: number; // ms, last completion ad (0 = none): 2 min cap
}

export const postTaskAdDecision = ({ openedAt, closedAt, completed, lastAdAt, lastPostTaskAt = 0 }: PostTaskAdInput): { show: boolean; reason: PostTaskAdReason } => {
  if (tooSoon(closedAt, lastAdAt)) return { show: false, reason: 'too_soon' };
  if (lastPostTaskAt > 0 && closedAt - lastPostTaskAt < POST_TASK_AD_MIN_GAP_MS) return { show: false, reason: 'capped' };
  if (completed) return { show: true, reason: 'completion' };
  if (closedAt - openedAt >= POST_TASK_AD_MIN_WALL_MS) return { show: true, reason: 'time_in_wall' };
  return { show: false, reason: 'too_short' };
};

// The completion check needs a network read only when the time rule alone wouldn't already show
// the ad and the caps allow one
export const needsCreditCheck = (i: Omit<PostTaskAdInput, 'completed'>): boolean =>
  postTaskAdDecision({ ...i, completed: false }).reason === 'too_short';
