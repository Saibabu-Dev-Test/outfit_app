// Offline intent parser + answers for the Stylist chat (English, Telugu script / romanized, Hindi).
// parseIntent("only 1 select for me") -> { count: 1, wantsPairs: true }, "beach ki emi veyyali" ->
// { occasion: 'Beach', wantsPairs: true }, "what goes with black jeans" -> { goesWith: 'black' }...
// Wardrobe picks, colour, "goes with", weather and festival questions are answered on the phone;
// only other questions go to the free Gemini path (when configured), with these as the fallback.
import type { AiLanguage } from './aiStylist';
import { colourWord, goesWith, luckyColourWords } from './luckyPairs';
import type { VaaraColour } from '../utils/panchangam';

export interface StylistIntent {
  count: number | null; // how many pairs the user asked for (1..3)
  occasion: string | null; // an OCCASIONS value
  wantsPairs: boolean; // "what should I wear / pick for me"
  colourQ: boolean; // "what colour suits me / today"
  goesWith: string | null; // colour in "what goes with black jeans"
  weather: 'hot' | 'rain' | 'cold' | null;
}

const OCC_PATTERNS: [RegExp, string][] = [
  [/interview|ఇంటర్వ్యూ|इंटरव्यू/i, 'Interview'],
  [/\bbeach|samudram|sea ?side|బీచ్|సముద్ర|बीच|समुद्र/i, 'Beach'],
  [/college|campus|class\b|school|కాలేజ్|కాలేజీ|कॉलेज/i, 'College'],
  [/\bdate\b|\bdate ki\b|డేట్|डेट/i, 'Date'],
  [/party|పార్టీ|पार्टी/i, 'Party'],
  [/wedding|marriage|reception|pelli|function|ఫంక్షన్|పెళ్లి|शादी|विवाह/i, 'Wedding / Function'],
  [/festival|panduga|pandaga|diwali|deepavali|sankranti|ugadi|dasara|dussehra|holi|పండుగ|पर्व|त्योहार|त्यौहार/i, 'Festival'],
  [/temple|gudi|\bpuja\b|pooja|గుడి|ఆలయ|मंदिर/i, 'Temple'],
  [/\bgym\b|workout|exercise|jogging|జిమ్|जिम/i, 'Gym'],
  [/travel|trip|journey|flight|train|ప్రయాణ|యాత్ర|यात्रा|सफ़र|सफर/i, 'Travel'],
  [/office|\bwork\b|meeting|ఆఫీస్|ऑफिस|दफ़्तर/i, 'Work'],
  [/outing|movie|cinema|mall|hangout|casual|సినిమా|घूमने/i, 'Casual outing'],
];

const ONE = /\b(only|just)\s*(1|one)\b|\b(1|one)\s*(pair|outfit|look|option|select|choice)\b|\bpick (one|1)\b|\bselect (one|1)\b|\bbest (one|1)\b|\bany one\b|okk?ati|okka(t?)\b|ఒక్కటి|ఒకటి|ఒక్క|\bek hi\b|\bsirf ek\b|\bek (hi )?(chun|select|pick)|एक ही|सिर्फ़? एक|कोई एक/i;
const TWO = /\b(2|two)\s*(pairs|outfits|options|looks)\b|రెండు|\bdo (pair|outfit)|दो/i;
const THREE = /\b(3|three)\s*(pairs|outfits|options|looks)\b|మూడు|\bteen\b|तीन/i;
const WEAR = /wear|outfit|dress|clothes|suggest|recommend|select|pick|choose|style me|veyyali|veyali|vesko|vesuko|vesukovali|ఏం వేసుకో|ఏమి వేసు|వేసుకోవాలి|వేయాలి|ఎంచుకో|pehn|pahan|पहन|कपड़े|चुन/i;
const COLOUR_Q = /(what|which)\s+colou?rs?|colou?rs?\s+(suit|for me|today|lucky)|lucky colou?r|ఏ రంగు|రంగు ఏది|ఏ కలర్|కలర్|कौन ?सा रंग|कौनसा रंग|रंग|\brang\b/i;
const COLOURS = 'black|white|blue|navy|red|maroon|green|olive|yellow|mustard|orange|pink|purple|grey|gray|beige|khaki|brown|cream|silver|gold|sky blue|light blue';
const GOES_WITH = new RegExp(`(?:goes?|go|match(?:es)?|pair|wear|combine)\\s+(?:well\\s+)?with\\s+(?:my\\s+|a\\s+)?(${COLOURS})|(${COLOURS})\\s+(?:jeans|pants|trousers|shirt|t-?shirt|kurta|top|saree|skirt|shoes|chinos|shorts)\\s*(?:ki|ke|tho|తో|के साथ|ke saath|with)?\\s*(?:emi|ఏం|ఏమి|kya|क्या|what|which)`, 'i');
const HOT = /\bhot\b|summer|heat|sunny|endalu|ఎండ|వేడి|गर्मी|धूप/i;
const RAIN = /rain|monsoon|varsham|వర్ష|बारिश|बरसात/i;
const COLD = /\bcold\b|winter|chali|చలి|ठंड|सर्दी/i;

export const parseIntent = (raw: string): StylistIntent => {
  const t = (raw || '').trim();
  const occ = OCC_PATTERNS.find(([re]) => re.test(t));
  const gw = GOES_WITH.exec(t);
  const count = ONE.test(t) ? 1 : TWO.test(t) ? 2 : THREE.test(t) ? 3 : null;
  const weather = RAIN.test(t) ? 'rain' : HOT.test(t) ? 'hot' : COLD.test(t) ? 'cold' : null;
  const goes = gw ? (gw[1] || gw[2] || '').toLowerCase() : null;
  const colourQ = !goes && COLOUR_Q.test(t);
  return {
    count,
    occasion: occ ? occ[1] : null,
    wantsPairs: count !== null || !!occ || (WEAR.test(t) && !goes && !colourQ),
    colourQ,
    goesWith: goes,
    weather,
  };
};

const W: Record<AiLanguage, Record<string, string>> = {
  English: {
    colour: "Today's lucky colour is {c}. {why} Wear it as the main piece, or as a small accent with a calm neutral like white, beige or navy.",
    goes: '{c} goes well with {list}. Neutrals keep it classic; a touch of today\'s lucky {lucky} adds luck.',
    hot: 'For the heat: light cotton or linen, loose fits and light colours like white, beige or sky blue. Add sunglasses and breathable sandals.',
    rain: 'For rain: quick-dry fabrics, darker bottoms that hide splashes, no long hems, and waterproof sandals or floaters.',
    cold: 'For the cold: layer a hoodie, jacket or shawl over a full-sleeve top, with jeans or warm trousers and closed shoes.',
    pairsFor: 'Here {n} for {occ} from your wardrobe 👇',
    pairsToday: "Here {n} from your wardrobe for today's lucky colour 👇",
    one: 'is my best pick',
    many: 'are my top picks',
  },
  Telugu: {
    colour: 'ఈ రోజు అదృష్ట రంగు {c}. {why} దీన్ని ప్రధాన దుస్తుగా, లేదా తెలుపు, లేత గోధుమ, ముదురు నీలం వంటి ప్రశాంత రంగుతో చిన్న టచ్‌గా వేసుకోండి.',
    goes: '{c} తో {list} బాగా సరిపోతాయి. న్యూట్రల్స్ క్లాసిక్‌గా ఉంటాయి; ఈ రోజు అదృష్ట రంగు {lucky} కొంచెం జత చేస్తే అదృష్టం.',
    hot: 'ఎండకు: తేలికపాటి కాటన్ లేదా లినెన్, వదులు దుస్తులు, తెలుపు, లేత గోధుమ, లేత నీలం రంగులు. సన్‌గ్లాసెస్, గాలి తగిలే చెప్పులు.',
    rain: 'వర్షానికి: త్వరగా ఆరే బట్టలు, మరకలు కనిపించని ముదురు బాటమ్స్, పొడవాటి అంచులు వద్దు, వాటర్‌ప్రూఫ్ చెప్పులు.',
    cold: 'చలికి: ఫుల్ స్లీవ్ టాప్ మీద హూడీ, జాకెట్ లేదా శాలువా, జీన్స్ లేదా వెచ్చని ప్యాంట్, మూసి ఉండే షూస్.',
    pairsFor: '{occ} కోసం మీ వార్డ్‌రోబ్ నుండి {n} 👇',
    pairsToday: 'ఈ రోజు అదృష్ట రంగుకు మీ వార్డ్‌రోబ్ నుండి {n} 👇',
    one: 'నా బెస్ట్ ఎంపిక',
    many: 'నా టాప్ ఎంపికలు',
  },
  Hindi: {
    colour: 'आज का शुभ रंग {c} है। {why} इसे मुख्य कपड़े में पहनें, या सफ़ेद, बेज या गहरे नीले जैसे शांत रंग के साथ छोटे टच में।',
    goes: '{c} के साथ {list} अच्छे लगते हैं। न्यूट्रल रंग क्लासिक रहते हैं; आज के शुभ रंग {lucky} का छोटा टच शुभ रहेगा।',
    hot: 'गर्मी के लिए: हल्का कॉटन या लिनन, ढीले कपड़े और सफ़ेद, बेज, हल्का नीला जैसे हल्के रंग। सनग्लास और हवादार सैंडल।',
    rain: 'बारिश के लिए: जल्दी सूखने वाले कपड़े, छींटे छिपाने वाले गहरे बॉटम, लंबे किनारे नहीं, वॉटरप्रूफ़ सैंडल।',
    cold: 'ठंड के लिए: फुल स्लीव टॉप पर हुडी, जैकेट या शॉल, जींस या गर्म पैंट और बंद जूते।',
    pairsFor: '{occ} के लिए आपके वॉर्डरोब से {n} 👇',
    pairsToday: 'आज के शुभ रंग के लिए आपके वॉर्डरोब से {n} 👇',
    one: 'मेरी सबसे अच्छी पसंद',
    many: 'मेरी टॉप पसंद',
  },
};
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

// Line above the pairs card ("Here is my best pick for the beach")
export const pairsIntro = (lang: AiLanguage, count: number, occWord: string | null): string => {
  const n = count === 1 ? W[lang].one : W[lang].many;
  return occWord ? fill(W[lang].pairsFor, { n, occ: occWord }) : fill(W[lang].pairsToday, { n });
};

// Text answer for colour / goes-with / weather questions; null = not an offline question
export const offlineAnswer = (intent: StylistIntent, lang: AiLanguage, vaara: VaaraColour): string | null => {
  const lucky = luckyColourWords(vaara, lang);
  if (intent.goesWith) {
    const list = goesWith(intent.goesWith, lang);
    if (list && list.length) return fill(W[lang].goes, { c: colourWord(intent.goesWith, lang), list: list.join(', '), lucky });
  }
  if (intent.colourQ) return fill(W[lang].colour, { c: lucky, why: lang === 'English' ? vaara.why : '' }).replace('  ', ' ');
  if (intent.weather) return W[lang][intent.weather];
  return null;
};
