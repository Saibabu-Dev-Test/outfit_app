// Postback handling with injectable fetch / clock / D1, so it can be tested without the Workers
// runtime. Every verified credit goes to the D1 earn ledger (env.DB) and, when a Firebase service
// account secret is set (FIREBASE_SA_JSON, or the older name FIREBASE_SERVICE_ACCOUNT), is mirrored
// to Firestore users/{uid}/earnings/{id} as before. Both writes are idempotent (create-if-absent /
// merge), so a partner retry after a 500 never credits twice.
import { planBitlabsCallback, queryParams } from './bitlabs.js';
import { AlreadyExistsError, commitWrite, parseServiceAccount } from './firestore.js';
import { applyEarningToD1, planCpxPostback, planOfferwallPostback } from './earn.js';
import { addUsage } from './db.js';
import { istDay } from './days.js';
import { PROJECT_ID } from './config.js';

export const DEFAULT_PROJECT_ID = PROJECT_ID;

export const serviceAccountJson = (env = {}) => env.FIREBASE_SA_JSON || env.FIREBASE_SERVICE_ACCOUNT || '';

const logOutcome = async (db, partner, outcome, now) => {
  if (!db) {
    return;
  }
  try {
    await addUsage(db, istDay(now), `postback:${partner}:${outcome}`, 1);
  } catch (e) {
    console.error('postback log failed', String((e && e.message) || e));
  }
};

const outcomeOf = status => (status === 200 ? 'ok' : status === 503 ? 'not_configured' : status === 500 ? 'error' : 'rejected');

// Writes plan.write to every configured sink. Returns { status, body }.
export async function recordPlan({ plan, partner, env = {}, db = null, fetchImpl = fetch, now = Date.now() }) {
  if (!plan.write) {
    await logOutcome(db, partner, outcomeOf(plan.status), now);
    return { status: plan.status, body: plan.body };
  }
  const saJson = serviceAccountJson(env);
  if (!db && !saJson) {
    await logOutcome(db, partner, 'not_configured', now);
    return { status: 503, body: 'not configured' };
  }
  try {
    if (db) {
      await applyEarningToD1(db, plan.write, now);
    }
    if (saJson) {
      const serviceAccount = parseServiceAccount(saJson);
      const projectId = env.FIREBASE_PROJECT_ID || serviceAccount.project_id || DEFAULT_PROJECT_ID;
      try {
        await commitWrite({ projectId, serviceAccount, write: plan.write, fetchImpl, now });
      } catch (e) {
        // Duplicate callback (same tx): already recorded
        if (!(e instanceof AlreadyExistsError)) {
          throw e;
        }
      }
    }
  } catch (e) {
    // Anything else -> 500 so the partner retries
    console.error(`${partner} postback storage error`, String((e && e.message) || e));
    await logOutcome(db, partner, 'error', now);
    return { status: 500, body: 'error' };
  }
  await logOutcome(db, partner, 'ok', now);
  return { status: plan.status, body: plan.body };
}

export async function handleBitlabsPostback({ url, env = {}, db = null, fetchImpl = fetch, now = Date.now() }) {
  if (!env.BITLABS_SECRET) {
    await logOutcome(db, 'bitlabs', 'not_configured', now);
    return { status: 503, body: 'not configured' };
  }
  const plan = await planBitlabsCallback({ url, secret: env.BITLABS_SECRET, base: env.BITLABS_CALLBACK_BASE, now });
  return recordPlan({ plan, partner: 'bitlabs', env, db, fetchImpl, now });
}

export async function handleCpxPostback({ url, env = {}, db = null, fetchImpl = fetch, now = Date.now() }) {
  const plan = planCpxPostback({ query: queryParams(url), secret: env.CPX_SECURE_HASH, now });
  return recordPlan({ plan, partner: 'cpx', env, db, fetchImpl, now });
}

// query = URL query merged with a form body (Offerwall.GG can POST x-www-form-urlencoded)
export async function handleOfferwallPostback({ query, env = {}, db = null, fetchImpl = fetch, now = Date.now() }) {
  const plan = await planOfferwallPostback({ query, secret: env.OFFERWALL_GG_SECRET, now });
  return recordPlan({ plan, partner: 'offerwall', env, db, fetchImpl, now });
}
