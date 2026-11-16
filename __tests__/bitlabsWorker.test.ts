// BitLabs callback on the free Cloudflare Worker (server/worker). Tests stay on the pure /
// injectable modules (no Workers runtime, no wrangler): WebCrypto comes from Node 22.
const nodeCrypto = require('crypto');
const NodeBuffer = require('buffer').Buffer;
if (!(globalThis as any).crypto?.subtle) {
  (globalThis as any).crypto = nodeCrypto.webcrypto;
}
const {
  bitlabsUserCoins,
  verifyBitlabsHash,
  bitlabsCallbackUrl,
  pathAndQuery,
  timingSafeEqual,
  planBitlabsCallback,
  USD_TO_INR,
  HOLD_DAYS,
} = require('../server/worker/src/bitlabs.js');
const { handleBitlabsPostback } = require('../server/worker/src/handler.js');
const { clearTokenCache, commitBody, toValue } = require('../server/worker/src/firestore.js');
const legacy = require('../server/earn/index.js');

const SECRET = 'test-secret';
const BASE = 'https://outfit-earn.example.workers.dev';
const sign = (url: string, secret = SECRET) =>
  `${url}&hash=${nodeCrypto.createHmac('sha1', secret).update(url).digest('hex')}`;
const signed = (p: string) => sign(BASE + p);

const { privateKey } = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const SERVICE_ACCOUNT = JSON.stringify({
  type: 'service_account',
  project_id: 'outfit-vote-9edca',
  private_key_id: 'kid1',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  client_email: 'earn@outfit-vote-9edca.iam.gserviceaccount.com',
  token_uri: 'https://oauth2.googleapis.com/token',
});
const ENV = { BITLABS_SECRET: SECRET, FIREBASE_SERVICE_ACCOUNT: SERVICE_ACCOUNT, FIREBASE_PROJECT_ID: 'outfit-vote-9edca' };

type Call = { url: string; init: any };
// fetch stand-in: OAuth token endpoint + Firestore documents:commit (create fails with 409 on an existing doc)
function fakeFirestore(opts: { commitStatus?: number } = {}) {
  const calls: Call[] = [];
  const docs = new Map<string, any>();
  const reply = (status: number, body: any) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  const fetchImpl = jest.fn(async (url: string, init: any) => {
    calls.push({ url, init });
    if (url === 'https://oauth2.googleapis.com/token') {
      return reply(200, { access_token: 'ya29.test', expires_in: 3600 });
    }
    if (url.endsWith('/documents:commit')) {
      if (opts.commitStatus) {
        return reply(opts.commitStatus, { error: { status: 'INTERNAL' } });
      }
      const w = JSON.parse(init.body).writes[0];
      const path = w.update.name.split('/documents/')[1];
      if (w.currentDocument && w.currentDocument.exists === false && docs.has(path)) {
        return reply(409, { error: { code: 409, status: 'ALREADY_EXISTS' } });
      }
      docs.set(path, { ...(w.updateMask ? docs.get(path) || {} : {}), ...w.update.fields, _transforms: w.updateTransforms });
      return reply(200, { writeResults: [{}] });
    }
    return reply(404, 'unexpected');
  });
  return { fetchImpl, calls, docs };
}

const run = (fs: ReturnType<typeof fakeFirestore>, p: string, env: any = ENV) =>
  handleBitlabsPostback({ url: signed(p), env, fetchImpl: fs.fetchImpl, now: Date.UTC(2026, 10, 15) });

beforeEach(() => clearTokenCache());

describe('earn-worker: pure logic', () => {
  test('coin math matches the Cloud Functions handler', () => {
    expect(USD_TO_INR).toBe(83);
    expect(bitlabsUserCoins(1)).toBe(Math.floor(1 * 83 * 0.65 * 100));
    expect(bitlabsUserCoins(1)).toBe(5395);
    expect(bitlabsUserCoins(0.1)).toBe(539);
    expect(bitlabsUserCoins(0)).toBe(0);
    expect(bitlabsUserCoins(-2)).toBe(0);
    [0.01, 0.37, 1, 2.5, 12.34].forEach(v => expect(bitlabsUserCoins(v)).toBe(legacy.bitlabsUserCoins(v)));
  });

  test('valid hash accepted (BitLabs docs example + our own signature)', async () => {
    const docUrl =
      'https://publisher.com/complete?uid=8cc877ee-af19-488d-b28d-216fb866b996&val=500&hash=dbcd6bb8ca677344592842a52b4fca9bec36cd4b';
    expect(await verifyBitlabsHash(docUrl, 'JLOIAUNMHFli7ZJOQVEzm98rzqnm9')).toBe(true);
    const ok = signed('/bitlabsPostback?uid=u1&val=1.5&tx=t1&type=COMPLETE');
    expect(await verifyBitlabsHash(ok, SECRET)).toBe(true);
    expect(await verifyBitlabsHash(ok.toUpperCase().replace(/^.*&HASH=/, ok.split('&hash=')[0] + '&hash='), SECRET)).toBe(true);
  });

  test('tampered hash / wrong secret / missing hash rejected', async () => {
    const ok = signed('/bitlabsPostback?uid=u1&val=1.5&tx=t1&type=COMPLETE');
    expect(await verifyBitlabsHash(ok.replace('val=1.5', 'val=9.5'), SECRET)).toBe(false);
    expect(await verifyBitlabsHash(ok.slice(0, -1) + (ok.endsWith('0') ? '1' : '0'), SECRET)).toBe(false);
    expect(await verifyBitlabsHash(ok, 'other')).toBe(false);
    expect(await verifyBitlabsHash(`${BASE}/bitlabsPostback?uid=u1&val=1`, SECRET)).toBe(false);
    expect(await verifyBitlabsHash(ok, '')).toBe(false);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
  });

  test('callback URL: request URL as called, or pinned base + raw path/query', () => {
    const raw = 'http://internal.host/bitlabsPostback?uid=a%20b&tx=1&hash=x';
    expect(pathAndQuery(raw)).toBe('/bitlabsPostback?uid=a%20b&tx=1&hash=x');
    expect(bitlabsCallbackUrl(raw)).toBe(raw);
    expect(bitlabsCallbackUrl(raw, 'https://outfit-earn.x.workers.dev/')).toBe(
      'https://outfit-earn.x.workers.dev/bitlabsPostback?uid=a%20b&tx=1&hash=x',
    );
  });

  test('reconciliation targets ref, falling back to tx', async () => {
    const byRef = await planBitlabsCallback({ url: signed('/bitlabsPostback?uid=u1&val=-1&tx=t9&type=RECONCILIATION&ref=t1'), secret: SECRET });
    expect(byRef.write).toMatchObject({ op: 'merge', docPath: 'users/u1/earnings/bitlabs_t1', fields: { status: 'reversed', partner: 'bitlabs', reconciliationTx: 't9' } });
    const noRef = await planBitlabsCallback({ url: signed('/bitlabsPostback?uid=u1&val=-1&tx=t2&type=RECONCILIATION&ref='), secret: SECRET });
    expect(noRef.write.docPath).toBe('users/u1/earnings/bitlabs_t2');
    const badRef = await planBitlabsCallback({ url: signed('/bitlabsPostback?uid=u1&val=-1&tx=t3&type=reconciliation&ref=a%2Fb'), secret: SECRET });
    expect(badRef.write.docPath).toBe('users/u1/earnings/bitlabs_t3');
  });

  test('typed Firestore values and commit body', () => {
    expect(toValue(5395)).toEqual({ integerValue: '5395' });
    expect(toValue(53.95)).toEqual({ doubleValue: 53.95 });
    expect(toValue('x')).toEqual({ stringValue: 'x' });
    expect(toValue(new Date(0))).toEqual({ timestampValue: '1970-01-01T00:00:00.000Z' });
    const create = commitBody('p', { op: 'create', docPath: 'users/u/earnings/bitlabs_t', fields: { a: 1 }, serverTime: ['createdAt'] });
    expect(create.writes[0]).toMatchObject({
      update: { name: 'projects/p/databases/(default)/documents/users/u/earnings/bitlabs_t' },
      currentDocument: { exists: false },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
    });
    const merge = commitBody('p', { op: 'merge', docPath: 'd/x', fields: { status: 'reversed' }, serverTime: ['reversedAt'] });
    expect(merge.writes[0].updateMask).toEqual({ fieldPaths: ['status'] });
    expect(merge.writes[0].currentDocument).toBeUndefined();
  });
});

describe('earn-worker: bitlabsPostback handler (mock fetch)', () => {
  test('bad hash -> 403, no fetch', async () => {
    const fs = fakeFirestore();
    const r = await handleBitlabsPostback({
      url: signed('/bitlabsPostback?uid=u1&val=1&tx=t1&type=COMPLETE').replace('val=1', 'val=2'),
      env: ENV,
      fetchImpl: fs.fetchImpl,
    });
    expect(r).toEqual({ status: 403, body: 'bad hash' });
    expect(fs.fetchImpl).not.toHaveBeenCalled();
  });

  test('bad uid / tx -> 400', async () => {
    const fs = fakeFirestore();
    expect((await run(fs, '/bitlabsPostback?uid=&val=1&tx=t1')).status).toBe(400);
    expect((await run(fs, '/bitlabsPostback?uid=u1&val=1&tx=a%2Fb')).status).toBe(400);
    expect(fs.fetchImpl).not.toHaveBeenCalled();
  });

  test('credits 65% as pending with typed fields; duplicate tx answers 200; token cached', async () => {
    const fs = fakeFirestore();
    const now = Date.UTC(2026, 10, 15);
    const r1 = await run(fs, '/bitlabsPostback?uid=u1&val=1&tx=t1&type=COMPLETE');
    expect(r1).toEqual({ status: 200, body: 'OK' });
    const doc = fs.docs.get('users/u1/earnings/bitlabs_t1');
    expect(doc).toMatchObject({
      type: { stringValue: 'offer' },
      coins: { integerValue: '5395' },
      rupees: { doubleValue: 53.95 },
      partner: { stringValue: 'bitlabs' },
      status: { stringValue: 'pending' },
      activity: { stringValue: 'COMPLETE' },
      usd: { integerValue: '1' },
      ownerRupees: { doubleValue: 29.05 },
      holdUntil: { timestampValue: new Date(now + HOLD_DAYS * 86400000).toISOString() },
    });
    expect(doc._transforms).toEqual([{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }]);
    const commit = fs.calls.find(c => c.url.endsWith(':commit'))!;
    expect(commit.url).toBe('https://firestore.googleapis.com/v1/projects/outfit-vote-9edca/databases/(default)/documents:commit');
    expect(commit.init.headers.authorization).toBe('Bearer ya29.test');
    const tokenCall = fs.calls.find(c => c.url.includes('oauth2'))!;
    const assertion = /assertion=([^&]+)/.exec(tokenCall.init.body)![1];
    const [h64, p64, sig64] = assertion.split('.');
    const h = JSON.parse(NodeBuffer.from(h64, 'base64url').toString());
    const p = JSON.parse(NodeBuffer.from(p64, 'base64url').toString());
    // RS256 signature verifies with the service account's public key
    expect(nodeCrypto.verify('RSA-SHA256', NodeBuffer.from(`${h64}.${p64}`), nodeCrypto.createPublicKey(privateKey), NodeBuffer.from(sig64, 'base64url'))).toBe(true);
    expect(h).toMatchObject({ alg: 'RS256', typ: 'JWT' });
    expect(p).toMatchObject({ scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token' });

    const r2 = await run(fs, '/bitlabsPostback?uid=u1&val=1&tx=t1&type=COMPLETE');
    expect(r2).toEqual({ status: 200, body: 'OK' });
    expect(fs.docs.get('users/u1/earnings/bitlabs_t1').coins).toEqual({ integerValue: '5395' });
    expect(fs.calls.filter(c => c.url.includes('oauth2'))).toHaveLength(1); // cached token reused
  });

  test('RECONCILIATION marks the original entry reversed (merge)', async () => {
    const fs = fakeFirestore();
    await run(fs, '/bitlabsPostback?uid=u1&val=1&tx=t1&type=COMPLETE');
    const r = await run(fs, '/bitlabsPostback?uid=u1&val=-1&tx=t9&type=RECONCILIATION&ref=t1');
    expect(r.status).toBe(200);
    const doc = fs.docs.get('users/u1/earnings/bitlabs_t1');
    expect(doc.status).toEqual({ stringValue: 'reversed' });
    expect(doc.coins).toEqual({ integerValue: '5395' }); // merge keeps the rest
    expect(doc.reconciliationTx).toEqual({ stringValue: 't9' });
  });

  test('$0 payout -> 200 with no write (no fetch at all)', async () => {
    const fs = fakeFirestore();
    const r = await run(fs, '/bitlabsPostback?uid=u1&val=0&tx=t3&type=SCREENOUT');
    expect(r).toEqual({ status: 200, body: 'OK' });
    expect(fs.fetchImpl).not.toHaveBeenCalled();
    expect(fs.docs.size).toBe(0);
  });

  test('storage error -> 500 (BitLabs retries)', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const fs = fakeFirestore({ commitStatus: 503 });
    expect(await run(fs, '/bitlabsPostback?uid=u1&val=1&tx=t5')).toEqual({ status: 500, body: 'error' });
    // No D1 and no service account: nowhere to record the credit -> 503 (BitLabs retries later)
    expect(await run(fs, '/bitlabsPostback?uid=u1&val=1&tx=t6', { BITLABS_SECRET: SECRET })).toEqual({ status: 503, body: 'not configured' });
    expect(await run(fs, '/bitlabsPostback?uid=u1&val=1&tx=t7', {})).toEqual({ status: 503, body: 'not configured' });
    errSpy.mockRestore();
  });
});
