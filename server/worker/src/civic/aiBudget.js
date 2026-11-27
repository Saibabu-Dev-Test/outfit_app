// FREE TIER ONLY guard for the Worker's AI calls (Sai's rule: "only free tier matrame undali").
// Daily per-provider request caps, set BELOW each provider's free daily limits, so the Worker can
// never run past a free quota (and so never into a bill if billing were ever switched on). Counted
// in D1 (table usage, the same day/key/n counters the civic caps use), one tiny read + one write per
// call. Never stores a key: per-key counters use a short md5 prefix (as aiCooldown.js does).
// Any D1 problem is swallowed and the call is allowed (the providers' own free limits then answer
// 429, which the chain treats as "used up" and falls to the next free step).
//
// Caps (checked against the official docs on 2026-11-26):
//   Gemini API free tier (https://ai.google.dev/gemini-api/docs/rate-limits): limits are per
//     project + model, RPD resets at midnight Pacific; the per-model numbers are only shown in AI
//     Studio. Grounding with Google Search is free only on Gemini 2.5 Flash / Flash-Lite, "up to 500
//     RPD (limit shared with Flash RPD)" (https://ai.google.dev/gemini-api/docs/pricing).
//     -> GEMINI_DAILY_CAP_PER_KEY 400 calls / key / Pacific day (all models), of which
//        GEMINI_GROUNDED_DAILY_CAP_PER_KEY 300 grounded (below the 500 free grounded RPD).
//   Groq free plan (https://console.groq.com/docs/rate-limits): openai/gpt-oss-120b and -20b each
//     30 RPM, 1,000 RPD, 8K TPM, 200K TPD (resets 00:00 UTC).
//     -> GROQ_DAILY_CAP 300 requests / UTC day and GROQ_DAILY_TOKEN_CAP 300,000 tokens / UTC day
//        (both models together have 2,000 RPD and 400K TPD).
//   Cloudflare Workers AI (https://developers.cloudflare.com/workers-ai/platform/pricing/): 10,000
//     Neurons / day free (00:00 UTC); @cf/google/gemma-4-26b-a4b-it = 9,091 neurons per M input
//     tokens + 27,273 per M output tokens. On the Workers Free plan more simply fails; on Workers
//     Paid it would be billed, so the Worker stops itself first.
//     -> WORKERS_AI_DAILY_NEURON_CAP 8,000 estimated neurons / UTC day.
import { md5Hex } from '../md5.js';
import { nextGeminiReset, nextUtcDay } from './aiCooldown.js';

export const GEMINI_DAILY_CAP_PER_KEY = 400;
export const GEMINI_GROUNDED_DAILY_CAP_PER_KEY = 300;
export const GROQ_DAILY_CAP = 300;
export const GROQ_DAILY_TOKEN_CAP = 300000;
export const WORKERS_AI_DAILY_NEURON_CAP = 8000;
export const WORKERS_AI_FREE_NEURONS = 10000;
// gemma-4-26b-a4b-it neurons per token (Workers AI pricing page, 2026-11-26)
export const WORKERS_AI_NEURONS_IN = 9091 / 1e6;
export const WORKERS_AI_NEURONS_OUT = 27273 / 1e6;

// Day keys: Gemini resets at midnight Pacific (we use the same 08:00 UTC boundary aiCooldown.js
// uses, so a cap never frees up before the quota does); Groq + Workers AI at 00:00 UTC.
const isoDay = ms => new Date(ms).toISOString().slice(0, 10);
export const geminiDay = now => isoDay(nextGeminiReset(now) - 1);
export const utcDayOf = now => isoDay(nextUtcDay(now) - 1);

export const keyHash = key => md5Hex(String(key)).slice(0, 12);

// Estimated tokens of a text (pure): ~3 characters a token, on the safe side for Indian scripts
export const estTokens = text => Math.ceil(String(text || '').length / 3);
// Estimated Workers AI neurons of one call (pure: tested)
export const estNeurons = (inTokens, outTokens) => Math.ceil(inTokens * WORKERS_AI_NEURONS_IN + outTokens * WORKERS_AI_NEURONS_OUT);

// D1 store over the usage table (raw D1 binding env.DB). null without a DB (tests, local scripts).
export function d1Budget(DB) {
  if (!DB || typeof DB.prepare !== 'function') {
    return null;
  }
  return {
    async get(day, key) {
      try {
        const r = await DB.prepare('SELECT n FROM usage WHERE day = ? AND key = ?').bind(day, key).first();
        return Number((r && r.n) || 0);
      } catch (e) {
        return 0;
      }
    },
    async add(day, key, n) {
      try {
        await DB.prepare('INSERT INTO usage (day, key, n) VALUES (?, ?, ?) ON CONFLICT (day, key) DO UPDATE SET n = n + excluded.n').bind(day, key, n).run();
      } catch (e) {
        // ignore: worst case one call is not counted
      }
    },
  };
}

// In-memory store with the same shape (tests)
export function memoryBudget() {
  const m = new Map();
  return {
    rows: m,
    async get(day, key) {
      return m.get(`${day}|${key}`) || 0;
    },
    async add(day, key, n) {
      m.set(`${day}|${key}`, (m.get(`${day}|${key}`) || 0) + n);
    },
  };
}

// The store a call uses: deps.budget (tests), else D1 from env.DB, else none (no counting)
export const budgetFor = (env, deps = {}) => (deps && deps.budget !== undefined ? deps.budget : d1Budget(env && env.DB));

// Is there room for `n` more under `cap`? (no store = yes)
export async function hasRoom(store, day, key, cap, n = 1) {
  if (!store) {
    return true;
  }
  return (await store.get(day, key)) + n <= cap;
}

export async function spend(store, day, key, n = 1) {
  if (store && n > 0) {
    await store.add(day, key, n);
  }
}
