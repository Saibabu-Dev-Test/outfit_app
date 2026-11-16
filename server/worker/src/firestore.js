/* global crypto, TextEncoder, btoa, atob */
// Minimal Firestore REST client for the Worker: Google service-account OAuth (RS256 JWT signed
// with WebCrypto) + documents:commit. Server writes bypass Firestore security rules.
// fetch is injectable for tests; the access token is cached in memory until shortly before expiry.

const SCOPE = 'https://www.googleapis.com/auth/datastore';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const enc = new TextEncoder();

const b64url = bytes => {
  let s = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) {
    s += String.fromCharCode(arr[i]);
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]+$/, '');
};
const b64urlJson = obj => b64url(enc.encode(JSON.stringify(obj)));

function pemToPkcs8(pem) {
  const body = String(pem)
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out.buffer;
}

export function parseServiceAccount(json) {
  const sa = typeof json === 'string' ? JSON.parse(json) : json;
  if (!sa || !sa.client_email || !sa.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing client_email / private_key');
  }
  return sa;
}

export async function signJwt(sa, nowSec) {
  const header = { alg: 'RS256', typ: 'JWT' };
  if (sa.private_key_id) {
    header.kid = sa.private_key_id;
  }
  const claims = {
    iss: sa.client_email,
    sub: sa.client_email,
    scope: SCOPE,
    aud: sa.token_uri || DEFAULT_TOKEN_URI,
    iat: nowSec,
    exp: nowSec + 3600,
  };
  const unsigned = `${b64urlJson(header)}.${b64urlJson(claims)}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned));
  return `${unsigned}.${b64url(sig)}`;
}

let cached = null; // { key, token, expiresAt (ms) }

export function clearTokenCache() {
  cached = null;
}

export async function getAccessToken(sa, { fetchImpl = fetch, now = Date.now() } = {}) {
  const cacheKey = `${sa.client_email}|${sa.private_key_id || ''}`;
  if (cached && cached.key === cacheKey && cached.expiresAt - 60000 > now) {
    return cached.token;
  }
  const assertion = await signJwt(sa, Math.floor(now / 1000));
  const res = await fetchImpl(sa.token_uri || DEFAULT_TOKEN_URI, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${assertion}`,
  });
  if (!res.ok) {
    throw new Error(`token request failed: ${res.status}`);
  }
  const data = await res.json();
  if (!data || !data.access_token) {
    throw new Error('token response has no access_token');
  }
  cached = {
    key: cacheKey,
    token: data.access_token,
    expiresAt: now + Number(data.expires_in || 3600) * 1000,
  };
  return cached.token;
}

// JS value -> Firestore REST typed value (numbers follow the Admin SDK: safe integers are
// integerValue, everything else doubleValue).
export function toValue(v) {
  if (v === null || v === undefined) {
    return { nullValue: null };
  }
  if (v instanceof Date) {
    return { timestampValue: v.toISOString() };
  }
  if (typeof v === 'boolean') {
    return { booleanValue: v };
  }
  if (typeof v === 'number') {
    return Number.isSafeInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') {
    return { stringValue: v };
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toValue) } };
  }
  return { mapValue: { fields: toFields(v) } };
}

export const toFields = obj =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]));

// Build the documents:commit body for one write planned by planBitlabsCallback.
export function commitBody(projectId, write) {
  const name = `projects/${projectId}/databases/(default)/documents/${write.docPath}`;
  const w = {
    update: { name, fields: toFields(write.fields) },
    updateTransforms: (write.serverTime || []).map(fieldPath => ({
      fieldPath,
      setToServerValue: 'REQUEST_TIME',
    })),
  };
  if (write.op === 'create') {
    w.currentDocument = { exists: false };
  } else {
    w.updateMask = { fieldPaths: Object.keys(write.fields) };
  }
  return { writes: [w] };
}

export class AlreadyExistsError extends Error {}

// Runs one write. Throws AlreadyExistsError when a create hits an existing document (HTTP 409),
// any other Error on a storage failure.
export async function commitWrite({ projectId, serviceAccount, write, fetchImpl = fetch, now }) {
  const token = await getAccessToken(serviceAccount, { fetchImpl, now });
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(commitBody(projectId, write)),
  });
  if (res.ok) {
    return;
  }
  let text = '';
  try {
    text = await res.text();
  } catch (e) {
    text = '';
  }
  if (write.op === 'create' && (res.status === 409 || /ALREADY_EXISTS/.test(text))) {
    throw new AlreadyExistsError('document already exists');
  }
  throw new Error(`firestore commit failed: ${res.status} ${text.slice(0, 200)}`);
}
