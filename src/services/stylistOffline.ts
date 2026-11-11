// Stylist chat answers that need no network (after the wardrobe / colour / weather intents of
// stylistIntent.ts, before the cached Gemini path):
//   astro: rashi, nakshatra, panchang, lucky time, dasha, "how is my day" -> the offline jathakam /
//          daily reading (services/astrologyDaily.ts), in the chat language
//   help:  how to add wardrobe items, vote, circles, nearby, share link, astrology, birthdays...
//   tip:   style, grooming, confidence and gentle everyday life tips
//   other: a polite line (used when Gemini is off / resting / used up)
// English, Telugu (script + romanized cues) and Hindi.
import type { AiLanguage } from './aiStylist';
import { AstroProfile, dailyReading } from './astrologyDaily';
import { hashString } from '../utils/astro';

export type OfflineTopic = 'astro' | 'help' | 'tip';

export interface OfflineTopicAnswer {
  topic: OfflineTopic;
  key: string; // sub-topic (tests / analytics)
  text: string;
}

// ── Astrology ──
const ASTRO =
  /astrolog|horoscope|zodiac|\brashi|\brasi\b|nakshatra|nakshtra|\bstar sign|birth ?star|jathakam|jatakam|jaatakam|jathaka|kundli|kundali|panchang|panchaanga|tithi|thithi|dasha|\brahu ?kal|muhurt|good time|lucky time|lucky (day|number)|how is my day|my day today|today.*(for me|my luck)|జాతక|రాశి|నక్షత్ర|పంచాంగ|తిథి|దశ|ముహూర్త|శుభ సమయ|రాహు|राशि|नक्षत्र|कुंडली|जन्मपत्री|पंचांग|तिथि|दशा|मुहूर्त|शुभ समय|राहु/i;
const SUB_RASHI = /rashi|rasi|zodiac|sign|రాశి|राशि/i;
const SUB_STAR = /nakshatra|nakshtra|birth ?star|నక్షత్ర|नक्षत्र/i;
const SUB_PANCHANG = /panchang|tithi|thithi|పంచాంగ|తిథి|पंचांग|तिथि/i;
const SUB_TIME = /lucky time|good time|muhurt|rahu|శుభ సమయ|ముహూర్త|రాహు|शुभ समय|मुहूर्त|राहु/i;
const SUB_DASHA = /dasha|దశ|दशा/i;

const AT: Record<AiLanguage, Record<string, string>> = {
  English: {
    needDob: 'Add your date of birth (and place, time if you know it) in Me ▸ ⚙️ ▸ Edit profile, and I will read your jathakam offline. Meanwhile, here is today:',
    lucky: 'Lucky time', calm: 'Pause time', do: 'Good to do', avoid: 'Better to avoid', wear: 'Wear', more: 'Full reading: Me ▸ 🔮 Astrology.',
  },
  Telugu: {
    needDob: 'Me ▸ ⚙️ ▸ Edit profile లో మీ పుట్టిన తేదీ (స్థలం, తెలిస్తే సమయం) చేర్చండి, మీ జాతకం ఆఫ్‌లైన్‌లో చెబుతాను. ఈ రోజు ఇలా ఉంది:',
    lucky: 'శుభ సమయం', calm: 'విరామ సమయం', do: 'చేయదగినవి', avoid: 'దూరంగా ఉంచదగినవి', wear: 'ధరించండి', more: 'పూర్తి వివరాలు: Me ▸ 🔮 Astrology.',
  },
  Hindi: {
    needDob: 'Me ▸ ⚙️ ▸ Edit profile में अपनी जन्म तिथि (स्थान, और पता हो तो समय) जोड़ें, मैं आपकी कुंडली ऑफ़लाइन पढ़ दूँगा। अभी आज का हाल:',
    lucky: 'शुभ समय', calm: 'विराम समय', do: 'करने योग्य', avoid: 'टालें', wear: 'पहनें', more: 'पूरा विवरण: Me ▸ 🔮 Astrology.',
  },
};

const astroAnswer = (text: string, lang: AiLanguage, profile: AstroProfile, uid?: string | null, date?: Date): OfflineTopicAnswer => {
  const r = dailyReading(profile, { uid, lang, date });
  const L = AT[lang];
  const rows = (re: RegExp) => r.chartRows.filter(x => re.test(x.label));
  const lines: string[] = [];
  let key = 'day';
  if (SUB_PANCHANG.test(text)) {
    key = 'panchang';
    lines.push(...r.panchang.map(p => `${p.label}: ${p.value}`));
  } else if (SUB_TIME.test(text)) {
    key = 'time';
    lines.push(`🕒 ${L.lucky}: ${r.luckyTime}`, `⏸️ ${L.calm}: ${r.calmTime}`);
  } else if (!r.needsDob && (SUB_RASHI.test(text) || SUB_STAR.test(text) || SUB_DASHA.test(text)) && r.chartRows.length) {
    key = SUB_DASHA.test(text) ? 'dasha' : SUB_STAR.test(text) ? 'star' : 'rashi';
    const want = key === 'dasha' ? /dasha|దశ|दशा/i : key === 'star' ? /nakshatra|star|నక్షత్ర|नक्षत्र|pada|పాద|पद/i : /rashi|rasi|lagna|రాశి|లగ్న|राशि|लग्न/i;
    const hit = rows(want);
    lines.push(...(hit.length ? hit : r.chartRows.slice(0, 4)).map(x => `${x.label}: ${x.value}`));
  } else {
    lines.push(`${'⭐'.repeat(r.stars)} ${r.overview}`);
    if (r.doList[0]) lines.push(`✅ ${L.do}: ${r.doList[0]}`);
    if (r.avoidList[0]) lines.push(`⚠️ ${L.avoid}: ${r.avoidList[0]}`);
    lines.push(`🕒 ${L.lucky}: ${r.luckyTime}`);
    if (r.dress?.title) lines.push(`👗 ${L.wear}: ${r.dress.title}`);
  }
  const head = r.needsDob ? L.needDob : r.rashiLine || '';
  return { topic: 'astro', key, text: [head, ...lines, L.more].filter(Boolean).join('\n') };
};

// ── App help ──
const HOW = /how|where|help|can i|can't|cant|unable|not able|steps|kaise|kahan|kaha|kya karu|ela |ela\?|ekkada|cheyali|cheyyali|ఎలా|ఎక్కడ|చేయాలి|कैसे|कहाँ|कहां|मदद/i;

type HelpKey = 'wardrobe' | 'vote' | 'circles' | 'nearby' | 'share' | 'astrology' | 'birthday' | 'stylist' | 'notifications' | 'profile';
const HELP_TOPICS: [RegExp, HelpKey][] = [
  [/birthday|bday|wish|పుట్టినరోజు|జన్మదిన|जन्मदिन|बर्थडे/i, 'birthday'],
  [/nearby|near me|around me|దగ్గర|పక్కన|आसपास|नज़दीक|नजदीक/i, 'nearby'],
  [/share|invite|refer|link|download link|షేర్|ఆహ్వాన|లింక్|शेयर|आमंत्रण|लिंक|इनवाइट/i, 'share'],
  [/circle|group|సర్కిల్|గ్రూప్|सर्कल|ग्रुप/i, 'circles'],
  [/wardrobe|add (a |my )?(item|cloth|dress|photo|shirt)|upload|closet|వార్డ్‌రోబ్|వార్డ్రోబ్|బట్టలు (చేర్చ|యాడ్)|वॉर्डरोब|वार्डरोब|कपड़े (जोड़|डाल)/i, 'wardrobe'],
  [/vote|poll|ఓటు|ఓట్|वोट|पोल/i, 'vote'],
  [/astrolog|jathakam|horoscope|జాతకం|कुंडली/i, 'astrology'],
  [/notification|alert|నోటిఫికేషన్|नोटिफिकेशन|सूचना/i, 'notifications'],
  [/profile|photo change|name change|dark mode|app lock|fingerprint|ప్రొఫైల్|प्रोफ़ाइल|प्रोफाइल/i, 'profile'],
  [/stylist|this chat|you do|what can you|ai\b|ఏం చేయగల|क्या कर सकते/i, 'stylist'],
];

const HELP: Record<AiLanguage, Record<HelpKey, string>> = {
  English: {
    wardrobe: '👗 Add to your wardrobe: open the Wardrobe tab ▸ tap "+ Add" ▸ take a photo or pick one ▸ choose the category and colour ▸ Save. Public items can get likes and votes; I use your items for outfit picks.',
    vote: '🗳️ Voting: on Home tap a colour in "Today\'s Top Colours" (you can change it the same day). In the Feed and in circles, tap A / B / C on a photo poll to vote for a look.',
    circles: '◎ Circles: open the Circles tab ▸ "+ Create" (name, Public or Private) or type an invite code in "Join with invite code". In a circle tap ＋ to share photos or start an A–F photo poll. The circle info (ⓘ) has the invite link.',
    nearby: '📍 Nearby: Circles tab ▸ "📍 Nearby" shows public circles within 3 km, nearest first. Allow location when asked. To show yours there, turn on "Show in Nearby" when you create a public circle.',
    share: '🎁 Share the app: Me ▸ ⚙️ ▸ "🎁 Invite" (or "Invite friends") shares your personal link. Friends who join with it count as yours and you get points. A circle invite link is in the circle info (ⓘ).',
    astrology: '🔮 Astrology: Me tab ▸ "🔮 Astrology" shows today\'s panchang, your jathakam reading, lucky time, what to wear and festival plans. Add your birth details in Me ▸ ⚙️ ▸ Edit profile and tap "Confirm birth details".',
    birthday: '🎂 Birthdays: turn on "Show my birthday" in Me ▸ ⚙️ (day and month only, never your age). Home shows birthdays today and in the next 7 days: tap a person to wish, tap a wish to reply with @name. On your birthday you can join the "Happy birthday to all" circle.',
    stylist: '✦ I can pick outfits from your wardrobe (try "just one for office"), tell today\'s lucky colour, what goes with a colour, dress for weather, read your jathakam, and explain how the app works. Tap an Occasion or Place chip for quick advice.',
    notifications: '🔔 Notifications: Me ▸ ⚙️ ▸ Notifications opens the phone settings for Outfit. Turn them on to hear about likes, comments, follows and birthday wishes.',
    profile: '⚙️ Profile: Me ▸ ⚙️ ▸ Edit profile for name, photo, birth details, language and public / private. Dark mode, fingerprint lock and "Show my birthday" are on the same screen.',
  },
  Telugu: {
    wardrobe: '👗 వార్డ్‌రోబ్‌కి చేర్చడం: Wardrobe ట్యాబ్ ▸ "+ Add" ▸ ఫోటో తీయండి లేదా ఎంచుకోండి ▸ రకం, రంగు ఎంచుకోండి ▸ Save. మీ బట్టల నుండే నేను జతలు సూచిస్తాను.',
    vote: '🗳️ ఓటు: Home లో "Today\'s Top Colours" లో ఒక రంగు నొక్కండి (అదే రోజు మార్చవచ్చు). Feed, సర్కిల్స్‌లో ఫోటో పోల్‌లో A / B / C నొక్కి ఓటు వేయండి.',
    circles: '◎ సర్కిల్స్: Circles ట్యాబ్ ▸ "+ Create" (పేరు, Public / Private) లేదా "Join with invite code" లో కోడ్ టైప్ చేయండి. సర్కిల్‌లో ＋ నొక్కి ఫోటోలు లేదా A–F పోల్ పంపండి. ⓘ లో ఇన్వైట్ లింక్ ఉంటుంది.',
    nearby: '📍 దగ్గరలో: Circles ▸ "📍 Nearby" లో 3 కి.మీ లోపు పబ్లిక్ సర్కిల్స్ కనిపిస్తాయి. లొకేషన్ అనుమతించండి. మీ సర్కిల్ కనిపించాలంటే సృష్టించేటప్పుడు "Show in Nearby" ఆన్ చేయండి.',
    share: '🎁 యాప్ షేర్: Me ▸ ⚙️ ▸ "🎁 Invite" మీ లింక్ షేర్ చేస్తుంది. ఆ లింక్‌తో చేరిన స్నేహితులు మీ ఖాతాలో లెక్కకు వస్తారు, పాయింట్లు వస్తాయి. సర్కిల్ లింక్ ⓘ లో ఉంటుంది.',
    astrology: '🔮 జాతకం: Me ▸ "🔮 Astrology" లో పంచాంగం, మీ జాతకం, శుభ సమయం, ఏ దుస్తులు, పండుగ ప్రణాళిక. Me ▸ ⚙️ ▸ Edit profile లో పుట్టిన వివరాలు చేర్చి "Confirm birth details" నొక్కండి.',
    birthday: '🎂 పుట్టినరోజులు: Me ▸ ⚙️ లో "Show my birthday" ఆన్ చేయండి (రోజు, నెల మాత్రమే, వయసు కాదు). Home లో ఈ రోజు, వచ్చే 7 రోజుల పుట్టినరోజులు: పేరు నొక్కి శుభాకాంక్షలు పంపండి, ఒక విష్ నొక్కి @పేరుతో రిప్లై ఇవ్వండి.',
    stylist: '✦ మీ వార్డ్‌రోబ్ నుండి దుస్తులు ఎంచుకుంటాను, ఈ రోజు అదృష్ట రంగు, ఏ రంగుతో ఏది సరిపోతుంది, వాతావరణానికి దుస్తులు, మీ జాతకం, యాప్ ఎలా వాడాలో చెబుతాను.',
    notifications: '🔔 నోటిఫికేషన్లు: Me ▸ ⚙️ ▸ Notifications ఫోన్ సెట్టింగ్స్ తెరుస్తుంది. లైక్స్, కామెంట్స్, ఫాలోలు, పుట్టినరోజు విషెస్ తెలియడానికి ఆన్ చేయండి.',
    profile: '⚙️ ప్రొఫైల్: Me ▸ ⚙️ ▸ Edit profile లో పేరు, ఫోటో, పుట్టిన వివరాలు, భాష, పబ్లిక్ / ప్రైవేట్. డార్క్ మోడ్, ఫింగర్‌ప్రింట్ లాక్, "Show my birthday" అదే స్క్రీన్‌లో.',
  },
  Hindi: {
    wardrobe: '👗 वॉर्डरोब में जोड़ें: Wardrobe टैब ▸ "+ Add" ▸ फ़ोटो लें या चुनें ▸ कैटेगरी और रंग चुनें ▸ Save। आपके कपड़ों से ही मैं जोड़ी सुझाता हूँ।',
    vote: '🗳️ वोट: Home पर "Today\'s Top Colours" में एक रंग दबाएँ (उसी दिन बदल सकते हैं)। Feed और सर्कल में फ़ोटो पोल पर A / B / C दबाकर वोट करें।',
    circles: '◎ सर्कल: Circles टैब ▸ "+ Create" (नाम, Public / Private) या "Join with invite code" में कोड लिखें। सर्कल में ＋ दबाकर फ़ोटो या A–F पोल भेजें। ⓘ में इनवाइट लिंक है।',
    nearby: '📍 आसपास: Circles ▸ "📍 Nearby" में 3 किमी के अंदर के पब्लिक सर्कल दिखते हैं। लोकेशन की अनुमति दें। अपना सर्कल दिखाने के लिए बनाते समय "Show in Nearby" चालू करें।',
    share: '🎁 ऐप शेयर: Me ▸ ⚙️ ▸ "🎁 Invite" आपका लिंक शेयर करता है। उस लिंक से जुड़ने वाले दोस्त आपके गिने जाते हैं और पॉइंट मिलते हैं। सर्कल लिंक ⓘ में है।',
    astrology: '🔮 ज्योतिष: Me ▸ "🔮 Astrology" में पंचांग, आपकी कुंडली, शुभ समय, क्या पहनें और त्योहार की तैयारी। Me ▸ ⚙️ ▸ Edit profile में जन्म विवरण भरकर "Confirm birth details" दबाएँ।',
    birthday: '🎂 जन्मदिन: Me ▸ ⚙️ में "Show my birthday" चालू करें (सिर्फ़ दिन और महीना, उम्र नहीं)। Home पर आज और अगले 7 दिन के जन्मदिन: नाम दबाकर शुभकामना भेजें, किसी विश को दबाकर @नाम से जवाब दें।',
    stylist: '✦ मैं आपके वॉर्डरोब से कपड़े चुनता हूँ, आज का शुभ रंग, किस रंग के साथ क्या जँचे, मौसम के कपड़े, आपकी कुंडली और ऐप कैसे चलाएँ, यह बताता हूँ।',
    notifications: '🔔 नोटिफ़िकेशन: Me ▸ ⚙️ ▸ Notifications फ़ोन की सेटिंग खोलता है। लाइक, कमेंट, फ़ॉलो और जन्मदिन की शुभकामनाएँ जानने के लिए चालू करें।',
    profile: '⚙️ प्रोफ़ाइल: Me ▸ ⚙️ ▸ Edit profile में नाम, फ़ोटो, जन्म विवरण, भाषा और पब्लिक / प्राइवेट। डार्क मोड, फ़िंगरप्रिंट लॉक और "Show my birthday" उसी स्क्रीन पर हैं।',
  },
};

// ── Style & life tips ──
type TipKey = 'grooming' | 'confidence' | 'body' | 'care' | 'colours' | 'wellbeing' | 'study' | 'style';
const TIP_TOPICS: [RegExp, TipKey][] = [
  [/stress|anxi|tension|sad|lonely|sleep|tired|motivat|depress|mood|ఒత్తిడి|నిద్ర|బాధ|तनाव|नींद|उदास|थकान/i, 'wellbeing'],
  [/study|exam|focus|concentrat|productiv|చదువు|పరీక్ష|पढ़ाई|परीक्षा/i, 'study'],
  [/confiden|shy|personality|attractive|impress|ఆత్మవిశ్వాస|సిగ్గు|आत्मविश्वास|शर्म/i, 'confidence'],
  [/groom|skin|hair|beard|face|perfume|smell|చర్మ|జుట్టు|గడ్డం|त्वचा|बाल|दाढ़ी/i, 'grooming'],
  [/tall|short|slim|thin|fat|heavy|belly|body type|look (taller|slimmer)|పొడవు|పొట్టి|సన్నగా|లావు|लंबा|छोटा|पतला|मोटा/i, 'body'],
  [/wash|iron|care|stain|shrink|fold|ఉతక|ఇస్త్రీ|मरकत|धुल|इस्त्री|दाग/i, 'care'],
  [/skin ?tone|complexion|dark skin|fair skin|which colou?rs? suit|రంగు నాకు|स्किन टोन/i, 'colours'],
  [/tip|advice|suggestion|idea|fashion|style|look good|smart|stylish|సలహా|చిట్కా|స్టైల్|सलाह|टिप|स्टाइल/i, 'style'],
];
const TIP_CUE = /tip|advice|suggest|how (to|can i|do i)|should i|help me|ela |ఎలా|సలహా|చిట్కా|कैसे|सलाह|टिप/i;

const TIPS: Record<AiLanguage, Record<TipKey, string[]>> = {
  English: {
    style: ['Fit beats brand: clothes that fit your shoulders and length look expensive.', 'Build looks around one statement piece and keep the rest calm.', 'Match belt and shoes, and keep 2-3 colours per outfit.', 'A crisp white shirt, dark jeans and clean shoes go almost everywhere.'],
    grooming: ['Wash your face twice a day, moisturise, and use sunscreen outdoors.', 'A fresh haircut every 4-6 weeks and trimmed nails lift any outfit.', 'Light perfume on wrists and neck; less is more.'],
    confidence: ['Stand tall, shoulders back, and slow down when you speak.', 'Wear what you feel comfortable in; comfort shows as confidence.', 'Smile, make eye contact, and remember people\'s names.'],
    body: ['To look taller: one colour head to toe, vertical lines, fitted trousers.', 'To look slimmer: darker colours, straight fits, no very tight or very loose clothes.', 'For a slim frame: layers, horizontal stripes and structured jackets add shape.'],
    care: ['Wash darks inside out in cold water so colours last.', 'Hang shirts right after washing to cut ironing time.', 'Treat stains quickly with cold water; hot water sets them.'],
    colours: ['Warm skin tones glow in mustard, olive, maroon and cream; cool tones in navy, emerald, grey and pure white.', 'If unsure, navy, white, beige and maroon suit almost every skin tone.'],
    wellbeing: ['Take a 10 minute walk in daylight, drink water, and keep a regular sleep time.', 'Talk to someone you trust; small steps count. If it feels heavy for long, please speak to a doctor or counsellor.', 'Lay out tomorrow\'s outfit tonight: one less decision in the morning.'],
    study: ['Study in 25 minute blocks with 5 minute breaks, phone in another room.', 'Comfortable clothes and a tidy desk help you focus.'],
  },
  Telugu: {
    style: ['బ్రాండ్ కంటే ఫిట్ ముఖ్యం: భుజాలు, పొడవు సరిగ్గా ఉన్న బట్టలు ఖరీదుగా కనిపిస్తాయి.', 'ఒక ప్రత్యేక దుస్తు చుట్టూ లుక్ కట్టండి, మిగతావి ప్రశాంతంగా ఉంచండి.', 'బెల్ట్, షూస్ ఒకే రంగులో; ఒక డ్రెస్‌లో 2-3 రంగులు చాలు.'],
    grooming: ['రోజుకు రెండుసార్లు ముఖం కడిగి, మాయిశ్చరైజర్, బయట సన్‌స్క్రీన్ వాడండి.', '4-6 వారాలకు ఒకసారి హెయిర్‌కట్, కత్తిరించిన గోళ్లు ఏ డ్రెస్‌నైనా మెరుగుపరుస్తాయి.'],
    confidence: ['నిటారుగా నిలబడండి, భుజాలు వెనక్కి, నెమ్మదిగా మాట్లాడండి.', 'మీకు సౌకర్యంగా ఉన్నవి వేసుకోండి; సౌకర్యమే ఆత్మవిశ్వాసంగా కనిపిస్తుంది.'],
    body: ['పొడవుగా కనిపించాలంటే: తల నుండి కాళ్ల వరకు ఒకే రంగు, నిలువు గీతలు.', 'సన్నగా కనిపించాలంటే: ముదురు రంగులు, స్ట్రెయిట్ ఫిట్.'],
    care: ['ముదురు బట్టలను తిరగేసి చల్లని నీటిలో ఉతకండి, రంగు నిలుస్తుంది.', 'మరకలను వెంటనే చల్లని నీటితో శుభ్రం చేయండి.'],
    colours: ['వెచ్చని చర్మ రంగుకు ఆవాల పసుపు, ఆలివ్, మెరూన్; చల్లని రంగుకు నేవీ, ఎమరాల్డ్, గ్రే బాగుంటాయి.', 'తెలియకపోతే నేవీ, తెలుపు, లేత గోధుమ, మెరూన్ దాదాపు అందరికీ సరిపోతాయి.'],
    wellbeing: ['రోజూ 10 నిమిషాలు ఎండలో నడవండి, నీళ్లు తాగండి, ఒకే సమయానికి నిద్రపోండి.', 'నమ్మకమైన వారితో మాట్లాడండి. చాలా రోజులు భారంగా అనిపిస్తే డాక్టర్ లేదా కౌన్సిలర్‌ని కలవండి.'],
    study: ['25 నిమిషాలు చదివి 5 నిమిషాలు విరామం; ఫోన్ వేరే గదిలో.', 'సౌకర్యమైన బట్టలు, శుభ్రమైన టేబుల్ ఏకాగ్రతకు సహాయం.'],
  },
  Hindi: {
    style: ['ब्रांड से ज़्यादा फ़िटिंग मायने रखती है: सही कंधे और लंबाई वाले कपड़े महँगे दिखते हैं।', 'एक ख़ास कपड़े के इर्द-गिर्द लुक बनाएँ, बाक़ी शांत रखें।', 'बेल्ट और जूते एक रंग के; एक ड्रेस में 2-3 रंग काफ़ी हैं।'],
    grooming: ['दिन में दो बार चेहरा धोएँ, मॉइस्चराइज़र और बाहर सनस्क्रीन लगाएँ।', 'हर 4-6 हफ़्ते में हेयरकट और कटे नाखून हर लुक निखारते हैं।'],
    confidence: ['सीधे खड़े हों, कंधे पीछे, धीरे बोलें।', 'जिसमें आराम हो वही पहनें; आराम ही आत्मविश्वास दिखता है।'],
    body: ['लंबा दिखने के लिए: सिर से पैर तक एक रंग, खड़ी धारियाँ।', 'पतला दिखने के लिए: गहरे रंग, सीधी फ़िटिंग।'],
    care: ['गहरे कपड़े उल्टे करके ठंडे पानी में धोएँ, रंग टिकेगा।', 'दाग़ तुरंत ठंडे पानी से साफ़ करें।'],
    colours: ['गेहुँए / गर्म रंगत पर सरसों, ऑलिव, मैरून; ठंडी रंगत पर नेवी, एमरल्ड, ग्रे जँचते हैं।', 'पक्का न हो तो नेवी, सफ़ेद, बेज और मैरून लगभग सब पर जँचते हैं।'],
    wellbeing: ['रोज़ 10 मिनट धूप में टहलें, पानी पिएँ, एक तय समय पर सोएँ।', 'किसी भरोसेमंद से बात करें। लंबे समय तक भारी लगे तो डॉक्टर या काउंसलर से मिलें।'],
    study: ['25 मिनट पढ़ें, 5 मिनट ब्रेक; फ़ोन दूसरे कमरे में।', 'आरामदायक कपड़े और साफ़ मेज़ ध्यान में मदद करते हैं।'],
  },
};

const POLITE: Record<AiLanguage, string> = {
  English: "I'm your style buddy, so I can't help with that one 🙏 Ask me what to wear, today's lucky colour, your jathakam, a style tip, or how to use the app.",
  Telugu: 'నేను మీ స్టైల్ సహాయకుడిని, దీనికి సహాయం చేయలేను 🙏 ఏం వేసుకోవాలి, ఈ రోజు అదృష్ట రంగు, మీ జాతకం, స్టైల్ చిట్కా, లేదా యాప్ ఎలా వాడాలో అడగండి.',
  Hindi: 'मैं आपका स्टाइल साथी हूँ, इसमें मदद नहीं कर पाऊँगा 🙏 क्या पहनें, आज का शुभ रंग, आपकी कुंडली, स्टाइल टिप या ऐप कैसे चलाएँ, यह पूछें।',
};
export const politeLine = (lang: AiLanguage): string => POLITE[lang];

// Answer for astrology / app-help / tip questions; null when it is none of these
export const offlineTopicAnswer = (
  raw: string,
  lang: AiLanguage,
  ctx: { profile?: AstroProfile | null; uid?: string | null; date?: Date } = {},
): OfflineTopicAnswer | null => {
  const text = (raw || '').trim();
  if (!text) return null;
  const help = HELP_TOPICS.find(([re]) => re.test(text));
  // "how do I add to wardrobe", "where is nearby", "circle ela create cheyali"
  if (help && (HOW.test(text) || help[1] === 'stylist')) {
    return { topic: 'help', key: help[1], text: HELP[lang][help[1]] };
  }
  if (ASTRO.test(text)) return astroAnswer(text, lang, ctx.profile || {}, ctx.uid, ctx.date);
  const tip = TIP_TOPICS.find(([re]) => re.test(text));
  if (tip && (TIP_CUE.test(text) || tip[1] !== 'style')) {
    const list = TIPS[lang][tip[1]];
    const seed = hashString(`${text.toLowerCase()}|${(ctx.date || new Date()).toDateString()}`);
    const a = list[seed % list.length];
    const b = list.length > 1 ? list[(seed + 1) % list.length] : '';
    return { topic: 'tip', key: tip[1], text: `💡 ${a}${b && b !== a ? `\n💡 ${b}` : ''}` };
  }
  if (help) return { topic: 'help', key: help[1], text: HELP[lang][help[1]] };
  return null;
};
