// AI fallback chain for the Worker: civic AI must keep working when the free Gemini quota runs out.
//
// Order (AI_CHAIN), first answer wins:
//   1. Gemini     every key (GEMINI_API_KEY, GEMINI_API_KEY_2 .. _5), each through the model list,
//                 exhausted keys / models skipped while cooling down (gemini.js, aiCooldown.js)
//   2. Groq       only when the GROQ_API_KEY secret is set (free tier, OpenAI-compatible chat API)
//   3. Workers AI the Worker's own [ai] binding "AI" (wrangler.toml; free plan: 10,000 neurons / day,
//                 nothing to set up), WORKERS_AI_MODEL
// Groq sits before Workers AI: it is faster and its free quota is larger, and Workers AI's small
// daily free allocation is kept as the last resort.
//
// Grounded calls (Google-Search-grounded research of government / hospital facts) use Gemini ONLY:
// the other providers cannot search the web, and an ungrounded model would invent facts. When every
// Gemini key is used up, research.js keeps the stored data and reports status 'paused'
// ("research paused, showing saved info") instead.
// Everything else (translation, Explain simply, Laws AI, Hospital AI) answers from text the Worker
// already has, so any provider in the chain may answer it.
import { GEMINI_MODELS, geminiCoolId, geminiGenerate, geminiKeys, isGeminiConfigured, post } from './gemini.js';
import { MINUTE_MS, coolView, cooldownFor, nextUtcDay } from './aiCooldown.js';

export const AI_CHAIN = ['gemini', 'groq', 'workers-ai'];

// Groq (https://console.groq.com/docs/models, production models, Nov 2026)
export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
export const GROQ_TIMEOUT_MS = 20000;

// Workers AI (https://developers.cloudflare.com/workers-ai/models/): Gemma 4 (Google) instruct model,
// multilingual (Indian languages included), 256k context, cheap MoE (4B active) for the free neurons.
export const WORKERS_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';
export const WORKERS_AI_TIMEOUT_MS = 30000;

export const isGroqConfigured = env => !!(env && typeof env.GROQ_API_KEY === 'string' && env.GROQ_API_KEY.trim());
export const isWorkersAiConfigured = env => !!(env && env.AI && typeof env.AI.run === 'function');
// Any provider that can answer a non-grounded call (Ask AI, Explain simply, translation)
export const isAiConfigured = env => isGeminiConfigured(env) || isGroqConfigured(env) || isWorkersAiConfigured(env);

const messagesFor = (system, prompt) => [...(system ? [{ role: 'system', content: String(system) }] : []), { role: 'user', content: String(prompt || '') }];

// Reasoning text some open models put inline is never part of the answer
const stripThinking = t =>
  String(t || '')
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
    .trim();

/**
 * groqGenerate(env, { prompt, system, maxTokens, temperature, timeoutMs }, { fetchImpl, now, cooldown })
 * -> { ok: true, text, model, provider: 'groq' } | { ok: false, error, code }
 */
export async function groqGenerate(env, { prompt, system = '', maxTokens = 2048, temperature = 0.2, timeoutMs = 0 } = {}, { fetchImpl = fetch, now, cooldown } = {}) {
  if (!isGroqConfigured(env)) {
    return { ok: false, error: 'not configured', code: 'config' };
  }
  const t0 = now === undefined ? Date.now() : now;
  const view = await coolView(cooldownFor(env, { cooldown }), t0);
  if (view.isCool('groq:*')) {
    return { ok: false, error: 'groq: cooling down', code: 'quota' };
  }
  const codes = [];
  let lastError = 'no groq model answered';
  for (const model of GROQ_MODELS) {
    if (view.isCool(`groq:${model}`)) {
      codes.push('quota');
      continue;
    }
    let extras = { reasoning_effort: 'low' };
    for (let attempt = 0; attempt < 2; attempt++) {
      let res;
      try {
        res = await post(
          fetchImpl,
          GROQ_ENDPOINT,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${env.GROQ_API_KEY.trim()}` },
            body: JSON.stringify({ model, messages: messagesFor(system, prompt), temperature, max_completion_tokens: maxTokens, ...extras }),
          },
          timeoutMs || GROQ_TIMEOUT_MS,
        );
      } catch (e) {
        codes.push(e && e.timeout ? 'timeout' : 'other');
        lastError = `groq ${model}: ${e && e.timeout ? 'timeout' : 'network error'}`;
        break;
      }
      if (res.status === 400 && extras.reasoning_effort && attempt === 0) {
        extras = {}; // model without reasoning_effort: retry once plain
        continue;
      }
      if (res.status === 429) {
        let msg = '';
        try {
          msg = JSON.stringify(await res.json());
        } catch (e) {
          msg = '';
        }
        let ra = '';
        try {
          ra = (res.headers && res.headers.get && res.headers.get('retry-after')) || '';
        } catch (e) {
          ra = '';
        }
        const daily = /per day|\bRPD\b|\bTPD\b/i.test(msg);
        const until = daily ? nextUtcDay(t0) : t0 + Math.min(600, Math.max(5, parseFloat(ra) || 60)) * 1000;
        await view.cool(`groq:${model}`, until, daily ? 'daily' : 'minute');
        codes.push('quota');
        lastError = `groq ${model}: http 429`;
        break;
      }
      if (res.status === 401 || res.status === 403) {
        await view.cool('groq:*', t0 + 10 * MINUTE_MS, 'key');
        return { ok: false, error: `groq: http ${res.status}`, code: 'key' };
      }
      if (!res.ok) {
        codes.push('other');
        lastError = `groq ${model}: http ${res.status}`;
        break;
      }
      let data;
      try {
        data = await res.json();
      } catch (e) {
        codes.push('other');
        lastError = `groq ${model}: bad json`;
        break;
      }
      const msg = data && data.choices && data.choices[0] && data.choices[0].message;
      const text = stripThinking(msg && msg.content);
      if (!text) {
        codes.push('other');
        lastError = `groq ${model}: empty answer`;
        break;
      }
      return { ok: true, text, model, sources: [], provider: 'groq' };
    }
  }
  return { ok: false, error: lastError, code: codes.includes('quota') ? 'quota' : codes.length && codes.every(c => c === 'timeout') ? 'timeout' : 'other' };
}

// Text out of a Workers AI answer: classic { response } or OpenAI-style { choices } (pure: tested)
export function workersAiText(out) {
  if (!out) {
    return '';
  }
  if (typeof out === 'string') {
    return stripThinking(out);
  }
  if (typeof out.response === 'string') {
    return stripThinking(out.response);
  }
  if (out.response && typeof out.response === 'object') {
    return JSON.stringify(out.response);
  }
  const msg = out.choices && out.choices[0] && (out.choices[0].message || out.choices[0]);
  if (msg && typeof msg.content === 'string') {
    return stripThinking(msg.content);
  }
  if (msg && typeof msg.text === 'string') {
    return stripThinking(msg.text);
  }
  if (out.result) {
    return workersAiText(out.result);
  }
  return '';
}

/**
 * workersAiGenerate(env, { prompt, system, maxTokens, temperature, timeoutMs }, { now, cooldown })
 * -> { ok: true, text, model, provider: 'workers-ai' } | { ok: false, error, code }
 */
export async function workersAiGenerate(env, { prompt, system = '', maxTokens = 2048, temperature = 0.2, timeoutMs = 0 } = {}, { now, cooldown } = {}) {
  if (!isWorkersAiConfigured(env)) {
    return { ok: false, error: 'not configured', code: 'config' };
  }
  const t0 = now === undefined ? Date.now() : now;
  const view = await coolView(cooldownFor(env, { cooldown }), t0);
  if (view.isCool('workers-ai:*')) {
    return { ok: false, error: 'workers ai: cooling down', code: 'quota' };
  }
  let timer = null;
  try {
    const out = await Promise.race([
      env.AI.run(WORKERS_AI_MODEL, { messages: messagesFor(system, prompt), max_tokens: maxTokens, temperature }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { timeout: true })), timeoutMs || WORKERS_AI_TIMEOUT_MS);
      }),
    ]);
    const text = workersAiText(out);
    return text ? { ok: true, text, model: WORKERS_AI_MODEL, sources: [], provider: 'workers-ai' } : { ok: false, error: 'workers ai: empty answer', code: 'other' };
  } catch (e) {
    const msg = String((e && e.message) || e || '');
    if (e && e.timeout) {
      return { ok: false, error: 'workers ai: timeout', code: 'timeout' };
    }
    if (/4006|daily free allocation|neurons/i.test(msg)) {
      // Free daily neurons used up: resets 00:00 UTC
      await view.cool('workers-ai:*', nextUtcDay(t0), 'daily');
      return { ok: false, error: 'workers ai: daily free allocation used up', code: 'quota' };
    }
    if (/\b429\b|3040|capacity|rate limit|too many/i.test(msg)) {
      await view.cool('workers-ai:*', t0 + MINUTE_MS, 'minute');
      return { ok: false, error: 'workers ai: busy', code: 'quota' };
    }
    return { ok: false, error: `workers ai: ${msg.slice(0, 120)}`, code: 'other' };
  } finally {
    clearTimeout(timer);
  }
}

// One code for the app when every provider failed (pure: tested): a temporary limit first
export const chainCode = codes => {
  for (const c of ['quota', 'timeout', 'billing', 'key', 'cap']) {
    if (codes.includes(c)) {
      return c;
    }
  }
  return codes.length && codes.every(c => c === 'config') ? 'config' : 'other';
};

const RUNNERS = {
  gemini: { ready: isGeminiConfigured, run: geminiGenerate },
  groq: { ready: isGroqConfigured, run: groqGenerate },
  'workers-ai': { ready: isWorkersAiConfigured, run: workersAiGenerate },
};

/**
 * aiGenerate(env, opts, deps): same options and result as geminiGenerate, through the chain.
 * opts.grounded -> Gemini only (never an ungrounded fallback). Result adds `provider` and, when an
 * earlier provider failed, `fellBackFrom` (e.g. ['gemini']).
 */
export async function aiGenerate(env, opts = {}, deps = {}) {
  if (opts && opts.grounded) {
    const r = await geminiGenerate(env, opts, deps);
    return r.ok ? r : { ...r, provider: 'gemini' };
  }
  const fails = [];
  for (const name of AI_CHAIN) {
    const p = RUNNERS[name];
    if (!p.ready(env)) {
      continue;
    }
    const r = await p.run(env, opts, deps);
    if (r.ok) {
      return { ...r, provider: name, ...(fails.length ? { fellBackFrom: fails.map(f => f.provider) } : {}) };
    }
    fails.push({ ...r, provider: name });
  }
  if (!fails.length) {
    return { ok: false, error: 'not configured', code: 'config' };
  }
  return {
    ok: false,
    error: fails.map(f => `${f.provider}: ${f.error}`).join('; ').slice(0, 300),
    code: chainCode(fails.map(f => f.code)),
    tried: fails.map(f => f.provider),
  };
}

// Owner view: which providers are set up and which are cooling down now (no key values)
export async function aiProviderStatus(env, { now = Date.now(), cooldown } = {}) {
  const view = await coolView(cooldownFor(env, { cooldown }), now);
  const keys = geminiKeys(env);
  const keyState = keys.map((k, i) => {
    const whole = view.until(geminiCoolId(k));
    const models = GEMINI_MODELS.filter(m => !view.isCool(geminiCoolId(k, m)) && !(whole > now));
    return { key: i + 1, ready: models.length > 0, coolingUntil: whole > now ? whole : models.length ? 0 : Math.min(...GEMINI_MODELS.map(m => view.until(geminiCoolId(k, m)))) };
  });
  return {
    order: AI_CHAIN,
    gemini: { keys: keys.length, ready: keyState.filter(k => k.ready).length, keyState },
    groq: { configured: isGroqConfigured(env), coolingUntil: view.isCool('groq:*') ? view.until('groq:*') : 0 },
    workersAi: { configured: isWorkersAiConfigured(env), model: WORKERS_AI_MODEL, coolingUntil: view.isCool('workers-ai:*') ? view.until('workers-ai:*') : 0 },
  };
}
