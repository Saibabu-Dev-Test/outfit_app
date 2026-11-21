/* global Response, URL */
// Cloudflare Worker 'outfit-api' (free plan, workers.dev) with D1 database 'outfit-db':
//   GET  /health                     no auth: { ok, d1, version }
//   /v1/...                          app API (api.js), Firebase ID token required
//   GET  /bitlabsPostback            BitLabs reward / reconciliation callback
//   GET  /cpxPostback                CPX Research survey callback
//   GET|POST /offerwallPostback      Offerwall.GG conversion callback
//   GET  /cpxHash                    CPX secure_hash for the signed-in user
//   cron '30 0 * * *' (daily)        pending earn credits past their hold -> approved (D1)
//   /v1/civic/..., /v1/admin/civic   Govt / Hospitals tabs (civic/routes.js)
//   cron '*/20 * * * *'              capped Gemini research for the civic tabs (civic/research.js)
// Secrets (wrangler secret put, never in git): BITLABS_SECRET, CPX_SECURE_HASH, OFFERWALL_GG_SECRET,
// FIREBASE_SA_JSON, GEMINI_API_KEY (+ optional GEMINI_API_KEY_2.._5, GROQ_API_KEY: civic AI fallback chain with the Workers AI binding AI last, civic/llm.js; no Gemini key = no new research, routes still work). A handler whose secret is missing answers 503 'not configured'.
import { handleBitlabsPostback, handleCpxPostback, handleOfferwallPostback } from './handler.js';
import { AuthError, bearer, verifyFirebaseToken } from './auth.js';
import { Db } from './db.js';
import { cpxHashFor, releaseHeld } from './earn.js';
import * as api from './api.js';
import * as civic from './civic/routes.js';
import { runCivicResearch } from './civic/research.js';
import { postCivicAsk, postCivicTranslate } from './civic/ask.js';
import { PROJECT_ID, WORKER_VERSION } from './config.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-max-age': '86400',
};

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
const text = (status, body) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

async function readBody(request) {
  if (request.method === 'GET' || request.method === 'DELETE') {
    return {};
  }
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/x-www-form-urlencoded')) {
    const out = {};
    new URLSearchParams(await request.text()).forEach((v, k) => {
      if (!(k in out)) {
        out[k] = v;
      }
    });
    return out;
  }
  try {
    return await request.json();
  } catch (e) {
    return {};
  }
}

const ROUTES = [
  ['GET', /^\/v1\/status$/, api.getStatus],
  ['POST', /^\/v1\/usage$/, api.postUsage],
  ['POST', /^\/v1\/backend\/exhausted$/, api.postExhausted],
  ['GET', /^\/v1\/feed$/, api.getFeed],
  ['POST', /^\/v1\/posts$/, api.createPost],
  ['GET', /^\/v1\/posts\/([^/]+)$/, api.getPost],
  ['DELETE', /^\/v1\/posts\/([^/]+)$/, api.deletePost],
  ['GET', /^\/v1\/votes$/, api.getVotes],
  ['PUT', /^\/v1\/votes$/, api.putVote],
  ['GET', /^\/v1\/coins$/, api.getCoins],
  ['POST', /^\/v1\/coins$/, api.postCoin],
  ['GET', /^\/v1\/earnings$/, api.getEarnings],
  ['GET', /^\/v1\/admin\/system$/, api.getAdminSystem],
  ['GET', /^\/v1\/admin\/earnings$/, api.getAdminEarnings],
  ['GET', /^\/v1\/civic\/data$/, civic.getCivicData],
  ['POST', /^\/v1\/civic\/research$/, civic.postCivicResearch],
  ['POST', /^\/v1\/civic\/ask$/, postCivicAsk],
  ['POST', /^\/v1\/civic\/translate$/, postCivicTranslate],
  ['GET', /^\/v1\/civic\/reviews$/, civic.getCivicReviews],
  ['POST', /^\/v1\/civic\/reviews$/, civic.postCivicReview],
  ['POST', /^\/v1\/civic\/reports$/, civic.postCivicReport],
  ['GET', /^\/v1\/admin\/civic$/, civic.getAdminCivic],
  ['POST', /^\/v1\/admin\/civic\/review$/, civic.postAdminCivicReview],
  ['POST', /^\/v1\/admin\/civic\/refresh$/, civic.postAdminCivicRefresh],
];

export async function handleRequest(request, env, ctx, { fetchImpl = fetch, now = Date.now() } = {}) {
  const url = new URL(request.url);
  const path = url.pathname;
  const db = env.DB ? new Db(env.DB) : null;
  const done = res => {
    if (db && ctx && ctx.waitUntil) {
      ctx.waitUntil(db.flushUsage(now).catch(() => undefined));
    }
    return res;
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (path === '/health' || path === '/') {
    let d1 = false;
    if (db) {
      try {
        await db.first('SELECT 1 AS ok');
        d1 = true;
      } catch (e) {
        d1 = false;
      }
    }
    return done(json(d1 ? 200 : 503, { ok: d1, service: 'outfit-api', version: WORKER_VERSION, d1, time: now }));
  }

  // ── Partner postbacks (no Firebase token: verified by each partner's signature) ──
  if (path === '/bitlabsPostback' || path === '/cpxPostback' || path === '/offerwallPostback') {
    if (request.method !== 'GET' && !(path === '/offerwallPostback' && request.method === 'POST')) {
      return text(405, 'method not allowed');
    }
    let r;
    if (path === '/bitlabsPostback') {
      r = await handleBitlabsPostback({ url: request.url, env, db, fetchImpl, now });
    } else if (path === '/cpxPostback') {
      r = await handleCpxPostback({ url: request.url, env, db, fetchImpl, now });
    } else {
      const query = {};
      url.searchParams.forEach((v, k) => {
        if (!(k in query)) {
          query[k] = v;
        }
      });
      const form = request.method === 'POST' ? await readBody(request) : {};
      r = await handleOfferwallPostback({ query: { ...form, ...query }, env, db, fetchImpl, now });
    }
    return done(text(r.status, r.body));
  }

  // ── Signed-in routes ──
  const isApi = path.startsWith('/v1/') || path === '/cpxHash';
  if (!isApi) {
    return text(404, 'not found');
  }
  let user;
  try {
    user = await verifyFirebaseToken(bearer(request), { projectId: env.FIREBASE_PROJECT_ID || PROJECT_ID, fetchImpl, now });
  } catch (e) {
    return json(401, { error: 'unauthorized', detail: e instanceof AuthError ? e.message : 'token check failed' });
  }

  if (path === '/cpxHash') {
    if (!env.CPX_SECURE_HASH) {
      return json(503, { error: 'not configured' });
    }
    return json(200, { hash: cpxHashFor(user.uid, env.CPX_SECURE_HASH) });
  }

  if (!db) {
    return json(503, { error: 'database not bound' });
  }
  const route = ROUTES.find(([m, re]) => m === request.method && re.test(path));
  if (!route) {
    return done(json(404, { error: 'not found' }));
  }
  const m = route[1].exec(path);
  try {
    const body = await readBody(request);
    const out = await route[2]({ db, user, env, url, body, now, fetchImpl, ctx, id: m && m[1] ? decodeURIComponent(m[1]) : '' });
    return done(json(200, out));
  } catch (e) {
    if (e instanceof api.HttpError) {
      return done(json(e.status, { error: e.message }));
    }
    console.error('api error', path, String((e && e.message) || e));
    return done(json(500, { error: 'server error' }));
  }
}

export const CIVIC_CRON = '*/20 * * * *';

// CIVIC_CRON (every 20 minutes) = civic research only (prefill, capped by civicCaps). Every other cron (the daily '30 0 * * *') keeps the
// original releaseHeld behaviour exactly as before.
export async function handleScheduled(event, env, ctx, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!env.DB) {
    return;
  }
  const db = new Db(env.DB);
  if (event && event.cron === CIVIC_CRON) {
    try {
      const r = await runCivicResearch(db, env, { fetchImpl, now });
      console.log('civic research', JSON.stringify({ ran: r.ran, skipped: r.skipped || null }));
    } catch (e) {
      console.error('civic research failed', String((e && e.message) || e));
    }
  } else {
    const n = await releaseHeld(db, now);
    console.log('releaseHeld approved', n);
  }
  const flush = db.flushUsage(now).catch(() => undefined);
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(flush);
  } else {
    await flush;
  }
}

export default {
  fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    return handleScheduled(event, env, ctx);
  },
};
