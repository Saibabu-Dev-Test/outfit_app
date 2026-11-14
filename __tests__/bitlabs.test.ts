const crypto = require('crypto');
import { BITLABS_TOKEN, COINS_PER_RUPEE, USER_SHARE, bitlabsWallUrl, isBitlabsConfigured } from '../src/config/earn';
const { makeHandlers, bitlabsUserCoins, verifyBitlabsHash, USD_TO_INR } = require('../server/earn/index.js');

const SECRET = 'test-secret';
const sign = (url: string, secret = SECRET) =>
  `${url}&hash=${crypto.createHmac('sha1', secret).update(url).digest('hex')}`;

// Minimal in-memory Firestore stand-in (create() fails on an existing doc like the real one)
function fakeAdmin() {
  const docs = new Map<string, any>();
  const db = {
    doc: (path: string) => ({
      create: async (data: any) => {
        if (docs.has(path)) {
          const err: any = new Error('6 ALREADY_EXISTS: Document already exists');
          err.code = 6;
          throw err;
        }
        docs.set(path, { ...data });
      },
      set: async (data: any, opts?: { merge?: boolean }) => {
        docs.set(path, opts?.merge ? { ...(docs.get(path) || {}), ...data } : { ...data });
      },
    }),
  };
  const admin = {
    firestore: Object.assign(() => db, {
      FieldValue: { serverTimestamp: () => 'ts' },
      Timestamp: { fromMillis: (ms: number) => ({ ms }), now: () => ({ ms: Date.now() }) },
    }),
    auth: () => ({}),
  };
  return { admin, docs };
}

function fakeRes() {
  const r: any = { code: 200, body: undefined };
  r.status = (c: number) => {
    r.code = c;
    return r;
  };
  r.send = (b: any) => {
    r.body = b;
    return r;
  };
  r.json = r.send;
  return r;
}

const BASE = 'https://cb.example.com';
function call(handlers: any, signedPath: string) {
  const query: Record<string, string> = {};
  signedPath
    .split('?')[1]
    .split('&')
    .forEach(kv => {
      const [k, v = ''] = kv.split('=');
      query[k] = decodeURIComponent(v);
    });
  const res = fakeRes();
  return handlers.bitlabsPostback({ originalUrl: signedPath, query, headers: { host: 'cb.example.com' }, protocol: 'https' }, res).then(() => res);
}
const path = (p: string) => sign(BASE + p).slice(BASE.length);

describe('BitLabs config', () => {
  test('wall URL has uid + token (web.bitlabs.ai)', () => {
    expect(isBitlabsConfigured()).toBe(true);
    expect(bitlabsWallUrl('user 1')).toBe(`https://web.bitlabs.ai/?uid=user%201&token=${BITLABS_TOKEN}`);
  });
});

describe('BitLabs coin math', () => {
  test('65% of USD payout converted to INR coins', () => {
    expect(USD_TO_INR).toBe(83);
    expect(USER_SHARE).toBeCloseTo(0.65);
    // $1.00 -> ₹83 -> user ₹53.95 -> 5395 coins
    expect(bitlabsUserCoins(1)).toBe(Math.floor(1 * 83 * 0.65 * COINS_PER_RUPEE));
    expect(bitlabsUserCoins(1)).toBe(5395);
    expect(bitlabsUserCoins(0.1)).toBe(539);
    expect(bitlabsUserCoins(0)).toBe(0);
    expect(bitlabsUserCoins(-2)).toBe(0);
  });
});

describe('BitLabs hash', () => {
  test('matches the BitLabs docs example', () => {
    const url =
      'https://publisher.com/complete?uid=8cc877ee-af19-488d-b28d-216fb866b996&val=500&hash=dbcd6bb8ca677344592842a52b4fca9bec36cd4b';
    expect(verifyBitlabsHash(url, 'JLOIAUNMHFli7ZJOQVEzm98rzqnm9')).toBe(true);
  });
  test('accepts a correct hash, rejects tampering / wrong secret / missing hash', () => {
    const ok = sign('https://x.com/cb?uid=u1&val=1.5&tx=t1&type=COMPLETE');
    expect(verifyBitlabsHash(ok, SECRET)).toBe(true);
    expect(verifyBitlabsHash(ok.replace('val=1.5', 'val=9.5'), SECRET)).toBe(false);
    expect(verifyBitlabsHash(ok, 'other')).toBe(false);
    expect(verifyBitlabsHash('https://x.com/cb?uid=u1&val=1', SECRET)).toBe(false);
    expect(verifyBitlabsHash(ok, '')).toBe(false);
  });
});

describe('bitlabsPostback', () => {
  test('rejects a bad hash with 403 and writes nothing', async () => {
    const { admin, docs } = fakeAdmin();
    const h = makeHandlers({ admin, secrets: { BITLABS_SECRET: SECRET } });
    const res = await call(h, path('/bitlabsPostback?uid=u1&val=1&tx=t1&type=COMPLETE').replace('val=1', 'val=2'));
    expect(res.code).toBe(403);
    expect(docs.size).toBe(0);
  });

  test('credits 65% as pending, idempotent on tx', async () => {
    const { admin, docs } = fakeAdmin();
    const h = makeHandlers({ admin, secrets: { BITLABS_SECRET: SECRET } });
    const p = path('/bitlabsPostback?uid=u1&val=1&tx=t1&type=COMPLETE');
    const r1 = await call(h, p);
    expect(r1.code).toBe(200);
    expect(r1.body).toBe('OK');
    const doc = docs.get('users/u1/earnings/bitlabs_t1');
    expect(doc).toMatchObject({ type: 'offer', partner: 'bitlabs', status: 'pending', coins: 5395, rupees: 53.95 });
    const r2 = await call(h, p);
    expect(r2.code).toBe(200);
    expect(docs.size).toBe(1);
    expect(docs.get('users/u1/earnings/bitlabs_t1').coins).toBe(5395);
  });

  test('RECONCILIATION marks the original entry reversed (by ref, else tx)', async () => {
    const { admin, docs } = fakeAdmin();
    const h = makeHandlers({ admin, secrets: { BITLABS_SECRET: SECRET } });
    await call(h, path('/bitlabsPostback?uid=u1&val=1&tx=t1&type=COMPLETE'));
    const r = await call(h, path('/bitlabsPostback?uid=u1&val=-1&tx=t9&type=RECONCILIATION&ref=t1'));
    expect(r.code).toBe(200);
    expect(docs.get('users/u1/earnings/bitlabs_t1').status).toBe('reversed');
    await call(h, path('/bitlabsPostback?uid=u1&val=2&tx=t2&type=COMPLETE'));
    await call(h, path('/bitlabsPostback?uid=u1&val=-2&tx=t2&type=RECONCILIATION'));
    expect(docs.get('users/u1/earnings/bitlabs_t2').status).toBe('reversed');
  });

  test('$0 callbacks answer OK without an entry', async () => {
    const { admin, docs } = fakeAdmin();
    const h = makeHandlers({ admin, secrets: { BITLABS_SECRET: SECRET } });
    const r = await call(h, path('/bitlabsPostback?uid=u1&val=0&tx=t3&type=SCREENOUT'));
    expect(r.code).toBe(200);
    expect(docs.size).toBe(0);
  });
});
