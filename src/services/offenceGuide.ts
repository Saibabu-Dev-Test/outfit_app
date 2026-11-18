// Laws tab > Offence guide (BNS 2023). Pure functions only (tested in __tests__/offenceGuide.test.ts).
//  - Joins each hand-written guide entry (data/laws/offenceGuide.ts: simple title + explanation in
//    EN / TE / HI) with the official BNSS First Schedule rows of its BNS sections (services/laws.ts),
//    so section, punishment, cognizable, bailable and old IPC are exactly as published.
//  - Reads the official punishment text into a simple jail range + fine line (deterministic, no AI).
//  - "How to file a police complaint" steps from the BNSS 2023 (s.173, 174, 175, 223), chosen by the
//    row's official cognizable / non-cognizable classification.
import { BNSS_SOURCE, BNS_SOURCE, OFFENCE_CATEGORIES, OFFENCE_GUIDE, OffenceCategory, OffenceEntry, SCHEDULE_SOURCE, Tri } from '../data/laws/offenceGuide';
import { LawSection, allSections } from './laws';

export type GuideLang = 'en' | 'te' | 'hi';
export type Flag = 'yes' | 'no' | 'depends' | 'cond';

export interface OffenceGuideItem extends OffenceEntry {
  rows: LawSection[]; // official Schedule rows (BNS)
  sources: { bns: string; bnss: string; schedule: string };
}

const baseOf = (section: string): number => Number((section.match(/^\d+/) || ['0'])[0]);

let cache: OffenceGuideItem[] | null = null;

export const offenceGuide = (): OffenceGuideItem[] => {
  if (cache) return cache;
  const bns = allSections().filter(s => s.act === 'BNS');
  cache = OFFENCE_GUIDE.map(e => ({
    ...e,
    rows: bns.filter(s => e.bases.includes(baseOf(s.section))),
    sources: { bns: BNS_SOURCE, bnss: BNSS_SOURCE, schedule: SCHEDULE_SOURCE },
  }));
  return cache;
};

export const categoryLabel = (c: OffenceCategory, lang: GuideLang): string => OFFENCE_CATEGORIES[c][lang];

export const triText = (t: Tri, lang: GuideLang): string => t[lang] || t.en;

// ── Official classification -> simple flags ──
export const cognizableFlag = (cog?: string): Flag => {
  const c = (cog || '').trim().toLowerCase();
  if (!c || c.startsWith('according')) return 'depends';
  if (/^non-?\s?cognizable/.test(c)) return 'no';
  if (c.startsWith('cognizable')) return /\bif\b|\bonly\b/.test(c) ? 'cond' : 'yes';
  return 'depends';
};

export const bailableFlag = (bail?: string): Flag => {
  const b = (bail || '').trim().toLowerCase();
  if (!b || b.startsWith('according')) return 'depends';
  if (/^non-?\s?bailable/.test(b)) return 'no';
  if (b.startsWith('bailable')) return 'yes';
  return 'depends';
};

// ── Punishment text -> jail range + fine ──
export interface Punishment {
  minYears: number | null;
  maxYears: number | null; // null = no number stated (life / death / fine only / relative)
  life: boolean;
  lifeRest: boolean; // "remainder of that person's natural life"
  death: boolean;
  fine: boolean;
  fineAmount: string; // '₹10,000' / '₹10 lakh' when the text states an amount
  fineOnly: boolean;
  orBoth: boolean; // "or fine, or both"
  community: boolean;
  relative: boolean; // "Same as for offence abetted", "one-half of the longest term", ...
}

const toYears = (n: number, unit: string) => (unit.startsWith('year') ? n : unit.startsWith('month') ? n / 12 : unit.startsWith('day') ? n / 365 : n / (365 * 24));

export const parsePunishment = (text: string): Punishment => {
  const p = (text || '').toLowerCase().replace(/\s+/g, ' ');
  const relative = /same as|according as|one-fourth|one-half|one-eighth|one half|longest term/.test(p);
  const death = /\bdeath\b/.test(p);
  const lifeRest = /remainder of (?:that person's|his|the person's) natural life/.test(p);
  const life = lifeRest || /imprisonment for life|for life\b/.test(p);
  let minYears: number | null = null;
  const m1 = p.match(/(?:not (?:be )?less than|minimum of)\s+(\d+(?:\.\d+)?)\s*(year|month|day)/);
  const m2 = p.match(/(?:for|of)\s+(\d+(?:\.\d+)?)\s*(year|month|day)s?\s+(?:but\s+)?which may extend/);
  const mm = m1 || m2;
  if (mm) minYears = toYears(Number(mm[1]), mm[2]);
  let maxYears: number | null = null;
  const re = /(\d+(?:\.\d+)?)\s*(year|month|day)s?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(p))) {
    const y = toYears(Number(m[1]), m[2]);
    if (maxYears === null || y > maxYears) maxYears = y;
  }
  // "not less than 10 years but which may extend to imprisonment for life": no number maximum
  if (minYears !== null && maxYears !== null && maxYears <= minYears && (life || !/extend to \d/.test(p))) maxYears = null;
  const fine = /\bfine\b/.test(p);
  const fa = p.match(/fine[^.;]*?(\d[\d,]*(?:\s*lakh)?)\s*rupees/);
  const fineAmount = fa ? `₹${fa[1].replace(/\s+/g, ' ')}` : '';
  const fineOnly = fine && !/imprisonment|death|community/.test(p);
  return {
    minYears,
    maxYears,
    life,
    lifeRest,
    death,
    fine,
    fineAmount,
    fineOnly,
    orBoth: /or (?:with )?fine|or both/.test(p),
    community: /community service/.test(p),
    relative,
  };
};

const W: Record<GuideLang, Record<string, string>> = {
  en: {
    year: 'year',
    years: 'years',
    month: 'month',
    months: 'months',
    upTo: 'up to {a}',
    range: '{a} to {b}',
    atLeast: 'at least {a}',
    life: 'life imprisonment',
    lifeRest: 'imprisonment for the rest of life',
    orLife: '{x}, or {life}',
    death: 'death penalty possible',
    fineYes: 'yes',
    fineOnly: 'Fine only',
    orBoth: 'jail, or fine, or both',
    community: 'Community service possible',
    relative: 'Linked to the punishment of the main offence (see official text)',
    jail: 'Jail',
    fine: 'Fine',
  },
  te: {
    year: 'సంవత్సరం',
    years: 'సంవత్సరాలు',
    month: 'నెల',
    months: 'నెలలు',
    upTo: 'గరిష్ఠంగా {a}',
    range: '{a} నుంచి {b} వరకు',
    atLeast: 'కనీసం {a}',
    life: 'యావజ్జీవ కారాగారం',
    lifeRest: 'జీవితాంతం జైలు',
    orLife: '{x}, లేదా {life}',
    death: 'మరణశిక్ష పడవచ్చు',
    fineYes: 'ఉంది',
    fineOnly: 'జరిమానా మాత్రమే',
    orBoth: 'జైలు, లేదా జరిమానా, లేదా రెండూ',
    community: 'సమాజ సేవ శిక్ష పడవచ్చు',
    relative: 'ప్రధాన నేరం శిక్షకు అనుసంధానం (అధికారిక పాఠం చూడండి)',
    jail: 'జైలు',
    fine: 'జరిమానా',
  },
  hi: {
    year: 'साल',
    years: 'साल',
    month: 'महीना',
    months: 'महीने',
    upTo: 'अधिकतम {a}',
    range: '{a} से {b} तक',
    atLeast: 'कम से कम {a}',
    life: 'आजीवन कारावास',
    lifeRest: 'बाक़ी पूरी ज़िंदगी जेल',
    orLife: '{x}, या {life}',
    death: 'मृत्युदंड हो सकता है',
    fineYes: 'हाँ',
    fineOnly: 'सिर्फ़ जुर्माना',
    orBoth: 'जेल, या जुर्माना, या दोनों',
    community: 'सामुदायिक सेवा हो सकती है',
    relative: 'मुख्य अपराध की सज़ा से जुड़ा (आधिकारिक पाठ देखें)',
    jail: 'जेल',
    fine: 'जुर्माना',
  },
};

const fmt = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

const dur = (y: number, lang: GuideLang): string => {
  const w = W[lang];
  if (y >= 1 && Number.isInteger(y)) return `${y} ${y === 1 ? w.year : w.years}`;
  const mo = Math.round(y * 12);
  if (mo >= 1) return `${mo} ${mo === 1 ? w.month : w.months}`;
  const days = Math.max(1, Math.round(y * 365));
  return lang === 'te' ? `${days} రోజులు` : lang === 'hi' ? `${days} दिन` : `${days} days`;
};

// Simple punishment lines, e.g. ["Jail: 1 to 5 years", "Fine: yes"] (English / Telugu / Hindi)
export const simplePunishment = (text: string, lang: GuideLang = 'en'): string[] => {
  const w = W[lang];
  const p = parsePunishment(text);
  if (p.relative) return [w.relative];
  const out: string[] = [];
  if (p.fineOnly) {
    out.push(`${w.fineOnly}${p.fineAmount ? ` (${p.fineAmount})` : ''}`);
    return out;
  }
  let jail = '';
  if (p.minYears !== null && p.maxYears !== null && p.maxYears > p.minYears) jail = fmt(w.range, { a: dur(p.minYears, lang), b: dur(p.maxYears, lang) });
  else if (p.minYears !== null) jail = fmt(w.atLeast, { a: dur(p.minYears, lang) });
  else if (p.maxYears !== null) jail = fmt(w.upTo, { a: dur(p.maxYears, lang) });
  const lifeWord = p.lifeRest ? w.lifeRest : w.life;
  if (p.life) jail = jail ? fmt(w.orLife, { x: jail, life: lifeWord }) : lifeWord;
  if (p.death) jail = jail ? `${jail}; ${w.death}` : w.death;
  if (jail) out.push(`${w.jail}: ${jail}`);
  if (p.fine) out.push(`${w.fine}: ${p.fineAmount || w.fineYes}${p.orBoth && jail ? ` (${w.orBoth})` : ''}`);
  if (p.community) out.push(w.community);
  return out;
};

// ── How to file a police complaint (BNSS 2023) ──
export interface ComplaintStep {
  t: Tri;
  ref: string; // BNSS section
}

const COG_STEPS: ComplaintStep[] = [
  {
    ref: 'BNSS s.173(1)',
    t: {
      en: 'Go to any police station and tell them what happened: orally, in writing, or online (e-FIR; sign it within 3 days). A "Zero FIR" can be filed at any station even if the crime happened elsewhere.',
      te: 'ఏ పోలీస్ స్టేషన్‌కైనా వెళ్లి జరిగింది చెప్పండి: నోటితో, రాతపూర్వకంగా లేదా ఆన్‌లైన్‌లో (e-FIR; 3 రోజుల్లో సంతకం చేయాలి). నేరం వేరే చోట జరిగినా ఏ స్టేషన్‌లోనైనా "జీరో FIR" నమోదు చేయవచ్చు.',
      hi: 'किसी भी थाने में जाकर बताएँ क्या हुआ: मौखिक, लिखित, या ऑनलाइन (e-FIR; 3 दिन में हस्ताक्षर करें)। अपराध कहीं और हुआ हो तब भी किसी भी थाने में "ज़ीरो FIR" दर्ज हो सकती है।',
    },
  },
  {
    ref: 'BNSS s.173(2)',
    t: {
      en: 'The police must register the FIR and give you a free copy at once.',
      te: 'పోలీసులు FIR నమోదు చేసి దాని కాపీని వెంటనే ఉచితంగా ఇవ్వాలి.',
      hi: 'पुलिस को FIR दर्ज करनी होगी और उसकी कॉपी तुरंत मुफ़्त देनी होगी।',
    },
  },
  {
    ref: 'BNSS s.173(4)',
    t: {
      en: 'If the station refuses, send the information in writing (by post) to the Superintendent of Police (SP / DCP).',
      te: 'స్టేషన్ నిరాకరిస్తే, సమాచారాన్ని రాతపూర్వకంగా (పోస్ట్ ద్వారా) జిల్లా ఎస్పీ / డీసీపీకి పంపండి.',
      hi: 'थाना मना करे तो जानकारी लिखकर (डाक से) पुलिस अधीक्षक (SP / DCP) को भेजें।',
    },
  },
  {
    ref: 'BNSS s.175(3)',
    t: {
      en: 'If there is still no action, apply to the Magistrate with an affidavit; the Magistrate can order the police to investigate.',
      te: 'అయినా చర్య లేకపోతే, అఫిడవిట్‌తో మేజిస్ట్రేట్‌కు దరఖాస్తు చేయండి; మేజిస్ట్రేట్ దర్యాప్తుకు ఆదేశించవచ్చు.',
      hi: 'फिर भी कार्रवाई न हो तो हलफ़नामे के साथ मजिस्ट्रेट को आवेदन दें; मजिस्ट्रेट जाँच का आदेश दे सकते हैं।',
    },
  },
];

const NONCOG_STEPS: ComplaintStep[] = [
  {
    ref: 'BNSS s.174(1)',
    t: {
      en: 'Tell the police station; they enter it in a register (not an FIR) and refer you to the Magistrate.',
      te: 'పోలీస్ స్టేషన్‌కు చెప్పండి; వారు దాన్ని రిజిస్టర్‌లో నమోదు చేసి (FIR కాదు) మిమ్మల్ని మేజిస్ట్రేట్ వద్దకు పంపుతారు.',
      hi: 'थाने को बताएँ; वे इसे रजिस्टर में दर्ज करेंगे (FIR नहीं) और आपको मजिस्ट्रेट के पास भेजेंगे।',
    },
  },
  {
    ref: 'BNSS s.174(2)',
    t: {
      en: 'The police cannot investigate this offence without the Magistrate’s order.',
      te: 'మేజిస్ట్రేట్ ఆదేశం లేకుండా ఈ నేరంపై పోలీసులు దర్యాప్తు చేయలేరు.',
      hi: 'मजिस्ट्रेट के आदेश के बिना पुलिस इस अपराध की जाँच नहीं कर सकती।',
    },
  },
  {
    ref: 'BNSS s.223',
    t: {
      en: 'You can also file a written complaint directly before the Magistrate’s court; the Magistrate examines you on oath.',
      te: 'మీరు నేరుగా మేజిస్ట్రేట్ కోర్టులో రాతపూర్వక ఫిర్యాదు కూడా దాఖలు చేయవచ్చు; మేజిస్ట్రేట్ మిమ్మల్ని ప్రమాణంపై విచారిస్తారు.',
      hi: 'आप सीधे मजिस्ट्रेट की अदालत में लिखित शिकायत भी दे सकते हैं; मजिस्ट्रेट आपका शपथ पर बयान लेंगे।',
    },
  },
];

const COND_STEP: ComplaintStep = {
  ref: 'BNSS First Schedule',
  t: {
    en: 'For this offence the police can register an FIR only in the situation the law states (for example, on information from the victim or her relative). Read the official classification above.',
    te: 'ఈ నేరానికి చట్టం చెప్పిన పరిస్థితిలో మాత్రమే (ఉదా. బాధితురాలు లేదా ఆమె బంధువు సమాచారం ఇస్తే) పోలీసులు FIR నమోదు చేయగలరు. పై అధికారిక వర్గీకరణ చదవండి.',
    hi: 'इस अपराध में पुलिस सिर्फ़ क़ानून में बताई स्थिति में FIR दर्ज कर सकती है (जैसे पीड़िता या उसके रिश्तेदार की सूचना पर)। ऊपर आधिकारिक वर्गीकरण पढ़ें।',
  },
};

const EMERGENCY_STEP: ComplaintStep = {
  ref: '112',
  t: {
    en: 'In danger right now? Call 112. Online money fraud: call 1930 or report at cybercrime.gov.in.',
    te: 'ఇప్పుడే ప్రమాదంలో ఉన్నారా? 112కి కాల్ చేయండి. ఆన్‌లైన్ డబ్బు మోసం: 1930కి కాల్ చేయండి లేదా cybercrime.gov.in లో ఫిర్యాదు చేయండి.',
    hi: 'अभी ख़तरे में हैं? 112 पर कॉल करें। ऑनलाइन पैसे की धोखाधड़ी: 1930 पर कॉल करें या cybercrime.gov.in पर रिपोर्ट करें।',
  },
};

export const complaintSteps = (cog: Flag): ComplaintStep[] => {
  if (cog === 'yes') return [...COG_STEPS, EMERGENCY_STEP];
  if (cog === 'no') return [...NONCOG_STEPS, EMERGENCY_STEP];
  if (cog === 'cond') return [COND_STEP, ...COG_STEPS, EMERGENCY_STEP];
  return [...COG_STEPS, ...NONCOG_STEPS, EMERGENCY_STEP];
};

// One combined flag for an entry: 'yes' if every row says yes, 'no' if every row says no, else mixed
export const entryFlag = (rows: LawSection[], pick: (s: LawSection) => Flag): Flag | 'mixed' => {
  const fs = new Set(rows.map(pick));
  return fs.size === 1 ? [...fs][0] : 'mixed';
};

// ── Search: simple titles + explanations in EN / TE / HI, keywords, section numbers, old IPC ──
const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9()\u0900-\u097F\u0C00-\u0C7F]+/g, ' ')
    .trim();

export const searchOffences = (query: string, cat: OffenceCategory | 'ALL' = 'ALL'): OffenceGuideItem[] => {
  const list = offenceGuide().filter(e => cat === 'ALL' || e.cat === cat);
  const q = norm(query);
  if (!q) return list;
  const ipcQuery = /^ipc /.test(q);
  const qq = q.replace(/^(ipc|bns|section|sec) /, '');
  const words = qq.split(' ').filter(Boolean);
  const scored: { e: OffenceGuideItem; score: number }[] = [];
  for (const e of list) {
    const titles = norm(`${e.t.en} ${e.t.te} ${e.t.hi}`);
    const hay = norm(
      [titles, e.x.en, e.x.te, e.x.hi, (e.kw || []).join(' '), ...e.rows.map(r => `${r.section} ${r.title} ${r.summary} ${r.oldRef || ''}`)].join(' '),
    );
    const secs = e.rows.map(r => norm(r.section).split(/[ (]/)[0]);
    const ipcs = e.rows.flatMap(r => norm(r.oldRef || '').replace(/^ipc /, '').split(' '));
    let score = 0;
    if (ipcQuery) {
      if (ipcs.includes(qq)) score += 150;
    } else if (/^\d+[a-z]?$/.test(qq)) {
      if (secs.includes(qq)) score += 120;
      if (ipcs.includes(qq)) score += 60;
    }
    if (!score && !words.every(w => hay.includes(w))) continue;
    if (titles.includes(qq)) score += 50;
    if (words.every(w => titles.includes(w))) score += 20;
    if ((e.kw || []).some(k => norm(k).includes(qq))) score += 10;
    scored.push({ e, score });
  }
  return scored.sort((a, b) => b.score - a.score).map(x => x.e);
};
