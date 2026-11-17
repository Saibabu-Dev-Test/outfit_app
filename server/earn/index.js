/* eslint-disable */
// Earn server STUB (not deployed). Secrets come from environment variables / Secret Manager only;
// nothing secret is committed. Written for Cloud Functions v2 (needs the Blaze plan) but the three
// handlers are plain (req, res) functions and port to a free Cloudflare Worker / any Node host.
//
//   cpxHash         POST, Authorization: Bearer <Firebase ID token>  -> { hash }
//                   hash = md5(ext_user_id + '-' + CPX_SECURE_HASH)  (CPX "secure hash" docs)
//   cpxPostback     GET from CPX servers on survey complete / reversal. Verifies the CPX hash
//                   (md5(trans_id + '-' + CPX_SECURE_HASH)), then writes
//                   users/{uid}/earnings/cpx_{trans_id}
//                   {type:'survey', coins: floor(payout * 0.65 * 100), rupees, partner:'cpx',
//                    status:'pending', holdUntil: now + HOLD_DAYS, createdAt}
//                   status=2 (reversal) -> status:'reversed'.
//   offerwallPostback  same idea for Offerwall.GG (verify its signature per their docs) -> type:'offer'
//   bitlabsPostback GET from BitLabs (reward + reconciliation callback). Verifies hash =
//                   hex HMAC-SHA1 of the full callback URL (everything before '&hash='), keyed with
//                   the app Secret Key (secrets.BITLABS_SECRET), then writes
//                   users/{uid}/earnings/bitlabs_{tx}
//                   {type:'offer', coins: floor(val_usd * USD_TO_INR * 0.65 * 100), partner:'bitlabs',
//                    status:'pending', holdUntil, ...}; type=RECONCILIATION -> that entry 'reversed'
//                   (matched by ref=[%REF%] when configured, else tx). Always 200 OK once verified.
//   releaseHeld     daily: pending survey/offer entries with holdUntil <= now -> 'approved';
//                   pending ad/vote/checkin entries older than 1 day -> 'approved' (after fraud checks);
//                   referrals: when the new user has done their first daily check-in (an approved,
//                   non-reversed checkin_{day} entry, i.e. it passed the fraud checks above) and their
//                   account is bound to its own phone (earnMeta/main.deviceHash set, devices/{hash}
//                   -> newUid), credit referral_{newUid} (100 coins) to BOTH users, once (fixed doc
//                   id). A check-in is only possible once that day's ad + vote gate is open.
//
// TODO(owner): set CPX_SECURE_HASH (CPX dashboard > App > Secure hash), BITLABS_SECRET (BitLabs
// dashboard > App > Integration > Secret Key) and OFFERWALL_GG_SECRET as
// secrets, deploy, then put the cpxHash URL in src/config/earn.ts (CPX_HASH_ENDPOINT) and the
// postback URLs in the partner dashboards. Make sure CPX pays out in INR (or convert `payout`).
const crypto = require('crypto');

const USER_SHARE = 0.65;
const COINS_PER_RUPEE = 100;
const HOLD_DAYS = 5; // within the agreed 3-7 day window

// BitLabs pays in USD ([%VALUE:USD%]); we credit users in INR coins. Fixed rate, reviewed by hand
// (approx. RBI reference rate, Nov 2026). Change it here when the rupee moves a lot.
const USD_TO_INR = 83;

const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const userCoins = payoutRupees => Math.max(0, Math.floor(payoutRupees * USER_SHARE * COINS_PER_RUPEE));

const bitlabsUserCoins = usd => userCoins(Number(usd || 0) * USD_TO_INR);

// BitLabs callback hash (developer.bitlabs.ai/docs/securing-callbacks-through-hashing): hex
// HMAC-SHA1 of the exact URL BitLabs called, up to (not including) '&hash=', keyed with the app
// Secret Key. The URL must not be re-encoded/decoded before hashing.
function verifyBitlabsHash(fullUrl, secret) {
  if (!secret || typeof fullUrl !== 'string') return false;
  const i = fullUrl.lastIndexOf('&hash=');
  if (i < 0) return false;
  const given = fullUrl.slice(i + 6).split('&')[0].toLowerCase();
  const want = crypto.createHmac('sha1', secret).update(fullUrl.slice(0, i)).digest('hex');
  if (given.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(want));
}

// The URL BitLabs actually called. Behind Cloud Functions / a proxy req.protocol can say http, so
// prefer x-forwarded-proto, and allow secrets.BITLABS_CALLBACK_BASE (e.g.
// 'https://us-central1-PROJECT.cloudfunctions.net') to pin the scheme + host exactly.
function bitlabsCallbackUrl(req, base) {
  const path = req.originalUrl || req.url || '';
  if (base) return String(base).replace(/\/+$/, '') + path;
  const h = req.headers || {};
  const proto = String(h['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = h['x-forwarded-host'] || h.host || '';
  return `${proto}://${host}${path}`;
}

const safeId = v => typeof v === 'string' && v.length > 0 && v.length <= 255 && !/[\/]/.test(v);

function makeHandlers({ admin, secrets }) {
  const db = admin.firestore();

  async function cpxHash(req, res) {
    try {
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      const user = await admin.auth().verifyIdToken(token);
      res.json({ hash: md5(`${user.uid}-${secrets.CPX_SECURE_HASH}`) });
    } catch (e) {
      res.status(401).json({ error: 'unauthorized' });
    }
  }

  async function cpxPostback(req, res) {
    const q = req.query || {};
    const uid = String(q.user_id || q.ext_user_id || '');
    const trans = String(q.trans_id || '');
    if (!uid || !trans || md5(`${trans}-${secrets.CPX_SECURE_HASH}`) !== String(q.hash || '')) {
      return res.status(403).send('bad hash');
    }
    const ref = db.doc(`users/${uid}/earnings/cpx_${trans}`);
    if (String(q.status) === '2') {
      await ref.set({ status: 'reversed', reversedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return res.send('1');
    }
    const payout = Number(q.amount_local || 0); // app currency (set INR in CPX)
    const coins = userCoins(payout);
    await ref.create({
      type: 'survey',
      coins,
      rupees: coins / COINS_PER_RUPEE,
      partner: 'cpx',
      status: 'pending',
      ownerRupees: Math.round(payout * (1 - USER_SHARE) * 100) / 100,
      holdUntil: admin.firestore.Timestamp.fromMillis(Date.now() + HOLD_DAYS * 86400000),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => undefined); // duplicate postback: already recorded
    res.send('1');
  }

  async function offerwallPostback(req, res) {
    // TODO(Offerwall.GG): verify the signature exactly as their postback docs describe.
    res.status(501).send('not configured');
  }

  async function bitlabsPostback(req, res) {
    const q = req.query || {};
    if (!verifyBitlabsHash(bitlabsCallbackUrl(req, secrets.BITLABS_CALLBACK_BASE), secrets.BITLABS_SECRET)) {
      return res.status(403).send('bad hash');
    }
    const uid = String(q.uid || '');
    const tx = String(q.tx || '');
    const type = String(q.type || 'COMPLETE').toUpperCase();
    if (!safeId(uid) || !safeId(tx)) return res.status(400).send('bad params');

    if (type === 'RECONCILIATION') {
      const orig = safeId(String(q.ref || '')) ? String(q.ref) : tx;
      await db.doc(`users/${uid}/earnings/bitlabs_${orig}`).set(
        { status: 'reversed', partner: 'bitlabs', reversedAt: admin.firestore.FieldValue.serverTimestamp(), reconciliationTx: tx },
        { merge: true },
      );
      return res.status(200).send('OK');
    }

    const usd = Number(q.val || 0);
    const coins = bitlabsUserCoins(usd);
    if (!(usd > 0) || coins <= 0) return res.status(200).send('OK'); // $0 / screenout: nothing to credit
    const rupees = usd * USD_TO_INR;
    try {
      await db.doc(`users/${uid}/earnings/bitlabs_${tx}`).create({
        type: 'offer',
        coins,
        rupees: coins / COINS_PER_RUPEE,
        partner: 'bitlabs',
        status: 'pending',
        activity: type,
        usd,
        ownerRupees: Math.round(rupees * (1 - USER_SHARE) * 100) / 100,
        holdUntil: admin.firestore.Timestamp.fromMillis(Date.now() + HOLD_DAYS * 86400000),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      // Duplicate callback (same tx): already recorded. Anything else -> 500 so BitLabs retries.
      const dup = e && (e.code === 6 || e.code === 'already-exists' || /already exists/i.test(String(e.message)));
      if (!dup) return res.status(500).send('error');
    }
    res.status(200).send('OK');
  }

  async function releaseHeld() {
    const now = admin.firestore.Timestamp.now();
    const snap = await db.collectionGroup('earnings').where('status', '==', 'pending').where('holdUntil', '<=', now).limit(500).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { status: 'approved', approvedAt: now }));
    await batch.commit();
    // TODO: approve app coin entries (ad/vote/checkin) and credit referrals as described above.
  }

  return { cpxHash, cpxPostback, offerwallPostback, bitlabsPostback, releaseHeld };
}

module.exports = { makeHandlers, userCoins, md5, USD_TO_INR, bitlabsUserCoins, verifyBitlabsHash, bitlabsCallbackUrl };
