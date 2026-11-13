/* eslint-env node */
// Weekly push token cleanup (.github/workflows/push.yml): checks every saved FCM token with a
// dry-run send and removes only tokens FCM says are dead, plus tokens not refreshed for 90 days
// (the app re-saves its token daily while used). Removes nothing else.
// DRY_RUN=1 only lists them.
'use strict';

const admin = require('firebase-admin');
const { isDeadToken } = require('./lib');

const PROJECT = process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT;
const DRY = process.env.DRY_RUN === '1';
const STALE_MS = 90 * 24 * 60 * 60 * 1000;

admin.initializeApp(PROJECT ? { projectId: PROJECT } : undefined);
const db = admin.firestore();

async function main() {
  const snap = await db.collectionGroup('pushTokens').get();
  const now = Date.now();
  let removed = 0;
  for (const d of snap.docs) {
    const x = d.data() || {};
    const updated = x.updatedAt && x.updatedAt.toMillis ? x.updatedAt.toMillis() : 0;
    let reason = null;
    if (!x.token) reason = 'empty';
    else if (now - updated > STALE_MS) reason = 'stale';
    else {
      try {
        await admin.messaging().send({ token: x.token, data: { ping: '1' } }, true);
      } catch (e) {
        if (isDeadToken(e && e.code)) reason = e.code;
      }
    }
    if (!reason) continue;
    removed += 1;
    console.log(`${DRY ? '[dry] ' : ''}remove ${d.ref.path} (${reason})`);
    if (!DRY) await d.ref.delete();
  }
  console.log(`tokens checked: ${snap.size}, removed: ${removed}`);
}

main().catch(e => {
  const msg = (e && e.message) || String(e);
  if (/PERMISSION_DENIED|insufficient permissions/i.test(msg)) {
    console.log('::warning::token cleanup failed: ' + msg + ' -> add the FIREBASE_SERVICE_ACCOUNT secret (Firebase console > Project settings > Service accounts > Generate new private key). Skipping this run.');
    process.exit(0);
  }
  console.error('token cleanup failed:', msg);
  process.exit(1);
});
