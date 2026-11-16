/* global crypto, TextEncoder, TextDecoder, atob */
// Firebase Auth ID token check for the Worker (no Admin SDK): RS256 JWT signed by
// securetoken@system.gserviceaccount.com, per firebase.google.com/docs/auth/admin/verify-id-tokens
//   header.alg == RS256, header.kid in Google's current keys
//   payload.aud == project id, iss == https://securetoken.google.com/<project id>
//   exp in the future, iat / auth_time not in the future, sub (= uid) non-empty
// Keys are cached for their Cache-Control max-age. fetch and clock are injectable for tests.
import { OWNER_EMAILS, PROJECT_ID } from './config.js';

export const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const enc = new TextEncoder();
const SKEW_SEC = 300;

const b64urlBytes = s => {
  const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
};
const b64urlJson = s => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

let jwks = { keys: null, expiresAt: 0 };
export const clearJwksCache = () => {
  jwks = { keys: null, expiresAt: 0 };
};

async function getKeys(fetchImpl, now) {
  if (jwks.keys && jwks.expiresAt > now) {
    return jwks.keys;
  }
  const res = await fetchImpl(JWKS_URL);
  if (!res.ok) {
    throw new Error(`jwks fetch failed: ${res.status}`);
  }
  const body = await res.json();
  const cc = (res.headers && res.headers.get && res.headers.get('cache-control')) || '';
  const m = /max-age=(\d+)/.exec(cc);
  const maxAge = m ? Number(m[1]) : 3600;
  jwks = { keys: Array.isArray(body && body.keys) ? body.keys : [], expiresAt: now + maxAge * 1000 };
  return jwks.keys;
}

export class AuthError extends Error {}

// Returns { uid, email, emailVerified, provider } or throws AuthError.
export async function verifyFirebaseToken(token, { projectId = PROJECT_ID, fetchImpl = fetch, now = Date.now() } = {}) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw new AuthError('malformed token');
  }
  let header;
  let payload;
  try {
    header = b64urlJson(parts[0]);
    payload = b64urlJson(parts[1]);
  } catch (e) {
    throw new AuthError('malformed token');
  }
  if (header.alg !== 'RS256' || !header.kid) {
    throw new AuthError('bad alg');
  }
  const nowSec = Math.floor(now / 1000);
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new AuthError('wrong project');
  }
  if (!(Number(payload.exp) > nowSec)) {
    throw new AuthError('expired');
  }
  if (Number(payload.iat) > nowSec + SKEW_SEC || Number(payload.auth_time || 0) > nowSec + SKEW_SEC) {
    throw new AuthError('issued in the future');
  }
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) {
    throw new AuthError('no uid');
  }
  const keys = await getKeys(fetchImpl, now);
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) {
    throw new AuthError('unknown key');
  }
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  if (!ok) {
    throw new AuthError('bad signature');
  }
  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null,
    emailVerified: payload.email_verified === true,
    provider: (payload.firebase && payload.firebase.sign_in_provider) || null,
  };
}

// Owner = verified email in OWNER_EMAILS (same as isOwner() in firestore.rules)
export const isOwner = user => !!user && user.emailVerified === true && !!user.email && OWNER_EMAILS.includes(user.email);

export const bearer = request => {
  const h = (request.headers && request.headers.get && request.headers.get('authorization')) || '';
  return /^Bearer\s+(.+)$/i.test(h) ? h.replace(/^Bearer\s+/i, '').trim() : '';
};
