// Fast + multilingual civic tabs: Worker speed paths (Flash-Lite first, no thinking, per-call timeout,
// Govt research in 3 parallel parts, translation together with research in small parallel chunks,
// translations one row per language), prefill districts, Ask AI / Explain simply / Hospital AI on
// stored data with safety lines, cached AI translations, clear free-tier errors (402 / 429), and the
// app side: 12 languages, instant cache, law context picking, error messages.
// D1 is node:sqlite with the real migration SQL (same as civicWorker.test.ts).
const nodeCrypto = require('crypto');
const fsMod = require('fs');
const pathMod = require('path');
const NodeBuffer = require('buffer').Buffer;
const ROOT = (globalThis as any).process.cwd();
if (!(globalThis as any).crypto?.subtle) {
  (globalThis as any).crypto = nodeCrypto.webcrypto;
}
const { DatabaseSync } = require('node:sqlite');
const { clearJwksCache, JWKS_URL } = require('../server/worker/src/auth.js');
const { handleRequest } = require('../server/worker/src/index.js');
const { Db } = require('../server/worker/src/db.js');
const gemini = require('../server/worker/src/civic/gemini.js');
const research = require('../server/worker/src/civic/research.js');
const ask = require('../server/worker/src/civic/ask.js');
const { SAFETY } = require('../server/worker/src/civic/safety.js');
const { SEED_DISTRICTS } = require('../server/worker/src/civic/districts.js');
const { STATES } = require('../server/worker/src/civic/states.js');

import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_LANGUAGES, APP_LANGUAGE_CODE, APP_LANGUAGE_NATIVE, langCode, staticLanguage } from '../src/i18n/appLanguage';
import { CIVIC_LABELS, civicText, setAiLabels } from '../src/i18n/civicLabels';
import { CIVIC_SAFETY, withCivicSafety } from '../src/i18n/civicSafety';
import { photoText } from '../src/i18n/photoEditLabels';
import { INDIAN_CITIES, cityDistrict } from '../src/constants/indianCities';
import { INDIA_STATES } from '../src/constants/indiaStates';
import { civicCacheKey, readCivicCache, touchIndex, writeCivicCache, CIVIC_CACHE_INDEX } from '../src/services/civicCache';
import { aiErrorKey, lawContextFor, lawSectionsFor, questionWords, LAW_CONTEXT_CHARS } from '../src/services/civicAi';
import { fromStore } from '../src/services/civicI18n';
import { trCode, POLL_MS, MAX_POLLS } from '../src/screens/Civic/useCivicData';

jest.mock('../src/services/workerApi', () => {
  class WorkerError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return { workerFetch: jest.fn(), WorkerError };
});
const { WorkerError } = require('../src/services/workerApi');

class FakeStmt {
  constructor(private db: any, private sql: string, private binds: any[] = []) {}
  bind(...b: any[]) {
    return new FakeStmt(this.db, this.sql, b);
  }
  exec() {
    const st = this.db.prepare(this.sql);
    if (/^\s*(SELECT|WITH)/i.test(this.sql)) {
      const results = st.all(...this.binds);
      return { results, meta: { rows_read: results.length, rows_written: 0, changes: 0 } };
    }
    const r = st.run(...this.binds);
    return { results: [], meta: { rows_read: 0, rows_written: Number(r.changes), changes: Number(r.changes) } };
  }
  async all() {
    return this.exec();
  }
  async run() {
    return this.exec();
  }
}
const makeD1 = () => {
  const db = new DatabaseSync(':memory:');
  const dir = pathMod.join(ROOT, 'server/worker/migrations');
  fsMod
    .readdirSync(dir)
    .filter((f: string) => f.endsWith('.sql'))
    .sort()
    .forEach((f: string) => db.exec(fsMod.readFileSync(pathMod.join(dir, f), 'utf8')));
  return { raw: db, prepare: (sql: string) => new FakeStmt(db, sql), batch: async (stmts: any[]) => stmts.map(s => s.exec()) };
};

const { privateKey, publicKey } = nodeCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const NOW = Date.UTC(2026, 10, 18, 7, 0, 0);
const b64u = (o: any) => NodeBuffer.from(JSON.stringify(o)).toString('base64url');
const token = (claims: any = {}) => {
  const nowSec = Math.floor(NOW / 1000);
  const h = b64u({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
  const p = b64u({
    aud: 'outfit-vote-9edca',
    iss: 'https://securetoken.google.com/outfit-vote-9edca',
    sub: 'user1',
    iat: nowSec - 60,
    auth_time: nowSec - 60,
    exp: nowSec + 3000,
    email: 'someone@gmail.com',
    email_verified: true,
    ...claims,
  });
  const sig = nodeCrypto.sign('RSA-SHA256', NodeBuffer.from(`${h}.${p}`), privateKey).toString('base64url');
  return `${h}.${p}.${sig}`;
};

const answer = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });
const ok = (j: any) => ({ ok: true, status: 200, json: async () => j });

// Gemini fake: research / translation / ask / translate-texts by prompt; records every call
const makeFetch = (opts: { askText?: string; status?: number } = {}) => {
  const calls: { model: string; body: any }[] = [];
  const f = jest.fn(async (url: string, init?: any) => {
    if (url === JWKS_URL) {
      return { ok: true, status: 200, headers: { get: () => 'public, max-age=3600' }, json: async () => ({ keys: [jwk] }) };
    }
    const body = JSON.parse(init.body);
    const model = url.split('/models/')[1].split(':')[0];
    calls.push({ model, body });
    if (opts.status && opts.status !== 200) {
      return { ok: false, status: opts.status, json: async () => ({}) };
    }
    const prompt: string = body.contents[0].parts[0].text;
    if (prompt.startsWith('Translate the text values')) {
      const j = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
      const tr = (v: any): any => (Array.isArray(v) ? v.map(tr) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tr(x)])) : typeof v === 'string' && v ? `TA ${v}` : v);
      return ok(answer(JSON.stringify(tr(j))));
    }
    if (prompt.startsWith('Translate each value')) {
      const j = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
      return ok(answer(JSON.stringify(Object.fromEntries(Object.entries(j).map(([k, v]) => [k, `TA ${v}`])))));
    }
    if (prompt.startsWith('User question') || prompt.startsWith('Earlier in this chat')) {
      return ok(answer(opts.askText || 'உள்ளூர் பதில்\n[EN]\nEnglish answer'));
    }
    if (/offices people visit/.test(prompt)) {
      return ok(answer('{"offices":[{"name":"Collectorate","phone":"08518-277305"}],"schemes":[{"name":"PM-JAY","level":"central","who":"Poor families","apply":"CSC"}],"overview":"IGNORED"}'));
    }
    if (/main government departments/.test(prompt)) {
      return ok(answer('{"departments":[{"name":"Health"}],"helplines":[{"name":"Police","number":"100"}]}'));
    }
    if (/state leaders/.test(prompt)) {
      return ok(answer('{"overview":"Kurnool district.","state":{"chiefMinister":{"name":"CM","party":"P"}}}'));
    }
    return ok(answer('{"hospitals":[{"name":"GGH Kurnool","address":"Kurnool","phone":"08518-1","emergency24x7":true,"specialities":["Cardiology"],"schemes":["PM-JAY"]}]}'));
  });
  return { f, calls };
};

beforeEach(() => clearJwksCache());
const env = (extra: any = {}) => ({ DB: makeD1(), FIREBASE_PROJECT_ID: 'outfit-vote-9edca', ...extra });
const call = async (e: any, method: string, path: string, opts: { body?: any; tok?: string; fetchImpl?: any } = {}) => {
  const headers: any = { authorization: `Bearer ${opts.tok || token()}` };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const req = new Request(`https://outfit-api.example.workers.dev${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const waits: Promise<any>[] = [];
  const res = await handleRequest(req, e, { waitUntil: (p: Promise<any>) => waits.push(p) }, { fetchImpl: opts.fetchImpl || makeFetch().f, now: NOW });
  await Promise.all(waits);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
};

describe('gemini speed + errors', () => {
  it('Flash-Lite first with thinking off; 3.x Flash low thinking; aliases none', () => {
    expect(gemini.GEMINI_MODELS[0]).toMatch(/flash-lite/);
    expect(gemini.thinkingFor('gemini-3.5-flash-lite')).toEqual({ thinkingBudget: 0 });
    expect(gemini.thinkingFor('gemini-3.6-flash')).toEqual({ thinkingLevel: 'low' });
    expect(gemini.thinkingFor('gemini-flash-latest')).toBeNull();
  });

  it('a slow model times out and the next one answers', async () => {
    let n = 0;
    const f = jest.fn((url: string, init: any) => {
      n++;
      if (n === 1) {
        return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
      }
      return Promise.resolve(ok(answer('hi')));
    });
    const t0 = Date.now();
    const r = await gemini.geminiGenerate({ GEMINI_API_KEY: 'k' }, { prompt: 'x', timeoutMs: 50 }, { fetchImpl: f });
    expect(r).toMatchObject({ ok: true, text: 'hi', model: gemini.GEMINI_MODELS[1] });
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(JSON.parse(f.mock.calls[0][1].body).generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it('retries a model once without thinking on 400; 402 = billing; all 429 = quota; thought parts dropped', async () => {
    let n = 0;
    const f400 = jest.fn(async () => (++n === 1 ? { ok: false, status: 400, json: async () => ({}) } : ok({ candidates: [{ content: { parts: [{ text: 'plan', thought: true }, { text: 'answer' }] } }] })));
    const r = await gemini.geminiGenerate({ GEMINI_API_KEY: 'k' }, { prompt: 'x' }, { fetchImpl: f400 });
    expect(r).toMatchObject({ ok: true, text: 'answer', model: gemini.GEMINI_MODELS[0] });
    expect(JSON.parse((f400.mock.calls[1] as any)[1].body).generationConfig.thinkingConfig).toBeUndefined();
    const f402 = jest.fn(async () => ({ ok: false, status: 402, json: async () => ({}) }));
    expect(await gemini.geminiGenerate({ GEMINI_API_KEY: 'k' }, { prompt: 'x' }, { fetchImpl: f402 })).toMatchObject({ ok: false, code: 'billing' });
    expect(f402).toHaveBeenCalledTimes(1);
    const f429 = jest.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    expect(await gemini.geminiGenerate({ GEMINI_API_KEY: 'k' }, { prompt: 'x' }, { fetchImpl: f429 })).toMatchObject({ ok: false, code: 'quota' });
    expect(f429).toHaveBeenCalledTimes(gemini.GEMINI_MODELS.length);
    expect(gemini.errorCode(['timeout', 'timeout'])).toBe('timeout');
  });
});

describe('translation helpers', () => {
  it('alignTranslation keeps the English shape, fixed fields and falls back to "" for missing text', () => {
    const en = { asOf: '2026-11', schemes: [{ name: 'PM-JAY', level: 'central', website: 'https://pmjay.gov.in' }, { name: 'Pension', level: 'state', website: '' }], helplines: [{ name: 'Police', number: '100' }] };
    const tr = { asOf: 'x', schemes: [{ name: 'பிஎம்-ஜேஏஒய்', level: 'மத்திய', website: 'https://evil' }], helplines: [{ name: 'காவல்', number: '౧౦౦' }], extra: 'drop' };
    expect(research.alignTranslation(en, tr)).toEqual({
      asOf: '2026-11',
      schemes: [
        { name: 'பிஎம்-ஜேஏஒய்', level: 'central', website: 'https://pmjay.gov.in' },
        { name: '', level: 'state', website: '' },
      ],
      helplines: [{ name: 'காவல்', number: '100' }],
    });
    expect(research.textCount(research.alignTranslation(en, tr))).toBe(2);
  });

  it('splits long arrays into chunks and merges them back in order', () => {
    const data = { overview: 'o', hospitals: Array.from({ length: 14 }, (_, i) => ({ name: `H${i}` })), rows: [] };
    const parts = research.splitForTranslation(data, 6);
    expect(parts).toHaveLength(4); // misc + 3 hospital chunks
    expect(parts[0]).toEqual({ overview: 'o', rows: [] });
    expect(research.mergeParts(parts)).toEqual(data);
  });

  it('translateData: one small call per chunk, in parallel; nothing to translate = no call', async () => {
    const { f, calls } = makeFetch();
    const data = { hospitals: Array.from({ length: 13 }, (_, i) => ({ name: `H${i}`, phone: '1', slug: `h${i}` })) };
    const r = await research.translateData({ GEMINI_API_KEY: 'k' }, 'hosp', data, 'ta', { fetchImpl: f });
    expect(r.ok).toBe(true);
    expect(r.calls).toBe(3);
    expect(calls).toHaveLength(3);
    expect(r.data.hospitals[12]).toEqual({ name: 'TA H12', phone: '1', slug: 'h12' });
    expect(calls[0].body.contents[0].parts[0].text).toMatch(/into simple, everyday Tamil/);
    const none = await research.translateData({ GEMINI_API_KEY: 'k' }, 'govt', { offices: [], schemes: [] }, 'ta', { fetchImpl: f });
    expect(none).toMatchObject({ ok: true, calls: 0 });
    expect(research.TR_LANGS).toEqual({ te: 'Telugu', hi: 'Hindi', ta: 'Tamil', kn: 'Kannada', ml: 'Malayalam', mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati', pa: 'Punjabi (Gurmukhi script)', or: 'Odia', ur: 'Urdu' });
  });
});

describe('research: Govt in 3 parallel parts + translation in the same run', () => {
  it('merges the parts (each only its own keys), saves the asked language with English numbers', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const db = new Db(e.DB);
    const { f, calls } = makeFetch();
    expect(research.researchPrompts('govt', '', STATES[0], 'kurnool')).toHaveLength(3);
    research.researchPrompts('govt', '', STATES[0], 'kurnool').forEach((p: string) => expect(p).toMatch(/Never invent phone numbers/));
    const r = await research.researchOne(db, e, { kind: 'govt', state: 'AP', district: 'kurnool' }, { fetchImpl: f, now: NOW, langs: ['ta'] });
    expect(r).toMatchObject({ ok: true, translated: ['ta'] });
    const grounded = calls.filter(c => c.body.tools);
    expect(grounded).toHaveLength(3);
    const row = e.DB.raw.prepare("SELECT data FROM civic_data WHERE kind='govt' AND state='AP' AND district='kurnool'").get();
    const data = JSON.parse(row.data);
    expect(data.overview).toBe('Kurnool district.'); // part 2's stray "overview" is not taken
    expect(data.leaders.chiefMinister.name).toBe('CM');
    expect(data.offices[0]).toMatchObject({ name: 'Collectorate', phone: '08518-277305' });
    expect(data.helplines).toEqual([{ name: 'Police', number: '100' }]);
    const ta = JSON.parse(e.DB.raw.prepare("SELECT data FROM civic_i18n WHERE kind='govt' AND state='AP' AND district='kurnool' AND lang='ta'").get().data);
    expect(ta.overview).toBe('TA Kurnool district.');
    expect(ta.leaders.chiefMinister.name).toBe('TA CM');
    expect(ta.offices[0].phone).toBe('08518-277305');
    expect(ta.helplines[0]).toEqual({ name: 'TA Police', number: '100' });
    expect(ta.schemes[0].level).toBe('central');
    const used = e.DB.raw.prepare("SELECT key, n FROM usage WHERE key IN ('civic_ai','civic_tr') ORDER BY key").all();
    expect(used.find((u: any) => u.key === 'civic_ai').n).toBe(3);
    // GET with ?lang=ta returns the Tamil copy; re-research drops old translations
    const g = await call(e, 'GET', '/v1/civic/data?kind=govt&state=AP&district=kurnool&lang=ta');
    expect(g.json.i18n.ta.overview).toBe('TA Kurnool district.');
    await research.researchOne(db, e, { kind: 'govt', state: 'AP', district: 'kurnool' }, { fetchImpl: f, now: NOW + 1 });
    expect(Number(e.DB.raw.prepare('SELECT COUNT(*) AS n FROM civic_i18n').get().n)).toBe(0);
  });

  it('on-demand research out of Gemini quota = paused (saved row kept), with the free-tier reason', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'hosp', state: 'TG', variant: 'govt', lang: 'ta' }, fetchImpl: makeFetch({ status: 402 }).f });
    expect(r.json).toMatchObject({ ok: false, status: 'paused', code: 'billing', error: research.RESEARCH_PAUSED });
    // nothing written as an error: the row is not marked failed, so it is retried after the reset
    expect(e.DB.raw.prepare("SELECT COUNT(*) AS n FROM civic_data WHERE status = 'error'").get().n).toBe(0);
    // next call: the key is cooling down, so no request at all
    const again = makeFetch();
    const r1 = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'hosp', state: 'TG', variant: 'govt' }, fetchImpl: again.f });
    expect(r1.json).toMatchObject({ ok: false, status: 'paused', code: 'quota' });
    expect(again.calls).toHaveLength(0);
    const e2 = env({ GEMINI_API_KEY: 'k' });
    const r2 = await call(e2, 'POST', '/v1/civic/research', { body: { kind: 'hosp', state: 'TG', variant: 'govt' }, fetchImpl: makeFetch({ status: 429 }).f });
    expect(r2.json).toMatchObject({ ok: false, code: 'quota' });
  });

  it('data route: aiConfigured = any provider (Workers AI alone counts), researchConfigured = free sources (Govt / Hospitals) or Gemini key', async () => {
    const onlyCf = env({ AI: { run: jest.fn() } });
    const g = await call(onlyCf, 'GET', '/v1/civic/data?kind=hosp&state=TG&variant=govt');
    // Hospitals / Govt are researched from free, keyless sources (no Gemini needed)
    expect(g.json).toMatchObject({ aiConfigured: true, researchConfigured: true, freeSources: true });
    const cmp = await call(onlyCf, 'GET', '/v1/civic/data?kind=gcmp&state=TG');
    expect(cmp.json).toMatchObject({ aiConfigured: true, researchConfigured: false, freeSources: false });
    // promises tracker: grounded Gemini only (free tier), no free-source fetch
    const prm = await call(onlyCf, 'GET', '/v1/civic/data?kind=gprm&state=TG');
    expect(prm.json).toMatchObject({ aiConfigured: true, researchConfigured: false, freeSources: false, data: null });
    // free sources unreachable (this fake answers only Gemini) and no Gemini key: ai_off as before
    const r = await call(onlyCf, 'POST', '/v1/civic/research', { body: { kind: 'hosp', state: 'TG', variant: 'govt' } });
    expect(r.json).toMatchObject({ ok: false, status: 'ai_off', code: 'config' });
    const withKey = await call(env({ GEMINI_API_KEY: 'k' }), 'GET', '/v1/civic/data?kind=hosp&state=TG&variant=govt');
    expect(withKey.json).toMatchObject({ aiConfigured: true, researchConfigured: true });
  });

  it('prefill: bundled-city districts come after missing states, before stale rows; file is up to date', () => {
    const t = research.pickTargets([], NOW, 5000);
    const firstDistrict = t.findIndex((x: any) => x.district);
    // 36 states x (govt + 2 hosp + gcmp + gprm) + the centre's gcmp + gprm
    expect(firstDistrict).toBe(36 * 5 + 2);
    expect(t.slice(firstDistrict, firstDistrict + 3)).toEqual([
      { kind: 'govt', state: 'AP', district: SEED_DISTRICTS.AP[0], variant: '' },
      { kind: 'hosp', state: 'AP', district: SEED_DISTRICTS.AP[0], variant: 'govt' },
      { kind: 'hosp', state: 'AP', district: SEED_DISTRICTS.AP[0], variant: 'private' },
    ]);
    const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    const want: Record<string, string[]> = {};
    INDIAN_CITIES.forEach(c => {
      const n = c.state.toLowerCase();
      const st = INDIA_STATES.find(x => x.name.toLowerCase() === n) || INDIA_STATES.find(x => x.name.toLowerCase().startsWith(n));
      if (!st) return;
      want[st.code] = want[st.code] || [];
      const d = slug(cityDistrict(c));
      if (!want[st.code].includes(d)) want[st.code].push(d);
    });
    expect(SEED_DISTRICTS).toEqual(want); // run: node scripts/gen-civic-districts.js
  });
});

describe('Ask AI (Worker)', () => {
  const seed = async (e: any) => {
    const db = new Db(e.DB);
    await research.researchOne(db, e, { kind: 'govt', state: 'AP', district: 'kurnool' }, { fetchImpl: makeFetch().f, now: NOW });
    await research.researchOne(db, e, { kind: 'hosp', state: 'AP', district: 'kurnool', variant: 'govt' }, { fetchImpl: makeFetch().f, now: NOW });
  };

  it('pure helpers: bilingual split + safety line', () => {
    expect(ask.splitBilingual('தமிழ்\n[EN]\nEnglish')).toEqual({ local: 'தமிழ்', en: 'English' });
    expect(ask.splitBilingual('Only one')).toEqual({ local: 'Only one', en: '' });
    expect(ask.withSafety('x', 'laws', 'ta')).toBe(`x\n\n${SAFETY.laws.ta}`);
    expect(ask.withSafety(`x\n\n${SAFETY.hosp.en}`, 'hosp', 'en')).toBe(`x\n\n${SAFETY.hosp.en}`);
    const sys = ask.askSystem('laws', 'ta', '[BNS 318] Cheating');
    expect(sys).toMatch(/Use ONLY the LAW SECTIONS/);
    expect(sys).toMatch(/Reply first in Tamil/);
    expect(sys).toMatch(/\[EN\]/);
  });

  it('laws: needs the app context; answers in the language + English with the not-legal-advice line', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const { f, calls } = makeFetch();
    expect((await call(e, 'POST', '/v1/civic/ask', { body: { topic: 'laws', lang: 'ta', question: 'cheating?' }, fetchImpl: f })).status).toBe(400);
    const r = await call(e, 'POST', '/v1/civic/ask', { body: { topic: 'laws', lang: 'ta', question: 'cheating?', context: '[BNS 318] Cheating' }, fetchImpl: f });
    expect(r.status).toBe(200);
    expect(r.json.answer).toBe(`உள்ளூர் பதில்\n\n${SAFETY.laws.ta}`);
    expect(r.json.en).toBe(`English answer\n\n${SAFETY.laws.en}`);
    expect(calls[0].body.tools).toBeUndefined(); // no grounding: the facts are given
    expect(calls[0].body.systemInstruction.parts[0].text).toMatch(/\[BNS 318\] Cheating/);
  });

  it('govt explain: from the stored row only, cached per row + focus + language', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    await seed(e);
    expect((await call(e, 'POST', '/v1/civic/ask', { body: { topic: 'govt', lang: 'en', state: 'AP', district: 'guntur', focus: 'schemes' } })).status).toBe(404);
    const { f, calls } = makeFetch({ askText: 'PM-JAY gives free treatment.' });
    const r1 = await call(e, 'POST', '/v1/civic/ask', { body: { topic: 'govt', lang: 'en', state: 'AP', district: 'Kurnool', focus: 'schemes' }, fetchImpl: f });
    expect(r1.json).toMatchObject({ answer: `PM-JAY gives free treatment.\n\n${SAFETY.govt.en}`, en: '', cached: false });
    expect(calls[0].body.systemInstruction.parts[0].text).toMatch(/"schemes":\[\{"name":"PM-JAY"/);
    expect(calls[0].body.systemInstruction.parts[0].text).not.toMatch(/Collectorate/); // only the asked part
    const r2 = await call(e, 'POST', '/v1/civic/ask', { body: { topic: 'govt', lang: 'en', state: 'AP', district: 'kurnool', focus: 'schemes' }, fetchImpl: f });
    expect(r2.json.cached).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('hospital AI: answers from the stored list with the 108 / 112 line; caps and free-tier errors', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    await seed(e);
    const { f, calls } = makeFetch({ askText: 'GGH Kurnool has cardiology.' });
    const body = { topic: 'hosp', lang: 'en', state: 'AP', district: 'kurnool', variants: ['govt', 'private'], question: 'heart hospital?' };
    const r = await call(e, 'POST', '/v1/civic/ask', { body, fetchImpl: f });
    expect(r.json.answer).toBe(`GGH Kurnool has cardiology.\n\n${SAFETY.hosp.en}`);
    expect(calls[0].body.systemInstruction.parts[0].text).toMatch(/1\. GGH Kurnool; address: Kurnool; phone: 08518-1/);
    expect(calls[0].body.systemInstruction.parts[0].text).toMatch(/Never diagnose/);
    expect((await call(e, 'POST', '/v1/civic/ask', { body, fetchImpl: makeFetch({ status: 429 }).f })).json).toEqual({ error: 'ai_busy' });
    e.DB.raw.exec('DELETE FROM ai_cooldown'); // the 429 cooled every model; start the 402 case fresh
    const q = await call(e, 'POST', '/v1/civic/ask', { body, fetchImpl: makeFetch({ status: 402 }).f });
    expect(q).toEqual({ status: 503, json: { error: 'ai_quota' } });
    e.DB.raw.prepare('INSERT OR REPLACE INTO usage (day, key, n) VALUES (?, ?, ?)').run('2026-11-18', 'civic_ask:user1', ask.MAX_ASK_PER_USER_DAY);
    expect((await call(e, 'POST', '/v1/civic/ask', { body, fetchImpl: f })).json).toEqual({ error: 'daily AI limit reached' });
    const off: any = env({ GEMINI_API_KEY: 'k' });
    await seed(off);
    delete off.GEMINI_API_KEY;
    expect((await call(off, 'POST', '/v1/civic/ask', { body })).json).toEqual({ error: 'ai_off' });
  });
});

describe('cached AI translation of app text', () => {
  it('translates only missing strings, caches by English text for everyone, validates input', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const { f, calls } = makeFetch();
    const r1 = await call(e, 'POST', '/v1/civic/translate', { body: { ns: 'labels', lang: 'ta', items: { govtTitle: 'Govt', ask: 'Ask' } }, fetchImpl: f });
    expect(r1.json.items).toEqual({ govtTitle: 'TA Govt', ask: 'TA Ask' });
    expect(calls).toHaveLength(1);
    // another user, same English text: from the cache, no call
    const r2 = await call(e, 'POST', '/v1/civic/translate', { body: { ns: 'labels', lang: 'ta', items: { other: 'Ask' } }, tok: token({ sub: 'user2' }), fetchImpl: f });
    expect(r2.json.items).toEqual({ other: 'TA Ask' });
    expect(calls).toHaveLength(1);
    expect((await call(e, 'POST', '/v1/civic/translate', { body: { ns: 'x', lang: 'ta', items: { a: 'b' } } })).status).toBe(400);
    expect((await call(e, 'POST', '/v1/civic/translate', { body: { ns: 'labels', lang: 'en', items: { a: 'b' } } })).status).toBe(400);
    expect((await call(e, 'POST', '/v1/civic/translate', { body: { ns: 'labels', lang: 'ta', items: { 'bad key!': 'b' } } })).status).toBe(400);
    expect(Object.keys(ask.cleanTrItems(Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, 'x'])))).length).toBe(ask.MAX_TR_ITEMS);
  });
});

describe('app: languages, cache, law context, messages', () => {
  it('12 app languages with codes matching the Worker; static labels fall back to English', () => {
    expect(APP_LANGUAGES).toHaveLength(12);
    expect(Object.values(APP_LANGUAGE_CODE).filter(c => c !== 'en').sort()).toEqual(Object.keys(research.TR_LANGS).sort());
    APP_LANGUAGES.forEach(l => expect(APP_LANGUAGE_NATIVE[l].trim()).not.toBe(''));
    expect(trCode('English')).toBeNull();
    expect(trCode('Tamil')).toBe('ta');
    expect(langCode('Urdu')).toBe('ur');
    expect(staticLanguage('Kannada')).toBe('English');
    expect(photoText('blur', 'Kannada')).toBe('Blur');
    expect(photoText('blur', 'Telugu')).toBe(CIVIC_LABELS && require('../src/i18n/photoEditLabels').PHOTO_EDIT_LABELS.Telugu.blur);
    expect(civicText('Tamil', 'govtTitle')).toBe(CIVIC_LABELS.English.govtTitle);
    setAiLabels('Tamil', { govtTitle: 'அரசு' });
    expect(civicText('Tamil', 'govtTitle')).toBe('அரசு');
    setAiLabels('Telugu', { govtTitle: 'ignored' });
    expect(civicText('Telugu', 'govtTitle')).toBe(CIVIC_LABELS.Telugu.govtTitle);
  });

  it('safety lines are the same in the app and the Worker, for all 12 languages', () => {
    expect(CIVIC_SAFETY).toEqual(SAFETY);
    (['laws', 'hosp', 'govt'] as const).forEach(t => expect(Object.keys(CIVIC_SAFETY[t]).sort()).toEqual(Object.values(APP_LANGUAGE_CODE).sort()));
    expect(withCivicSafety('a', 'hosp', 'ta')).toBe(`a\n\n${SAFETY.hosp.ta}`);
    Object.values(CIVIC_SAFETY.hosp).forEach(v => expect(v).toMatch(/108.*112/));
  });

  it('instant cache: key per place + language, newest kept, oldest dropped', async () => {
    expect(civicCacheKey('govt', 'TG', ' Hyderabad ', '', 'te')).toBe('outfit.civicCache.v1:govt|TG|hyderabad||te');
    expect(touchIndex(['a', 'b', 'c'], 'b', 3)).toEqual({ index: ['b', 'a', 'c'], dropped: [] });
    expect(touchIndex(['a', 'b', 'c'], 'd', 3)).toEqual({ index: ['d', 'a', 'b'], dropped: ['c'] });
    const k = civicCacheKey('hosp', 'AP', 'kurnool', 'govt', null);
    expect(await readCivicCache(k)).toBeNull();
    await writeCivicCache(k, { data: { hospitals: [] } }, 5);
    expect(await readCivicCache(k)).toEqual({ savedAt: 5, res: { data: { hospitals: [] } } });
    expect(JSON.parse((await AsyncStorage.getItem(CIVIC_CACHE_INDEX)) as string)[0]).toBe(k);
    expect(POLL_MS).toBeLessThanOrEqual(3000);
    expect(POLL_MS * MAX_POLLS).toBeLessThanOrEqual(90000);
  });

  it('law context: section / IPC numbers and words pick the right sections, within the size cap', () => {
    expect(questionWords('What is the punishment for cheating under BNS 318?')).toEqual(['punishment', 'cheating', 'bns', '318']);
    const cheat = lawSectionsFor('Someone did cheating with me online');
    expect(cheat.length).toBeGreaterThan(0);
    expect(cheat.some(s => s.act === 'BNS' && /^318/.test(s.section))).toBe(true);
    expect(lawSectionsFor('ipc 420').some(s => (s.oldRef || '').includes('420'))).toBe(true);
    const none = lawSectionsFor('qqqzzz');
    expect(none.length).toBeGreaterThan(0); // common offences as a fallback
    const { context, sections } = lawContextFor('murder theft cheating assault');
    expect(context.length).toBeLessThanOrEqual(LAW_CONTEXT_CHARS);
    expect(context).toContain(`[${sections[0].act} ${sections[0].section}]`);
  });

  it('clear messages: free-tier busy, credits used up, daily limit', () => {
    expect(aiErrorKey(null, 'quota')).toBe('aiBusy');
    expect(aiErrorKey(null, 'billing')).toBe('aiQuota');
    expect(aiErrorKey(new WorkerError(429, 'ai_busy'))).toBe('aiBusy');
    expect(aiErrorKey(new WorkerError(429, 'daily AI limit reached'))).toBe('aiLimit');
    expect(aiErrorKey(new WorkerError(503, 'ai_quota'))).toBe('aiQuota');
    expect(aiErrorKey(new Error('x'))).toBe('error');
    (['Telugu', 'Hindi'] as const).forEach(l => (['aiBusy', 'aiQuota', 'aiLimit', 'askLaws', 'explainSimply'] as const).forEach(k => expect(CIVIC_LABELS[l][k]).not.toBe(CIVIC_LABELS.English[k])));
  });

  it('phone translation store: only entries whose English text still matches', () => {
    const store: Record<string, [string, string]> = { a: ['Ask', 'கேள்'], b: ['Old', 'பழைய'] };
    expect(fromStore(store, { a: 'Ask', b: 'New', c: 'X' })).toEqual({ have: { a: 'கேள்' }, missing: ['b', 'c'] });
  });
});

describe('faster translation + progressive Govt (Worker)', () => {
  const waitFor = async (check: () => boolean) => {
    for (let i = 0; i < 400 && !check(); i++) await new Promise<void>(r => setTimeout(() => r(), 5));
    expect(check()).toBe(true);
  };

  it('Govt first visit: each finished part is saved at once (partial) and served; the full row replaces it', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const db = new Db(e.DB);
    const { f } = makeFetch();
    let release: () => void = () => undefined;
    const gate = new Promise<void>(r => (release = r));
    const slow = jest.fn(async (url: string, init?: any) => {
      if (init && /main government departments/.test(init.body)) await gate;
      return f(url, init);
    });
    const t = { kind: 'govt', state: 'AP', district: 'kurnool', variant: '' };
    const run = research.researchOne(db, e, t, { fetchImpl: slow, now: NOW, langs: ['ta'] });
    const row = () => e.DB.raw.prepare("SELECT status, data FROM civic_data WHERE kind='govt' AND state='AP' AND district='kurnool'").get();
    // 2 of 3 parts done: saved as partial with what they found (+ its Tamil copy)
    await waitFor(() => {
      const r = row();
      return !!(r && r.status === 'partial' && JSON.parse(r.data).offices.length && JSON.parse(r.data).overview);
    });
    const g = await call(e, 'GET', '/v1/civic/data?kind=govt&state=AP&district=kurnool&lang=ta', { fetchImpl: slow });
    expect(g.json.status).toBe('partial');
    expect(g.json.data.overview).toBe('Kurnool district.');
    expect(g.json.data.departments).toEqual([]);
    expect(g.json.i18n.ta.overview).toBe('TA Kurnool district.');
    release();
    expect(await run).toMatchObject({ ok: true, translated: ['ta'] });
    expect(row().status).toBe('ok');
    expect(JSON.parse(row().data).departments[0].name).toBe('Health');
    // a refresh of a place with data is not progressive (the saved row stays until the new one is done)
    await research.researchOne(db, e, t, { fetchImpl: makeFetch().f, now: NOW + 1 });
    expect(row().status).toBe('ok');
  });

  it('a partial row left behind is researched again (on demand + cron), not treated as done', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    e.DB.raw
      .prepare("INSERT INTO civic_data (kind, state, district, variant, data, status, updated_at) VALUES ('govt','AP','kurnool','',?,'partial',?)")
      .run(JSON.stringify(research.cleanGovt({ overview: 'Half.' })), NOW - research.CIVIC_RETRY_MS - 1);
    expect(research.pickTargets(e.DB.raw.prepare('SELECT * FROM civic_data').all(), NOW, 5000, {}).some((x: any) => x.district === 'kurnool')).toBe(true);
    const r = await call(e, 'POST', '/v1/civic/research', { body: { kind: 'govt', state: 'AP', district: 'kurnool' } });
    expect(r.json).toMatchObject({ ok: true, did: 'research' });
    expect(e.DB.raw.prepare("SELECT status FROM civic_data WHERE kind='govt' AND district='kurnool'").get().status).toBe('ok');
  });

  it('asked language missing: English returned at once (status translating), copy saved in the background', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const db = new Db(e.DB);
    await research.researchOne(db, e, { kind: 'hosp', state: 'AP', district: 'kurnool', variant: 'govt' }, { fetchImpl: makeFetch().f, now: NOW });
    const handlers: Promise<any>[] = [];
    const quick = await research.researchNow(db, e, { kind: 'hosp', state: 'AP', district: 'kurnool', variant: 'govt' }, 'ml', {
      fetchImpl: makeFetch().f,
      now: NOW,
      waitUntil: (p: Promise<any>) => handlers.push(p),
    });
    expect(quick).toMatchObject({ ok: true, status: 'translating', did: 'translate', lang: 'ml' });
    await Promise.all(handlers);
    const g0 = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=kurnool&variant=govt&lang=ml');
    expect(g0.json.status).toBe('ok');
    expect(g0.json.i18n.ml.hospitals[0].name).toBe('TA GGH Kurnool');
    // GET alone starts the missing language (no POST needed)
    const g1 = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=kurnool&variant=govt&lang=kn');
    expect(g1.json).toMatchObject({ status: 'translating' });
    expect(g1.json.data.hospitals[0].name).toBe('GGH Kurnool');
    expect(g1.json.i18n.kn).toBeNull();
    const g2 = await call(e, 'GET', '/v1/civic/data?kind=hosp&state=AP&district=kurnool&variant=govt&lang=kn');
    expect(g2.json.status).toBe('ok');
    expect(g2.json.i18n.kn.hospitals[0].name).toBe('TA GGH Kurnool');
  });

  it('a failing translation is tried at most CIVIC_TR_ROW_TRIES times a day per row + language', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const db = new Db(e.DB);
    const t = { kind: 'hosp', state: 'AP', district: 'kurnool', variant: 'govt' };
    await research.researchOne(db, e, t, { fetchImpl: makeFetch().f, now: NOW });
    const bad = makeFetch({ status: 500 });
    for (let i = 0; i < research.CIVIC_TR_ROW_TRIES; i++) {
      expect(await research.startTranslate(db, e, t, 'ta', { fetchImpl: bad.f, now: NOW + i })).toMatchObject({ ok: false, did: 'translate' });
    }
    const n = bad.calls.length;
    expect(n).toBeGreaterThan(0);
    const r = await research.startTranslate(db, e, t, 'ta', { fetchImpl: bad.f, now: NOW + 10 });
    expect(r.did).toBeUndefined();
    expect(r.code).toBe('cap');
    expect(bad.calls.length).toBe(n);
    // the daily translation cap still holds
    e.DB.raw.prepare("INSERT INTO usage (day, key, n) VALUES ('2026-11-18', 'civic_tr', 300) ON CONFLICT (day, key) DO UPDATE SET n = 300").run();
    expect(await research.startTranslate(db, e, t, 'te', { fetchImpl: makeFetch().f, now: NOW })).toMatchObject({ ok: false, code: 'cap', error: 'daily translation cap reached' });
  });

  it('cron translates up to CIVIC_TR_PER_RUN missing te / hi copies per run; seed districts before others', async () => {
    const e = env({ GEMINI_API_KEY: 'k' });
    const db = new Db(e.DB);
    const old = NOW - 3 * 24 * 3600 * 1000;
    for (const [state, district, variant] of [
      ['AP', 'kurnool', 'govt'],
      ['AP', 'kurnool', 'private'],
      ['TG', '', 'govt'],
      ['TG', 'someplace', 'govt'],
    ]) {
      await research.researchOne(db, e, { kind: 'hosp', state, district, variant }, { fetchImpl: makeFetch().f, now: old });
    }
    const jobs = await research.translationBacklog(db, NOW);
    expect(jobs).toHaveLength(8);
    // 'someplace' is not a bundled-city district: last
    expect(jobs.slice(-2).map((j: any) => j.t.district)).toEqual(['someplace', 'someplace']);
    expect(jobs.slice(-2).map((j: any) => j.lang)).toEqual(['te', 'hi']);
    const r = await research.runCivicResearch(db, e, { fetchImpl: makeFetch().f, now: NOW, perRun: 0 });
    expect(r.ran).toBe(research.CIVIC_TR_PER_RUN);
    expect(Number(e.DB.raw.prepare('SELECT COUNT(*) AS n FROM civic_i18n').get().n)).toBe(5);
    const r2 = await research.runCivicResearch(db, e, { fetchImpl: makeFetch().f, now: NOW, perRun: 0 });
    expect(r2.ran).toBe(3);
    expect(await research.translationBacklog(db, NOW)).toHaveLength(0);
  });
});
