// Gemini helper for the Worker (civic research + Hospital AI). The key is the Worker secret
// GEMINI_API_KEY (wrangler secret put GEMINI_API_KEY), never in git. Missing key = a graceful
// { ok: false, error: 'not configured' } so routes and the cron never crash.
// Models: same free-tier list as src/config/ai.ts (GEMINI_MODELS), tried in order.
export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
export const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

export const isGeminiConfigured = env => !!(env && typeof env.GEMINI_API_KEY === 'string' && env.GEMINI_API_KEY.trim());

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

/**
 * generate(env, { prompt, system, grounded, json, maxTokens }, { fetchImpl })
 * -> { ok: true, text, model, sources } | { ok: false, error }
 */
export async function geminiGenerate(env, { prompt, system = '', grounded = false, maxTokens = 2048, temperature = 0.2 } = {}, { fetchImpl = fetch } = {}) {
  if (!isGeminiConfigured(env)) {
    return { ok: false, error: 'not configured' };
  }
  const body = {
    contents: [{ role: 'user', parts: [{ text: String(prompt || '') }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }
  if (grounded) {
    body.tools = [{ google_search: {} }];
  }
  let lastError = 'no model answered';
  for (const model of GEMINI_MODELS) {
    let res;
    try {
      res = await fetchImpl(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY.trim() },
        body: JSON.stringify(body),
      });
    } catch (e) {
      lastError = 'network error';
      continue;
    }
    if (res.status === 404 || res.status === 429 || res.status >= 500) {
      lastError = `model ${model}: http ${res.status}`;
      continue;
    }
    if (!res.ok) {
      // 400/401/403: bad key or bad request; another model will not help
      return { ok: false, error: `http ${res.status}` };
    }
    let data;
    try {
      data = await res.json();
    } catch (e) {
      lastError = 'bad json';
      continue;
    }
    const cand = data && data.candidates && data.candidates[0];
    const text = ((cand && cand.content && cand.content.parts) || [])
      .map(p => (p && typeof p.text === 'string' ? p.text : ''))
      .join('')
      .trim();
    if (!text) {
      lastError = `model ${model}: empty answer`;
      continue;
    }
    return { ok: true, text, model, sources: groundingSources(cand) };
  }
  return { ok: false, error: lastError };
}
