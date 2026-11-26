// "Previous vs present government" (kind 'gcmp') from FREE, keyless public sources (no AI, no API
// key). Used when grounded Gemini research is out of free quota (or not set up), like the promises
// fallback (promises.js).
//   1. Wikidata Query Service (CC0): the terms of the head of government (Chief Minister of the
//      state, Prime Minister of India for the centre: position held P39 with start / end), their
//      party (P102 covering the term start) and the state's ministries (P1001 + "... ministry"),
//      each with its English Wikipedia article. Present = the newest term, previous = the term
//      before it held by another person (else the term before it).
//   2. Wikipedia (MediaWiki API, CC BY-SA): the ministry article's sections about decisions /
//      schemes / policies / projects / budget, and the head's own article sections about that
//      office. Each sentence that states a concrete scheme / budget / project / start / stop
//      becomes one fact, with the news source Wikipedia cites for it (<ref> url + date).
// Every fact must have its own https source URL and a date inside that government's term, or it
// is dropped (no Wikipedia-section fallback, no guessed date). Contested sentences (alleged,
// accused, criticised, opposition claims) and evaluative words (research.js OPINION_RE) are
// dropped. Nothing found = no rows (the app shows "no data yet"). Pure helpers exported for tests.
import { getJson } from './http.js';
import { sparql, STATE_QIDS } from './govt.js';
import { normDate, parseCite, plain, splitSentences } from './promises.js';

export const WP_API = 'https://en.wikipedia.org/w/api.php';
export const CENTRE_QID = 'Q668'; // India
export const FREE_CMP_PER_SIDE = 12; // facts kept per government
export const FREE_CMP_SECTIONS = 3; // Wikipedia sections read per article (Workers CPU budget)

const val = (b, k) => (b && b[k] && typeof b[k].value === 'string' ? b[k].value : '');
const qid = v => String(v || '').replace(/^https?:\/\/www\.wikidata\.org\/entity\//, '');
const day = v => (/^\d{4}-\d{2}-\d{2}/.test(v || '') ? v.slice(0, 10) : '');
const titleOf = articleUrl => decodeURIComponent(String(articleUrl || '').replace(/^https:\/\/en\.wikipedia\.org\/wiki\//, '')).replace(/_/g, ' ');
const wpUrl = (title, anchor = '') =>
  `https://en.wikipedia.org/wiki/${encodeURI(String(title).replace(/ /g, '_'))}${anchor ? `#${encodeURIComponent(String(anchor).replace(/ /g, '_'))}` : ''}`;

// Terms of the head of government (with party statements) + the place's ministries
export const termsQuery = (q, centre) => `SELECT ?kind ?p ?pLabel ?start ?end ?partyLabel ?pst ?pen ?article ?xl ?mstart ?mend WHERE {
 { BIND("term" AS ?kind)
   ?office wdt:P1001 wd:${q}; rdfs:label ?ol. FILTER(lang(?ol)="en" && REGEX(?ol, "^${centre ? 'Prime Minister' : 'Chief Minister'} of"))
   ?p p:P39 ?s. ?s ps:P39 ?office. OPTIONAL { ?s pq:P580 ?start } OPTIONAL { ?s pq:P582 ?end }
   OPTIONAL { ?p p:P102 ?ps. ?ps ps:P102 ?party. OPTIONAL { ?ps pq:P580 ?pst } OPTIONAL { ?ps pq:P582 ?pen } }
   OPTIONAL { ?article schema:about ?p; schema:isPartOf <https://en.wikipedia.org/> } }
 UNION
 { BIND("ministry" AS ?kind) ?x wdt:P1001 wd:${q}; rdfs:label ?xl. FILTER(lang(?xl)="en" && REGEX(?xl, "(ministry|cabinet)$", "i"))
   OPTIONAL { ?x wdt:P580 ?m1 } OPTIONAL { ?x wdt:P571 ?m2 } BIND(COALESCE(?m1, ?m2) AS ?mstart)
   OPTIONAL { ?x wdt:P582 ?n1 } OPTIONAL { ?x wdt:P576 ?n2 } BIND(COALESCE(?n1, ?n2) AS ?mend)
   OPTIONAL { ?article schema:about ?x; schema:isPartOf <https://en.wikipedia.org/> } }
 SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 400`;

const DAY_MS = 24 * 3600 * 1000;
const near = (a, b, days) => !!(a && b) && Math.abs(Date.parse(a) - Date.parse(b)) <= days * DAY_MS;

/**
 * Present + previous government from the terms query rows (pure: tested).
 * -> { present, previous } each { head, party, from, to, article, ministry: {label, article} | null } | null
 */
export function termsFrom(rows, today) {
  const terms = new Map(); // person|start -> term
  (rows || [])
    .filter(b => val(b, 'kind') === 'term')
    .forEach(b => {
      const from = day(val(b, 'start'));
      const head = val(b, 'pLabel');
      if (!from || from > today || !head || /^Q\d+$/.test(head)) return;
      const k = `${qid(val(b, 'p'))}|${from}`;
      const t = terms.get(k) || { person: qid(val(b, 'p')), head, from, to: day(val(b, 'end')), article: val(b, 'article'), parties: new Map() };
      const party = val(b, 'partyLabel');
      if (party && !/^Q\d+$/.test(party)) t.parties.set(party, { from: day(val(b, 'pst')), to: day(val(b, 'pen')) });
      terms.set(k, t);
    });
  const list = [...terms.values()].sort((a, b) => (a.from < b.from ? 1 : -1));
  if (!list.length) return { present: null, previous: null };
  // party at the start of the term: the one statement whose dates cover it, else the only one
  const partyOf = t => {
    const all = [...t.parties.entries()];
    const cover = all.filter(([, d]) => (!d.from || d.from <= t.from) && (!d.to || d.to >= t.from) && (d.from || d.to));
    if (cover.length === 1) return cover[0][0];
    return all.length === 1 ? all[0][0] : '';
  };
  const ministries = (rows || [])
    .filter(b => val(b, 'kind') === 'ministry')
    .map(b => ({ label: val(b, 'xl'), from: day(val(b, 'mstart')), to: day(val(b, 'mend')), article: val(b, 'article') }))
    .filter(m => m.label && m.from);
  const pack = t => {
    // the newest ministry inside the term (a re-elected head's latest cabinet)
    // (one that starts the day the term ends is the next government's)
    const m = ministries.filter(x => (near(x.from, t.from, 45) || x.from >= t.from) && (t.to ? x.from < t.to : x.from <= today)).sort((a, b) => (a.from < b.from ? 1 : -1))[0];
    return { head: t.head, party: partyOf(t), from: t.from, to: t.to, article: t.article, ministry: m ? { label: m.label, article: m.article } : null };
  };
  const present = list[0];
  // the term before it: another person's (a re-elected head's own earlier term is the same government's line)
  const previous = list.slice(1).find(t => t.person !== present.person) || list[1] || null;
  return { present: pack(present), previous: previous ? pack({ ...previous, to: previous.to || present.from }) : null };
}

// Section headings that hold a government's decisions / schemes / projects
const FACT_HEAD_RE = /decision|scheme|welfare|polic|initiative|programme|program|project|budget|reform|development|governance|administration|achievement|tenure|premiership|chief minister|prime minister/i;
const SKIP_HEAD_RE = /opposition|early life|personal|controvers|criticism|allegation|electoral|election|references|see also|external|notes|bibliography|council of ministers|cabinet ministers|ministers by|portfolio|demographic|background|timeline/i;
const yearsIn = line => (String(line).match(/\b(19|20)\d{2}\b/g) || []).map(Number);

/**
 * Sections to read for one government (pure: tested). sections: MediaWiki parse sections; term:
 * { from, to }; head = true for the head's own biography (only sections about the office). A
 * heading that names years outside the term is skipped; a sub-section of a picked one is covered.
 */
export function pickFactSections(sections, term, head = false) {
  const y0 = Number(String(term.from).slice(0, 4));
  const y1 = term.to ? Number(String(term.to).slice(0, 4)) : 9999;
  const list = (sections || []).filter(x => /^\d+$/.test(String(x.index))).map(x => ({ index: String(x.index), level: Number(x.level) || 2, line: plain(x.line), anchor: x.anchor || '' }));
  const picked = [];
  const stack = [];
  list.forEach(sec => {
    while (stack.length && stack[stack.length - 1].level >= sec.level) stack.pop();
    const chain = [...stack.map(x => x.line), sec.line];
    const covered = stack.some(x => picked.some(p => p.index === x.index));
    const ys = chain.flatMap(yearsIn);
    const inTerm = !ys.length || ys.some(y => y >= y0 && y <= y1) || (ys.length >= 2 && Math.min(...ys) <= y0 && Math.max(...ys) >= y1);
    const office = /chief minister|prime minister|premiership|tenure|as cm\b/i.test(chain.join(' ')) && !/leader of (the )?opposition/i.test(chain.join(' '));
    const about = head ? office : FACT_HEAD_RE.test(sec.line);
    if (about && inTerm && !SKIP_HEAD_RE.test(sec.line) && !covered) picked.push(sec);
    stack.push(sec);
  });
  return picked.slice(0, FREE_CMP_SECTIONS);
}

// Which comparison area a sentence is about ('' = none: not a concrete scheme / budget / project fact)
const STOP_RE = /\b(scrap\w*|discontinu\w*|abolish\w*|stopped|halted|withdr[ae]w\w*|cancel\w*|repeal\w*|suspend\w*|wound up|closed down)\b/;
const START_RE = /\b(launch\w*|re-launch\w*|introduc\w*|inaugurat\w*|rolled out|commenc\w*|started|began|unveiled)\b/;
const MONEY_RE = /₹|\brs\.?\s?\d|\bcrore\b|\blakh\b/;
export function factArea(text) {
  const x = String(text || '').toLowerCase();
  // a stop counts only for a thing a government runs (a scheme, law, tax, project ...)
  const stop = /\b(schemes?|yojana|programmes?|programs?|plans?|projects?|laws?|acts?|tax|taxes|commission|policy|article|capital|canteens?|subsid\w*|board|corporation|council)\b/.test(x) ? x.search(STOP_RE) : -1;
  const start = /\b(schemes?|yojana|programme|program|mission|policy|initiative|pension|canteens?)\b/.test(x) ? x.search(START_RE) : -1;
  // both: the verb that comes first says what this government did ("re-launched X, discontinued by ...")
  if (start >= 0 && (stop < 0 || start < stop)) return 'started';
  if (stop >= 0) return 'stopped';
  if ((/\bbudget\b|\boutlay\b/.test(x) || /\ballocat\w*/.test(x)) && MONEY_RE.test(x)) return 'budget';
  if (/\b(projects?|capital city|airport|seaport|port|metro|irrigation|highway|expressway|bridge|dam|corridor|industrial park|reservoir)\b/.test(x)) return 'projects';
  if (/\b(schemes?|yojana|welfare|pension|subsid\w*|free (electricity|bus|travel|rice|gas)|scholarship|assistance of)\b/.test(x)) return 'schemes';
  return '';
}

// Contested / reported-speech sentences are not neutral facts
const CONTESTED_RE = /\b(alleg\w*|accus\w*|criticis\w*|criticiz\w*|claimed|claims|opposition|slammed|blamed|controvers\w*|protest\w*|according to|states that|said that|report(?:ed)? (?:by|filed))\b/i;

// Short topic for a fact: its first clause without a leading date / connective, cut at a word
// boundary (pure: tested)
const LEAD_RE = [
  /^(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{4}|\d{4})\s*[–—-]\s*/,
  /^(in|on|by|from|during|since|after)\s+[^,]{2,40},\s*/i,
  /^(additionally|however|also|further(more)?|meanwhile|subsequently|later|moreover|in addition),?\s*/i,
];
export function topicOf(text) {
  let t = String(text || '').trim();
  LEAD_RE.forEach(re => (t = t.replace(re, '')));
  const clauses = t.split(/\s*(?:[,;:–—]|\swhich\s|\sthat\s)\s*/);
  let first = clauses[0] || '';
  for (let i = 1; first.length < 20 && i < clauses.length; i++) first = `${first}, ${clauses[i]}`;
  first = first.length > 90 ? first.slice(0, 90).replace(/\s+\S*$/, '') : first;
  first = first.replace(/[.\s]+$/, '');
  return first ? first[0].toUpperCase() + first.slice(1) : '';
}

/**
 * Facts in one section's wikitext (pure: tested): each sentence with an area (factArea) and its
 * own cited source (the <ref> right after it, else the next <ref> in the same paragraph) dated
 * inside the term -> { area, topic, text, source, date }.
 */
export function extractFacts(wt, term, namedRefs = {}) {
  const refs = { ...namedRefs };
  String(wt || '').replace(/<ref\s+name\s*=\s*"?([^">/]+)"?\s*>([\s\S]*?)<\/ref>/gi, (_, n, body) => {
    refs[n.trim()] = parseCite(body);
    return '';
  });
  const to = term.to || '9999-12-31';
  const out = [];
  for (const raw of String(wt || '').split('\n')) {
    if (/^\s*(=|\{\||\||!|\{\{\s*(main|see also|further|dynamic list|multiple image|quote box))/i.test(raw) || !raw.trim()) continue;
    const found = [];
    let line = raw.replace(/<ref([^>]*?)\/>/gi, (_, attrs) => {
      const n = /name\s*=\s*"?([^"/]+)"?/i.exec(attrs);
      found.push((n && refs[n[1].trim()]) || { url: '', date: '' });
      return ` \u0001${found.length - 1}\u0001 `;
    });
    line = line.replace(/<ref[^>]*>([\s\S]*?)<\/ref>/gi, (_, body) => {
      found.push(parseCite(body));
      return ` \u0001${found.length - 1}\u0001 `;
    });
    const parts = splitSentences(plain(line.replace(/^\s*[*#]+\s*/, '')));
    // eslint-disable-next-line no-control-regex -- \u0001 marks a citation inside the sentence
    const refsIn = x => [...x.matchAll(/\u0001(\d+)\u0001/g)].map(m => found[Number(m[1])]).filter(r => r && r.url && r.date);
    parts.forEach((part, i) => {
      // eslint-disable-next-line no-control-regex -- \u0001 marks a citation inside the sentence
      const text = part.replace(/\s*\u0001\d+\u0001\s*/g, ' ').replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
      if (text.length < 25 || text.length > 400 || CONTESTED_RE.test(text)) return;
      const area = factArea(text);
      if (!area) return;
      let r = refsIn(part)[0];
      for (let j = i + 1; !r && j < parts.length; j++) r = refsIn(parts[j])[0];
      const d = r ? normDate(r.date) : '';
      // a fact counts only with its own cited source, dated inside this government's term
      if (!r || !d || d < term.from.slice(0, d.length) || d > to.slice(0, d.length)) return;
      out.push({ area, topic: topicOf(text), text, source: r.url, date: d });
    });
  }
  return out;
}

async function sectionsOf(title, opts) {
  const r = await getJson(`${WP_API}?action=parse&format=json&formatversion=2&redirects=1&prop=sections&page=${encodeURIComponent(title)}&origin=*`, opts);
  return r.ok && r.data && r.data.parse && Array.isArray(r.data.parse.sections) ? r.data.parse.sections : [];
}

async function sectionText(title, section, opts) {
  const r = await getJson(
    `${WP_API}?action=query&format=json&formatversion=2&redirects=1&prop=revisions&rvprop=content&rvslots=main&rvsection=${encodeURIComponent(section)}&titles=${encodeURIComponent(title)}&origin=*`,
    opts,
  );
  const p = r.ok && r.data && r.data.query && r.data.query.pages && r.data.query.pages[0];
  const rev = p && !p.missing && p.revisions && p.revisions[0];
  return rev ? (rev.slots && rev.slots.main && rev.slots.main.content) || '' : '';
}

// Facts of one government: its ministry article first, then the head's own article
async function factsFor(term, opts, sources) {
  const facts = [];
  const seen = new Set();
  const articles = [
    term.ministry && term.ministry.article ? { title: titleOf(term.ministry.article), head: false } : null,
    term.article ? { title: titleOf(term.article), head: true } : null,
  ].filter(Boolean);
  for (const a of articles) {
    if (facts.length >= FREE_CMP_PER_SIDE) break;
    const secs = pickFactSections(await sectionsOf(a.title, opts), term, a.head);
    let used = false;
    for (const sec of secs) {
      const wt = await sectionText(a.title, sec.index, opts);
      extractFacts(wt, term).forEach(f => {
        const k = f.text.toLowerCase();
        if (!seen.has(k) && facts.length < FREE_CMP_PER_SIDE) {
          seen.add(k);
          facts.push(f);
          used = true;
        }
      });
    }
    if (used) sources.push({ url: wpUrl(a.title), title: `Wikipedia: ${a.title}` });
  }
  return facts;
}

const govtOf = t =>
  t ? { label: t.ministry ? t.ministry.label : `${t.head} government`, head: t.head, party: t.party, from: t.from, to: t.to || '', source: (t.ministry && t.ministry.article) || t.article || '' } : {};

/**
 * fetchCompareFree(st, { fetchImpl, now, timeoutMs }) -> { ok: true, data (raw shape for
 * research.js cleanCompare, origin 'free'), sources } | { ok: false, error }
 */
export async function fetchCompareFree(st, { fetchImpl = fetch, now = Date.now(), timeoutMs = 8000 } = {}) {
  const centre = st.type === 'centre';
  const q = centre ? CENTRE_QID : STATE_QIDS[st.code];
  if (!q) return { ok: false, error: 'no wikidata item for this place' };
  const opts = { fetchImpl, timeoutMs };
  const today = new Date(now).toISOString().slice(0, 10);
  const r = await sparql(termsQuery(q, centre), opts);
  if (!r.ok) return { ok: false, error: `wikidata: ${r.error || 'unavailable'}` };
  const { present, previous } = termsFrom(r.rows, today);
  if (!present || !previous) return { ok: false, error: 'present / previous government not found' };
  const sources = [{ url: `https://www.wikidata.org/wiki/${q}`, title: 'Wikidata' }];
  const rows = [];
  for (const [side, term] of [
    ['present', present],
    ['previous', previous],
  ]) {
    (await factsFor(term, opts, sources)).forEach(f => rows.push({ area: f.area, topic: f.topic, [side]: { text: f.text, source: f.source, date: f.date } }));
  }
  rows.forEach(x => {
    const f = x.present || x.previous;
    if (!sources.some(z => z.url === f.source) && sources.length < 12) sources.push({ url: f.source, title: '' });
  });
  return {
    ok: true,
    data: { origin: 'free', asOf: today.slice(0, 7), previous: govtOf(previous), present: govtOf(present), rows },
    sources,
  };
}
