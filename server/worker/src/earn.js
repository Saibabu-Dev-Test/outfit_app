/* global crypto, TextEncoder */
// Partner postbacks other than BitLabs (bitlabs.js) + the D1 earn ledger. Credits are written ONLY
// here (server side); the app can read its own rows (GET /v1/earnings) but never write them.
//   CPX Research:  GET /cpxPostback?user_id=&trans_id=&amount_local=&status=&hash=
//                  hash = md5(trans_id + '-' + CPX_SECURE_HASH); status 2 = reversal; amount in INR
//   Offerwall.GG:  GET or POST /offerwallPostback?user={userId}&tx={transactionId}&amount={currencyAmount}
//                  &status={status}&sig={signature}&payout={payoutUsd}&test={test}
//                  sig = hex HMAC-SHA256("userId:transactionId:currencyAmount", OFFERWALL_GG_SECRET)
//                  (offerwall.gg/developers/postbacks). Placement currency = coins at 8300 per USD
//                  (100 coins per rupee x USD_TO_INR), so currencyAmount is the full payout in coins
//                  and the user gets USER_SHARE of it. status=reversed / negative amount = reversal
//                  (same transactionId). test=1 never credits.
// Every handler answers 503 'not configured' until its secret is set (wrangler secret put).
import { COINS_PER_RUPEE, HOLD_DAYS, USD_TO_INR, USER_SHARE, safeId, timingSafeEqual, userCoins } from './bitlabs.js';
import { md5Hex } from './md5.js';

const enc = new TextEncoder();
const toHex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');

export async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

const NOT_CONFIGURED = { status: 503, body: 'not configured' };
const round2 = n => Math.round(n * 100) / 100;

// Shared shape with bitlabs.js plans: { status, body, write?: { op, docPath, fields, serverTime } }
const creditWrite = (uid, id, { type, coins, partner, activity, usd, ownerRupees }, now) => ({
  op: 'create',
  docPath: `users/${uid}/earnings/${id}`,
  fields: {
    type,
    coins,
    rupees: coins / COINS_PER_RUPEE,
    partner,
    status: 'pending',
    activity,
    ...(usd === null || usd === undefined ? {} : { usd }),
    ownerRupees,
    holdUntil: new Date(now + HOLD_DAYS * 86400000),
  },
  serverTime: ['createdAt'],
});

const reverseWrite = (uid, id, partner, extra = {}) => ({
  op: 'merge',
  docPath: `users/${uid}/earnings/${id}`,
  fields: { status: 'reversed', partner, ...extra },
  serverTime: ['reversedAt'],
});

export const cpxHashFor = (uid, secret) => md5Hex(`${uid}-${secret}`);

export function planCpxPostback({ query, secret, now = Date.now() }) {
  if (!secret) {
    return NOT_CONFIGURED;
  }
  const uid = String(query.user_id || query.ext_user_id || '');
  const trans = String(query.trans_id || '');
  if (!safeId(uid) || !safeId(trans)) {
    return { status: 400, body: 'bad params' };
  }
  if (!timingSafeEqual(String(query.hash || '').toLowerCase(), md5Hex(`${trans}-${secret}`))) {
    return { status: 403, body: 'bad hash' };
  }
  if (String(query.status) === '2') {
    return { status: 200, body: '1', write: reverseWrite(uid, `cpx_${trans}`, 'cpx') };
  }
  const payout = Number(query.amount_local || 0); // app currency (set INR in CPX)
  const coins = userCoins(payout);
  if (!(payout > 0) || coins <= 0) {
    return { status: 200, body: '1' };
  }
  return {
    status: 200,
    body: '1',
    write: creditWrite(uid, `cpx_${trans}`, { type: 'survey', coins, partner: 'cpx', activity: 'COMPLETE', ownerRupees: round2(payout * (1 - USER_SHARE)) }, now),
  };
}

const pick = (q, names) => {
  for (const n of names) {
    if (q[n] !== undefined && q[n] !== null && q[n] !== '') {
      return String(q[n]);
    }
  }
  return '';
};

export async function planOfferwallPostback({ query, secret, now = Date.now() }) {
  if (!secret) {
    return NOT_CONFIGURED;
  }
  const uid = pick(query, ['user', 'userId', 'user_id', 'subid']);
  const tx = pick(query, ['tx', 'transactionId', 'txid', 'trans_id']);
  const amountRaw = pick(query, ['amount', 'currencyAmount', 'points', 'reward']);
  const sig = pick(query, ['sig', 'signature', 'hash']).toLowerCase();
  if (!safeId(uid) || !safeId(tx) || !amountRaw) {
    return { status: 400, body: 'bad params' };
  }
  // Signed over the three fields exactly as sent (no re-formatting of the amount)
  const want = await hmacSha256Hex(secret, `${uid}:${tx}:${amountRaw}`);
  if (!timingSafeEqual(sig, want)) {
    return { status: 403, body: 'bad sig' };
  }
  if (String(query.test || '') === '1') {
    return { status: 200, body: 'OK' }; // dashboard test button: never credit
  }
  const amount = Number(amountRaw);
  const status = String(query.status || 'credited').toLowerCase();
  if (status === 'reversed' || amount < 0) {
    return { status: 200, body: 'OK', write: reverseWrite(uid, `offerwall_${tx}`, 'offerwall') };
  }
  // Round the credit DOWN (Offerwall.GG: credit down, reverse whole entry)
  const coins = Math.max(0, Math.floor(amount * USER_SHARE));
  if (!(amount > 0) || coins <= 0) {
    return { status: 200, body: 'OK' };
  }
  const usd = Number(pick(query, ['payout', 'payoutUsd']));
  const fullRupees = amount / COINS_PER_RUPEE;
  return {
    status: 200,
    body: 'OK',
    write: creditWrite(
      uid,
      `offerwall_${tx}`,
      { type: 'offer', coins, partner: 'offerwall', activity: 'COMPLETE', usd: Number.isFinite(usd) && usd > 0 ? usd : null, ownerRupees: round2(fullRupees * (1 - USER_SHARE)) },
      now,
    ),
  };
}

// ── D1 ledger ──
const parseDocPath = p => {
  const m = /^users\/([^/]+)\/earnings\/([^/]+)$/.exec(String(p || ''));
  return m ? { uid: m[1], id: m[2] } : null;
};

// Applies one planned write to D1. Returns 'created' | 'duplicate' | 'updated'.
export async function applyEarningToD1(db, write, now = Date.now()) {
  const at = parseDocPath(write.docPath);
  if (!at) {
    throw new Error('bad earnings path');
  }
  const f = write.fields || {};
  if (write.op === 'create') {
    const r = await db.run(
      `INSERT OR IGNORE INTO earnings (uid, id, type, partner, status, coins, rupees, owner_rupees, usd, activity, hold_until, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      at.uid,
      at.id,
      String(f.type || 'offer'),
      String(f.partner || ''),
      String(f.status || 'pending'),
      Number(f.coins || 0),
      Number(f.rupees || 0),
      Number(f.ownerRupees || 0),
      f.usd === undefined ? null : Number(f.usd),
      f.activity ? String(f.activity) : null,
      f.holdUntil instanceof Date ? f.holdUntil.getTime() : null,
      now,
      now,
    );
    return r && r.meta && r.meta.changes === 0 ? 'duplicate' : 'created';
  }
  // merge (reversal): mark the original reversed; keep a reversed placeholder if it never arrived
  await db.run(
    `INSERT INTO earnings (uid, id, type, partner, status, coins, rupees, owner_rupees, reconciliation_tx, created_at, updated_at)
     VALUES (?, ?, 'offer', ?, 'reversed', 0, 0, 0, ?, ?, ?)
     ON CONFLICT (uid, id) DO UPDATE SET status = 'reversed', reconciliation_tx = excluded.reconciliation_tx, updated_at = excluded.updated_at`,
    at.uid,
    at.id,
    String(f.partner || ''),
    f.reconciliationTx ? String(f.reconciliationTx) : null,
    now,
    now,
  );
  return 'updated';
}

// Daily job: pending survey / offer credits past their hold -> approved
export async function releaseHeld(db, now = Date.now()) {
  const r = await db.run(
    "UPDATE earnings SET status = 'approved', updated_at = ? WHERE status = 'pending' AND hold_until IS NOT NULL AND hold_until <= ?",
    now,
    now,
  );
  return (r && r.meta && r.meta.changes) || 0;
}

export const rowToEarning = r => ({
  id: r.id,
  type: r.type,
  partner: r.partner,
  status: r.status,
  coins: Number(r.coins) || 0,
  rupees: Number(r.rupees) || 0,
  createdAt: Number(r.created_at) || 0,
  holdUntil: r.hold_until === null || r.hold_until === undefined ? null : Number(r.hold_until),
});

export { USD_TO_INR };
