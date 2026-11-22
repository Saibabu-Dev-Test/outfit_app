// Civic AI research (Govt + Hospitals + previous vs present government comparison). Google-Search-grounded Gemini answers are cleaned to a
// fixed JSON shape and stored as ONE row per (kind, state, district, variant) in civic_data, with
// the grounding source URLs (shown in the app). Translations (11 Indian languages, TR_LANGS) are
// stored one row per language in civic_i18n (migration 0006; old Telugu / Hindi copies in
// civic_data.i18n are still read). Neutral facts only: no AI ratings, no opinions.
// Speed: a Govt place is researched as 3 smaller grounded calls in parallel, and each part is
// translated into the asked language as soon as it arrives (research + translation together),
// translation itself split into small parallel chunks. Fast Flash-Lite models, a per-call timeout.
// Progressive Govt: on a place's first research each finished part is saved at once (status
// 'partial', with its translations) so the app shows it while the other parts are still running.
// Translation never blocks a request: a missing language is started in the background
// (startTranslate + ctx.waitUntil) and the English copy is served meanwhile (status 'translating').
// Run by the civic cron (CIVIC_CRON in index.js) AND on demand (POST /v1/civic/research) with hard
// caps so the free Gemini tier and D1 stay safe (civicCaps: defaults below, each can be overridden
// by a Worker var of the same name, e.g. CIVIC_DAILY_MAX = "200" in wrangler.toml [vars]):
//   CIVIC_PER_RUN places per cron run, CIVIC_TR_PER_RUN missing te / hi copies translated per cron
//   run (seed districts first), CIVIC_DAILY_MAX grounded research calls per UTC day (usage
//   key 'civic_ai'), CIVIC_TR_DAILY_MAX translation calls per day ('civic_tr'), CIVIC_ASK_DAILY_MAX
//   "Ask AI" / "Explain simply" calls per day ('civic_ask', routes.js).
// Order: districts users asked for (status 'pending') -> state rows never researched -> the
// districts of the app's bundled cities (districts.js, prefill) -> rows saved with an older data
// shape (CIVIC_SCHEMA, migration 0005) -> stalest rows older than CIVIC_REFRESH_MS -> rows in
// error older than CIVIC_RETRY_MS.
// Kind 'gcmp' = neutral "previous vs present government" comparison per state + centre ('IN'):
// schemes, budgets, major projects, schemes started / stopped, side by side; every point needs its
// own https source URL + date or it is dropped; evaluative words are dropped; no verdict field exists.
// AI fallback (llm.js): grounded research uses Gemini only (every key in turn). When every key is
// used up the stored data is kept as it is and the run reports status 'paused' (RESEARCH_PAUSED)
// instead of asking an ungrounded model, which would invent facts. Translation of stored data goes
// through the whole chain (Gemini keys -> Groq -> Workers AI), so it keeps working.
// FREE SOURCES FIRST (civic/free, migration 0008): Govt and Hospitals are served from keyless public
// sources (Wikidata + Wikipedia, OpenStreetMap Nominatim, official .gov.in info) with NO AI call:
// on demand the free fetch answers status 'ready' (never 'paused' for AI limits), saved in
// civic_data with origin 'free'. The Overpass upgrade of a hospital list runs after the response
// (ctx.waitUntil) and in a gentle cron refresh (runFreeRefresh), never on the request path.
// Grounded Gemini research stays as the fallback when the free sources fail; Gemini / Groq are
// otherwise only optional extras (translation, Explain simply). OSM rows never translate proper
// names or addresses (FREE_HOSP_FIXED).
import { CENTRE, STATES, placeByCode } from './states.js';
import { fetchGovtFree } from './free/govt.js';
import { fetchHospFree, fetchHospOverpass, titleCase } from './free/hosp.js';
import { sleep } from './free/http.js';
import { geminiReady, isGeminiConfigured, parseJsonLoose } from './gemini.js';
import { aiGenerate, isAiConfigured } from './llm.js';
import { addUsage, usageFor } from '../db.js';
import { utcDay } from '../days.js';
import { SEED_DISTRICTS } from './districts.js';

// Free-tier budget (Gemini free tier, Nov 2026: Flash-Lite about 10 requests / minute and 500 / day
// per model and project; grounded search is the scarce part). Calls, not places: a Govt place is 3
// grounded calls, a hospital list or comparison 1.
export const CIVIC_PER_RUN = 3; // places per cron run (run one after another, ~5 calls a burst)
export const CIVIC_DAILY_MAX = 150; // grounded research calls per UTC day
export const CIVIC_TR_DAILY_MAX = 300; // translation calls per UTC day
export const CIVIC_ASK_DAILY_MAX = 300; // Ask AI / Explain simply calls per UTC day (all users)
export const CIVIC_TR_PER_RUN = 5; // missing te / hi copies translated per cron run (one after another)
export const CIVIC_TR_ROW_TRIES = 3; // translation attempts per row + language per UTC day (no retry loops)
export const CIVIC_REFRESH_MS = 7 * 24 * 3600 * 1000;
export const CIVIC_RETRY_MS = 20 * 60 * 1000;
export const CIVIC_LOCK_MS = 3 * 60 * 1000;
export const CIVIC_MAX_PENDING = 200;
export const RESEARCH_PAUSED = 'research paused, showing saved info';
// Kinds served from the free, keyless sources first (no AI needed)
export const FREE_KINDS = new Set(['govt', 'hosp']);
export const CIVIC_FREE_DAILY_MAX = 800; // free-source place fetches per UTC day (usage key 'civic_free')
export const CIVIC_FREE_REFRESH_MS = 7 * 24 * 3600 * 1000; // free rows / Overpass upgrade re-fetched weekly (cron)
export const CIVIC_FREE_GAP_MS = 1100; // between Nominatim requests (usage policy: max 1 / second)
export const FREE_GOV_CACHE_MS = 3 * 24 * 3600 * 1000; // cached Wikipedia governors list
export const FREE_REQ_TIMEOUT_MS = 3500; // per free request on the request path (first load target < 5 s)
// Grounded research failed because every Gemini key is out of free quota (not a data problem)
const isExhausted = code => code === 'quota' || code === 'billing';
// Languages the cron translates ahead of time (others are translated the first time someone asks)
export const CIVIC_CRON_LANGS = ['te', 'hi'];
// Translation chunk: arrays longer than this are split, each chunk one small parallel call
export const TR_CHUNK = 6;
export const KINDS = { govt: [''], hosp: ['govt', 'private'], gcmp: [''] };
// Data-shape version per kind (civic_data.schema_v). hosp 2 = timings, specialFor, doctors,
// facilities, per-hospital sources. Older rows are re-researched by the cron (data kept until then).
export const CIVIC_SCHEMA = { govt: 1, hosp: 2, gcmp: 1 };
// App language codes (src/i18n/appLanguage.ts) -> name used in prompts. English is the stored data.
export const TR_LANGS = {
  te: 'Telugu',
  hi: 'Hindi',
  ta: 'Tamil',
  kn: 'Kannada',
  ml: 'Malayalam',
  mr: 'Marathi',
  bn: 'Bengali',
  gu: 'Gujarati',
  pa: 'Punjabi (Gurmukhi script)',
  or: 'Odia',
  ur: 'Urdu',
};

// Caps with optional Worker var overrides (whole numbers only; anything else keeps the default)
const capVar = (env, name, dflt, max) => {
  const n = Math.floor(Number(env && env[name]));
  return Number.isFinite(n) && n >= 0 && String(env[name]).trim() !== '' ? Math.min(n, max) : dflt;
};
export const civicCaps = env => ({
  perRun: capVar(env, 'CIVIC_PER_RUN', CIVIC_PER_RUN, 8),
  dailyMax: capVar(env, 'CIVIC_DAILY_MAX', CIVIC_DAILY_MAX, 1500),
  trDailyMax: capVar(env, 'CIVIC_TR_DAILY_MAX', CIVIC_TR_DAILY_MAX, 3000),
  askDailyMax: capVar(env, 'CIVIC_ASK_DAILY_MAX', CIVIC_ASK_DAILY_MAX, 3000),
  trPerRun: capVar(env, 'CIVIC_TR_PER_RUN', CIVIC_TR_PER_RUN, 20),
  freeDailyMax: capVar(env, 'CIVIC_FREE_DAILY_MAX', CIVIC_FREE_DAILY_MAX, 5000),
  freeGapMs: capVar(env, 'CIVIC_FREE_GAP_MS', CIVIC_FREE_GAP_MS, 5000),
});

const s = (v, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : typeof v === 'number' ? String(v) : '');
const url = v => (typeof v === 'string' && /^https:\/\/[^\s"'<>]{3,300}$/.test(v.trim()) ? v.trim() : '');
// A phone with letters in it is not trusted (dropped, never repaired into a different number)
const phone = v => {
  const p = s(v, 60);
  return /[a-z]/i.test(p) ? '' : p.replace(/[^0-9+\-/ ,]/g, '').trim();
};
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
export const slugify = v =>
  String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const num = (v, lim) => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) && Math.abs(n) <= lim ? n : null;
};
// Source of one section / item from the free sources: { name, url (https), date }
const srcItem = v => {
  const o = obj(v);
  const u = url(o.url);
  const name = s(o.name, 80);
  return name || u ? { name, url: u, date: s(o.date, 10) } : null;
};
// Per-section sources of a free Govt row ({ overview, leaders, district, election, schemes, place })
export const cleanSrc = v => {
  const out = {};
  Object.entries(obj(v))
    .slice(0, 12)
    .forEach(([k, x]) => {
      if (k === 'place') {
        out.place = s(x, 140);
      } else if (/^[a-z]{2,20}$/i.test(k)) {
        const it = srcItem(x);
        if (it) {
          out[k] = it;
        }
      }
    });
  return out;
};

const person = p => ({ name: s(obj(p).name, 100), party: s(obj(p).party, 80), role: s(obj(p).role || obj(p).portfolio, 200) });
const rep = p => ({ name: s(obj(p).name, 100), constituency: s(obj(p).constituency, 100), party: s(obj(p).party, 80) });

export function cleanGovt(raw) {
  const o = obj(raw);
  // AI answers carry `state`; free-source data (origin 'free') is already in the stored `leaders` shape
  const st = obj(o.state || o.leaders);
  const di = obj(o.district);
  const el = obj(o.election);
  return {
    asOf: s(o.asOf, 40),
    overview: s(o.overview, 1000),
    leaders: {
      governor: s(st.governor, 100),
      chiefMinister: person(st.chiefMinister),
      deputyCMs: arr(st.deputyCMs, 6).map(person).filter(p => p.name),
      ministers: arr(st.ministers, 40).map(person).filter(p => p.name),
    },
    district: {
      headquarters: s(di.headquarters, 100),
      collector: s(di.collector, 100),
      sp: s(di.sp, 100),
      policeCommissioner: s(di.policeCommissioner, 100),
      mps: arr(di.mps, 10).map(rep).filter(p => p.name),
      mlas: arr(di.mlas, 25).map(rep).filter(p => p.name),
    },
    offices: arr(o.offices, 25)
      .map(d => ({ name: s(obj(d).name, 140), what: s(obj(d).what, 300), address: s(obj(d).address, 300), phone: phone(obj(d).phone), website: url(obj(d).website) }))
      .filter(d => d.name),
    schemes: arr(o.schemes, 30)
      .map(d => ({
        name: s(obj(d).name, 140),
        level: /central/i.test(s(obj(d).level, 20)) ? 'central' : 'state',
        who: s(obj(d).who, 400),
        benefit: s(obj(d).benefit, 400),
        apply: s(obj(d).apply, 400),
        website: url(obj(d).website),
      }))
      .filter(d => d.name),
    grievance: arr(o.grievance, 15)
      .map(d => ({ name: s(obj(d).name, 140), how: s(obj(d).how, 400), phone: phone(obj(d).phone), website: url(obj(d).website) }))
      .filter(d => d.name),
    election: {
      lastAssembly: s(el.lastAssembly, 300),
      lastLokSabha: s(el.lastLokSabha, 300),
      next: s(el.next, 300),
      voterHelpline: phone(el.voterHelpline),
      ceoWebsite: url(el.ceoWebsite),
    },
    departments: arr(o.departments, 20)
      .map(d => ({ name: s(obj(d).name, 120), what: s(obj(d).what, 300), website: url(obj(d).website), helpline: phone(obj(d).helpline) }))
      .filter(d => d.name),
    services: arr(o.services, 15)
      .map(d => ({ name: s(obj(d).name, 120), how: s(obj(d).how, 300), website: url(obj(d).website) }))
      .filter(d => d.name),
    helplines: arr(o.helplines, 20)
      .map(d => ({ name: s(obj(d).name, 100), number: phone(obj(d).number) }))
      .filter(d => d.name && d.number),
    ...(o.origin === 'free' ? { origin: 'free', src: cleanSrc(o.src) } : {}),
  };
}

// Google Maps search link from the hospital's own name + address (a search, not a guessed place)
export const mapLink = (name, address, where) => {
  const q = [name, address, where].filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q.slice(0, 250))}` : '';
};

export function cleanHosp(raw, where = '') {
  const o = obj(raw);
  // origin 'free' = OpenStreetMap rows: own map link, coordinates, OSM page, per-item source
  const free = o.origin === 'free';
  const seen = new Set();
  const hospitals = arr(o.hospitals, free ? 60 : 25)
    .map(h => {
      const x = obj(h);
      const name = s(x.name, 140);
      const address = s(x.address, 300);
      let slug = slugify(x.slug || x.name);
      if (free && slug && seen.has(slug)) {
        // two OSM places with one name (branches): keep both, told apart by the OSM id
        slug = `${slug.slice(0, 30)}-${String(x.id || '').replace(/\D/g, '').slice(-8)}`.replace(/-$/, '');
      }
      const item = {
        name,
        slug,
        type: s(x.type, 60),
        district: s(x.district, 60),
        address,
        phone: phone(x.phone),
        emergency24x7: x.emergency24x7 === true,
        specialities: arr(x.specialities, 15).map(v => s(v, 60)).filter(Boolean),
        schemes: arr(x.schemes, 8).map(v => s(v, 80)).filter(Boolean),
        website: url(x.website),
        mapUrl: free && url(x.mapUrl) ? url(x.mapUrl) : name ? mapLink(name, address, where) : '',
        note: s(x.note, 300),
        // v2 fields: empty = no public source stated it (the app shows "Public info not available")
        timings: s(x.timings, 200),
        specialFor: arr(x.specialFor, 12).map(v => s(v, 80)).filter(Boolean),
        facilities: arr(x.facilities, 20).map(v => s(v, 80)).filter(Boolean),
        // Only doctors a public page lists, with that page as source; experience only as published
        doctors: arr(x.doctors, 15)
          .map(d => ({
            name: s(obj(d).name, 100),
            speciality: s(obj(d).speciality, 80),
            qualification: s(obj(d).qualification, 120),
            experience: /\d/.test(s(obj(d).experience, 40)) ? s(obj(d).experience, 40) : '',
            source: url(obj(d).source),
          }))
          .filter(d => d.name && d.source),
        sources: [...new Set(arr(x.sources, 5).map(url).filter(Boolean))],
        ...(free
          ? {
              ownership: ['govt', 'private'].includes(x.ownership) ? x.ownership : 'unknown',
              lat: num(x.lat, 90),
              lon: num(x.lon, 180),
              osmUrl: url(x.osmUrl),
              src: srcItem(x.src),
            }
          : {}),
      };
      // one pass: a slug counts as seen as soon as its item is kept
      return item.name && slug && !seen.has(slug) && seen.add(slug) ? item : null;
    })
    .filter(Boolean);
  return { asOf: s(o.asOf, 40), hospitals, ...(free ? { origin: 'free', src: srcItem(o.src) } : {}) };
}

// ── Previous vs present government (kind 'gcmp') ──
export const CMP_AREAS = ['schemes', 'budget', 'projects', 'started', 'stopped'];
const DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const date = v => {
  const d = s(v, 10);
  return DATE_RE.test(d) ? d : '';
};
// Evaluative / verdict words: a point using them is dropped (facts only, no opinion)
export const OPINION_RE =
  /\b(best|better|worse|worst|superior|inferior|excellent|outstanding|failed|failure|failures|corrupt|corruption|scam|praised|criticised|criticized|landmark|historic|visionary|betray(?:ed|al)?|mismanag\w*|incompetent|winner|loser)\b/i;
const cmpFact = v => {
  const o = obj(v);
  const text = s(o.text, 400);
  const source = url(o.source);
  const d = date(o.date);
  return text && source && d && !OPINION_RE.test(text) ? { text, source, date: d } : null;
};
const cmpGovt = v => {
  const o = obj(v);
  return { label: s(o.label, 140), head: s(o.head, 100), party: s(o.party, 160), from: date(o.from), to: date(o.to), source: url(o.source) };
};

export function cleanCompare(raw) {
  const o = obj(raw);
  const rows = arr(o.rows, 60)
    .map(r => {
      const x = obj(r);
      const area = s(x.area, 20).toLowerCase();
      return { area: CMP_AREAS.includes(area) ? area : '', topic: s(x.topic, 140), previous: cmpFact(x.previous), present: cmpFact(x.present) };
    })
    .filter(r => r.area && r.topic && !OPINION_RE.test(r.topic) && (r.previous || r.present));
  return { asOf: s(o.asOf, 40), previous: cmpGovt(o.previous), present: cmpGovt(o.present), rows };
}

const placeName = (state, district) =>
  state.type === 'centre' ? 'the Union Government of India (the Centre)' : `${district ? `${district.replace(/-/g, ' ')} district, ` : ''}${state.name}, India`;

const STATE_SCHEMES = {
  AP: 'Dr NTR Vaidya Seva (Aarogyasri AP)',
  TG: 'Aarogyasri (Telangana)',
};

export function researchPrompt(kind, variant, state, district) {
  const where = placeName(state, district);
  const today = new Date().toISOString().slice(0, 10);
  if (kind === 'gcmp') {
    const who = state.type === 'centre' ? 'the Union Government of India (Prime Minister and Union Cabinet)' : `the ${state.name} state government (Chief Minister and cabinet)`;
    return [
      `Today is ${today}. Using Google Search, build a NEUTRAL side-by-side factual comparison of the PREVIOUS and the PRESENT term of ${who}.`,
      'Previous = the government (term) immediately before the present one. If the same party / leader continued, compare the previous term with the current term.',
      'STRICT RULES: facts only. No opinion, no verdict, no "which is better / best", no praise or criticism, no adjectives like best, failed, historic, corrupt. Do not say who did better.',
      'Every point MUST have its own public source URL (prefer .gov.in / .nic.in, budget documents, PIB, official gazettes, state finance department, reputed news reports of official figures) and the date (YYYY-MM-DD, or YYYY-MM / YYYY) of that source or event. If you cannot give a source URL and a date for a point, leave that side null.',
      'Areas: "schemes" (major welfare schemes and their benefit amounts), "budget" (total budget size, key allocations e.g. health, education, agriculture, with year), "projects" (major infrastructure projects: name, cost, status), "started" (schemes / programmes started by that government), "stopped" (schemes stopped, merged or renamed by the government that followed, with the official reason only if officially stated).',
      'Put matching items on the same row (same topic) so they can be read side by side; an item with no counterpart has the other side null. Up to 40 rows.',
      'Reply with ONLY this JSON (no markdown):',
      '{"asOf":"YYYY-MM","previous":{"label":"e.g. 2019-2024 government","head":"CM / PM name","party":"party or alliance","from":"YYYY-MM","to":"YYYY-MM","source":"https://"},"present":{"label":"","head":"","party":"","from":"YYYY-MM","to":"","source":"https://"},',
      '"rows":[{"area":"schemes|budget|projects|started|stopped","topic":"short neutral topic, e.g. Old-age pension amount","previous":{"text":"fact","source":"https://","date":"YYYY-MM-DD"},"present":{"text":"fact","source":"https://","date":"YYYY-MM-DD"}}]}',
    ].join('\n');
  }
  if (kind === 'govt') {
    return [
      `Today is ${today}. Using Google Search, collect current, factual public information for ${where}.`,
      'Neutral facts only: no opinions, no praise or criticism, no ratings. Party names only as plain facts next to each elected person.',
      'Prefer official sources (.gov.in, .nic.in, ap.gov.in style state portals, district NIC sites, ECI). Use the CURRENT office holders as of today.',
      'If you are not sure of a value (a name, a phone number, a website), leave it empty "" instead of guessing. Never invent phone numbers.',
      district
        ? `Include the state leaders AND the ${district.replace(/-/g, ' ')} district: District Collector, Superintendent of Police (or Commissioner of Police if a commissionerate), the Lok Sabha MP(s) whose constituency covers the district, and ALL MLAs of assembly constituencies in the district.`
        : 'District fields may stay empty (state-level summary).',
      'Schemes: the major state AND central welfare schemes people here use (health, pensions, farmers, housing, education, women, food), with eligibility and how to apply.',
      'Grievance: CM helpline / state grievance portal (for example PGRS / Meeseva / Spandana-type portals as they exist in this state now), CPGRAMS (pgportal.gov.in), and district grievance day details if found.',
      'Reply with ONLY this JSON (no markdown):',
      '{"asOf":"YYYY-MM","overview":"3-4 neutral sentences about the place (district HQ, population, main languages)",',
      '"state":{"governor":"","chiefMinister":{"name":"","party":""},"deputyCMs":[{"name":"","party":"","role":"portfolios"}],"ministers":[{"name":"","party":"","role":"portfolios"}]},',
      '"district":{"headquarters":"","collector":"","sp":"","policeCommissioner":"","mps":[{"name":"","constituency":"","party":""}],"mlas":[{"name":"","constituency":"","party":""}]},',
      '"offices":[{"name":"e.g. Collectorate, SP office, DMHO, RTO, municipal corporation","what":"","address":"","phone":"","website":"https://"}],',
      '"schemes":[{"name":"","level":"state|central","who":"eligibility","benefit":"","apply":"how to apply (office / portal / app)","website":"https://"}],',
      '"grievance":[{"name":"","how":"","phone":"","website":"https://"}],',
      '"election":{"lastAssembly":"year + result in one neutral line","lastLokSabha":"year + one neutral line","next":"when the next elections are due","voterHelpline":"1950","ceoWebsite":"https://"},',
      '"departments":[{"name":"","what":"","website":"https://","helpline":""}],"services":[{"name":"","how":"","website":"https://"}],"helplines":[{"name":"","number":""}]}',
    ].join('\n');
  }
  const which = variant === 'govt' ? 'government (public) hospitals (GGH / district hospital / area hospitals / CHCs / medical colleges / ESI)' : 'private hospitals (multi-speciality and well-known ones)';
  const stateScheme = STATE_SCHEMES[state.code] ? `${STATE_SCHEMES[state.code]}, ` : 'the state government health scheme, ';
  return [
    `Today is ${today}. Using Google Search, list up to 20 ${which} in ${where}.`,
    'Facts only from public sources (official hospital sites, government empanelment lists, NHA / state scheme portals, district sites).',
    'If you are not sure of a value, leave it empty "" (phone especially: NEVER invent or guess a phone number). No medical advice, no ratings.',
    `schemes = only schemes the hospital is confirmed empanelled in: ${stateScheme}PM-JAY / Ayushman Bharat, CGHS, ESI.`,
    'timings = OPD / visiting timings exactly as the hospital or an official page publishes them, else "". emergency24x7 = true only if a source says 24x7 emergency / casualty.',
    'specialFor = diseases / conditions / treatments a public source states this hospital is a centre for (e.g. "kidney transplant", "cancer care", "cardiac surgery"), else [].',
    'facilities = facilities a public source lists (e.g. ICU, NICU, dialysis, blood bank, CT, MRI, cath lab, trauma care), else [].',
    'doctors = ONLY specialist doctors named on the hospital\'s own website or an official list, each with "source" = that page URL; "experience" only if that page states it (e.g. "15 years"), else "". Never invent a doctor. If none are publicly listed, [].',
    'sources = up to 3 https pages you used for this hospital.',
    'Reply with ONLY this JSON (no markdown): {"asOf":"YYYY-MM","hospitals":[{"name":"","type":"e.g. Government General Hospital / Private multi-speciality","district":"","address":"","phone":"","timings":"","emergency24x7":true,"specialities":[""],"specialFor":[""],"facilities":[""],"doctors":[{"name":"","speciality":"","qualification":"","experience":"","source":"https://"}],"schemes":[""],"website":"https://","sources":["https://"],"note":"one neutral line (beds, medical college, etc.)"}]}',
  ].join('\n');
}

// Govt research split into 3 smaller grounded calls run in parallel (faster than one big answer).
// raw = keys of the model's JSON that part owns; keys = cleaned (cleanGovt) keys it fills.
export const GOVT_PARTS = [
  {
    raw: ['asOf', 'overview', 'state', 'district', 'election'],
    keys: ['asOf', 'overview', 'leaders', 'district', 'election'],
    ask: (district) => [
      'Collect: a short neutral overview, the state leaders (Governor, Chief Minister, Deputy CMs, ministers with portfolios), elections, and',
      district
        ? `the ${district.replace(/-/g, ' ')} district: District Collector, Superintendent of Police (or Commissioner of Police if a commissionerate), the Lok Sabha MP(s) whose constituency covers the district, and ALL MLAs of assembly constituencies in the district.`
        : 'district fields may stay empty (state-level summary).',
      'Reply with ONLY this JSON (no markdown):',
      '{"asOf":"YYYY-MM","overview":"3-4 neutral sentences about the place (district HQ, population, main languages)",',
      '"state":{"governor":"","chiefMinister":{"name":"","party":""},"deputyCMs":[{"name":"","party":"","role":"portfolios"}],"ministers":[{"name":"","party":"","role":"portfolios"}]},',
      '"district":{"headquarters":"","collector":"","sp":"","policeCommissioner":"","mps":[{"name":"","constituency":"","party":""}],"mlas":[{"name":"","constituency":"","party":""}]},',
      '"election":{"lastAssembly":"year + result in one neutral line","lastLokSabha":"year + one neutral line","next":"when the next elections are due","voterHelpline":"1950","ceoWebsite":"https://"}}',
    ],
  },
  {
    raw: ['offices', 'schemes', 'grievance'],
    keys: ['offices', 'schemes', 'grievance'],
    ask: () => [
      'Collect: government offices people visit here (Collectorate, SP office, DMHO, RTO, municipal corporation), the major state AND central welfare schemes people here use (health, pensions, farmers, housing, education, women, food) with eligibility and how to apply, and grievance channels (CM helpline / state grievance portal as it exists in this state now, CPGRAMS pgportal.gov.in, district grievance day).',
      'Reply with ONLY this JSON (no markdown):',
      '{"offices":[{"name":"","what":"","address":"","phone":"","website":"https://"}],',
      '"schemes":[{"name":"","level":"state|central","who":"eligibility","benefit":"","apply":"how to apply (office / portal / app)","website":"https://"}],',
      '"grievance":[{"name":"","how":"","phone":"","website":"https://"}]}',
    ],
  },
  {
    raw: ['departments', 'services', 'helplines'],
    keys: ['departments', 'services', 'helplines'],
    ask: () => [
      'Collect: the main government departments (what each does, website, helpline), common citizen services (certificates, land records, ration card etc.: how to get them, website), and helpline numbers.',
      'Reply with ONLY this JSON (no markdown):',
      '{"departments":[{"name":"","what":"","website":"https://","helpline":""}],"services":[{"name":"","how":"","website":"https://"}],"helplines":[{"name":"","number":""}]}',
    ],
  },
];

export function researchPrompts(kind, variant, state, district) {
  if (kind !== 'govt') {
    return [researchPrompt(kind, variant, state, district)];
  }
  const where = placeName(state, district);
  const today = new Date().toISOString().slice(0, 10);
  return GOVT_PARTS.map(part =>
    [
      `Today is ${today}. Using Google Search, collect current, factual public information for ${where}.`,
      'Neutral facts only: no opinions, no praise or criticism, no ratings. Party names only as plain facts next to each elected person.',
      'Prefer official sources (.gov.in, .nic.in, state portals, district NIC sites, ECI). Use the CURRENT office holders as of today.',
      'If you are not sure of a value (a name, a phone number, a website), leave it empty "" instead of guessing. Never invent phone numbers.',
      ...part.ask(district),
    ].join('\n'),
  );
}

// Text fields the translation keeps (everything else comes from the English row)
export function translatePrompt(kind, data, langName) {
  return [
    `Translate the text values of this JSON into simple, everyday ${langName} (native script).`,
    'Keep EXACTLY the same JSON keys, nesting, array order and array lengths. Transliterate names of people and places into the script.',
    'Do NOT translate or change: URLs, phone numbers, dates, "level", "slug", "area", "source", "sources", "date", "from", "to", booleans, numbers. Keep scheme / portal acronyms readable (e.g. "PM-JAY (ఆయుష్మాన్ భారత్)").',
    'Do not add or remove facts. Reply with ONLY the JSON.',
    JSON.stringify(data),
  ].join('\n');
}

const parseJsonCol = (v, dflt) => {
  try {
    return v ? JSON.parse(v) : dflt;
  } catch (e) {
    return dflt;
  }
};

// Fields a translation must never change (URLs, phones, dates, keys): copied back from the English
// data by position before the translated copy is cleaned (hospitals + comparison)
const FIXED_KEYS = new Set(['source', 'sources', 'date', 'from', 'to', 'area', 'website', 'phone', 'mapUrl', 'slug', 'emergency24x7']);
export function keepFixed(en, tr) {
  if (Array.isArray(en)) {
    return Array.isArray(tr) && tr.length === en.length ? en.map((v, i) => keepFixed(v, tr[i])) : tr;
  }
  if (en && typeof en === 'object') {
    if (!tr || typeof tr !== 'object' || Array.isArray(tr)) {
      return tr;
    }
    const out = { ...tr };
    Object.keys(en).forEach(k => {
      out[k] = FIXED_KEYS.has(k) ? en[k] : keepFixed(en[k], tr[k]);
    });
    return out;
  }
  return tr;
}

// Never translated: copied from English (all kinds, incl. Govt numbers / portals / scheme level)
const ALIGN_FIXED = new Set([...FIXED_KEYS, 'level', 'number', 'helpline', 'voterHelpline', 'ceoWebsite', 'asOf', 'src', 'origin', 'lat', 'lon', 'osmUrl', 'ownership', 'id']);
// OpenStreetMap hospital rows: proper names and addresses stay exactly as mapped (never translated)
export const FREE_HOSP_FIXED = new Set([...ALIGN_FIXED, 'name', 'address', 'district']);
// The fixed (never translated) keys for one row's English data
export const fixedFor = (kind, data) => (kind === 'hosp' && obj(data).origin === 'free' ? FREE_HOSP_FIXED : ALIGN_FIXED);
// The English data without its fixed keys: what is sent for translation (smaller prompt; the fixed
// values are copied back from English by alignTranslation)
export const stripFixed = (v, fixed = ALIGN_FIXED) =>
  Array.isArray(v)
    ? v.map(x => stripFixed(x, fixed))
    : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).filter(([k]) => !fixed.has(k)).map(([k, x]) => [k, stripFixed(x, fixed)]))
    : v;

/**
 * The translated copy in EXACTLY the English shape (pure: tested): same keys, same array lengths;
 * text from the translation (cleaned, length-capped) or '' where the translation has none (the app
 * then shows the English text); URLs, phones, dates, numbers, booleans always from English.
 */
export function alignTranslation(en, tr, fixed = ALIGN_FIXED) {
  if (Array.isArray(en)) {
    const t = Array.isArray(tr) ? tr : [];
    return en.map((v, i) => alignTranslation(v, t[i], fixed));
  }
  if (en && typeof en === 'object') {
    const t = tr && typeof tr === 'object' && !Array.isArray(tr) ? tr : {};
    const out = {};
    Object.keys(en).forEach(k => {
      out[k] = fixed.has(k) ? en[k] : alignTranslation(en[k], t[k], fixed);
    });
    return out;
  }
  if (typeof en === 'string') {
    if (!en.trim() || typeof tr !== 'string') {
      return '';
    }
    return s(tr, Math.min(2000, Math.max(80, en.length * 3)));
  }
  return en;
}

// How many non-empty translatable strings a copy has (fixed fields like URLs / phones not counted;
// 0 = nothing to translate / nothing usable)
export const textCount = (v, fixed = ALIGN_FIXED) =>
  Array.isArray(v)
    ? v.reduce((n, x) => n + textCount(x, fixed), 0)
    : v && typeof v === 'object'
    ? Object.entries(v).reduce((n, [k, x]) => n + (fixed.has(k) ? 0 : textCount(x, fixed)), 0)
    : typeof v === 'string' && v.trim()
    ? 1
    : 0;

// Small chunks for parallel translation calls (pure: tested). Arrays longer than `size` are split
// into slices; everything else rides in the first chunk. mergeParts() puts them back in order.
export function splitForTranslation(data, size = TR_CHUNK) {
  const misc = {};
  const parts = [];
  Object.entries(obj(data)).forEach(([k, v]) => {
    if (Array.isArray(v) && v.length > size) {
      for (let i = 0; i < v.length; i += size) {
        parts.push({ [k]: v.slice(i, i + size) });
      }
    } else {
      misc[k] = v;
    }
  });
  return Object.keys(misc).length ? [misc, ...parts] : parts;
}

export function mergeParts(parts) {
  const out = {};
  parts.forEach(p =>
    Object.entries(obj(p)).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        out[k] = (Array.isArray(out[k]) ? out[k] : []).concat(v);
      } else if (out[k] === undefined) {
        out[k] = v;
      }
    }),
  );
  return out;
}

// Translate English civic data into one language: small chunks in parallel, each aligned to its
// English chunk. -> { ok, data, calls, model } | { ok: false, error, code, calls }
export async function translateData(env, kind, data, lang, { fetchImpl = fetch, now } = {}) {
  if (!TR_LANGS[lang]) {
    return { ok: false, error: 'bad lang', calls: 0 };
  }
  const fixed = fixedFor(kind, data);
  if (!textCount(data, fixed)) {
    // Nothing to translate (e.g. a Govt part with empty lists): no call
    return { ok: true, data: alignTranslation(data, {}, fixed), calls: 0 };
  }
  const chunks = splitForTranslation(data).filter(c => textCount(c, fixed) > 0);
  const results = await Promise.all(
    chunks.map(async chunk => {
      const r = await aiGenerate(env, { prompt: translatePrompt(kind, stripFixed(chunk, fixed), TR_LANGS[lang]), jsonOut: true, maxTokens: 8000, temperature: 0.1 }, { fetchImpl, now });
      const parsed = r.ok ? parseJsonLoose(r.text) : null;
      return { r, tr: parsed ? alignTranslation(chunk, parsed, fixed) : null };
    }),
  );
  const bad = results.find(x => !x.tr);
  if (bad) {
    return { ok: false, error: bad.r.ok ? 'unreadable translation' : bad.r.error, code: bad.r.code, calls: chunks.length };
  }
  const tr = alignTranslation(data, mergeParts(results.map(x => x.tr)), fixed);
  if (!textCount(tr, fixed)) {
    return { ok: false, error: 'unreadable translation', calls: chunks.length };
  }
  return { ok: true, data: tr, calls: chunks.length, model: results[0] && results[0].r.model };
}

const cleanFor = (kind, parsed, where = '') => (kind === 'govt' ? cleanGovt(parsed) : kind === 'gcmp' ? cleanCompare(parsed) : cleanHosp(parsed, where));

const isEmpty = (kind, data) =>
  !data ||
  (kind === 'hosp' && !data.hospitals.length) ||
  (kind === 'gcmp' && !data.rows.length) ||
  (kind === 'govt' && !data.overview && !data.departments.length && !data.leaders.chiefMinister.name && !data.schemes.length);

const where4 = 'kind = ? AND state = ? AND district = ? AND variant = ?';
const binds4 = t => [t.kind, t.state, t.district, t.variant];

const lockRow = async (db, t, now) => {
  // Insert a placeholder (pending) if needed, then take the lock only when free or stale
  await db.run(
    "INSERT OR IGNORE INTO civic_data (kind, state, district, variant, status, updated_at) VALUES (?, ?, ?, ?, 'pending', ?)",
    t.kind, t.state, t.district, t.variant, now,
  );
  const r = await db.run(`UPDATE civic_data SET running_at = ? WHERE ${where4} AND (running_at IS NULL OR running_at < ?)`, now, ...binds4(t), now - CIVIC_LOCK_MS);
  return Number((r && r.meta && (r.meta.changes ?? r.meta.rows_written)) || 0) > 0;
};

const unlock = (db, t) => db.run(`UPDATE civic_data SET running_at = NULL WHERE ${where4}`, ...binds4(t));

const saveTranslation = (db, t, lang, data, now) =>
  db.run(
    `INSERT INTO civic_i18n (kind, state, district, variant, lang, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (kind, state, district, variant, lang) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    ...binds4(t), lang, JSON.stringify(data), now,
  );

// Translated copies of one row: civic_i18n first, the old civic_data.i18n column (te / hi) after.
export async function readI18n(db, t, langs, oldCol = null) {
  const want = [...new Set(langs.filter(l => TR_LANGS[l]))];
  const out = {};
  if (!want.length) {
    return out;
  }
  const rows = await db.all(`SELECT lang, data FROM civic_i18n WHERE ${where4} AND lang IN (${want.map(() => '?').join(',')})`, ...binds4(t), ...want);
  rows.forEach(r => {
    const d = parseJsonCol(r.data, null);
    if (d) {
      out[r.lang] = d;
    }
  });
  const old = parseJsonCol(oldCol, {});
  want.forEach(l => {
    if (!out[l] && old[l]) {
      out[l] = old[l];
    }
  });
  return out;
}

// Translate the stored English data of one row into one language and save it (civic_i18n)
export async function translateOne(db, env, t, lang, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!TR_LANGS[lang]) {
    return { ok: false, error: 'bad lang' };
  }
  const row = await db.first(`SELECT data FROM civic_data WHERE ${where4}`, ...binds4(t));
  const data = row ? parseJsonCol(row.data, null) : null;
  if (!data) {
    return { ok: false, error: 'no data yet' };
  }
  const r = await translateData(env, t.kind, data, lang, { fetchImpl, now });
  if (r.calls) {
    await addUsage(db, utcDay(now), 'civic_tr', r.calls);
  }
  if (!r.ok) {
    return { ok: false, error: r.error, code: r.code };
  }
  await saveTranslation(db, t, lang, r.data, now);
  return { ok: true, lang, model: r.model };
}

const trTriesKey = (t, lang) => `civic_trk:${t.kind}|${t.state}|${t.district}|${t.variant}|${lang}`.slice(0, 160);

/**
 * Start translating one row's English data into one language, inside the daily translation cap,
 * at most CIVIC_TR_ROW_TRIES attempts per row + language per day, one run per row (lock).
 * opts.waitUntil (ctx.waitUntil): run in the background and answer at once with
 * { ok: true, status: 'translating', did: 'translate', started: true }; without it the translation is
 * awaited ({ ok, ..., did: 'translate' }). A refusal (cap, tries, no provider) has no `did`.
 */
export async function startTranslate(db, env, t, lang, { fetchImpl = fetch, now = Date.now(), waitUntil = null } = {}) {
  if (!TR_LANGS[lang] || !isAiConfigured(env)) {
    return { ok: false, status: 'ok', error: 'translation not available', code: 'config' };
  }
  const caps = civicCaps(env);
  const day = utcDay(now);
  const tk = trTriesKey(t, lang);
  const used = await usageFor(db, day, ['civic_tr', tk]);
  if (used.civic_tr >= caps.trDailyMax) {
    return { ok: false, status: 'ok', error: 'daily translation cap reached', code: 'cap' };
  }
  if (used[tk] >= CIVIC_TR_ROW_TRIES) {
    return { ok: false, status: 'ok', error: 'translation tried too often today', code: 'cap' };
  }
  if (!(await lockRow(db, t, now))) {
    return { ok: true, status: 'running', did: 'already running' };
  }
  await addUsage(db, day, tk, 1);
  const job = (async () => {
    try {
      return await translateOne(db, env, t, lang, { fetchImpl, now });
    } finally {
      await unlock(db, t);
    }
  })();
  if (waitUntil) {
    waitUntil(job.catch(() => undefined));
    return { ok: true, status: 'translating', did: 'translate', started: true, lang };
  }
  return { ...(await job), status: 'ok', did: 'translate' };
}

/**
 * Research one target in English (grounded; Govt = 3 parallel parts). opts.langs: languages to
 * translate into TOGETHER with the research (each part is translated the moment it arrives).
 * opts.translate (legacy): true = the cron languages (CIVIC_CRON_LANGS).
 */
export async function researchOne(db, env, { kind, state, district = '', variant = '' }, { fetchImpl = fetch, now = Date.now(), translate = false, langs = null, free = true, waitUntil = null } = {}) {
  const st = placeByCode(state, kind);
  if (!st || !KINDS[kind] || !KINDS[kind].includes(variant) || (kind === 'gcmp' && district)) {
    return { ok: false, error: 'bad target' };
  }
  const t = { kind, state, district, variant };
  if (free && FREE_KINDS.has(kind)) {
    // Free sources first (no AI) unless the row already holds grounded AI data (kept until AI refreshes it)
    const cur = await db.first(`SELECT data, status, origin FROM civic_data WHERE ${where4}`, ...binds4(t));
    if (!(cur && cur.data) || cur.origin === 'free' || cur.status === 'partial') {
      const fr = await researchFree(db, env, t, { fetchImpl, now, waitUntil, request: false });
      if (fr.ok) {
        return fr;
      }
    }
  }
  const where = placeName(st, district);
  const toLangs = [...new Set((langs || (translate ? CIVIC_CRON_LANGS : [])).filter(l => TR_LANGS[l]))];
  const prompts = researchPrompts(kind, variant, st, district);
  let trCalls = 0;
  // Progressive Govt: first research of a place (no data saved yet) saves each finished part at once
  const before = kind === 'govt' ? await db.first(`SELECT data FROM civic_data WHERE ${where4}`, ...binds4(t)) : null;
  const progressive = kind === 'govt' && !(before && before.data);
  const done = [];
  let saving = Promise.resolve();
  const savePartial = () => {
    const okDone = done.filter(p => p.raw);
    const partial = cleanGovt(Object.assign({}, ...okDone.map(p => p.raw)));
    if (!okDone.length || isEmpty(kind, partial)) {
      return;
    }
    const sources = [];
    okDone.forEach(p => ((p.r.ok && p.r.sources) || []).forEach(x => !sources.some(y => y.url === x.url) && sources.length < 12 && sources.push(x)));
    const trs = toLangs
      .filter(lang => okDone.every(p => p.tr[lang]))
      .map(lang => [lang, alignTranslation(partial, Object.assign({}, ...okDone.map(p => p.tr[lang])))])
      .filter(([, d]) => textCount(d));
    saving = saving
      .then(async () => {
        await db.run(
          `INSERT INTO civic_data (kind, state, district, variant, data, sources, ai_stars, status, error, model, updated_at, i18n, schema_v, origin)
           VALUES (?, ?, ?, ?, ?, ?, NULL, 'partial', NULL, ?, ?, NULL, ?, 'ai')
           ON CONFLICT (kind, state, district, variant) DO UPDATE SET data = excluded.data, sources = excluded.sources,
             status = 'partial', error = NULL, model = excluded.model, updated_at = excluded.updated_at, schema_v = excluded.schema_v, origin = 'ai'
           WHERE civic_data.data IS NULL OR civic_data.status = 'partial'`,
          kind, state, district, variant, JSON.stringify(partial), JSON.stringify(sources), (okDone[0].r && okDone[0].r.model) || '', now, CIVIC_SCHEMA[kind] || 1,
        );
        for (const [lang, d] of trs) {
          await saveTranslation(db, t, lang, d, now);
        }
      })
      .catch(() => undefined);
  };
  const parts = await Promise.all(
    prompts.map(async (prompt, i) => {
      const r = await aiGenerate(env, { prompt, grounded: true, maxTokens: kind === 'govt' ? 8000 : 16000 }, { fetchImpl, now });
      const parsed = r.ok ? parseJsonLoose(r.text) : null;
      const gp = kind === 'govt' ? GOVT_PARTS[i] : null;
      const raw = parsed && gp ? Object.fromEntries(gp.raw.filter(k => k in obj(parsed)).map(k => [k, parsed[k]])) : parsed;
      const tr = {};
      if (raw && toLangs.length) {
        const clean = cleanFor(kind, raw, where);
        const en = gp ? Object.fromEntries(gp.keys.map(k => [k, clean[k]])) : clean;
        await Promise.all(
          toLangs.map(async lang => {
            const x = await translateData(env, kind, en, lang, { fetchImpl, now });
            trCalls += x.calls || 0;
            if (x.ok) {
              tr[lang] = x.data;
            }
          }),
        );
      }
      const part = { r, raw, tr };
      if (progressive && prompts.length > 1) {
        done.push(part);
        if (done.length < prompts.length) {
          savePartial();
        }
      }
      return part;
    }),
  );
  await saving;
  const day = utcDay(now);
  await addUsage(db, day, 'civic_ai', prompts.length);
  if (trCalls) {
    await addUsage(db, day, 'civic_tr', trCalls);
  }
  const okParts = parts.filter(p => p.raw);
  let data = okParts.length ? cleanFor(kind, kind === 'govt' ? Object.assign({}, ...okParts.map(p => p.raw)) : okParts[0].raw, where) : null;
  const failed = parts.find(p => !p.r.ok) || parts.find(p => !p.raw);
  let error = '';
  if (isEmpty(kind, data)) {
    data = null;
    error = failed ? (failed.r.ok ? 'empty or unreadable answer' : failed.r.error) : 'empty or unreadable answer';
    if (failed && !failed.r.ok && isExhausted(failed.r.code) && parts.every(p => !p.r.ok)) {
      // Every Gemini key is out of free quota: keep the row exactly as it is (saved data, or still
      // 'pending' so the cron picks it up after the reset) and never fall back to invented data
      return { ok: false, status: 'paused', paused: true, error: RESEARCH_PAUSED, code: failed.r.code };
    }
  }
  if (data) {
    const sources = [];
    parts.forEach(p =>
      ((p.r.ok && p.r.sources) || []).forEach(x => {
        if (!sources.some(y => y.url === x.url) && sources.length < 12) {
          sources.push(x);
        }
      }),
    );
    const model = (okParts[0] && okParts[0].r.model) || '';
    // New English data: old translations no longer match, so they are dropped (re-translated next)
    await db.run(
      `INSERT INTO civic_data (kind, state, district, variant, data, sources, ai_stars, status, error, model, updated_at, i18n, schema_v, origin)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'ok', NULL, ?, ?, NULL, ?, 'ai')
       ON CONFLICT (kind, state, district, variant) DO UPDATE SET data = excluded.data, sources = excluded.sources,
         ai_stars = NULL, status = 'ok', error = NULL, model = excluded.model, updated_at = excluded.updated_at, i18n = NULL,
         schema_v = excluded.schema_v, origin = 'ai'`,
      kind, state, district, variant, JSON.stringify(data), JSON.stringify(sources), model, now, CIVIC_SCHEMA[kind] || 1,
    );
    await db.run(`DELETE FROM civic_i18n WHERE ${where4}`, ...binds4(t));
    const out = { ok: true, model, translated: [] };
    for (const lang of toLangs) {
      // Every part that has data must have its translation, else that language waits for a retry
      if (okParts.every(p => p.tr[lang])) {
        const merged = alignTranslation(data, Object.assign({}, ...okParts.map(p => p.tr[lang])));
        if (textCount(merged)) {
          await saveTranslation(db, t, lang, merged, now);
          out.translated.push(lang);
        }
      }
    }
    return out;
  }
  // Keep the last good data; only mark the error
  await db.run(
    `INSERT INTO civic_data (kind, state, district, variant, status, error, updated_at) VALUES (?, ?, ?, ?, 'error', ?, ?)
     ON CONFLICT (kind, state, district, variant) DO UPDATE SET status = CASE WHEN civic_data.data IS NULL THEN 'error' ELSE civic_data.status END,
       error = excluded.error, updated_at = CASE WHEN civic_data.data IS NULL THEN excluded.updated_at ELSE civic_data.updated_at END`,
    kind, state, district, variant, String(error).slice(0, 300), now,
  );
  return { ok: false, error, code: failed && failed.r.code };
}

// On demand (a user opened a place): research it now (with the user's language in the same run) if
// it has no data, else translate the missing language. Locked per row (one run at a time) and inside
// the same daily caps as the cron.
export async function researchNow(db, env, t, lang, { fetchImpl = fetch, now = Date.now(), waitUntil = null } = {}) {
  const row = await db.first(`SELECT data, i18n, status, updated_at, running_at FROM civic_data WHERE ${where4}`, ...binds4(t));
  // A 'partial' Govt row (some parts saved, run still going or cut off) still needs its research
  const hasData = !!(row && row.data) && row.status !== 'partial';
  const have = hasData && TR_LANGS[lang] ? await readI18n(db, t, [lang], row.i18n) : {};
  const needTr = hasData && !!TR_LANGS[lang] && !have[lang];
  if (hasData && !needTr) {
    return { ok: true, status: 'ok', did: 'nothing' };
  }
  let freeError = '';
  if (!hasData && FREE_KINDS.has(t.kind)) {
    // Govt / Hospitals: free, keyless sources first. No AI key, cap or cool-down is involved, so this
    // never answers 'paused'; the asked language is translated afterwards in the background.
    if (!(await lockRow(db, t, now))) {
      return { ok: true, status: 'running', did: 'already running' };
    }
    let fr;
    try {
      fr = await researchFree(db, env, t, { fetchImpl, now, waitUntil, request: true });
    } finally {
      await unlock(db, t);
    }
    if (fr.ok) {
      const out = { ok: true, status: 'ready', did: 'research', origin: 'free', model: 'free', translated: [] };
      if (TR_LANGS[lang] && isAiConfigured(env) && waitUntil) {
        const k = await startTranslate(db, env, t, lang, { fetchImpl, now, waitUntil });
        if (k.started) {
          out.translating = true;
        }
      }
      return out;
    }
    freeError = fr.error || 'free sources unavailable';
  }
  if (!isAiConfigured(env)) {
    return { ok: false, status: 'ai_off', error: 'no AI provider set (GEMINI_API_KEY)', code: 'config', ...(freeError ? { freeError } : {}) };
  }
  const caps = civicCaps(env);
  if (!hasData && !isGeminiConfigured(env)) {
    // Research needs grounded Gemini; translation alone works on the other providers
    return { ok: false, status: 'ai_off', error: 'GEMINI_API_KEY not set', code: 'config' };
  }
  if (!hasData && !(await geminiReady(env, { now }))) {
    // Every key is cooling down: nothing to call, the saved info (if any) stays on screen
    return { ok: false, status: 'paused', paused: true, error: RESEARCH_PAUSED, code: 'quota' };
  }
  if (row && row.status === 'error' && !hasData && now - Number(row.updated_at) < CIVIC_RETRY_MS) {
    return { ok: false, status: 'error', error: 'research failed recently, retrying later' };
  }
  const day = utcDay(now);
  const used = await usageFor(db, day, ['civic_ai', 'civic_tr']);
  const calls = t.kind === 'govt' ? GOVT_PARTS.length : 1;
  if (!hasData && used.civic_ai + calls > caps.dailyMax) {
    return { ok: false, status: 'pending', error: 'daily cap reached', code: 'cap' };
  }
  if (needTr) {
    // Translation only: started in the background when the request can wait (English shows meanwhile)
    return startTranslate(db, env, t, lang, { fetchImpl, now, waitUntil });
  }
  if (!(await lockRow(db, t, now))) {
    return { ok: true, status: 'running', did: 'already running' };
  }
  try {
    const withLang = TR_LANGS[lang] && used.civic_tr < caps.trDailyMax ? [lang] : [];
    // free sources were tried just above (kinds that have them): grounded AI research only
    const r = await researchOne(db, env, t, { fetchImpl, now, langs: withLang, free: false });
    return { ...r, status: r.ok ? 'ok' : r.status || 'error', did: 'research' };
  } finally {
    await unlock(db, t);
  }
}

// Which targets the next run should research, best first (pure: tested)
export function pickTargets(rows, now, n, seeds = SEED_DISTRICTS) {
  const key = (k, st, d, v) => `${k}|${st}|${d}|${v}`;
  const byKey = new Map(rows.map(r => [key(r.kind, r.state, r.district || '', r.variant || ''), r]));
  const free = r => !r.running_at || now - Number(r.running_at) > CIVIC_LOCK_MS;
  const pending = rows.filter(r => r.status === 'pending' && free(r)).sort((a, b) => Number(a.updated_at) - Number(b.updated_at));
  const missing = [];
  STATES.forEach(st =>
    Object.entries(KINDS).forEach(([kind, variants]) =>
      variants.forEach(variant => {
        if (!byKey.has(key(kind, st.code, '', variant))) {
          missing.push({ kind, state: st.code, district: '', variant });
        }
      }),
    ),
  );
  // The centre's comparison (after all states)
  if (!byKey.has(key('gcmp', CENTRE.code, '', ''))) {
    missing.push({ kind: 'gcmp', state: CENTRE.code, district: '', variant: '' });
  }
  // Prefill: districts of the app's bundled cities (Govt + both hospital lists), state by state
  STATES.forEach(st =>
    ((seeds && seeds[st.code]) || []).forEach(district =>
      [
        ['govt', ''],
        ['hosp', 'govt'],
        ['hosp', 'private'],
      ].forEach(([kind, variant]) => {
        if (!byKey.has(key(kind, st.code, district, variant))) {
          missing.push({ kind, state: st.code, district, variant });
        }
      }),
    ),
  );
  // Rows saved with an older data shape (e.g. hospitals before v2): re-research, oldest first
  const outdated = rows
    .filter(r => r.status === 'ok' && free(r) && KINDS[r.kind] && Number(r.schema_v || 1) < (CIVIC_SCHEMA[r.kind] || 1))
    .sort((a, b) => Number(a.updated_at) - Number(b.updated_at));
  const stale = rows
    .filter(
      r =>
        free(r) &&
        ((r.status === 'ok' && now - Number(r.updated_at) > CIVIC_REFRESH_MS) ||
          ((r.status === 'error' || r.status === 'partial') && now - Number(r.updated_at) > CIVIC_RETRY_MS)),
    )
    .sort((a, b) => Number(a.updated_at) - Number(b.updated_at));
  const pick = r => ({ kind: r.kind, state: r.state, district: r.district || '', variant: r.variant || '' });
  const seen = new Set();
  return [...pending.map(pick), ...missing, ...outdated.map(pick), ...stale.map(pick)]
    .filter(t => {
      const k = key(t.kind, t.state, t.district, t.variant);
      return !seen.has(k) && seen.add(k);
    })
    .slice(0, Math.max(0, n));
}

const callsFor = t => (t.kind === 'govt' ? GOVT_PARTS.length : 1);

export async function runCivicResearch(db, env, { fetchImpl = fetch, now = Date.now(), perRun, dailyMax, translate = true } = {}) {
  if (!isAiConfigured(env)) {
    return { ran: 0, skipped: 'GEMINI_API_KEY not set' };
  }
  const caps = civicCaps(env);
  // Grounded research only while some Gemini key has quota; translations run on any provider
  const canResearch = isGeminiConfigured(env) && (await geminiReady(env, { now }));
  let paused = isGeminiConfigured(env) && !canResearch;
  const maxCalls = dailyMax === undefined ? caps.dailyMax : dailyMax;
  const places = perRun === undefined ? caps.perRun : perRun;
  const day = utcDay(now);
  const used = await usageFor(db, day, ['civic_ai', 'civic_tr']);
  let aiLeft = maxCalls - used.civic_ai;
  const results = [];
  if (canResearch && aiLeft > 0 && places > 0) {
    const rows = await db.all('SELECT kind, state, district, variant, status, updated_at, running_at, schema_v FROM civic_data');
    const targets = pickTargets(rows, now, places);
    // One place after another (each place's own calls run in parallel): stays under the per-minute limit
    for (const t of targets) {
      if (callsFor(t) > aiLeft) {
        break;
      }
      aiLeft -= callsFor(t);
      const trUsed = (await usageFor(db, day, ['civic_tr'])).civic_tr;
      const tr = translate && trUsed < caps.trDailyMax;
      const r = await researchOne(db, env, t, { fetchImpl, now, translate: tr });
      results.push({ ...t, ...r });
      if (r.paused) {
        // Keys ran out mid-run: stop researching until they reset (saved data stays as it is)
        paused = true;
        break;
      }
    }
  }
  // Rows with English data but no te / hi copy yet (researched on demand, or a translation that
  // failed): up to caps.trPerRun per run, one after another. Order: rows researched in the last day
  // (someone just opened them), then the state-level rows and the bundled-city (seed) districts,
  // then the rest, newest first.
  if (translate) {
    const backlog = await translationBacklog(db, now);
    let left = caps.trPerRun;
    for (const job of backlog) {
      if (left <= 0) {
        break;
      }
      const r = await startTranslate(db, env, job.t, job.lang, { fetchImpl, now });
      if (!r.did && r.code === 'cap' && /daily/.test(r.error || '')) {
        break; // daily translation cap reached
      }
      if (r.did !== 'translate') {
        continue; // locked by a research run, or tried too often today: next row
      }
      left -= 1;
      results.push({ ...job.t, translate: job.lang, ...r });
    }
  }
  if (!results.length) {
    return { ran: 0, skipped: paused ? RESEARCH_PAUSED : aiLeft <= 0 ? 'daily cap reached' : 'nothing to do' };
  }
  return { ran: results.length, results, ...(paused ? { paused: true } : {}) };
}

// Missing cron-language (te / hi) copies of rows with English data, best first (see runCivicResearch)
export async function translationBacklog(db, now, seeds = SEED_DISTRICTS) {
  const rows = await db.all("SELECT kind, state, district, variant, i18n, updated_at FROM civic_data WHERE status = 'ok' AND data IS NOT NULL LIMIT 2000");
  if (!rows.length) {
    return [];
  }
  const marks = CIVIC_CRON_LANGS.map(() => '?').join(',');
  const have = new Set(
    (await db.all(`SELECT kind, state, district, variant, lang FROM civic_i18n WHERE lang IN (${marks})`, ...CIVIC_CRON_LANGS)).map(
      x => `${x.kind}|${x.state}|${x.district || ''}|${x.variant || ''}|${x.lang}`,
    ),
  );
  const rank = r => {
    if (now - Number(r.updated_at) < 24 * 3600 * 1000) {
      return 0;
    }
    const d = r.district || '';
    return !d || ((seeds && seeds[r.state]) || []).includes(d) ? 1 : 2;
  };
  const jobs = [];
  rows
    .map(r => ({ r, k: rank(r) }))
    .sort((a, b) => a.k - b.k || Number(b.r.updated_at) - Number(a.r.updated_at))
    .forEach(({ r }) => {
      const t = { kind: r.kind, state: r.state, district: r.district || '', variant: r.variant || '' };
      const old = parseJsonCol(r.i18n, {});
      CIVIC_CRON_LANGS.forEach(lang => {
        if (!old[lang] && !have.has(`${t.kind}|${t.state}|${t.district}|${t.variant}|${lang}`)) {
          jobs.push({ t, lang });
        }
      });
    });
  return jobs;
}

// ── Free, keyless sources (no AI) ──

// Governors list (one Wikipedia section serves every state, one every UT): civic_text_cache
async function cachedGovernors(db, type, now) {
  const row = await db.first("SELECT text, updated_at FROM civic_text_cache WHERE ns = 'free_gov' AND lang = 'en' AND h = ?", type === 'ut' ? 'ut' : 'state');
  if (!row || now - Number(row.updated_at) > FREE_GOV_CACHE_MS) {
    return null;
  }
  const map = parseJsonCol(row.text, null);
  return map && typeof map === 'object' && Object.keys(map).length ? map : null;
}

const saveGovernors = (db, type, map, now) =>
  db.run(
    `INSERT INTO civic_text_cache (ns, lang, h, text, updated_at) VALUES ('free_gov', 'en', ?, ?, ?)
     ON CONFLICT (ns, lang, h) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at`,
    type === 'ut' ? 'ut' : 'state', JSON.stringify(map), now,
  );

// Nominatim area lookup cache (civic_geo, migration 0008)
export const geoKey = t => `${t.state}|${t.district || ''}`;

async function cachedGeo(db, t) {
  const row = await db.first('SELECT bbox, lat, lon, label, fetched_at, overpass_at FROM civic_geo WHERE place = ?', geoKey(t));
  const bbox = row ? parseJsonCol(row.bbox, null) : null;
  return bbox && ['south', 'north', 'west', 'east'].every(k => Number.isFinite(Number(bbox[k]))) ? { ...row, bbox } : null;
}

const saveGeo = (db, t, bbox, label, now) =>
  db.run(
    `INSERT INTO civic_geo (place, label, bbox, lat, lon, fetched_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (place) DO UPDATE SET label = excluded.label, bbox = excluded.bbox, lat = excluded.lat, lon = excluded.lon, fetched_at = excluded.fetched_at`,
    geoKey(t), s(label, 200), JSON.stringify(bbox), (bbox.south + bbox.north) / 2, (bbox.west + bbox.east) / 2, now,
  );

// Save one free row (origin 'free'); new English data drops the old translations (re-translated next)
async function saveFree(db, t, data, sources, now) {
  await db.run(
    `INSERT INTO civic_data (kind, state, district, variant, data, sources, ai_stars, status, error, model, updated_at, i18n, schema_v, origin, free_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, 'ok', NULL, 'free', ?, NULL, ?, 'free', ?)
     ON CONFLICT (kind, state, district, variant) DO UPDATE SET data = excluded.data, sources = excluded.sources, ai_stars = NULL,
       status = 'ok', error = NULL, model = 'free', updated_at = excluded.updated_at, i18n = NULL, schema_v = excluded.schema_v,
       origin = 'free', free_at = excluded.free_at`,
    ...binds4(t), JSON.stringify(data), JSON.stringify(sources || []), now, CIVIC_SCHEMA[t.kind] || 1, now,
  );
  await db.run(`DELETE FROM civic_i18n WHERE ${where4}`, ...binds4(t));
}

const OSM_SOURCES = [{ url: 'https://www.openstreetmap.org/copyright', title: 'OpenStreetMap contributors (ODbL)' }];
const OWNERSHIP_LABEL = { govt: 'Government', private: 'Private', unknown: '' };
const rankOwn = h => (h.ownership === 'govt' ? 0 : h.ownership === 'private' ? 1 : 2);

/**
 * One variant's stored hospital list from free OSM items (pure: tested). govt = items classed
 * government; private = every other item (private + not stated; ownership 'unknown' is not called
 * private in the app). Shape = cleanHosp with origin 'free'.
 */
export function freeHospData(items, variant, { district = '', today = '', src = null, where = '' } = {}) {
  const pick = (items || []).filter(h => (variant === 'govt' ? h.type === 'govt' : h.type !== 'govt'));
  return cleanHosp(
    {
      origin: 'free',
      asOf: today,
      src,
      hospitals: pick.map(h => ({
        id: h.id,
        name: h.name,
        type: OWNERSHIP_LABEL[h.type] || '',
        ownership: h.type,
        district,
        address: h.address,
        phone: h.phone,
        website: h.website,
        mapUrl: h.mapUrl,
        lat: h.lat,
        lon: h.lon,
        osmUrl: h.osmUrl,
        src: h.src,
        sources: [h.osmUrl],
      })),
    },
    where,
  );
}

/**
 * Research one Govt / Hospitals target from the free sources and save it (Hospitals: both
 * variants from one fetch). request = on the request path (short timeouts; the Overpass upgrade
 * goes to waitUntil). Never calls an AI provider. -> { ok, origin: 'free', ... } | { ok: false, error, code }
 */
export async function researchFree(db, env, t, { fetchImpl = fetch, now = Date.now(), waitUntil = null, request = true, sleepImpl = sleep } = {}) {
  const st = placeByCode(t.state, t.kind);
  if (!st || !FREE_KINDS.has(t.kind)) {
    return { ok: false, error: 'no free source for this kind' };
  }
  const caps = civicCaps(env);
  const day = utcDay(now);
  if ((await usageFor(db, day, ['civic_free'])).civic_free >= caps.freeDailyMax) {
    return { ok: false, error: 'daily free-source cap reached', code: 'cap' };
  }
  await addUsage(db, day, 'civic_free', 1);
  const today = new Date(now).toISOString().slice(0, 10);
  if (t.kind === 'govt') {
    const gov = await cachedGovernors(db, st.type, now);
    const r = await fetchGovtFree(st, t.district, { fetchImpl, now, timeoutMs: request ? FREE_REQ_TIMEOUT_MS : 8000, governors: gov || undefined });
    if (!gov && r.governors && Object.keys(r.governors).length) {
      await saveGovernors(db, st.type, r.governors, now);
    }
    if (!r.ok) {
      return { ok: false, error: r.error || 'free sources unavailable', code: 'source' };
    }
    await saveFree(db, t, cleanGovt(r.data), r.sources, now);
    return { ok: true, origin: 'free', model: 'free', translated: [] };
  }
  const where = placeName(st, t.district);
  const geo = await cachedGeo(db, t);
  const r = await fetchHospFree(st, t.district, {
    fetchImpl,
    now,
    timeoutMs: request ? FREE_REQ_TIMEOUT_MS : 6000,
    gapMs: caps.freeGapMs,
    sleepImpl,
    bbox: geo ? geo.bbox : null,
  });
  if (r.bbox && !geo) {
    await saveGeo(db, t, r.bbox, r.place, now);
  }
  if (!r.ok) {
    return { ok: false, error: r.error || 'free sources unavailable', code: 'source' };
  }
  const district = t.district ? titleCase(t.district) : '';
  for (const variant of KINDS.hosp) {
    await saveFree(db, { ...t, variant }, freeHospData(r.hospitals, variant, { district, today, src: r.src, where }), OSM_SOURCES, now);
  }
  if (waitUntil && r.bbox) {
    // every hospital / health centre of the area, after the response (never on the request path)
    waitUntil(upgradeHospOverpass(db, env, t, { fetchImpl, now, bbox: r.bbox, sleepImpl }).catch(() => undefined));
  }
  return { ok: true, origin: 'free', model: 'free', translated: [], count: r.hospitals.length };
}

/**
 * Overpass upgrade of a place's free hospital lists: adds every OSM hospital / health centre in the
 * area to the Nominatim list (Nominatim items kept, they carry the fuller address). Rows holding AI
 * data are not touched; a list whose items did not change is not re-saved (translations kept).
 */
export async function upgradeHospOverpass(db, env, t, { fetchImpl = fetch, now = Date.now(), bbox = null, sleepImpl = sleep } = {}) {
  const st = placeByCode(t.state, 'hosp');
  if (!st) {
    return { ok: false, error: 'bad target' };
  }
  let box = bbox;
  if (!box) {
    const geo = await cachedGeo(db, t);
    box = geo ? geo.bbox : null;
  }
  const r = await fetchHospOverpass(st, t.district, { fetchImpl, now, bbox: box, sleepImpl, gapMs: civicCaps(env).freeGapMs, timeoutMs: 25000 });
  const place = geoKey(t);
  if (r.bbox && !box) {
    await saveGeo(db, t, r.bbox, '', now);
  }
  await db.run('UPDATE civic_geo SET overpass_at = ?, overpass_status = ? WHERE place = ?', now, r.ok ? 'ok' : s(r.error || 'error', 60), place);
  if (!r.ok) {
    return { ok: false, error: r.error };
  }
  const today = new Date(now).toISOString().slice(0, 10);
  const district = t.district ? titleCase(t.district) : '';
  const where = placeName(st, t.district);
  let saved = 0;
  for (const variant of KINDS.hosp) {
    const vt = { kind: 'hosp', state: t.state, district: t.district || '', variant };
    const row = await db.first(`SELECT data, origin FROM civic_data WHERE ${where4}`, ...binds4(vt));
    const cur = row ? parseJsonCol(row.data, null) : null;
    if (row && row.data && row.origin !== 'free') {
      continue;
    }
    const have = cur && Array.isArray(cur.hospitals) ? cur.hospitals : [];
    const known = new Set(have.map(h => h.osmUrl).filter(Boolean));
    const add = freeHospData(r.hospitals, variant, { district, today, src: r.src, where }).hospitals.filter(h => !known.has(h.osmUrl));
    if (!add.length) {
      continue;
    }
    const hospitals = [...have, ...add].sort((a, b) => rankOwn(a) - rankOwn(b) || a.name.localeCompare(b.name));
    const data = cleanHosp({ origin: 'free', asOf: today, src: (cur && cur.src) || r.src, hospitals: hospitals.map(h => ({ ...h, id: h.osmUrl })) }, where);
    await saveFree(db, vt, data, OSM_SOURCES, now);
    saved += 1;
  }
  return { ok: true, saved, count: r.hospitals.length };
}

/**
 * Gentle cron refresh of the free rows (no AI): at most one Overpass upgrade (a place whose
 * hospital lists came from Nominatim and were never upgraded, or a week ago) and one re-fetch of
 * the stalest free row (older than CIVIC_FREE_REFRESH_MS) per run.
 */
export async function runFreeRefresh(db, env, { fetchImpl = fetch, now = Date.now(), sleepImpl = sleep } = {}) {
  const out = [];
  const geo = await db.first(
    `SELECT g.place FROM civic_geo g WHERE (g.overpass_at IS NULL OR g.overpass_at < ?)
       AND EXISTS (SELECT 1 FROM civic_data d WHERE d.kind = 'hosp' AND d.origin = 'free' AND d.state || '|' || d.district = g.place)
     ORDER BY COALESCE(g.overpass_at, 0) LIMIT 1`,
    now - CIVIC_FREE_REFRESH_MS,
  );
  if (geo) {
    const [state, district = ''] = String(geo.place).split('|');
    const r = await upgradeHospOverpass(db, env, { state, district }, { fetchImpl, now, sleepImpl });
    out.push({ overpass: geo.place, ok: r.ok });
  }
  const stale = await db.first(
    `SELECT kind, state, district, variant FROM civic_data WHERE origin = 'free' AND kind IN ('govt', 'hosp') AND variant IN ('', 'govt')
       AND COALESCE(free_at, updated_at) < ? AND (running_at IS NULL OR running_at < ?) ORDER BY COALESCE(free_at, updated_at) LIMIT 1`,
    now - CIVIC_FREE_REFRESH_MS,
    now - CIVIC_LOCK_MS,
  );
  if (stale) {
    const t = { kind: stale.kind, state: stale.state, district: stale.district || '', variant: stale.variant || '' };
    if (await lockRow(db, t, now)) {
      try {
        const r = await researchFree(db, env, t, { fetchImpl, now, request: false, sleepImpl });
        out.push({ ...t, ok: r.ok });
      } finally {
        await unlock(db, t);
      }
    }
  }
  return { ran: out.length, results: out };
}
