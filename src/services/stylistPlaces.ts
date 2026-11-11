// Offline "what suits this place / occasion" guide for the Stylist chips (no AI, no network).
// Every Occasion and Place chip gets an answer, even with an empty wardrobe:
//   - what would suit best there ("Shorts and a light linen shirt would be best for the beach"),
//   - whether the wardrobe already has it ("Your White Linen shirt fits the beach well 👍"),
//     else what to add ("Add shorts to your wardrobe") and the closest item the user owns now,
//   - one practical tip (shoes / accessories / weather) and today's lucky-colour touch.
// Wardrobe top + bottom pairs come from services/luckyPairs.ts (lucky colour + colour harmony).
import type { WardrobeItemResponse } from './wardrobeApi';
import type { AiLanguage } from './aiStylist';
import { LuckyPairsResult, luckyColourWords, OCC_WORD, occasionFit, occasionKey, OccKey, pickLuckyPairs } from './luckyPairs';
import { getTodayVaaraColour } from '../utils/panchangam';

export { ALL_CHIPS, OCCASIONS, PLACES } from './stylistChips';

type L3 = Record<AiLanguage, string>;
type Test = (t: string) => boolean;
interface Need {
  test: Test;
  name: L3; // what to add when missing
}
interface Guide {
  ideal: L3; // what suits best (the subject of "would be best for ...")
  needs: Need[];
  tip: L3;
}

const noTee = (t: string) => t.replace(/t-?shirts?|sweatshirts?/g, ' ');
const noTrack = (t: string) => t.replace(/track ?pants?/g, ' ');
const R = (re: RegExp): Test => t => re.test(t);

const ETHNIC = /kurta|kurti|saree|sari\b|lehenga|ethnic|traditional|dhoti|pancha|sherwani|salwar|churidar|anarkali|langa|half saree|veshti|dupatta|silk/;
const T = {
  formalTop: (t: string) => /blazer|formal|blouse|kurti/.test(t) || /shirt/.test(noTee(t)),
  formalBottom: (t: string) => /trouser|chino|formal|skirt/.test(t) || /pant/.test(noTrack(t)),
  casualTop: R(/t-?shirt|tee\b|polo|top\b|tops\b|shirt|kurti|hoodie|sweatshirt|crop/),
  denimOrPants: (t: string) => /jean|denim|chino|trouser|skirt/.test(t) || /pant/.test(noTrack(t)),
  lightTop: R(/linen|cotton|t-?shirt|tee\b|tank|vest|polo|top\b|tops\b|crop|beach|half sleeve/),
  shorts: R(/short|bermuda|capri|swim|beach|sarong/),
  warmTop: R(/jacket|hoodie|sweat|sweater|coat|thermal|cardigan|fleece|shawl|blazer|wool/),
  fullBottom: (t: string) => !/short/.test(t) && /jean|denim|trouser|pant|chino|legging|jogger/.test(t),
  sleepBottom: R(/night|pyjama|pajama|lounge|sleep|track|jogger|short/),
  softTop: R(/t-?shirt|tee\b|hoodie|sweatshirt|night|lounge|cotton|top\b|tops\b|kurti/),
  sportTop: R(/t-?shirt|tee\b|tank|vest|sport|gym|dry ?fit|active|jersey/),
  sportBottom: R(/track|jogger|short|legging|gym|sport|active|athletic/),
  ethnic: R(ETHNIC),
  partyTop: R(/party|satin|silk|sequin|blazer|shirt|top\b|tops\b|dress/),
  comfyBottom: R(/jean|denim|jogger|track|chino|pant|legging|cargo/),
};

const N = (en: string, te: string, hi: string): L3 => ({ English: en, Telugu: te, Hindi: hi });

const GUIDE: Record<OccKey, Guide> = {
  beach: {
    ideal: N('Shorts and a light linen or cotton shirt', 'షార్ట్స్, తేలికపాటి లినెన్ లేదా కాటన్ షర్ట్', 'शॉर्ट्स और हल्की लिनन या कॉटन शर्ट'),
    needs: [
      { test: T.shorts, name: N('shorts', 'షార్ట్స్', 'शॉर्ट्स') },
      { test: T.lightTop, name: N('a light linen / cotton shirt or tee', 'తేలికపాటి లినెన్ / కాటన్ షర్ట్ లేదా టీ-షర్ట్', 'हल्की लिनन / कॉटन शर्ट या टी-शर्ट') },
    ],
    tip: N('Flip-flops, sunglasses and a cap; light colours stay cool, and beachwear dries fast.', 'ఫ్లిప్-ఫ్లాప్స్, సన్‌గ్లాసెస్, క్యాప్; లేత రంగులు చల్లగా ఉంటాయి, బీచ్‌వేర్ త్వరగా ఆరుతుంది.', 'फ्लिप-फ्लॉप, सनग्लास और कैप; हल्के रंग ठंडे रहते हैं, बीचवियर जल्दी सूखता है।'),
  },
  home: {
    ideal: N('Night pants / a pyjama set with a soft cotton tee', 'నైట్ ప్యాంట్ / పైజామా సెట్, మెత్తని కాటన్ టీ-షర్ట్', 'नाइट पैंट / पजामा सेट और मुलायम कॉटन टी-शर्ट'),
    needs: [
      { test: T.sleepBottom, name: N('night pants or a pyjama set', 'నైట్ ప్యాంట్ లేదా పైజామా సెట్', 'नाइट पैंट या पजामा सेट') },
      { test: T.softTop, name: N('a soft cotton T-shirt', 'మెత్తని కాటన్ టీ-షర్ట్', 'मुलायम कॉटन टी-शर्ट') },
    ],
    tip: N('Loose, breathable cotton helps you relax and sleep well; keep soft slippers nearby.', 'వదులుగా, గాలి తగిలే కాటన్ బట్టలు విశ్రాంతికి, మంచి నిద్రకు సహాయపడతాయి; మెత్తని చెప్పులు దగ్గర ఉంచుకోండి.', 'ढीले, हवादार कॉटन कपड़े आराम और अच्छी नींद में मदद करते हैं; मुलायम चप्पल पास रखें।'),
  },
  hill: {
    ideal: N('A warm jacket or hoodie with full pants (jeans or trousers)', 'వెచ్చని జాకెట్ లేదా హూడీ, ఫుల్ ప్యాంట్ (జీన్స్ లేదా ట్రౌజర్)', 'गर्म जैकेट या हुडी और फुल पैंट (जींस या ट्राउज़र)'),
    needs: [
      { test: T.warmTop, name: N('a warm jacket or hoodie', 'వెచ్చని జాకెట్ లేదా హూడీ', 'गर्म जैकेट या हुडी') },
      { test: T.fullBottom, name: N('full pants (jeans / trousers)', 'ఫుల్ ప్యాంట్ (జీన్స్ / ట్రౌజర్)', 'फुल पैंट (जींस / ट्राउज़र)') },
    ],
    tip: N('Layer up: full-sleeve top, jacket, socks and closed shoes with a good grip; carry a cap or scarf.', 'పొరలుగా వేసుకోండి: ఫుల్ స్లీవ్ టాప్, జాకెట్, సాక్స్, గ్రిప్ ఉన్న మూసి ఉండే షూస్; క్యాప్ లేదా స్కార్ఫ్ తీసుకెళ్లండి.', 'परतों में पहनें: फुल स्लीव टॉप, जैकेट, मोज़े और अच्छी पकड़ वाले बंद जूते; कैप या स्कार्फ़ साथ रखें।'),
  },
  temple: {
    ideal: N('Ethnic wear (kurta-pyjama, saree or salwar) in a bright, auspicious colour', 'ఎథ్నిక్ వేర్ (కుర్తా-పైజామా, చీర లేదా సల్వార్) ప్రకాశవంతమైన శుభ రంగులో', 'एथनिक वियर (कुर्ता-पजामा, साड़ी या सलवार) किसी चमकीले, शुभ रंग में'),
    needs: [{ test: T.ethnic, name: N('a kurta or saree / salwar set', 'కుర్తా లేదా చీర / సల్వార్ సెట్', 'कुर्ता या साड़ी / सलवार सेट') }],
    tip: N('Covered shoulders and knees, easy slip-on footwear, and avoid all-black.', 'భుజాలు, మోకాళ్లు కప్పే దుస్తులు, సులువుగా విప్పే చెప్పులు; పూర్తిగా నలుపు వద్దు.', 'कंधे और घुटने ढके रहें, आसानी से उतरने वाले जूते-चप्पल, और पूरा काला न पहनें।'),
  },
  wedding: {
    ideal: N('Rich ethnic wear: kurta / sherwani, silk saree or lehenga', 'రిచ్ ఎథ్నిక్ వేర్: కుర్తా / షేర్వాణీ, పట్టు చీర లేదా లెహంగా', 'शानदार एथनिक वियर: कुर्ता / शेरवानी, सिल्क साड़ी या लहंगा'),
    needs: [{ test: T.ethnic, name: N('a festive kurta, sherwani, silk saree or lehenga', 'పండుగ కుర్తా, షేర్వాణీ, పట్టు చీర లేదా లెహంగా', 'फेस्टिव कुर्ता, शेरवानी, सिल्क साड़ी या लहंगा') }],
    tip: N('Jewel tones like maroon, gold, green or royal blue look grand; add ethnic footwear.', 'మెరూన్, బంగారు, ఆకుపచ్చ, రాయల్ బ్లూ వంటి రంగులు గ్రాండ్‌గా ఉంటాయి; ఎథ్నిక్ చెప్పులు జత చేయండి.', 'मैरून, सुनहरा, हरा या रॉयल ब्लू जैसे रंग शानदार लगते हैं; एथनिक फुटवियर पहनें।'),
  },
  festival: {
    ideal: N('Traditional wear: a kurta, saree or half saree in a festive colour', 'సంప్రదాయ దుస్తులు: పండుగ రంగులో కుర్తా, చీర లేదా లంగా ఓణీ', 'पारंपरिक कपड़े: त्योहार के रंग में कुर्ता, साड़ी या लहंगा-चुनरी'),
    needs: [{ test: T.ethnic, name: N('a kurta or saree', 'కుర్తా లేదా చీర', 'कुर्ता या साड़ी') }],
    tip: N('Yellow, red, green or orange feel festive; add a little traditional jewellery.', 'పసుపు, ఎరుపు, ఆకుపచ్చ, నారింజ పండుగకు బాగుంటాయి; కొంచెం సంప్రదాయ నగలు జత చేయండి.', 'पीला, लाल, हरा या नारंगी त्योहार जैसा लगता है; थोड़े पारंपरिक गहने जोड़ें।'),
  },
  work: {
    ideal: N('A formal shirt with trousers or chinos', 'ఫార్మల్ షర్ట్, ట్రౌజర్ లేదా చినోస్', 'फॉर्मल शर्ट के साथ ट्राउज़र या चिनोज़'),
    needs: [
      { test: T.formalTop, name: N('a formal shirt', 'ఫార్మల్ షర్ట్', 'फॉर्मल शर्ट') },
      { test: T.formalBottom, name: N('formal trousers or chinos', 'ఫార్మల్ ట్రౌజర్ లేదా చినోస్', 'फॉर्मल ट्राउज़र या चिनोज़') },
    ],
    tip: N('Tuck in, add a belt that matches your shoes, and keep colours calm.', 'టక్ ఇన్ చేయండి, షూస్‌కి సరిపోయే బెల్ట్ పెట్టుకోండి, ప్రశాంతమైన రంగులు ఎంచుకోండి.', 'शर्ट अंदर करें, जूतों से मेल खाती बेल्ट लगाएँ, और शांत रंग चुनें।'),
  },
  interview: {
    ideal: N('A crisp light shirt with dark formal trousers (a blazer if you have one)', 'లేత రంగు ఫార్మల్ షర్ట్, ముదురు ఫార్మల్ ట్రౌజర్ (ఉంటే బ్లేజర్)', 'हल्के रंग की कड़क शर्ट और गहरी फॉर्मल ट्राउज़र (हो तो ब्लेज़र)'),
    needs: [
      { test: T.formalTop, name: N('a formal shirt', 'ఫార్మల్ షర్ట్', 'फॉर्मल शर्ट') },
      { test: T.formalBottom, name: N('formal trousers', 'ఫార్మల్ ట్రౌజర్', 'फॉर्मल ट्राउज़र') },
    ],
    tip: N('Ironed clothes, polished formal shoes and a simple watch say "ready".', 'ఇస్త్రీ చేసిన బట్టలు, మెరిసే ఫార్మల్ షూస్, సింపుల్ వాచ్ మిమ్మల్ని సిద్ధంగా చూపిస్తాయి.', 'प्रेस किए कपड़े, चमकते फॉर्मल जूते और सादी घड़ी आपको तैयार दिखाते हैं।'),
  },
  college: {
    ideal: N('A comfy T-shirt or casual shirt with jeans', 'సౌకర్యవంతమైన టీ-షర్ట్ లేదా క్యాజువల్ షర్ట్, జీన్స్', 'आरामदायक टी-शर्ट या कैज़ुअल शर्ट और जींस'),
    needs: [
      { test: T.casualTop, name: N('a casual T-shirt or shirt', 'క్యాజువల్ టీ-షర్ట్ లేదా షర్ట్', 'कैज़ुअल टी-शर्ट या शर्ट') },
      { test: T.denimOrPants, name: N('jeans or chinos', 'జీన్స్ లేదా చినోస్', 'जींस या चिनोज़') },
    ],
    tip: N('Sneakers and a backpack finish the look; keep it easy to move in.', 'స్నీకర్స్, బ్యాక్‌ప్యాక్‌తో లుక్ పూర్తి; కదలడానికి సులువుగా ఉండాలి.', 'स्नीकर्स और बैकपैक से लुक पूरा; चलने-फिरने में आसान रखें।'),
  },
  date: {
    ideal: N('A smart shirt or nice top with dark jeans or chinos', 'స్మార్ట్ షర్ట్ లేదా అందమైన టాప్, ముదురు జీన్స్ లేదా చినోస్', 'स्मार्ट शर्ट या अच्छा टॉप और गहरी जींस या चिनोज़'),
    needs: [
      { test: T.partyTop, name: N('a smart shirt or nice top', 'స్మార్ట్ షర్ట్ లేదా అందమైన టాప్', 'स्मार्ट शर्ट या अच्छा टॉप') },
      { test: T.denimOrPants, name: N('dark jeans or chinos', 'ముదురు జీన్స్ లేదా చినోస్', 'गहरी जींस या चिनोज़') },
    ],
    tip: N('Clean shoes, a light fragrance and one colour you feel confident in.', 'శుభ్రమైన షూస్, తేలికపాటి సువాసన, మీకు నమ్మకం ఇచ్చే ఒక రంగు.', 'साफ़ जूते, हल्की ख़ुशबू और एक रंग जिसमें आप आत्मविश्वासी महसूस करें।'),
  },
  party: {
    ideal: N('A dark or shiny shirt / top with jeans or trousers', 'ముదురు లేదా మెరిసే షర్ట్ / టాప్, జీన్స్ లేదా ట్రౌజర్', 'गहरी या चमकदार शर्ट / टॉप और जींस या ट्राउज़र'),
    needs: [
      { test: T.partyTop, name: N('a party shirt or top', 'పార్టీ షర్ట్ లేదా టాప్', 'पार्टी शर्ट या टॉप') },
      { test: T.denimOrPants, name: N('jeans or trousers', 'జీన్స్ లేదా ట్రౌజర్', 'जींस या ट्राउज़र') },
    ],
    tip: N('Black, maroon or navy shine at night; add a watch or statement accessory.', 'రాత్రి నలుపు, మెరూన్, ముదురు నీలం బాగా మెరుస్తాయి; వాచ్ లేదా ఒక స్టేట్‌మెంట్ యాక్సెసరీ జత చేయండి.', 'रात में काला, मैरून या गहरा नीला चमकता है; घड़ी या कोई ख़ास एक्सेसरी जोड़ें।'),
  },
  gym: {
    ideal: N('A breathable sports tee with track pants or shorts', 'గాలి తగిలే స్పోర్ట్స్ టీ-షర్ట్, ట్రాక్ ప్యాంట్ లేదా షార్ట్స్', 'हवादार स्पोर्ट्स टी-शर्ट और ट्रैक पैंट या शॉर्ट्स'),
    needs: [
      { test: T.sportTop, name: N('a sports / dry-fit T-shirt', 'స్పోర్ట్స్ / డ్రై-ఫిట్ టీ-షర్ట్', 'स्पोर्ट्स / ड्राई-फ़िट टी-शर्ट') },
      { test: T.sportBottom, name: N('track pants or shorts', 'ట్రాక్ ప్యాంట్ లేదా షార్ట్స్', 'ट्रैक पैंट या शॉर्ट्स') },
    ],
    tip: N('Proper sports shoes and a towel; skip jeans, they limit movement.', 'సరైన స్పోర్ట్స్ షూస్, ఒక టవల్; జీన్స్ వద్దు, కదలికకు ఇబ్బంది.', 'सही स्पोर्ट्स जूते और तौलिया; जींस नहीं, वह हिलने-डुलने में रुकावट है।'),
  },
  travel: {
    ideal: N('A comfy tee or shirt with stretchy jeans or joggers', 'సౌకర్యవంతమైన టీ-షర్ట్ లేదా షర్ట్, స్ట్రెచ్ జీన్స్ లేదా జాగర్స్', 'आरामदायक टी-शर्ट या शर्ट और स्ट्रेच जींस या जॉगर्स'),
    needs: [
      { test: T.casualTop, name: N('a comfy T-shirt or shirt', 'సౌకర్యవంతమైన టీ-షర్ట్ లేదా షర్ట్', 'आरामदायक टी-शर्ट या शर्ट') },
      { test: T.comfyBottom, name: N('jeans or joggers', 'జీన్స్ లేదా జాగర్స్', 'जींस या जॉगर्स') },
    ],
    tip: N('Layer a light jacket for AC buses / flights, and wear easy walking shoes.', 'AC బస్ / విమానం కోసం తేలికపాటి జాకెట్, నడవడానికి సులువైన షూస్.', 'AC बस / फ़्लाइट के लिए हल्की जैकेट, और चलने में आसान जूते।'),
  },
  casual: {
    ideal: N('A relaxed T-shirt or shirt with jeans', 'రిలాక్స్డ్ టీ-షర్ట్ లేదా షర్ట్, జీన్స్', 'आरामदायक टी-शर्ट या शर्ट और जींस'),
    needs: [
      { test: T.casualTop, name: N('a casual T-shirt or shirt', 'క్యాజువల్ టీ-షర్ట్ లేదా షర్ట్', 'कैज़ुअल टी-शर्ट या शर्ट') },
      { test: T.denimOrPants, name: N('jeans or chinos', 'జీన్స్ లేదా చినోస్', 'जींस या चिनोज़') },
    ],
    tip: N('White sneakers go with almost everything; add sunglasses for daytime.', 'తెల్ల స్నీకర్స్ దాదాపు అన్నింటికీ సరిపోతాయి; పగటిపూట సన్‌గ్లాసెస్ జత చేయండి.', 'सफ़ेद स्नीकर्स लगभग हर चीज़ के साथ चलते हैं; दिन में सनग्लास लगाएँ।'),
  },
  indoor: {
    ideal: N('Soft cotton basics: a tee or kurti with comfy pants', 'మెత్తని కాటన్ బేసిక్స్: టీ-షర్ట్ లేదా కుర్తీ, సౌకర్యవంతమైన ప్యాంట్', 'मुलायम कॉटन बेसिक्स: टी-शर्ट या कुर्ती और आरामदायक पैंट'),
    needs: [
      { test: T.softTop, name: N('a soft cotton tee or kurti', 'మెత్తని కాటన్ టీ-షర్ట్ లేదా కుర్తీ', 'मुलायम कॉटन टी-शर्ट या कुर्ती') },
      { test: T.comfyBottom, name: N('comfy pants', 'సౌకర్యవంతమైన ప్యాంట్', 'आरामदायक पैंट') },
    ],
    tip: N('Breathable fabrics and neat, simple colours look fresh all day indoors.', 'గాలి తగిలే బట్టలు, సింపుల్ రంగులు రోజంతా తాజాగా కనిపిస్తాయి.', 'हवादार कपड़े और सादे रंग घर के अंदर पूरे दिन ताज़ा दिखते हैं।'),
  },
  outdoor: {
    ideal: N('A breathable cotton or linen top with jeans, chinos or shorts', 'గాలి తగిలే కాటన్ లేదా లినెన్ టాప్, జీన్స్, చినోస్ లేదా షార్ట్స్', 'हवादार कॉटन या लिनन टॉप और जींस, चिनोज़ या शॉर्ट्स'),
    needs: [
      { test: T.lightTop, name: N('a light cotton / linen top', 'తేలికపాటి కాటన్ / లినెన్ టాప్', 'हल्का कॉटन / लिनन टॉप') },
      { test: t => T.denimOrPants(t) || T.shorts(t), name: N('jeans, chinos or shorts', 'జీన్స్, చినోస్ లేదా షార్ట్స్', 'जींस, चिनोज़ या शॉर्ट्स') },
    ],
    tip: N('Light colours, sunglasses, a cap and comfortable shoes beat the sun.', 'లేత రంగులు, సన్‌గ్లాసెస్, క్యాప్, సౌకర్యవంతమైన షూస్ ఎండను తట్టుకుంటాయి.', 'हल्के रंग, सनग्लास, कैप और आरामदायक जूते धूप से बचाते हैं।'),
  },
};

const TXT: Record<AiLanguage, Record<string, string>> = {
  English: {
    best: '{ideal} would be best for {occ}.',
    add: "Your wardrobe doesn't have {need} yet; add one to your wardrobe for {occ}.",
    closest: 'Closest in your wardrobe now: {item}.',
    have: 'Your {item} fits {occ} well 👍',
    empty: 'Add your clothes in the Wardrobe tab and I will pick lucky pairs from them too.',
    lucky: "For luck, bring in today's colour ({c}) as the main piece or a small accent.",
    and: ' and ',
  },
  Telugu: {
    best: '{occ} కోసం {ideal} బాగా సరిపోతాయి.',
    add: 'మీ వార్డ్‌రోబ్‌లో ఇంకా {need} లేదు; {occ} కోసం ఒకటి వార్డ్‌రోబ్‌లో చేర్చండి.',
    closest: 'ప్రస్తుతం మీ వార్డ్‌రోబ్‌లో దగ్గరగా సరిపోయేది: {item}.',
    have: 'మీ {item} {occ}కి చక్కగా సరిపోతుంది 👍',
    empty: 'వార్డ్‌రోబ్ ట్యాబ్‌లో మీ బట్టలు చేర్చండి, వాటి నుండి కూడా అదృష్ట జోడీలు ఎంచుకుంటాను.',
    lucky: 'అదృష్టం కోసం ఈ రోజు రంగు ({c}) ప్రధాన దుస్తుగా లేదా చిన్న టచ్‌గా జత చేయండి.',
    and: ', ',
  },
  Hindi: {
    best: '{occ} के लिए {ideal} सबसे अच्छे रहेंगे।',
    add: 'आपके वॉर्डरोब में अभी {need} नहीं है; {occ} के लिए एक अपने वॉर्डरोब में जोड़ें।',
    closest: 'अभी आपके वॉर्डरोब में सबसे क़रीब: {item}।',
    have: 'आपका {item} {occ} के लिए बढ़िया है 👍',
    empty: 'वॉर्डरोब टैब में अपने कपड़े जोड़ें, मैं उनसे भी शुभ जोड़ियाँ चुनूँगा।',
    lucky: 'शुभ असर के लिए आज का रंग ({c}) मुख्य कपड़े में या छोटे टच में पहनें।',
    and: ' और ',
  },
};
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const itemText = (i: WardrobeItemResponse) =>
  `${i.name || ''} ${i.category || ''} ${i.subCategory || ''} ${i.subType || ''} ${i.wearType || ''} ${i.fabric || ''}`.toLowerCase();

// "White Linen shirt" (colour + name, no hex codes)
export const itemLabel = (i: WardrobeItemResponse): string => {
  const c = i.color && !i.color.startsWith('#') ? `${i.color} ` : '';
  const n = (i.name || i.category || '').trim();
  return `${c}${n}`.trim() || i.category || '';
};

export interface PlaceAdvice {
  key: OccKey;
  occWord: string;
  best: string; // what would suit best there
  have: string | null; // positive line when the wardrobe already has it
  add: string | null; // what to add when the wardrobe lacks it
  closest: string | null; // closest item the user owns now
  tip: string;
  lucky: string;
  lines: string[]; // all of the above that apply, in order (always >= 2)
}

// Advice for one chip / occasion word (null when the word is not a known place / occasion)
export const placeAdvice = (
  items: WardrobeItemResponse[],
  lang: AiLanguage,
  chip: string | null | undefined,
  date?: Date,
): PlaceAdvice | null => {
  const key = occasionKey(chip);
  if (!key) return null;
  const g = GUIDE[key];
  const W = TXT[lang];
  const occ = OCC_WORD[lang][key];
  const texts = items.map(i => ({ i, t: itemText(i) }));
  const missing = g.needs.filter(n => !texts.some(x => n.test(x.t)));
  // Best-fitting item the user owns (for "have" / "closest")
  let bestItem: WardrobeItemResponse | null = null;
  let bestFit = -Infinity;
  texts.forEach(({ i, t }) => {
    const matches = g.needs.filter(n => n.test(t)).length;
    const f = occasionFit(i, key) + matches * 2;
    if (f > bestFit) {
      bestFit = f;
      bestItem = i;
    }
  });
  const best = fill(W.best, { ideal: g.ideal[lang], occ });
  const add = missing.length ? fill(W.add, { need: missing.map(m => m.name[lang]).join(W.and), occ }) : null;
  const bi = bestItem as WardrobeItemResponse | null;
  const have = !missing.length && bi ? fill(W.have, { item: itemLabel(bi), occ }) : null;
  const closest = missing.length && bi ? fill(W.closest, { item: itemLabel(bi) }) : null;
  const lucky = fill(W.lucky, { c: luckyColourWords(getTodayVaaraColour(date), lang) });
  const lines = [cap(best), add, have, closest, items.length ? null : W.empty, g.tip[lang], lucky].filter(
    (x): x is string => !!x,
  );
  return { key, occWord: occ, best: cap(best), have, add, closest, tip: g.tip[lang], lucky, lines };
};

export interface ChipSuggestion {
  advice: PlaceAdvice;
  pairs: LuckyPairsResult;
  count: number; // suggestions shown: advice lines + wardrobe pairs (always >= 1)
}

// Everything the Style screen shows for one chip: the place advice + up to 3 wardrobe pairs
export const chipSuggestion = (
  items: WardrobeItemResponse[],
  lang: AiLanguage,
  chip: string,
  opts: { date?: Date; max?: number } = {},
): ChipSuggestion | null => {
  const advice = placeAdvice(items, lang, chip, opts.date);
  if (!advice) return null;
  const pairs = pickLuckyPairs(items, lang, { occasion: chip, date: opts.date, max: opts.max ?? 3 });
  return { advice, pairs, count: advice.lines.length + pairs.pairs.length };
};
