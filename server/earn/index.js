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
//   releaseHeld     daily: pending survey/offer entries with holdUntil <= now -> 'approved';
//                   pending ad/vote/checkin entries older than 1 day -> 'approved' (after fraud checks);
//                   referrals: when the new user has a completed earnDaily day, credit
//                   referral_{newUid} (100 coins) to BOTH users.
//
// TODO(owner): set CPX_SECURE_HASH (CPX dashboard > App > Secure hash) and OFFERWALL_GG_SECRET as
// secrets, deploy, then put the cpxHash URL in src/config/earn.ts (CPX_HASH_ENDPOINT) and the
// postback URLs in the partner dashboards. Make sure CPX pays out in INR (or convert `payout`).
const crypto = require('crypto');

const USER_SHARE = 0.65;
const COINS_PER_RUPEE = 100;
const HOLD_DAYS = 5; // within the agreed 3-7 day window

const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const userCoins = payoutRupees => Math.max(0, Math.floor(payoutRupees * USER_SHARE * COINS_PER_RUPEE));

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

  async function releaseHeld() {
    const now = admin.firestore.Timestamp.now();
    const snap = await db.collectionGroup('earnings').where('status', '==', 'pending').where('holdUntil', '<=', now).limit(500).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { status: 'approved', approvedAt: now }));
    await batch.commit();
    // TODO: approve app coin entries (ad/vote/checkin) and credit referrals as described above.
  }

  return { cpxHash, cpxPostback, offerwallPostback, releaseHeld };
}

module.exports = { makeHandlers, userCoins, md5 };
