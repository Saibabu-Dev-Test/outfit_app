// Promises tracker (kind 'gprm') from FREE, keyless public sources (no AI, no API key): the English
// Wikipedia article of the election that brought the PRESENT government to power, read through the
// MediaWiki API (en.wikipedia.org/w/api.php, CC BY-SA). Used when grounded Gemini research is out
// of free quota (or not set up).
//   1. The latest held election: "<year> <State> Legislative Assembly election" (centre: "<year>
//      Indian general election") for the last few years; the newest article whose infobox already
//      names the winner (after_party / after_election) is the present government.
//   2. The ruling party (after_party) + its alliance (allianceN of the same partyN) pick the
//      manifesto sections: a section about a manifesto / promises / guarantees whose own heading,
//      a parent heading or a sub-heading names that party or alliance. A {{Main|...}} article of
//      that section is read too when the section itself gives few items.
//   3. Each sentence / list item of those sections that states a concrete promise becomes one
//      promise, with the news source Wikipedia cites for it (the <ref> url + date) or else the
//      Wikipedia section itself (url + the article's last edit date). Every item has a source URL
//      and a date.
// Status is always "no_update": an election article states what was promised, never whether it
// was done, so no status is ever guessed. No promise is invented: nothing found = empty list (the
// app says "no data yet"). Pure parsing helpers are exported for tests; fetchImpl is injectable.
import { getJson } from './http.js';

export const WP_API = 'https://en.wikipedia.org/w/api.php';
export const WP_PAGE = 'https://en.wikipedia.org/wiki/';
export const FREE_PRM_YEARS = 6; // election years looked back (terms are 5 years, + a late election)
export const FREE_PRM_MAX = 40; // promises kept from the free source

const MANIFESTO_RE = /manifesto|promise|guarantee|pledge|sankalp|vision document|nyay patra/i;
// A sentence that states something concrete to be given / done
const CONCRETE_RE = /₹|\brs\.?\s?\d|\blakh\b|\bcrore\b|\bfree\b|\bwill\b|\bshall\b|\bpromis\w*|\bguarantee\w*|\bpension\b|\bschemes?\b|\bassur\w*|\d/i;
// Sentences about the manifesto event itself (release, rally, who unveiled it), not a promise
const META_RE = /\b(unveil\w*|releas\w*|launch\w*|endors\w*|rally|campaign\w*|suggestions?|titled|criticis\w*|criticiz\w*|alleg\w*)\b|manifesto/i;
const PROMISING_RE = /\bpromis(?:ing|ed|es)\s+(?:to\s+)?(.{12,})$/i;

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = n => String(n).padStart(2, '0');

// "2024-05-01" | "17 September 2023" | "September 17, 2023" | "May 2024" | "2024" -> YYYY-MM-DD / YYYY-MM / YYYY | ''
export function normDate(v) {
  const x = String(v || '').trim();
  let m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(x);
  if (m) return m[3] ? `${m[1]}-${m[2]}-${m[3]}` : `${m[1]}-${m[2]}`;
  m = /^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})$/.exec(x);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].slice(0, 3).toLowerCase()])}-${pad(m[1])}`;
  m = /^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(x);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[1].slice(0, 3).toLowerCase()])}-${pad(m[2])}`;
  m = /^([A-Za-z]{3,})\.?\s+(\d{4})$/.exec(x);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return `${m[2]}-${pad(MONTHS[m[1].slice(0, 3).toLowerCase()])}`;
  m = /^(\d{4})$/.exec(x);
  return m ? m[1] : '';
}

const param = (tpl, name) => {
  const m = new RegExp(`\\|\\s*${name}\\s*=\\s*([^|}]*)`, 'i').exec(tpl);
  return m ? m[1].trim() : '';
};

// One cite template -> { url, date, title } (url only https)
export function parseCite(text) {
  const u = param(text, 'url');
  return { url: /^https:\/\/[^\s"'<>]{3,300}$/.test(u) ? u : '', date: normDate(param(text, 'date')), title: param(text, 'title').slice(0, 200) };
}

// Wikilinks / templates / markup -> plain text (refs must be taken out before)
export function plain(wt) {
  let t = String(wt || '');
  t = t.replace(/<!--[\s\S]*?-->/g, '');
  t = t.replace(/\{\{\s*INR(?:Convert)?\s*\|\s*([\d.,]+)[^{}]*\}\}/gi, '₹$1');
  t = t.replace(/\{\{\s*INR\s*\}\}/gi, '₹');
  t = t.replace(/\{\{\s*(?:lang|transl)\s*\|[^|{}]*\|([^|{}]*)[^{}]*\}\}/gi, '$1');
  for (let i = 0; i < 6 && /\{\{[^{}]*\}\}/.test(t); i++) t = t.replace(/\{\{[^{}]*\}\}/g, '');
  t = t.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '');
  t = t.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1');
  t = t.replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1').replace(/\[https?:\/\/\S+\]/g, '');
  t = t.replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  return t.replace(/[ \t]+/g, ' ').trim();
}

// [[Target|Label]] / plain -> names to match (label, link target, abbreviation in brackets)
export function partyNames(v) {
  const raw = String(v || '');
  const out = new Set();
  const m = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(raw);
  if (m) {
    out.add(m[1].trim());
    if (m[2]) out.add(m[2].trim());
  }
  const p = plain(raw).replace(/\(.*?\)/g, '').trim();
  if (p) out.add(p);
  const ab = /\(([A-Z][A-Za-z().]{1,10})\)/.exec(plain(raw));
  if (ab) out.add(ab[1]);
  return [...out].filter(x => x && x.length >= 2 && !/^<!--/.test(x));
}

// Infobox of an election article: winner party + its alliance + head after the election
export function parseInfobox(wt) {
  const t = String(wt || '');
  const field = n => {
    const m = new RegExp(`^\\|[ \\t]*${n}[ \\t]*=[ \\t]*(.*)$`, 'im').exec(t);
    return m ? m[1].replace(/<!--[\s\S]*?-->/g, '').trim() : '';
  };
  const afterParty = field('after_party');
  const afterHead = field('after_election');
  if (!afterParty || !afterHead) return null;
  const names = new Set(partyNames(afterParty));
  let alliance = '';
  for (let i = 1; i <= 12; i++) {
    const p = field(`party${i}`);
    if (!p) continue;
    if (partyNames(p).some(n => names.has(n))) {
      alliance = plain(field(`alliance${i}`));
      partyNames(p).forEach(n => names.add(n));
      break;
    }
  }
  if (alliance) partyNames(alliance).forEach(n => names.add(n));
  const party = plain(afterParty);
  const ab = /\(([A-Z]{2,10})\)$/.exec(alliance);
  if (ab) names.add(ab[1]);
  return { party: alliance && alliance.toLowerCase() !== party.toLowerCase() ? `${party} (${alliance})` : party, head: plain(afterHead), names: [...names] };
}

const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const namesRe = names => {
  const list = (names || []).filter(n => n && n.length >= 2).map(esc);
  return list.length ? new RegExp(`(^|[^A-Za-z])(${list.join('|')})([^A-Za-z]|$)`, 'i') : null;
};

/**
 * Sections to read (pure): manifesto-ish sections that belong to the ruling party / alliance, by
 * their own heading, a parent heading or a sub-heading. sections = MediaWiki parse sections
 * ({ index, level, line, anchor }); a section already covered by a picked parent is skipped.
 */
export function pickSections(sections, names) {
  const re = namesRe(names);
  if (!re) return [];
  const list = (sections || []).filter(x => /^\d+$/.test(String(x.index))).map(x => ({ index: String(x.index), level: Number(x.level) || 2, line: plain(x.line), anchor: x.anchor || '' }));
  const picked = [];
  const stack = [];
  list.forEach(sec => {
    while (stack.length && stack[stack.length - 1].level >= sec.level) stack.pop();
    const chain = [...stack.map(x => x.line), sec.line];
    const manifesto = chain.some(l => MANIFESTO_RE.test(l));
    const ours = chain.some(l => re.test(l));
    const covered = stack.some(x => picked.some(p => p.index === x.index));
    // own or parent heading names the party (TG: Campaigns > INC > Manifesto; AP: Manifestos > Kutami)
    // ("Manifestos" > other party's sub-heading is never ours; the party's own sub-heading is)
    if (manifesto && ours && !covered) picked.push(sec);
    stack.push(sec);
  });
  return picked.slice(0, 4);
}

const area = (label, text) => {
  const x = `${label} ${text}`.toLowerCase();
  if (/farm|agri|paddy|crop|kisan|annadata|msp\b/.test(x)) return 'farmers';
  if (/women|woman|girl|mahila|nari|mahalakshmi/.test(x)) return 'women';
  if (/health|hospital|medical|insurance|arogya|ayushman/.test(x)) return 'health';
  if (/school|education|student|college|universit|scholarship/.test(x)) return 'education';
  if (/youth|job|employ|unemploy|skill|yuva/.test(x)) return 'youth';
  if (/road|power|electric|housing|house|water|metro|rail|airport|port|infra|capital|irrigation/.test(x)) return 'infrastructure';
  if (/pension|welfare|ration|cylinder|lpg|poor|garib|dole/.test(x)) return 'welfare';
  return 'other';
};

// Initials ("N. Chandrababu") and short abbreviations ("250 sq. yards", "Rs. 500") never end a sentence
const ABBR_END = /(?:^|[\s(])(?:[A-Z]|sq|rs|dr|mr|mrs|ms|st|no|nos|vs|etc|approx|govt|lt|sri|smt|hon|ft|km|yrs?)\.(?:\s*\u0001\d+\u0001)*$/i;
export function splitSentences(text) {
  const raw = String(text || '').split(/(?<=[.!?](?:\s*\u0001\d+\u0001)*)\s+(?=[A-Z0-9₹"'\u0001])/);
  const out = [];
  raw.forEach(part => {
    if (out.length && ABBR_END.test(out[out.length - 1])) out[out.length - 1] += ` ${part}`;
    else out.push(part);
  });
  return out;
}

/**
 * Promises in one section's wikitext (pure). Each list item or sentence that states a concrete
 * promise -> { area, text, status: 'no_update', ref, refDate }; ref = the cited source of that
 * sentence (else the next citation in the same paragraph), else fallback {url, date}.
 */
export function extractPromises(wt, fallback, namedRefs = {}) {
  const refs = { ...namedRefs };
  const out = [];
  // named refs defined anywhere in the text first (<ref name="x" /> reuses them)
  String(wt || '').replace(/<ref\s+name\s*=\s*"?([^">/]+)"?\s*>([\s\S]*?)<\/ref>/gi, (_, n, body) => {
    refs[n.trim()] = parseCite(body);
    return '';
  });
  const lines = String(wt || '').split('\n');
  for (const raw of lines) {
    if (/^\s*(=|\{\||\||!|\{\{\s*(main|see also|further|multiple image|quote box))/i.test(raw) || !raw.trim()) continue;
    const found = [];
    let line = raw.replace(/<ref([^>]*?)\/>/gi, (_, attrs) => {
      const n = /name\s*=\s*"?([^"/]+)"?/i.exec(attrs);
      const r = n && refs[n[1].trim()];
      found.push(r || { url: '', date: '' });
      return ` \u0001${found.length - 1}\u0001 `;
    });
    line = line.replace(/<ref[^>]*>([\s\S]*?)<\/ref>/gi, (_, body) => {
      found.push(parseCite(body));
      return ` \u0001${found.length - 1}\u0001 `;
    });
    const bullet = /^\s*[*#]+\s*/.test(line);
    // bold label at the start ("'''Agriculture''': ...") gives the area
    const lab = /^\s*[*#]*\s*'''([^']{2,40})'''\s*:?/.exec(line);
    const label = lab ? plain(lab[1]) : '';
    const body = plain(line.replace(/^\s*[*#]+\s*/, '').replace(/^\s*'''[^']{2,40}'''\s*:?/, ''));
    // sentences: split after . ! ? (followed by citation markers and a capital / ₹ / quote)
    const parts = splitSentences(body);
    const markersIn = x => [...x.matchAll(/\u0001(\d+)\u0001/g)].map(m => found[Number(m[1])]).filter(r => r && r.url);
    const lineRefs = markersIn(body);
    for (const part of parts) {
      let text = part.replace(/\s*\u0001\d+\u0001\s*/g, ' ').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const pm = PROMISING_RE.exec(text);
      if (pm) text = pm[1].replace(/[.;]+$/, '').trim();
      else if (!bullet && META_RE.test(text)) continue;
      text = text.replace(/^[,;:\s-]+/, '').replace(/\s+([.,;:])/g, '$1');
      if (text.length < 15 || text.length > 300 || !CONCRETE_RE.test(text)) continue;
      text = text[0].toUpperCase() + text.slice(1);
      const own = markersIn(part);
      const r = own[0] || lineRefs.find(x => x) || null;
      const ref = r && r.url ? r.url : fallback.url;
      const refDate = (r && r.url && r.date) || fallback.date;
      if (!ref || !refDate) continue;
      out.push({ area: area(label, text), text, status: 'no_update', fact: '', source: '', date: '', ref, refDate });
    }
  }
  return out;
}

const wpUrl = (title, anchor = '') => `${WP_PAGE}${encodeURIComponent(String(title).replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':')}${anchor ? `#${encodeURIComponent(anchor).replace(/%20/g, '_')}` : ''}`;

const electionTitles = (st, year) => {
  const out = [];
  for (let y = year; y > year - FREE_PRM_YEARS; y--) {
    out.push(st.type === 'centre' ? `${y} Indian general election` : `${y} ${st.name} Legislative Assembly election`);
  }
  return out;
};

async function sectionText(title, section, opts) {
  const r = await getJson(
    `${WP_API}?action=query&format=json&formatversion=2&redirects=1&prop=revisions&rvprop=content|timestamp&rvslots=main&rvsection=${encodeURIComponent(section)}&titles=${encodeURIComponent(title)}&origin=*`,
    opts,
  );
  const p = r.ok && r.data && r.data.query && r.data.query.pages && r.data.query.pages[0];
  const rev = p && !p.missing && p.revisions && p.revisions[0];
  return rev ? { title: p.title, text: (rev.slots && rev.slots.main && rev.slots.main.content) || '', date: String(rev.timestamp || '').slice(0, 10) } : null;
}

/**
 * fetchPromisesFree(st, { fetchImpl, now, timeoutMs }) -> { ok: true, data (raw promises shape for
 * cleanPromises, origin 'free'), sources } | { ok: false, error }
 */
export async function fetchPromisesFree(st, { fetchImpl = fetch, now = Date.now(), timeoutMs = 6000 } = {}) {
  const opts = { fetchImpl, timeoutMs };
  const year = new Date(now).getUTCFullYear();
  const titles = electionTitles(st, year);
  const ex = await getJson(`${WP_API}?action=query&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(titles.join('|'))}&origin=*`, opts);
  if (!ex.ok) return { ok: false, error: `wikipedia: ${ex.error}` };
  const have = new Set(((ex.data && ex.data.query && ex.data.query.pages) || []).filter(p => !p.missing && !p.invalid).map(p => p.title));
  let art = null;
  for (const title of titles.filter(x => have.has(x)).slice(0, 3)) {
    const s0 = await sectionText(title, 0, opts);
    const info = s0 && parseInfobox(s0.text);
    if (info) {
      art = { ...s0, info, year: /^\d{4}/.exec(title)[0] };
      break; // newest election whose winner is known = the present government
    }
  }
  if (!art) return { ok: false, error: 'no held election article found' };
  const secs = await getJson(`${WP_API}?action=parse&format=json&formatversion=2&redirects=1&prop=sections&page=${encodeURIComponent(art.title)}&origin=*`, opts);
  const picked = pickSections(secs.ok && secs.data && secs.data.parse ? secs.data.parse.sections : [], art.info.names);
  const promises = [];
  const sources = [{ url: wpUrl(art.title), title: `Wikipedia: ${art.title}` }];
  const seen = new Set();
  const add = list =>
    list.forEach(p => {
      const k = p.text.toLowerCase();
      if (!seen.has(k) && promises.length < FREE_PRM_MAX) {
        seen.add(k);
        promises.push(p);
      }
    });
  let manifestoUrl = '';
  for (const sec of picked) {
    const x = await sectionText(art.title, sec.index, opts);
    if (!x) continue;
    const secUrl = wpUrl(art.title, sec.anchor || sec.line);
    manifestoUrl = manifestoUrl || secUrl;
    const items = extractPromises(x.text, { url: secUrl, date: x.date });
    add(items);
    // {{Main|Article#Section}}: the dedicated article, when the section itself gives little
    const main = /\{\{\s*main\s*\|\s*([^|}#]+)(?:#([^|}]+))?/i.exec(x.text);
    if (main && items.length < 3 && promises.length < FREE_PRM_MAX) {
      const mt = main[1].trim();
      const ms = await getJson(`${WP_API}?action=parse&format=json&formatversion=2&redirects=1&prop=sections&page=${encodeURIComponent(mt)}&origin=*`, opts);
      const list = (ms.ok && ms.data && ms.data.parse && ms.data.parse.sections) || [];
      const want = main[2] ? list.find(z => plain(z.line).toLowerCase() === main[2].trim().toLowerCase()) : list.find(z => MANIFESTO_RE.test(plain(z.line)));
      if (want && /^\d+$/.test(String(want.index))) {
        const y = await sectionText(mt, want.index, opts);
        if (y) {
          const u = wpUrl(y.title || mt, want.anchor || want.line);
          add(extractPromises(y.text, { url: u, date: y.date }));
          sources.push({ url: u, title: `Wikipedia: ${y.title || mt}` });
        }
      }
    }
  }
  promises.forEach(p => {
    if (!sources.some(z => z.url === p.ref) && sources.length < 12) sources.push({ url: p.ref, title: '' });
  });
  return {
    ok: true,
    data: {
      origin: 'free',
      asOf: new Date(now).toISOString().slice(0, 7),
      govt: { party: art.info.party, head: art.info.head, year: art.year, term: '', source: manifestoUrl || wpUrl(art.title) },
      promises,
    },
    sources,
  };
}
