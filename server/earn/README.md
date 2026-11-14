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
