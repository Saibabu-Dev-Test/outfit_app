// Pelli Porutham (marriage compatibility): the traditional South Indian 10 poruthams worked out
// from the bride's and groom's birth star (nakshatra 0..26) and moon sign (rashi 0..11).
// Pure functions, no network. Counting is from the bride's star / rashi to the groom's, as is
// customary. This is traditional guidance only, not a prediction.
import { GANA, YONI_OF } from './jathakam';
import { NAKSHATRAS, NAKSHATRAS_TE, RASHI_EN, RASHI_LORD, RASHI_TE } from './astro';

export interface PoruthamPerson {
  nakshatra: number; // 0..26
  rashi: number; // 0..11
}

export type PoruthamKey =
  | 'dina'
  | 'gana'
  | 'mahendra'
  | 'streeDeergha'
  | 'yoni'
  | 'rasi'
  | 'rasyadhipathi'
  | 'vasya'
  | 'rajju'
  | 'vedha';

export interface PoruthamResult {
  key: PoruthamKey;
  name: { en: string; te: string };
  match: boolean;
  why: { en: string; te: string }; // one line
}

export type PoruthamVerdict = 'good' | 'fair' | 'low';

export interface PoruthamReport {
  results: PoruthamResult[];
  score: number; // matches out of 10
  total: 10;
  rajjuOk: boolean;
  vedhaOk: boolean;
  verdict: PoruthamVerdict;
  verdictText: { en: string; te: string };
}

export const PORUTHAM_NAMES: Record<PoruthamKey, { en: string; te: string }> = {
  dina: { en: 'Dina', te: 'దిన' },
  gana: { en: 'Gana', te: 'గణ' },
  mahendra: { en: 'Mahendra', te: 'మాహేంద్ర' },
  streeDeergha: { en: 'Stree Deergha', te: 'స్త్రీ దీర్ఘ' },
  yoni: { en: 'Yoni', te: 'యోని' },
  rasi: { en: 'Rasi', te: 'రాశి' },
  rasyadhipathi: { en: 'Rasyadhipathi', te: 'రాశ్యాధిపతి' },
  vasya: { en: 'Vasya', te: 'వశ్య' },
  rajju: { en: 'Rajju', te: 'రజ్జు' },
  vedha: { en: 'Vedha', te: 'వేధ' },
};

const valid = (p: PoruthamPerson) =>
  Number.isInteger(p.nakshatra) && p.nakshatra >= 0 && p.nakshatra < 27 && Number.isInteger(p.rashi) && p.rashi >= 0 && p.rashi < 12;

// The rashi(s) a nakshatra falls in (a star spans 4 padas of 3°20'; some cross a sign boundary)
export const rashisOfNakshatra = (n: number): number[] => {
  const a = Math.floor((n * 4) / 9);
  const b = Math.floor((n * 4 + 3) / 9);
  return a === b ? [a] : [a, b];
};
export const nakshatraInRashi = (n: number, r: number) => rashisOfNakshatra(n).includes(r);

// Bride's star counted to the groom's (1..27; 1 = same star)
export const starCount = (bride: number, groom: number) => ((groom - bride + 27) % 27) + 1;
// Bride's rashi counted to the groom's (1..12; 1 = same rashi)
export const rashiCount = (bride: number, groom: number) => ((groom - bride + 12) % 12) + 1;

// Dina (Tara): good counts from the bride's star
const DINA_GOOD = new Set([2, 4, 6, 8, 9, 11, 13, 15, 18, 20, 24, 26]);
const MAHENDRA_GOOD = new Set([4, 7, 10, 13, 16, 19, 22, 25]);
// Yoni enemies (animal pairs): Horse-Buffalo, Elephant-Lion, Goat-Monkey, Serpent-Mongoose,
// Dog-Deer, Cat-Rat, Cow-Tiger (indexes as in jathakam YONI_EN)
const YONI_ENEMY: [number, number][] = [[0, 8], [1, 13], [2, 11], [3, 12], [4, 10], [5, 6], [7, 9]];
export const yoniEnemies = (a: number, b: number) => YONI_ENEMY.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
// Rasi: 2-12 (dwirdwadasa) and 6-8 (shashtashtaka) positions are avoided
const RASI_BAD = new Set([2, 6, 8, 12]);
// Natural planet friendships (0 Sun, 1 Moon, 2 Mars, 3 Mercury, 4 Jupiter, 5 Venus, 6 Saturn):
// the planets each one regards as an enemy
const PLANET_ENEMIES: number[][] = [
  [5, 6], // Sun
  [], // Moon
  [3], // Mars
  [1], // Mercury
  [3, 5], // Jupiter
  [0, 1], // Venus
  [0, 1, 2], // Saturn
];
export const lordsInEnmity = (a: number, b: number) => a !== b && (PLANET_ENEMIES[a].includes(b) || PLANET_ENEMIES[b].includes(a));
// Vasya: the rashis each rashi attracts
const VASYA: number[][] = [
  [4, 7], // Mesha: Simha, Vrischika
  [3, 6], // Vrishabha: Karka, Tula
  [5], // Mithuna: Kanya
  [7, 8], // Karka: Vrischika, Dhanu
  [6], // Simha: Tula
  [2, 11], // Kanya: Mithuna, Meena
  [9, 5], // Tula: Makara, Kanya
  [3], // Vrischika: Karka
  [11], // Dhanu: Meena
  [0, 10], // Makara: Mesha, Kumbha
  [0], // Kumbha: Mesha
  [9], // Meena: Makara
];
export const isVasya = (a: number, b: number) => a === b || VASYA[a].includes(b) || VASYA[b].includes(a);
// Rajju: 0 Pada (feet), 1 Kati (waist), 2 Nabhi (navel), 3 Kantha (neck), 4 Siro (head)
const RAJJU_CYCLE = [0, 1, 2, 3, 4, 3, 2, 1, 0];
export const rajjuOf = (n: number) => RAJJU_CYCLE[n % 9];
const RAJJU_NAMES = [
  { en: 'Pada (feet)', te: 'పాద' },
  { en: 'Kati (waist)', te: 'కటి' },
  { en: 'Nabhi (navel)', te: 'నాభి' },
  { en: 'Kantha (neck)', te: 'కంఠ' },
  { en: 'Siro (head)', te: 'శిరో' },
];
// Vedha: star pairs that obstruct each other (Mrigashira, Chitra, Dhanishta all with each other)
const VEDHA: [number, number][] = [
  [0, 17], [1, 16], [2, 15], [3, 14], [5, 21], [6, 20], [7, 19], [8, 18], [9, 26], [10, 25], [11, 24], [12, 23],
  [4, 13], [4, 22], [13, 22],
];
export const isVedha = (a: number, b: number) => VEDHA.some(([x, y]) => (a === x && b === y) || (a === y && b === x));

const GANA_EN = ['Deva', 'Manushya', 'Rakshasa'];
const GANA_TE = ['దేవ', 'మనుష్య', 'రాక్షస'];

const res = (key: PoruthamKey, match: boolean, en: string, te: string): PoruthamResult => ({
  key,
  name: PORUTHAM_NAMES[key],
  match,
  why: { en, te },
});

export const computePorutham = (bride: PoruthamPerson, groom: PoruthamPerson): PoruthamReport => {
  if (!valid(bride) || !valid(groom)) throw new Error('Invalid nakshatra / rashi');
  const c = starCount(bride.nakshatra, groom.nakshatra);
  const r = rashiCount(bride.rashi, groom.rashi);
  const results: PoruthamResult[] = [];

  const dina = DINA_GOOD.has(c);
  results.push(
    res(
      'dina',
      dina,
      `Groom's star is ${c} from the bride's: ${dina ? 'favours health and daily harmony' : 'not among the favourable counts'}.`,
      `వరుని నక్షత్రం వధువు నుండి ${c}వది: ${dina ? 'ఆరోగ్యం, రోజువారీ సఖ్యతకు అనుకూలం' : 'అనుకూల సంఖ్యలలో లేదు'}.`,
    ),
  );

  const gb = GANA[bride.nakshatra];
  const gg = GANA[groom.nakshatra];
  const gana = gb === gg || (gb !== 2 && gg !== 2);
  results.push(
    res(
      'gana',
      gana,
      `${GANA_EN[gb]} and ${GANA_EN[gg]} gana: ${gana ? 'temperaments blend well' : 'temperaments may clash'}.`,
      `${GANA_TE[gb]} - ${GANA_TE[gg]} గణం: ${gana ? 'స్వభావాలు కలుస్తాయి' : 'స్వభావాలు భిన్నంగా ఉండవచ్చు'}.`,
    ),
  );

  const mahendra = MAHENDRA_GOOD.has(c);
  results.push(
    res(
      'mahendra',
      mahendra,
      mahendra ? `Count ${c} is a Mahendra count: blesses children and prosperity.` : `Count ${c} is not a Mahendra count (4, 7, 10, ...).`,
      mahendra ? `${c}వ సంఖ్య మాహేంద్రం: సంతానం, సంపదకు శుభం.` : `${c}వ సంఖ్య మాహేంద్ర సంఖ్య కాదు (4, 7, 10, ...).`,
    ),
  );

  const stree = c > 13;
  results.push(
    res(
      'streeDeergha',
      stree,
      stree ? `Groom's star is well beyond the bride's (${c} > 13): good for her well-being.` : `Groom's star is close to the bride's (${c}, needs more than 13).`,
      stree ? `వరుని నక్షత్రం వధువుకు దూరంగా ఉంది (${c} > 13): ఆమె శ్రేయస్సుకు మంచిది.` : `వరుని నక్షత్రం దగ్గరగా ఉంది (${c}, 13 కంటే ఎక్కువ కావాలి).`,
    ),
  );

  const yb = YONI_OF[bride.nakshatra];
  const yg = YONI_OF[groom.nakshatra];
  const yoni = !yoniEnemies(yb, yg);
  results.push(
    res(
      'yoni',
      yoni,
      yoni ? 'Yoni animals are not enemies: physical harmony is favoured.' : 'Yoni animals are natural enemies: physical harmony is weaker.',
      yoni ? 'యోని జంతువులు శత్రువులు కావు: శారీరక సఖ్యతకు అనుకూలం.' : 'యోని జంతువులు సహజ శత్రువులు: శారీరక సఖ్యత తక్కువ.',
    ),
  );

  const rasi = !RASI_BAD.has(r);
  results.push(
    res(
      'rasi',
      rasi,
      rasi ? `Groom's rashi is ${r} from the bride's: supports family growth.` : `Groom's rashi is ${r} from the bride's (2-12 / 6-8 positions are avoided).`,
      rasi ? `వరుని రాశి వధువు రాశి నుండి ${r}వది: వంశాభివృద్ధికి అనుకూలం.` : `వరుని రాశి వధువు నుండి ${r}వది (ద్విర్ద్వాదశ / షష్టాష్టకం వర్జ్యం).`,
    ),
  );

  const lb = RASHI_LORD[bride.rashi];
  const lg = RASHI_LORD[groom.rashi];
  const adhi = !lordsInEnmity(lb, lg);
  results.push(
    res(
      'rasyadhipathi',
      adhi,
      adhi ? 'The two rashi lords are friendly or neutral: good understanding.' : 'The two rashi lords are enemies: views may differ.',
      adhi ? 'రెండు రాశుల అధిపతులు మిత్రులు / సములు: మంచి అవగాహన.' : 'రెండు రాశుల అధిపతులు శత్రువులు: అభిప్రాయ భేదాలు రావచ్చు.',
    ),
  );

  const vasya = isVasya(bride.rashi, groom.rashi);
  results.push(
    res(
      'vasya',
      vasya,
      vasya ? 'The rashis attract each other: mutual affection.' : 'No natural attraction between the rashis.',
      vasya ? 'రాశుల మధ్య ఆకర్షణ ఉంది: పరస్పర ప్రేమ.' : 'రాశుల మధ్య సహజ ఆకర్షణ లేదు.',
    ),
  );

  const rb = rajjuOf(bride.nakshatra);
  const rg = rajjuOf(groom.nakshatra);
  const rajju = rb !== rg;
  results.push(
    res(
      'rajju',
      rajju,
      rajju
        ? `Different rajju (${RAJJU_NAMES[rb].en}, ${RAJJU_NAMES[rg].en}): considered important and favourable.`
        : `Both stars are in ${RAJJU_NAMES[rb].en} rajju: traditionally given the most weight.`,
      rajju
        ? `వేర్వేరు రజ్జువులు (${RAJJU_NAMES[rb].te}, ${RAJJU_NAMES[rg].te}): ముఖ్యమైనది, అనుకూలం.`
        : `ఇద్దరిదీ ${RAJJU_NAMES[rb].te} రజ్జువు: సంప్రదాయంలో దీనికి ఎక్కువ ప్రాధాన్యం.`,
    ),
  );

  const vedha = !isVedha(bride.nakshatra, groom.nakshatra);
  results.push(
    res(
      'vedha',
      vedha,
      vedha ? 'The stars do not obstruct each other.' : 'These two stars form a Vedha (mutual obstruction) pair.',
      vedha ? 'నక్షత్రాల మధ్య వేధ లేదు.' : 'ఈ రెండు నక్షత్రాలు వేధ జంట (పరస్పర అడ్డంకి).',
    ),
  );

  const score = results.filter(x => x.match).length;
  const verdict: PoruthamVerdict = score >= 7 && rajju && vedha ? 'good' : score >= 5 ? 'fair' : 'low';
  const caution = !rajju || !vedha;
  const verdictText = {
    good: {
      en: `${score}/10 poruthams match: a traditionally favourable pairing.`,
      te: `${score}/10 పొరుత్తాలు కుదిరాయి: సంప్రదాయంగా అనుకూలమైన జంట.`,
    },
    fair: {
      en: `${score}/10 poruthams match: a fair match${caution ? '; families usually look closer at Rajju / Vedha' : ''}.`,
      te: `${score}/10 పొరుత్తాలు కుదిరాయి: సామాన్యంగా సరిపోతుంది${caution ? '; రజ్జు / వేధ గురించి పెద్దలను సంప్రదించండి' : ''}.`,
    },
    low: {
      en: `${score}/10 poruthams match: fewer than usual. Many happy couples have low scores; talk it over with elders.`,
      te: `${score}/10 పొరుత్తాలు మాత్రమే కుదిరాయి. తక్కువ పొంతనతో కూడా ఎన్నో జంటలు సంతోషంగా ఉన్నాయి; పెద్దలతో మాట్లాడండి.`,
    },
  }[verdict];

  return { results, score, total: 10, rajjuOk: rajju, vedhaOk: vedha, verdict, verdictText };
};

export const PORUTHAM_DISCLAIMER = {
  en: 'Traditional guidance only, for fun and reflection. Compatibility is built by two people, not by stars.',
  te: 'ఇది కేవలం సంప్రదాయ మార్గదర్శనం మాత్రమే. అనుబంధాన్ని నిర్మించేది ఇద్దరు వ్యక్తులే, నక్షత్రాలు కాదు.',
};

export const nakshatraLabel = (n: number) => `${NAKSHATRAS[n]} · ${NAKSHATRAS_TE[n]}`;
export const rashiLabel = (r: number) => `${RASHI_EN[r]} · ${RASHI_TE[r]}`;
