// Me > 🔮 Astrology (జాతకం): today's reading, computed on the phone (no network, no AI, instant).
// Inputs: the saved profile (name, dob, time of birth, rashi, gender, language) + today's IST date
// (+ the user's wardrobe for a dress pick). Same user + same date = same text (no change on refresh).
// Method (traditional, simplified): today's panchang at Hyderabad sunrise (utils/astro.ts),
// Chandrabalam (today's Moon sign counted from the birth Moon sign), Tarabalam (today's star
// counted from the birth star, when known), weekday ruling planet colours (utils/panchangam.ts),
// the rashi lord's colour and the user's own wardrobe (services/luckyPairs.ts).
// Wording is always positive and encouraging; it is guidance for fun and reflection, not a promise.
import {
  birthChart,
  BirthChart,
  chandraHouse,
  GOOD_HOUSES,
  GOOD_TARAS,
  hashString,
  istClock12,
  NAKSHATRAS,
  NAKSHATRAS_TE,
  nakshatraLord,
  Panchang,
  panchangFor,
  pick,
  PLANET_EN,
  PLANET_TE,
  RASHI_EN,
  RASHI_LORD,
  RASHI_TE,
  taraOf,
  tithiName,
} from '../utils/astro';
import { getTodayVaaraColour } from '../utils/panchangam';
import { luckyColourWords, pickLuckyPairs } from './luckyPairs';
import type { WardrobeItemResponse } from './wardrobeApi';

export type AstroLang = 'English' | 'Telugu';
export const astroLanguage = (appLanguage?: string | null): AstroLang =>
  (appLanguage || '').toLowerCase().startsWith('telugu') ? 'Telugu' : 'English';

export interface AstroProfile {
  name?: string | null;
  dob?: string | null;
  timeOfBirth?: string | null;
  rashi?: string | null;
  gender?: string | null;
  language?: string | null;
}

export interface DailyReading {
  dayKey: string;
  lang: AstroLang;
  chart: BirthChart | null;
  needsDob: boolean; // no saved rashi and no dob: ask for the date of birth
  panchang: { label: string; value: string }[];
  rashiLine: string | null;
  note: string | null; // e.g. "approximate: add your time of birth"
  stars: number; // 3..5, always encouraging
  greeting: string;
  overview: string;
  mood: string;
  doList: string[];
  avoidList: string[];
  luckyTime: string;
  calmTime: string;
  dress: {
    colours: { name: string; hex: string }[];
    title: string;
    why: string;
    idea: string;
    pair: { top: WardrobeItemResponse; bottom: WardrobeItemResponse; why: string } | null;
  };
  crush: { level: 'high' | 'good' | 'gentle'; title: string; text: string };
}

const WEEKDAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_TE = ['ఆదివారం', 'సోమవారం', 'మంగళవారం', 'బుధవారం', 'గురువారం', 'శుక్రవారం', 'శనివారం'];
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

// Colour of each planet (Sun..Saturn) for the rashi-lord touch
const PLANET_COLOUR: { en: string; te: string; hex: string }[] = [
  { en: 'Orange / Gold', te: 'నారింజ / బంగారు', hex: '#F57C00' },
  { en: 'White / Silver', te: 'తెలుపు / వెండి', hex: '#ECEFF1' },
  { en: 'Red', te: 'ఎరుపు', hex: '#C62828' },
  { en: 'Green', te: 'ఆకుపచ్చ', hex: '#388E3C' },
  { en: 'Yellow', te: 'పసుపు', hex: '#FBC02D' },
  { en: 'White / Pink', te: 'తెలుపు / గులాబీ', hex: '#F8BBD0' },
  { en: 'Blue / Navy', te: 'నీలం / ముదురు నీలం', hex: '#1565C0' },
];

// ── Moon house themes (house counted from the birth Moon sign) ─────────────
interface HouseText {
  overview: string[];
  mood: string;
  do: string[];
  avoid: string;
}
const HOUSE: Record<AstroLang, HouseText[]> = {
  English: [
    { overview: ['The Moon is in your own sign today: you feel like yourself, fresh and confident.', 'A "you" day: your presence is noticed and your ideas get a fair hearing.'], mood: 'Confident and self-aware. Smile first; people respond warmly.', do: ['Start something you care about', 'Take care of your looks and health'], avoid: 'Taking on everyone else\'s work; your own goals come first today' },
    { overview: ['Family and money matters go smoothly with a calm, kind word.', 'Today favours saving, planning and sweet talk at home.'], mood: 'Warm and grounded. Speak gently and your words carry weight.', do: ['Plan your budget or a small saving', 'Eat a good home meal with family'], avoid: 'Impulse shopping; sleep on big purchases' },
    { overview: ['Courage is high today: messages, calls and short trips go your way.', 'A brave, energetic day; the first step is the hardest and you have the strength for it.'], mood: 'Bold and chatty. Your energy lifts others.', do: ['Send that message or make that call', 'Try a new skill or a workout'], avoid: 'Rushing; double-check before you hit send' },
    { overview: ['A cosy, heart-centred day: home, mother and comfort bring peace.', 'Today rewards slowing down and making your space beautiful.'], mood: 'Soft and emotional in a good way. Be kind to yourself.', do: ['Tidy your room or wardrobe', 'Call your mother or an elder'], avoid: 'Overthinking small things; let them go' },
    { overview: ['Creativity and romance glow today; your ideas sparkle.', 'A playful, lucky day for studies, art and heartfelt moments.'], mood: 'Cheerful and creative. Your smile is your best accessory.', do: ['Make or create something', 'Spend time on a hobby you love'], avoid: 'Risky bets; enjoy fun that is safe' },
    { overview: ['You can beat any obstacle today: work, health and routine improve.', 'A strong day to fix problems and finish pending tasks.'], mood: 'Focused and determined. Small wins add up.', do: ['Clear a pending task early', 'Drink water and take a short walk'], avoid: 'Arguments; let results speak for you' },
    { overview: ['Partnerships shine today: friends, partner and teamwork bring joy.', 'A social day; good company opens good doors.'], mood: 'Friendly and charming. People enjoy your company.', do: ['Meet a friend or a partner', 'Work together on something'], avoid: 'Being stubborn; meet others halfway' },
    { overview: ['A quiet, reflective day: rest and inner strength recharge you.', 'Go easy today; calm choices protect your energy and bring insight.'], mood: 'Thoughtful and private. Gentle routines feel best.', do: ['Meditate or pray for a few minutes', 'Finish things slowly and carefully'], avoid: 'Big risks or new loans today; plan instead' },
    { overview: ['Luck and blessings are with you today; elders and teachers help.', 'A fortunate day for learning, prayer and kind deeds.'], mood: 'Hopeful and generous. Gratitude multiplies your luck.', do: ['Visit a temple or do something kind', 'Learn from someone wiser'], avoid: 'Ignoring good advice; listen today' },
    { overview: ['Career and reputation rise today; your effort is seen.', 'A productive, responsible day; leaders notice your work.'], mood: 'Ambitious and steady. Dress sharp; it shows.', do: ['Take the lead on a task', 'Update your CV or plan your next goal'], avoid: 'Delaying important work; start early' },
    { overview: ['Gains and friends come together today; wishes move closer.', 'One of the best days: help comes from friends and good news arrives.'], mood: 'Happy and social. Share your plans; support follows.', do: ['Reach out to your circle', 'Ask for what you want, politely'], avoid: 'Comparing yourself with others; your path is your own' },
    { overview: ['A peaceful, spiritual day; rest and giving bring calm.', 'Slow down today and recharge; quiet time brings fresh ideas.'], mood: 'Calm and dreamy. Early sleep will feel wonderful.', do: ['Donate or help someone quietly', 'Get good sleep and rest your eyes'], avoid: 'Late nights and overspending' },
  ],
  Telugu: [
    { overview: ['ఈ రోజు చంద్రుడు మీ రాశిలోనే ఉన్నాడు: మీరు ఉత్సాహంగా, ఆత్మవిశ్వాసంతో ఉంటారు.', 'ఇది "మీ" రోజు: మీ మాటకు, మీ ఆలోచనలకు విలువ పెరుగుతుంది.'], mood: 'ఆత్మవిశ్వాసంతో ఉంటారు. ముందుగా చిరునవ్వు చిందిస్తే అందరూ ఆప్యాయంగా స్పందిస్తారు.', do: ['మీకు ఇష్టమైన పని మొదలుపెట్టండి', 'మీ ఆరోగ్యం, అందం మీద శ్రద్ధ పెట్టండి'], avoid: 'అందరి పనులూ మీ మీద వేసుకోవడం; ఈ రోజు మీ లక్ష్యాలకే ప్రాధాన్యం' },
    { overview: ['మృదువైన మాటతో కుటుంబ, ధన విషయాలు సాఫీగా సాగుతాయి.', 'పొదుపు, ప్రణాళిక, ఇంట్లో మధురమైన మాటలకు ఈ రోజు అనుకూలం.'], mood: 'ప్రశాంతంగా, ఆప్యాయంగా ఉంటారు. మీ మాటకు బరువు ఉంటుంది.', do: ['బడ్జెట్ లేదా చిన్న పొదుపు ప్లాన్ చేయండి', 'కుటుంబంతో కలిసి ఇంటి భోజనం చేయండి'], avoid: 'ఆవేశంలో షాపింగ్; పెద్ద కొనుగోళ్లు ఒక రోజు ఆలోచించి చేయండి' },
    { overview: ['ఈ రోజు ధైర్యం ఎక్కువ: మెసేజ్‌లు, ఫోన్లు, చిన్న ప్రయాణాలు కలిసొస్తాయి.', 'ధైర్యమైన, ఉత్సాహమైన రోజు; మొదటి అడుగు వేసే శక్తి మీకుంది.'], mood: 'ధైర్యంగా, చురుకుగా ఉంటారు. మీ ఉత్సాహం ఇతరులకూ స్ఫూర్తి.', do: ['ఆ మెసేజ్ పంపండి లేదా ఆ ఫోన్ చేయండి', 'కొత్త నైపుణ్యం లేదా వ్యాయామం ప్రయత్నించండి'], avoid: 'తొందరపాటు; పంపే ముందు ఒకసారి చూసుకోండి' },
    { overview: ['హాయిగా, మనసుకు దగ్గరగా ఉండే రోజు: ఇల్లు, అమ్మ, సౌకర్యం ప్రశాంతతనిస్తాయి.', 'నెమ్మదిగా సాగుతూ మీ చుట్టూ అందంగా తీర్చిదిద్దుకుంటే మంచిది.'], mood: 'మృదువుగా, భావోద్వేగంగా ఉంటారు. మీ మీద మీరు దయగా ఉండండి.', do: ['మీ గది లేదా వార్డ్‌రోబ్ సర్దుకోండి', 'అమ్మకో పెద్దవారికో ఫోన్ చేయండి'], avoid: 'చిన్న విషయాలు ఎక్కువగా ఆలోచించడం; వదిలేయండి' },
    { overview: ['సృజనాత్మకత, ప్రేమ ఈ రోజు వెలుగుతాయి; మీ ఆలోచనలు మెరుస్తాయి.', 'చదువు, కళలు, మనసుకు నచ్చిన క్షణాలకు అదృష్టమైన, సరదా రోజు.'], mood: 'ఉల్లాసంగా ఉంటారు. మీ చిరునవ్వే మీ అందమైన ఆభరణం.', do: ['ఏదైనా కొత్తగా తయారుచేయండి', 'మీకు ఇష్టమైన హాబీకి సమయం ఇవ్వండి'], avoid: 'రిస్క్ ఉన్న పందాలు; సురక్షితమైన సరదాలు ఆనందించండి' },
    { overview: ['ఈ రోజు ఏ అడ్డంకినైనా దాటగలరు: పని, ఆరోగ్యం, దినచర్య మెరుగవుతాయి.', 'సమస్యలు పరిష్కరించి, పెండింగ్ పనులు పూర్తి చేయడానికి బలమైన రోజు.'], mood: 'ఏకాగ్రతతో, పట్టుదలతో ఉంటారు. చిన్న విజయాలే పెద్దవవుతాయి.', do: ['పెండింగ్ పని ఉదయమే పూర్తి చేయండి', 'నీళ్లు తాగుతూ కాసేపు నడవండి'], avoid: 'వాదనలు; మీ ఫలితాలే మాట్లాడతాయి' },
    { overview: ['భాగస్వామ్యాలు మెరుస్తాయి: స్నేహితులు, జీవిత భాగస్వామి, టీమ్‌వర్క్ ఆనందాన్నిస్తాయి.', 'సామాజికమైన రోజు; మంచి సాంగత్యం మంచి అవకాశాలు తెస్తుంది.'], mood: 'స్నేహపూర్వకంగా, ఆకర్షణీయంగా ఉంటారు. అందరూ మీ సాంగత్యం ఇష్టపడతారు.', do: ['స్నేహితుడిని లేదా భాగస్వామిని కలవండి', 'కలిసి ఏదైనా పని చేయండి'], avoid: 'మొండితనం; సగం దూరం మీరూ వెళ్లండి' },
    { overview: ['నిశ్శబ్దంగా ఆలోచించే రోజు: విశ్రాంతి, అంతర్గత శక్తి మిమ్మల్ని రీఛార్జ్ చేస్తాయి.', 'ఈ రోజు నెమ్మదిగా సాగండి; ప్రశాంత నిర్ణయాలు మీ శక్తిని కాపాడతాయి.'], mood: 'ఆలోచనాత్మకంగా ఉంటారు. సున్నితమైన దినచర్య బాగుంటుంది.', do: ['కొన్ని నిమిషాలు ధ్యానం లేదా ప్రార్థన చేయండి', 'పనులు నెమ్మదిగా, జాగ్రత్తగా పూర్తి చేయండి'], avoid: 'పెద్ద రిస్క్‌లు, కొత్త అప్పులు; ఈ రోజు ప్లాన్ చేయండి చాలు' },
    { overview: ['అదృష్టం, ఆశీస్సులు మీతోనే; పెద్దలు, గురువులు సహాయం చేస్తారు.', 'చదువు, ప్రార్థన, మంచి పనులకు అదృష్టమైన రోజు.'], mood: 'ఆశాభావంతో, ఉదారంగా ఉంటారు. కృతజ్ఞత మీ అదృష్టాన్ని పెంచుతుంది.', do: ['గుడికి వెళ్లండి లేదా ఒక మంచి పని చేయండి', 'అనుభవజ్ఞుల నుంచి నేర్చుకోండి'], avoid: 'మంచి సలహాను పట్టించుకోకపోవడం; ఈ రోజు వినండి' },
    { overview: ['ఉద్యోగం, పేరు ప్రతిష్ఠలు పెరుగుతాయి; మీ కృషి కనిపిస్తుంది.', 'బాధ్యతాయుతమైన, ఫలవంతమైన రోజు; పెద్దలు మీ పని గమనిస్తారు.'], mood: 'లక్ష్యంతో, స్థిరంగా ఉంటారు. చక్కగా డ్రెస్ చేసుకోండి; అది కనిపిస్తుంది.', do: ['ఒక పనిలో ముందుండి నడిపించండి', 'మీ CV అప్‌డేట్ చేయండి లేదా తదుపరి లక్ష్యం ప్లాన్ చేయండి'], avoid: 'ముఖ్యమైన పనులు వాయిదా వేయడం; ఉదయమే మొదలుపెట్టండి' },
    { overview: ['లాభాలు, స్నేహితులు కలిసి వస్తారు; కోరికలు దగ్గరవుతాయి.', 'చాలా మంచి రోజు: స్నేహితుల సహాయం, శుభవార్తలు అందుతాయి.'], mood: 'సంతోషంగా ఉంటారు. మీ ప్లాన్లు పంచుకుంటే మద్దతు దొరుకుతుంది.', do: ['మీ సర్కిల్‌తో మాట్లాడండి', 'మీకు కావలసింది మర్యాదగా అడగండి'], avoid: 'ఇతరులతో పోల్చుకోవడం; మీ దారి మీదే' },
    { overview: ['ప్రశాంతమైన, ఆధ్యాత్మిక రోజు; విశ్రాంతి, దానం మనశ్శాంతినిస్తాయి.', 'నెమ్మదించి రీఛార్జ్ అవ్వండి; నిశ్శబ్ద సమయం కొత్త ఆలోచనలు తెస్తుంది.'], mood: 'ప్రశాంతంగా, కలల్లో తేలుతున్నట్టు ఉంటారు. త్వరగా నిద్రపోతే హాయిగా ఉంటుంది.', do: ['మౌనంగా ఎవరికైనా సహాయం లేదా దానం చేయండి', 'బాగా నిద్రపోండి, కళ్లకు విశ్రాంతి ఇవ్వండి'], avoid: 'అర్ధరాత్రి వరకు మేల్కోవడం, అధిక ఖర్చు' },
  ],
};

// When no birth details at all: general lines by weekday lord
const GENERAL_DO: Record<AstroLang, string[][]> = {
  English: [
    ['Step out in the morning sun', 'Lead with confidence'], ['Keep your mind calm', 'Call your mother'],
    ['Do the brave task first', 'Exercise a little'], ['Learn something new', 'Write down your ideas'],
    ['Respect elders and teachers', 'Share what you know'], ['Dress up and compliment someone', 'Enjoy music or art'],
    ['Finish pending work', 'Help someone who works hard'],
  ],
  Telugu: [
    ['ఉదయం ఎండలో కాసేపు నడవండి', 'ఆత్మవిశ్వాసంతో ముందడుగు వేయండి'], ['మనసు ప్రశాంతంగా ఉంచుకోండి', 'అమ్మకు ఫోన్ చేయండి'],
    ['ధైర్యం కావలసిన పని ముందు చేయండి', 'కొంచెం వ్యాయామం చేయండి'], ['ఏదైనా కొత్తది నేర్చుకోండి', 'మీ ఆలోచనలు రాసుకోండి'],
    ['పెద్దలను, గురువులను గౌరవించండి', 'మీకు తెలిసింది పంచుకోండి'], ['చక్కగా తయారై ఎవరినైనా మెచ్చుకోండి', 'సంగీతం లేదా కళను ఆస్వాదించండి'],
    ['పెండింగ్ పనులు పూర్తి చేయండి', 'కష్టపడే వారికి సహాయం చేయండి'],
  ],
};

const T: Record<AstroLang, Record<string, string>> = {
  English: {
    greeting: 'Good day, {name}! ✨',
    greetingNoName: 'Good day! ✨',
    tithi: 'Tithi',
    nakshatra: 'Nakshatra',
    vaara: 'Weekday lord',
    moon: "Today's Moon",
    sun: 'Sunrise / Sunset',
    rashiLine: 'Your moon sign: {rashi}',
    rashiStar: 'Your moon sign: {rashi} · Star: {star}',
    approx: 'Worked out from your date of birth (noon, Hyderabad). Add your time of birth in Edit profile for a more exact moon sign.',
    approxStar: 'Your birth star is approximate. Add your time of birth in Edit profile for a more exact reading.',
    computed: 'Moon sign worked out from your birth details (Lahiri, Hyderabad).',
    starsBest: 'A wonderful day ahead.',
    lucky: '{hora} hora {from} – {to} (ruled by {planet}, your rashi lord)',
    luckyHora: '{hora} hora {from} – {to} (ruled by {planet}, today\'s lord)',
    luckyAbhijit: 'Abhijit muhurtam {from} – {to}',
    calm: 'Rahu kalam {from} – {to}: a good time to pause, plan and pray rather than start something new.',
    dressTitle: 'Wear {colours} today',
    whyVaara: 'Today is {day}, ruled by {planet}; {colours} are his colours, believed to bring {benefit}.',
    whyRashi: 'Your moon sign {rashi} is ruled by {lord}, so a touch of {lordColour} keeps you in tune with your own planet.',
    whyStar: "Today's star {star} is ruled by {starLord}, adding a calm, lucky glow.",
    ideaF: 'Idea: a {c} kurti, saree or top with light jewellery and a calm neutral like white or beige.',
    ideaM: 'Idea: a {c} shirt or kurta with navy, white or beige bottoms.',
    ideaO: 'Idea: a {c} top with a calm neutral bottom like white, beige or navy.',
    crushTitle: 'Chance to see the person you like 💫',
    crushHigh: 'High ✨ The Moon is in a friendly place for the heart today. Be yourself, smile, and say hello first!',
    crushGood: 'Good 🙂 A natural, easy day to bump into someone special. Look your best and keep it light.',
    crushGentle: 'Gentle 🌱 A quiet day for the heart: send a kind message or simply enjoy your own company. Good things come in time.',
  },
  Telugu: {
    greeting: 'శుభదినం, {name}! ✨',
    greetingNoName: 'శుభదినం! ✨',
    tithi: 'తిథి',
    nakshatra: 'నక్షత్రం',
    vaara: 'వార అధిపతి',
    moon: 'ఈ రోజు చంద్రుడు',
    sun: 'సూర్యోదయం / సూర్యాస్తమయం',
    rashiLine: 'మీ రాశి: {rashi}',
    rashiStar: 'మీ రాశి: {rashi} · నక్షత్రం: {star}',
    approx: 'మీ పుట్టిన తేదీ నుంచి లెక్కించాం (మధ్యాహ్నం, హైదరాబాద్). ఖచ్చితమైన రాశి కోసం Edit profileలో పుట్టిన సమయం చేర్చండి.',
    approxStar: 'మీ జన్మ నక్షత్రం సుమారుగా లెక్కించాం. ఖచ్చితమైన ఫలితం కోసం Edit profileలో పుట్టిన సమయం చేర్చండి.',
    computed: 'మీ పుట్టిన వివరాల నుంచి రాశి లెక్కించాం (లాహిరి, హైదరాబాద్).',
    starsBest: 'అద్భుతమైన రోజు మీ ముందుంది.',
    lucky: '{hora} హోర {from} – {to} (మీ రాశి అధిపతి {planet})',
    luckyHora: '{hora} హోర {from} – {to} (ఈ రోజు అధిపతి {planet})',
    luckyAbhijit: 'అభిజిత్ ముహూర్తం {from} – {to}',
    calm: 'రాహుకాలం {from} – {to}: కొత్త పనులు మొదలుపెట్టడం కంటే ఆలోచించడానికి, ప్లాన్ చేయడానికి, ప్రార్థనకు మంచి సమయం.',
    dressTitle: 'ఈ రోజు {colours} రంగులు ధరించండి',
    whyVaara: 'ఈ రోజు {day}, అధిపతి {planet}; {colours} ఆయనకు ప్రీతికరమైన రంగులు, ఇవి {benefit} ఇస్తాయని నమ్మకం.',
    whyRashi: 'మీ రాశి {rashi} అధిపతి {lord}, అందుకే కొంచెం {lordColour} రంగు మీ గ్రహానికి అనుకూలం.',
    whyStar: 'ఈ రోజు నక్షత్రం {star}, అధిపతి {starLord}; ఇది ప్రశాంతమైన శుభ కాంతిని ఇస్తుంది.',
    ideaF: 'సూచన: {c} కుర్తీ, చీర లేదా టాప్, తేలికపాటి నగలు, తెలుపు లేదా లేత గోధుమ వంటి ప్రశాంత రంగుతో.',
    ideaM: 'సూచన: {c} షర్ట్ లేదా కుర్తా, ముదురు నీలం, తెలుపు లేదా లేత గోధుమ ప్యాంట్‌తో.',
    ideaO: 'సూచన: {c} టాప్, తెలుపు, లేత గోధుమ లేదా ముదురు నీలం బాటమ్‌తో.',
    crushTitle: 'మీకు నచ్చిన వారిని చూసే అవకాశం 💫',
    crushHigh: 'ఎక్కువ ✨ ఈ రోజు చంద్రుడు మనసుకు అనుకూలమైన స్థానంలో ఉన్నాడు. మీలాగే ఉండండి, చిరునవ్వుతో ముందుగా పలకరించండి!',
    crushGood: 'మంచిది 🙂 ప్రత్యేకమైన వారిని సహజంగా కలిసే రోజు. చక్కగా తయారై సరదాగా ఉండండి.',
    crushGentle: 'నెమ్మదిగా 🌱 మనసుకు ప్రశాంతమైన రోజు: ఒక మంచి మెసేజ్ పంపండి లేదా మీ సమయాన్ని మీరే ఆస్వాదించండి. మంచి రోజులు తప్పక వస్తాయి.',
  },
};

const BENEFIT: Record<AstroLang, string[]> = {
  English: ['confidence and energy', 'calm and a clear mind', 'courage and strength', 'sharp thinking and growth', 'wisdom and good luck', 'beauty, love and harmony', 'steadiness and protection'],
  Telugu: ['ఆత్మవిశ్వాసం, శక్తి', 'ప్రశాంతత, స్పష్టమైన మనసు', 'ధైర్యం, బలం', 'చురుకైన ఆలోచన, ఎదుగుదల', 'జ్ఞానం, అదృష్టం', 'అందం, ప్రేమ, సామరస్యం', 'స్థిరత్వం, రక్షణ'],
};

const planetName = (p: number, lang: AstroLang) => (lang === 'Telugu' ? PLANET_TE : PLANET_EN)[p];
const shortPlanet = (p: number, lang: AstroLang) =>
  lang === 'Telugu' ? PLANET_TE[p] : (PLANET_EN[p].match(/\(([^)]+)\)/)?.[1] || PLANET_EN[p]);

// First daytime hora (after 7 AM, before sunset) ruled by `planet` that does not overlap Rahu kalam
const horaFor = (p: Panchang, planet: number) =>
  p.horas.find(h => h.planet === planet && h.start >= p.sunrise + 30 * 60000 && !(h.start < p.rahu.end && h.end > p.rahu.start)) ||
  null;

export const dailyReading = (
  profile: AstroProfile,
  opts: { uid?: string | null; date?: Date; lang?: AstroLang; wardrobe?: WardrobeItemResponse[] | null } = {},
): DailyReading => {
  const date = opts.date || new Date();
  const lang = opts.lang || astroLanguage(profile.language);
  const t = T[lang];
  const te = lang === 'Telugu';
  const p = panchangFor(date);
  const chart = birthChart(profile);
  const seed = hashString(`${opts.uid || profile.name || 'guest'}|${p.day.key}`);

  const nakName = (n: number) => (te ? NAKSHATRAS_TE : NAKSHATRAS)[n];
  const rashiName = (r: number) => (te ? RASHI_TE : RASHI_EN)[r];
  const weekday = (te ? WEEKDAY_TE : WEEKDAY_EN)[p.day.weekday];

  const panchang = [
    { label: t.tithi, value: tithiName(p.tithi, lang) },
    { label: t.nakshatra, value: nakName(p.nakshatra) },
    { label: t.vaara, value: `${weekday} · ${planetName(p.weekdayLord, lang)}` },
    { label: t.moon, value: rashiName(p.moonRashi) },
    { label: t.sun, value: `${istClock12(p.sunrise)} / ${istClock12(p.sunset)}` },
  ];

  // Personal strength: Chandrabalam (+ Tarabalam when the birth star is known). Always 3..5 stars.
  let house = 0;
  let stars = 3 + (seed % 2);
  let overview: string;
  let mood: string;
  let doList: string[];
  let avoidList: string[];
  if (chart) {
    house = chandraHouse(chart.rashi, p.moonRashi);
    const h = HOUSE[lang][house - 1];
    const goodHouse = GOOD_HOUSES.has(house);
    const tara = chart.nakshatra !== null ? taraOf(chart.nakshatra, p.nakshatra) : 0;
    const goodTara = tara ? GOOD_TARAS.has(tara) : seed % 3 !== 0;
    stars = Math.min(5, 3 + (goodHouse ? 1 : 0) + (goodTara ? 1 : 0));
    overview = pick(h.overview, seed);
    mood = h.mood;
    doList = [...h.do, pick(GENERAL_DO[lang][p.weekdayLord], seed, 1)];
    avoidList = [h.avoid];
  } else {
    const g = GENERAL_DO[lang][p.weekdayLord];
    overview = te
      ? `ఈ రోజు ${weekday}, అధిపతి ${planetName(p.weekdayLord, lang)}. సానుకూలంగా ఆలోచిస్తే ప్రతి పనీ కలిసొస్తుంది.`
      : `Today is ${weekday}, ruled by ${planetName(p.weekdayLord, lang)}. A positive mind turns every task into a win.`;
    mood = te ? 'ప్రశాంతంగా, ఆశాభావంతో ఉండండి.' : 'Stay calm and hopeful.';
    doList = [...g];
    avoidList = [te ? 'అనవసరమైన వాదనలు' : 'Needless arguments'];
  }

  // Lucky time: the rashi lord's hora (else the weekday lord's), and Abhijit muhurtam
  const lord = chart ? RASHI_LORD[chart.rashi] : p.weekdayLord;
  const hora = horaFor(p, lord) || horaFor(p, p.weekdayLord);
  const luckyParts: string[] = [];
  if (hora) {
    const v = { hora: shortPlanet(hora.planet, lang), from: istClock12(hora.start), to: istClock12(hora.end), planet: planetName(hora.planet, lang) };
    luckyParts.push(fill(chart && hora.planet === lord ? t.lucky : t.luckyHora, v));
  }
  if (p.abhijit) luckyParts.push(fill(t.luckyAbhijit, { from: istClock12(p.abhijit.start), to: istClock12(p.abhijit.end) }));
  const calmTime = fill(t.calm, { from: istClock12(p.rahu.start), to: istClock12(p.rahu.end) });

  // Dress: weekday colours first, the rashi lord's colour as a touch, wardrobe pick when possible
  const vaara = getTodayVaaraColour(date);
  const colourWords = luckyColourWords(vaara, lang);
  const lc = PLANET_COLOUR[lord];
  const why = [
    fill(t.whyVaara, { day: weekday, planet: planetName(p.weekdayLord, lang), colours: colourWords, benefit: BENEFIT[lang][p.weekdayLord] }),
    chart ? fill(t.whyRashi, { rashi: rashiName(chart.rashi), lord: planetName(lord, lang), lordColour: te ? lc.te : lc.en.toLowerCase() }) : '',
    fill(t.whyStar, { star: nakName(p.nakshatra), starLord: planetName(nakshatraLord(p.nakshatra), lang) }),
  ]
    .filter(Boolean)
    .join(' ');
  const g = (profile.gender || '').toLowerCase();
  const firstColour = luckyColourWords({ ...vaara, colours: [vaara.colours[seed % vaara.colours.length]] }, lang);
  const idea = fill(g.startsWith('f') ? t.ideaF : g.startsWith('m') ? t.ideaM : t.ideaO, {
    c: te ? firstColour : firstColour.toLowerCase(),
  });
  let pair: DailyReading['dress']['pair'] = null;
  if (opts.wardrobe && opts.wardrobe.length) {
    const r = pickLuckyPairs(opts.wardrobe, lang, { date, max: 1 });
    if (r.pairs[0]) pair = { top: r.pairs[0].top, bottom: r.pairs[0].bottom, why: r.pairs[0].why };
  }
  const colours = vaara.colours.map(c => ({ name: te ? luckyColourWords({ ...vaara, colours: [c] }, lang) : c.name, hex: c.hex }));
  if (chart && !vaara.colours.some(c => lc.en.toLowerCase().includes(c.name.toLowerCase()))) {
    colours.push({ name: te ? lc.te : lc.en, hex: lc.hex });
  }

  // "Chance to see the person you like": 5th / 7th / 11th house, Friday, Venus / Moon signs
  let score = seed % 3;
  if ([5, 7, 11].includes(house)) score += 2;
  else if ([1, 3, 10].includes(house)) score += 1;
  if (p.day.weekday === 5) score += 1;
  if ([1, 6, 3].includes(p.moonRashi)) score += 1;
  const level: 'high' | 'good' | 'gentle' = score >= 4 ? 'high' : score >= 2 ? 'good' : 'gentle';
  const crushText = level === 'high' ? t.crushHigh : level === 'good' ? t.crushGood : t.crushGentle;

  const first = (profile.name || '').trim().split(/\s+/)[0];
  let note: string | null = null;
  if (chart && chart.rashiSource === 'computed') note = chart.timeKnown ? t.computed : t.approx;
  else if (chart && chart.nakshatra !== null && !chart.timeKnown && chart.uncertain) note = t.approxStar;

  return {
    dayKey: p.day.key,
    lang,
    chart,
    needsDob: !chart,
    panchang,
    rashiLine: chart
      ? chart.nakshatra !== null
        ? fill(t.rashiStar, { rashi: rashiName(chart.rashi), star: nakName(chart.nakshatra) })
        : fill(t.rashiLine, { rashi: rashiName(chart.rashi) })
      : null,
    note,
    stars,
    greeting: first ? fill(t.greeting, { name: first }) : t.greetingNoName,
    overview,
    mood,
    doList,
    avoidList,
    luckyTime: luckyParts.join(' · '),
    calmTime,
    dress: { colours, title: fill(t.dressTitle, { colours: colourWords }), why, idea, pair },
    crush: { level, title: t.crushTitle, text: crushText },
  };
};
