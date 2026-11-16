// Shared task pool: claim / expiry / per-user cap / budget logic (server/earn/taskPool.js), the HTTP
// handlers against an in-memory Firestore, the app-side view logic, and the rules guards.
import {
  checkNewSlots,
  checkPoolSettings,
  effectiveStatus,
  poolView,
  slotsOverBudget,
  timeLeftText,
  toPoolDay,
  toPoolSlot,
} from '../src/services/taskPoolLogic';
import { EARN_TYPES, summarize, toEarnEntry } from '../src/services/earnLedger';
import { EARN_MAX_ADS_PER_DAY, TASK_POOL_DEFAULT_CLAIM_MINUTES, TASK_POOL_DEFAULT_USER_CAP, USER_SHARE } from '../src/config/earn';

declare const require: (m: string) => any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');
const read = (rel: string): string => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const pool = require('../server/earn/taskPool.js');
const { makeHandlers } = require('../server/earn/index.js');

const MIN = 60000;
// 2026-11-16 10:00 IST
const T0 = Date.UTC(2026, 10, 16, 4, 30);
const DAY = '2026-11-16';

const poolDoc = (o: any = {}) => ({ budgetCoins: 1000, claimMinutes: 30, perUserCap: 3, paidCoins: 0, holds: {}, ...o });
const slot = (o: any = {}) => ({ taskType: 'rewardedAd', rewardCoins: 10, status: 'open', claimedBy: null, claimExpiresAt: null, ...o });
const claimIn = (o: any = {}) => ({
  uid: 'u1',
  now: T0,
  poolDoc: poolDoc(),
  slotId: 's1',
  slotDoc: slot(),
  userDayDoc: null,
  earnDayDoc: { adsCount: 0 },
  eligible: true,
  ...o,
});

describe('task pool: shared constants', () => {
  it('server defaults / limits match the app config', () => {
    expect(pool.DEFAULTS.claimMinutes).toBe(TASK_POOL_DEFAULT_CLAIM_MINUTES);
    expect(pool.DEFAULTS.claimMinutes).toBe(30);
    expect(pool.DEFAULTS.perUserCap).toBe(TASK_POOL_DEFAULT_USER_CAP);
    expect(pool.DEFAULTS.perUserCap).toBe(3);
    expect(pool.EARN_MAX_ADS_PER_DAY).toBe(EARN_MAX_ADS_PER_DAY);
  });
  it('IST day key', () => {
    expect(pool.istDateKey(T0)).toBe(DAY);
    expect(pool.istDateKey(Date.UTC(2026, 10, 16, 18, 31))).toBe('2026-11-17'); // 00:01 IST
  });
});

describe('task pool: claim', () => {
  it('claims an open slot for the default 30 minutes and holds its coins', () => {
    const d = pool.decideClaim(claimIn());
    expect(d.ok).toBe(true);
    expect(d.expiresAt).toBe(T0 + 30 * MIN);
    expect(d.slot).toMatchObject({ status: 'claimed', claimedBy: 'u1', claimExpiresAt: T0 + 30 * MIN, baseline: { adsCount: 0 } });
    expect(d.holds).toEqual({ s1: { coins: 10, until: T0 + 30 * MIN } });
    expect(d.userDay).toMatchObject({ claims: 1, activeSlot: 's1' });
  });

  it('uses the admin claim time', () => {
    expect(pool.decideClaim(claimIn({ poolDoc: poolDoc({ claimMinutes: 10 }) })).expiresAt).toBe(T0 + 10 * MIN);
  });

  it('refuses a slot someone else holds, until the claim expires', () => {
    const held = slot({ status: 'claimed', claimedBy: 'u2', claimExpiresAt: T0 + 5 * MIN });
    expect(pool.decideClaim(claimIn({ slotDoc: held })).code).toBe('slot_taken');
    // after expiry it is open again for anyone
    const later = pool.decideClaim(claimIn({ slotDoc: held, now: T0 + 6 * MIN }));
    expect(later.ok).toBe(true);
    expect(later.slot.claimedBy).toBe('u1');
  });

  it('refuses done slots, missing slots and no pool', () => {
    expect(pool.decideClaim(claimIn({ slotDoc: slot({ status: 'done', claimedBy: 'u2' }) })).code).toBe('slot_taken');
    expect(pool.decideClaim(claimIn({ slotDoc: null })).code).toBe('slot_gone');
    expect(pool.decideClaim(claimIn({ slotDoc: slot({ taskType: 'offerwall' }) })).code).toBe('slot_gone');
    expect(pool.decideClaim(claimIn({ poolDoc: null })).code).toBe('pool_closed');
  });

  it('only active Earn users can claim', () => {
    expect(pool.decideClaim(claimIn({ eligible: false })).code).toBe('not_eligible');
  });

  it('per-user daily cap (default 3, admin-configurable)', () => {
    expect(pool.decideClaim(claimIn({ userDayDoc: { claims: 2 } })).ok).toBe(true);
    expect(pool.decideClaim(claimIn({ userDayDoc: { claims: 3 } })).code).toBe('cap_reached');
    expect(pool.decideClaim(claimIn({ userDayDoc: { claims: 3 }, poolDoc: poolDoc({ perUserCap: 5 }) })).ok).toBe(true);
    expect(pool.decideClaim(claimIn({ userDayDoc: { claims: 1 }, poolDoc: poolDoc({ perUserCap: 1 }) })).code).toBe('cap_reached');
  });

  it('one live claim at a time; an expired one does not block', () => {
    const live = { claims: 1, activeSlot: 's9', activeUntil: T0 + MIN };
    expect(pool.decideClaim(claimIn({ userDayDoc: live })).code).toBe('has_active');
    expect(pool.decideClaim(claimIn({ userDayDoc: { ...live, activeUntil: T0 - 1 } })).ok).toBe(true);
  });

  it('budget: paid + live holds + reward must fit; expired holds are released', () => {
    const p = poolDoc({ budgetCoins: 100, paidCoins: 80, holds: { s2: { coins: 10, until: T0 + MIN } } });
    expect(pool.decideClaim(claimIn({ poolDoc: p })).ok).toBe(true); // 80 + 10 + 10 = 100
    const p2 = poolDoc({ budgetCoins: 99, paidCoins: 80, holds: { s2: { coins: 10, until: T0 + MIN } } });
    expect(pool.decideClaim(claimIn({ poolDoc: p2 })).code).toBe('budget_full');
    const p3 = poolDoc({ budgetCoins: 99, paidCoins: 80, holds: { s2: { coins: 10, until: T0 - 1 } } });
    const d = pool.decideClaim(claimIn({ poolDoc: p3 }));
    expect(d.ok).toBe(true);
    expect(Object.keys(d.holds)).toEqual(['s1']); // stale hold dropped
    expect(pool.decideClaim(claimIn({ poolDoc: poolDoc({ budgetCoins: 0 }) })).code).toBe('budget_full');
  });

  it('nothing to claim when the task is already done today', () => {
    expect(pool.decideClaim(claimIn({ slotDoc: slot({ taskType: 'checkin' }), earnDayDoc: { checkedIn: true } })).code).toBe('already_done');
    expect(pool.decideClaim(claimIn({ earnDayDoc: { adsCount: EARN_MAX_ADS_PER_DAY } })).code).toBe('already_done');
    expect(pool.decideClaim(claimIn({ slotDoc: slot({ taskType: 'checkin' }), earnDayDoc: {} })).slot.baseline).toEqual({ checkedIn: false });
  });
});

describe('task pool: complete', () => {
  const claimed = (o: any = {}) =>
    slot({ status: 'claimed', claimedBy: 'u1', claimedAt: T0, claimExpiresAt: T0 + 30 * MIN, baseline: { adsCount: 2 }, ...o });
  const doneIn = (o: any = {}) => ({
    uid: 'u1',
    now: T0 + 5 * MIN,
    poolDoc: poolDoc({ holds: { s1: { coins: 10, until: T0 + 30 * MIN } } }),
    slotId: 's1',
    slotDoc: claimed(),
    userDayDoc: { claims: 1, done: 0, activeSlot: 's1', activeUntil: T0 + 30 * MIN },
    earnDayDoc: { adsCount: 3 },
    votedSinceClaim: false,
    ...o,
  });

  it('pays the reward from the budget when the task was done after the claim', () => {
    const d = pool.decideComplete(doneIn());
    expect(d.ok).toBe(true);
    expect(d.coins).toBe(10);
    expect(d.paidCoins).toBe(10);
    expect(d.holds).toEqual({});
    expect(d.userDay).toMatchObject({ claims: 1, done: 1, activeSlot: null });
  });

  it('not done yet / not mine / expired / already paid', () => {
    expect(pool.decideComplete(doneIn({ earnDayDoc: { adsCount: 2 } })).code).toBe('not_done');
    expect(pool.decideComplete(doneIn({ uid: 'u2' })).code).toBe('not_yours');
    expect(pool.decideComplete(doneIn({ now: T0 + 30 * MIN })).code).toBe('expired');
    expect(pool.decideComplete(doneIn({ slotDoc: claimed({ status: 'done' }) })).code).toBe('already_paid');
    expect(pool.decideComplete(doneIn({ slotDoc: slot() })).code).toBe('not_yours');
  });

  it('task proofs', () => {
    expect(pool.taskDone('checkin', { checkedIn: false }, { checkedIn: true })).toBe(true);
    expect(pool.taskDone('checkin', { checkedIn: true }, { checkedIn: true })).toBe(false);
    expect(pool.taskDone('pollVote', {}, {}, true)).toBe(true);
    expect(pool.taskDone('pollVote', {}, {}, false)).toBe(false);
    expect(pool.taskDone('surveyWall', {}, {}, true)).toBe(false);
  });

  it('never pays past the budget', () => {
    const p = poolDoc({ budgetCoins: 15, paidCoins: 10 });
    expect(pool.decideComplete(doneIn({ poolDoc: p })).code).toBe('budget_full');
  });
});

// ── Handlers against an in-memory Firestore ──
function fakeAdmin(initial: Record<string, any>, uidForToken: Record<string, string>) {
  const docs = new Map<string, any>(Object.entries(initial).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
  const DELETE = { __delete: true };
  const apply = (p: string, data: any, merge: boolean) => {
    const base = merge ? { ...(docs.get(p) || {}) } : {};
    Object.entries(data).forEach(([k, v]) => {
      if (v === DELETE) delete base[k];
      else base[k] = v;
    });
    docs.set(p, base);
  };
  const snap = (p: string) => ({
    exists: docs.has(p),
    id: p.split('/').pop(),
    ref: ref(p),
    data: () => (docs.has(p) ? { ...docs.get(p) } : undefined),
  });
  function ref(p: string): any {
    return { path: p, get: async () => snap(p) };
  }
  const collection = (p: string) => {
    let filters: [string, any][] = [];
    let order: string | null = null;
    let lim = 1000;
    const q: any = {
      where: (f: string, _op: string, v: any) => {
        filters = [...filters, [f, v]];
        return q;
      },
      orderBy: (f: string) => {
        order = f;
        return q;
      },
      limit: (n: number) => {
        lim = n;
        return q;
      },
      get: async () => {
        let list = [...docs.keys()]
          .filter(k => k.startsWith(p + '/') && k.slice(p.length + 1).indexOf('/') < 0)
          .filter(k => filters.every(([f, v]) => docs.get(k)[f] === v));
        const f = order;
        if (f) list = list.sort((a, b) => (docs.get(b)[f]?.ms || 0) - (docs.get(a)[f]?.ms || 0));
        return { docs: list.slice(0, lim).map(snap) };
      },
    };
    return q;
  };
  const db = {
    doc: ref,
    collection,
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      const writes: (() => void)[] = [];
      const tx = {
        get: async (r: any) => snap(r.path),
        getAll: async (...rs: any[]) => rs.map(r => snap(r.path)),
        update: (r: any, d: any) => {
          if (!docs.has(r.path)) throw new Error('NOT_FOUND');
          writes.push(() => apply(r.path, d, true));
        },
        set: (r: any, d: any, o?: any) => writes.push(() => apply(r.path, d, !!o?.merge)),
        create: (r: any, d: any) =>
          writes.push(() => {
            if (docs.has(r.path)) throw new Error('ALREADY_EXISTS');
            apply(r.path, d, false);
          }),
      };
      const out = await fn(tx);
      writes.forEach(w => w());
      return out;
    },
  };
  const admin = {
    firestore: Object.assign(() => db, {
      FieldValue: { serverTimestamp: () => 'ts', delete: () => DELETE },
      Timestamp: { fromMillis: (ms: number) => ({ ms }), now: () => ({ ms: Date.now() }) },
    }),
    auth: () => ({
      verifyIdToken: async (t: string) => {
        if (!uidForToken[t]) throw new Error('bad token');
        return { uid: uidForToken[t], firebase: { sign_in_provider: 'google.com' } };
      },
    }),
  };
  return { admin, docs };
}

function res() {
  const r: any = { code: 200, body: null };
  r.status = (c: number) => {
    r.code = c;
    return r;
  };
  r.json = (b: any) => {
    r.body = b;
    return r;
  };
  return r;
}

const req = (token: string, b: any) => ({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body: b });

const setup = (extra: Record<string, any> = {}) => {
  const base: Record<string, any> = {
    [`taskPool/${DAY}`]: { budgetCoins: 25, claimMinutes: 30, perUserCap: 2, paidCoins: 0 },
    [`taskPool/${DAY}/slots/a`]: slot({ rewardCoins: 10 }),
    [`taskPool/${DAY}/slots/b`]: slot({ rewardCoins: 10 }),
    [`taskPool/${DAY}/slots/c`]: slot({ rewardCoins: 10, taskType: 'pollVote' }),
    'users/u1': { name: 'A' },
    'users/u1/earnMeta/main': { deviceHash: 'h1' },
    [`users/u1/earnDaily/${DAY}`]: { adsCount: 1 },
    'users/u2': { name: 'B' },
    'users/u2/earnMeta/main': { deviceHash: 'h2' },
    [`users/u2/earnDaily/${DAY}`]: { adsCount: 0 },
    'users/u3': { name: 'C' }, // never set up Earn on a phone
    ...extra,
  };
  let now = T0;
  const { admin, docs } = fakeAdmin(base, { t1: 'u1', t2: 'u2', t3: 'u3' });
  const h = pool.makeTaskPoolHandlers({ admin, now: () => now });
  return { h, docs, tick: (ms: number) => (now += ms) };
};

describe('task pool: HTTP handlers (transactional)', () => {
  it('rejects missing / bad tokens and bad input', async () => {
    const { h } = setup();
    let r = res();
    await h.taskPoolClaim(req('nope', { slotId: 'a' }), r);
    expect(r.code).toBe(401);
    r = res();
    await h.taskPoolClaim(req('t1', { slotId: '../x' }), r);
    expect(r.code).toBe(400);
    r = res();
    await h.taskPoolClaim(req('t1', { slotId: 'a', day: '2026-11-15' }), r);
    expect(r.body.code).toBe('bad_day');
    r = res();
    await h.taskPoolClaim(req('t3', { slotId: 'a' }), r);
    expect(r.body.code).toBe('not_eligible');
  });

  it('full flow: claim, second user blocked, expiry returns the slot, cap, complete credits a pending ledger entry', async () => {
    const { h, docs, tick } = setup();
    let r = res();
    await h.taskPoolClaim(req('t1', { slotId: 'a', day: DAY }), r);
    expect(r.code).toBe(200);
    expect(r.body).toMatchObject({ ok: true, rewardCoins: 10, expiresAt: T0 + 30 * MIN });
    expect(docs.get(`taskPool/${DAY}/slots/a`)).toMatchObject({ status: 'claimed', claimedBy: 'u1', baseline: { adsCount: 1 } });

    r = res();
    await h.taskPoolClaim(req('t2', { slotId: 'a' }), r);
    expect(r.body.code).toBe('slot_taken');

    // u1 lets it expire; u2 takes it
    tick(31 * MIN);
    r = res();
    await h.taskPoolClaim(req('t2', { slotId: 'a' }), r);
    expect(r.code).toBe(200);
    expect(docs.get(`taskPool/${DAY}/slots/a`).claimedBy).toBe('u2');

    // u1's late Done is refused
    r = res();
    await h.taskPoolComplete(req('t1', { slotId: 'a' }), r);
    expect(r.body.code).toBe('not_yours');

    // u1 takes b (2nd claim of the day = cap 2), does the ad, completes
    r = res();
    await h.taskPoolClaim(req('t1', { slotId: 'b' }), r);
    expect(r.code).toBe(200);
    r = res();
    await h.taskPoolComplete(req('t1', { slotId: 'b' }), r);
    expect(r.body.code).toBe('not_done');
    docs.set(`users/u1/earnDaily/${DAY}`, { adsCount: 2 });
    r = res();
    await h.taskPoolComplete(req('t1', { slotId: 'b' }), r);
    expect(r.body).toEqual({ ok: true, slotId: 'b', coins: 10 });
    const entry = docs.get(`users/u1/earnings/pool_${DAY}_b`);
    expect(entry).toMatchObject({ type: 'pool', coins: 10, partner: 'app', status: 'pending' });
    expect(docs.get(`taskPool/${DAY}`).paidCoins).toBe(10);
    expect(docs.get(`taskPool/${DAY}/slots/b`).status).toBe('done');

    // double complete pays nothing more
    r = res();
    await h.taskPoolComplete(req('t1', { slotId: 'b' }), r);
    expect(r.body.code).toBe('already_paid');
    expect(docs.get(`taskPool/${DAY}`).paidCoins).toBe(10);

    // cap reached for u1 (2 claims used)
    r = res();
    await h.taskPoolClaim(req('t1', { slotId: 'c' }), r);
    expect(r.body.code).toBe('cap_reached');

    // budget 25: paid 10 + u2's live hold on a (10) + 10 > 25
    r = res();
    await h.taskPoolComplete(req('t2', { slotId: 'a' }), r); // u2 hasn't watched an ad yet
    expect(r.body.code).toBe('not_done');
    expect(docs.get(`taskPool/${DAY}`).holds).toEqual({ a: { coins: 10, until: T0 + 61 * MIN } });
  });

  it('budget holds stop over-claiming', async () => {
    const { h } = setup({ [`taskPool/${DAY}`]: { budgetCoins: 15, claimMinutes: 30, perUserCap: 3, paidCoins: 0 } });
    let r = res();
    await h.taskPoolClaim(req('t1', { slotId: 'a' }), r);
    expect(r.code).toBe(200);
    r = res();
    await h.taskPoolClaim(req('t2', { slotId: 'b' }), r);
    expect(r.body.code).toBe('budget_full');
  });

  it('poll vote task needs a vote coin event made after the claim', async () => {
    const { h, docs, tick } = setup();
    docs.set('users/u1/coinEvents/vote_post_old', { type: 'vote', points: 1, createdAt: { ms: T0 - MIN } });
    let r = res();
    await h.taskPoolClaim(req('t1', { slotId: 'c' }), r);
    expect(r.code).toBe(200);
    r = res();
    await h.taskPoolComplete(req('t1', { slotId: 'c' }), r);
    expect(r.body.code).toBe('not_done');
    tick(2 * MIN);
    docs.set('users/u1/coinEvents/vote_post_new', { type: 'vote', points: 1, createdAt: { ms: T0 + MIN } });
    r = res();
    await h.taskPoolComplete(req('t1', { slotId: 'c' }), r);
    expect(r.body).toMatchObject({ ok: true, coins: 10 });
  });

  it('sweep reopens expired claims and drops their holds', async () => {
    const { h, docs, tick } = setup();
    const r = res();
    await h.taskPoolClaim(req('t1', { slotId: 'a' }), r);
    tick(10 * MIN);
    expect(await h.taskPoolSweep()).toEqual({ day: DAY, reopened: 0 });
    tick(25 * MIN);
    expect(await h.taskPoolSweep()).toEqual({ day: DAY, reopened: 1 });
    expect(docs.get(`taskPool/${DAY}/slots/a`)).toMatchObject({ status: 'open', claimedBy: null, claimExpiresAt: null });
    expect(docs.get(`taskPool/${DAY}/slots/a`).baseline).toBeUndefined();
    expect(docs.get(`taskPool/${DAY}`).holds).toEqual({});
  });

  it('is wired into the earn server handlers', () => {
    const { admin } = fakeAdmin({}, {});
    const all = makeHandlers({ admin, secrets: {} });
    expect(typeof all.taskPoolClaim).toBe('function');
    expect(typeof all.taskPoolComplete).toBe('function');
    expect(typeof all.taskPoolSweep).toBe('function');
    expect(typeof all.bitlabsPostback).toBe('function');
  });
});

describe('task pool: app view logic', () => {
  const s = (id: string, o: any = {}) => toPoolSlot(id, slot(o))!;
  it('expired claims show as open; my live claim is found', () => {
    const slots = [
      s('a', { status: 'claimed', claimedBy: 'u1', claimExpiresAt: T0 + MIN }),
      s('b', { status: 'claimed', claimedBy: 'u2', claimExpiresAt: T0 - MIN }),
      s('c'),
      s('d', { status: 'done' }),
      s('e', { taskType: 'checkin', rewardCoins: 5 }),
    ];
    expect(effectiveStatus(slots[1], T0)).toBe('open');
    const v = poolView(slots, toPoolDay(poolDoc()), { claims: 1, done: 0 }, 'u1', T0);
    expect(v.mine?.id).toBe('a');
    expect(v.openCount).toBe(3);
    expect(v.claimsLeft).toBe(2);
    expect(v.open.map(g => [g.taskType, g.count])).toEqual([
      ['checkin', 1],
      ['rewardedAd', 2],
    ]);
  });
  it('unknown task types are ignored; defaults for missing settings', () => {
    expect(toPoolSlot('x', { taskType: 'offerwall', rewardCoins: 5 })).toBeNull();
    expect(toPoolDay({ budgetCoins: 100 })).toEqual({ budgetCoins: 100, claimMinutes: 30, perUserCap: 3, paidCoins: 0 });
  });
  it('timer text and admin checks', () => {
    expect(timeLeftText(T0 + 90 * 1000, T0)).toBe('1:30');
    expect(timeLeftText(T0 - 1, T0)).toBe('0:00');
    expect(checkPoolSettings(1000, 30, 3).ok).toBe(true);
    expect(checkPoolSettings(1000, 3, 3).ok).toBe(false);
    expect(checkPoolSettings(1000, 30, 0).ok).toBe(false);
    expect(checkPoolSettings(50, 30, 3, 60).ok).toBe(false);
    expect(checkPoolSettings(NaN, 30, 3).ok).toBe(false);
    expect(checkNewSlots(10, 20).ok).toBe(true);
    expect(checkNewSlots(0, 20).ok).toBe(false);
    expect(checkNewSlots(10, 51).ok).toBe(false);
    expect(slotsOverBudget([s('a', { rewardCoins: 60 }), s('b', { rewardCoins: 60 })], toPoolDay(poolDoc({ budgetCoins: 100 })))).toBe(20);
  });
  it('pool rewards show in the ledger', () => {
    expect(EARN_TYPES).toContain('pool');
    const e = toEarnEntry('pool_x', { type: 'pool', coins: 10, status: 'pending', partner: 'app' })!;
    expect(summarize([e]).pendingCoins).toBe(10);
  });
});

describe('task pool: money + rules guards', () => {
  it('offerwall / survey split stays 65 / 35 and no ad revenue split is added', () => {
    expect(USER_SHARE).toBe(0.65);
    const src = read('server/earn/taskPool.js');
    expect(src).not.toMatch(/USER_SHARE|adRevenue|revenueShare/);
  });
  it('rules: clients never claim, complete or credit; only admins set up open slots', () => {
    const rules = read('firestore.rules');
    const slotsBlock = rules.slice(rules.indexOf('match /taskPool/{day}/slots/{sid}'), rules.indexOf('match /taskPool/{day}/users/{uid}'));
    expect(slotsBlock).toMatch(/allow update: if false;/);
    expect(slotsBlock).toMatch(/request\.resource\.data\.status == 'open'/);
    expect(slotsBlock).toMatch(/allow create: if isAdmin\(\)/);
    const usersBlock = rules.slice(rules.indexOf('match /taskPool/{day}/users/{uid}'));
    expect(usersBlock.slice(0, 300)).toMatch(/allow write: if false;/);
    const dayBlock = rules.slice(rules.indexOf('match /taskPool/{day} {'), rules.indexOf('match /taskPool/{day}/slots/{sid}'));
    expect(dayBlock).toMatch(/onlyChanged\(\['budgetCoins', 'claimMinutes', 'perUserCap', 'updatedAt', 'updatedBy'\]\)/);
    expect(dayBlock).toMatch(/allow delete: if false;/);
    // the app's own earnings writes are unchanged: no 'pool' self-credit
    const selfCredit = rules.slice(rules.indexOf('function earnSelfCreditOk'), rules.indexOf('match /users/{uid}/earnings/{eid}'));
    expect(selfCredit).not.toMatch(/pool/);
  });
  it('the app never writes pool claims or coins itself', () => {
    const api = read('src/services/taskPoolApi.ts');
    expect(api).not.toMatch(/earnings/);
    expect(api).not.toMatch(/claimedBy: (?!null)/);
  });
});
