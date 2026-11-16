/* eslint-disable */
// Shared task pool (server side, NOT deployed yet; same host as the other handlers in index.js).
//
// The owner funds a small daily coin budget for the app's OWN tasks (daily check-in, a poll vote,
// one rewarded ad). Third-party offerwalls / surveys are NOT part of this pool: they stay per user
// with the 65% / 35% postback split in index.js. Ad income (rewarded ads here included) stays 100%
// owner; pool rewards are paid out of the owner's budget, never as a share of ad revenue.
//
// Firestore (rules: firestore.rules "Shared task pool"):
//   taskPool/{day}                 {budgetCoins, claimMinutes, perUserCap, paidCoins, holds, updatedAt, updatedBy}
//                                  admin writes budgetCoins / claimMinutes / perUserCap; the server
//                                  alone writes paidCoins + holds ({slotId: {coins, until}} of live claims)
//   taskPool/{day}/slots/{slotId}  {taskType, rewardCoins, status: open|claimed|done, claimedBy,
//                                  claimedAt, claimExpiresAt, baseline, doneAt, createdAt}
//                                  admin creates (open) / deletes open slots; claims + completions: server
//   taskPool/{day}/users/{uid}     {claims, done, activeSlot, activeUntil}  server only, the user reads
//   users/{uid}/earnings/pool_{day}_{slotId}  {type:'pool', coins, partner:'app', status:'pending', holdUntil}
//
// Rules of the pool (all checked inside one Firestore transaction):
//   - day is the IST calendar day (same as the Earn daily gate); only today's pool can be used.
//   - one live claim per user at a time; each claim uses one of the user's perUserCap turns for the day.
//   - a claim lasts claimMinutes. Not finished in time -> the slot is open again for anyone
//     (lazily on the next claim, and by taskPoolSweep for the list).
//   - budget: paidCoins + coins held by live claims + this reward <= budgetCoins (so a claim is only
//     given when its reward is still covered), and paidCoins + reward <= budgetCoins on completion.
//   - the user must actually do the task after claiming it (checked against their earnDaily doc /
//     coin events), and coins are written only here, as a 'pending' ledger entry.
const IST_OFFSET_MS = 330 * 60 * 1000;
const MIN = 60 * 1000;

const TASK_TYPES = ['checkin', 'rewardedAd', 'pollVote'];
// Keep equal to TASK_POOL_* in src/config/earn.ts and taskPoolConfigOk() in firestore.rules.
const DEFAULTS = { claimMinutes: 30, perUserCap: 3 };
const LIMITS = {
  claimMinutes: [5, 240],
  perUserCap: [1, 20],
  budgetCoins: [0, 1000000],
  rewardCoins: [1, 1000],
};
const EARN_MAX_ADS_PER_DAY = 10; // = EARN_MAX_ADS_PER_DAY in src/config/earn.ts (coin-paying ads a day)
const POOL_HOLD_MS = 24 * 60 * MIN; // ledger entry stays pending one day, then releaseHeld approves it

const istDateKey = ms => {
  const x = new Date(ms + IST_OFFSET_MS);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
};

const toMs = v => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v.ms === 'number') return v.ms;
  return 0;
};

const int = (v, lo, hi, dflt) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, Math.floor(n)));
};

// Day doc -> config (null = no pool today)
function readPool(d) {
  if (!d) return null;
  return {
    budgetCoins: int(d.budgetCoins, LIMITS.budgetCoins[0], LIMITS.budgetCoins[1], 0),
    claimMinutes: int(d.claimMinutes, LIMITS.claimMinutes[0], LIMITS.claimMinutes[1], DEFAULTS.claimMinutes),
    perUserCap: int(d.perUserCap, LIMITS.perUserCap[0], LIMITS.perUserCap[1], DEFAULTS.perUserCap),
    paidCoins: Math.max(0, Math.floor(Number(d.paidCoins) || 0)),
    holds: d.holds && typeof d.holds === 'object' ? d.holds : {},
  };
}

// Live claim holds only (expired ones dropped), optionally without one slot
function liveHolds(holds, now, exceptSlot) {
  const out = {};
  let total = 0;
  Object.keys(holds || {}).forEach(id => {
    const h = holds[id] || {};
    const until = toMs(h.until);
    const coins = Math.max(0, Math.floor(Number(h.coins) || 0));
    if (id !== exceptSlot && until > now && coins > 0) {
      out[id] = { coins, until };
      total += coins;
    }
  });
  return { holds: out, total };
}

// Effective status: a claim past its expiry counts as open again
function slotStatus(slot, now) {
  if (!slot) return 'gone';
  if (slot.status === 'done') return 'done';
  if (slot.status === 'claimed' && toMs(slot.claimExpiresAt) > now) return 'claimed';
  return 'open';
}

const fail = (code, status = 409) => ({ ok: false, code, status });

// What the user has already done today, for the task's "before" snapshot
function taskBaseline(taskType, earnDay) {
  const d = earnDay || {};
  if (taskType === 'checkin') return { checkedIn: d.checkedIn === true };
  if (taskType === 'rewardedAd') return { adsCount: Math.max(0, Math.floor(Number(d.adsCount) || 0)) };
  return {};
}

// Can this task still be done today by this user? (nothing to claim if it is already done)
function taskStillPossible(taskType, earnDay) {
  const d = earnDay || {};
  if (taskType === 'checkin') return d.checkedIn !== true;
  if (taskType === 'rewardedAd') return (Math.floor(Number(d.adsCount) || 0)) < EARN_MAX_ADS_PER_DAY;
  return true; // pollVote: any new poll vote after the claim
}

// Did the user do the task after claiming it?
function taskDone(taskType, baseline, earnDay, votedSinceClaim) {
  const b = baseline || {};
  const d = earnDay || {};
  if (taskType === 'checkin') return b.checkedIn === false && d.checkedIn === true;
  if (taskType === 'rewardedAd') return (Math.floor(Number(d.adsCount) || 0)) > (Math.floor(Number(b.adsCount) || 0));
  if (taskType === 'pollVote') return votedSinceClaim === true;
  return false;
}

// ── Claim ──
// in: {uid, now, poolDoc, slotId, slotDoc, userDayDoc, earnDayDoc, eligible}
// out: {ok:false, code} | {ok:true, expiresAt, slot, holds, userDay}
function decideClaim({ uid, now, poolDoc, slotId, slotDoc, userDayDoc, earnDayDoc, eligible }) {
  if (!eligible) return fail('not_eligible', 403);
  const pool = readPool(poolDoc);
  if (!pool) return fail('pool_closed');
  if (!slotDoc) return fail('slot_gone', 404);
  if (!TASK_TYPES.includes(slotDoc.taskType)) return fail('slot_gone', 404);
  const st = slotStatus(slotDoc, now);
  if (st === 'done') return fail('slot_taken');
  if (st === 'claimed') return fail(slotDoc.claimedBy === uid ? 'already_yours' : 'slot_taken');

  const u = userDayDoc || {};
  const claims = Math.max(0, Math.floor(Number(u.claims) || 0));
  if (u.activeSlot && u.activeSlot !== slotId && toMs(u.activeUntil) > now) return fail('has_active');
  if (claims >= pool.perUserCap) return fail('cap_reached');

  const reward = int(slotDoc.rewardCoins, LIMITS.rewardCoins[0], LIMITS.rewardCoins[1], 0);
  const live = liveHolds(pool.holds, now, slotId);
  if (pool.paidCoins + live.total + reward > pool.budgetCoins) return fail('budget_full');
  if (!taskStillPossible(slotDoc.taskType, earnDayDoc)) return fail('already_done');

  const expiresAt = now + pool.claimMinutes * MIN;
  return {
    ok: true,
    expiresAt,
    reward,
    slot: {
      status: 'claimed',
      claimedBy: uid,
      claimedAt: now,
      claimExpiresAt: expiresAt,
      baseline: taskBaseline(slotDoc.taskType, earnDayDoc),
    },
    holds: { ...live.holds, [slotId]: { coins: reward, until: expiresAt } },
    userDay: { claims: claims + 1, done: Math.max(0, Math.floor(Number(u.done) || 0)), activeSlot: slotId, activeUntil: expiresAt },
  };
}

// ── Complete ──
// in: {uid, now, poolDoc, slotId, slotDoc, userDayDoc, earnDayDoc, votedSinceClaim}
// out: {ok:false, code} | {ok:true, coins, slot, holds, paidCoins, userDay}
function decideComplete({ uid, now, poolDoc, slotId, slotDoc, userDayDoc, earnDayDoc, votedSinceClaim }) {
  const pool = readPool(poolDoc);
  if (!pool) return fail('pool_closed');
  if (!slotDoc) return fail('slot_gone', 404);
  if (slotDoc.claimedBy !== uid || slotDoc.status === 'open') return fail('not_yours', 403);
  if (slotDoc.status === 'done') return fail('already_paid');
  if (toMs(slotDoc.claimExpiresAt) <= now) return fail('expired');
  if (!taskDone(slotDoc.taskType, slotDoc.baseline, earnDayDoc, votedSinceClaim)) return fail('not_done');

  const reward = int(slotDoc.rewardCoins, LIMITS.rewardCoins[0], LIMITS.rewardCoins[1], 0);
  if (pool.paidCoins + reward > pool.budgetCoins) return fail('budget_full');
  const live = liveHolds(pool.holds, now, slotId);
  const u = userDayDoc || {};
  return {
    ok: true,
    coins: reward,
    slot: { status: 'done', doneAt: now },
    holds: live.holds,
    paidCoins: pool.paidCoins + reward,
    userDay: {
      claims: Math.max(0, Math.floor(Number(u.claims) || 0)),
      done: Math.max(0, Math.floor(Number(u.done) || 0)) + 1,
      activeSlot: null,
      activeUntil: 0,
    },
  };
}

const MESSAGES = {
  not_eligible: 'Open the Earn tab once first to set up Earn on this phone.',
  pool_closed: 'No shared tasks today. ఈరోజు టాస్కులు లేవు.',
  slot_gone: 'This task is no longer available.',
  slot_taken: 'Someone else took this task. Try another one.',
  already_yours: 'You already have this task.',
  has_active: 'Finish your current task first.',
  cap_reached: 'You have used all your tasks for today. Come back tomorrow.',
  budget_full: "Today's task coins are used up. Come back tomorrow.",
  already_done: 'You have already done this task today. Pick another one.',
  not_yours: 'This task is not yours.',
  already_paid: 'Coins for this task are already added.',
  expired: 'Time is up. The task went back to the pool.',
  not_done: 'Task not done yet. Finish it and tap Done again.',
  bad_day: 'The day changed. Please refresh.',
  bad_request: 'Please update the app and try again.',
  unauthorized: 'Please sign in again.',
  error: 'Something went wrong. Please try again.',
};

const safeId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);

// HTTP handlers (POST, Authorization: Bearer <Firebase ID token>, body {day, slotId}).
// opts.now() is injectable for tests.
function makeTaskPoolHandlers({ admin, now: clock }) {
  const db = admin.firestore();
  const Ts = admin.firestore.Timestamp;
  const nowMs = () => (clock ? clock() : Date.now());

  async function authUser(req) {
    const token = String((req.headers || {}).authorization || '').replace(/^Bearer /, '');
    if (!token) return null;
    try {
      const t = await admin.auth().verifyIdToken(token);
      // Same as signedIn() in firestore.rules: Google sign-in only
      if (!t || !t.uid || (t.firebase && t.firebase.sign_in_provider && t.firebase.sign_in_provider !== 'google.com')) return null;
      return t;
    } catch (e) {
      return null;
    }
  }

  const body = req => {
    const b = req.body;
    if (b && typeof b === 'object') return b;
    try {
      return JSON.parse(String(b || '{}'));
    } catch (e) {
      return {};
    }
  };

  const send = (res, r) => {
    if (r.ok) return res.status(200).json(r.payload);
    return res.status(r.status || 409).json({ ok: false, code: r.code, message: MESSAGES[r.code] || MESSAGES.error });
  };

  const refs = (day, slotId, uid) => ({
    pool: db.doc(`taskPool/${day}`),
    slot: db.doc(`taskPool/${day}/slots/${slotId}`),
    userDay: db.doc(`taskPool/${day}/users/${uid}`),
    earnDay: db.doc(`users/${uid}/earnDaily/${day}`),
    profile: db.doc(`users/${uid}`),
    meta: db.doc(`users/${uid}/earnMeta/main`),
    ledger: db.doc(`users/${uid}/earnings/pool_${day}_${slotId}`),
  });

  async function prep(req, res) {
    if (req.method && req.method !== 'POST') {
      res.status(405).json({ ok: false, code: 'bad_request', message: MESSAGES.bad_request });
      return null;
    }
    const user = await authUser(req);
    if (!user) {
      res.status(401).json({ ok: false, code: 'unauthorized', message: MESSAGES.unauthorized });
      return null;
    }
    const b = body(req);
    const now = nowMs();
    const day = istDateKey(now);
    if (!safeId(b.slotId)) {
      res.status(400).json({ ok: false, code: 'bad_request', message: MESSAGES.bad_request });
      return null;
    }
    if (b.day && b.day !== day) {
      res.status(409).json({ ok: false, code: 'bad_day', message: MESSAGES.bad_day });
      return null;
    }
    return { uid: user.uid, slotId: b.slotId, day, now };
  }

  async function taskPoolClaim(req, res) {
    const p = await prep(req, res);
    if (!p) return;
    const r = refs(p.day, p.slotId, p.uid);
    try {
      const out = await db.runTransaction(async tx => {
        const [poolS, slotS, userS, earnS, profS, metaS] = await tx.getAll(r.pool, r.slot, r.userDay, r.earnDay, r.profile, r.meta);
        // "Active user": has a profile and has set up Earn on a phone (one account per phone)
        const eligible = profS.exists && metaS.exists && !!(metaS.data() || {}).deviceHash;
        const d = decideClaim({
          uid: p.uid,
          now: p.now,
          poolDoc: poolS.exists ? poolS.data() : null,
          slotId: p.slotId,
          slotDoc: slotS.exists ? slotS.data() : null,
          userDayDoc: userS.exists ? userS.data() : null,
          earnDayDoc: earnS.exists ? earnS.data() : null,
          eligible,
        });
        if (!d.ok) return d;
        tx.update(r.slot, {
          status: 'claimed',
          claimedBy: p.uid,
          claimedAt: Ts.fromMillis(d.slot.claimedAt),
          claimExpiresAt: Ts.fromMillis(d.slot.claimExpiresAt),
          baseline: d.slot.baseline,
        });
        tx.update(r.pool, { holds: d.holds });
        tx.set(r.userDay, { ...d.userDay, updatedAt: Ts.fromMillis(p.now) }, { merge: true });
        return { ok: true, payload: { ok: true, slotId: p.slotId, expiresAt: d.expiresAt, rewardCoins: d.reward } };
      });
      send(res, out);
    } catch (e) {
      console.error('taskPoolClaim failed', e && e.message);
      res.status(500).json({ ok: false, code: 'error', message: MESSAGES.error });
    }
  }

  // Poll vote proof: a 'vote' coin event created after the claim (newest 30 events, no composite index)
  async function votedSince(uid, sinceMs) {
    if (!sinceMs) return false;
    const snap = await db.collection(`users/${uid}/coinEvents`).orderBy('createdAt', 'desc').limit(30).get();
    return snap.docs.some(doc => {
      const x = doc.data() || {};
      return x.type === 'vote' && toMs(x.createdAt) > sinceMs;
    });
  }

  async function taskPoolComplete(req, res) {
    const p = await prep(req, res);
    if (!p) return;
    const r = refs(p.day, p.slotId, p.uid);
    try {
      // The vote check is a query, done before the transaction against the claim time it re-reads
      const pre = await r.slot.get();
      const preData = pre.exists ? pre.data() : null;
      const voted =
        preData && preData.taskType === 'pollVote' && preData.claimedBy === p.uid ? await votedSince(p.uid, toMs(preData.claimedAt)) : false;

      const out = await db.runTransaction(async tx => {
        const [poolS, slotS, userS, earnS] = await tx.getAll(r.pool, r.slot, r.userDay, r.earnDay);
        const slotDoc = slotS.exists ? slotS.data() : null;
        // The claim must be the same one the vote check looked at
        const sameClaim = !!(slotDoc && preData && toMs(slotDoc.claimedAt) === toMs(preData.claimedAt));
        const d = decideComplete({
          uid: p.uid,
          now: p.now,
          poolDoc: poolS.exists ? poolS.data() : null,
          slotId: p.slotId,
          slotDoc,
          userDayDoc: userS.exists ? userS.data() : null,
          earnDayDoc: earnS.exists ? earnS.data() : null,
          votedSinceClaim: voted && sameClaim,
        });
        if (!d.ok) return d;
        tx.update(r.slot, { status: 'done', doneAt: Ts.fromMillis(p.now) });
        tx.update(r.pool, { holds: d.holds, paidCoins: d.paidCoins });
        tx.set(r.userDay, { ...d.userDay, updatedAt: Ts.fromMillis(p.now) }, { merge: true });
        tx.create(r.ledger, {
          type: 'pool',
          coins: d.coins,
          rupees: d.coins / 100,
          partner: 'app',
          status: 'pending',
          day: p.day,
          slotId: p.slotId,
          taskType: slotDoc.taskType,
          holdUntil: Ts.fromMillis(p.now + POOL_HOLD_MS),
          createdAt: Ts.fromMillis(p.now),
        });
        return { ok: true, payload: { ok: true, slotId: p.slotId, coins: d.coins } };
      });
      send(res, out);
    } catch (e) {
      console.error('taskPoolComplete failed', e && e.message);
      res.status(500).json({ ok: false, code: 'error', message: MESSAGES.error });
    }
  }

  // Scheduled (e.g. every 15-30 min): today's expired claims back to open + stale holds dropped
  async function taskPoolSweep() {
    const now = nowMs();
    const day = istDateKey(now);
    const poolRef = db.doc(`taskPool/${day}`);
    const claimed = await db.collection(`taskPool/${day}/slots`).where('status', '==', 'claimed').limit(500).get();
    let reopened = 0;
    for (const s of claimed.docs) {
      await db.runTransaction(async tx => {
        const again = await tx.get(s.ref);
        if (!again.exists) return;
        const x = again.data();
        if (x.status !== 'claimed' || toMs(x.claimExpiresAt) > now) return;
        tx.update(s.ref, {
          status: 'open',
          claimedBy: null,
          claimedAt: null,
          claimExpiresAt: null,
          baseline: admin.firestore.FieldValue.delete(),
        });
        reopened++;
      });
    }
    await db.runTransaction(async tx => {
      const ps = await tx.get(poolRef);
      if (!ps.exists) return;
      tx.update(poolRef, { holds: liveHolds((ps.data() || {}).holds, now).holds });
    });
    return { day, reopened };
  }

  return { taskPoolClaim, taskPoolComplete, taskPoolSweep };
}

module.exports = {
  TASK_TYPES,
  DEFAULTS,
  LIMITS,
  EARN_MAX_ADS_PER_DAY,
  istDateKey,
  readPool,
  liveHolds,
  slotStatus,
  taskDone,
  taskStillPossible,
  decideClaim,
  decideComplete,
  MESSAGES,
  makeTaskPoolHandlers,
};
