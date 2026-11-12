// Free, offline outfit picker (no AI, no network): top + bottom pairs from the user's own wardrobe,
// ranked by today's lucky colour (panchangam vaara colour, IST weekday, utils/panchangam.ts) and
// simple colour-matching rules (lucky colour + calm neutral, classic pairs, no clashes).
// Each pair gets a short, positive explanation in English, Telugu or Hindi (the Stylist's language
// toggle). The Stylist uses it when there is no AI key, when the daily AI limit is used up, or
// whenever the AI call fails (quota / credits, network, ...), so users never see a raw error.
import { CATEGORY_GROUPS, normalizeCategory } from '../constants/wardrobe';
import { getTodayVaaraColour, VaaraColour } from '../utils/panchangam';
import type { WardrobeItemResponse } from './wardrobeApi';
import type { AiLanguage } from './aiStylist';

export interface LuckyPair {
  top: WardrobeItemResponse;
  bottom: WardrobeItemResponse;
  score: number;
  why: string; // short positive explanation in the chosen language
}

export interface LuckyPairsResult {
  pairs: LuckyPair[];
  vaara: VaaraColour;
  tops: number;
  bottoms: number;
}

export const MIN_PAIRS = 3;
export const MAX_PAIRS = 3; // at most 3 pairs, best first

const TOP_CATS = new Set(CATEGORY_GROUPS.find(g => g.key === 'tops')?.categories || []);
const BOTTOM_CATS = new Set(CATEGORY_GROUPS.find(g => g.key === 'bottoms')?.categories || []);

// ── Colour families ─────────────────────────────────────────────────────────
type Fam =
  | 'red'
  | 'maroon'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'lightblue'
  | 'navy'
  | 'purple'
  | 'pink'
  | 'white'
  | 'black'
  | 'grey'
  | 'beige'
  | 'brown'
  | 'silver';

const NEUTRALS = new Set<Fam>(['white', 'black', 'grey', 'beige', 'navy', 'brown', 'silver']);

const NAME_TO_FAM: [RegExp, Fam][] = [
  [/maroon|wine|burgundy/, 'maroon'],
  [/coral|peach|orange|rust|saffron/, 'orange'],
  [/red|crimson|scarlet/, 'red'],
  [/gold|mustard|yellow/, 'yellow'],
  [/olive|mint|green|emerald/, 'green'],
  [/navy/, 'navy'],
  [/light ?blue|sky|baby blue|powder/, 'lightblue'],
  [/blue|denim|teal|turquoise/, 'blue'],
  [/purple|violet|lavender|lilac/, 'purple'],
  [/pink|rose|magenta/, 'pink'],
  [/white|cream|ivory|off.?white/, 'white'],
  [/black|charcoal/, 'black'],
  [/silver/, 'silver'],
  [/grey|gray/, 'grey'],
  [/beige|khaki|tan|camel|nude|sand/, 'beige'],
  [/brown|coffee|chocolate/, 'brown'],
];

const famOfName = (name?: string | null): Fam | null => {
  const n = (name || '').toLowerCase().trim();
  if (!n) return null;
  for (const [re, f] of NAME_TO_FAM) if (re.test(n)) return f;
  return null;
};

// Rough family from a hex colour (items saved with only a colour hex)
const famOfHex = (hex?: string | null): Fam | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 510;
  const s = max === min ? 0 : (max - min) / (l > 0.5 ? 510 - max - min : max + min);
  if (s < 0.15) return l > 0.85 ? 'white' : l < 0.18 ? 'black' : 'grey';
  let h = 0;
  if (max === r) h = ((g - b) / (max - min)) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 345) return l < 0.35 ? 'maroon' : 'red';
  if (h < 40) return l < 0.4 ? 'brown' : s < 0.45 ? 'beige' : 'orange';
  if (h < 65) return 'yellow';
  if (h < 170) return 'green';
  if (h < 200) return 'lightblue';
  if (h < 250) return l < 0.3 ? 'navy' : l > 0.7 ? 'lightblue' : 'blue';
  if (h < 290) return 'purple';
  return 'pink';
};

const famOfItem = (i: WardrobeItemResponse): Fam | null => famOfName(i.color) || famOfHex(i.colorHex || i.color);

// Lucky families for the day (vaara colour names -> families). Families that only come close to a
// lucky colour (orange / pink for Coral, grey for Silver, blue for Light Blue) are "near" ones.
const luckyInfo = (v: VaaraColour): { all: Set<Fam>; near: Map<Fam, string> } => {
  const direct = new Set<Fam>();
  const near = new Map<Fam, string>();
  v.colours.forEach(c => {
    const f = famOfName(c.name);
    if (f) direct.add(f);
    if (/coral/i.test(c.name)) {
      near.set('orange', c.name);
      near.set('pink', c.name);
    }
    if (/silver/i.test(c.name)) near.set('grey', c.name);
    if (/light blue/i.test(c.name)) near.set('blue', c.name);
  });
  direct.forEach(f => near.delete(f));
  const all = new Set<Fam>([...direct, ...near.keys()]);
  return { all, near };
};

// One lucky colour name in the chosen language
const colourNameWord = (name: string, lang: AiLanguage): string => {
  if (lang === 'English') return name;
  if (/coral/i.test(name)) return lang === 'Telugu' ? 'పగడపు రంగు' : 'कोरल';
  const f = famOfName(name);
  return f ? COLOUR_WORD[lang][f] : name;
};

// Classic pairs (order-free) and clashes
const key = (a: Fam, b: Fam) => [a, b].sort().join('+');
const CLASSIC = new Set(
  [
    ['red', 'black'], ['red', 'white'], ['red', 'navy'], ['red', 'beige'], ['red', 'grey'], ['red', 'blue'],
    ['maroon', 'beige'], ['maroon', 'black'], ['maroon', 'grey'], ['maroon', 'white'], ['maroon', 'blue'],
    ['orange', 'navy'], ['orange', 'white'], ['orange', 'blue'], ['orange', 'beige'], ['orange', 'brown'],
    ['yellow', 'navy'], ['yellow', 'blue'], ['yellow', 'white'], ['yellow', 'grey'], ['yellow', 'black'],
    ['green', 'beige'], ['green', 'white'], ['green', 'brown'], ['green', 'navy'], ['green', 'black'], ['green', 'blue'],
    ['blue', 'white'], ['blue', 'beige'], ['blue', 'grey'], ['blue', 'black'], ['lightblue', 'navy'],
    ['lightblue', 'white'], ['lightblue', 'beige'], ['lightblue', 'grey'], ['lightblue', 'blue'], ['lightblue', 'black'],
    ['navy', 'white'], ['navy', 'beige'], ['navy', 'grey'], ['purple', 'grey'], ['purple', 'white'], ['purple', 'black'],
    ['pink', 'navy'], ['pink', 'white'], ['pink', 'grey'], ['pink', 'blue'], ['pink', 'beige'], ['pink', 'black'],
    ['white', 'black'], ['black', 'grey'], ['white', 'beige'], ['brown', 'white'], ['brown', 'beige'], ['brown', 'blue'],
    ['silver', 'black'], ['silver', 'navy'], ['silver', 'white'], ['silver', 'blue'],
  ].map(([a, b]) => key(a as Fam, b as Fam)),
);
const CLASH = new Set(
  [
    ['red', 'green'], ['red', 'orange'], ['red', 'pink'], ['red', 'purple'], ['red', 'maroon'],
    ['orange', 'pink'], ['orange', 'purple'], ['green', 'pink'], ['green', 'purple'], ['yellow', 'purple'],
    ['brown', 'black'], ['navy', 'black'], ['maroon', 'pink'], ['orange', 'maroon'],
  ].map(([a, b]) => key(a as Fam, b as Fam)),
);

// ── Words in three languages ────────────────────────────────────────────────
const COLOUR_WORD: Record<AiLanguage, Record<Fam, string>> = {
  English: {
    red: 'red', maroon: 'maroon', orange: 'orange', yellow: 'yellow', green: 'green', blue: 'blue',
    lightblue: 'light blue', navy: 'navy', purple: 'purple', pink: 'pink', white: 'white', black: 'black',
    grey: 'grey', beige: 'beige', brown: 'brown', silver: 'silver',
  },
  Telugu: {
    red: 'ఎరుపు', maroon: 'మెరూన్', orange: 'నారింజ', yellow: 'పసుపు', green: 'ఆకుపచ్చ', blue: 'నీలం',
    lightblue: 'లేత నీలం', navy: 'ముదురు నీలం', purple: 'ఊదా', pink: 'గులాబీ', white: 'తెలుపు', black: 'నలుపు',
    grey: 'బూడిద రంగు', beige: 'లేత గోధుమ', brown: 'గోధుమ', silver: 'వెండి రంగు',
  },
  Hindi: {
    red: 'लाल', maroon: 'मैरून', orange: 'नारंगी', yellow: 'पीला', green: 'हरा', blue: 'नीला',
    lightblue: 'हल्का नीला', navy: 'गहरा नीला', purple: 'बैंगनी', pink: 'गुलाबी', white: 'सफ़ेद', black: 'काला',
    grey: 'स्लेटी', beige: 'बेज', brown: 'भूरा', silver: 'चाँदी जैसा',
  },
};

// What each weekday's colour is believed to bring (same order as the vaara table: Sunday = 0)
const BENEFIT: Record<AiLanguage, string[]> = {
  English: [
    'confidence and energy', 'calm and a clear mind', 'courage and strength', 'sharp thinking and growth',
    'wisdom and good luck', 'beauty, love and harmony', 'steadiness and protection',
  ],
  Telugu: [
    'ఆత్మవిశ్వాసం, శక్తి', 'ప్రశాంతత, స్పష్టమైన మనసు', 'ధైర్యం, బలం', 'చురుకైన ఆలోచన, ఎదుగుదల',
    'జ్ఞానం, అదృష్టం', 'అందం, ప్రేమ, సామరస్యం', 'స్థిరత్వం, రక్షణ',
  ],
  Hindi: [
    'आत्मविश्वास और ऊर्जा', 'शांति और साफ़ मन', 'साहस और ताक़त', 'तेज़ सोच और तरक्की',
    'ज्ञान और सौभाग्य', 'सुंदरता, प्यार और सामंजस्य', 'स्थिरता और सुरक्षा',
  ],
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

const LINES: Record<AiLanguage, Record<string, string>> = {
  English: {
    lucky: '{c} is today\'s lucky colour, believed to bring {benefit}.',
    near: '{c} is close to today\'s lucky {lucky}, believed to bring {benefit}.',
    neutral: '{n} is a calm neutral, so the {c} stands out beautifully.',
    both: 'Both pieces carry today\'s lucky colours: a bold, confident look.',
    classic: '{a} and {b} are a classic match that always looks great.',
    fresh: '{a} with {b} is a fresh, easy combination.',
    accent: 'A smart, balanced pair; add a small {lucky} accessory for today\'s luck.',
  },
  Telugu: {
    lucky: '{c} ఈ రోజు అదృష్ట రంగు, ఇది {benefit} ఇస్తుందని నమ్మకం.',
    near: '{c} ఈ రోజు అదృష్ట రంగు {lucky}కి దగ్గరగా ఉంటుంది, ఇది {benefit} ఇస్తుందని నమ్మకం.',
    neutral: '{n} ప్రశాంతమైన న్యూట్రల్ రంగు, అందుకే {c} అందంగా మెరుస్తుంది.',
    both: 'రెండు దుస్తుల్లోనూ ఈ రోజు అదృష్ట రంగులే: ధైర్యంగా, ఆత్మవిశ్వాసంగా కనిపిస్తారు.',
    classic: '{a}, {b} ఎప్పుడూ బాగుండే క్లాసిక్ జోడీ.',
    fresh: '{a} తో {b} తాజాగా, సులువుగా ఉండే కాంబినేషన్.',
    accent: 'చక్కని, సమతుల్యమైన జోడీ; ఈ రోజు అదృష్టం కోసం చిన్న {lucky} యాక్సెసరీ జత చేయండి.',
  },
  Hindi: {
    lucky: '{c} आज का शुभ रंग है, माना जाता है कि यह {benefit} लाता है।',
    near: '{c} आज के शुभ रंग {lucky} के क़रीब है, माना जाता है कि यह {benefit} लाता है।',
    neutral: '{n} एक शांत न्यूट्रल रंग है, इसलिए {c} खूबसूरती से उभरता है।',
    both: 'दोनों कपड़ों में आज के शुभ रंग हैं: एक बोल्ड, आत्मविश्वास भरा लुक।',
    classic: '{a} और {b}: एक क्लासिक जोड़ी, जो हमेशा अच्छी लगती है।',
    fresh: '{a} के साथ {b} एक ताज़ा, आसान कॉम्बिनेशन है।',
    accent: 'एक स्मार्ट, संतुलित जोड़ी; आज के शुभ असर के लिए छोटी {lucky} एक्सेसरी जोड़ें।',
  },
};

// Screen texts for the pairs card
export const PAIR_TEXT: Record<AiLanguage, Record<string, string>> = {
  English: {
    title: 'Today\'s lucky pairs from your wardrobe',
    subtitle: 'Picked for {day}\'s lucky colour: {colours}',
    fallback: 'Here are today\'s lucky picks from your wardrobe 👇',
    needItems: 'Add at least one top and one bottom (with their colours) to your wardrobe and I will pair them for today\'s lucky colour.',
    fewItems: 'Add a few more tops and bottoms for more lucky pairs.',
    top: 'Top',
    bottom: 'Bottom',
  },
  Telugu: {
    title: 'మీ వార్డ్‌రోబ్ నుండి ఈ రోజు అదృష్ట జోడీలు',
    subtitle: '{day} అదృష్ట రంగు కోసం ఎంచుకున్నవి: {colours}',
    fallback: 'మీ వార్డ్‌రోబ్ నుండి ఈ రోజు అదృష్ట ఎంపికలు ఇవిగో 👇',
    needItems: 'మీ వార్డ్‌రోబ్‌లో కనీసం ఒక టాప్, ఒక బాటమ్ (రంగుతో) చేర్చండి, ఈ రోజు అదృష్ట రంగుకు తగ్గ జోడీలు చూపిస్తాను.',
    fewItems: 'మరిన్ని అదృష్ట జోడీల కోసం ఇంకొన్ని టాప్స్, బాటమ్స్ చేర్చండి.',
    top: 'టాప్',
    bottom: 'బాటమ్',
  },
  Hindi: {
    title: 'आपके वॉर्डरोब से आज की शुभ जोड़ियाँ',
    subtitle: '{day} के शुभ रंग के लिए चुनी गईं: {colours}',
    fallback: 'आपके वॉर्डरोब से आज की शुभ पसंद ये रहीं 👇',
    needItems: 'अपने वॉर्डरोब में कम से कम एक टॉप और एक बॉटम (रंग के साथ) जोड़ें, मैं आज के शुभ रंग के हिसाब से जोड़ियाँ बनाऊँगा।',
    fewItems: 'और शुभ जोड़ियों के लिए कुछ और टॉप और बॉटम जोड़ें।',
    top: 'टॉप',
    bottom: 'बॉटम',
  },
};

const DAY_WORD: Record<AiLanguage, string[]> = {
  English: WEEKDAYS,
  Telugu: ['ఆదివారం', 'సోమవారం', 'మంగళవారం', 'బుధవారం', 'గురువారం', 'శుక్రవారం', 'శనివారం'],
  Hindi: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Lucky colour names of the day in the chosen language
export const luckyColourWords = (v: VaaraColour, lang: AiLanguage): string =>
  v.colours.map(c => colourNameWord(c.name, lang)).join(' / ');

export const pairsSubtitle = (v: VaaraColour, lang: AiLanguage): string =>
  fill(PAIR_TEXT[lang].subtitle, {
    day: DAY_WORD[lang][Math.max(0, WEEKDAYS.indexOf(v.weekday))],
    colours: luckyColourWords(v, lang),
  });

// ── Scoring ────────────────────────────────────────────────────────────────
// ── Occasion fit ─────────────────────────────────────────────────────────
export type OccKey =
  | 'work' | 'interview' | 'college' | 'date' | 'party' | 'wedding' | 'festival' | 'temple'
  | 'beach' | 'gym' | 'travel' | 'casual' | 'hill' | 'home' | 'indoor' | 'outdoor';

// Occasion chip / detected word -> rule key
export const occasionKey = (occ?: string | null): OccKey | null => {
  const o = (occ || '').toLowerCase();
  if (!o) return null;
  if (/interview/.test(o)) return 'interview';
  if (/work|office/.test(o)) return 'work';
  if (/college|school|class/.test(o)) return 'college';
  if (/date/.test(o)) return 'date';
  if (/party/.test(o)) return 'party';
  if (/wedding|function|marriage/.test(o)) return 'wedding';
  if (/festival/.test(o)) return 'festival';
  if (/temple/.test(o)) return 'temple';
  if (/beach/.test(o)) return 'beach';
  if (/gym|workout|sport/.test(o)) return 'gym';
  if (/hill|mountain|snow|cold|winter/.test(o)) return 'hill';
  if (/home|night|sleep|pyjama|pajama|lounge/.test(o)) return 'home';
  if (/travel|trip|journey/.test(o)) return 'travel';
  if (/casual|outing|restaurant|movie|mall/.test(o)) return 'casual';
  if (/indoor/.test(o)) return 'indoor';
  if (/outdoor|picnic|park/.test(o)) return 'outdoor';
  return null;
};

const WORDS = {
  formal: /formal|blazer|suit|trouser|office|dress pant|oxford|tie\b/,
  casualTop: /t-?shirt|tee|polo|hoodie|sweatshirt|casual|crop|top\b/,
  denim: /jean|denim/,
  shorts: /short|bermuda|capri|skirt/,
  linen: /linen|cotton|shorts/,
  ethnic: /kurta|kurti|saree|sari|lehenga|ethnic|traditional|dhoti|pancha|sherwani|salwar|churidar|anarkali|langa|half saree|pyjama|veshti/,
  sport: /track|jogger|gym|sport|active|legging|athletic/,
  smart: /shirt|chino|polo|dress\b|blouse|kurti/,
  party: /party|sequin|satin|silk|blazer/,
  warm: /jacket|hoodie|sweat|sweater|coat|thermal|cardigan|fleece|shawl|blazer|woolen|woollen|wool/,
  lounge: /night|pyjama|pajama|lounge|sleep|track|jogger|short/,
  fullBottom: /jean|denim|trouser|pant|chino|legging|jogger/,
};
const LIGHT = new Set<Fam>(['white', 'lightblue', 'beige', 'yellow', 'pink', 'silver', 'grey']);
const BRIGHT_AUSPICIOUS = new Set<Fam>(['yellow', 'red', 'maroon', 'orange', 'green', 'pink']);

const itemText = (i: WardrobeItemResponse) =>
  `${i.name || ''} ${i.category || ''} ${i.subCategory || ''} ${i.subType || ''} ${i.wearType || ''} ${i.fabric || ''}`.toLowerCase();

// How well one item fits the occasion (roughly -3..+4)
export const occasionFit = (i: WardrobeItemResponse, key: OccKey | null): number => {
  if (!key) return 0;
  const t = itemText(i);
  const f = famOfItem(i);
  const has = (re: RegExp) => re.test(t);
  let s = 0;
  switch (key) {
    case 'beach':
      if (has(WORDS.shorts) || has(WORDS.linen) || has(WORDS.casualTop)) s += 2;
      if (f && LIGHT.has(f)) s += 1;
      if (has(WORDS.formal) || has(WORDS.ethnic)) s -= 3;
      if (f === 'black' || f === 'navy') s -= 1;
      break;
    case 'college':
      if (has(WORDS.casualTop) || has(WORDS.denim)) s += 2;
      if (has(WORDS.formal)) s -= 1;
      break;
    case 'date':
      if (has(WORDS.smart) || has(WORDS.denim)) s += 1.5;
      if (/casual|formal/.test(t)) s += 0.5;
      if (has(WORDS.sport) || has(WORDS.shorts)) s -= 2;
      break;
    case 'work':
    case 'interview':
      if (has(WORDS.formal) || /shirt/.test(t)) s += 2;
      if (has(WORDS.casualTop) || has(WORDS.shorts) || has(WORDS.sport)) s -= 2;
      if (key === 'interview' && f && ['white', 'lightblue', 'navy', 'grey', 'black', 'beige'].includes(f)) s += 1;
      break;
    case 'wedding':
    case 'festival':
    case 'temple':
      if (has(WORDS.ethnic)) s += 3;
      if (f && BRIGHT_AUSPICIOUS.has(f)) s += 1;
      if (has(WORDS.shorts) || has(WORDS.sport)) s -= 3;
      if (f === 'black') s -= 1;
      break;
    case 'gym':
      if (has(WORDS.sport) || has(WORDS.shorts) || /t-?shirt|tee/.test(t)) s += 3;
      if (has(WORDS.formal) || has(WORDS.denim) || has(WORDS.ethnic)) s -= 2;
      break;
    case 'party':
      if (has(WORDS.party) || has(WORDS.smart)) s += 1;
      if (f && ['black', 'maroon', 'navy', 'red', 'purple'].includes(f)) s += 1;
      if (has(WORDS.sport)) s -= 2;
      break;
    case 'hill':
      if (has(WORDS.warm)) s += 3;
      if (has(WORDS.fullBottom) && !has(WORDS.shorts)) s += 1.5;
      if (has(WORDS.shorts) || has(WORDS.linen)) s -= 2;
      break;
    case 'home':
      if (has(WORDS.lounge) || /t-?shirt|tee|cotton|kurti|hoodie/.test(t)) s += 2.5;
      if (has(WORDS.formal) || has(WORDS.party) || /saree|lehenga|sherwani/.test(t)) s -= 2;
      if (has(WORDS.denim)) s -= 0.5;
      break;
    case 'indoor':
      if (has(WORDS.casualTop) || /cotton|kurti|kurta|legging|pyjama|track/.test(t)) s += 1.5;
      if (has(WORDS.warm) && !/blazer/.test(t)) s -= 0.5;
      break;
    case 'outdoor':
      if (has(WORDS.casualTop) || has(WORDS.denim) || has(WORDS.linen) || /chino|polo/.test(t)) s += 1.5;
      if (f && LIGHT.has(f)) s += 0.5;
      if (/saree|lehenga|sherwani|blazer/.test(t)) s -= 1;
      break;
    case 'travel':
    case 'casual':
      if (has(WORDS.casualTop) || has(WORDS.denim) || /casual|daily/.test(t)) s += 1.5;
      if (has(WORDS.formal)) s -= 1;
      break;
  }
  return s;
};

// Occasion name in the chosen language
export const OCC_WORD: Record<AiLanguage, Record<OccKey, string>> = {
  English: { work: 'work', interview: 'an interview', college: 'college', date: 'a date', party: 'a party', wedding: 'a wedding / function', festival: 'the festival', temple: 'the temple', beach: 'the beach', gym: 'the gym', travel: 'travel', casual: 'a casual outing', hill: 'a hill station', home: 'home / night', indoor: 'indoors', outdoor: 'outdoors' },
  Telugu: { work: 'ఆఫీస్', interview: 'ఇంటర్వ్యూ', college: 'కాలేజ్', date: 'డేట్', party: 'పార్టీ', wedding: 'పెళ్లి / ఫంక్షన్', festival: 'పండుగ', temple: 'గుడి', beach: 'బీచ్', gym: 'జిమ్', travel: 'ప్రయాణం', casual: 'సరదా బయటకు వెళ్లడం', hill: 'హిల్ స్టేషన్', home: 'ఇంట్లో / రాత్రి', indoor: 'ఇంటి లోపల', outdoor: 'బయట' },
  Hindi: { work: 'ऑफिस', interview: 'इंटरव्यू', college: 'कॉलेज', date: 'डेट', party: 'पार्टी', wedding: 'शादी / फंक्शन', festival: 'त्योहार', temple: 'मंदिर', beach: 'बीच', gym: 'जिम', travel: 'सफ़र', casual: 'कैज़ुअल आउटिंग', hill: 'हिल स्टेशन', home: 'घर / रात', indoor: 'घर के अंदर', outdoor: 'बाहर' },
};
const OCC_LINE: Record<AiLanguage, string> = {
  English: 'Picked for {occ}.',
  Telugu: '{occ} కోసం ఎంచుకున్నది.',
  Hindi: '{occ} के लिए चुना गया।',
};

interface Scored {
  top: WardrobeItemResponse;
  bottom: WardrobeItemResponse;
  score: number;
  tf: Fam | null;
  bf: Fam | null;
}

const scorePair = (
  top: WardrobeItemResponse,
  bottom: WardrobeItemResponse,
  lucky: Set<Fam>,
  occasion?: string | null,
  nearSet: Set<Fam> = new Set(),
): Scored => {
  const tf = famOfItem(top);
  const bf = famOfItem(bottom);
  let score = 0;
  const tl = !!tf && lucky.has(tf);
  const bl = !!bf && lucky.has(bf);
  if (tl) score += nearSet.has(tf as Fam) ? 5 : 6;
  if (bl) score += nearSet.has(bf as Fam) ? 3 : 4;
  if (tf && bf) {
    const k = key(tf, bf);
    if (CLASSIC.has(k)) score += 3;
    if (CLASH.has(k)) score -= 5;
    if ((tl && NEUTRALS.has(bf)) || (bl && NEUTRALS.has(tf))) score += 2;
    if (tf === bf && !NEUTRALS.has(tf)) score += tl ? 0 : -2; // same bright colour head to toe
    if (NEUTRALS.has(tf) && NEUTRALS.has(bf) && tf !== bf) score += 1; // safe neutral pair
  } else {
    score -= 1; // colour unknown
  }
  // Occasion fit weighs about as much as the lucky colour, so the chip really changes the picks
  const k = occasionKey(occasion);
  if (k) score += 1.5 * (occasionFit(top, k) + occasionFit(bottom, k));
  return { top, bottom, score, tf, bf };
};

const explain = (s: Scored, lucky: Set<Fam>, v: VaaraColour, lang: AiLanguage, occasion?: string | null): string => {
  const W = COLOUR_WORD[lang];
  const L = LINES[lang];
  const { near } = luckyInfo(v);
  const luckyLine = (f: Fam, benefit: string) => {
    const n = near.get(f);
    return n
      ? fill(L.near, { c: cap(W[f]), lucky: colourNameWord(n, lang), benefit })
      : fill(L.lucky, { c: cap(W[f]), benefit });
  };
  const weekday = Math.max(0, WEEKDAYS.indexOf(v.weekday));
  const benefit = BENEFIT[lang][weekday];
  const tl = !!s.tf && lucky.has(s.tf);
  const bl = !!s.bf && lucky.has(s.bf);
  const word = (f: Fam | null) => (f ? W[f] : '');
  const parts: string[] = [];
  if (tl && bl && s.tf && s.bf) {
    parts.push(L.both);
    parts.push(luckyLine(s.tf, benefit));
  } else if (tl || bl) {
    const lf = (tl ? s.tf : s.bf) as Fam;
    const other = tl ? s.bf : s.tf;
    parts.push(luckyLine(lf, benefit));
    if (other && NEUTRALS.has(other)) parts.push(fill(L.neutral, { n: cap(word(other)), c: word(lf) }));
    else if (other && CLASSIC.has(key(lf, other))) parts.push(fill(L.classic, { a: cap(word(s.tf)), b: word(s.bf) }));
    else if (other) parts.push(fill(L.fresh, { a: cap(word(s.tf)), b: word(s.bf) }));
  } else {
    if (s.tf && s.bf && CLASSIC.has(key(s.tf, s.bf))) parts.push(fill(L.classic, { a: cap(word(s.tf)), b: word(s.bf) }));
    else if (s.tf && s.bf) parts.push(fill(L.fresh, { a: cap(word(s.tf)), b: word(s.bf) }));
    parts.push(fill(L.accent, { lucky: luckyColourWords(v, lang) }));
  }
  const ok = occasionKey(occasion);
  if (ok) parts.unshift(fill(OCC_LINE[lang], { occ: OCC_WORD[lang][ok] }));
  return parts.join(' ');
};

// Top + bottom pairs for today (3..5 when the wardrobe allows), best first. Each top / bottom is
// used at most twice so the list has variety. Pure function: no reads, works offline.
export const pickLuckyPairs = (
  items: WardrobeItemResponse[],
  language: AiLanguage,
  opts: { occasion?: string | null; date?: Date; max?: number } = {},
): LuckyPairsResult => {
  const vaara = getTodayVaaraColour(opts.date);
  const info = luckyInfo(vaara);
  const lucky = info.all;
  const nearSet = new Set<Fam>(info.near.keys());
  const catOf = (i: WardrobeItemResponse) => (TOP_CATS.has(i.category) || BOTTOM_CATS.has(i.category) ? i.category : normalizeCategory(i.category));
  const tops = items.filter(i => TOP_CATS.has(catOf(i)));
  const bottoms = items.filter(i => BOTTOM_CATS.has(catOf(i)));
  const max = Math.min(Math.max(opts.max ?? MAX_PAIRS, 1), MAX_PAIRS);
  const all: Scored[] = [];
  tops.forEach(t => bottoms.forEach(b => all.push(scorePair(t, b, lucky, opts.occasion, nearSet))));
  // Best first; ties: items with a photo, then newest
  const ts = (i: WardrobeItemResponse) => (i.createdAt ? Date.parse(i.createdAt) || 0 : 0);
  all.sort(
    (a, b) =>
      b.score - a.score ||
      Number(!!b.top.imageUrl && !!b.bottom.imageUrl) - Number(!!a.top.imageUrl && !!a.bottom.imageUrl) ||
      ts(b.top) + ts(b.bottom) - (ts(a.top) + ts(a.bottom)),
  );
  const used = new Map<string, number>();
  const picked: Scored[] = [];
  const take = (limitPerItem: number) => {
    for (const s of all) {
      if (picked.length >= max) return;
      if (picked.includes(s)) continue;
      if ((used.get(s.top.id) || 0) >= limitPerItem || (used.get(s.bottom.id) || 0) >= limitPerItem) continue;
      picked.push(s);
      used.set(s.top.id, (used.get(s.top.id) || 0) + 1);
      used.set(s.bottom.id, (used.get(s.bottom.id) || 0) + 1);
    }
  };
  take(2);
  if (picked.length < Math.min(MIN_PAIRS, max)) take(Number.MAX_SAFE_INTEGER); // small wardrobe: allow repeats
  return {
    vaara,
    tops: tops.length,
    bottoms: bottoms.length,
    pairs: picked.map(s => ({ top: s.top, bottom: s.bottom, score: s.score, why: explain(s, lucky, vaara, language, opts.occasion) })),
  };
};

// "What goes with black jeans?": classic matches for a colour, in the chosen language (null if unknown)
export const goesWith = (colourName: string, lang: AiLanguage): string[] | null => {
  const f = famOfName(colourName);
  if (!f) return null;
  const out: Fam[] = [];
  CLASSIC.forEach(k => {
    const [a, b] = k.split('+') as Fam[];
    if (a === f && b !== f) out.push(b);
    else if (b === f && a !== f) out.push(a);
  });
  return out.slice(0, 6).map(x => COLOUR_WORD[lang][x]);
};
export const colourWord = (name: string, lang: AiLanguage): string => colourNameWord(name, lang);
