// Request handling with injectable fetch/clock, so it can be tested without the Workers runtime.
import { planBitlabsCallback } from './bitlabs.js';
import { AlreadyExistsError, commitWrite, parseServiceAccount } from './firestore.js';

export const DEFAULT_PROJECT_ID = 'outfit-vote-9edca';

// Returns { status, body }.
export async function handleBitlabsPostback({ url, env = {}, fetchImpl = fetch, now = Date.now() }) {
  const plan = await planBitlabsCallback({
    url,
    secret: env.BITLABS_SECRET,
    base: env.BITLABS_CALLBACK_BASE,
    now,
  });
  if (!plan.write) {
    return { status: plan.status, body: plan.body };
  }
  try {
    const serviceAccount = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT);
    const projectId = env.FIREBASE_PROJECT_ID || serviceAccount.project_id || DEFAULT_PROJECT_ID;
    await commitWrite({ projectId, serviceAccount, write: plan.write, fetchImpl, now });
  } catch (e) {
    // Duplicate callback (same tx): already recorded. Anything else -> 500 so BitLabs retries.
    if (!(e instanceof AlreadyExistsError)) {
      console.error('bitlabsPostback storage error', String((e && e.message) || e));
      return { status: 500, body: 'error' };
    }
  }
  return { status: plan.status, body: plan.body };
}
