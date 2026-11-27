// Promises tracker (kind 'gprm') from Audit India (https://auditindia.org), a FREE, keyless public
// source with delivery statuses. No AI, no API key, no JSON API (none is published), so the static
// HTML pages are read politely: robots.txt (checked 2026-11-26) is "User-Agent: * / Allow: /",
// every request carries our User-Agent + contact (FREE_UA), pages are cached (civic_text_cache via
// opts.cache, a week) and fetched one after another with a gap (opts.gapMs).
// Terms of Use (https://auditindia.org/en/terms/, dated 21 Aug 2026): "Compilations on this site
// (directory listings, tables, extracts) may be reused for journalism, research, and education with
// attribution to Audit India and to the primary source." So every promise keeps the Audit India
// page it came from (source) AND the primary source when the page gives one (primary); the app
// shows "Source: Audit India (auditindia.org)" plus the primary source link.
//   States / UTs: https://auditindia.org/en/states/<slug>/ , section#promises: one <details> card per
//     government term ("TDP · 2024", manifesto title, "◌ graded, evidence not yet sourced"), each
//     promise = text + delivery label (Delivered / Partly delivered / Not delivered) + explanation.
//     Those state grades are Audit India's own label "graded, evidence not yet sourced": the flag
//     (graded: true) is carried to the app, which shows a small note. They cite no primary source.
//   Union Government: https://auditindia.org/en/fact-checks/ lists one page per manifesto promise
//     (/en/fact-checks/promise-<year>-<slug>/); each page has a ClaimReview JSON-LD (claim text, party,
//     date promised, the manifesto URL = primary source), a "Delivery" label and a summary
//     (meta description). Pages are read a few per call (opts.maxPages) and cached, so the full list
//     builds up over cron runs (data.aiPartial while some are missing).
// Status mapping (their wording is kept in statusLabel): Delivered -> done, Partly delivered /
// in progress -> in_progress, Not delivered -> not_done, anything else (Too early to assess,
// Unverifiable) -> no_update. Only the newest government term on a page is used (the PRESENT
// government). Nothing is invented: a page that cannot be read or parsed gives no items.
import { FREE_UA, sleep } from './http.js';
import { promiseArea } from './promises.js';

export const AI_BASE = 'https://auditindia.org';
export const AI_TERMS_URL = 'https://auditindia.org/en/terms/';
export const AI_ATTRIBUTION = 'Source: Audit India (auditindia.org)';
export const AI_CACHE_MS = 7 * 24 * 3600 * 1000; // cached pages / parsed promise pages
export const AI_GAP_MS = 1000; // between two Audit India requests (polite, low rate)
export const AI_MAX = 60; // promises kept per government
export const AI_GRADED_NOTE = 'graded, evidence not yet sourced';

// State code -> Audit India slug (their slugs differ from the plain names for a few)
const SLUG_FIX = { DL: 'delhi-nct', JK: 'jammu-kashmir' };
export const aiSlug = st =>
  SLUG_FIX[st.code] ||
  String(st.name || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#x27': "'", '#39': "'" };
export const decode = t =>
  String(t || '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (ENT[e.toLowerCase()] !== undefined) return ENT[e.toLowerCase()];
      if (/^#x/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (/^#\d/.test(e)) return String.fromCodePoint(Number(e.slice(1)));
      return m;
    });
// HTML fragment -> plain text (comments, tags out; entities decoded; spaces collapsed)
export const text = h =>
  decode(
    String(h || '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
// "27 Aug 2026" | "24 Sept 2026" -> "2026-08-27" ('' when not a date)
export const dayOf = v => {
  const m = /(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})/.exec(String(v || ''));
  const mo = m && MONTHS[m[2].slice(0, 3).toLowerCase()];
  return mo ? `${m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
};

// Their delivery wording -> our status code (pure: tested)
export const mapStatus = label => {
  const x = String(label || '').toLowerCase().trim();
  if (/^not\s+delivered|broken|not\s+started|abandoned/.test(x)) return 'not_done';
  if (/partly|partial|in\s+progress|on\s+track|under\s+way|underway/.test(x)) return 'in_progress';
  if (/^delivered|^fulfilled|^done|^achieved/.test(x)) return 'done';
  return 'no_update';
};

const httpsUrl = u => (/^https:\/\/[^\s"'<>]{3,300}$/.test(String(u || '').trim()) ? String(u).trim() : '');
// Evaluative words never reach the app (research.js OPINION_RE does the same on every item); an
// explanation using them is replaced by a neutral line naming Audit India's own label
const OPINION_RE =
  /\b(best|better|worse|worst|superior|inferior|excellent|outstanding|failed|failure|failures|corrupt|corruption|scam|praised|criticised|criticized|landmark|historic|visionary|betray(?:ed|al)?|mismanag\w*|incompetent|winner|loser)\b/i;
const neutralFact = (explanation, label) => {
  const e = String(explanation || '').trim();
  if (e && !OPINION_RE.test(e)) return e.length > 300 ? `${e.slice(0, 297).replace(/\s+\S*$/, '')}…` : e;
  return label ? `Audit India: ${label}` : '';
};

// "Data current to 27 Aug 2026" in the site footer (the date their compilation is current to)
export const dataDate = html => dayOf((/Data current to\s*(?:<!--[^>]*-->)?\s*(\d{1,2}\s+[A-Za-z]{3,}\.?\s+\d{4})/.exec(String(html || '')) || [])[1]);

/**
 * One state / UT page -> its government terms (pure: tested):
 * [{ party, year, title, graded, promises: [{ category, text, label, explanation, primary }] }]
 * newest year first.
 */
export function parseStatePage(html) {
  const s = String(html || '');
  const i = s.indexOf('<section id="promises"');
  if (i < 0) return [];
  const j = s.indexOf('</section>', i);
  const seg = s.slice(i, j < 0 ? undefined : j);
  const groups = [];
  seg
    .split('<details')
    .slice(1)
    .forEach(block => {
      const sm = /<summary[\s\S]*?<\/summary>/.exec(block);
      const summary = sm ? sm[0] : '';
      const head = text((/<span class="t-section[^"]*">([\s\S]*?)<\/span>/.exec(summary) || [])[1]);
      const hm = /^(.+?)\s*·\s*((?:19|20)\d{2})$/.exec(head);
      if (!hm) return;
      const title = text((/<span class="mt-1 block[^"]*">([\s\S]*?)<\/span>/.exec(summary) || [])[1]);
      const graded = summary.includes(AI_GRADED_NOTE);
      const body = sm ? block.slice(sm.index + sm[0].length) : block;
      const promises = [];
      let category = '';
      const re = /<h3[^>]*>([\s\S]*?)<\/h3>|<li[^>]*>([\s\S]*?)<\/li>/g;
      let m;
      while ((m = re.exec(body))) {
        if (m[1] !== undefined) {
          category = text(m[1]);
          continue;
        }
        const li = m[2];
        const t = text((/<p class="[^"]*font-medium[^"]*">([\s\S]*?)<\/p>/.exec(li) || [])[1]);
        const label = text((/<span class="figure rounded-full[^"]*">([\s\S]*?)<\/span>/.exec(li) || [])[1]);
        const explanation = text((/<p class="mt-2[^"]*">([\s\S]*?)<\/p>/.exec(li) || [])[1]);
        const primary = ((li.match(/<a [^>]*href="(https:\/\/[^"]+)"/g) || []).map(a => httpsUrl(decode(/href="([^"]+)"/.exec(a)[1]))).filter(u => u && !/auditindia\.org/.test(u)))[0] || '';
        if (t && label) promises.push({ category, text: t, label, explanation, primary });
      }
      groups.push({ party: hm[1].trim(), year: hm[2], title, graded, promises });
    });
  return groups.sort((a, b) => Number(b.year) - Number(a.year));
}

// Union Government promise pages listed on /en/fact-checks/ (pure: tested): { year: [paths] }
export function parseFactCheckList(html) {
  const out = {};
  const seen = new Set();
  String(html || '').replace(/href="(\/en\/fact-checks\/promise-((?:19|20)\d{2})-[a-z0-9-]+\/)"/g, (_, path, year) => {
    if (!seen.has(path)) {
      seen.add(path);
      (out[year] = out[year] || []).push(path);
    }
    return '';
  });
  return out;
}

/**
 * One Union Government promise page (pure: tested) -> { text, party, promised, primary, label,
 * explanation, checked } | null. Text / party / date / primary source from the ClaimReview JSON-LD.
 */
export function parseFactCheckPage(html) {
  const s = String(html || '');
  let claim = null;
  const ld = s.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) || [];
  for (const tag of ld) {
    try {
      const j = JSON.parse(tag.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
      const list = Array.isArray(j) ? j : [j];
      claim = list.find(x => x && x['@type'] === 'ClaimReview') || claim;
    } catch (e) {
      // not JSON: skip
    }
  }
  const t = claim ? String(claim.claimReviewed || '').replace(/\s+/g, ' ').trim() : '';
  if (!t) return null;
  const item = (claim && claim.itemReviewed) || {};
  const lm = /Delivery<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/.exec(s);
  const label = lm ? text(lm[1].replace(/<span aria-hidden="true">[\s\S]*?<\/span>/g, '')) : '';
  const desc = decode((/<meta name="description" content="([^"]*)"/.exec(s) || [])[1] || '');
  const checked = dayOf((/checked\s+(?:<!--[^>]*-->)?\s*(\d{1,2}\s+[A-Za-z]{3,}\.?\s+\d{4})/.exec(s) || [])[1]) || String(claim.dateModified || '').slice(0, 10);
  return {
    text: t,
    party: String((item.author && item.author.name) || '').trim(),
    promised: String(item.datePublished || '').slice(0, 10),
    primary: httpsUrl(item.appearance && item.appearance.url),
    label,
    explanation: desc.replace(/\s+/g, ' ').trim(),
    checked,
  };
}

// One Audit India item -> the raw promise shape cleanPromises (research.js) reads
const toPromise = ({ text: t, label, explanation, primary, category = '' }, { url, date, year, graded }) => ({
  area: promiseArea(category, t),
  text: t.length > 300 ? `${t.slice(0, 297).replace(/\s+\S*$/, '')}…` : t,
  status: mapStatus(label),
  statusLabel: label,
  fact: neutralFact(explanation, label),
  source: url,
  date,
  ref: primary || url,
  refDate: year,
  by: 'auditindia',
  graded: !!graded,
  primary: primary || '',
});

async function getText(url, { fetchImpl, timeoutMs }) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': FREE_UA, Accept: 'text/html' }, signal: ctl ? ctl.signal : undefined });
    if (!res || !res.ok) return { ok: false, error: `http ${res ? res.status : 0}` };
    return { ok: true, text: await res.text() };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'timeout' : String((e && e.message) || e).slice(0, 120) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * fetchPromisesAuditIndia(st, { fetchImpl, now, timeoutMs, cache, maxPages, gapMs, sleepImpl })
 * -> { ok: true, data (raw promises shape, origin 'free'), sources, partial, year, party }
 *  | { ok: false, error }
 * cache: { get(key) -> Promise<{ text, at } | null>, set(key, text) } (civic_text_cache in research.js);
 * maxPages: Union Government promise pages fetched over the network in this call (cached ones are free).
 */
export async function fetchPromisesAuditIndia(
  st,
  { fetchImpl = fetch, now = Date.now(), timeoutMs = 8000, cache = null, maxPages = 12, gapMs = AI_GAP_MS, sleepImpl = sleep } = {},
) {
  const opts = { fetchImpl, timeoutMs };
  let fetched = 0;
  const cached = async key => {
    if (!cache) return null;
    const c = await cache.get(key).catch(() => null);
    return c && now - Number(c.at) < AI_CACHE_MS ? c.text : null;
  };
  const get = async url => {
    if (fetched > 0 && gapMs) await sleepImpl(gapMs);
    fetched += 1;
    return getText(url, opts);
  };
  const sources = [
    { url: AI_BASE, title: AI_ATTRIBUTION },
    { url: AI_TERMS_URL, title: 'Audit India Terms of Use (reuse with attribution)' },
  ];
  if (st.type !== 'centre') {
    const path = `/en/states/${aiSlug(st)}/`;
    const r = await get(`${AI_BASE}${path}`);
    if (!r.ok) return { ok: false, error: `auditindia: ${r.error}` };
    const groups = parseStatePage(r.text);
    const g = groups.find(x => x.promises.length);
    if (!g) return { ok: false, error: 'auditindia: no promises on the state page' };
    const url = `${AI_BASE}${path}#promises`;
    const date = dataDate(r.text) || new Date(now).toISOString().slice(0, 10);
    sources.unshift({ url, title: `Audit India: ${st.name} · ${g.party} ${g.year}` });
    return {
      ok: true,
      year: g.year,
      party: g.party,
      partial: false,
      sources,
      data: {
        origin: 'free',
        asOf: date.slice(0, 7),
        credits: [{ name: 'Audit India', url: AI_BASE, terms: AI_TERMS_URL }],
        govt: { party: g.party, head: '', year: g.year, term: '', source: url, title: g.title },
        promises: g.promises.slice(0, AI_MAX).map(p => toPromise(p, { url, date, year: g.year, graded: g.graded })),
      },
    };
  }
  // Union Government: the list page, then the newest year's promise pages (cached, a few per call)
  let byYear = null;
  const hitList = await cached('list:/en/fact-checks/');
  if (hitList !== null) {
    try {
      byYear = JSON.parse(hitList);
    } catch (e) {
      byYear = null;
    }
  }
  if (!byYear || !Object.keys(byYear).length) {
    const list = await get(`${AI_BASE}/en/fact-checks/`);
    if (!list.ok) return { ok: false, error: `auditindia: ${list.error}` };
    byYear = parseFactCheckList(list.text);
    if (cache && Object.keys(byYear).length) await cache.set('list:/en/fact-checks/', JSON.stringify(byYear)).catch(() => undefined);
  }
  const year = Object.keys(byYear).sort().pop();
  if (!year) return { ok: false, error: 'auditindia: no promise pages listed' };
  const paths = byYear[year].slice(0, AI_MAX);
  const promises = [];
  let missing = 0;
  let details = 0; // promise pages fetched over the network in this call
  let party = '';
  let primaryAny = '';
  for (const path of paths) {
    const key = `fc:${path}`;
    const hit = await cached(key);
    let item = null;
    if (hit !== null) {
      try {
        item = JSON.parse(hit);
      } catch (e) {
        item = null;
      }
    } else if (details < maxPages) {
      details += 1;
      const r = await get(`${AI_BASE}${path}`);
      item = r.ok ? parseFactCheckPage(r.text) : null;
      if (r.ok && cache) await cache.set(key, JSON.stringify(item || {})).catch(() => undefined);
      if (!r.ok) missing += 1;
    } else {
      missing += 1;
      continue;
    }
    if (item && item.text) {
      const url = `${AI_BASE}${path}`;
      party = party || item.party;
      primaryAny = primaryAny || item.primary;
      promises.push(toPromise(item, { url, date: item.checked || '', year: (item.promised || year).slice(0, 4) || year, graded: false }));
    }
  }
  if (!promises.length) return { ok: false, error: missing ? 'auditindia: promise pages not read yet' : 'auditindia: no promises parsed' };
  const listUrl = `${AI_BASE}/en/fact-checks/`;
  sources.unshift({ url: `${AI_BASE}/en/promises/`, title: `Audit India: Union Government · ${party || ''} ${year}`.replace(/\s+/g, ' ') });
  if (primaryAny) sources.push({ url: primaryAny, title: 'Primary source (manifesto)' });
  return {
    ok: true,
    year,
    party,
    partial: missing > 0,
    sources,
    data: {
      origin: 'free',
      asOf: new Date(now).toISOString().slice(0, 7),
      credits: [{ name: 'Audit India', url: AI_BASE, terms: AI_TERMS_URL }],
      govt: { party, head: '', year, term: '', source: primaryAny || listUrl },
      promises,
      ...(missing > 0 ? { aiPartial: true } : {}),
    },
  };
}

// Two promise texts are the same promise (pure: tested): one contains the other, or most of their
// meaningful words are shared (Audit India + Wikipedia word the same manifesto line differently)
const STOP = new Set(['the', 'and', 'for', 'to', 'of', 'a', 'an', 'in', 'on', 'all', 'every', 'will', 'with', 'per', 'by', 'be', 'up', 'from', 'at', 'or', 'as', 'is', 'are', 'its', 'their']);
const words = t =>
  String(t || '')
    .toLowerCase()
    .replace(/[^a-z0-9₹\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP.has(w));
export const samePromise = (a, b) => {
  const x = words(a).join(' ');
  const y = words(b).join(' ');
  if (!x || !y) return false;
  if (x.length >= 12 && y.length >= 12 && (x.includes(y) || y.includes(x))) return true;
  const A = new Set(words(a));
  const B = new Set(words(b));
  const common = [...A].filter(w => B.has(w)).length;
  return common >= 3 && common / Math.min(A.size, B.size) >= 0.6;
};

// Audit India items first (they carry a delivery status), then the Wikipedia items that are not the
// same promise (pure: tested). Nothing is changed or invented, only duplicates dropped.
export function mergePromises(primary, extra, max = 80) {
  const out = [...(primary || [])];
  (extra || []).forEach(p => {
    if (out.length < max && p && p.text && !out.some(q => samePromise(q.text, p.text))) out.push(p);
  });
  return out.slice(0, max);
}
