// AI fallback chain on the Worker (server/worker/src/civic/{gemini,llm,aiCooldown}.js):
// Gemini keys in turn (GEMINI_API_KEY, _2 .. _5) with remembered cool-downs, then Groq, then
// Workers AI; grounded research stays Gemini-only. fetch and env.AI.run are mocked; no real keys.
const gemini = require('../server/worker/src/civic/gemini.js');
const llm = require('../server/worker/src/civic/llm.js');
const cool = require('../server/worker/src/civic/aiCooldown.js');

const NOW = Date.UTC(2026, 10, 18, 7, 0, 0); // 07:00 UTC, before the 08:00 UTC Gemini reset

const geminiOk = (text: string) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
const httpFail = (status: number, body: any = {}, headers: Record<string, string> = {}) => ({
  ok: false,
  status,
  text: async () => JSON.stringify(body),
  json: async () => body,
  headers: { get: (n: string) => headers[n.toLowerCase()] || null },
});
const groqOk = (text: string) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: text } }] }) });

const DAILY_429 = { error: { code: 429, details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } };

// fetch fake: Gemini answers per key (x-goog-api-key), Groq per model; records every request
const makeFetch = (gem: (key: string, model: string) => any, groq: (model: string, body: any) => any = () => httpFail(500)) => {
  const calls: { to: string; key?: string; model: string; body: any }[] = [];
  const f = jest.fn(async (url: string, init: any) => {
    const body = JSON.parse(init.body);
    if (url === llm.GROQ_ENDPOINT) {
      calls.push({ to: 'groq', model: body.model, body });
      return groq(body.model, body);
    }
    const model = url.split('/models/')[1].split(':')[0];
    const key = init.headers['x-goog-api-key'];
    calls.push({ to: 'gemini', key, model, body });
    return gem(key, model);
  });
  return { f, calls };
};

describe('Gemini key rotation + cool-down memory', () => {
  it('a key that is out of quota (429 on every model) hands over to the next key', async () => {
    const store = cool.memoryCooldown();
    const { f, calls } = makeFetch(key => (key === 'key-one' ? httpFail(429, DAILY_429) : geminiOk('from key two')));
    const env = { GEMINI_API_KEY: 'key-one', GEMINI_API_KEY_2: 'key-two' };
    const r = await gemini.geminiGenerate(env, { prompt: 'x' }, { fetchImpl: f, now: NOW, cooldown: store });
    expect(r).toMatchObject({ ok: true, text: 'from key two', provider: 'gemini', keyIndex: 1, model: gemini.GEMINI_MODELS[0] });
    expect(calls.filter(c => c.key === 'key-one')).toHaveLength(gemini.GEMINI_MODELS.length);
    // every model of key one cools down until the daily reset (08:00 UTC)
    gemini.GEMINI_MODELS.forEach((m: string) => expect(store.rows.get(gemini.geminiCoolId('key-one', m))).toEqual({ until: cool.nextGeminiReset(NOW), reason: 'daily' }));
    // the store never holds a key, only a short hash
    [...store.rows.keys()].forEach(id => expect(id).not.toMatch(/key-one|key-two/));
    expect(gemini.geminiCoolId('key-one')).toMatch(/^gemini:[0-9a-f]{12}:\*$/);

    // next call: key one is skipped without a request
    const second = makeFetch(() => geminiOk('again'));
    const r2 = await gemini.geminiGenerate(env, { prompt: 'x' }, { fetchImpl: second.f, now: NOW + 1000, cooldown: store });
    expect(r2).toMatchObject({ ok: true, keyIndex: 1 });
    expect(second.calls.map(c => c.key)).toEqual(['key-two']);
    // after the reset key one is used again
    const third = makeFetch(() => geminiOk('reset'));
    expect(await gemini.geminiGenerate(env, { prompt: 'x' }, { fetchImpl: third.f, now: cool.nextGeminiReset(NOW) + 1, cooldown: store })).toMatchObject({ ok: true, keyIndex: 0 });
  });

  it('402 (credits used up), 401 and 403 cool the whole key and move on; duplicates / blanks skipped', async () => {
    expect(gemini.geminiKeys({ GEMINI_API_KEY: ' a ', GEMINI_API_KEY_2: 'a', GEMINI_API_KEY_3: '', GEMINI_API_KEY_5: 'b' })).toEqual(['a', 'b']);
    for (const status of [402, 401, 403]) {
      const store = cool.memoryCooldown();
      const { f, calls } = makeFetch(key => (key === 'a' ? httpFail(status) : geminiOk('b answers')));
      const r = await gemini.geminiGenerate({ GEMINI_API_KEY: 'a', GEMINI_API_KEY_2: 'b' }, { prompt: 'x' }, { fetchImpl: f, now: NOW, cooldown: store });
      expect(r).toMatchObject({ ok: true, text: 'b answers', keyIndex: 1 });
      expect(calls.filter(c => c.key === 'a')).toHaveLength(1); // one request, not one per model
      const row = store.rows.get(gemini.geminiCoolId('a'));
      expect(row.reason).toBe(status === 402 ? 'billing' : 'key');
      expect(row.until).toBe(status === 402 ? cool.nextGeminiReset(NOW) : NOW + 10 * cool.MINUTE_MS);
    }
  });

  it('per-minute 429 cools only that key + model for the RetryInfo delay', async () => {
    const store = cool.memoryCooldown();
    const perMinute = { error: { code: 429, details: [{ violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] }, { retryDelay: '33s' }] } };
    const { f } = makeFetch((key, model) => (model === gemini.GEMINI_MODELS[0] ? httpFail(429, perMinute) : geminiOk('second model')));
    const r = await gemini.geminiGenerate({ GEMINI_API_KEY: 'a' }, { prompt: 'x' }, { fetchImpl: f, now: NOW, cooldown: store });
    expect(r).toMatchObject({ ok: true, model: gemini.GEMINI_MODELS[1] });
    expect(store.rows.get(gemini.geminiCoolId('a', gemini.GEMINI_MODELS[0]))).toEqual({ until: NOW + 33000, reason: 'minute' });
    expect(await gemini.geminiReady({ GEMINI_API_KEY: 'a' }, { now: NOW, cooldown: store })).toBe(true);
  });

  it('geminiReady is false only when every key is cooling down', async () => {
    const store = cool.memoryCooldown();
    const env = { GEMINI_API_KEY: 'a', GEMINI_API_KEY_2: 'b' };
    expect(await gemini.geminiReady({}, { now: NOW, cooldown: store })).toBe(false);
    expect(await gemini.geminiReady(env, { now: NOW, cooldown: store })).toBe(true);
    await store.set(gemini.geminiCoolId('a'), NOW + 1000, 'billing');
    expect(await gemini.geminiReady(env, { now: NOW, cooldown: store })).toBe(true);
    await Promise.all(gemini.GEMINI_MODELS.map((m: string) => store.set(gemini.geminiCoolId('b', m), NOW + 1000, 'daily')));
    expect(await gemini.geminiReady(env, { now: NOW, cooldown: store })).toBe(false);
    expect(await gemini.geminiReady(env, { now: NOW + 1001, cooldown: store })).toBe(true);
  });

  it('D1 store: remembers across calls, ignores expired rows, never breaks on a D1 error', async () => {
    const rows = new Map<string, any>();
    const DB = {
      prepare: (sql: string) => ({
        bind: (...b: any[]) => ({
          all: async () => ({ results: [...rows.values()].filter(r => r.until > b[0]) }),
          run: async () => {
            rows.set(b[0], { id: b[0], until: b[1], reason: b[2] });
            return {};
          },
          sql,
        }),
      }),
    };
    const s = cool.d1Cooldown(DB);
    await s.set('groq:*', NOW + 5, 'key', NOW);
    expect([...(await s.active(NOW))]).toEqual([['groq:*', NOW + 5]]);
    expect((await s.active(NOW + 5)).size).toBe(0);
    const broken = cool.d1Cooldown({ prepare: () => { throw new Error('no table'); } });
    expect((await broken.active(NOW)).size).toBe(0);
    await expect(broken.set('x', 1, 'r', NOW)).resolves.toBeUndefined();
    expect(cool.d1Cooldown(undefined)).toBeNull();
  });
});

describe('fallback chain: Gemini -> Groq -> Workers AI', () => {
  const ai = (impl: (model: string, input: any) => any) => ({ run: jest.fn(async (model: string, input: any) => impl(model, input)) });

  it('Gemini out of quota -> Groq answers (gpt-oss-120b first, key only in the auth header)', async () => {
    const store = cool.memoryCooldown();
    const { f, calls } = makeFetch(() => httpFail(429, DAILY_429), () => groqOk('groq answer'));
    const AI = ai(() => ({ response: 'never' }));
    const env = { GEMINI_API_KEY: 'g', GROQ_API_KEY: 'groq-key', AI };
    const r = await llm.aiGenerate(env, { prompt: 'hello', system: 'sys' }, { fetchImpl: f, now: NOW, cooldown: store });
    expect(r).toMatchObject({ ok: true, text: 'groq answer', provider: 'groq', model: 'openai/gpt-oss-120b', fellBackFrom: ['gemini'] });
    const g = calls.find(c => c.to === 'groq')!;
    expect(g.body.messages).toEqual([{ role: 'system', content: 'sys' }, { role: 'user', content: 'hello' }]);
    expect(JSON.stringify(g.body)).not.toMatch(/groq-key/);
    expect((f.mock.calls.find((c: any) => c[0] === llm.GROQ_ENDPOINT) as any)[1].headers.authorization).toBe('Bearer groq-key');
    expect(AI.run).not.toHaveBeenCalled();
  });

  it('Groq 120b limited -> 20b; both limited -> Workers AI (Gemma) answers', async () => {
    const store = cool.memoryCooldown();
    const { f } = makeFetch(
      () => httpFail(429, DAILY_429),
      model => (model === 'openai/gpt-oss-120b' ? httpFail(429, { error: { message: 'Rate limit reached: tokens per day (TPD)' } }) : groqOk('<think>hmm</think>small model')),
    );
    const env = { GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', AI: ai(() => ({ response: 'x' })) };
    const r = await llm.aiGenerate(env, { prompt: 'p' }, { fetchImpl: f, now: NOW, cooldown: store });
    expect(r).toMatchObject({ ok: true, text: 'small model', provider: 'groq', model: 'openai/gpt-oss-20b' });
    expect(store.rows.get('groq:openai/gpt-oss-120b')).toEqual({ until: cool.nextUtcDay(NOW), reason: 'daily' });

    const all429 = makeFetch(() => httpFail(429, DAILY_429), () => httpFail(429, {}, { 'retry-after': '20' }));
    const AI = ai(() => ({ choices: [{ message: { content: 'gemma answer' } }] }));
    const store2 = cool.memoryCooldown();
    const r2 = await llm.aiGenerate({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', AI }, { prompt: 'p', system: 's', maxTokens: 300 }, { fetchImpl: all429.f, now: NOW, cooldown: store2 });
    expect(r2).toMatchObject({ ok: true, text: 'gemma answer', provider: 'workers-ai', model: llm.WORKERS_AI_MODEL, fellBackFrom: ['gemini', 'groq'] });
    expect(llm.WORKERS_AI_MODEL).toBe('@cf/google/gemma-4-26b-a4b-it');
    expect(AI.run).toHaveBeenCalledWith(llm.WORKERS_AI_MODEL, { messages: [{ role: 'system', content: 's' }, { role: 'user', content: 'p' }], max_tokens: 300, temperature: 0.2 });
    expect(store2.rows.get('groq:openai/gpt-oss-20b')).toEqual({ until: NOW + 20000, reason: 'minute' });
  });

  it('no Groq key: Gemini -> Workers AI directly; nothing configured = config', async () => {
    const { f, calls } = makeFetch(() => httpFail(402));
    const AI = ai(() => ({ response: 'cf answer' }));
    const r = await llm.aiGenerate({ GEMINI_API_KEY: 'g', AI }, { prompt: 'p' }, { fetchImpl: f, now: NOW, cooldown: cool.memoryCooldown() });
    expect(r).toMatchObject({ ok: true, provider: 'workers-ai', fellBackFrom: ['gemini'] });
    expect(calls.some(c => c.to === 'groq')).toBe(false);
    expect(await llm.aiGenerate({}, { prompt: 'p' }, { fetchImpl: f, cooldown: null })).toEqual({ ok: false, error: 'not configured', code: 'config' });
    expect(llm.isAiConfigured({ AI })).toBe(true);
    expect(llm.isAiConfigured({ AI: {} })).toBe(false);
  });

  it('Workers AI 4006 (daily free neurons used up) cools it until 00:00 UTC; every provider down = quota', async () => {
    const store = cool.memoryCooldown();
    const AI = ai(() => {
      throw new Error('AiError: 4006: you have used up your daily free allocation of 10,000 neurons');
    });
    const { f } = makeFetch(() => httpFail(429, DAILY_429));
    const r = await llm.aiGenerate({ GEMINI_API_KEY: 'g', AI }, { prompt: 'p' }, { fetchImpl: f, now: NOW, cooldown: store });
    expect(r).toMatchObject({ ok: false, code: 'quota', tried: ['gemini', 'workers-ai'] });
    expect(store.rows.get('workers-ai:*')).toEqual({ until: cool.nextUtcDay(NOW), reason: 'daily' });
    // next call: nothing is requested (Gemini keys and Workers AI are all cooling down)
    const again = makeFetch(() => geminiOk('never'));
    const r2 = await llm.aiGenerate({ GEMINI_API_KEY: 'g', AI }, { prompt: 'p' }, { fetchImpl: again.f, now: NOW + 1, cooldown: store });
    expect(r2).toMatchObject({ ok: false, code: 'quota' });
    expect(again.calls).toHaveLength(0);
    expect(AI.run).toHaveBeenCalledTimes(1);
    // owner view: no key values, who is cooling down
    const st = await llm.aiProviderStatus({ GEMINI_API_KEY: 'secret-g', AI }, { now: NOW + 1, cooldown: store });
    expect(st.order).toEqual(['gemini', 'groq', 'workers-ai']);
    expect(st.workersAi).toMatchObject({ configured: true, coolingUntil: cool.nextUtcDay(NOW) });
    expect(st.groq).toEqual({ configured: false, coolingUntil: 0 });
    expect(JSON.stringify(st)).not.toMatch(/secret-g/);
  });

  it('Workers AI busy (3040 / 429) cools a minute; other errors do not cool', async () => {
    const store = cool.memoryCooldown();
    const busy = { run: jest.fn(async () => { throw new Error('3040: Capacity temporarily exceeded'); }) };
    expect(await llm.workersAiGenerate({ AI: busy }, { prompt: 'p' }, { now: NOW, cooldown: store })).toMatchObject({ ok: false, code: 'quota' });
    expect(store.rows.get('workers-ai:*')).toEqual({ until: NOW + cool.MINUTE_MS, reason: 'minute' });
    const store2 = cool.memoryCooldown();
    const odd = { run: jest.fn(async () => { throw new Error('5006: bad input'); }) };
    expect(await llm.workersAiGenerate({ AI: odd }, { prompt: 'p' }, { now: NOW, cooldown: store2 })).toMatchObject({ ok: false, code: 'other' });
    expect(store2.rows.size).toBe(0);
  });

  it('grounded calls never fall back to Groq or Workers AI', async () => {
    const store = cool.memoryCooldown();
    const { f, calls } = makeFetch(() => httpFail(429, DAILY_429), () => groqOk('ungrounded guess'));
    const AI = ai(() => ({ response: 'ungrounded guess' }));
    const env = { GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q', AI };
    const r = await llm.aiGenerate(env, { prompt: 'research', grounded: true }, { fetchImpl: f, now: NOW, cooldown: store });
    expect(r).toMatchObject({ ok: false, code: 'quota', provider: 'gemini' });
    expect(calls.every(c => c.to === 'gemini')).toBe(true);
    expect(calls[0].body.tools).toEqual([{ google_search: {} }]);
    expect(AI.run).not.toHaveBeenCalled();
    // grounded with no Gemini key at all: still no fallback
    const none = await llm.aiGenerate({ GROQ_API_KEY: 'q', AI }, { prompt: 'r', grounded: true }, { fetchImpl: f, now: NOW, cooldown: store });
    expect(none).toMatchObject({ ok: false, code: 'config' });
    expect(AI.run).not.toHaveBeenCalled();
  });
});

describe('pure helpers', () => {
  it('nextGeminiReset: next 08:00 UTC (midnight Pacific); nextUtcDay: next 00:00 UTC', () => {
    expect(cool.nextGeminiReset(NOW)).toBe(Date.UTC(2026, 10, 18, 8));
    expect(cool.nextGeminiReset(Date.UTC(2026, 10, 18, 8))).toBe(Date.UTC(2026, 10, 19, 8));
    expect(cool.nextGeminiReset(Date.UTC(2026, 11, 31, 23, 59))).toBe(Date.UTC(2027, 0, 1, 8));
    expect(cool.nextUtcDay(NOW)).toBe(Date.UTC(2026, 10, 19));
    expect(cool.nextUtcDay(Date.UTC(2026, 10, 19))).toBe(Date.UTC(2026, 10, 20));
  });

  it('geminiQuotaCooldown: per-day quota waits for the reset, per-minute uses RetryInfo / retry-after / 60 s (5 s .. 10 min)', () => {
    expect(gemini.geminiQuotaCooldown(JSON.stringify(DAILY_429), NOW)).toEqual({ until: cool.nextGeminiReset(NOW), reason: 'daily' });
    expect(gemini.geminiQuotaCooldown(JSON.stringify([DAILY_429]), NOW).reason).toBe('daily');
    expect(gemini.geminiQuotaCooldown(JSON.stringify({ error: { message: 'Quota exceeded: requests per day' } }), NOW).reason).toBe('daily');
    expect(gemini.geminiQuotaCooldown(JSON.stringify({ error: { details: [{ retryDelay: '33s' }] } }), NOW)).toEqual({ until: NOW + 33000, reason: 'minute' });
    expect(gemini.geminiQuotaCooldown('', NOW, '12')).toEqual({ until: NOW + 12000, reason: 'minute' });
    expect(gemini.geminiQuotaCooldown('not json', NOW)).toEqual({ until: NOW + 60000, reason: 'minute' });
    expect(gemini.geminiQuotaCooldown('', NOW, '1').until).toBe(NOW + 5000);
    expect(gemini.geminiQuotaCooldown('', NOW, '99999').until).toBe(NOW + 600000);
  });

  it('chainCode: a temporary limit wins; all config = config; else other', () => {
    expect(llm.chainCode(['billing', 'quota'])).toBe('quota');
    expect(llm.chainCode(['key', 'timeout'])).toBe('timeout');
    expect(llm.chainCode(['billing', 'other'])).toBe('billing');
    expect(llm.chainCode(['other', 'key'])).toBe('key');
    expect(llm.chainCode(['config', 'config'])).toBe('config');
    expect(llm.chainCode(['config', 'other'])).toBe('other');
    expect(llm.chainCode([])).toBe('other');
  });

  it('workersAiText: classic, OpenAI-style, nested result, string; reasoning dropped', () => {
    expect(llm.workersAiText({ response: ' hi ' })).toBe('hi');
    expect(llm.workersAiText({ response: { a: 1 } })).toBe('{"a":1}');
    expect(llm.workersAiText({ choices: [{ message: { content: '<think>x</think>answer' } }] })).toBe('answer');
    expect(llm.workersAiText({ choices: [{ text: 'plain' }] })).toBe('plain');
    expect(llm.workersAiText({ result: { response: 'nested' } })).toBe('nested');
    expect(llm.workersAiText('raw')).toBe('raw');
    expect(llm.workersAiText(null)).toBe('');
    expect(llm.workersAiText({})).toBe('');
  });

  it('chain order and providers are as documented', () => {
    expect(llm.AI_CHAIN).toEqual(['gemini', 'groq', 'workers-ai']);
    expect(llm.GROQ_MODELS).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
    expect(gemini.GEMINI_KEY_VARS).toEqual(['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY_5']);
  });
});
