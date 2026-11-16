# Outfit Vote – Developer Handover

This file lists every service the app uses and **where** each secret lives.
**No passwords, keys or tokens are stored in this repo — ever.** To give a developer access,
add their own email as a member of each service below. Never share the owner's passwords.

## App basics
- Repo: `Saibabu-Dev-Test/outfit_app`, branch `main` (feature branch → PR → squash merge)
- Android package: `com.saibabu.outfit`
- Firebase project: `outfit-vote-9edca` (web: https://outfit-vote-9edca.web.app)
- Backend for earn postbacks: Cloudflare Worker in `server/earn` (free plan)

## How to give a developer access
| Service | What to do | Owner login |
|---|---|---|
| GitHub | Repo → Settings → Collaborators → add developer's GitHub username | Saibabu-Dev-Test |
| Firebase / Google Cloud | Firebase console → Project settings → Users and permissions → add developer email (Editor) | owner's Google account |
| Cloudflare | Dashboard → Manage account → Members → invite developer email | bsai4790@gmail.com |
| Google Play / Indus Appstore | Console → Users & permissions → invite developer | owner account |
| AdMob | Settings → Users → invite | owner account |
| Offerwalls (BitLabs, CPX, Lootably, Torox, etc.) | Usually keep owner-only; give developer only the App ID if needed | bsai4790@gmail.com / babusai927@gmail.com (CPX) |

## Secrets and where they live (names only)
GitHub → repo Settings → Secrets and variables → Actions. A developer with write access can **use** these in CI but cannot read the values.

| Secret name | Used for |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Deploy Firestore rules / Hosting from CI |
| `GEMINI_API_KEY` | AI features |
| `RELEASE_BUNDLE_PASSPHRASE` | Unlock the Android release signing bundle in CI |
| `CLOUDFLARE_API_TOKEN` | Deploy the earn worker (to be added) |
| `CLOUDFLARE_ACCOUNT_ID` | Deploy the earn worker (to be added) |
| `BITLABS_SECRET` | Verify BitLabs postbacks (to be added) |
| `FIREBASE_SA_JSON` | Worker writes coins to Firestore (to be added) |

Owner passwords are kept in the owner's own password manager (Hark Vault / Bitwarden), never in this repo.

## Money rules (do not change without owner)
- Surveys / offerwalls: 65% user, 35% owner, credited only via server postback.
- Ads (all kinds, including rewarded ads and quiz ads): 100% owner.
- Own-task pool rewards: paid from owner's daily coin budget.
- No user fees, no paid-entry contests (Online Gaming Act 2025).
- No fake or guaranteed earnings text.

## Rules for code changes
- Before push: `git pull --rebase`, `npx tsc --noEmit`, `npx jest`, eslint on changed files.
- Never loosen `firestore.rules`. Never commit keys, `.p12`/keystore passwords, or service-account JSON.
- Keep `__tests__/removedUi.test.ts`.
