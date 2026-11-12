/* eslint-env node */
// Sends push notifications for new activity (likes, comments, follows...) to users' phones.
// Run by .github/workflows/push.yml every 15 minutes with Google credentials
// (GOOGLE_APPLICATION_CREDENTIALS from Workload Identity or the FIREBASE_SERVICE_ACCOUNT secret).
//   state     pushState/activity {lastMs}   newest activity createdAt already handled
//   heartbeat config/push {lastRunAt}        the app stops its own local notifications while live
// Dead tokens reported by FCM are removed (users/{uid}/pushTokens/{id}). Nothing else is deleted.
// DRY_RUN=1 prints what would be sent.
'use strict';

const admin = require('firebase-admin');
const { groupByOwner, messagesFor, isDeadToken } = require('./lib');

const PROJECT = process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT;
const DRY = process.env.DRY_RUN === '1';
const FIRST_LOOKBACK_MS = 30 * 60 * 1000;
const MAX_DOCS = 1000;

admin.initializeApp(PROJECT ? { projectId: PROJECT } : undefined);
const db = admin.firestore();

async function main() {
  const stateRef = db.doc('pushState/activity');
  const state = (await stateRef.get()).data() || {};
  const since = Number(state.lastMs) || Date.now() - FIRST_LOOKBACK_MS;

  const snap = await db
    .collectionGroup('activity')
    .where('createdAt', '>', admin.firestore.Timestamp.fromMillis(since))
    .orderBy('createdAt', 'asc')
    .limit(MAX_DOCS)
    .get();

  let newest = since;
  const items = [];
  snap.forEach(d => {
    const x = d.data() || {};
    const owner = d.ref.parent.parent ? d.ref.parent.parent.id : null;
    const ms = x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0;
    if (ms > newest) newest = ms;
    items.push({ owner, type: x.type, actorId: x.actorId, actorName: x.actorName });
  });

  const groups = groupByOwner(items);
  let sent = 0;
  let dead = 0;
  for (const [uid, group] of groups) {
    const tokSnap = await db.collection('users').doc(uid).collection('pushTokens').get();
    if (tokSnap.empty) continue;
    const tokens = tokSnap.docs.map(t => ({ id: t.id, token: (t.data() || {}).token })).filter(t => t.token);
    const user = (await db.collection('users').doc(uid).get()).data() || {};
    for (const m of messagesFor(group, Number(user.likesReceived) || 0)) {
      if (DRY) {
        console.log(`[dry] ${uid} x${tokens.length}: ${m.title} | ${m.body}`);
        continue;
      }
      const res = await admin.messaging().sendEachForMulticast({
        tokens: tokens.map(t => t.token),
        notification: { title: m.title, body: m.body },
        data: m.payload ? { outfit_payload: m.payload } : {},
        android: { priority: 'high', notification: { channelId: 'activity', icon: 'ic_stat_outfit', color: '#E91E63' } },
      });
      sent += res.successCount;
      await Promise.all(
        res.responses.map((r, i) => {
          if (r.success || !r.error || !isDeadToken(r.error.code)) return null;
          dead += 1;
          return tokSnap.docs[i] ? tokSnap.docs[i].ref.delete() : null;
        }),
      );
    }
  }

  if (!DRY) {
    await stateRef.set({ lastMs: newest, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await db.doc('config/push').set({ lastRunAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
  console.log(`activity docs: ${items.length}, users: ${groups.size}, pushes sent: ${sent}, dead tokens removed: ${dead}`);
}

main().catch(e => {
  console.error('push sender failed:', e && e.message);
  process.exit(1);
});
