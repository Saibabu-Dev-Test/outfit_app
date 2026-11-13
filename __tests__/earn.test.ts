import { istDateKey, msUntilIstMidnight } from '../src/utils/istDate';
import { sha256Hex, isValidUpi, normalizeUpi } from '../src/utils/sha256';
import {
  COINS_PER_RUPEE,
  USER_SHARE,
  coinsToRupees,
  cpxWallUrl,
  userCoinsForPayout,
} from '../src/config/earn';
import {
  EarnEntry,
  isUnlocked,
  latestSurveyAt,
  summarize,
  surveyAdOwed,
  toEarnDay,
  toEarnEntry,
  withdrawCheck,
} from '../src/services/earnLedger';

const e = (p: Partial<EarnEntry>): EarnEntry => ({
  id: Math.random().toString(36),
  type: 'ad',
  coins: 2,
  rupees: 0.02,
  partner: 'app',
  status: 'pending',
  createdAt: new Date(0),
  holdUntil: null,
  ...p,
});

describe('IST day key', () => {
  test('rolls over at 00:00 IST, not UTC', () => {
    expect(istDateKey(Date.UTC(2026, 10, 13, 18, 29))).toBe('2026-11-13'); // 23:59 IST
    expect(istDateKey(Date.UTC(2026, 10, 13, 18, 30))).toBe('2026-11-14'); // 00:00 IST
    expect(istDateKey(Date.UTC(2026, 11, 31, 20, 0))).toBe('2027-01-01');
  });
  test('ms until midnight', () => {
    expect(msUntilIstMidnight(Date.UTC(2026, 10, 13, 18, 29))).toBe(60000);
  });
});

describe('sha256 / UPI', () => {
  test('known vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('₹')).toHaveLength(64);
  });
  test('UPI ids', () => {
    expect(normalizeUpi(' Name@OkSBI ')).toBe('name@oksbi');
    expect(isValidUpi('name@oksbi')).toBe(true);
    expect(isValidUpi('9876543210@ybl')).toBe(true);
    expect(isValidUpi('not an upi')).toBe(false);
    expect(isValidUpi('a@')).toBe(false);
  });
});

describe('config', () => {
  test('conversion and split', () => {
    expect(COINS_PER_RUPEE).toBe(100);
    expect(USER_SHARE).toBeCloseTo(0.65);
    expect(coinsToRupees(250)).toBe(2.5);
    expect(userCoinsForPayout(10)).toBe(650); // ₹10 survey -> user ₹6.50
    expect(userCoinsForPayout(-1)).toBe(0);
  });
  test('CPX url never contains a secret, only the server hash', () => {
    const u = cpxWallUrl('uid 1', 'abc');
    expect(u).toMatch(/^https:\/\/offers\.cpx-research\.com\/index\.php\?app_id=/);
    expect(u).toContain('ext_user_id=uid%201');
    expect(u).toContain('secure_hash=abc');
  });
});

describe('ledger', () => {
  test('parses and rejects bad docs', () => {
    expect(toEarnEntry('x', { type: 'survey', coins: 650, status: 'pending' })?.rupees).toBe(6.5);
    expect(toEarnEntry('x', { type: 'hack', coins: 1, status: 'approved' })).toBeNull();
    expect(toEarnEntry('x', { type: 'ad', coins: 1, status: 'weird' })).toBeNull();
  });
  test('summary: withdrawable vs pending, reversed ignored, breakdown', () => {
    const s = summarize(
      [
        e({ type: 'ad', coins: 2, status: 'approved' }),
        e({ type: 'vote', coins: 1, status: 'approved' }),
        e({ type: 'survey', coins: 6500, status: 'approved' }),
        e({ type: 'survey', coins: 1000, status: 'pending' }),
        e({ type: 'offer', coins: 300, status: 'reversed' }),
        e({ type: 'checkin', coins: 5, status: 'pending' }),
      ],
      [{ id: 'w', coins: 5000, rupees: 50, status: 'pending', createdAt: null }],
    );
    expect(s.approvedCoins).toBe(6503);
    expect(s.pendingCoins).toBe(1005);
    expect(s.totalCoins).toBe(7508);
    expect(s.withdrawableCoins).toBe(1503);
    expect(s.tasksCompleted).toBe(5);
    expect(s.byType.survey).toEqual({ count: 2, coins: 7500 });
    expect(s.byType.offer.count).toBe(0);
  });
  test('rejected withdrawals give the balance back', () => {
    const s = summarize([e({ coins: 6000, status: 'approved' })], [
      { id: 'w', coins: 5000, rupees: 50, status: 'rejected', createdAt: null },
    ]);
    expect(s.withdrawableCoins).toBe(6000);
  });
  test('withdraw check', () => {
    const s = summarize([e({ coins: 7000, status: 'approved' })]);
    expect(withdrawCheck(40, s, 50).ok).toBe(false);
    expect(withdrawCheck(80, s, 50).ok).toBe(false);
    expect(withdrawCheck(70, s, 50)).toEqual({ ok: true, coins: 7000 });
    expect(withdrawCheck(50.5, s, 50).ok).toBe(false);
  });
});

describe('daily gate + survey ad pacing', () => {
  test('unlocks only with ad AND vote', () => {
    expect(isUnlocked(toEarnDay({ adWatched: true }))).toBe(false);
    expect(isUnlocked(toEarnDay({ voted: true }))).toBe(false);
    expect(isUnlocked(toEarnDay({ adWatched: true, voted: true }))).toBe(true);
    expect(isUnlocked(toEarnDay(undefined))).toBe(false);
  });
  test('an ad is owed after each new completed survey', () => {
    const list = [e({ type: 'survey', createdAt: new Date(1000) }), e({ type: 'survey', createdAt: new Date(5000), status: 'reversed' })];
    expect(latestSurveyAt(list)).toBe(1000);
    expect(surveyAdOwed(list, 0)).toBe(true);
    expect(surveyAdOwed(list, 1000)).toBe(false);
    expect(surveyAdOwed([...list, e({ type: 'survey', createdAt: new Date(2000) })], 1000)).toBe(true);
    expect(surveyAdOwed([], 0)).toBe(false);
  });
});
