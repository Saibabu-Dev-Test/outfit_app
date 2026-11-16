// Free earn server on Cloudflare Workers (no card needed). Replaces Cloud Functions/Blaze for:
//   GET /bitlabsPostback  BitLabs reward + reconciliation callback (same rules as server/earn/index.js)
//   cron (daily)          releaseHeld: pending survey/offer earnings past holdUntil -> 'approved'
// Firestore is reached over REST with a Firebase service account (secret FIREBASE_SA_JSON).
// Secrets (wrangler secret / GitHub Actions): FIREBASE_SA_JSON, BITLABS_SECRET.
const USER_SHARE = 0.65, COINS_PER_RUPEE = 100, HOLD_DAYS = 5, USD_TO_INR = 83;
const PROJECT = 'outfit-vote-9edca';
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const b64url = s => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const safeId = v => typeof v === 'string' && v.length > 0 && v.length <= 255 && !/[\/]/.test(v);

export async function verifyBitlabsHash(fullUrl, secret) {
  if (!secret) return false;
  const i = fullUrl.lastIndexOf('&hash=');
  if (i < 0) return false;
  const given = fullUrl.slice(i + 6).split('&')[0].toLowerCase();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const want = hex(await crypto.subtle.sign('HMAC', key, enc.encode(fullUrl.slice(0, i))));
  if (given.length !== want.length) return false;
  let d = 0;
  for (let k = 0; k < want.length; k++) d |= want.charCodeAt(k) ^ given.charCodeAt(k);
  return d === 0;
}

let cached = { token: '', exp: 0 };
async function accessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cached.token && cached.exp - 60 > now) return cached.token;
  const sa = JSON.parse(env.FIREBASE_SA_JSON);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${head}.${body}`));
  const jwt = `${head}.${body}.${b64url(String.fromCharCode(...new Uint8Array(sig)))}`;
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}` });
  const j = await r.json();
  if (!j.access_token) throw new Error('token');
  cached = { token: j.access_token, exp: now + (j.expires_in || 3600) };
  return cached.token;
}

const fv = v => typeof v === 'string' ? { stringValue: v } : Number.isInteger(v) ? { integerValue: String(v) }
  : typeof v === 'number' ? { doubleValue: v } : v instanceof Date ? { timestampValue: v.toISOString() } : { nullValue: null };
const fields = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fv(v)]));

async function fs(env, method, path, body) {
  return fetch(FS + path, { method, headers: { authorization: `Bearer ${await accessToken(env)}`,
    'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
}

export async function bitlabsPostback(request, env) {
  const url = request.url;
  if (!(await verifyBitlabsHash(url, env.BITLABS_SECRET))) return new Response('bad hash', { status: 403 });
  const q = new URL(url).searchParams;
  const uid = q.get('uid') || '', tx = q.get('tx') || '';
  const type = (q.get('type') || 'COMPLETE').toUpperCase();
  if (!safeId(uid) || !safeId(tx)) return new Response('bad params', { status: 400 });
  if (type === 'RECONCILIATION') {
    const orig = safeId(q.get('ref') || '') ? q.get('ref') : tx;
    const r = await fs(env, 'PATCH', `/users/${uid}/earnings/bitlabs_${orig}?updateMask.fieldPaths=status&updateMask.fieldPaths=partner&updateMask.fieldPaths=reversedAt&updateMask.fieldPaths=reconciliationTx`,
      { fields: fields({ status: 'reversed', partner: 'bitlabs', reversedAt: new Date(), reconciliationTx: tx }) });
    return r.ok ? new Response('OK') : new Response('error', { status: 500 });
  }
  const usd = Number(q.get('val') || 0);
  const rupees = usd * USD_TO_INR;
  const coins = Math.max(0, Math.floor(rupees * USER_SHARE * COINS_PER_RUPEE));
  if (!(usd > 0) || coins <= 0) return new Response('OK');
  const r = await fs(env, 'POST', `/users/${uid}/earnings?documentId=bitlabs_${encodeURIComponent(tx)}`, { fields: fields({
    type: 'offer', coins, rupees: coins / COINS_PER_RUPEE, partner: 'bitlabs', status: 'pending', activity: type, usd,
    ownerRupees: Math.round(rupees * (1 - USER_SHARE) * 100) / 100,
    holdUntil: new Date(Date.now() + HOLD_DAYS * 86400000), createdAt: new Date() }) });
  if (r.ok || r.status === 409) return new Response('OK'); // 409 = duplicate tx, already recorded
  return new Response('error', { status: 500 });
}

export async function releaseHeld(env) {
  const r = await fs(env, 'POST', ':runQuery', { structuredQuery: {
    from: [{ collectionId: 'earnings', allDescendants: true }],
    where: { compositeFilter: { op: 'AND', filters: [
      { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'pending' } } },
      { fieldFilter: { field: { fieldPath: 'holdUntil' }, op: 'LESS_THAN_OR_EQUAL', value: { timestampValue: new Date().toISOString() } } }] } },
    limit: 500 } });
  const rows = (await r.json()).filter(x => x.document);
  if (!rows.length) return 0;
  const now = new Date().toISOString();
  await fs(env, 'POST', ':commit', { writes: rows.map(x => ({
    update: { name: x.document.name, fields: { status: { stringValue: 'approved' }, approvedAt: { timestampValue: now } } },
    updateMask: { fieldPaths: ['status', 'approvedAt'] }, currentDocument: { exists: true } })) });
  return rows.length;
}

export default {
  async fetch(request, env) {
    const p = new URL(request.url).pathname;
    if (request.method === 'GET' && p === '/bitlabsPostback') return bitlabsPostback(request, env);
    if (p === '/') return new Response('outfit earn ok');
    return new Response('not found', { status: 404 });
  },
  async scheduled(_e, env, ctx) { ctx.waitUntil(releaseHeld(env)); },
};
