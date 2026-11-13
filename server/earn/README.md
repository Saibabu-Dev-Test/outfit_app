# Earn server (stub, not deployed)

The app never holds partner secrets. `index.js` has the handlers that must run on a server:

- `cpxHash` — returns the CPX `secure_hash` for the signed-in user (app calls `CPX_HASH_ENDPOINT`).
- `cpxPostback` — CPX survey complete / reversal → `users/{uid}/earnings/cpx_{trans_id}` (pending, held ~5 days, user gets 65%).
- `offerwallPostback` — Offerwall.GG (TODO: signature check).
- `releaseHeld` — daily job: pending → approved after the hold; app coin entries; referral credits.

Hosting options: Cloud Functions v2 (needs the Firebase Blaze plan) or a free Cloudflare Worker /
the existing GitHub Actions service account for the daily job. Secrets (`CPX_SECURE_HASH`,
`OFFERWALL_GG_SECRET`) go in the host's secret store, never in git.
