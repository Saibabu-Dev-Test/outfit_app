// Govt tab from FREE, keyless public sources (no AI, no API key):
//   Wikidata Query Service (query.wikidata.org, CC0): Governor / Lt Governor / Administrator, Chief
//     Minister, Deputy CMs (office holders without an end date), capital, population, official
//     website, the latest Assembly + Lok Sabha elections, the current ministry, district HQ.
//   Wikipedia (en.wikipedia.org action=parse + REST summary, CC BY-SA): the current ministry's
//     council-of-ministers table (ministers + portfolios + party), the state's section of "List of
//     members of the 18th Lok Sabha" (MPs), the latest Assembly election's "results by
//     constituency" table (MLAs elected, per district), the place summary (overview).
//   Static national info (official .gov.in sites): helplines, grievance portals, central schemes
//     and citizen services (staticInfo.js).
// Every section carries src {name, url, date} (date = the day it was fetched). Unknown values stay
// "" (the app shows "Public info not available"): Collector / SP have no free structured source.
// Wikimedia policy: descriptive User-Agent (http.js), results cached in D1 (refresh weekly).
import { getJson, isoDay } from './http.js';
import { cellAt, findTable } from './wikiTable.js';
import { CENTRAL_SCHEMES, CITIZEN_SERVICES, GRIEVANCE, HELPLINES, VOTER } from './staticInfo.js';

export const WDQS = 'https://query.wikidata.org/sparql';
export const WP_API = 'https://en.wikipedia.org/w/api.php';
export const WP_REST = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
export const LOK_SABHA_PAGE = 'List_of_members_of_the_18th_Lok_Sabha'; // Lok Sabha elected 2024 (term to 2029)
// Current governors / LGs / administrators (redirects to "Governor (India)"; only its "List of
// incumbent ..." section is fetched and parsed: Workers free plan CPU budget)
export const GOVERNORS_PAGE = 'List_of_current_Indian_governors';
export const GOVERNORS_SECTION = { state: /^list of incumbent governors$/i, ut: /^list of incumbent lieutenant governors/i };

// Wikidata item of each state / UT (codes as in states.js)
export const STATE_QIDS = {
  AP: 'Q1159', AR: 'Q1162', AS: 'Q1164', BR: 'Q1165', CG: 'Q1168', GA: 'Q1171', GJ: 'Q1061', HR: 'Q1174', HP: 'Q1177',
  JH: 'Q1184', KA: 'Q1185', KL: 'Q1186', MP: 'Q1188', MH: 'Q1191', MN: 'Q1193', ML: 'Q1195', MZ: 'Q1502', NL: 'Q1599',
  OD: 'Q22048', PB: 'Q22424', RJ: 'Q1437', SK: 'Q1505', TN: 'Q1445', TG: 'Q677037', TR: 'Q1363', UP: 'Q1498', UK: 'Q1499',
  WB: 'Q1356', AN: 'Q40888', CH: 'Q120971341', DH: 'Q77997266', DL: 'Q9357528', JK: 'Q66278313', LA: 'Q200667',
  LD: 'Q26927', PY: 'Q66743',
};

const qid = v => String(v || '').replace(/^https?:\/\/www\.wikidata\.org\/entity\//, '');
const val = (b, k) => (b && b[k] && typeof b[k].value === 'string' ? b[k].value : '');
const titleOf = articleUrl => decodeURIComponent(String(articleUrl || '').replace(/^https:\/\/en\.wikipedia\.org\/wiki\//, ''));
export const wikiUrl = title => `https://en.wikipedia.org/wiki/${encodeURI(String(title).replace(/ /g, '_'))}`;
const dateOnly = v => (/^\d{4}-\d{2}-\d{2}/.test(v || '') ? v.slice(0, 10) : '');
// "kurnool" / "bengaluru-urban" -> "kurnool" / "bengaluru urban"
export const placeWords = slug => String(slug || '').replace(/-/g, ' ').trim().toLowerCase();
const safeLit = s => String(s || '').replace(/["\\]/g, '');

export async function sparql(query, opts = {}) {
  const r = await getJson(`${WDQS}?format=json&query=${encodeURIComponent(query)}`, { ...opts, headers: { Accept: 'application/sparql-results+json' } });
  return r.ok && r.data && r.data.results && Array.isArray(r.data.results.bindings) ? { ok: true, rows: r.data.results.bindings } : { ok: false, rows: [], error: r.error };
}

// Office holders of the state: Governor / Lt Governor / Administrator / CM / Deputy CM (no end date)
export const officesQuery = q => `SELECT ?ol ?p ?pLabel ?start ?partyLabel ?pstart WHERE {
 ?office wdt:P1001 wd:${q}; rdfs:label ?ol. FILTER(lang(?ol)="en" && REGEX(?ol, "^(Governor|Lieutenant Governor|Chief Minister|Deputy Chief Minister|Administrator) of"))
 ?p p:P39 ?s. ?s ps:P39 ?office. FILTER NOT EXISTS { ?s pq:P582 [] } OPTIONAL { ?s pq:P580 ?start }
 OPTIONAL { ?p p:P102 ?ps. ?ps ps:P102 ?party. FILTER NOT EXISTS { ?ps pq:P582 [] } OPTIONAL { ?ps pq:P580 ?pstart } }
 SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 60`;

// State facts + its elections and ministries (latest picked in JS)
export const stateQuery = q => `SELECT ?kind ?xl ?date ?end ?article ?capLabel ?pop ?web ?hogLabel WHERE {
 { BIND("state" AS ?kind) OPTIONAL { wd:${q} wdt:P36 ?cap } OPTIONAL { wd:${q} wdt:P1082 ?pop } OPTIONAL { wd:${q} wdt:P856 ?web }
   OPTIONAL { wd:${q} p:P6 ?s6. ?s6 ps:P6 ?hog. FILTER NOT EXISTS { ?s6 pq:P582 [] } }
   OPTIONAL { ?article schema:about wd:${q}; schema:isPartOf <https://en.wikipedia.org/> } }
 UNION
 { BIND("item" AS ?kind) ?x wdt:P1001 wd:${q}; rdfs:label ?xl.
   FILTER(lang(?xl)="en" && REGEX(?xl, "(Legislative Assembly election|ministry|cabinet)$|^[0-9]{4} Indian general election in"))
   OPTIONAL { ?x wdt:P585 ?d1 } OPTIONAL { ?x wdt:P580 ?d2 } OPTIONAL { ?x wdt:P571 ?d3 } BIND(COALESCE(?d1, ?d2, ?d3) AS ?date)
   OPTIONAL { ?x wdt:P582 ?e1 } OPTIONAL { ?x wdt:P576 ?e2 } BIND(COALESCE(?e1, ?e2) AS ?end)
   OPTIONAL { ?article schema:about ?x; schema:isPartOf <https://en.wikipedia.org/> } }
 SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 300`;

// District of the state by name (label contains the words), or the district a city of that name is in
export const districtQuery = (q, words) => {
  const w = safeLit(words);
  const title = w.replace(/\b\w/g, c => c.toUpperCase());
  return `SELECT ?d ?dLabel ?hqLabel ?pop ?web ?article WHERE {
 { wd:${q} wdt:P150 ?d. ?d rdfs:label ?l. FILTER(lang(?l)="en" && CONTAINS(LCASE(?l), "${w}")) }
 UNION { ?c rdfs:label "${title}"@en; wdt:P131 ?d. wd:${q} wdt:P150 ?d. }
 OPTIONAL { ?d wdt:P36 ?hq } OPTIONAL { ?d wdt:P1082 ?pop } OPTIONAL { ?d wdt:P856 ?web }
 OPTIONAL { ?article schema:about ?d; schema:isPartOf <https://en.wikipedia.org/> }
 SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 10`;
};

/** Leaders from the offices query rows (pure: tested). Party only when exactly one is current. */
export function leadersFrom(rows) {
  const people = new Map(); // office|person -> {office, name, start, parties:Set}
  rows.forEach(b => {
    const office = val(b, 'ol');
    const name = val(b, 'pLabel');
    if (!office || !name || /^Q\d+$/.test(name)) return;
    const k = `${office}|${qid(val(b, 'p'))}`;
    const e = people.get(k) || { office, name, start: dateOnly(val(b, 'start')), parties: new Map() };
    const party = val(b, 'partyLabel');
    if (party && !/^Q\d+$/.test(party)) e.parties.set(party, dateOnly(val(b, 'pstart')));
    people.set(k, e);
  });
  const partyOf = e => {
    const list = [...e.parties.entries()];
    if (list.length === 1) return list[0][0];
    const dated = list.filter(([, d]) => d).sort((a, b) => (a[1] < b[1] ? 1 : -1));
    return dated.length && dated.length === list.length ? dated[0][0] : ''; // ambiguous -> ''
  };
  const latest = re =>
    [...people.values()]
      .filter(e => re.test(e.office))
      .sort((a, b) => (a.start < b.start ? 1 : -1));
  const gov = latest(/^(Governor|Lieutenant Governor|Administrator) of/)[0];
  const cm = latest(/^Chief Minister of/)[0];
  return {
    governor: gov ? gov.name : '',
    governorTitle: gov ? gov.office.replace(/ of .*$/, '') : '',
    chiefMinister: cm ? { name: cm.name, party: partyOf(cm), role: '' } : { name: '', party: '', role: '' },
    deputyCMs: latest(/^Deputy Chief Minister of/).map(e => ({ name: e.name, party: partyOf(e), role: '' })),
  };
}

/** State facts, latest elections and current ministry from the state query rows (pure: tested). */
export function stateFactsFrom(rows, today) {
  const st = rows.find(b => val(b, 'kind') === 'state') || {};
  const items = rows
    .filter(b => val(b, 'kind') === 'item')
    .map(b => ({ label: val(b, 'xl'), date: dateOnly(val(b, 'date')), end: dateOnly(val(b, 'end')), article: val(b, 'article') }))
    .filter(x => x.label && x.date && x.date <= today);
  const latest = re => items.filter(x => re.test(x.label)).sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
  return {
    capital: val(st, 'capLabel'),
    population: val(st, 'pop'),
    website: val(st, 'web'),
    article: val(st, 'article'),
    headOfGovernment: val(st, 'hogLabel'),
    assembly: latest(/Legislative Assembly election$/),
    lokSabha: latest(/^\d{4} Indian general election in/),
    ministry: items.filter(x => /(ministry|cabinet)$/i.test(x.label) && !x.end).sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null,
  };
}

const parseHtml = r => (r.ok && r.data && r.data.parse && typeof r.data.parse.text === 'string' ? r.data.parse.text : '');
export const wpParse = (title, opts, section) =>
  getJson(
    `${WP_API}?action=parse&format=json&formatversion=2&redirects=1&prop=text&disableeditsection=1&page=${encodeURIComponent(title)}${section !== undefined ? `&section=${section}` : ''}`,
    opts,
  ).then(parseHtml);
export const wpSections = (title, opts) =>
  getJson(`${WP_API}?action=parse&format=json&formatversion=2&redirects=1&prop=sections&page=${encodeURIComponent(title)}`, opts).then(r =>
    r.ok && r.data && r.data.parse && Array.isArray(r.data.parse.sections) ? r.data.parse.sections : [],
  );
export const wpSummary = (title, opts) =>
  getJson(`${WP_REST}${encodeURIComponent(String(title).replace(/ /g, '_'))}`, opts).then(r => (r.ok && r.data && typeof r.data.extract === 'string' ? r.data.extract : ''));

// A heading row inside the table ("Cabinet Ministers" spanning the columns). Its colspan can stop
// short of the last column, so empty cells are ignored.
const isSectionRow = r => {
  const filled = r.cells.filter(Boolean);
  return filled.length > 1 && filled.every(c => c === filled[0]);
};

/** Ministers from a ministry article's council-of-ministers table (pure: tested). */
export function ministersFrom(html) {
  const t = findTable(html, [/minister|name/i, /portfolio/i], { name: /^(minister|name)/i, portfolio: /portfolio/i, party: /party/i });
  if (!t || t.cols.name < 0) return [];
  let role = '';
  const out = [];
  t.rows.forEach(r => {
    if (isSectionRow(r)) {
      role = r.cells[0];
      return;
    }
    const name = cellAt(t, r, 'name').split('\n')[0];
    if (!name || /^(vacant|–|-)$/i.test(name)) return;
    const portfolio = cellAt(t, r, 'portfolio').split('\n').join(', ');
    out.push({ name, party: cellAt(t, r, 'party').split('\n')[0], role: portfolio, section: role });
  });
  return out.slice(0, 60);
}

/** MPs from the state's section of the Lok Sabha members list (pure: tested). */
export function mpsFrom(html) {
  const t = findTable(html, [/constituency/i, /^name|member/i], { constituency: /constituency/i, name: /^name|member/i, party: /party/i });
  if (!t) return [];
  return t.rows
    .map(r => ({ constituency: cellAt(t, r, 'constituency'), name: cellAt(t, r, 'name').split('\n')[0], party: cellAt(t, r, 'party').split('\n')[0] }))
    .filter(x => x.name && x.constituency && !/^vacant/i.test(x.name));
}

/** MLAs (winners) with their district from an Assembly election results table (pure: tested). */
export function mlasFrom(html) {
  const t = findTable(html, [/constituency/i, /winner|elected|mla/i], {
    district: /district/i,
    constituency: /constituency( name)?$|constituency name|^name$/i,
    name: /(winner|elected|mla).*(candidate|name)|^winner$|^(elected|mla)$/i,
    party: /(winner|elected|mla).*party/i,
  });
  if (!t || t.cols.name < 0) return [];
  return t.rows
    .map(r => ({
      district: cellAt(t, r, 'district'),
      constituency: cellAt(t, r, 'constituency'),
      name: cellAt(t, r, 'name').split('\n')[0],
      party: cellAt(t, r, 'party').split('\n')[0],
    }))
    .filter(x => x.name && x.constituency && !/^\d+$/.test(x.name));
}

const norm = s =>
  String(s || '')
    .toLowerCase()
    .replace(/\(.*?\)|district/g, '')
    .replace(/[^a-z]+/g, ' ')
    .trim();

/** District's MLAs + MPs (pure: tested): rows whose district or constituency name has the place. */
export function districtReps(mlas, mps, words, districtLabel = '') {
  const keys = [norm(words), norm(districtLabel)].filter(k => k.length >= 3);
  const hit = s => keys.some(k => norm(s) === k || norm(s).includes(k));
  const dm = mlas.filter(x => hit(x.district) || hit(x.constituency));
  const names = new Set(dm.map(x => norm(x.constituency)));
  const dp = mps.filter(x => hit(x.constituency) || names.has(norm(x.constituency)));
  return { mlas: dm.slice(0, 25), mps: dp.slice(0, 10) };
}

/**
 * Governors (or LGs / administrators) from the incumbent table of the governors page (pure: tested).
 * -> { [normalised state / UT name]: { name, title, since } }. Section rows inside the UT table
 * ("Lieutenant Governors", "Administrators") set the title of the rows below them.
 */
export function governorsFrom(html, dflt = 'Governor') {
  const t = findTable(html, [/^(state|union territor)/i, /officeholder|^name/i], { state: /^(state|union territor)/i, name: /officeholder|^name/i, since: /assumed|took office/i });
  if (!t || t.cols.state < 0 || t.cols.name < 0) return {};
  const out = {};
  let title = dflt;
  t.rows.forEach(r => {
    if (isSectionRow(r)) {
      const h = r.cells[0];
      title = /lieutenant/i.test(h) ? 'Lieutenant Governor' : /administrator/i.test(h) ? 'Administrator' : dflt;
      return;
    }
    const place = norm(cellAt(t, r, 'state').split('\n')[0]);
    const name = cellAt(t, r, 'name')
      .split('\n')[0]
      .replace(/\s*\(.*?\)\s*/g, ' ')
      .trim();
    if (!place || !name || /^(vacant|–|-)$/i.test(name)) return;
    const since = cellAt(t, r, 'since').split('\n')[0];
    out[place] = { name, title, since };
  });
  return out;
}

/** The governor of one state / UT from a governorsFrom map (pure: tested). Exact name, else contained ("Delhi"). */
export function governorFor(map, stateName) {
  const k = norm(stateName);
  if (!k || !map) return null;
  if (map[k]) return map[k];
  const hit = Object.keys(map).find(x => new RegExp(`(^| )${k}( |$)`).test(x));
  return hit ? map[hit] : null;
}

/** Fetch the incumbent table for a state or UT (one Wikipedia section). -> map ({} when unavailable) */
export async function fetchGovernors(type, opts) {
  const ut = type === 'ut';
  const html = await sectionHtml(GOVERNORS_PAGE, ut ? GOVERNORS_SECTION.ut : GOVERNORS_SECTION.state, opts);
  return html ? governorsFrom(html, ut ? 'Lieutenant Governor' : 'Governor') : {};
}

async function sectionHtml(title, match, opts) {
  const secs = await wpSections(title, opts);
  const s = secs.find(x => match.test(String(x.line || '').replace(/<[^>]+>/g, '')));
  return s ? wpParse(title, opts, s.index) : '';
}

/**
 * Govt data for a state (+ optional district slug) in the app's GovtData shape (cleanGovt), from
 * free sources only. -> { ok, data, sources, error }. Every network part may fail on its own; the
 * rest still shows (status ready without AI).
 */
export async function fetchGovtFree(state, district, { fetchImpl = fetch, now = Date.now(), timeoutMs = 7000, governors } = {}) {
  const q = STATE_QIDS[state.code];
  if (!q) return { ok: false, error: 'no wikidata item for state' };
  const opts = { fetchImpl, timeoutMs };
  const today = isoDay(now);
  const words = placeWords(district);
  // governors: a cached map (governorsFrom) from the caller, else fetched here with the first wave
  const [offices, facts, dist, lsHtml, govMap] = await Promise.all([
    sparql(officesQuery(q), opts),
    sparql(stateQuery(q), opts),
    words ? sparql(districtQuery(q, words), opts) : Promise.resolve({ ok: true, rows: [] }),
    words ? sectionHtml(LOK_SABHA_PAGE, new RegExp(`^${state.name.replace(/[^A-Za-z ]/g, '.')}$`, 'i'), opts) : Promise.resolve(''),
    governors && typeof governors === 'object' ? Promise.resolve(governors) : fetchGovernors(state.type, opts).catch(() => ({})),
  ]);
  if (!offices.ok && !facts.ok) return { ok: false, error: offices.error || facts.error || 'wikidata unavailable' };
  const lead = leadersFrom(offices.rows);
  // Wikidata lacks a Governor office for some states (AP) or keeps a stale holder (Arunachal):
  // the Wikipedia incumbent list overrides it; Wikidata stays the fallback
  const wpGov = governorFor(govMap, state.name);
  if (wpGov) {
    lead.governor = wpGov.name;
    lead.governorTitle = wpGov.title;
  }
  const f = stateFactsFrom(facts.rows, today);
  const d = dist.rows[0] || null;
  const dLabel = d ? val(d, 'dLabel') : '';
  const dArticle = d ? val(d, 'article') : '';
  const wdSrc = { name: 'Wikidata', url: `https://www.wikidata.org/wiki/${q}`, date: today };
  // second wave (needs titles from the first): ministry table, election results, summary
  const [minHtml, mlaHtml, summary] = await Promise.all([
    f.ministry && f.ministry.article ? wpParse(titleOf(f.ministry.article), opts) : Promise.resolve(''),
    words && f.assembly && f.assembly.article ? sectionHtml(titleOf(f.assembly.article), /constituency|constituencies/i, opts) : Promise.resolve(''),
    dArticle ? wpSummary(titleOf(dArticle), opts) : f.article ? wpSummary(titleOf(f.article), opts) : Promise.resolve(''),
  ]);
  const ministers = minHtml ? ministersFrom(minHtml) : [];
  const cmRow = ministers.find(m => /^chief minister/i.test(m.section) || /chief minister/i.test(m.role));
  const deputies = ministers.filter(m => /deputy chief minister/i.test(m.section));
  const chiefMinister = { ...lead.chiefMinister };
  if (!chiefMinister.name && f.headOfGovernment) chiefMinister.name = f.headOfGovernment;
  if (cmRow && !chiefMinister.party && cmRow.party && norm(cmRow.name) === norm(chiefMinister.name)) chiefMinister.party = cmRow.party;
  const deputyCMs = deputies.length ? deputies.map(m => ({ name: m.name, party: m.party, role: m.role })) : lead.deputyCMs;
  const isCmOrDy = m => (cmRow && m === cmRow) || deputies.includes(m);
  const reps = words ? districtReps(mlaHtml ? mlasFrom(mlaHtml) : [], lsHtml ? mpsFrom(lsHtml) : [], words, dLabel) : { mlas: [], mps: [] };
  const assemblyYear = f.assembly ? f.assembly.date.slice(0, 4) : '';
  const lsYear = f.lokSabha ? f.lokSabha.date.slice(0, 4) : '';
  const placeName = dLabel || state.name;
  const overviewBits = [
    summary,
    !summary && f.capital ? `${state.name} capital: ${f.capital}.` : '',
    !dLabel && f.population ? `Population (Wikidata): ${Number(f.population).toLocaleString('en-IN')}.` : '',
  ].filter(Boolean);
  const sources = [
    { url: `https://www.wikidata.org/wiki/${q}`, title: `Wikidata: ${state.name}` },
    ...(f.ministry && f.ministry.article ? [{ url: f.ministry.article, title: `Wikipedia: ${f.ministry.label}` }] : []),
    ...(wpGov ? [{ url: wikiUrl('Governor (India)'), title: 'Wikipedia: Incumbent governors' }] : []),
    ...(words && lsHtml ? [{ url: wikiUrl(LOK_SABHA_PAGE), title: 'Wikipedia: Members of the 18th Lok Sabha' }] : []),
    ...(words && f.assembly && f.assembly.article ? [{ url: f.assembly.article, title: `Wikipedia: ${f.assembly.label}` }] : []),
    ...(dArticle ? [{ url: dArticle, title: `Wikipedia: ${dLabel}` }] : f.article ? [{ url: f.article, title: `Wikipedia: ${state.name}` }] : []),
    { url: 'https://pgportal.gov.in', title: 'CPGRAMS (Government of India)' },
  ];
  const data = {
    origin: 'free',
    asOf: today,
    overview: overviewBits.join(' ').slice(0, 1000),
    leaders: {
      governor: lead.governor ? `${lead.governor}${lead.governorTitle && lead.governorTitle !== 'Governor' ? ` (${lead.governorTitle})` : ''}` : '',
      chiefMinister,
      deputyCMs,
      ministers: ministers.filter(m => !isCmOrDy(m)).map(m => ({ name: m.name, party: m.party, role: m.role })),
    },
    district: {
      headquarters: d ? val(d, 'hqLabel') : '',
      collector: '',
      sp: '',
      policeCommissioner: '',
      mps: reps.mps.map(x => ({ name: x.name, constituency: x.constituency, party: x.party })),
      mlas: reps.mlas.map(x => ({ name: x.name, constituency: x.constituency, party: x.party })),
    },
    offices: [
      ...(d && val(d, 'web') ? [{ name: `${dLabel} official website`, what: 'District administration (Collectorate) portal', address: '', phone: '', website: val(d, 'web').replace(/^http:/, 'https:') }] : []),
      ...(f.website ? [{ name: `Government of ${state.name} portal`, what: 'Official state government website', address: '', phone: '', website: f.website.replace(/^http:/, 'https:') }] : []),
    ],
    schemes: CENTRAL_SCHEMES,
    grievance: GRIEVANCE,
    election: {
      lastAssembly: f.assembly ? `${f.assembly.label} (${f.assembly.date})` : '',
      lastLokSabha: f.lokSabha ? `${f.lokSabha.label} (${f.lokSabha.date})` : '',
      next: [assemblyYear ? `Assembly: due by ${Number(assemblyYear) + 5} (5-year term)` : '', lsYear ? `Lok Sabha: due by ${Number(lsYear) + 5}` : ''].filter(Boolean).join('; '),
      voterHelpline: VOTER.helpline,
      ceoWebsite: VOTER.website,
    },
    departments: [],
    services: CITIZEN_SERVICES,
    helplines: HELPLINES,
    src: {
      overview: summary ? { name: 'Wikipedia', url: dArticle || f.article, date: today } : wdSrc,
      leaders: ministers.length && f.ministry ? { name: 'Wikidata + Wikipedia', url: f.ministry.article, date: today } : wpGov ? { name: 'Wikidata + Wikipedia', url: wikiUrl('Governor (India)'), date: today } : wdSrc,
      district: words ? { name: 'Wikidata + Wikipedia', url: (f.assembly && f.assembly.article) || dArticle || wdSrc.url, date: today } : null,
      election: wdSrc,
      schemes: { name: 'Official .gov.in websites', url: 'https://www.india.gov.in', date: today },
      place: placeName,
    },
  };
  const hasAny = data.leaders.chiefMinister.name || data.leaders.governor || data.overview;
  // governors: the map used (cache it: one Wikipedia section serves every state / UT)
  return hasAny ? { ok: true, data, sources, governors: govMap } : { ok: false, error: 'nothing found in free sources', governors: govMap };
}
