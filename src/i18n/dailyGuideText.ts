// Text for the Home daily guide (daily rashi colour line, "Good day to buy?", Weather & climate card,
// age precautions, "Go out today?"), in the three App languages (Settings > App language).
import type { AppLanguage } from './appLanguage';
import type {
  AgeGroup,
  AlertKind,
  BuyReason,
  BuyVerdict,
  Condition,
  GoOutVerdict,
  HouseKind,
} from '../utils/dailyGuide';

export interface DailyGuideText {
  rashiLine: (a: {
    moon: string;
    house: number;
    rashi: string;
    colour: string;
    lord: string;
    kind: HouseKind;
  }) => string;
  buyTitle: string;
  buyVerdict: Record<BuyVerdict, string>;
  buyReason: Record<BuyReason, (tithi: string, nak: string) => string>;
  rahu: (from: string, to: string) => string;
  traditional: string;

  weatherTitle: string;
  placeDevice: string;
  placeDefault: string;
  askLocation: string;
  allow: string;
  notNow: string;
  useMine: string;
  permTitle: string;
  permMessage: string;
  loading: string;
  offline: string;
  unavailable: string;
  updated: (t: string) => string;
  now: string;
  minMax: string;
  rainChance: string;
  wind: string;
  uv: string;
  air: string;
  sky: Record<string, string>; // weatherText() label -> local label
  uvBand: [string, string, string, string, string]; // low, moderate, high, very high, extreme
  aqiBand: [string, string, string, string, string, string];
  alertsTitle: string;
  alerts: Record<AlertKind, string>;
  alertNote: string;

  ageTitle: (group: string) => string;
  groupName: Record<AgeGroup, string>;
  tips: Record<AgeGroup, Record<Condition | 'fine', string>>;

  goTitle: string;
  goVerdict: Record<GoOutVerdict, string>;
  because: Record<Condition, string>;
  goYes: string;
  goCareful: (list: string) => string;
  goAvoid: (list: string) => string;
  goWindow: (from: string, to: string) => string;
  goNoWindow: string;
  goRahu: (from: string, to: string) => string;
}

const ordEn = (n: number) =>
  `${n}${
    n % 10 === 1 && n !== 11
      ? 'st'
      : n % 10 === 2 && n !== 12
      ? 'nd'
      : n % 10 === 3 && n !== 13
      ? 'rd'
      : 'th'
  }`;

const EN: DailyGuideText = {
  rashiLine: ({ moon, house, rashi, colour, lord, kind }) =>
    kind === 'chandrashtama'
      ? `Moon in ${moon} today, 8th from your rashi (${rashi}), Chandrashtama: keep it simple, wear ${colour}.`
      : kind === 'weak'
      ? `Moon in ${moon} today, ${ordEn(
          house,
        )} from your rashi (${rashi}): wear ${colour} to keep the mind calm.`
      : `Moon in ${moon} today, ${ordEn(
          house,
        )} from your rashi (${rashi}): lucky colour ${colour} (${lord}'s colour).`,
  buyTitle: 'Good day to buy?',
  buyVerdict: { yes: 'Yes', careful: 'Careful', no: 'No' },
  buyReason: {
    chandrashtama: () =>
      'Moon is 8th from your rashi (Chandrashtama): postpone big purchases',
    amavasya: () => 'Amavasya today: avoid new purchases',
    rikta: t => `${t} is a Rikta tithi: buy only what you need`,
    badNakshatra: (_t, n) => `${n} nakshatra is not favoured for purchases`,
    plainNakshatra: (_t, n) => `${n} nakshatra is only average for purchases`,
    goodDay: (t, n) => `${t} with ${n} nakshatra: good for shopping`,
  },
  rahu: (a, b) => `Rahu kalam ${a} – ${b}: don't start a purchase then.`,
  traditional: 'Traditional panchang guidance',

  weatherTitle: 'Weather & climate today',
  placeDevice: '📍 Your location',
  placeDefault: '📍 Hyderabad (default)',
  askLocation:
    'Show the weather for where you are? Outfit uses your approximate location only for this.',
  allow: 'Allow location',
  notNow: 'Not now',
  useMine: 'Use my location',
  permTitle: 'Weather for your area',
  permMessage:
    "Outfit uses your approximate location to show today's weather, alerts and Rahu kalam for where you are.",
  loading: "Getting today's weather…",
  offline: "You're offline. Showing the last saved weather.",
  unavailable:
    "Weather isn't available right now. It will load when you're online.",
  updated: t => `Updated ${t}`,
  now: 'Now',
  minMax: 'Min / Max',
  rainChance: 'Rain chance',
  wind: 'Wind',
  uv: 'UV / heat',
  air: 'Air quality',
  sky: {
    'Clear sky': 'Clear sky',
    'Partly cloudy': 'Partly cloudy',
    Cloudy: 'Cloudy',
    Fog: 'Fog',
    Drizzle: 'Drizzle',
    Rain: 'Rain',
    Snow: 'Snow',
    Thunderstorm: 'Thunderstorm',
    Weather: 'Weather',
  },
  uvBand: ['Low', 'Moderate', 'High', 'Very high', 'Extreme'],
  aqiBand: [
    'Good',
    'Moderate',
    'Unhealthy for sensitive groups',
    'Unhealthy',
    'Very unhealthy',
    'Hazardous',
  ],
  alertsTitle: 'Alerts',
  alerts: {
    cyclone: '🌀 Cyclone / toofan-like winds and heavy rain',
    veryHeavyRain: '🌧️ Very heavy rain (over 115 mm)',
    heavyRain: '🌧️ Heavy rain (over 65 mm)',
    thunderstorm: '⛈️ Thunderstorm likely',
    severeHeat: '🔥 Severe heat (45 °C+)',
    heatwave: '🔥 Heatwave (40 °C+)',
    highWind: '💨 Strong winds',
    coldWave: '🥶 Cold wave',
    severeAir: '😷 Very poor air quality',
    poorAir: '😷 Poor air quality',
  },
  alertNote:
    'Worked out from the forecast. Always follow official IMD warnings.',

  ageTitle: g => `Precautions for you (${g})`,
  groupName: { child: 'child', teen: 'teen', adult: 'adult', senior: '60+' },
  tips: {
    child: {
      heat: 'Keep kids indoors from noon to 4 PM; cap, cotton clothes and a water bottle.',
      rain: 'Raincoat and closed footwear; keep kids away from puddles, drains and wires.',
      pollution: 'Limit outdoor play today; a mask if they must go out.',
      cold: 'Sweater, socks and a cap for mornings and evenings.',
      wind: 'Keep kids away from trees, hoardings and loose roofs.',
      fine: 'Nice day for outdoor play; keep water handy.',
    },
    teen: {
      heat: 'Avoid sports in the afternoon sun; drink water every hour and use sunscreen.',
      rain: 'Carry an umbrella; ride slowly on wet roads.',
      pollution: 'Skip outdoor workouts today; wear a mask on busy roads.',
      cold: 'Layer up for early classes and evening rides.',
      wind: 'Ride a two-wheeler carefully in strong crosswinds.',
      fine: 'Good day to get outside; stay hydrated.',
    },
    adult: {
      heat: 'Plan outdoor work before 11 AM or after 4 PM; carry water and ORS.',
      rain: 'Carry an umbrella and expect traffic; avoid waterlogged roads.',
      pollution: 'Limit outdoor exercise; wear an N95 mask in traffic.',
      cold: 'Wear a light jacket in the morning and evening.',
      wind: 'Secure loose things on the balcony; drive carefully.',
      fine: 'Pleasant day; a good time for a walk.',
    },
    senior: {
      heat: 'Stay indoors in the afternoon; drink water often even if not thirsty, wear light cotton.',
      rain: 'Wet floors and roads are slippery: wear footwear with grip and go out only if needed.',
      pollution:
        'Stay indoors with windows shut; keep your medicines and inhaler handy.',
      cold: 'Keep warm with a shawl or sweater; walk after the sun is up.',
      wind: 'Avoid going out in strong winds; keep a walking stick or support handy.',
      fine: 'Good day for a gentle morning or evening walk.',
    },
  },

  goTitle: 'Go out today?',
  goVerdict: { yes: 'Yes', careful: 'Careful', avoid: 'Avoid' },
  because: {
    heat: 'hot sun',
    rain: 'rain',
    cold: 'cold',
    pollution: 'air pollution',
    wind: 'strong wind',
  },
  goYes: 'The weather looks fine for you.',
  goCareful: l => `Go prepared: ${l}.`,
  goAvoid: l => `Better to stay in: ${l}.`,
  goWindow: (a, b) => `Best time: ${a} – ${b}.`,
  goNoWindow: 'No good outdoor time left today.',
  goRahu: (a, b) => `Rahu kalam (${a} – ${b}) falls in this time.`,
};

const TE: DailyGuideText = {
  rashiLine: ({ moon, house, rashi, colour, lord, kind }) =>
    kind === 'chandrashtama'
      ? `ఈరోజు చంద్రుడు ${moon}లో, మీ రాశి (${rashi}) నుండి 8వ స్థానం (చంద్రాష్టమం): సాదాగా ఉండండి, ${colour} ధరించండి.`
      : kind === 'weak'
      ? `ఈరోజు చంద్రుడు ${moon}లో, మీ రాశి (${rashi}) నుండి ${house}వ స్థానం: మనసు ప్రశాంతంగా ఉండటానికి ${colour} ధరించండి.`
      : `ఈరోజు చంద్రుడు ${moon}లో, మీ రాశి (${rashi}) నుండి ${house}వ స్థానం: అదృష్ట రంగు ${colour} (${lord} రంగు).`,
  buyTitle: 'ఈరోజు కొనచ్చా?',
  buyVerdict: { yes: 'అవును', careful: 'జాగ్రత్త', no: 'వద్దు' },
  buyReason: {
    chandrashtama: () =>
      'చంద్రుడు మీ రాశి నుండి 8వ స్థానంలో (చంద్రాష్టమం): పెద్ద కొనుగోళ్లు వాయిదా వేయండి',
    amavasya: () => 'ఈరోజు అమావాస్య: కొత్త కొనుగోళ్లు వద్దు',
    rikta: t => `${t} రిక్త తిథి: అవసరమైనవి మాత్రమే కొనండి`,
    badNakshatra: (_t, n) => `${n} నక్షత్రం కొనుగోళ్లకు అనుకూలం కాదు`,
    plainNakshatra: (_t, n) => `${n} నక్షత్రం కొనుగోళ్లకు సామాన్యం`,
    goodDay: (t, n) => `${t}, ${n} నక్షత్రం: షాపింగ్‌కు మంచి రోజు`,
  },
  rahu: (a, b) => `రాహుకాలం ${a} – ${b}: ఆ సమయంలో కొనుగోలు మొదలుపెట్టకండి.`,
  traditional: 'సంప్రదాయ పంచాంగ సూచన',

  weatherTitle: 'ఈరోజు వాతావరణం',
  placeDevice: '📍 మీ ప్రాంతం',
  placeDefault: '📍 హైదరాబాద్ (డిఫాల్ట్)',
  askLocation:
    'మీరు ఉన్న ప్రాంతం వాతావరణం చూపించమంటారా? దీని కోసం మాత్రమే మీ సుమారు లొకేషన్ వాడతాం.',
  allow: 'లొకేషన్ అనుమతించు',
  notNow: 'ఇప్పుడు వద్దు',
  useMine: 'నా లొకేషన్ వాడు',
  permTitle: 'మీ ప్రాంతం వాతావరణం',
  permMessage:
    'మీ ప్రాంతానికి ఈరోజు వాతావరణం, హెచ్చరికలు, రాహుకాలం చూపించడానికి Outfit మీ సుమారు లొకేషన్ వాడుతుంది.',
  loading: 'ఈరోజు వాతావరణం తెస్తున్నాం…',
  offline:
    'మీరు ఆఫ్‌లైన్‌లో ఉన్నారు. చివరిగా సేవ్ చేసిన వాతావరణం చూపిస్తున్నాం.',
  unavailable:
    'ఇప్పుడు వాతావరణం అందుబాటులో లేదు. ఆన్‌లైన్‌కి రాగానే లోడ్ అవుతుంది.',
  updated: t => `${t}కి అప్‌డేట్ అయింది`,
  now: 'ఇప్పుడు',
  minMax: 'కనిష్ఠ / గరిష్ఠ',
  rainChance: 'వర్షం అవకాశం',
  wind: 'గాలి',
  uv: 'UV / ఎండ',
  air: 'గాలి నాణ్యత',
  sky: {
    'Clear sky': 'నిర్మలమైన ఆకాశం',
    'Partly cloudy': 'పాక్షికంగా మేఘాలు',
    Cloudy: 'మేఘావృతం',
    Fog: 'పొగమంచు',
    Drizzle: 'చిరుజల్లులు',
    Rain: 'వర్షం',
    Snow: 'మంచు',
    Thunderstorm: 'ఉరుములతో వర్షం',
    Weather: 'వాతావరణం',
  },
  uvBand: ['తక్కువ', 'మధ్యస్థం', 'ఎక్కువ', 'చాలా ఎక్కువ', 'అత్యధికం'],
  aqiBand: [
    'బాగుంది',
    'పర్వాలేదు',
    'సున్నితమైనవారికి హానికరం',
    'హానికరం',
    'చాలా హానికరం',
    'ప్రమాదకరం',
  ],
  alertsTitle: 'హెచ్చరికలు',
  alerts: {
    cyclone: '🌀 తుఫాన్ లాంటి గాలులు, భారీ వర్షం',
    veryHeavyRain: '🌧️ అతి భారీ వర్షం (115 మి.మీ.కి పైగా)',
    heavyRain: '🌧️ భారీ వర్షం (65 మి.మీ.కి పైగా)',
    thunderstorm: '⛈️ ఉరుములతో వర్షం అవకాశం',
    severeHeat: '🔥 తీవ్రమైన ఎండ (45 °C+)',
    heatwave: '🔥 వడగాలులు (40 °C+)',
    highWind: '💨 బలమైన గాలులు',
    coldWave: '🥶 చలిగాలులు',
    severeAir: '😷 గాలి నాణ్యత చాలా అధ్వాన్నం',
    poorAir: '😷 గాలి నాణ్యత బాగాలేదు',
  },
  alertNote: 'ఫోర్‌కాస్ట్ ఆధారంగా. అధికారిక IMD హెచ్చరికలు తప్పక పాటించండి.',

  ageTitle: g => `మీ కోసం జాగ్రత్తలు (${g})`,
  groupName: {
    child: 'పిల్లలు',
    teen: 'టీనేజ్',
    adult: 'పెద్దలు',
    senior: '60+',
  },
  tips: {
    child: {
      heat: 'మధ్యాహ్నం 12 నుండి 4 వరకు పిల్లలను ఇంట్లోనే ఉంచండి; టోపీ, కాటన్ బట్టలు, నీళ్ల సీసా.',
      rain: 'రెయిన్‌కోట్, మూసి ఉండే చెప్పులు; నీటి గుంటలు, డ్రైనేజీలు, వైర్లకు దూరంగా ఉంచండి.',
      pollution: 'ఈరోజు బయట ఆటలు తగ్గించండి; బయటికి వెళ్తే మాస్క్ పెట్టండి.',
      cold: 'ఉదయం, సాయంత్రం స్వెటర్, సాక్సులు, టోపీ వేయండి.',
      wind: 'చెట్లు, హోర్డింగులు, వదులు పైకప్పులకు పిల్లలను దూరంగా ఉంచండి.',
      fine: 'బయట ఆడుకోవడానికి మంచి రోజు; నీళ్లు దగ్గర ఉంచండి.',
    },
    teen: {
      heat: 'మధ్యాహ్నం ఎండలో ఆటలు వద్దు; గంటకోసారి నీళ్లు తాగండి, సన్‌స్క్రీన్ వాడండి.',
      rain: 'గొడుగు తీసుకెళ్ళండి; తడి రోడ్లపై నెమ్మదిగా నడపండి.',
      pollution: 'ఈరోజు బయట వ్యాయామం వద్దు; రద్దీ రోడ్లపై మాస్క్ పెట్టండి.',
      cold: 'ఉదయం క్లాసులకు, సాయంత్రం ప్రయాణాలకు వెచ్చని బట్టలు వేసుకోండి.',
      wind: 'బలమైన గాలిలో టూ-వీలర్ జాగ్రత్తగా నడపండి.',
      fine: 'బయటికి వెళ్ళడానికి మంచి రోజు; నీళ్లు తాగుతూ ఉండండి.',
    },
    adult: {
      heat: 'బయటి పనులు ఉదయం 11 లోపు లేదా సాయంత్రం 4 తర్వాత పెట్టుకోండి; నీళ్లు, ORS దగ్గర ఉంచండి.',
      rain: 'గొడుగు తీసుకెళ్ళండి, ట్రాఫిక్ ఎక్కువ ఉండొచ్చు; నీళ్లు నిలిచిన రోడ్లు తప్పించండి.',
      pollution: 'బయట వ్యాయామం తగ్గించండి; ట్రాఫిక్‌లో N95 మాస్క్ పెట్టండి.',
      cold: 'ఉదయం, సాయంత్రం తేలికపాటి జాకెట్ వేసుకోండి.',
      wind: 'బాల్కనీలో వదులుగా ఉన్నవి సర్దండి; జాగ్రత్తగా డ్రైవ్ చేయండి.',
      fine: 'ఆహ్లాదకరమైన రోజు; వాకింగ్‌కి మంచి సమయం.',
    },
    senior: {
      heat: 'మధ్యాహ్నం ఇంట్లోనే ఉండండి; దాహం లేకపోయినా తరచూ నీళ్లు తాగండి, తేలికపాటి కాటన్ బట్టలు.',
      rain: 'తడి నేల, రోడ్లు జారుతాయి: పట్టు ఉండే చెప్పులు వాడండి, అవసరమైతేనే బయటికి వెళ్ళండి.',
      pollution:
        'కిటికీలు మూసి ఇంట్లోనే ఉండండి; మందులు, ఇన్‌హేలర్ దగ్గర ఉంచుకోండి.',
      cold: 'శాలువా లేదా స్వెటర్‌తో వెచ్చగా ఉండండి; ఎండ వచ్చాక వాకింగ్ చేయండి.',
      wind: 'బలమైన గాలిలో బయటికి వెళ్ళకండి; చేతికర్ర లేదా ఆసరా దగ్గర ఉంచుకోండి.',
      fine: 'ఉదయం లేదా సాయంత్రం నెమ్మదిగా వాకింగ్‌కి మంచి రోజు.',
    },
  },

  goTitle: 'ఈరోజు బయటికి వెళ్ళొచ్చా?',
  goVerdict: { yes: 'అవును', careful: 'జాగ్రత్త', avoid: 'వద్దు' },
  because: {
    heat: 'ఎండ',
    rain: 'వర్షం',
    cold: 'చలి',
    pollution: 'కాలుష్యం',
    wind: 'బలమైన గాలి',
  },
  goYes: 'మీకు వాతావరణం బాగానే ఉంది.',
  goCareful: l => `సిద్ధంగా వెళ్ళండి: ${l}.`,
  goAvoid: l => `ఇంట్లోనే ఉండటం మంచిది: ${l}.`,
  goWindow: (a, b) => `మంచి సమయం: ${a} – ${b}.`,
  goNoWindow: 'ఈరోజు ఇక బయటికి వెళ్ళడానికి మంచి సమయం లేదు.',
  goRahu: (a, b) => `రాహుకాలం (${a} – ${b}) ఈ సమయంలోనే ఉంది.`,
};

const HI: DailyGuideText = {
  rashiLine: ({ moon, house, rashi, colour, lord, kind }) =>
    kind === 'chandrashtama'
      ? `आज चंद्रमा ${moon} में, आपकी राशि (${rashi}) से 8वाँ भाव (चंद्राष्टम): सादगी रखें, ${colour} पहनें।`
      : kind === 'weak'
      ? `आज चंद्रमा ${moon} में, आपकी राशि (${rashi}) से ${house}वाँ भाव: मन शांत रखने के लिए ${colour} पहनें।`
      : `आज चंद्रमा ${moon} में, आपकी राशि (${rashi}) से ${house}वाँ भाव: शुभ रंग ${colour} (${lord} का रंग)।`,
  buyTitle: 'आज ख़रीदारी करें?',
  buyVerdict: { yes: 'हाँ', careful: 'सावधानी', no: 'नहीं' },
  buyReason: {
    chandrashtama: () =>
      'चंद्रमा आपकी राशि से 8वें भाव में (चंद्राष्टम): बड़ी ख़रीदारी टालें',
    amavasya: () => 'आज अमावस्या: नई ख़रीदारी न करें',
    rikta: t => `${t} रिक्ता तिथि है: केवल ज़रूरी चीज़ें ख़रीदें`,
    badNakshatra: (_t, n) => `${n} नक्षत्र ख़रीदारी के लिए शुभ नहीं`,
    plainNakshatra: (_t, n) => `${n} नक्षत्र ख़रीदारी के लिए सामान्य है`,
    goodDay: (t, n) => `${t} और ${n} नक्षत्र: ख़रीदारी के लिए अच्छा दिन`,
  },
  rahu: (a, b) => `राहुकाल ${a} – ${b}: इस समय ख़रीदारी शुरू न करें।`,
  traditional: 'पारंपरिक पंचांग मार्गदर्शन',

  weatherTitle: 'आज का मौसम',
  placeDevice: '📍 आपकी जगह',
  placeDefault: '📍 हैदराबाद (डिफ़ॉल्ट)',
  askLocation:
    'आपकी जगह का मौसम दिखाएँ? इसके लिए केवल आपकी अनुमानित लोकेशन ली जाएगी।',
  allow: 'लोकेशन दें',
  notNow: 'अभी नहीं',
  useMine: 'मेरी लोकेशन लें',
  permTitle: 'आपकी जगह का मौसम',
  permMessage:
    'आपकी जगह का आज का मौसम, चेतावनियाँ और राहुकाल दिखाने के लिए Outfit आपकी अनुमानित लोकेशन लेता है।',
  loading: 'आज का मौसम ला रहे हैं…',
  offline: 'आप ऑफ़लाइन हैं। आख़िरी सेव किया मौसम दिखा रहे हैं।',
  unavailable: 'अभी मौसम उपलब्ध नहीं है। ऑनलाइन होते ही लोड होगा।',
  updated: t => `${t} पर अपडेट`,
  now: 'अभी',
  minMax: 'न्यूनतम / अधिकतम',
  rainChance: 'बारिश की संभावना',
  wind: 'हवा',
  uv: 'UV / गर्मी',
  air: 'वायु गुणवत्ता',
  sky: {
    'Clear sky': 'साफ़ आसमान',
    'Partly cloudy': 'आंशिक बादल',
    Cloudy: 'बादल',
    Fog: 'कोहरा',
    Drizzle: 'बूंदाबांदी',
    Rain: 'बारिश',
    Snow: 'बर्फ़',
    Thunderstorm: 'आंधी-तूफ़ान',
    Weather: 'मौसम',
  },
  uvBand: ['कम', 'मध्यम', 'ज़्यादा', 'बहुत ज़्यादा', 'अत्यधिक'],
  aqiBand: [
    'अच्छी',
    'मध्यम',
    'संवेदनशील लोगों के लिए हानिकारक',
    'हानिकारक',
    'बहुत हानिकारक',
    'ख़तरनाक',
  ],
  alertsTitle: 'चेतावनियाँ',
  alerts: {
    cyclone: '🌀 तूफ़ान जैसी तेज़ हवा और भारी बारिश',
    veryHeavyRain: '🌧️ अति भारी बारिश (115 मिमी से ज़्यादा)',
    heavyRain: '🌧️ भारी बारिश (65 मिमी से ज़्यादा)',
    thunderstorm: '⛈️ आंधी-तूफ़ान की संभावना',
    severeHeat: '🔥 भीषण गर्मी (45 °C+)',
    heatwave: '🔥 लू (40 °C+)',
    highWind: '💨 तेज़ हवाएँ',
    coldWave: '🥶 शीतलहर',
    severeAir: '😷 वायु गुणवत्ता बहुत ख़राब',
    poorAir: '😷 वायु गुणवत्ता ख़राब',
  },
  alertNote:
    'पूर्वानुमान पर आधारित। हमेशा आधिकारिक IMD चेतावनियों का पालन करें।',

  ageTitle: g => `आपके लिए सावधानियाँ (${g})`,
  groupName: { child: 'बच्चे', teen: 'किशोर', adult: 'वयस्क', senior: '60+' },
  tips: {
    child: {
      heat: 'दोपहर 12 से 4 बजे तक बच्चों को घर में रखें; टोपी, सूती कपड़े और पानी की बोतल।',
      rain: 'रेनकोट और बंद जूते; बच्चों को गड्ढों, नालियों और तारों से दूर रखें।',
      pollution: 'आज बाहर खेलना कम करें; बाहर जाना हो तो मास्क पहनाएँ।',
      cold: 'सुबह-शाम स्वेटर, मोज़े और टोपी पहनाएँ।',
      wind: 'बच्चों को पेड़ों, होर्डिंग और ढीली छतों से दूर रखें।',
      fine: 'बाहर खेलने के लिए अच्छा दिन; पानी साथ रखें।',
    },
    teen: {
      heat: 'दोपहर की धूप में खेल से बचें; हर घंटे पानी पिएँ और सनस्क्रीन लगाएँ।',
      rain: 'छाता साथ रखें; गीली सड़कों पर धीरे चलाएँ।',
      pollution: 'आज बाहर कसरत न करें; भीड़ वाली सड़कों पर मास्क पहनें।',
      cold: 'सुबह की क्लास और शाम की सवारी के लिए गर्म कपड़े पहनें।',
      wind: 'तेज़ हवा में दोपहिया सावधानी से चलाएँ।',
      fine: 'बाहर जाने के लिए अच्छा दिन; पानी पीते रहें।',
    },
    adult: {
      heat: 'बाहर के काम सुबह 11 से पहले या शाम 4 के बाद करें; पानी और ORS साथ रखें।',
      rain: 'छाता साथ रखें, ट्रैफ़िक ज़्यादा हो सकता है; जलभराव वाली सड़कों से बचें।',
      pollution: 'बाहर कसरत कम करें; ट्रैफ़िक में N95 मास्क पहनें।',
      cold: 'सुबह-शाम हल्की जैकेट पहनें।',
      wind: 'बालकनी की ढीली चीज़ें संभालें; सावधानी से गाड़ी चलाएँ।',
      fine: 'सुहावना दिन; टहलने का अच्छा समय।',
    },
    senior: {
      heat: 'दोपहर में घर पर रहें; प्यास न लगे तब भी पानी पिएँ, हल्के सूती कपड़े पहनें।',
      rain: 'गीले फ़र्श और सड़कें फिसलन भरी होती हैं: पकड़ वाले जूते पहनें, ज़रूरत हो तभी बाहर जाएँ।',
      pollution: 'खिड़कियाँ बंद रखकर घर में रहें; दवाइयाँ और इनहेलर पास रखें।',
      cold: 'शॉल या स्वेटर से गर्म रहें; धूप निकलने के बाद टहलें।',
      wind: 'तेज़ हवा में बाहर न जाएँ; छड़ी या सहारा पास रखें।',
      fine: 'सुबह या शाम हल्की सैर के लिए अच्छा दिन।',
    },
  },

  goTitle: 'आज बाहर जाएँ?',
  goVerdict: { yes: 'हाँ', careful: 'सावधानी', avoid: 'टालें' },
  because: {
    heat: 'तेज़ धूप',
    rain: 'बारिश',
    cold: 'ठंड',
    pollution: 'प्रदूषण',
    wind: 'तेज़ हवा',
  },
  goYes: 'मौसम आपके लिए ठीक है।',
  goCareful: l => `तैयारी के साथ जाएँ: ${l}।`,
  goAvoid: l => `घर पर रहना बेहतर: ${l}।`,
  goWindow: (a, b) => `सबसे अच्छा समय: ${a} – ${b}।`,
  goNoWindow: 'आज बाहर जाने का अच्छा समय नहीं बचा।',
  goRahu: (a, b) => `राहुकाल (${a} – ${b}) इसी समय में है।`,
};

export const DAILY_GUIDE_TEXT: Record<AppLanguage, DailyGuideText> = {
  English: EN,
  Telugu: TE,
  Hindi: HI,
};
export const dailyGuideText = (lang: AppLanguage): DailyGuideText =>
  DAILY_GUIDE_TEXT[lang] || EN;

// "7 AM" for a local hour (0..23)
export const hourLabel = (h: number): string =>
  `${((h + 11) % 12) + 1} ${h % 24 < 12 ? 'AM' : 'PM'}`;

export const uvBandIndex = (uv: number): number =>
  uv < 3 ? 0 : uv < 6 ? 1 : uv < 8 ? 2 : uv < 11 ? 3 : 4;
export const aqiBandIndex = (aqi: number): number =>
  aqi <= 50
    ? 0
    : aqi <= 100
    ? 1
    : aqi <= 150
    ? 2
    : aqi <= 200
    ? 3
    : aqi <= 300
    ? 4
    : 5;
