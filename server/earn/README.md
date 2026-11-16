# Earn server (stub, not deployed)

The app never holds partner secrets. `index.js` has the handlers that must run on a server:

- `cpxHash` — returns the CPX `secure_hash` for the signed-in user (app calls `CPX_HASH_ENDPOINT`).
- `cpxPostback` — CPX survey complete / reversal → `users/{uid}/earnings/cpx_{trans_id}` (pending, held ~5 days, user gets 65%).
- `offerwallPostback` — Offerwall.GG (TODO: signature check).
- `bitlabsPostback` — BitLabs reward / reconciliation callback → `users/{uid}/earnings/bitlabs_{tx}`
  (pending, held ~5 days, user gets 65% of the USD payout × `USD_TO_INR` (83), in coins). Duplicate
  `tx` is ignored; `type=RECONCILIATION` marks the original entry `reversed`.
- `releaseHeld` — daily job: pending → approved after the hold; app coin entries; referral credits.

Hosting options: Cloud Functions v2 (needs the Firebase Blaze plan) or a free Cloudflare Worker /
the existing GitHub Actions service account for the daily job. Secrets (`CPX_SECURE_HASH`,
`OFFERWALL_GG_SECRET`, `BITLABS_SECRET`) go in the host's secret store, never in git.

## BitLabs callback setup

BitLabs dashboard → Apps → your app → Integration → Reward Callback (cog wheel). Paste this as the
callback URL (replace the host with wherever `bitlabsPostback` is deployed):

```
https://<YOUR-FUNCTION-HOST>/bitlabsPostback?uid=[%USER:UID%]&val=[%VALUE:USD%]&tx=[%TX%]&type=[%ACTIVITY:TYPE%]&ref=[%REF%]
```

- BitLabs appends `&hash=<hex HMAC-SHA1 of the full URL, keyed with the app Secret Key>` itself; do
  not add `hash` yourself.
- `ref=[%REF%]` is recommended by BitLabs: a reconciliation has its own `tx`, and `ref` points at
  the original reward's `tx`. Without it the handler falls back to `tx`.
- Secrets (never in git): `BITLABS_SECRET` = Integration → **Secret Key**. Optional
  `BITLABS_CALLBACK_BASE` = the exact `https://host` BitLabs calls, if the host sees a different
  scheme/host than BitLabs used (proxies), so the hash is computed over the same URL.
- The S2S key is not used by this handler; keep it out of git too.
- The handler answers `200 OK` for every verified callback (including $0 / screenouts), `403` on a
  bad hash, `500` on a storage error so BitLabs retries.
- `USD_TO_INR` (83) is a fixed rate in `index.js`; update it by hand when the rupee moves.
- Test with the dashboard's callback tester (Integration → Test callback).

## Shared task pool (owner-funded app tasks)

`taskPool.js` (exported through `makeHandlers` in `index.js`):

- `taskPoolClaim` — POST, `Authorization: Bearer <Firebase ID token>`, body `{day, slotId}`. In one
  Firestore transaction: the user has a profile + Earn set up on a phone (`earnMeta/main.deviceHash`),
  the slot is open (or its claim expired), the user has no other live claim, is under the day's
  per-user cap, the task is still possible today, and `paidCoins + live holds + reward <= budgetCoins`.
  Then the slot becomes `claimed` for `claimMinutes` (default 30) and its coins are held.
- `taskPoolComplete` — same auth/body. Checks the claim is the caller's and not expired, and that the
  task was done after the claim (check-in: `earnDaily.checkedIn` false→true; rewarded ad: `adsCount`
  went up; poll vote: a `vote` coin event created after the claim). Then the slot is `done`,
  `paidCoins` grows, and `users/{uid}/earnings/pool_{day}_{slotId}` is created (`type:'pool'`,
  `status:'pending'`, `holdUntil` +1 day so `releaseHeld` approves it).
- `taskPoolSweep` — scheduled (every 15–30 min): expired claims of today back to `open`, stale holds
  dropped. Claims also reopen lazily, so the pool works even before the sweep is scheduled.

Money: pool rewards come from the owner's daily budget only. Ad revenue (rewarded ads included) stays
100% owner; there is no ad revenue split. Offerwalls / surveys are not in the pool (65/35 postbacks above).

Owner setup: deploy these handlers (same host as the postbacks), put the base URL in
`src/config/earn.ts` → `TASK_POOL_ENDPOINT`, publish `firestore.rules` (merge to main), then in the app
Me › "Earn: shared tasks" set the day's budget / claim time / per-user cap and add slots.
