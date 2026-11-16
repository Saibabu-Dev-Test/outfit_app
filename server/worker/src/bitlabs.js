/* global crypto, TextEncoder */
// Pure BitLabs callback logic shared by the Cloudflare Worker (src/index.js) and the jest tests.
// Only standard Web APIs (WebCrypto, TextEncoder): runs on Workers and on Node 22
// (globalThis.crypto.subtle). Same numbers and rules as bitlabsPostback in server/earn/index.js.
import { bitlabsCategory, bitlabsTaskName } from './report.js';

export const USER_SHARE = 0.65;
export const COINS_PER_RUPEE = 100;
export const HOLD_DAYS = 5; // within the agreed 3-7 day window
// BitLabs pays in USD ([%VALUE:USD%]); users are credited in INR coins. Fixed rate, reviewed by hand
// (keep in step with USD_TO_INR in server/earn/index.js).
export const USD_TO_INR = 83;

export const userCoins = payoutRupees =>
  Math.max(0, Math.floor(payoutRupees * USER_SHARE * COINS_PER_RUPEE));

export const bitlabsUserCoins = usd => userCoins(Number(usd || 0) * USD_TO_INR);

export const safeId = v =>
  typeof v === 'string' && v.length > 0 && v.length <= 255 && !/[/]/.test(v);

const enc = new TextEncoder();

const toHex = buf =>
  Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');

// Constant-time string compare (no early exit on the first differing character).
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i); // eslint-disable-line no-bitwise
  }
  return diff === 0;
}

export async function hmacSha1Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

// BitLabs callback hash (developer.bitlabs.ai/docs/securing-callbacks-through-hashing): hex
// HMAC-SHA1 of the exact URL BitLabs called, up to (not including) '&hash=', keyed with the app
// Secret Key. The URL must not be re-encoded/decoded before hashing.
export async function verifyBitlabsHash(fullUrl, secret) {
  if (!secret || typeof fullUrl !== 'string') {
    return false;
  }
  const i = fullUrl.lastIndexOf('&hash=');
  if (i < 0) {
    return false;
  }
  const given = fullUrl.slice(i + 6).split('&')[0].toLowerCase();
  const want = await hmacSha1Hex(secret, fullUrl.slice(0, i));
  return timingSafeEqual(given, want);
}

// Path + query of a URL exactly as written (no URL() parsing, which could re-encode it).
export function pathAndQuery(rawUrl) {
  const s = String(rawUrl || '');
  const scheme = s.indexOf('://');
  if (scheme < 0) {
    return s;
  }
  const slash = s.indexOf('/', scheme + 3);
  const q = s.indexOf('?', scheme + 3);
  const cut = slash < 0 ? q : q < 0 ? slash : Math.min(slash, q);
  return cut < 0 ? '' : s.slice(cut);
}

// The URL BitLabs actually called. On Workers request.url is that URL; BITLABS_CALLBACK_BASE (e.g.
// 'https://outfit-earn.example.workers.dev') can pin the scheme + host exactly.
export function bitlabsCallbackUrl(requestUrl, base) {
  if (base) {
    return String(base).replace(/\/+$/, '') + pathAndQuery(requestUrl);
  }
  return String(requestUrl || '');
}

// Query parameters (decoded like Express req.query for flat key=value pairs).
export function queryParams(rawUrl) {
  const s = String(rawUrl || '');
  const i = s.indexOf('?');
  const out = {};
  if (i < 0) {
    return out;
  }
  new URLSearchParams(s.slice(i + 1).split('#')[0]).forEach((v, k) => {
    if (!(k in out)) {
      out[k] = v;
    }
  });
  return out;
}

// Decide what a verified-or-not callback should do. Returns
//   { status, body }                         answer now, nothing to write
//   { status, body, write: { op, docPath, fields } }   write first, then answer
// op 'create' = create-if-absent (duplicate tx is fine); op 'merge' = set with merge.
// Timestamps in fields are Date objects; serverTime lists fields set to the server's request time.
export async function planBitlabsCallback({ url, secret, base, now = Date.now() }) {
  if (!(await verifyBitlabsHash(bitlabsCallbackUrl(url, base), secret))) {
    return { status: 403, body: 'bad hash' };
  }
  const q = queryParams(url);
  const uid = String(q.uid || '');
  const tx = String(q.tx || '');
  const type = String(q.type || 'COMPLETE').toUpperCase();
  if (!safeId(uid) || !safeId(tx)) {
    return { status: 400, body: 'bad params' };
  }

  if (type === 'RECONCILIATION') {
    const orig = safeId(String(q.ref || '')) ? String(q.ref) : tx;
    return {
      status: 200,
      body: 'OK',
      write: {
        op: 'merge',
        docPath: `users/${uid}/earnings/bitlabs_${orig}`,
        fields: { status: 'reversed', partner: 'bitlabs', reconciliationTx: tx },
        serverTime: ['reversedAt'],
      },
    };
  }

  const usd = Number(q.val || 0);
  const coins = bitlabsUserCoins(usd);
  if (!(usd > 0) || coins <= 0) {
    return { status: 200, body: 'OK' }; // $0 / screenout: nothing to credit
  }
  const rupees = usd * USD_TO_INR;
  const category = bitlabsCategory(q);
  const taskName = bitlabsTaskName(q);
  return {
    status: 200,
    body: 'OK',
    write: {
      op: 'create',
      docPath: `users/${uid}/earnings/bitlabs_${tx}`,
      fields: {
        type: 'offer',
        coins,
        rupees: coins / COINS_PER_RUPEE,
        partner: 'bitlabs',
        status: 'pending',
        activity: type,
        usd,
        ownerRupees: Math.round(rupees * (1 - USER_SHARE) * 100) / 100,
        // Reporting only (owner's Earnings): what BitLabs says the task was, its name, full payout
        ...(category ? { category } : {}),
        ...(taskName ? { taskName } : {}),
        payoutRupees: Math.round(rupees * 100) / 100,
        holdUntil: new Date(now + HOLD_DAYS * 86400000),
      },
      serverTime: ['createdAt'],
    },
  };
}
