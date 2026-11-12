# Push notifications (FCM)

- `send-activity-push.js` – every 15 min (`.github/workflows/push.yml`): new `users/{uid}/activity`
  docs → one push per user (likes: "🪙 Gold coin likes! N people…", tap = coins flip in the app;
  others: one summary). Writes `pushState/activity` and the heartbeat `config/push.lastRunAt`.
- `cleanup-tokens.js` – weekly: removes FCM tokens that FCM reports dead or that were not
  refreshed for 90 days. Nothing else is removed.
- `lib.js` – pure helpers (tested in `__tests__/pushSender.test.ts`).

## One-time setup (Firebase / Google Cloud console, project `outfit-vote-9edca`)

1. Enable **Firebase Cloud Messaging API (V1)** (`fcm.googleapis.com`):
   `gcloud services enable fcm.googleapis.com --project outfit-vote-9edca`
2. Give the CI service account the roles (same account the Firestore deploy uses):
   ```
   SA=github-deployer@outfit-vote-9edca.iam.gserviceaccount.com
   gcloud projects add-iam-policy-binding outfit-vote-9edca --member="serviceAccount:$SA" --role="roles/datastore.user"
   gcloud projects add-iam-policy-binding outfit-vote-9edca --member="serviceAccount:$SA" --role="roles/firebasecloudmessaging.admin"
   ```
   (Or the optional `FIREBASE_SERVICE_ACCOUNT` repository secret with a key of an account with
   those roles.)
3. Make sure `firestore.indexes.json` was deployed (the Firestore workflow does it on merge): the
   sender needs the collection-group index on `activity.createdAt`.
4. Actions › "Push notifications" › Run workflow with **dry run** on to check, then leave the
   schedule running. Until it runs, the app keeps showing its own local notifications.
