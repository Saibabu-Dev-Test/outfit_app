// FREE TIER ONLY guard on the Worker's AI calls (gemini.js, llm.js, aiBudget.js): only allow-listed
// free models are ever sent a request, a 402 / billing answer is never retried and falls through to
// the next free step, and the Worker's own daily caps hold. fetch and env.AI.run are mocked.
const gemini = require('../server/worker/src/civic/gemini.js');
const llm = require('../server/worker/src/civic/llm.js');
const cool = require('../server/worker/src/civic/aiCooldown.js');
const budget = require('../server/worker/src/civic/aiBudget.js');

const NOW = Date.UTC(2026, 10, 26, 7, 0, 0);
const geminiOk = (text: string) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
const groqOk = (text: string, usage?: any) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: text } }], ...(usage ? { usage } : {}) }) });
const fail = (status: number, body: any = {}) => ({ ok: false, status, text: async () => JSON.stringify(body), json: async () => body, headers: { get: () => null } });

type Call = { to: string; key?: string; model: string };
const makeFetch = (gem: (key: string, model: string) => any, groq: (model: string) => any = () => fail(500)) => {
  const calls: Call[] = [];
  const f = jest.fn(async (url: string, init: any) => {
    const body = JSON.parse(init.body);
    if (url === llm.GROQ_ENDPOINT) {
      calls.push({ to: 'groq', model: body.model });
      return groq(body.model);
    }
    const model = url.split('/models/')[1].split(':')[0];
    const key = init.headers['x-goog-api-key'];
    calls.push({ to: 'gemini', key, model });
    return gem(key, model);
  });
  return { f, calls };
};
const aiBinding = (fn: (model: string, input: any) => any) => ({ run: jest.fn(async (m: string, i: any) => fn(m, i)) });

describe('model lists: only allow-listed free models', () => {
  it('Gemini: every listed model is free, no alias / pro / paid model; grounded = 2.5 Flash-Lite only', () => {
    expect(gemini.GEMINI_MODELS.length).toBeGreaterThan(0);
    gemini.GEMINI_MODELS.forEach((m: string) => {
      expect(gemini.GEMINI_FREE_MODELS).toContain(m);
      expect(m).not.toMatch(gemini.GEMINI_BANNED_RE);
    });
    expect(gemini.GEMINI_MODELS).not.toContain('gemini-flash-latest');
    expect(gemini.GEMINI_GROUNDED_MODELS).toEqual(['gemini-2.5-flash-lite']);
    expect(gemini.freeModels(['gemini-flash-latest', 'gemini-3.1-pro-preview', 'gemini-4-carbon', 'gemini-3.5-flash-lite'])).toEqual(['gemini-3.5-flash-lite']);
    expect(gemini.freeModels(['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite'], true)).toEqual(['gemini-2.5-flash-lite']);
    expect(gemini.freeModels(null)).toEqual([]);
  });

  it('Groq: gpt-oss-120b / -20b only; groq/compound never used; Workers AI: allow-listed model only', () => {
    expect(llm.GROQ_MODELS).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
    expect(llm.groqFreeModels(['groq/compound', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b'])).toEqual(['openai/gpt-oss-20b']);
    expect(llm.GROQ_SEARCH_ENABLED).toBe(false);
    expect(llm.WORKERS_AI_FREE_MODELS).toContain(llm.WORKERS_AI_MODEL);
    expect(llm.isWorkersAiFreeModel('@cf/meta/llama-4-scout-17b-16e-instruct')).toBe(false);
  });

  it('a call asking for a non-free model sends nothing', async () => {
    const { f } = makeFetch(() => geminiOk('x'));
    expect(await gemini.geminiGenerate({ GEMINI_API_KEY: 'k' }, { prompt: 'p', models: ['gemini-flash-latest', 'gemini-3.1-pro-preview'] }, { fetchImpl: f, now: NOW, cooldown: null })).toMatchObject({ ok: false, code: 'config' });
    expect(await gemini.geminiGenerate({ GEMINI_API_KEY: 'k' }, { prompt: 'p', grounded: true, models: ['gemini-3.8-flash'] }, { fetchImpl: f, now: NOW, cooldown: null })).toMatchObject({ ok: false, code: 'config' });
    expect(await llm.groqGenerate({ GROQ_API_KEY: 'g' }, { prompt: 'p', groqModels: ['groq/compound'] }, { fetchImpl: f, now: NOW, cooldown: null })).toMatchObject({ ok: false, code: 'config' });
    expect(f).not.toHaveBeenCalled();
    const AI = aiBinding(() => ({ response: 'x' }));
    expect(await llm.workersAiGenerate({ AI }, { prompt: 'p', workersAiModel: '@cf/meta/llama-3.1-70b-instruct' }, { now: NOW, cooldown: null })).toMatchObject({ ok: false, code: 'config' });
    expect(AI.run).not.toHaveBeenCalled();
  });

  it('every request goes only to allow-listed models (grounded and not)', async () => {
    const { f, calls } = makeFetch(() => fail(429, { error: { message: 'per minute' } }));
    await gemini.geminiGenerate({ GEMINI_API_KEY: 'k' }, { prompt: 'p' }, { fetchImpl: f, now: NOW, cooldown: cool.memoryCooldown() });
    await gemini.geminiGenerate({ GEMINI_API_KEY: 'k2' }, { prompt: 'p', grounded: true }, { fetchImpl: f, now: NOW, cooldown: cool.memoryCooldown() });
    expect(calls.length).toBeGreaterThan(0);
    calls.forEach(c => expect(gemini.GEMINI_FREE_MODELS).toContain(c.model));
    expect(calls.filter(c => c.key === 'k2').map(c => c.model)).toEqual(['gemini-2.5-flash-lite']);
  });

  it('groqSearchGenerate never sends a request (no free web-search model)', async () => {
    const { f } = makeFetch(() => geminiOk('x'), () => groqOk('x'));
    expect(await llm.groqSearchGenerate({ GROQ_API_KEY: 'g' }, { prompt: 'p' }, { fetchImpl: f, now: NOW })).toMatchObject({ ok: false, code: 'config' });
    expect(await llm.groqSearchGenerate({}, { prompt: 'p' }, { fetchImpl: f, now: NOW })).toMatchObject({ ok: false, code: 'config' });
    expect(f).not.toHaveBeenCalled();
  });
});

describe('billing / payment-required answers fall through (never retried)', () => {
  it('isBillingAnswer: 402, billing text on 4xx, spend-cap 429; a plain quota 429 is not billing', () => {
    expect(gemini.isBillingAnswer(402, '')).toBe(true);
    expect(gemini.isBillingAnswer(400, '{"error":{"message":"This model requires a paid tier"}}')).toBe(true);
    expect(gemini.isBillingAnswer(403, 'Prepaid credits are depleted')).toBe(true);
    expect(gemini.isBillingAnswer(429, 'Your project has exceeded its spend cap')).toBe(true);
    expect(gemini.isBillingAnswer(429, 'Quota exceeded. Please check your plan and billing details.')).toBe(false);
    expect(gemini.isBillingAnswer(404, 'billing')).toBe(false);
    expect(gemini.isBillingAnswer(500, 'billing')).toBe(false);
  });

  it('Gemini billing on key one: one request, key cooled to the reset, next key answers', async () => {
    const store = cool.memoryCooldown();
    const { f, calls } = makeFetch(key => (key === 'a' ? fail(400, { error: { message: 'Billing account required: upgrade to a paid plan' } }) : geminiOk('b answers')));
    const r = await gemini.geminiGenerate({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_2: 'b' }, { prompt: 'p' }, { fetchImpl: f, now: NOW, cooldown: store });
    expect(r).toMatchObject({ ok: true, text: 'b answers', keyIndex: 1 });
    expect(calls.filter(c => c.key === 'a')).toHaveLength(1);
    expect(store.rows.get(gemini.geminiCoolId('a'))).toEqual({ until: cool.nextGeminiReset(NOW), reason: 'billing' });
  });

  it('Groq 402 / paid-plan answer: no retry on the other model, Groq cooled, chain falls to Workers AI', async () => {
    for (const ans of [fail(402), fail(400, { error: { message: 'This feature requires a paid plan' } })]) {
      const store = cool.memoryCooldown();
      const { f, calls } = makeFetch(() => fail(429, { error: { message: 'per day RPD' } }), () => ans);
      const AI = aiBinding(() => ({ response: 'cf answer' }));
      const r = await llm.aiGenerate({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', AI }, { prompt: 'p' }, { fetchImpl: f, now: NOW, cooldown: store, budget: budget.memoryBudget() });
      expect(r).toMatchObject({ ok: true, provider: 'workers-ai', fellBackFrom: ['gemini', 'groq'] });
      expect(calls.filter(c => c.to === 'groq')).toHaveLength(1);
      expect(store.rows.get('groq:*')).toEqual({ until: cool.nextUtcDay(NOW), reason: 'billing' });
    }
  });

  it('Workers AI billing / paid-plan error: code billing, cooled to the next UTC day', async () => {
    const store = cool.memoryCooldown();
    const AI = aiBinding(() => {
      throw new Error('402: this model requires Workers Paid');
    });
    expect(await llm.workersAiGenerate({ AI }, { prompt: 'p' }, { now: NOW, cooldown: store, budget: budget.memoryBudget() })).toMatchObject({ ok: false, code: 'billing' });
    expect(store.rows.get('workers-ai:*')).toEqual({ until: cool.nextUtcDay(NOW), reason: 'billing' });
    // the free-allocation message stays a quota
    const store2 = cool.memoryCooldown();
    const AI2 = aiBinding(() => {
      throw new Error('4006: you have used up your daily free allocation of 10,000 neurons, please upgrade to Workers Paid');
    });
    expect(await llm.workersAiGenerate({ AI: AI2 }, { prompt: 'p' }, { now: NOW, cooldown: store2 })).toMatchObject({ ok: false, code: 'quota' });
  });
});

describe('daily caps hold (aiBudget.js)', () => {
  it('caps are below the free limits', () => {
    expect(budget.GEMINI_GROUNDED_DAILY_CAP_PER_KEY).toBeLessThan(500);
    expect(budget.GEMINI_GROUNDED_DAILY_CAP_PER_KEY).toBeLessThanOrEqual(budget.GEMINI_DAILY_CAP_PER_KEY);
    expect(budget.GROQ_DAILY_CAP).toBe(300);
    expect(budget.GROQ_DAILY_TOKEN_CAP).toBe(300000);
    expect(budget.WORKERS_AI_DAILY_NEURON_CAP).toBe(8000);
    expect(budget.WORKERS_AI_DAILY_NEURON_CAP).toBeLessThan(budget.WORKERS_AI_FREE_NEURONS);
    expect(budget.estNeurons(1e6, 0)).toBe(9091);
    expect(budget.estTokens('abcdef')).toBe(2);
  });

  it('Gemini per-key cap: a key at its cap is skipped without a request; grounded cap counted separately', async () => {
    const b = budget.memoryBudget();
    const day = budget.geminiDay(NOW);
    await b.add(day, `ai_gem:${budget.keyHash('a')}`, budget.GEMINI_DAILY_CAP_PER_KEY);
    const { f, calls } = makeFetch(() => geminiOk('ok'));
    const r = await gemini.geminiGenerate({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_2: 'b' }, { prompt: 'p', grounded: true }, { fetchImpl: f, now: NOW, cooldown: null, budget: b });
    expect(r).toMatchObject({ ok: true, keyIndex: 1 });
    expect(calls.map(c => c.key)).toEqual(['b']);
    expect(await b.get(day, `ai_gem:${budget.keyHash('b')}`)).toBe(1);
    expect(await b.get(day, `ai_gemg:${budget.keyHash('b')}`)).toBe(1);
    // grounded cap reached on b: grounded refused (quota), ungrounded still allowed
    await b.add(day, `ai_gemg:${budget.keyHash('b')}`, budget.GEMINI_GROUNDED_DAILY_CAP_PER_KEY);
    expect(await gemini.geminiGenerate({ GEMINI_API_KEY: 'b' }, { prompt: 'p', grounded: true }, { fetchImpl: f, now: NOW, cooldown: null, budget: b })).toMatchObject({ ok: false, code: 'quota' });
    expect(await gemini.geminiGenerate({ GEMINI_API_KEY: 'b' }, { prompt: 'p' }, { fetchImpl: f, now: NOW, cooldown: null, budget: b })).toMatchObject({ ok: true });
    // no key value is ever stored
    [...b.rows.keys()].forEach(k => expect(k).not.toMatch(/\|ai_gemg?:[ab]$/));
  });

  it('Groq: 300 requests / UTC day and 300,000 tokens / UTC day; usage counted from the answer', async () => {
    const day = budget.utcDayOf(NOW);
    const b = budget.memoryBudget();
    const { f, calls } = makeFetch(() => geminiOk('x'), () => groqOk('groq says hi', { total_tokens: 1234 }));
    const env = { GROQ_API_KEY: 'q' };
    expect(await llm.groqGenerate(env, { prompt: 'p' }, { fetchImpl: f, now: NOW, cooldown: null, budget: b })).toMatchObject({ ok: true, text: 'groq says hi' });
    expect(await b.get(day, llm.GROQ_CAP_REQ)).toBe(1);
    expect(await b.get(day, llm.GROQ_CAP_TOK)).toBe(1234);
    // request cap
    await b.add(day, llm.GROQ_CAP_REQ, budget.GROQ_DAILY_CAP - 1);
    expect(await llm.groqGenerate(env, { prompt: 'p' }, { fetchImpl: f, now: NOW, cooldown: null, budget: b })).toMatchObject({ ok: false, code: 'quota' });
    expect(calls.filter(c => c.to === 'groq')).toHaveLength(1);
    // next UTC day: allowed again
    expect(await llm.groqGenerate(env, { prompt: 'p' }, { fetchImpl: f, now: cool.nextUtcDay(NOW) + 1, cooldown: null, budget: b })).toMatchObject({ ok: true });
    // token cap: the whole asked output is reserved
    const b2 = budget.memoryBudget();
    await b2.add(day, llm.GROQ_CAP_TOK, budget.GROQ_DAILY_TOKEN_CAP - 1000);
    const before = calls.length;
    expect(await llm.groqGenerate(env, { prompt: 'p', maxTokens: 2048 }, { fetchImpl: f, now: NOW, cooldown: null, budget: b2 })).toMatchObject({ ok: false, code: 'quota' });
    expect(calls.length).toBe(before);
    expect(await llm.groqGenerate(env, { prompt: 'p', maxTokens: 500 }, { fetchImpl: f, now: NOW, cooldown: null, budget: b2 })).toMatchObject({ ok: true });
  });

  it('Workers AI: 8,000 estimated neurons / UTC day; capped = no run, chain reports quota', async () => {
    const day = budget.utcDayOf(NOW);
    const b = budget.memoryBudget();
    const AI = aiBinding(() => ({ response: 'gemma', usage: { prompt_tokens: 1000, completion_tokens: 1000 } }));
    expect(await llm.workersAiGenerate({ AI }, { prompt: 'p' }, { now: NOW, cooldown: null, budget: b })).toMatchObject({ ok: true, text: 'gemma' });
    expect(await b.get(day, llm.WORKERS_AI_CAP_KEY)).toBe(budget.estNeurons(1000, 1000));
    await b.add(day, llm.WORKERS_AI_CAP_KEY, budget.WORKERS_AI_DAILY_NEURON_CAP - 10);
    expect(await llm.workersAiGenerate({ AI }, { prompt: 'p', maxTokens: 2048 }, { now: NOW, cooldown: null, budget: b })).toMatchObject({ ok: false, code: 'quota' });
    expect(AI.run).toHaveBeenCalledTimes(1);
    expect(await llm.aiGenerate({ AI }, { prompt: 'p' }, { now: NOW, cooldown: null, budget: b })).toMatchObject({ ok: false, code: 'quota', tried: ['workers-ai'] });
  });

  it('D1 budget store: counts per day + key, never breaks on a D1 error', async () => {
    const rows = new Map<string, number>();
    const DB = {
      prepare: (sql: string) => ({
        bind: (...a: any[]) => ({
          first: async () => ({ n: rows.get(`${a[0]}|${a[1]}`) || 0 }),
          run: async () => {
            rows.set(`${a[0]}|${a[1]}`, (rows.get(`${a[0]}|${a[1]}`) || 0) + a[2]);
            return { sql };
          },
        }),
      }),
    };
    const s = budget.d1Budget(DB);
    await budget.spend(s, '2026-11-26', 'k', 5);
    expect(await s.get('2026-11-26', 'k')).toBe(5);
    expect(await budget.hasRoom(s, '2026-11-26', 'k', 6)).toBe(true);
    expect(await budget.hasRoom(s, '2026-11-26', 'k', 5)).toBe(false);
    const broken = budget.d1Budget({ prepare: () => { throw new Error('no table'); } });
    expect(await broken.get('d', 'k')).toBe(0);
    await expect(broken.add('d', 'k', 1)).resolves.toBeUndefined();
    expect(budget.d1Budget(undefined)).toBeNull();
    expect(await budget.hasRoom(null, 'd', 'k', 0)).toBe(true);
  });
});

export {};
