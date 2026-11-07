// Bad-word filter for comments, captions, chat text and poll labels.
// English plus Telugu / Hindi abuses written in English letters.
// Matches whole words (and obvious variants), never substrings of normal words like "class" or "Scunthorpe".

export const RESPECT_MESSAGE = 'Please keep comments respectful 🙏';

// Words matched as whole words, also with common suffixes (fucks, bitches, fucking)
const SUFFIXABLE = [
  // English
  'fuck', 'fuk', 'fck', 'fuq', 'motherfucker', 'mofo', 'shit', 'bullshit', 'bitch', 'biatch', 'bastard',
  'asshole', 'arsehole', 'dickhead', 'cunt', 'pussy', 'slut', 'whore', 'nigger', 'nigga', 'faggot',
  'retard', 'wanker', 'twat', 'prick', 'douchebag', 'jackass', 'dumbass', 'bollocks', 'skank',
  'killyourself',
  // Hindi
  'madarchod', 'maderchod', 'madarchood', 'behenchod', 'bhenchod', 'behanchod', 'bhenchood',
  'chutiya', 'chutiye', 'chutiyapa', 'chootiya', 'bhosdike', 'bhosadike', 'bhosdi', 'bhosda',
  'bhosdiwala', 'gandu', 'gaandu', 'lavda', 'lawda', 'lauda', 'lodu', 'randi', 'randwa', 'harami',
  'haramkhor', 'chodu', 'kutiya', 'betichod', 'jhatu', 'tatti',
  // Telugu
  'lanja', 'lanjakodaka', 'lanjakoduka', 'lanjodaka', 'nakodaka', 'nakoduka', 'denguta', 'dengutha',
  'dengichuko', 'dengey', 'dengu', 'pooku', 'erripuka', 'erripooka', 'erripuku', 'kojja', 'sulli',
  'mundamopi', 'gudisepu', 'bokkalo',
];

// Short or ambiguous words: exact whole word only (no suffixes), so "cocky", "assess", "dengue" stay fine
const EXACT_ONLY = [
  'ass', 'arse', 'cock', 'dick', 'dicks', 'fag', 'piss', 'kys', 'stfu',
  'bc', 'mc', 'bsdk', 'mkc', 'tmkc', 'chut', 'lund', 'chod', 'gaand',
  'puku', 'modda', 'gudda', 'bokka', 'munda',
];

// No normal word contains these, so they are caught inside longer words too (e.g. "fuckface")
const EMBEDDED = ['fuck', 'motherfuck', 'madarchod', 'behenchod', 'bhenchod', 'chutiya', 'nigger', 'lanjakodak', 'bhosdik'];

const SUFFIXES = ['s', 'es', 'er', 'ers', 'ing', 'in', 'ed', 'z'];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

// "fuuuck" -> "fuck"
const squeeze = (s: string) => s.replace(/([a-z])\1+/g, '$1');

interface Entry {
  word: string;
  sq: string;
}
const toEntries = (list: string[]): Entry[] => list.map(w => ({ word: w, sq: squeeze(w) }));
const SUFFIX_ENTRIES = toEntries(SUFFIXABLE);
const EXACT_ENTRIES = toEntries(EXACT_ONLY);
const ALL_ENTRIES = [...SUFFIX_ENTRIES, ...EXACT_ENTRIES];

// Same letters after squeezing repeats, and at least as long (so "as" never matches "ass", "moda" never "modda")
const sameWord = (token: string, e: Entry) => token.length >= e.word.length && squeeze(token) === e.sq;

const matchesToken = (token: string): boolean => {
  if (!token) return false;
  for (const e of ALL_ENTRIES) if (sameWord(token, e)) return true;
  for (const e of SUFFIX_ENTRIES) {
    for (const suf of SUFFIXES) {
      if (token.length > suf.length && token.endsWith(suf) && sameWord(token.slice(0, -suf.length), e)) return true;
    }
  }
  const sq = squeeze(token);
  for (const w of EMBEDDED) {
    if (token.includes(w)) return true;
    if (squeeze(w) === w && sq.includes(w)) return true;
  }
  return false;
};

// "f*ck", "b**ch": stars stand for one letter each, checked against the blocklist only
const matchesMasked = (raw: string): boolean => {
  if (!/[a-z][*#]+[a-z]?|^[*#]+[a-z]/.test(raw) || !/[a-z]/.test(raw)) return false;
  const core = raw.replace(/^[^a-z*#]+|[^a-z*#]+$/g, '');
  if (!/^[a-z*#]+$/.test(core) || core.replace(/[*#]/g, '').length < 1) return false;
  const re = new RegExp('^' + core.replace(/[*#]/g, '[a-z]') + '$');
  return [...SUFFIXABLE, ...EXACT_ONLY].some(w => w.length >= 3 && re.test(w));
};

export const normalizeText = (text: string): string => {
  let s = (text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  s = s.replace(/[013457@$]/g, ch => LEET[ch] || ch);
  return s;
};

export const containsProfanity = (text: string): boolean => {
  const s = normalizeText(text);
  if (!s.trim()) return false;

  // Whole words, split on anything that is not a letter
  const words = s.split(/[^a-z]+/).filter(Boolean);
  if (words.some(matchesToken)) return true;

  // Two words written apart: "bhen chod", "naa kodaka", "kill yourself"
  for (let i = 0; i + 1 < words.length; i++) {
    if (matchesToken(words[i] + words[i + 1])) return true;
  }

  // Letters spaced or dotted out: "f u c k", "f.u.c.k", "b-c"
  let run = '';
  for (const w of [...words, '']) {
    if (w.length === 1) run += w;
    else {
      if (run.length >= 2 && matchesToken(run)) return true;
      run = '';
    }
  }

  // Masked with stars: "f*ck", "sh*t"
  const chunks = s.split(/\s+/).filter(Boolean);
  if (chunks.some(matchesMasked)) return true;

  return false;
};

// Throws with a friendly message when the text is not allowed
export const assertClean = (text: string, message: string = RESPECT_MESSAGE): void => {
  if (containsProfanity(text)) throw new Error(message);
};

// Lowercased words the Firestore rules also block (keep in sync with firestore.rules)
export const RULES_BLOCKED_REGEX =
  '(([a-z]|[^a-z])*[^a-z])?(fuck[a-z]*|motherfucker[a-z]*|bitch(es)?|cunts?|nigg(er|a)s?|faggots?|madarchod|behenchod|bhenchod|chutiy[ae]|bhosdike|lanja|lanjakodaka|dengu|puku|modda|randi|gandu|lavda)([^a-z]([a-z]|[^a-z])*)?';
