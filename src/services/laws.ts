// Laws tab data: one flat, searchable list of law sections built from
//  - data/laws/bns.generated.ts: every BNS offence in the BNSS First Schedule (official), with old IPC
//  - data/laws/curated.ts: the most used sections of the other acts + plain meanings for key BNS ones
// Pure functions only (tested in __tests__/laws.test.ts).
import { ACTS, ActId, actById } from '../data/laws/acts';
import { BNS_ROWS } from '../data/laws/bns.generated';
import { BNS_DETAILS, CURATED } from '../data/laws/curated';

export interface LawSection {
  id: string; // unique, e.g. 'BNS-318(4)' or 'IT-66C'
  act: ActId;
  section: string; // as shown, e.g. '318(4)'
  title: string;
  summary: string; // one line
  punishment: string;
  cognizable?: string;
  bailable?: string;
  court?: string;
  timeLimit?: string;
  meaning?: string;
  examples?: string[];
  oldRef?: string; // 'IPC 420'
  source: string;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

// Longest jail term in years from a Schedule punishment text. null = death / life (no limit),
// 0 = fine only, NaN = unknown ("Same as for offence abetted", etc.)
export const maxJailYears = (punishment: string): number | null => {
  const p = (punishment || '').toLowerCase();
  if (/death|imprisonment for life|for life/.test(p)) return null;
  let best = -1;
  const re = /(\d+(?:\.\d+)?)\s*(year|month|day|hour)s?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(p))) {
    const n = Number(m[1]);
    const y = m[2] === 'year' ? n : m[2] === 'month' ? n / 12 : m[2] === 'day' ? n / 365 : n / (365 * 24);
    if (y > best) best = y;
  }
  if (best >= 0) return best;
  if (/fine/.test(p) && !/imprisonment|same as|according/.test(p)) return 0;
  return NaN;
};

// BNSS s.514: period of limitation for taking cognizance, from the punishment
export const limitationFor = (punishment: string): string => {
  const y = maxJailYears(punishment);
  if (y === null) return 'No time limit to start the case (BNSS s.514 does not apply to offences punishable with more than 3 years).';
  if (Number.isNaN(y)) return 'Same time limit as the main offence (BNSS s.514).';
  if (y === 0) return 'Court must take cognizance within 6 months (fine only, BNSS s.514).';
  if (y <= 1) return 'Court must take cognizance within 1 year (BNSS s.514); delay can be condoned (s.517).';
  if (y <= 3) return 'Court must take cognizance within 3 years (BNSS s.514); delay can be condoned (s.517).';
  return 'No time limit to start the case (BNSS s.514 applies only up to 3 years jail).';
};

const bnsSource = actById('BNS').source;

const fromBns = (): LawSection[] => {
  const seen: Record<string, number> = {};
  return BNS_ROWS.map(([sec, title, offence, punishment, cog, bail, court, ipc]) => {
    const cont = sec.endsWith('~');
    const shown = sec.replace(/~+$/, '');
    const n = (seen[shown] = (seen[shown] || 0) + 1);
    const main = (shown.match(/^\d+/) || [''])[0];
    const detail = BNS_DETAILS[main];
    return {
      id: `BNS-${shown}${n > 1 || cont ? `-${n}` : ''}`,
      act: 'BNS' as ActId,
      section: shown,
      title: clean(title || offence),
      summary: clean(offence),
      punishment: clean(punishment),
      cognizable: clean(cog),
      bailable: clean(bail),
      court: clean(court),
      timeLimit: limitationFor(punishment),
      meaning: detail?.meaning,
      examples: detail?.examples,
      oldRef: ipc ? `IPC ${ipc.split(',').join(', ')}` : undefined,
      source: bnsSource,
    };
  });
};

let cache: LawSection[] | null = null;

export const allSections = (): LawSection[] => {
  if (cache) return cache;
  const curated: LawSection[] = CURATED.map(c => ({
    id: `${c.act}-${c.section.replace(/\s+/g, '')}`,
    act: c.act,
    section: c.section,
    title: c.title,
    summary: c.summary,
    punishment: c.punishment,
    cognizable: c.cognizable,
    bailable: c.bailable,
    court: c.court,
    timeLimit: c.timeLimit,
    meaning: c.meaning,
    examples: c.examples,
    oldRef: c.oldRef,
    source: actById(c.act).source,
  }));
  cache = [...fromBns(), ...curated];
  return cache;
};

export const sectionById = (id: string): LawSection | null => allSections().find(s => s.id === id) || null;

export const countByAct = (): Record<ActId, number> => {
  const out = {} as Record<ActId, number>;
  ACTS.forEach(a => (out[a.id] = 0));
  allSections().forEach(s => (out[s.act] += 1));
  return out;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9()]+/g, ' ').trim();

// Search by words, section number ("318", "318(4)") or old IPC number ("ipc 420", "420").
export const searchLaws = (query: string, act: ActId | 'ALL' = 'ALL', max = 200): LawSection[] => {
  const list = allSections().filter(s => act === 'ALL' || s.act === act);
  const q = norm(query || '');
  if (!q) return list.slice(0, max);
  const words = q.split(' ').filter(Boolean);
  const scored: { s: LawSection; score: number }[] = [];
  for (const s of list) {
    const hay = norm(`${s.section} ${s.title} ${s.summary} ${s.meaning || ''} ${s.oldRef || ''} ${s.act}`);
    if (!words.every(w => hay.includes(w))) continue;
    let score = 0;
    const secNorm = norm(s.section);
    // "318" matches 318, 318(1), 318(4)...; "ipc 420" is an old-law lookup, so old refs win there
    const base = secNorm.split(/[ (]/)[0];
    const ipcQuery = /^ipc /.test(q);
    if (!ipcQuery && (secNorm === q || base === q)) score += 100;
    if (!ipcQuery && secNorm.startsWith(q)) score += 40;
    if (s.oldRef && norm(s.oldRef).split(' ').includes(q.replace(/^ipc /, ''))) score += ipcQuery ? 150 : 60;
    if (norm(s.title).includes(q)) score += 20;
    if (s.meaning) score += 5;
    scored.push({ s, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(x => x.s);
};
