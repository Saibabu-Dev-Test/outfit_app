// Earn task ads (one interstitial when a partner wall opens, one after a completed task; owner
// revenue only) and the 65 / 35
// revenue split on every partner postback.
import {
  hasNewTaskCredit,
  isPartnerRewardMessage,
  needsCreditCheck,
  postTaskAdDecision,
  startTaskAdDecision,
  taskCreditIds,
} from '../src/services/postTaskAd';
import { EarnEntry } from '../src/services/earnLedger';
import {
  AD_MIN_SPACING_MS,
  POST_TASK_AD_MIN_GAP_MS,
  POST_TASK_AD_MIN_WALL_MS,
  START_TASK_AD_LOAD_WAIT_MS,
  START_TASK_AD_MIN_GAP_MS,
  TEST_ADS,
  adUnitId,
} from '../src/config/ads';
import { USER_SHARE, OWNER_SHARE } from '../src/config/earn';

declare const require: (m: string) => any;
declare const __dirname: string;
const nodeCrypto = require('crypto');
if (!(globalThis as any).crypto?.subtle) {
  (globalThis as any).crypto = nodeCrypto.webcrypto;
}
const fs = require('fs');
const path = require('path');
const read = (rel: string): string => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const e = (id: string, type: EarnEntry['type'], status: EarnEntry['status'] = 'pending', at = 0): EarnEntry => ({
  id,
  type,
  coins: 100,
  rupees: 1,
  partner: 'x',
  status,
  createdAt: at ? new Date(at) : null,
  holdUntil: null,
});

const T0 = Date.UTC(2026, 10, 17, 6, 0, 0);

describe('post-task ad: completion detection', () => {
  test('only survey / offer credits that are not reversed count as tasks', () => {
    const ids = taskCreditIds([e('a', 'survey'), e('b', 'offer'), e('c', 'ad'), e('d', 'checkin'), e('r', 'offer', 'reversed')]);
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  test('a credit id the wall did not have when it opened = completed', () => {
    const before = new Set(['cpx_1']);
    expect(hasNewTaskCredit({ before, after: [e('cpx_1', 'survey')], openedAt: T0 })).toBe(false);
    expect(hasNewTaskCredit({ before, after: [e('cpx_1', 'survey'), e('bitlabs_9', 'offer')], openedAt: T0 })).toBe(true);
    // app coins (ad / vote / check-in) are never a task
    expect(hasNewTaskCredit({ before, after: [e('ad_x_1', 'ad'), e('checkin_x', 'checkin')], openedAt: T0 })).toBe(false);
    // a reversal is not a completion
    expect(hasNewTaskCredit({ before, after: [e('offerwall_2', 'offer', 'reversed')], openedAt: T0 })).toBe(false);
  });

  test('without the opening snapshot only entries created after the wall opened count', () => {
    expect(hasNewTaskCredit({ before: null, after: [e('x', 'survey', 'pending', T0 - 1000)], openedAt: T0 })).toBe(false);
    expect(hasNewTaskCredit({ before: null, after: [e('y', 'offer', 'pending', T0 + 5000)], openedAt: T0 })).toBe(true);
    expect(hasNewTaskCredit({ before: null, after: [e('z', 'offer')], openedAt: T0 })).toBe(false);
  });

  test('partner reward messages are recognised only when they clearly say so', () => {
    expect(isPartnerRewardMessage('reward')).toBe(true);
    expect(isPartnerRewardMessage(JSON.stringify({ event: 'onReward', value: 1 }))).toBe(true);
    expect(isPartnerRewardMessage(JSON.stringify({ type: 'survey_completed' }))).toBe(true);
    expect(isPartnerRewardMessage({ name: 'conversion' })).toBe(true);
    expect(isPartnerRewardMessage('loaded')).toBe(false);
    expect(isPartnerRewardMessage(JSON.stringify({ event: 'page_view', text: 'reward' }))).toBe(false);
    expect(isPartnerRewardMessage('{not json')).toBe(false);
    expect(isPartnerRewardMessage(undefined)).toBe(false);
    expect(isPartnerRewardMessage(42)).toBe(false);
  });
});

describe('post-task ad: when it shows', () => {
  const base = { openedAt: T0, lastAdAt: 0 };
  test('task credited since the wall opened -> one ad, however short the visit', () => {
    expect(postTaskAdDecision({ ...base, closedAt: T0 + 5000, completed: true })).toEqual({ show: true, reason: 'completion' });
  });
  test('no completion seen: ad only after >= 60 s in the wall', () => {
    expect(POST_TASK_AD_MIN_WALL_MS).toBe(60000);
    expect(postTaskAdDecision({ ...base, closedAt: T0 + 59999, completed: false })).toEqual({ show: false, reason: 'too_short' });
    expect(postTaskAdDecision({ ...base, closedAt: T0 + 60000, completed: false })).toEqual({ show: true, reason: 'time_in_wall' });
  });
  test('frequency cap: at most one completion ad per 2 minutes', () => {
    expect(POST_TASK_AD_MIN_GAP_MS).toBe(120000);
    const closedAt = T0 + 10 * 60000;
    expect(postTaskAdDecision({ openedAt: T0, closedAt, lastAdAt: 0, lastPostTaskAt: closedAt - 119000, completed: true })).toEqual({ show: false, reason: 'capped' });
    expect(postTaskAdDecision({ openedAt: T0, closedAt, lastAdAt: 0, lastPostTaskAt: closedAt - 120000, completed: true }).show).toBe(true);
  });
  test('never two ads back to back: any full-screen ad in the last 10 s blocks it', () => {
    expect(AD_MIN_SPACING_MS).toBe(10000);
    const closedAt = T0 + 90000;
    expect(postTaskAdDecision({ openedAt: T0, closedAt, lastAdAt: closedAt - 9999, completed: true })).toEqual({ show: false, reason: 'too_soon' });
    expect(postTaskAdDecision({ openedAt: T0, closedAt, lastAdAt: closedAt - 10000, completed: true }).show).toBe(true);
  });
  test('the start ad of the same task does not block its completion ad', () => {
    // start ad closed at T0, the wall opened right after, task credited 40 s later
    const startAdAt = T0;
    expect(postTaskAdDecision({ openedAt: T0 + 500, closedAt: T0 + 40000, lastAdAt: startAdAt, lastPostTaskAt: 0, completed: true })).toEqual({ show: true, reason: 'completion' });
    // and no credit seen: the 60 s rule still applies
    expect(postTaskAdDecision({ openedAt: T0 + 500, closedAt: T0 + 61000, lastAdAt: startAdAt, completed: false }).reason).toBe('time_in_wall');
  });
  test('the ledger is read on close only when the time rule would not already decide', () => {
    expect(needsCreditCheck({ ...base, closedAt: T0 + 10000 })).toBe(true);
    expect(needsCreditCheck({ ...base, closedAt: T0 + 90000 })).toBe(false);
    expect(needsCreditCheck({ openedAt: T0, closedAt: T0 + 5000, lastAdAt: T0 })).toBe(false);
    expect(needsCreditCheck({ openedAt: T0, closedAt: T0 + 10000, lastAdAt: 0, lastPostTaskAt: T0 })).toBe(false);
  });
  test('earn ad slots use Google test units in dev builds', () => {
    expect(adUnitId('earnInterstitial')).toBe(TEST_ADS.earnInterstitial);
    expect(TEST_ADS.earnInterstitial).toBe('ca-app-pub-3940256099942544/1033173712');
  });
});

describe('start ad: one interstitial when a partner wall is opened', () => {
  test('caps: 1 per 2 min between wall opens, never within 10 s of another ad, 3 s load wait', () => {
    expect(START_TASK_AD_MIN_GAP_MS).toBe(120000);
    expect(START_TASK_AD_LOAD_WAIT_MS).toBe(3000);
    expect(startTaskAdDecision({ now: T0, lastStartAt: 0, lastAdAt: 0 })).toEqual({ show: true, reason: 'start' });
    expect(startTaskAdDecision({ now: T0, lastStartAt: T0 - 119000, lastAdAt: T0 - 60000 })).toEqual({ show: false, reason: 'capped' });
    expect(startTaskAdDecision({ now: T0, lastStartAt: T0 - 120000, lastAdAt: T0 - 60000 }).show).toBe(true);
    // a completion / rewarded ad just closed: no start ad straight after it
    expect(startTaskAdDecision({ now: T0, lastStartAt: 0, lastAdAt: T0 - 5000 })).toEqual({ show: false, reason: 'too_soon' });
  });
});

describe('task ads: policy guards in the code', () => {
  const wall = read('src/screens/Earn/EarnWallScreen.tsx');
  test('the ad runs only when the wall is being left, never when it opens', () => {
    const hook = wall.slice(wall.indexOf('function usePostTaskAd'), wall.indexOf('const Closing'));
    const leave = hook.indexOf("addListener?.('beforeRemove'");
    expect(leave).toBeGreaterThan(-1);
    const show = hook.indexOf("showInterstitialAd('earnInterstitial'");
    expect(show).toBeGreaterThan(leave);
    expect(wall.split('showInterstitialAd(').length - 1).toBe(1);
    // the user always gets back to Earn, ad or not
    expect(hook).toMatch(/finally \{[\s\S]*navigation\.dispatch\(e\.data\.action\)/);
  });
  test('the post-task ad gives no coins', () => {
    expect(wall).not.toMatch(/recordEarnAd|showRewardedAd|EARN_AD_COINS/);
    expect(read('src/services/postTaskAd.ts')).not.toMatch(/recordEarnAd|coins:/);
  });
  test('the start ad runs before each partner wall opens, and the wall opens with or without it', () => {
    const earn = read('src/screens/Earn/EarnScreen.tsx');
    const runner = earn.slice(earn.indexOf('const startTaskAd'), earn.indexOf('export default function'));
    expect(runner).toMatch(/startTaskAdDecision\(/);
    expect(runner).toMatch(/showInterstitialAd\('earnInterstitial', START_TASK_AD_LOAD_WAIT_MS\)/);
    expect(runner).not.toMatch(/recordEarnAd|showRewardedAd|EARN_AD_COINS/);
    const open = earn.slice(earn.indexOf('const openSurveys'), earn.indexOf('const onSaveUpi'));
    // every EarnWall navigation is preceded by the start ad
    expect(open).toMatch(/await startTaskAd\(\);\s*navigation\.navigate\('EarnWall', \{ url: cpxWallUrl/);
    expect(open).toMatch(/await startTaskAd\(\);\s*navigation\.navigate\('EarnWall', params\)/);
    expect(open.split("navigate('EarnWall'").length - 1).toBe(2);
    for (const k of ["openWall('offers'", "openWall('bitlabs'", "openWall('games'"]) expect(open).toContain(k);
    // no rewarded ad (coins) before a task
    expect(open).not.toMatch(/showRewardedAd/);
  });
  test('the 65% note lives in Terms & About, not on Earn cards', () => {
    expect(read('src/screens/Profile/TermsScreen.tsx')).toMatch(/Coins shown in partner walls are before Outfit's share; you receive \$\{Math\.round\(USER_SHARE \* 100\)\}%/);
    expect(read('web/public/about/index.html')).toMatch(/Coins shown in partner walls are before Outfit's share; you receive 65%/);
    expect(read('src/screens/Earn/EarnScreen.tsx')).not.toMatch(/65%|before Outfit's share/);
  });
});

describe('revenue split: users 65%, owner 35% on every partner', () => {
  const { planCpxPostback, planOfferwallPostback, hmacSha256Hex, applyEarningToD1 } = require('../server/worker/src/earn.js');
  const { planBitlabsCallback, USER_SHARE: W_SHARE } = require('../server/worker/src/bitlabs.js');
  const md5 = (s: string) => nodeCrypto.createHash('md5').update(s).digest('hex');

  test('the app and the server agree on 65 / 35', () => {
    expect(USER_SHARE).toBe(0.65);
    expect(OWNER_SHARE).toBeCloseTo(0.35);
    expect(W_SHARE).toBe(0.65);
    expect(read('server/earn/index.js')).toMatch(/const USER_SHARE = 0\.65;/);
  });

  test('CPX: ₹10 payout -> user 650 coins (₹6.50), owner ₹3.50', () => {
    const p = planCpxPostback({ query: { user_id: 'u1', trans_id: 't1', amount_local: '10', hash: md5('t1-s') }, secret: 's', now: T0 });
    expect(p.write.fields).toMatchObject({ coins: 650, rupees: 6.5, ownerRupees: 3.5, payoutRupees: 10 });
    expect(p.write.fields.rupees + p.write.fields.ownerRupees).toBeCloseTo(10);
  });

  test('Offerwall.GG: placement amount is the full payout (8300 coins = $1) -> user 65% (5395), owner ₹29.05', async () => {
    const sig = await hmacSha256Hex('ow', 'u1:tx1:8300');
    const p = await planOfferwallPostback({ query: { user: 'u1', tx: 'tx1', amount: '8300', sig, payout: '1' }, secret: 'ow', now: T0 });
    expect(p.write.fields).toMatchObject({ coins: 5395, rupees: 53.95, ownerRupees: 29.05, payoutRupees: 83 });
    expect(p.write.fields.rupees + p.write.fields.ownerRupees).toBeCloseTo(83);
  });

  test('BitLabs: $1 -> user 5395 coins (₹53.95), owner ₹29.05', async () => {
    const unsigned = 'https://w.example/bitlabsPostback?uid=u1&tx=b1&val=1&type=COMPLETE';
    const hash = nodeCrypto.createHmac('sha1', 'bl').update(unsigned).digest('hex');
    const p = await planBitlabsCallback({ url: `${unsigned}&hash=${hash}`, secret: 'bl', now: T0 });
    expect(p.write.fields).toMatchObject({ coins: 5395, rupees: 53.95, ownerRupees: 29.05, payoutRupees: 83 });
    expect(p.write.fields.rupees + p.write.fields.ownerRupees).toBeCloseTo(83);
  });

  test("the owner share is stored in the D1 ledger's owner_rupees (read by Admin > Earnings)", async () => {
    const runs: any[][] = [];
    const db = {
      run: async (...args: any[]) => {
        runs.push(args);
        return { meta: { changes: 1 } };
      },
    };
    const p = planCpxPostback({ query: { user_id: 'u1', trans_id: 't2', amount_local: '10', hash: md5('t2-s') }, secret: 's', now: T0 });
    expect(await applyEarningToD1(db, p.write, T0)).toBe('created');
    const [sql, ...binds] = runs[0];
    const cols = /\(([^)]*)\)\s*VALUES/.exec(sql)![1].split(',').map((c: string) => c.trim());
    expect(binds[cols.indexOf('owner_rupees')]).toBe(3.5);
    expect(binds[cols.indexOf('coins')]).toBe(650);
    expect(read('server/worker/src/api.js')).toMatch(/SUM\(owner_rupees\)/);
  });
});
