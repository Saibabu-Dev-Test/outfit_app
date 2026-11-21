// Gemini helper for the Worker (civic research, translation and the civic "Ask AI" answers). Keys
// are Worker secrets (wrangler secret put NAME), never in git: GEMINI_API_KEY plus optional
// GEMINI_API_KEY_2 .. GEMINI_API_KEY_5 (free-tier keys from other Google projects). No key = a
// graceful { ok: false, error: 'not configured' } so routes and the cron never crash.
// Key rotation: keys are tried in order; on each key the models are tried in order (GEMINI_MODELS).
// A 429 cools that key+model (until the next daily reset for a per-day quota, the RetryInfo delay /
// 60 s for a per-minute one), 402 (prepaid credits used up) or a refused key cools the whole key,
// and the call moves on to the next model / key. Cool-downs are remembered in D1 (aiCooldown.js) so
// later calls skip an exhausted key without a request. A model that timed out is not retried on the
// other keys in the same call (another key does not make it faster), and the whole call has a time
// budget so the fallback providers (llm.js: Groq, Workers AI) still get their turn quickly.
// Speed (free tier): the fastest free models first (Flash-Lite), no / minimal thinking, and a
// per-call timeout so a slow model falls through to the next one within seconds.
// Errors carry a short `code` the app turns into a clear message:
//   'quota'   every key / model answered 429 or is cooling down (free-tier per-minute / per-day limit)
//   'billing' 402 on every key (AI Studio prepaid credits used up: use free-tier keys, no billing)
//   'key'     400 / 401 / 403 key or request refused
//   'timeout' every model was too slow
//   'config'  no key
import { md5Hex } from '../md5.js';
import { HOUR_MS, MINUTE_MS, coolView, cooldownFor, nextGeminiReset } from './aiCooldown.js';

export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
// Fastest free-tier models first (Flash-Lite: highest free requests per day), then the Flash ones
export const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];
// Per-call time limits (ms): grounded research searches the web, so it gets longer
export const GEMINI_TIMEOUT_MS = 15000;
export const GEMINI_GROUNDED_TIMEOUT_MS = 30000;
// Whole-call time budget over every key and model (then the next provider takes over)
export const GEMINI_BUDGET_MS = 30000;
export const GEMINI_GROUNDED_BUDGET_MS = 60000;
// Worker secrets read as keys, in this order (empty / duplicate ones are skipped)
export const GEMINI_KEY_VARS = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY_5'];

export function geminiKeys(env) {
  const out = [];
  GEMINI_KEY_VARS.forEach(name => {
    const v = env && typeof env[name] === 'string' ? env[name].trim() : '';
    if (v && !out.includes(v)) {
      out.push(v);
    }
  });
  return out;
}

export const isGeminiConfigured = env => geminiKeys(env).length > 0;

// Cool-down id of a key (+ model, '*' = the whole key). Only a short hash of the key, never the key.
export const geminiCoolId = (key, model = '*') => `gemini:${md5Hex(String(key)).slice(0, 12)}:${model}`;

// How long a 429 cools a key+model (pure: tested). Reads Google's error details: a QuotaFailure whose
// quotaId names a per-day limit (e.g. GenerateRequestsPerDayPerProjectPerModel-FreeTier) waits for the
// daily reset; otherwise the RetryInfo delay ("33s"), the retry-after header, or 60 s (5 s .. 10 min).
export function geminiQuotaCooldown(bodyText, now, retryAfter = '') {
  let j = null;
  try {
    j = JSON.parse(bodyText || 'null');
  } catch (e) {
    j = null;
  }
  const err = (Array.isArray(j) ? j[0] && j[0].error : j && j.error) || {};
  const details = Array.isArray(err.details) ? err.details : [];
  const quotaIds = details.flatMap(d => (Array.isArray(d && d.violations) ? d.violations.map(v => String((v && (v.quotaId || v.quotaMetric)) || '')) : []));
  const daily = quotaIds.some(q => /per ?day|daily/i.test(q)) || (!quotaIds.length && /per day|daily|requests per day/i.test(String(err.message || '')));
  if (daily) {
    return { until: nextGeminiReset(now), reason: 'daily' };
  }
  const delay = details.map(d => d && d.retryDelay).find(Boolean);
  const secs = parseFloat(String(delay || retryAfter || '')) || 60;
  return { until: now + Math.min(600, Math.max(5, secs)) * 1000, reason: 'minute' };
}

// Is at least one key + model not cooling down right now? (grounded research needs Gemini)
export async function geminiReady(env, { now = Date.now(), cooldown, models = GEMINI_MODELS } = {}) {
  const keys = geminiKeys(env);
  if (!keys.length) {
    return false;
  }
  const view = await coolView(cooldownFor(env, { cooldown }), now);
  return keys.some(k => !view.isCool(geminiCoolId(k)) && models.some(m => !view.isCool(geminiCoolId(k, m))));
}

// Response body as text (real Response, or a test double that only has json())
const bodyText = async res => {
  try {
    if (res && typeof res.text === 'function') {
      return await res.text();
    }
    if (res && typeof res.json === 'function') {
      return JSON.stringify(await res.json());
    }
  } catch (e) {
    return '';
  }
  return '';
};

const header = (res, name) => {
  try {
    return (res && res.headers && typeof res.headers.get === 'function' && res.headers.get(name)) || '';
  } catch (e) {
    return '';
  }
};

const KEY_PROBLEM_RE = /API[_ ]?KEY|api key|PERMISSION_DENIED|UNAUTHENTICATED/i;

// Thinking off on Flash-Lite (thinkingBudget 0), low on the 3.x Flash models; none for aliases.
// A model that refuses the field is retried once without it.
export const thinkingFor = model =>
  /flash-lite/.test(model) ? { thinkingBudget: 0 } : /^gemini-3\.\d+-flash$/.test(model) ? { thinkingLevel: 'low' } : null;

// Public web sources Google Search grounding used (https only, deduped, max 12)
export function groundingSources(cand) {
  const chunks = (cand && cand.groundingMetadata && cand.groundingMetadata.groundingChunks) || [];
  const out = [];
  chunks.forEach(c => {
    const uri = c && c.web && c.web.uri;
    if (typeof uri === 'string' && /^https:\/\//.test(uri) && !out.some(s => s.url === uri) && out.length < 12) {
      out.push({ url: uri, title: String((c.web && c.web.title) || '').slice(0, 120) });
    }
  });
  return out;
}

// Pull the first JSON object/array out of a model answer (handles ```json fences)
export function parseJsonLoose(text) {
  const s = String(text || '').replace(/```(?:json)?/gi, '').trim();
  const start = s.search(/[[{]/);
  if (start < 0) {
    return null;
  }
  const open = s[start];
  const close = open === '{' ? '}' : ']';
  const end = s.lastIndexOf(close);
  if (end <= start) {
    return null;
  }
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

// Short app-facing code for a failed call (pure: tested). With several keys a temporary 429 wins
// over a key that is out of credits (402): the app then says "busy, try again" rather than "paused".
export const errorCode = statuses => {
  if (!statuses.length) {
    return 'other';
  }
  if (statuses.includes(402) && !statuses.includes(429)) {
    return 'billing';
  }
  if (statuses.every(x => x === 'key')) {
    return 'key';
  }
  if (statuses.every(x => x === 429 || x === 404)) {
    return statuses.includes(429) ? 'quota' : 'other';
  }
  if (statuses.every(x => x === 'timeout')) {
    return 'timeout';
  }
  return statuses.includes(429) ? 'quota' : 'other';
};

export const post = async (fetchImpl, url, init, timeoutMs) => {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (ctrl) {
        ctrl.abort();
      }
      reject(Object.assign(new Error('timeout'), { timeout: true }));
    }, timeoutMs);
  });
  try {
    return await Promise.race([fetchImpl(url, ctrl ? { ...init, signal: ctrl.signal } : init), timeout]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * geminiGenerate(env, { prompt, system, grounded, jsonOut, maxTokens, temperature, timeoutMs, budgetMs, models },
 *                { fetchImpl, now, cooldown })
 * -> { ok: true, text, model, sources, provider: 'gemini', keyIndex } | { ok: false, error, code }
 * jsonOut: ask for a JSON answer (translation calls; ignored when grounded)
 * cooldown: store override (tests); default D1 env.DB (aiCooldown.js), none without a DB
 */
export async function geminiGenerate(
  env,
  { prompt, system = '', grounded = false, maxTokens = 2048, temperature = 0.2, jsonOut = false, timeoutMs = 0, budgetMs = 0, models = GEMINI_MODELS } = {},
  { fetchImpl = fetch, now, cooldown } = {},
) {
  const keys = geminiKeys(env);
  if (!keys.length) {
    return { ok: false, error: 'not configured', code: 'config' };
  }
  const base = {
    contents: [{ role: 'user', parts: [{ text: String(prompt || '') }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };
  if (system) {
    base.systemInstruction = { parts: [{ text: system }] };
  }
  if (grounded) {
    base.tools = [{ google_search: {} }];
  } else if (jsonOut) {
    // JSON mode only without tools (grounding + JSON mode is not supported together)
    base.generationConfig.responseMimeType = 'application/json';
  }
  const limit = timeoutMs || (grounded ? GEMINI_GROUNDED_TIMEOUT_MS : GEMINI_TIMEOUT_MS);
  const budget = budgetMs || (grounded ? GEMINI_GROUNDED_BUDGET_MS : GEMINI_BUDGET_MS);
  const t0 = now === undefined ? Date.now() : now;
  const started = Date.now();
  const view = await coolView(cooldownFor(env, { cooldown }), t0);
  const statuses = [];
  const slow = new Set();
  let lastError = 'no model answered';
  keyLoop: for (let ki = 0; ki < keys.length; ki++) {
    const key = keys[ki];
    if (view.isCool(geminiCoolId(key))) {
      statuses.push(429);
      lastError = `key ${ki + 1}: cooling down`;
      continue;
    }
    for (const model of models) {
      if (slow.has(model)) {
        continue;
      }
      if (view.isCool(geminiCoolId(key, model))) {
        statuses.push(429);
        lastError = `key ${ki + 1} model ${model}: cooling down`;
        continue;
      }
      if (Date.now() - started > budget) {
        statuses.push('timeout');
        lastError = 'gemini time budget used';
        break keyLoop;
      }
      let thinking = thinkingFor(model);
      let nextKey = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        const body = thinking ? { ...base, generationConfig: { ...base.generationConfig, thinkingConfig: thinking } } : base;
        let res;
        try {
          res = await post(
            fetchImpl,
            `${GEMINI_ENDPOINT}/${model}:generateContent`,
            { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) },
            limit,
          );
        } catch (e) {
          if (e && e.timeout) {
            slow.add(model);
          }
          statuses.push(e && e.timeout ? 'timeout' : 'network');
          lastError = e && e.timeout ? `model ${model}: timeout` : 'network error';
          break;
        }
        if (res.status === 400 && thinking && attempt === 0) {
          // Most likely the thinking field: retry this model once without it
          thinking = null;
          continue;
        }
        if (res.status === 429) {
          const c = geminiQuotaCooldown(await bodyText(res), t0, header(res, 'retry-after'));
          await view.cool(geminiCoolId(key, model), c.until, c.reason);
          statuses.push(429);
          lastError = `key ${ki + 1} model ${model}: http 429 (${c.reason})`;
          break;
        }
        if (res.status === 404) {
          // Model not available for this key / project: skip it for an hour
          await view.cool(geminiCoolId(key, model), t0 + HOUR_MS, 'model');
          statuses.push(404);
          lastError = `model ${model}: http 404`;
          break;
        }
        if (res.status >= 500) {
          statuses.push(res.status);
          lastError = `model ${model}: http ${res.status}`;
          break;
        }
        if (res.status === 402) {
          // AI Studio prepaid credits used up on this key's project: next key, retry after the daily reset
          await view.cool(geminiCoolId(key), nextGeminiReset(t0), 'billing');
          statuses.push(402);
          lastError = `key ${ki + 1}: gemini billing: prepaid credits depleted (http 402)`;
          nextKey = true;
          break;
        }
        if (!res.ok) {
          const text = res.status === 400 ? await bodyText(res) : '';
          if (res.status === 401 || res.status === 403 || KEY_PROBLEM_RE.test(text)) {
            // This key is refused (invalid / revoked / restricted): next key, look again in 10 min
            await view.cool(geminiCoolId(key), t0 + 10 * MINUTE_MS, 'key');
            statuses.push('key');
            lastError = `key ${ki + 1}: http ${res.status}`;
            nextKey = true;
            break;
          }
          // Bad request: another key or model will not help (the next provider may)
          return { ok: false, error: `http ${res.status}`, code: 'key' };
        }
        let data;
        try {
          data = await res.json();
        } catch (e) {
          statuses.push('bad json');
          lastError = 'bad json';
          break;
        }
        const cand = data && data.candidates && data.candidates[0];
        const text = ((cand && cand.content && cand.content.parts) || [])
          .map(p => (p && !p.thought && typeof p.text === 'string' ? p.text : ''))
          .join('')
          .trim();
        if (!text) {
          statuses.push('empty');
          lastError = `model ${model}: empty answer`;
          break;
        }
        return { ok: true, text, model, sources: groundingSources(cand), provider: 'gemini', keyIndex: ki };
      }
      if (nextKey) {
        break;
      }
    }
  }
  return { ok: false, error: lastError, code: errorCode(statuses) };
}
