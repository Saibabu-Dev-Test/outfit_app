# Earn server (stub, not deployed)

The app never holds partner secrets. `index.js` has the handlers that must run on a server:

- `cpxHash` — returns the CPX `secure_hash` for the signed-in user (app calls `CPX_HASH_ENDPOINT`).
- `cpxPostback` — CPX survey complete / reversal → `users/{uid}/earnings/cpx_{trans_id}` (pending, held ~5 days, user gets 65%).
- `offerwallPostback` — Offerwall.GG (TODO: signature check).
- `bitlabsPostback` — BitLabs reward / reconciliation callback → `users/{uid}/earnings/bitlabs_{tx}`
  (pending, held ~5 days, user gets 65% of the USD payout × `USD_TO_INR` (83), in coins). Duplicate
  `tx` is ignored; `type=RECONCILIATION` marks the original entry `reversed`.
- `releaseHeld` — daily job: pending → approved after the hold; app coin entries; referral credits
  (after the new user's first approved daily check-in on their own phone; once per new user).

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

## Free host: Cloudflare Worker `outfit-api` (`server/worker`)

All three postbacks run on the free Cloudflare Worker **outfit-api**
(https://outfit-api.babusai927.workers.dev) with the D1 database **outfit-db** (free plan). Every
verified credit is written to the D1 earn ledger (`earnings` table, server-only) and, when the
optional Worker secret `FIREBASE_SA_JSON` is set, mirrored to Firestore
`users/{uid}/earnings/{id}` exactly as before (REST + service-account JWT; server writes bypass the
rules, so `firestore.rules` stays as is). The app reads both and de-duplicates by id. A daily cron
(00:30 UTC) moves pending D1 credits past their hold to `approved`.

A handler whose secret is missing answers **503 `not configured`** (partners retry later).
`.github/workflows/deploy-earn-worker.yml` applies D1 migrations, deploys, and pushes the Worker
secrets that are set in the repo, on every push to `main` touching `server/worker/**`.

Callback URLs to paste in the partner dashboards:

```
BitLabs       https://outfit-api.babusai927.workers.dev/bitlabsPostback?uid=[%USER:UID%]&val=[%VALUE:USD%]&tx=[%TX%]&type=[%ACTIVITY:TYPE%]&ref=[%REF%]
CPX Research  https://outfit-api.babusai927.workers.dev/cpxPostback?user_id={user_id}&trans_id={trans_id}&amount_local={amount_local}&status={status}&hash={secure_hash}
Offerwall.GG  https://outfit-api.babusai927.workers.dev/offerwallPostback?user={userId}&tx={transactionId}&amount={currencyAmount}&status={status}&sig={signature}&payout={payoutUsd}&test={test}
```

- Offerwall.GG: set the placement currency to **5395 units per USD** (65% user share x 100 coins per rupee x
  USD_TO_INR 83), so `currencyAmount` is already the user's 65% in coins and is credited as is.
  Signature = hex HMAC-SHA256 of `userId:transactionId:currencyAmount` (offerwall.gg/developers/postbacks).
  `test=1` never credits; `status=reversed` / negative amount reverses the same transaction.
- CPX: `CPX_HASH_ENDPOINT` in `src/config/earn.ts` points at `/cpxHash` on the Worker. Set the CPX
  app currency to INR.

Optional reporting params (owner's Admin tracking > 💰 Earnings; never used for money). Old URLs
keep working; add these to see per-type and per-task numbers:

```
Offerwall.GG  ...&offerName={offerName}                      (task name; category = offer)
BitLabs       offer callback:  ...&cat=offer&offer_id=[%OFFER:ID%]&offer_name=[%OFFER:NAME%]&task_name=[%OFFER:TASK:NAME%]
              survey callback: ...&cat=survey
              (keep every extra param BEFORE &hash=, BitLabs signs the whole URL)
Any partner   ...&cat=game | cat=quiz | cat=survey | cat=offer  to label a whole placement
```

Category stored per credit (`category` column / Firestore field): survey | offer | game | quiz |
receipt | other. Without a hint CPX = survey, Offerwall.GG = offer, BitLabs = unknown (the report
falls back to the ledger type). D1 migration `0002_earnings_category.sql` adds `category`,
`task_name`, `payout_rupees` (full partner payout ₹); older rows report rupees + owner_rupees.

Worker secrets (repo secrets of the same name, or `npx wrangler secret put NAME` in `server/worker`;
never commit them): `BITLABS_SECRET`, `CPX_SECURE_HASH`, `OFFERWALL_GG_SECRET`, optional
`FIREBASE_SA_JSON` (whole JSON key of a service account in `outfit-vote-9edca` with role
"Cloud Datastore User"), optional `BITLABS_CALLBACK_BASE`.
