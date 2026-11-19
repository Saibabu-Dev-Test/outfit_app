// Civic AI in the app (Worker POST /v1/civic/ask, fast free-tier Gemini, answers only from data):
//  - "Ask about laws": the app picks the relevant sections from its own offline law data
//    (lawContextFor, built on services/laws.ts) and sends ONLY those; the answer is simple, in the
//    app language + English, and always ends with "not legal advice, consult a lawyer / police".
//  - "Explain simply" (Govt) and Hospital AI: the Worker answers from the stored civic row itself.
// aiErrorKey turns a failure into a clear message (free-tier limit, credits used up, daily cap).
// Pure helpers are tested in __tests__/civicFast.test.ts.
import { AppLanguage, langCode } from '../i18n/appLanguage';
import type { CivicKey } from '../i18n/civicLabels';
import { withCivicSafety } from '../i18n/civicSafety';
import { AskTopic, CivicAiCode, CivicAskRequest, CivicAskResponse, GovtFocus, HospVariant, askCivic } from './civicApi';
import { LawSection, allSections, plainTitle, searchLaws } from './laws';
import { WorkerError } from './workerApi';

export const LAW_CONTEXT_MAX = 8; // sections sent per question
export const LAW_CONTEXT_CHARS = 11000;

const STOP = new Set(
  'a an the is are was were be been am i me my we our you your he she it they them his her their this that these those of to in on at for from by with and or not no if then what which who whom whose when where why how can could should would will shall do does did done have has had any some there here about into than also just only very much more most get got someone somebody person people law laws section sections act under please tell explain happens happen case'.split(
    ' ',
  ),
);

// Words of a question worth matching (Latin, Telugu, Devanagari letters; digits; no stop words)
export const questionWords = (q: string): string[] =>
  [
    ...new Set(
      (q || '')
        .toLowerCase()
        .replace(/[^a-z0-9()\u0900-\u097F\u0C00-\u0C7F]+/g, ' ')
        .split(' ')
        .filter(w => w && !STOP.has(w) && (w.length > 2 || /^\d+$/.test(w))),
    ),
  ];

const hayOf = (s: LawSection) =>
  [s.section, s.title, s.summary, s.meaning || '', s.oldRef || '', ...(s.examples || []), s.plain?.en?.t, s.plain?.en?.x, s.plain?.te?.t, s.plain?.te?.x, s.plain?.hi?.t, s.plain?.hi?.x]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

// The most relevant sections for a free-text question (pure): section / IPC numbers first, then
// the sections matching the most words (a word may match the start of a longer word: "cheat" ->
// "cheating"). No match at all: the curated sections that have a plain meaning (common offences).
export const lawSectionsFor = (question: string, max = LAW_CONTEXT_MAX): LawSection[] => {
  const words = questionWords(question);
  const out: LawSection[] = [];
  const add = (s: LawSection) => {
    if (out.length < max && !out.some(x => x.id === s.id)) out.push(s);
  };
  const ipc = /\bipc\s*(\d+[a-z]?)/i.exec(question || '');
  if (ipc) searchLaws(`ipc ${ipc[1]}`, 'ALL', 3).forEach(add);
  words.filter(w => /^\d+$/.test(w)).forEach(n => searchLaws(n, 'ALL', 2).forEach(add));
  const textWords = words.filter(w => !/^\d+$/.test(w));
  if (textWords.length) {
    allSections()
      .map(s => {
        const hay = hayOf(s);
        const hit = textWords.filter(w => hay.includes(w.length > 4 ? w.slice(0, w.length - 1) : w)).length;
        return { s, score: hit * 10 + (s.meaning ? 2 : 0) + (s.plain?.en ? 1 : 0) };
      })
      .filter(x => x.score >= 10)
      .sort((a, b) => b.score - a.score)
      .forEach(x => add(x.s));
  }
  if (!out.length) allSections().filter(s => !!s.meaning).forEach(add);
  return out;
};

// One compact block per section for the model (pure)
export const lawSectionText = (s: LawSection): string =>
  [
    `[${s.act} ${s.section}] ${plainTitle(s)}${plainTitle(s) !== s.title ? ` (legal title: ${s.title})` : ''}`,
    s.summary ? `What it covers: ${s.summary}` : '',
    s.plain?.en?.x ? `Simple: ${s.plain.en.x}` : '',
    s.meaning ? `Meaning: ${s.meaning}` : '',
    s.punishment ? `Punishment: ${s.punishment}` : '',
    s.cognizable ? `Cognizable: ${s.cognizable}` : '',
    s.bailable ? `Bail: ${s.bailable}` : '',
    s.court ? `Court: ${s.court}` : '',
    s.oldRef ? `Old law: ${s.oldRef}` : '',
  ]
    .filter(Boolean)
    .join('\n');

export const lawContextFor = (question: string): { context: string; sections: LawSection[] } => {
  const sections: LawSection[] = [];
  let context = '';
  for (const s of lawSectionsFor(question)) {
    const block = lawSectionText(s);
    if (context.length + block.length + 2 > LAW_CONTEXT_CHARS) break;
    context += (context ? '\n\n' : '') + block;
    sections.push(s);
  }
  return { context, sections };
};

// Which message to show for a failed AI call (pure)
export const aiErrorKey = (e: unknown, code?: CivicAiCode | null): CivicKey => {
  if (code === 'quota' || code === 'timeout') return 'aiBusy';
  if (code === 'billing' || code === 'config' || code === 'key') return 'aiQuota';
  if (code === 'cap') return 'aiBusy';
  if (e instanceof WorkerError) {
    if (e.status === 429 && /daily AI limit/i.test(e.message)) return 'aiLimit';
    if (e.status === 429) return 'aiBusy';
    if (e.status === 503) return 'aiQuota';
  }
  return 'error';
};

export interface CivicAnswer {
  answer: string;
  en: string;
}

const finish = (r: CivicAskResponse, topic: AskTopic, lang: AppLanguage): CivicAnswer => ({
  answer: withCivicSafety(r.answer, topic, langCode(lang)),
  en: r.en ? withCivicSafety(r.en, topic, 'en') : '',
});

export async function askLaws(question: string, lang: AppLanguage, history: CivicAskRequest['history'] = []): Promise<CivicAnswer & { sections: LawSection[] }> {
  const { context, sections } = lawContextFor(question);
  const r = await askCivic({ topic: 'laws', lang: langCode(lang), question, history, context });
  return { ...finish(r, 'laws', lang), sections };
}

export async function explainGovt(state: string, district: string, focus: GovtFocus, lang: AppLanguage, question = ''): Promise<CivicAnswer> {
  const r = await askCivic({ topic: 'govt', lang: langCode(lang), state, district, focus, question: question || undefined });
  return finish(r, 'govt', lang);
}

export async function askHospitals(
  state: string,
  district: string,
  variants: HospVariant[],
  question: string,
  lang: AppLanguage,
  history: CivicAskRequest['history'] = [],
): Promise<CivicAnswer> {
  const r = await askCivic({ topic: 'hosp', lang: langCode(lang), state, district, variants, question, history });
  return finish(r, 'hosp', lang);
}
