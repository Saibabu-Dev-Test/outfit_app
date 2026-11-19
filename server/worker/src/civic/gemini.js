// Gemini helper for the Worker (civic research, translation and the civic "Ask AI" answers). The key
// is the Worker secret GEMINI_API_KEY (wrangler secret put GEMINI_API_KEY), never in git. Missing
// key = a graceful { ok: false, error: 'not configured' } so routes and the cron never crash.
// Speed (free tier): the fastest free models first (Flash-Lite), no / minimal thinking, and a
// per-call timeout so a slow model falls through to the next one within seconds.
// Errors carry a short `code` the app turns into a clear message:
//   'quota'   every model answered 429 (free-tier per-minute / per-day limit)
//   'billing' 402 (AI Studio prepaid credits used up: use a free-tier key on a project without billing)
//   'key'     400 / 401 / 403 key or request refused
//   'timeout' every model was too slow
//   'config'  no key
export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
// Fastest free-tier models first (Flash-Lite: highest free requests per day), then the Flash ones
export const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];
// Per-call time limits (ms): grounded research searches the web, so it gets longer
export const GEMINI_TIMEOUT_MS = 15000;
export const GEMINI_GROUNDED_TIMEOUT_MS = 30000;

export const isGeminiConfigured = env => !!(env && typeof env.GEMINI_API_KEY === 'string' && env.GEMINI_API_KEY.trim());

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

// Short app-facing code for a failed call (pure: tested)
export const errorCode = statuses => {
  if (!statuses.length) {
    return 'other';
  }
  if (statuses.includes(402)) {
    return 'billing';
  }
  if (statuses.every(x => x === 429 || x === 404)) {
    return statuses.includes(429) ? 'quota' : 'other';
  }
  if (statuses.every(x => x === 'timeout')) {
    return 'timeout';
  }
  return statuses.includes(429) ? 'quota' : 'other';
};

const post = async (fetchImpl, url, init, timeoutMs) => {
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
 * geminiGenerate(env, { prompt, system, grounded, jsonOut, maxTokens, temperature, timeoutMs, models }, { fetchImpl })
 * -> { ok: true, text, model, sources } | { ok: false, error, code }
 * jsonOut: ask for a JSON answer (translation calls; ignored when grounded)
 */
export async function geminiGenerate(
  env,
  { prompt, system = '', grounded = false, maxTokens = 2048, temperature = 0.2, jsonOut = false, timeoutMs = 0, models = GEMINI_MODELS } = {},
  { fetchImpl = fetch } = {},
) {
  if (!isGeminiConfigured(env)) {
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
  const statuses = [];
  let lastError = 'no model answered';
  for (const model of models) {
    let thinking = thinkingFor(model);
    for (let attempt = 0; attempt < 2; attempt++) {
      const body = thinking ? { ...base, generationConfig: { ...base.generationConfig, thinkingConfig: thinking } } : base;
      let res;
      try {
        res = await post(
          fetchImpl,
          `${GEMINI_ENDPOINT}/${model}:generateContent`,
          { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY.trim() }, body: JSON.stringify(body) },
          limit,
        );
      } catch (e) {
        statuses.push(e && e.timeout ? 'timeout' : 'network');
        lastError = e && e.timeout ? `model ${model}: timeout` : 'network error';
        break;
      }
      if (res.status === 400 && thinking && attempt === 0) {
        // Most likely the thinking field: retry this model once without it
        thinking = null;
        continue;
      }
      if (res.status === 404 || res.status === 429 || res.status >= 500) {
        statuses.push(res.status);
        lastError = `model ${model}: http ${res.status}`;
        break;
      }
      if (!res.ok) {
        // 400/401/402/403: bad key, billing (402 = AI Studio prepaid credits used up) or bad
        // request; another model will not help
        return res.status === 402
          ? { ok: false, error: 'gemini billing: prepaid credits depleted (http 402)', code: 'billing' }
          : { ok: false, error: `http ${res.status}`, code: 'key' };
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
      return { ok: true, text, model, sources: groundingSources(cand) };
    }
  }
  return { ok: false, error: lastError, code: errorCode(statuses) };
}
