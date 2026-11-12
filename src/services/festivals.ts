// Offline list of Indian / Telugu festivals and national days for 2026 and 2027 (IST dates, 56
// entries), with a short explanation, how to celebrate and what to wear (colours + why).
// Names and the dress-colour line (wear): all 12 app languages. About / celebrate: English and
// Telugu (other languages show the English text).
// Dates checked (Nov 2026): Telangana G.O.Rt.No.1715 (general / optional holidays 2026), DoPT
// central-government holiday list 2027 (O.M. 12/2/2023-JCA, 16 Jul 2026), and the Hyderabad
// (Lahiri, Amanta) festival tables of thetelugucalendar.com for 2026 / 2027; Bathukamma 2026 = 10 Oct,
// Holi 2027 = 22 Mar, Ugadi 2027 = 7 Apr, Dasara 2027 = 9 Oct (settled with the user).
// Islamic dates (Shab-e-Barat, Ramzan, Bakrid, Muharram, Milad-un-Nabi) follow the government lists
// and can move by a day with the moon sighting; Shab-e-Barat 2027 (24 Jan) is estimated (Telangana
// 2027 list not yet out). Bonalu: Golconda start + the Telangana holiday (2026); 2027 start only.
// Vaikunta Ekadashi has no date in 2027 (it falls in Jan 2028). Add the 2028 dates before 2028.
import { daysBetween, istDay } from '../utils/astro';
import { colourName } from '../i18n/astroNames';
import type { AstroLang } from '../i18n/astroNames';

type ByLang = Partial<Record<AstroLang, string>> & { English: string };

export interface Festival {
  id: string;
  dates: string[]; // YYYY-MM-DD (IST)
  emoji: string;
  name: Record<AstroLang, string>;
  about: ByLang;
  celebrate: ByLang;
  wear: ByLang;
  colours: { name: string; hex: string }[]; // English colour names (i18n/astroNames colourName)
}

export const FESTIVALS: Festival[] = [
  {
    id: "newyear", dates: ["2026-01-01", "2027-01-01", "2028-01-01"], emoji: "🎆",
    name: {"English": "New Year", "Telugu": "నూతన సంవత్సరం", "Hindi": "नव वर्ष", "Tamil": "புத்தாண்டு", "Kannada": "ಹೊಸ ವರ್ಷ", "Malayalam": "പുതുവത്സരം", "Marathi": "नववर्ष", "Bengali": "নববর্ষ", "Gujarati": "નવું વર્ષ", "Punjabi": "ਨਵਾਂ ਸਾਲ", "Odia": "ନୂଆ ବର୍ଷ", "Urdu": "نیا سال"},
    about: {"English": "The first day of the year: a fresh start full of hope.", "Telugu": "సంవత్సరంలో మొదటి రోజు: ఆశలతో నిండిన కొత్త ప్రారంభం."},
    celebrate: {"English": "Write three goals, call loved ones, visit a temple or church, and start a good habit today.", "Telugu": "మూడు లక్ష్యాలు రాసుకోండి, ఆత్మీయులకు ఫోన్ చేయండి, గుడి లేదా చర్చికి వెళ్లండి, ఒక మంచి అలవాటు ఈ రోజే మొదలుపెట్టండి."},
    wear: {"English": "Something new in bright, happy colours: gold, red or white. A new outfit is a traditional sign of a good start.", "Telugu": "బంగారు, ఎరుపు లేదా తెలుపు వంటి ప్రకాశవంతమైన కొత్త బట్టలు. కొత్త బట్టలు శుభారంభానికి సంకేతం."},
    colours: [{"name": "Gold", "hex": "#D4A017"}, {"name": "Red", "hex": "#D32F2F"}, {"name": "White", "hex": "#F5F5F5"}],
  },
  {
    id: "bhogi", dates: ["2026-01-14", "2027-01-14"], emoji: "🔥",
    name: {"English": "Bhogi", "Telugu": "భోగి", "Hindi": "भोगी", "Tamil": "போகி", "Kannada": "ಭೋಗಿ", "Malayalam": "ഭോഗി", "Marathi": "भोगी", "Bengali": "ভোগী", "Gujarati": "ભોગી", "Punjabi": "ਭੋਗੀ (ਲੋਹੜੀ)", "Odia": "ଭୋଗି", "Urdu": "بھوگی"},
    about: {"English": "The first day of Sankranti: old things go into the Bhogi fire to welcome new beginnings.", "Telugu": "సంక్రాంతి మొదటి రోజు: పాతవాటిని భోగి మంటల్లో వేసి కొత్తదనానికి స్వాగతం పలుకుతాం."},
    celebrate: {"English": "Light the Bhogi fire at dawn, draw muggulu, and shower little ones with Bhogi pallu (regi fruits) for blessings.", "Telugu": "తెల్లవారుజామున భోగి మంటలు వేసి, ముగ్గులు వేసి, పిల్లలకు భోగి పళ్లు పోసి ఆశీర్వదించండి."},
    wear: {"English": "Traditional wear in yellow, orange or red: warm colours for the fire and the harvest sun.", "Telugu": "పసుపు, నారింజ లేదా ఎరుపు రంగుల సంప్రదాయ దుస్తులు: మంటలకు, పంట సూర్యుడికి తగిన వెచ్చని రంగులు."},
    colours: [{"name": "Yellow", "hex": "#FBC02D"}, {"name": "Orange", "hex": "#F57C00"}, {"name": "Red", "hex": "#D32F2F"}],
  },
  {
    id: "sankranti", dates: ["2026-01-15", "2027-01-15"], emoji: "🪁",
    name: {"English": "Makara Sankranti", "Telugu": "మకర సంక్రాంతి", "Hindi": "मकर संक्रांति", "Tamil": "தை பொங்கல் (மகர சங்கராந்தி)", "Kannada": "ಮಕರ ಸಂಕ್ರಾಂತಿ", "Malayalam": "മകരസംക്രാന്തി", "Marathi": "मकर संक्रांत", "Bengali": "মকর সংক্রান্তি", "Gujarati": "મકર સંક્રાંતિ (ઉત્તરાયણ)", "Punjabi": "ਮਕਰ ਸੰਕ੍ਰਾਂਤੀ (ਮਾਘੀ)", "Odia": "ମକର ସଂକ୍ରାନ୍ତି", "Urdu": "مکر سنکرانتی"},
    about: {"English": "The Sun enters Makara: the harvest festival of thanks to the Sun, farmers and cattle.", "Telugu": "సూర్యుడు మకర రాశిలోకి ప్రవేశించే పండుగ: సూర్యుడికి, రైతులకు, పశువులకు కృతజ్ఞతలు తెలిపే పంట పండుగ."},
    celebrate: {"English": "Big rangoli (muggulu) with gobbemmalu, pongali and sweets like ariselu, kite flying and time with family.", "Telugu": "గొబ్బెమ్మలతో పెద్ద ముగ్గులు, పొంగలి, అరిసెలు, గాలిపటాలు, కుటుంబంతో సరదాగా గడపడం."},
    wear: {"English": "New traditional clothes: silk saree / langa voni or kurta / pancha in yellow, green or maroon. Yellow and green stand for the harvest and prosperity.", "Telugu": "కొత్త సంప్రదాయ దుస్తులు: పసుపు, ఆకుపచ్చ లేదా మెరూన్ పట్టు చీర / లంగా ఓణీ లేదా కుర్తా / పంచె. పసుపు, ఆకుపచ్చ పంటకు, సమృద్ధికి సంకేతం."},
    colours: [{"name": "Yellow", "hex": "#FBC02D"}, {"name": "Green", "hex": "#388E3C"}, {"name": "Maroon", "hex": "#800000"}],
  },
  {
    id: "kanuma", dates: ["2026-01-16", "2027-01-16"], emoji: "🐄",
    name: {"English": "Kanuma", "Telugu": "కనుమ", "Hindi": "कनुमा (मट्टू पोंगल)", "Tamil": "மாட்டுப் பொங்கல் (கனுமா)", "Kannada": "ಕನುಮ", "Malayalam": "കനുമ (മാട്ടുപ്പൊങ്കൽ)", "Marathi": "कनुमा", "Bengali": "কনুমা", "Gujarati": "કનુમા", "Punjabi": "ਕਨੁਮਾ", "Odia": "କନୁମା", "Urdu": "کنوما"},
    about: {"English": "The third day of Sankranti, giving thanks to cattle and farm life.", "Telugu": "సంక్రాంతి మూడో రోజు: పశువులకు, వ్యవసాయ జీవితానికి కృతజ్ఞతలు."},
    celebrate: {"English": "Decorate and feed the cattle, share a family feast and visit relatives.", "Telugu": "పశువులను అలంకరించి మేత పెట్టండి, కుటుంబంతో విందు చేయండి, బంధువులను కలవండి."},
    wear: {"English": "Comfortable traditional wear in green or yellow, colours of the fields.", "Telugu": "పొలాల రంగులైన ఆకుపచ్చ లేదా పసుపు సౌకర్యవంతమైన సంప్రదాయ దుస్తులు."},
    colours: [{"name": "Green", "hex": "#388E3C"}, {"name": "Yellow", "hex": "#FBC02D"}],
  },
  {
    id: "vasantpanchami", dates: ["2026-01-23", "2027-02-11"], emoji: "📚",
    name: {"English": "Vasant Panchami (Sri Panchami)", "Telugu": "వసంత పంచమి (శ్రీ పంచమి)", "Hindi": "वसंत पंचमी", "Tamil": "வசந்த பஞ்சமி", "Kannada": "ವಸಂತ ಪಂಚಮಿ", "Malayalam": "വസന്ത പഞ്ചമി", "Marathi": "वसंत पंचमी", "Bengali": "সরস্বতী পূজা (বসন্ত পঞ্চমী)", "Gujarati": "વસંત પંચમી", "Punjabi": "ਬਸੰਤ ਪੰਚਮੀ", "Odia": "ବସନ୍ତ ପଞ୍ଚମୀ (ସରସ୍ୱତୀ ପୂଜା)", "Urdu": "بسنت پنچمی"},
    about: {"English": "The day of Goddess Saraswati and the start of spring: a lucky day to begin learning.", "Telugu": "సరస్వతీ దేవి రోజు, వసంత ఆరంభం: చదువు మొదలుపెట్టడానికి శుభదినం."},
    celebrate: {"English": "Worship Saraswati with books and pens, and start a child's first letters (aksharabhyasam).", "Telugu": "పుస్తకాలు, కలాలతో సరస్వతీ పూజ చేయండి, పిల్లలకు అక్షరాభ్యాసం చేయించండి."},
    wear: {"English": "Yellow, the colour of spring mustard flowers and of Saraswati, with white.", "Telugu": "వసంత పూల రంగు, సరస్వతికి ప్రీతికరమైన పసుపు, తెలుపుతో."},
    colours: [{"name": "Yellow", "hex": "#FBC02D"}, {"name": "White", "hex": "#F5F5F5"}],
  },
  {
    id: "rathasaptami", dates: ["2026-01-25", "2027-02-13"], emoji: "☀️",
    name: {"English": "Ratha Saptami", "Telugu": "రథ సప్తమి", "Hindi": "रथ सप्तमी", "Tamil": "ரத சப்தமி", "Kannada": "ರಥ ಸಪ್ತಮಿ", "Malayalam": "രഥ സപ്തമി", "Marathi": "रथसप्तमी", "Bengali": "রথ সপ্তমী", "Gujarati": "રથ સપ્તમી", "Punjabi": "ਰਥ ਸਪਤਮੀ", "Odia": "ରଥ ସପ୍ତମୀ", "Urdu": "رتھ سپتمی"},
    about: {"English": "The birthday of the Sun God (Surya Jayanti), when his chariot turns north.", "Telugu": "సూర్య జయంతి: సూర్యుని రథం ఉత్తరం వైపు తిరిగే రోజు."},
    celebrate: {"English": "Take a head bath with arka (jilledu) leaves, draw a chariot muggu and offer pongali to the Sun.", "Telugu": "జిల్లేడు ఆకులతో తలస్నానం చేసి, రథం ముగ్గు వేసి, సూర్యుడికి పొంగలి నివేదించండి."},
    wear: {"English": "Red or orange, the colours of the rising Sun.", "Telugu": "ఉదయ సూర్యుని రంగులైన ఎరుపు లేదా నారింజ."},
    colours: [{"name": "Red", "hex": "#C62828"}, {"name": "Orange", "hex": "#F57C00"}],
  },
  {
    id: "republic", dates: ["2026-01-26", "2027-01-26"], emoji: "🇮🇳",
    name: {"English": "Republic Day", "Telugu": "గణతంత్ర దినోత్సవం", "Hindi": "गणतंत्र दिवस", "Tamil": "குடியரசு தினம்", "Kannada": "ಗಣರಾಜ್ಯೋತ್ಸವ", "Malayalam": "റിപ്പബ്ലിക് ദിനം", "Marathi": "प्रजासत्ताक दिन", "Bengali": "প্রজাতন্ত্র দিবস", "Gujarati": "પ્રજાસત્તાક દિન", "Punjabi": "ਗਣਤੰਤਰ ਦਿਵਸ", "Odia": "ସାଧାରଣତନ୍ତ୍ର ଦିବସ", "Urdu": "یومِ جمہوریہ"},
    about: {"English": "The day India's Constitution came into force in 1950.", "Telugu": "1950లో భారత రాజ్యాంగం అమలులోకి వచ్చిన రోజు."},
    celebrate: {"English": "Watch the parade, hoist the flag at school or office, and read the Preamble.", "Telugu": "పరేడ్ చూడండి, బడిలో లేదా ఆఫీసులో జెండా ఎగరేయండి, ప్రవేశిక చదవండి."},
    wear: {"English": "The tricolour: saffron, white and green.", "Telugu": "త్రివర్ణ రంగులు: కాషాయం, తెలుపు, ఆకుపచ్చ."},
    colours: [{"name": "Saffron", "hex": "#FF9933"}, {"name": "White", "hex": "#F5F5F5"}, {"name": "Green", "hex": "#388E3C"}],
  },
  {
    id: "shabebarat", dates: ["2026-02-04", "2027-01-24"], emoji: "🌙",
    name: {"English": "Shab-e-Barat", "Telugu": "షబ్-ఎ-బరాత్", "Hindi": "शब-ए-बारात", "Tamil": "ஷப்-இ-பராத்", "Kannada": "ಶಬ್-ಎ-ಬರಾತ್", "Malayalam": "ശബ്-എ-ബറാത്ത്", "Marathi": "शब-ए-बारात", "Bengali": "শবে বরাত", "Gujarati": "શબ-એ-બરાત", "Punjabi": "ਸ਼ਬ-ਏ-ਬਰਾਤ", "Odia": "ଶବ-ଏ-ବରାତ", "Urdu": "شبِ برات"},
    about: {"English": "The night of forgiveness in Shaban, spent in prayer for family and those who have passed. (Date depends on the moon sighting.)", "Telugu": "షాబాన్ నెలలో క్షమాపణ రాత్రి: కుటుంబం కోసం, మరణించిన వారి కోసం ప్రార్థన. (తేదీ చంద్ర దర్శనాన్ని బట్టి మారవచ్చు.)"},
    celebrate: {"English": "Offer night prayers, visit graves of loved ones, and share sweets like halwa.", "Telugu": "రాత్రి ప్రార్థనలు చేయండి, ఆత్మీయుల సమాధులను సందర్శించండి, హల్వా వంటి తీపి పంచుకోండి."},
    wear: {"English": "Clean white or soft green clothes for prayer.", "Telugu": "ప్రార్థనకు శుభ్రమైన తెలుపు లేదా లేత ఆకుపచ్చ బట్టలు."},
    colours: [{"name": "White", "hex": "#F5F5F5"}, {"name": "Green", "hex": "#388E3C"}],
  },
  {
    id: "shivaratri", dates: ["2026-02-15", "2027-03-06"], emoji: "🔱",
    name: {"English": "Maha Shivaratri", "Telugu": "మహా శివరాత్రి", "Hindi": "महाशिवरात्रि", "Tamil": "மகா சிவராத்திரி", "Kannada": "ಮಹಾ ಶಿವರಾತ್ರಿ", "Malayalam": "മഹാശിവരാത്രി", "Marathi": "महाशिवरात्री", "Bengali": "মহাশিবরাত্রি", "Gujarati": "મહાશિવરાત્રી", "Punjabi": "ਮਹਾਂ ਸ਼ਿਵਰਾਤਰੀ", "Odia": "ମହାଶିବରାତ୍ରି", "Urdu": "مہا شِوراتری"},
    about: {"English": "The great night of Lord Shiva: a night of prayer, fasting and staying awake (jagarana).", "Telugu": "శివుని మహా రాత్రి: ప్రార్థన, ఉపవాసం, జాగరణ చేసే పవిత్ర రాత్రి."},
    celebrate: {"English": "Visit a Shiva temple, offer water, milk and bilva leaves, chant \"Om Namah Shivaya\" and keep a light fast if you can.", "Telugu": "శివాలయానికి వెళ్లి నీళ్లు, పాలు, బిల్వ పత్రాలతో అభిషేకం చేయండి, \"ఓం నమః శివాయ\" జపించండి, వీలైతే ఉపవాసం ఉండండి."},
    wear: {"English": "White or light blue: simple, pure colours that match the calm, devotional night.", "Telugu": "తెలుపు లేదా లేత నీలం: ప్రశాంతమైన భక్తి రాత్రికి తగిన స్వచ్ఛమైన రంగులు."},
    colours: [{"name": "White", "hex": "#F5F5F5"}, {"name": "Light Blue", "hex": "#81D4FA"}],
  },
  {
    id: "holi", dates: ["2026-03-03", "2027-03-22"], emoji: "🎨",
    name: {"English": "Holi", "Telugu": "హోలీ", "Hindi": "होली", "Tamil": "ஹோலி", "Kannada": "ಹೋಳಿ", "Malayalam": "ഹോളി", "Marathi": "होळी (धूलिवंदन)", "Bengali": "দোলযাত্রা (হোলি)", "Gujarati": "હોળી", "Punjabi": "ਹੋਲੀ", "Odia": "ଦୋଳ ପୂର୍ଣ୍ଣିମା (ହୋଲି)", "Urdu": "ہولی"},
    about: {"English": "The festival of colours: good over evil (Holika) and the joy of spring.", "Telugu": "రంగుల పండుగ: చెడుపై మంచి విజయం (హోలిక), వసంతానికి స్వాగతం."},
    celebrate: {"English": "Play with safe, natural colours, share sweets, forgive and hug old friends.", "Telugu": "సహజమైన, సురక్షిత రంగులతో ఆడుకోండి, స్వీట్లు పంచుకోండి, పాత గొడవలు మరచి స్నేహితులను కలవండి."},
    wear: {"English": "Old white cotton clothes: white makes every colour shine and washes easy.", "Telugu": "పాత తెల్లటి కాటన్ బట్టలు: తెలుపు మీద ప్రతి రంగు అందంగా కనిపిస్తుంది."},
    colours: [{"name": "White", "hex": "#F5F5F5"}],
  },
  {
    id: "ugadi", dates: ["2026-03-19", "2027-04-07"], emoji: "🌿",
    name: {"English": "Ugadi (Telugu New Year)", "Telugu": "ఉగాది", "Hindi": "उगादी (नव संवत्सर)", "Tamil": "உகாதி", "Kannada": "ಯುಗಾದಿ", "Malayalam": "ഉഗാദി", "Marathi": "गुढीपाडवा", "Bengali": "উগাদি (নববর্ষ)", "Gujarati": "ઉગાદી (ચૈત્રી નવરાત્રિ)", "Punjabi": "ਉਗਾਦੀ (ਨਵ ਸੰਮਤ)", "Odia": "ଉଗାଦି", "Urdu": "اُگادی"},
    about: {"English": "The Telugu New Year: the first day of Chaitra, a new beginning for the whole year.", "Telugu": "తెలుగు నూతన సంవత్సరం: చైత్ర శుద్ధ పాడ్యమి, సంవత్సరమంతటికీ కొత్త ప్రారంభం."},
    celebrate: {"English": "Mango-leaf torans, oil bath, Ugadi pachadi (six tastes for every feeling of life) and listening to the Panchanga Shravanam.", "Telugu": "మామిడి తోరణాలు, తలస్నానం, షడ్రుచుల ఉగాది పచ్చడి, పంచాంగ శ్రవణం."},
    wear: {"English": "New clothes in yellow, green or mango-leaf shades: fresh colours of a new season and new hopes.", "Telugu": "పసుపు, ఆకుపచ్చ, మామిడాకు రంగుల కొత్త బట్టలు: కొత్త ఋతువుకు, కొత్త ఆశలకు సంకేతం."},
    colours: [{"name": "Yellow", "hex": "#FBC02D"}, {"name": "Green", "hex": "#388E3C"}],
  },
  {
    id: "ramzan", dates: ["2026-03-21", "2027-03-10"], emoji: "🌙",
    name: {"English": "Ramzan (Eid-ul-Fitr)", "Telugu": "రంజాన్ (ఈదుల్ ఫితర్)", "Hindi": "ईद-उल-फ़ित्र", "Tamil": "ரம்ஜான் (ஈகைத் திருநாள்)", "Kannada": "ರಂಜಾನ್ (ಈದ್-ಉಲ್-ಫಿತ್ರ್)", "Malayalam": "ചെറിയ പെരുന്നാൾ (ഈദുൽ ഫിത്ർ)", "Marathi": "रमजान ईद", "Bengali": "ঈদুল ফিতর", "Gujarati": "રમઝાન ઈદ", "Punjabi": "ਈਦ-ਉਲ-ਫ਼ਿਤਰ", "Odia": "ରମଜାନ (ଇଦ୍-ଉଲ୍-ଫିତର)", "Urdu": "عید الفطر"},
    about: {"English": "Eid marks the end of the Ramzan month of fasting: a day of thanks, charity and togetherness. (Date depends on the moon sighting.)", "Telugu": "రంజాన్ ఉపవాస మాసం ముగింపు: కృతజ్ఞత, దానం, ఐక్యతల పండుగ. (తేదీ చంద్ర దర్శనాన్ని బట్టి మారవచ్చు.)"},
    celebrate: {"English": "Wish \"Eid Mubarak\", share sheer khurma and haleem with friends, and give to those in need.", "Telugu": "\"ఈద్ ముబారక్\" చెప్పండి, స్నేహితులతో షీర్ ఖుర్మా, హలీమ్ పంచుకోండి, అవసరమైన వారికి దానం చేయండి."},
    wear: {"English": "Clean new clothes in white, green or soft pastels: white for purity, green for peace and blessings.", "Telugu": "తెలుపు, ఆకుపచ్చ లేదా లేత రంగుల కొత్త బట్టలు: తెలుపు స్వచ్ఛతకు, ఆకుపచ్చ శాంతికి సంకేతం."},
    colours: [{"name": "White", "hex": "#F5F5F5"}, {"name": "Green", "hex": "#2E7D32"}],
  },
  {
    id: "ramanavami", dates: ["2026-03-27", "2027-04-15"], emoji: "🏹",
    name: {"English": "Sri Rama Navami", "Telugu": "శ్రీరామ నవమి", "Hindi": "राम नवमी", "Tamil": "ஸ்ரீ ராம நவமி", "Kannada": "ಶ್ರೀ ರಾಮ ನವಮಿ", "Malayalam": "ശ്രീരാമ നവമി", "Marathi": "रामनवमी", "Bengali": "রাম নবমী", "Gujarati": "રામ નવમી", "Punjabi": "ਰਾਮ ਨੌਮੀ", "Odia": "ଶ୍ରୀରାମ ନବମୀ", "Urdu": "رام نومی"},
    about: {"English": "Lord Rama's birthday and the celestial wedding (Kalyanam) of Sita and Rama, famous at Bhadrachalam.", "Telugu": "శ్రీరాముని జన్మదినం, సీతారాముల కళ్యాణం (భద్రాచలంలో ప్రసిద్ధి)."},
    celebrate: {"English": "Watch or attend the Sita Rama Kalyanam, share panakam and vadapappu, and read a little of the Ramayana.", "Telugu": "సీతారాముల కళ్యాణం చూడండి, పానకం, వడపప్పు పంచుకోండి, రామాయణం కొంచెం చదవండి."},
    wear: {"English": "Yellow (pitambara) or saffron, the colours of Lord Rama; light cotton for the summer heat.", "Telugu": "శ్రీరామునికి ప్రీతికరమైన పసుపు (పీతాంబరం) లేదా కాషాయం; ఎండకు తేలికపాటి కాటన్."},
    colours: [{"name": "Yellow", "hex": "#FBC02D"}, {"name": "Saffron", "hex": "#FF9933"}],
  },
  {
    id: "mahavir", dates: ["2026-03-31", "2027-04-19"], emoji: "🕊️",
    name: {"English": "Mahavir Jayanti", "Telugu": "మహావీర్ జయంతి", "Hindi": "महावीर जयंती", "Tamil": "மகாவீர் ஜெயந்தி", "Kannada": "ಮಹಾವೀರ ಜಯಂತಿ", "Malayalam": "മഹാവീർ ജയന്തി", "Marathi": "महावीर जयंती", "Bengali": "মহাবীর জয়ন্তী", "Gujarati": "મહાવીર જયંતી", "Punjabi": "ਮਹਾਂਵੀਰ ਜਯੰਤੀ", "Odia": "ମହାବୀର ଜୟନ୍ତୀ", "Urdu": "مہاویر جینتی"},
    about: {"English": "The birth of Lord Mahavira, who taught non-violence and truth.", "Telugu": "అహింస, సత్యం బోధించిన మహావీరుని జన్మదినం."},
    celebrate: {"English": "Visit a Jain temple, do a kind act and share food with the needy.", "Telugu": "జైన మందిరాన్ని దర్శించండి, ఒక మంచి పని చేయండి, అవసరమైన వారికి ఆహారం పంచండి."},
    wear: {"English": "White or light yellow: simple and peaceful.", "Telugu": "తెలుపు లేదా లేత పసుపు: సరళంగా, ప్రశాంతంగా."},
    colours: [{"name": "White", "hex": "#F5F5F5"}, {"name": "Yellow", "hex": "#FBC02D"}],
  },
  {
    id: "hanuman", dates: ["2026-04-02", "2026-05-12", "2027-04-20", "2027-05-31"], emoji: "🙏",
    name: {"English": "Hanuman Jayanti", "Telugu": "హనుమాన్ జయంతి", "Hindi": "हनुमान जयंती", "Tamil": "அனுமன் ஜெயந்தி", "Kannada": "ಹನುಮ ಜಯಂತಿ", "Malayalam": "ഹനുമാൻ ജയന്തി", "Marathi": "हनुमान जयंती", "Bengali": "হনুমান জয়ন্তী", "Gujarati": "હનુમાન જયંતી", "Punjabi": "ਹਨੂੰਮਾਨ ਜਯੰਤੀ", "Odia": "ହନୁମାନ ଜୟନ୍ତୀ", "Urdu": "ہنومان جینتی"},
    about: {"English": "The birth of Lord Hanuman, the symbol of strength and devotion. Much of India marks it on Chaitra Purnima; the Telugu states on Vaishakha Bahula Dashami.", "Telugu": "బలానికి, భక్తికి ప్రతీక అయిన హనుమంతుని జన్మదినం. చాలా ప్రాంతాల్లో చైత్ర పౌర్ణమి; తెలుగు రాష్ట్రాల్లో వైశాఖ బహుళ దశమి."},
    celebrate: {"English": "Visit a Hanuman temple, read the Hanuman Chalisa and offer sindoor and betel leaves.", "Telugu": "హనుమాన్ గుడికి వెళ్లి, హనుమాన్ చాలీసా చదివి, సిందూరం, తమలపాకులు సమర్పించండి."},
    wear: {"English": "Saffron or red, the colours of Hanuman.", "Telugu": "హనుమంతునికి ప్రీతికరమైన కాషాయం లేదా ఎరుపు."},
    colours: [{"name": "Saffron", "hex": "#FF9933"}, {"name": "Red", "hex": "#C62828"}],
  },
  {
    id: "goodfriday", dates: ["2026-04-03", "2027-03-26"], emoji: "✝️",
    name: {"English": "Good Friday", "Telugu": "గుడ్ ఫ్రైడే", "Hindi": "गुड फ़्राइडे", "Tamil": "புனித வெள்ளி", "Kannada": "ಶುಭ ಶುಕ್ರವಾರ (ಗುಡ್ ಫ್ರೈಡೇ)", "Malayalam": "ദുഃഖവെള്ളി", "Marathi": "गुड फ्रायडे", "Bengali": "গুড ফ্রাইডে", "Gujarati": "ગુડ ફ્રાઇડે", "Punjabi": "ਗੁੱਡ ਫ਼ਰਾਈਡੇ", "Odia": "ଗୁଡ୍ ଫ୍ରାଇଡେ", "Urdu": "گڈ فرائیڈے"},
    about: {"English": "Christians remember the crucifixion of Jesus Christ with prayer and quiet.", "Telugu": "యేసుక్రీస్తు శిలువ వేయబడిన రోజును ప్రార్థనతో, నిశ్శబ్దంగా స్మరించుకుంటారు."},
    celebrate: {"English": "Attend the church service, pray and keep the day calm and simple.", "Telugu": "చర్చి ప్రార్థనలో పాల్గొనండి, రోజును ప్రశాంతంగా గడపండి."},
    wear: {"English": "Simple white or muted purple.", "Telugu": "సరళమైన తెలుపు లేదా లేత ఊదా."},
    colours: [{"name": "White", "hex": "#F5F5F5"}, {"name": "Purple", "hex": "#7B1FA2"}],
  },
  {
    id: "easter", dates: ["2026-04-05", "2027-03-28"], emoji: "🐣",
    name: {"English": "Easter", "Telugu": "ఈస్టర్", "Hindi": "ईस्टर", "Tamil": "ஈஸ்டர்", "Kannada": "ಈಸ್ಟರ್", "Malayalam": "ഈസ്റ്റർ", "Marathi": "ईस्टर", "Bengali": "ইস্টার", "Gujarati": "ઈસ્ટર", "Punjabi": "ਈਸਟਰ", "Odia": "ଇଷ୍ଟର", "Urdu": "ایسٹر"},
    about: {"English": "The resurrection of Jesus Christ: a day of hope and new life.", "Telugu": "యేసుక్రీస్తు పునరుత్థానం: ఆశ, కొత్త జీవితానికి సంకేతం."},
    celebrate: {"English": "Attend the Easter service, share a meal and colourful eggs or sweets.", "Telugu": "ఈస్టర్ ప్రార్థనకు వెళ్లండి, కలిసి భోజనం చేయండి, రంగుల గుడ్లు లేదా స్వీట్లు పంచుకోండి."},
    wear: {"English": "Fresh white and spring pastels like pink and yellow.", "Telugu": "తెలుపు, గులాబీ, పసుపు వంటి లేత వసంత రంగులు."},
    colours: [{"name": "White", "hex": "#F5F5F5"}, {"name": "Pink", "hex": "#F48FB1"}, {"name": "Yellow", "hex": "#FBC02D"}],
  },
  {
    id: "ambedkar", dates: ["2026-04-14", "2027-04-14"], emoji: "📘",
    name: {"English": "Ambedkar Jayanti", "Telugu": "అంబేద్కర్ జయంతి", "Hindi": "आंबेडकर जयंती", "Tamil": "அம்பேத்கர் ஜெயந்தி", "Kannada": "ಅಂಬೇಡ್ಕರ್ ಜಯಂತಿ", "Malayalam": "അംബേദ്കർ ജയന്തി", "Marathi": "आंबेडकर जयंती", "Bengali": "আম্বেদকর জয়ন্তী", "Gujarati": "આંબેડકર જયંતી", "Punjabi": "ਅੰਬੇਡਕਰ ਜਯੰਤੀ", "Odia": "ଆମ୍ବେଦକର ଜୟନ୍ତୀ", "Urdu": "امبیڈکر جینتی"},
    about: {"English": "The birthday of Dr B. R. Ambedkar, architect of the Indian Constitution.", "Telugu": "భారత రాజ్యాంగ నిర్మాత డా. బి. ఆర్. అంబేద్కర్ జన్మదినం."},
    celebrate: {"English": "Pay tribute at his statue, read about equality and help someone study.", "Telugu": "ఆయన విగ్రహానికి నివాళి అర్పించండి, సమానత్వం గురించి చదవండి, ఎవరికైనా చదువులో సహాయం చేయండి."},
    wear: {"English": "Blue, the colour linked with Dr Ambedkar, with white.", "Telugu": "అంబేద్కర్‌తో ముడిపడిన నీలం, తెలుపుతో."},
    colours: [{"name": "Blue", "hex": "#1565C0"}, {"name": "White", "hex": "#F5F5F5"}],
  },
  {
    id: "akshaya", dates: ["2026-04-19", "2027-05-08"], emoji: "🪙",
    name: {"English": "Akshaya Tritiya", "Telugu": "అక్షయ తృతీయ", "Hindi": "अक्षय तृतीया", "Tamil": "அட்சய திருதியை", "Kannada": "ಅಕ್ಷಯ ತೃತೀಯ", "Malayalam": "അക്ഷയ തൃതീയ", "Marathi": "अक्षय्य तृतीया", "Bengali": "অক্ষয় তৃতীয়া", "Gujarati": "અખાત્રીજ", "Punjabi": "ਅਕਸ਼ੈ ਤ੍ਰਿਤੀਆ", "Odia": "ଅକ୍ଷୟ ତୃତୀୟା", "Urdu": "اکشے ترتیا"},
    about: {"English": "A day of never-ending (akshaya) blessings: good deeds and new starts grow.", "Telugu": "అక్షయమైన శుభాల రోజు: మంచి పనులు, కొత్త ప్రారంభాలు పెరుగుతాయి."},
    celebrate: {"English": "Start something new, donate food or water, and buy a little gold if you wish.", "Telugu": "కొత్త పని మొదలుపెట్టండి, అన్నం లేదా నీళ్లు దానం చేయండి, ఇష్టమైతే కొంచెం బంగారం కొనండి."},
    wear: {"English": "Gold and yellow for prosperity.", "Telugu": "సమృద్ధికి బంగారు, పసుపు రంగులు."},
    colours: [{"name": "Gold", "hex": "#D4A017"}, {"name": "Yellow", "hex": "#FBC02D"}],
  },
  {
    id: "buddha", dates: ["2026-05-01", "2027-05-20"], emoji: "☸️",
    name: {"English": "Buddha Purnima", "Telugu": "బుద్ధ పూర్ణిమ", "Hindi": "बुद्ध पूर्णिमा", "Tamil": "புத்த பூர்ணிமா", "Kannada": "ಬುದ್ಧ ಪೂರ್ಣಿಮೆ", "Malayalam": "ബുദ്ധ പൂർണിമ", "Marathi": "बुद्ध पौर्णिमा", "Bengali": "বুদ্ধ পূর্ণিমা", "Gujarati": "બુદ્ધ પૂર્ણિમા", "Punjabi": "ਬੁੱਧ ਪੂਰਨਿਮਾ", "Odia": "ବୁଦ୍ଧ ପୂର୍ଣ୍ଣିମା", "Urdu": "بدھ پورنیما"},
    about: {"English": "The birth, enlightenment and passing of the Buddha, on Vaishakha Purnima.", "Telugu": "వైశాఖ పౌర్ణమి: బుద్ధుని జననం, జ్ఞానోదయం, నిర్యాణం."},
    celebrate: {"English": "Meditate, visit a Buddhist site and practise kindness.", "Telugu": "ధ్యానం చేయండి, బౌద్ధ క్షేత్రాన్ని దర్శించండి, దయతో ఉండండి."},
    wear: {"English": "White, for peace and purity.", "Telugu": "శాంతికి, స్వచ్ఛతకు తెలుపు."},
    colours: [{"name": "White", "hex": "#F5F5F5"}],
  },
  {
    id: "bakrid", dates: ["2026-05-27", "2027-05-17"], emoji: "🌙",
    name: {"English": "Bakrid (Eid-ul-Adha)", "Telugu": "బక్రీద్ (ఈదుల్ అజ్హా)", "Hindi": "बकरीद (ईद-उल-अज़हा)", "Tamil": "பக்ரீத்", "Kannada": "ಬಕ್ರೀದ್", "Malayalam": "ബലിപെരുന്നാൾ", "Marathi": "बकरी ईद", "Bengali": "ঈদুল আযহা", "Gujarati": "બકરી ઈદ", "Punjabi": "ਬਕਰੀਦ (ਈਦ-ਉਲ-ਅਜ਼ਹਾ)", "Odia": "ବକ୍ରିଦ (ଇଦ୍-ଉଲ୍-ଅଜହା)", "Urdu": "عید الاضحیٰ (بقرعید)"},
    about: {"English": "The festival of sacrifice and sharing, remembering the faith of Prophet Ibrahim. (Date depends on the moon sighting.)", "Telugu": "ప్రవక్త ఇబ్రహీం విశ్వాసాన్ని గుర్తుచేసే త్యాగం, పంచుకోవడం పండుగ. (తేదీ చంద్ర దర్శనాన్ని బట్టి మారవచ్చు.)"},
    celebrate: {"English": "Greet friends with \"Eid Mubarak\", share food with neighbours and the needy, and spend time with family.", "Telugu": "\"ఈద్ ముబారక్\" చెప్పండి, ఇరుగుపొరుగుతో, అవసరమైన వారితో ఆహారం పంచుకోండి."},
    wear: {"English": "White or green traditional wear: clean and simple for prayers and gatherings.", "Telugu": "తెలుపు లేదా ఆకుపచ్చ సంప్రదాయ దుస్తులు: ప్రార్థనలకు, కలయికలకు సరళంగా."},
    colours: [{"name": "White", "hex": "#F5F5F5"}, {"name": "Green", "hex": "#2E7D32"}],
  },
  {
    id: "telanganaday", dates: ["2026-06-02", "2027-06-02"], emoji: "🏛️",
    name: {"English": "Telangana Formation Day", "Telugu": "తెలంగాణ ఆవిర్భావ దినోత్సవం", "Hindi": "तेलंगाना स्थापना दिवस", "Tamil": "தெலங்கானா உதய தினம்", "Kannada": "ತೆಲಂಗಾಣ ರಚನಾ ದಿನ", "Malayalam": "തെലങ്കാന രൂപീകരണ ദിനം", "Marathi": "तेलंगणा स्थापना दिन", "Bengali": "তেলেঙ্গানা প্রতিষ্ঠা দিবস", "Gujarati": "તેલંગાણા સ્થાપના દિવસ", "Punjabi": "ਤੇਲੰਗਾਨਾ ਸਥਾਪਨਾ ਦਿਵਸ", "Odia": "ତେଲେଙ୍ଗାନା ଗଠନ ଦିବସ", "Urdu": "یومِ تاسیسِ تلنگانہ"},
    about: {"English": "Telangana became a state on 2 June 2014.", "Telugu": "2 జూన్ 2014న తెలంగాణ రాష్ట్రం ఏర్పడింది."},
    celebrate: {"English": "Join the celebrations, enjoy Telangana food and songs.", "Telugu": "ఉత్సవాల్లో పాల్గొనండి, తెలంగాణ వంటకాలు, పాటలు ఆస్వాదించండి."},
    wear: {"English": "Pink (the state's festive colour) or white with a Pochampally touch.", "Telugu": "గులాబీ లేదా తెలుపు, పోచంపల్లి అందంతో."},
    colours: [{"name": "Pink", "hex": "#F48FB1"}, {"name": "White", "hex": "#F5F5F5"}],
  },
  {
    id: "muharram", dates: ["2026-06-26", "2027-06-16"], emoji: "🌙",
    name: {"English": "Muharram (Ashura)", "Telugu": "మొహర్రం", "Hindi": "मुहर्रम", "Tamil": "முகரம்", "Kannada": "ಮೊಹರಂ", "Malayalam": "മുഹറം", "Marathi": "मोहरम", "Bengali": "মহররম (আশুরা)", "Gujarati": "મોહરમ", "Punjabi": "ਮੁਹੱਰਮ", "Odia": "ମହରମ", "Urdu": "محرم (یومِ عاشور)"},
    about: {"English": "The 10th of Muharram (Ashura) remembers the martyrdom of Imam Hussain. (Date depends on the moon sighting.)", "Telugu": "మొహర్రం 10వ రోజు (ఆషూరా) ఇమామ్ హుస్సేన్ బలిదానాన్ని స్మరిస్తారు. (తేదీ చంద్ర దర్శనాన్ని బట్టి మారవచ్చు.)"},
    celebrate: {"English": "Join the processions respectfully, share water and food (sabeel) with all.", "Telugu": "ఊరేగింపులను గౌరవంగా చూడండి, అందరికీ నీళ్లు, ఆహారం (సబీల్) పంచండి."},
    wear: {"English": "Sober black, white or green.", "Telugu": "నలుపు, తెలుపు లేదా ఆకుపచ్చ సాదా బట్టలు."},
    colours: [{"name": "Black", "hex": "#212121"}, {"name": "White", "hex": "#F5F5F5"}, {"name": "Green", "hex": "#388E3C"}],
  },
  {
    id: "bonalu", dates: ["2026-07-19", "2026-08-10", "2027-07-11"], emoji: "🍲",
    name: {"English": "Bonalu", "Telugu": "బోనాలు", "Hindi": "बोनालु", "Tamil": "போனாலு", "Kannada": "ಬೋನಾಲು", "Malayalam": "ബോനാലു", "Marathi": "बोनालू", "Bengali": "বোনালু", "Gujarati": "બોનાલુ", "Punjabi": "ਬੋਨਾਲੂ", "Odia": "ବୋନାଲୁ", "Urdu": "بونالو"},
    about: {"English": "Telangana's Ashada festival for Goddess Mahakali: women carry bonam (cooked rice in decorated pots). Starts at Golconda; the state holiday follows Lashkar Bonalu.", "Telugu": "ఆషాఢంలో మహంకాళి అమ్మవారికి తెలంగాణ పండుగ: అలంకరించిన కుండల్లో బోనం. గోల్కొండలో మొదలవుతుంది; ప్రభుత్వ సెలవు లష్కర్ బోనాల తర్వాత."},
    celebrate: {"English": "Offer bonam at the temple, watch the Pothuraju dance and the rangam.", "Telugu": "గుడిలో బోనం సమర్పించండి, పోతురాజు నృత్యం, రంగం చూడండి."},
    wear: {"English": "Bright red, yellow or green sarees or langa voni with bangles.", "Telugu": "ఎరుపు, పసుపు, ఆకుపచ్చ చీరలు లేదా లంగా ఓణీ, గాజులతో."},
    colours: [{"name": "Red", "hex": "#C62828"}, {"name": "Yellow", "hex": "#FBC02D"}, {"name": "Green", "hex": "#388E3C"}],
  },
  {
    id: "tholiekadashi", dates: ["2026-07-25", "2027-07-14"], emoji: "🪷",
    name: {"English": "Tholi Ekadashi", "Telugu": "తొలి ఏకాదశి", "Hindi": "देवशयनी एकादशी", "Tamil": "தொலி ஏகாதசி (சயன ஏகாதசி)", "Kannada": "ಶಯನೀ ಏಕಾದಶಿ", "Malayalam": "ശയന ഏകാദശി", "Marathi": "आषाढी एकादशी", "Bengali": "শয়নী একাদশী", "Gujarati": "દેવપોઢી એકાદશી", "Punjabi": "ਦੇਵਸ਼ਯਨੀ ਏਕਾਦਸ਼ੀ", "Odia": "ଶୟନ ଏକାଦଶୀ", "Urdu": "تھولی ایکادشی"},
    about: {"English": "The first Ekadashi of the season, when Vishnu goes into yoga nidra; Chaturmasya begins.", "Telugu": "తొలి ఏకాదశి: విష్ణువు యోగనిద్రలోకి వెళ్లే రోజు; చాతుర్మాస్యం మొదలు."},
    celebrate: {"English": "Fast or eat light, visit a Vishnu temple and eat pelala pindi (sesame sweet).", "Telugu": "ఉపవాసం లేదా తేలిక భోజనం, విష్ణు ఆలయ దర్శనం, పేలాల పిండి."},
    wear: {"English": "Yellow or white for Vishnu.", "Telugu": "విష్ణువుకు పసుపు లేదా తెలుపు."},
    colours: [{"name": "Yellow", "hex": "#FBC02D"}, {"name": "White", "hex": "#F5F5F5"}],
  },
  {
    id: "gurupurnima", dates: ["2026-07-29", "2027-07-18"], emoji: "🙏",
    name: {"English": "Guru Purnima", "Telugu": "గురు పౌర్ణమి", "Hindi": "गुरु पूर्णिमा", "Tamil": "குரு பூர்ணிமா", "Kannada": "ಗುರು ಪೂರ್ಣಿಮೆ", "Malayalam": "ഗുരു പൂർണിമ", "Marathi": "गुरुपौर्णिमा", "Bengali": "গুরু পূর্ণিমা", "Gujarati": "ગુરુ પૂર્ણિમા", "Punjabi": "ਗੁਰੂ ਪੂਰਨਿਮਾ", "Odia": "ଗୁରୁ ପୂର୍ଣ୍ଣିମା", "Urdu": "گرو پورنیما"},
    about: {"English": "Vyasa Purnima: a day to thank teachers and gurus.", "Telugu": "వ్యాస పౌర్ణమి: గురువులకు కృతజ్ఞతలు తెలిపే రోజు."},
    celebrate: {"English": "Touch your teacher's feet or call them, and thank someone who taught you.", "Telugu": "గురువులకు నమస్కరించండి లేదా ఫోన్ చేయండి, మీకు నేర్పిన వారికి కృతజ్ఞతలు చెప్పండి."},
    wear: {"English": "White or yellow, simple and respectful.", "Telugu": "తెలుపు లేదా పసుపు, సరళంగా."},
    colours: [{"name": "White", "hex": "#F5F5F5"}, {"name": "Yellow", "hex": "#FBC02D"}],
  },
  {
    id: "nagpanchami", dates: ["2026-08-17", "2027-08-06"], emoji: "🐍",
    name: {"English": "Nag Panchami", "Telugu": "నాగుల పంచమి", "Hindi": "नाग पंचमी", "Tamil": "நாக பஞ்சமி", "Kannada": "ನಾಗರ ಪಂಚಮಿ", "Malayalam": "നാഗപഞ്ചമി", "Marathi": "नागपंचमी", "Bengali": "নাগ পঞ্চমী", "Gujarati": "નાગ પાંચમ", "Punjabi": "ਨਾਗ ਪੰਚਮੀ", "Odia": "ନାଗ ପଞ୍ଚମୀ", "Urdu": "ناگ پنچمی"},
    about: {"English": "Snakes (nagas) are worshipped for family well-being in Shravana.", "Telugu": "శ్రావణంలో కుటుంబ క్షేమం కోసం నాగదేవతలను పూజిస్తారు."},
    celebrate: {"English": "Offer milk at the anthill or a naga idol and pray for the family.", "Telugu": "పుట్టలో లేదా నాగ విగ్రహానికి పాలు పోసి కుటుంబం కోసం ప్రార్థించండి."},
    wear: {"English": "Yellow or green.", "Telugu": "పసుపు లేదా ఆకుపచ్చ."},
    colours: [{"name": "Yellow", "hex": "#FBC02D"}, {"name": "Green", "hex": "#388E3C"}],
  },
  {
    id: "independence", dates: ["2026-08-15", "2027-08-15"], emoji: "🇮🇳",
    name: {"English": "Independence Day", "Telugu": "స్వాతంత్ర్య దినోత్సవం", "Hindi": "स्वतंत्रता दिवस", "Tamil": "சுதந்திர தினம்", "Kannada": "ಸ್ವಾತಂತ್ರ್ಯ ದಿನ", "Malayalam": "സ്വാതന്ത്ര്യ ദിനം", "Marathi": "स्वातंत्र्य दिन", "Bengali": "স্বাধীনতা দিবস", "Gujarati": "સ્વાતંત્ર્ય દિન", "Punjabi": "ਸੁਤੰਤਰਤਾ ਦਿਵਸ", "Odia": "ସ୍ୱାଧୀନତା ଦିବସ", "Urdu": "یومِ آزادی"},
    about: {"English": "India became free on 15 August 1947.", "Telugu": "15 ఆగస్టు 1947న భారతదేశానికి స్వాతంత్ర్యం వచ్చింది."},
    celebrate: {"English": "Hoist the flag, sing the national anthem and remember the freedom fighters.", "Telugu": "జెండా ఎగరేయండి, జాతీయ గీతం పాడండి, స్వాతంత్ర్య సమరయోధులను స్మరించండి."},
    wear: {"English": "The tricolour: saffron, white and green.", "Telugu": "త్రివర్ణ రంగులు: కాషాయం, తెలుపు, ఆకుపచ్చ."},
    colours: [{"name": "Saffron", "hex": "#FF9933"}, {"name": "White", "hex": "#F5F5F5"}, {"name": "Green", "hex": "#388E3C"}],
  },
  {
    id: "varalakshmi", dates: ["2026-08-21", "2027-08-13"], emoji: "🪷",
    name: {"English": "Varalakshmi Vratam", "Telugu": "వరలక్ష్మీ వ్రతం", "Hindi": "वरलक्ष्मी व्रत", "Tamil": "வரலட்சுமி விரதம்", "Kannada": "ವರಮಹಾಲಕ್ಷ್ಮಿ ವ್ರತ", "Malayalam": "വരലക്ഷ്മി വ്രതം", "Marathi": "वरलक्ष्मी व्रत", "Bengali": "বরলক্ষ্মী ব্রত", "Gujarati": "વરલક્ષ્મી વ્રત", "Punjabi": "ਵਰਲਕਸ਼ਮੀ ਵਰਤ", "Odia": "ବରଲକ୍ଷ୍ମୀ ବ୍ରତ", "Urdu": "ورلکشمی ورت"},
    about: {"English": "A Friday in Shravana when Goddess Lakshmi, the giver of boons, is worshipped for the whole family.", "Telugu": "శ్రావణ మాసంలో శుక్రవారం, వరాలిచ్చే లక్ష్మీదేవిని కుటుంబ శ్రేయస్సు కోసం పూజించే వ్రతం."},
    celebrate: {"English": "Decorate the kalasham, do the puja, tie the sacred thread, and share tambulam with friends and neighbours.", "Telugu": "కలశం అలంకరించి పూజ చేయండి, తోరం కట్టుకోండి, ముత్తైదువలకు తాంబూలం ఇవ్వండి."},
    wear: {"English": "A silk saree in red, pink, green or yellow with gold jewellery: auspicious, prosperous colours loved by Lakshmi. Men: kurta or pancha in cream or yellow.", "Telugu": "ఎరుపు, గులాబీ, ఆకుపచ్చ లేదా పసుపు పట్టు చీర, బంగారు నగలు: లక్ష్మీదేవికి ప్రీతికరమైన శుభ రంగులు. మగవారు: క్రీమ్ లేదా పసుపు కుర్తా / పంచె."},
    colours: [{"name": "Red", "hex": "#C62828"}, {"name": "Pink", "hex": "#F48FB1"}, {"name": "Green", "hex": "#388E3C"}, {"name": "Gold", "hex": "#D4A017"}],
  },
  {
    id: "milad", dates: ["2026-08-26", "2027-08-15"], emoji: "🌙",
    name: {"English": "Milad-un-Nabi", "Telugu": "మిలాదున్ నబీ", "Hindi": "ईद-ए-मिलाद (मिलाद-उन-नबी)", "Tamil": "மீலாது நபி", "Kannada": "ಈದ್ ಮಿಲಾದ್", "Malayalam": "നബിദിനം", "Marathi": "ईद-ए-मिलाद", "Bengali": "ঈদে মিলাদুন্নবী", "Gujarati": "ઈદ-એ-મિલાદ", "Punjabi": "ਮੀਲਾਦ-ਉਨ-ਨਬੀ", "Odia": "ମିଲାଦ-ଉନ-ନବୀ", "Urdu": "عید میلاد النبی"},
    about: {"English": "The birthday of Prophet Muhammad. (Date depends on the moon sighting.)", "Telugu": "ప్రవక్త మహమ్మద్ జన్మదినం. (తేదీ చంద్ర దర్శనాన్ని బట్టి మారవచ్చు.)"},
    celebrate: {"English": "Join prayers and gatherings, decorate with lights and share food.", "Telugu": "ప్రార్థనలు, సమావేశాల్లో పాల్గొనండి, దీపాలతో అలంకరించండి, ఆహారం పంచుకోండి."},
    wear: {"English": "Green or white, clean and simple.", "Telugu": "ఆకుపచ్చ లేదా తెలుపు."},
    colours: [{"name": "Green", "hex": "#388E3C"}, {"name": "White", "hex": "#F5F5F5"}],
  },
  {
    id: "rakhi", dates: ["2026-08-28", "2027-08-17"], emoji: "🧵",
    name: {"English": "Raksha Bandhan (Rakhi Pournami)", "Telugu": "రాఖీ పౌర్ణమి", "Hindi": "रक्षाबंधन", "Tamil": "ரக்ஷா பந்தன்", "Kannada": "ರಕ್ಷಾ ಬಂಧನ", "Malayalam": "രക്ഷാബന്ധൻ", "Marathi": "रक्षाबंधन", "Bengali": "রাখি বন্ধন", "Gujarati": "રક્ષાબંધન", "Punjabi": "ਰੱਖੜੀ", "Odia": "ରକ୍ଷାବନ୍ଧନ (ଗହ୍ମା ପୂର୍ଣ୍ଣିମା)", "Urdu": "رکشا بندھن"},
    about: {"English": "A thread of love and protection between brothers and sisters, on Shravana Pournami.", "Telugu": "శ్రావణ పౌర్ణమి రోజు అన్నాచెల్లెళ్ల, అక్కాతమ్ముళ్ల ప్రేమ, రక్షణకు గుర్తుగా రాఖీ."},
    celebrate: {"English": "Tie a rakhi, share sweets and a small gift, and promise to always look out for each other.", "Telugu": "రాఖీ కట్టి, స్వీట్లు, చిన్న బహుమతి ఇచ్చిపుచ్చుకోండి, ఒకరికొకరు తోడుంటామని మాట ఇవ్వండి."},
    wear: {"English": "Bright, cheerful colours like pink, orange or yellow: festive and full of affection.", "Telugu": "గులాబీ, నారింజ, పసుపు వంటి ఉల్లాసమైన రంగులు: పండుగ కళ, ఆప్యాయత."},
    colours: [{"name": "Pink", "hex": "#F48FB1"}, {"name": "Orange", "hex": "#F57C00"}, {"name": "Yellow", "hex": "#FBC02D"}],
  },
  {
    id: "krishnashtami", dates: ["2026-09-04", "2027-08-25"], emoji: "🦚",
    name: {"English": "Sri Krishnashtami", "Telugu": "శ్రీ కృష్ణాష్టమి", "Hindi": "जन्माष्टमी", "Tamil": "கிருஷ்ண ஜெயந்தி", "Kannada": "ಕೃಷ್ಣ ಜನ್ಮಾಷ್ಟಮಿ", "Malayalam": "ശ്രീകൃഷ്ണ ജയന്തി", "Marathi": "गोकुळाष्टमी", "Bengali": "জন্মাষ্টমী", "Gujarati": "જન્માષ્ટમી", "Punjabi": "ਜਨਮ ਅਸ਼ਟਮੀ", "Odia": "ଶ୍ରୀକୃଷ୍ଣ ଜନ୍ମାଷ୍ଟମୀ", "Urdu": "جنم اشٹمی"},
    about: {"English": "Lord Krishna's birthday, celebrated with joy, songs and the Utti (dahi handi) fun.", "Telugu": "శ్రీకృష్ణుని జన్మదినం: పాటలు, ఉట్టి కొట్టడం, ఆనందంతో జరుపుకునే పండుగ."},
    celebrate: {"English": "Draw little Krishna footprints at the door, offer butter and sweets, and dress kids as Krishna and Radha.", "Telugu": "గుమ్మం నుంచి చిన్ని కృష్ణుని పాదాలు వేయండి, వెన్న, స్వీట్లు నైవేద్యం పెట్టండి, పిల్లలను కృష్ణుడు, రాధలా అలంకరించండి."},
    wear: {"English": "Yellow (Krishna's pitambara) or peacock blue and green, inspired by his peacock feather.", "Telugu": "శ్రీకృష్ణుని పీతాంబరం పసుపు లేదా నెమలి పింఛం నీలం, ఆకుపచ్చ."},
    colours: [{"name": "Yellow", "hex": "#FBC02D"}, {"name": "Peacock Blue", "hex": "#00796B"}],
  },
  {
    id: "vinayaka", dates: ["2026-09-14", "2027-09-04"], emoji: "🐘",
    name: {"English": "Vinayaka Chavithi", "Telugu": "వినాయక చవితి", "Hindi": "गणेश चतुर्थी", "Tamil": "விநாயகர் சதுர்த்தி", "Kannada": "ಗಣೇಶ ಚತುರ್ಥಿ", "Malayalam": "വിനായക ചതുർഥി", "Marathi": "गणेश चतुर्थी", "Bengali": "গণেশ চতুর্থী", "Gujarati": "ગણેશ ચતુર્થી", "Punjabi": "ਗਣੇਸ਼ ਚਤੁਰਥੀ", "Odia": "ଗଣେଶ ଚତୁର୍ଥୀ", "Urdu": "گنیش چترتھی"},
    about: {"English": "The birthday of Lord Ganesha, the remover of obstacles: every good start begins with him.", "Telugu": "విఘ్నాలను తొలగించే వినాయకుని పుట్టినరోజు: ప్రతి శుభారంభం ఆయనతోనే."},
    celebrate: {"English": "Bring home an eco-friendly clay Ganesha, offer 21 leaves (patri) and kudumulu / undrallu, and read the Vinayaka katha.", "Telugu": "మట్టి వినాయకుడిని తెచ్చి, ఏకవింశతి పత్రి, కుడుములు / ఉండ్రాళ్లు నైవేద్యం పెట్టి, వినాయక కథ చదవండి."},
    wear: {"English": "Red, orange or yellow: bright, auspicious colours that Ganesha loves.", "Telugu": "ఎరుపు, నారింజ లేదా పసుపు: వినాయకునికి ఇష్టమైన శుభ రంగులు."},
    colours: [{"name": "Red", "hex": "#D32F2F"}, {"name": "Orange", "hex": "#F57C00"}, {"name": "Yellow", "hex": "#FBC02D"}],
  },
  {
    id: "mahalaya", dates: ["2026-10-10", "2027-09-30"], emoji: "🕯️",
    name: {"English": "Mahalaya Amavasya", "Telugu": "మహాలయ అమావాస్య", "Hindi": "महालया अमावस्या (सर्वपितृ अमावस्या)", "Tamil": "மகாளய அமாவாசை", "Kannada": "ಮಹಾಲಯ ಅಮಾವಾಸ್ಯೆ", "Malayalam": "മഹാലയ അമാവാസി", "Marathi": "सर्वपित्री अमावस्या", "Bengali": "মহালয়া", "Gujarati": "સર્વપિતૃ અમાસ", "Punjabi": "ਮਹਾਲਯਾ ਅਮਾਵਸ", "Odia": "ମହାଳୟା ଅମାବାସ୍ୟା", "Urdu": "مہالیہ اماوس"},
    about: {"English": "The new moon that ends Pitru Paksha, honouring ancestors; Navaratri follows.", "Telugu": "పితృ పక్షం ముగిసే అమావాస్య: పితృదేవతలను స్మరించే రోజు; తర్వాత నవరాత్రులు."},
    celebrate: {"English": "Offer tarpanam for your ancestors and give food to the needy.", "Telugu": "పితృదేవతలకు తర్పణం ఇవ్వండి, అవసరమైన వారికి అన్నదానం చేయండి."},
    wear: {"English": "Simple white or cream.", "Telugu": "సాదా తెలుపు లేదా క్రీమ్."},
    colours: [{"name": "White", "hex": "#F5F5F5"}, {"name": "Cream", "hex": "#FFF8E1"}],
  },
  {
    id: "bathukamma", dates: ["2026-10-10", "2027-09-30"], emoji: "🌼",
    name: {"English": "Bathukamma begins (Engili Pula)", "Telugu": "బతుకమ్మ ప్రారంభం (ఎంగిలి పూల)", "Hindi": "बतुकम्मा आरंभ (एंगिली पूला)", "Tamil": "பதுகம்மா தொடக்கம்", "Kannada": "ಬತುಕಮ್ಮ ಆರಂಭ", "Malayalam": "ബതുകമ്മ ആരംഭം", "Marathi": "बतुकम्मा प्रारंभ", "Bengali": "বাতুকাম্মা শুরু", "Gujarati": "બતુકમ્મા પ્રારંભ", "Punjabi": "ਬਤੁਕੰਮਾ ਸ਼ੁਰੂ", "Odia": "ବତୁକମ୍ମା ଆରମ୍ଭ", "Urdu": "بتکما کا آغاز (اینگلی پولا)"},
    about: {"English": "Telangana's flower festival: nine days of celebrating Goddess Gauri and the gift of life with flower towers.", "Telugu": "తెలంగాణ పూల పండుగ: తొమ్మిది రోజులు పూల బతుకమ్మలతో గౌరమ్మను, జీవితాన్ని పూజించే పండుగ."},
    celebrate: {"English": "Stack tangedu, gunugu and marigold flowers into a Bathukamma, sing and dance in a circle with friends in the evening.", "Telugu": "తంగేడు, గునుగు, బంతి పూలతో బతుకమ్మను పేర్చి, సాయంత్రం స్నేహితులతో కలిసి పాటలు పాడుతూ ఆడండి."},
    wear: {"English": "Bright silk sarees or langa voni in yellow, pink and green, the same colours as the flowers.", "Telugu": "పూల రంగులైన పసుపు, గులాబీ, ఆకుపచ్చ పట్టు చీరలు లేదా లంగా ఓణీలు."},
    colours: [{"name": "Yellow", "hex": "#FBC02D"}, {"name": "Pink", "hex": "#EC407A"}, {"name": "Green", "hex": "#388E3C"}],
  },
  {
    id: "navaratri", dates: ["2026-10-11", "2027-09-30"], emoji: "🪔",
    name: {"English": "Navaratri begins", "Telugu": "దేవీ నవరాత్రులు ప్రారంభం", "Hindi": "शारदीय नवरात्रि आरंभ", "Tamil": "நவராத்திரி தொடக்கம்", "Kannada": "ನವರಾತ್ರಿ ಆರಂಭ", "Malayalam": "നവരാത്രി ആരംഭം", "Marathi": "घटस्थापना (नवरात्रारंभ)", "Bengali": "দেবীপক্ষ / নবরাত্রি শুরু", "Gujarati": "નવરાત્રિ પ્રારંભ", "Punjabi": "ਨਵਰਾਤਰੇ ਸ਼ੁਰੂ", "Odia": "ନବରାତ୍ରି ଆରମ୍ଭ", "Urdu": "نوراتری کا آغاز"},
    about: {"English": "Nine nights of Goddess Durga in her nine forms, ending in Dasara.", "Telugu": "దుర్గమ్మ తొమ్మిది రూపాల తొమ్మిది రాత్రులు, దసరాతో ముగింపు."},
    celebrate: {"English": "Set up the kalasham or bommala koluvu, do daily puja and join garba or Bathukamma.", "Telugu": "కలశ స్థాపన లేదా బొమ్మల కొలువు పెట్టి, రోజూ పూజ చేసి, గర్బా లేదా బతుకమ్మలో పాల్గొనండి."},
    wear: {"English": "A different colour each day; red, yellow and green are favourites.", "Telugu": "రోజుకో రంగు; ఎరుపు, పసుపు, ఆకుపచ్చ ముఖ్యమైనవి."},
    colours: [{"name": "Red", "hex": "#C62828"}, {"name": "Yellow", "hex": "#FBC02D"}, {"name": "Green", "hex": "#388E3C"}],
  },
  {
    id: "saddula", dates: ["2026-10-18", "2027-10-07"], emoji: "🌸",
    name: {"English": "Saddula Bathukamma", "Telugu": "సద్దుల బతుకమ్మ", "Hindi": "सद्दुला बतुकम्मा", "Tamil": "சத்துல பதுகம்மா", "Kannada": "ಸದ್ದುಲ ಬತುಕಮ್ಮ", "Malayalam": "സദ്ദുല ബതുകമ്മ", "Marathi": "सद्दुला बतुकम्मा", "Bengali": "সদ্দুলা বাতুকাম্মা", "Gujarati": "સદ્દુલા બતુકમ્મા", "Punjabi": "ਸੱਦੁਲਾ ਬਤੁਕੰਮਾ", "Odia": "ସଦ୍ଦୁଲା ବତୁକମ୍ମା", "Urdu": "سدّولا بتکما"},
    about: {"English": "The grand last day of Bathukamma, when the biggest flower towers are made and sent off in the water.", "Telugu": "బతుకమ్మ చివరి రోజు: పెద్ద బతుకమ్మలు పేర్చి నీటిలో నిమజ్జనం చేసే రోజు."},
    celebrate: {"English": "Make your biggest Bathukamma, dance with everyone, then share saddulu (five kinds of rice) after the immersion.", "Telugu": "పెద్ద బతుకమ్మ పేర్చి, అందరితో ఆడి, నిమజ్జనం తర్వాత సద్దులు (ఐదు రకాల అన్నాలు) పంచుకోండి."},
    wear: {"English": "Your best silk saree or langa voni in rich pink, yellow or green with flowers in your hair.", "Telugu": "గులాబీ, పసుపు, ఆకుపచ్చ పట్టు చీర లేదా లంగా ఓణీ, జడలో పూలు."},
    colours: [{"name": "Pink", "hex": "#EC407A"}, {"name": "Yellow", "hex": "#FBC02D"}, {"name": "Green", "hex": "#388E3C"}],
  },
  {
    id: "durgashtami", dates: ["2026-10-19", "2027-10-07"], emoji: "🔱",
    name: {"English": "Durgashtami", "Telugu": "దుర్గాష్టమి", "Hindi": "दुर्गाष्टमी (महाअष्टमी)", "Tamil": "துர்காஷ்டமி", "Kannada": "ದುರ್ಗಾಷ್ಟಮಿ", "Malayalam": "ദുർഗാഷ്ടമി", "Marathi": "दुर्गाष्टमी", "Bengali": "মহাষ্টমী (দুর্গাষ্টমী)", "Gujarati": "દુર્ગાષ્ટમી", "Punjabi": "ਦੁਰਗਾ ਅਸ਼ਟਮੀ", "Odia": "ଦୁର୍ଗାଷ୍ଟମୀ (ମହାଷ୍ଟମୀ)", "Urdu": "درگا اشٹمی"},
    about: {"English": "The eighth day of Navaratri, the most powerful day of Goddess Durga.", "Telugu": "నవరాత్రుల ఎనిమిదో రోజు: దుర్గమ్మకు అత్యంత శక్తివంతమైన రోజు."},
    celebrate: {"English": "Do Durga puja, kumari puja and offer sweets; visit the pandal.", "Telugu": "దుర్గా పూజ, కుమారీ పూజ చేయండి, మిఠాయిలు నివేదించండి."},
    wear: {"English": "Red or maroon, the colours of Shakti.", "Telugu": "శక్తికి సంకేతమైన ఎరుపు లేదా మెరూన్."},
    colours: [{"name": "Red", "hex": "#C62828"}, {"name": "Maroon", "hex": "#800000"}],
  },
  {
    id: "dasara", dates: ["2026-10-20", "2027-10-09"], emoji: "🏹",
    name: {"English": "Dasara (Vijayadashami)", "Telugu": "దసరా (విజయదశమి)", "Hindi": "दशहरा (विजयादशमी)", "Tamil": "விஜயதசமி", "Kannada": "ದಸರಾ (ವಿಜಯದಶಮಿ)", "Malayalam": "വിജയദശമി", "Marathi": "दसरा (विजयादशमी)", "Bengali": "বিজয়া দশমী", "Gujarati": "દશેરા (વિજયાદશમી)", "Punjabi": "ਦੁਸਹਿਰਾ", "Odia": "ଦଶହରା (ବିଜୟାଦଶମୀ)", "Urdu": "دسہرہ (وجے دشمی)"},
    about: {"English": "The victory of good over evil: Goddess Durga over Mahishasura and Rama over Ravana. A great day to start anything new.", "Telugu": "చెడుపై మంచి విజయం: మహిషాసురునిపై దుర్గమ్మ, రావణునిపై శ్రీరాముని విజయం. ఏ కొత్త పనైనా మొదలుపెట్టడానికి మంచి రోజు."},
    celebrate: {"English": "Do Ayudha puja for your tools and books, exchange jammi leaves (shami) for gold-like luck, and see the Alai Balai with friends.", "Telugu": "పనిముట్లకు, పుస్తకాలకు ఆయుధ పూజ చేయండి, జమ్మి ఆకు (బంగారం) ఇచ్చిపుచ్చుకోండి, అలయ్ బలయ్‌లో స్నేహితులను కలవండి."},
    wear: {"English": "Red, maroon or gold traditional wear: the colours of Goddess Durga's power and victory.", "Telugu": "ఎరుపు, మెరూన్ లేదా బంగారు సంప్రదాయ దుస్తులు: దుర్గమ్మ శక్తికి, విజయానికి సంకేతాలు."},
    colours: [{"name": "Red", "hex": "#C62828"}, {"name": "Maroon", "hex": "#800000"}, {"name": "Gold", "hex": "#D4A017"}],
  },
  {
    id: "gandhi", dates: ["2026-10-02", "2027-10-02"], emoji: "🕊️",
    name: {"English": "Gandhi Jayanti", "Telugu": "గాంధీ జయంతి", "Hindi": "गांधी जयंती", "Tamil": "காந்தி ஜெயந்தி", "Kannada": "ಗಾಂಧಿ ಜಯಂತಿ", "Malayalam": "ഗാന്ധി ജയന്തി", "Marathi": "गांधी जयंती", "Bengali": "গান্ধী জয়ন্তী", "Gujarati": "ગાંધી જયંતી", "Punjabi": "ਗਾਂਧੀ ਜਯੰਤੀ", "Odia": "ଗାନ୍ଧୀ ଜୟନ୍ତୀ", "Urdu": "گاندھی جینتی"},
    about: {"English": "The birthday of Mahatma Gandhi, apostle of truth and non-violence.", "Telugu": "సత్యం, అహింసల మహాత్మా గాంధీ జన్మదినం."},
    celebrate: {"English": "Clean your street, spin or wear khadi, and practise kindness.", "Telugu": "వీధిని శుభ్రం చేయండి, ఖాదీ ధరించండి, దయతో ఉండండి."},
    wear: {"English": "White khadi.", "Telugu": "తెలుపు ఖాదీ."},
    colours: [{"name": "White", "hex": "#F5F5F5"}],
  },
  {
    id: "atlataddi", dates: ["2026-10-28", "2027-10-17"], emoji: "🌕",
    name: {"English": "Atla Taddi", "Telugu": "అట్ల తద్ది", "Hindi": "अटला तद्दी", "Tamil": "அட்ல தத்தி", "Kannada": "ಅಟ್ಲ ತದ್ದಿ", "Malayalam": "അട്ല തദ്ദി", "Marathi": "अटला तद्दी", "Bengali": "অটলা তদ্দি", "Gujarati": "અટલા તદ્દી", "Punjabi": "ਅਟਲਾ ਤੱਦੀ", "Odia": "ଅଟ୍ଲା ତଦ୍ଦି", "Urdu": "اٹلا تدّی"},
    about: {"English": "Telugu women's festival on Ashwayuja Bahula Tadiya, praying for a happy married life.", "Telugu": "ఆశ్వయుజ బహుళ తదియ: సౌభాగ్యం కోసం తెలుగు మహిళల పండుగ."},
    celebrate: {"English": "Wake before dawn, eat gongura and curd rice, fast till moonrise, swing on uyyala and share attlu (dosas).", "Telugu": "తెల్లవారుజామునే గోంగూర, పెరుగన్నం తిని, చంద్రోదయం వరకు ఉపవాసం, ఉయ్యాల ఊగి, అట్లు వాయనం ఇవ్వండి."},
    wear: {"English": "Bright red, yellow or pink sarees with mehendi and bangles.", "Telugu": "ఎరుపు, పసుపు, గులాబీ చీరలు, గోరింటాకు, గాజులతో."},
    colours: [{"name": "Red", "hex": "#C62828"}, {"name": "Yellow", "hex": "#FBC02D"}, {"name": "Pink", "hex": "#F48FB1"}],
  },
  {
    id: "karvachauth", dates: ["2026-10-29", "2027-10-18"], emoji: "🌙",
    name: {"English": "Karva Chauth", "Telugu": "కర్వా చౌత్", "Hindi": "करवा चौथ", "Tamil": "கர்வா சௌத்", "Kannada": "ಕರ್ವಾ ಚೌತ್", "Malayalam": "കർവ ചൗത്ത്", "Marathi": "करवा चौथ", "Bengali": "করবা চৌথ", "Gujarati": "કરવા ચોથ", "Punjabi": "ਕਰਵਾ ਚੌਥ", "Odia": "କରଵା ଚୌଥ", "Urdu": "کروا چوتھ"},
    about: {"English": "Married women fast from sunrise to moonrise for their husband's long life.", "Telugu": "భర్త ఆయుష్షు కోసం వివాహిత స్త్రీలు సూర్యోదయం నుంచి చంద్రోదయం వరకు ఉపవాసం."},
    celebrate: {"English": "Fast, do the evening katha and break the fast after seeing the moon through a sieve.", "Telugu": "ఉపవాసం చేసి, సాయంత్రం కథ విని, జల్లెడ ద్వారా చంద్రుని చూసి ఉపవాసం విరమించండి."},
    wear: {"English": "Red or maroon bridal colours with gold jewellery.", "Telugu": "బంగారు నగలతో ఎరుపు లేదా మెరూన్."},
    colours: [{"name": "Red", "hex": "#C62828"}, {"name": "Maroon", "hex": "#800000"}, {"name": "Gold", "hex": "#D4A017"}],
  },
  {
    id: "dhanteras", dates: ["2026-11-06", "2027-10-27"], emoji: "🪙",
    name: {"English": "Dhanteras (Dhana Trayodashi)", "Telugu": "ధన త్రయోదశి", "Hindi": "धनतेरस", "Tamil": "தன திரயோதசி", "Kannada": "ಧನ ತ್ರಯೋದಶಿ", "Malayalam": "ധന ത്രയോദശി", "Marathi": "धनत्रयोदशी", "Bengali": "ধনতেরাস", "Gujarati": "ધનતેરસ", "Punjabi": "ਧਨਤੇਰਸ", "Odia": "ଧନତ୍ରୟୋଦଶୀ", "Urdu": "دھن تیرس"},
    about: {"English": "The first day of Deepavali, for Lord Dhanvantari and Goddess Lakshmi.", "Telugu": "దీపావళి మొదటి రోజు: ధన్వంతరి, లక్ష్మీదేవి పూజ."},
    celebrate: {"English": "Clean the house, light a lamp for Yama at the door and buy a small metal item.", "Telugu": "ఇల్లు శుభ్రం చేసి, గుమ్మం దగ్గర యమదీపం పెట్టి, చిన్న లోహపు వస్తువు కొనండి."},
    wear: {"English": "Gold or yellow for prosperity.", "Telugu": "సమృద్ధికి బంగారు లేదా పసుపు."},
    colours: [{"name": "Gold", "hex": "#D4A017"}, {"name": "Yellow", "hex": "#FBC02D"}],
  },
  {
    id: "narakachaturdashi", dates: ["2026-11-08", "2027-10-28"], emoji: "🪔",
    name: {"English": "Naraka Chaturdashi", "Telugu": "నరక చతుర్దశి", "Hindi": "नरक चतुर्दशी (छोटी दिवाली)", "Tamil": "நரக சதுர்த்தசி", "Kannada": "ನರಕ ಚತುರ್ದಶಿ", "Malayalam": "നരക ചതുർദശി", "Marathi": "नरक चतुर्दशी", "Bengali": "নরক চতুর্দশী (ভূত চতুর্দশী)", "Gujarati": "કાળી ચૌદસ", "Punjabi": "ਨਰਕ ਚਤੁਰਦਸ਼ੀ", "Odia": "ନର୍କ ଚତୁର୍ଦ୍ଦଶୀ", "Urdu": "نرک چتردشی"},
    about: {"English": "Lord Krishna and Satyabhama defeat Narakasura; the oil bath before dawn.", "Telugu": "శ్రీకృష్ణుడు, సత్యభామ నరకాసురుని వధించిన రోజు; తెల్లవారుజామున అభ్యంగన స్నానం."},
    celebrate: {"English": "Take an oil bath before sunrise, light lamps and burst safe crackers.", "Telugu": "సూర్యోదయానికి ముందే నూనె స్నానం చేసి, దీపాలు వెలిగించి, సురక్షితంగా టపాసులు కాల్చండి."},
    wear: {"English": "Bright orange or gold.", "Telugu": "నారింజ లేదా బంగారు రంగు."},
    colours: [{"name": "Orange", "hex": "#F57C00"}, {"name": "Gold", "hex": "#D4A017"}],
  },
  {
    id: "deepavali", dates: ["2026-11-08", "2027-10-29"], emoji: "🪔",
    name: {"English": "Deepavali", "Telugu": "దీపావళి", "Hindi": "दीपावली", "Tamil": "தீபாவளி", "Kannada": "ದೀಪಾವಳಿ", "Malayalam": "ദീപാവലി", "Marathi": "दिवाळी", "Bengali": "দীপাবলি (কালীপূজা)", "Gujarati": "દિવાળી", "Punjabi": "ਦੀਵਾਲੀ", "Odia": "ଦୀପାବଳି", "Urdu": "دیوالی"},
    about: {"English": "The festival of lights: Narakasura is defeated and Goddess Lakshmi is welcomed home.", "Telugu": "దీపాల పండుగ: నరకాసుర వధ, లక్ష్మీదేవికి ఇంటికి స్వాగతం."},
    celebrate: {"English": "Light diyas at every door, do Lakshmi puja in the evening, share sweets, and enjoy safe, green crackers.", "Telugu": "ప్రతి గుమ్మం దగ్గర దీపాలు వెలిగించండి, సాయంత్రం లక్ష్మీ పూజ చేయండి, స్వీట్లు పంచుకోండి, సురక్షితంగా టపాసులు కాల్చండి."},
    wear: {"English": "New clothes in gold, red, yellow or deep pink: the shining colours of lamps and prosperity. Avoid loose dupattas near diyas.", "Telugu": "బంగారు, ఎరుపు, పసుపు, ముదురు గులాబీ రంగుల కొత్త బట్టలు: దీపాల, సమృద్ధి రంగులు. దీపాల దగ్గర వదులు దుపట్టాలు జాగ్రత్త."},
    colours: [{"name": "Gold", "hex": "#D4A017"}, {"name": "Red", "hex": "#C62828"}, {"name": "Yellow", "hex": "#FBC02D"}],
  },
  {
    id: "balipadyami", dates: ["2026-11-10", "2027-10-30"], emoji: "🐄",
    name: {"English": "Bali Padyami (Govardhan Puja)", "Telugu": "బలి పాడ్యమి", "Hindi": "गोवर्धन पूजा", "Tamil": "பலி பிரதமை", "Kannada": "ಬಲಿ ಪಾಡ್ಯಮಿ", "Malayalam": "ബലി പ്രതിപദ", "Marathi": "बलिप्रतिपदा (पाडवा)", "Bengali": "গোবর্ধন পূজা", "Gujarati": "બેસતું વર્ષ (ગોવર્ધન પૂજા)", "Punjabi": "ਗੋਵਰਧਨ ਪੂਜਾ", "Odia": "ଗୋବର୍ଦ୍ଧନ ପୂଜା", "Urdu": "بلی پاڈیامی (گووردھن پوجا)"},
    about: {"English": "King Bali's day and Govardhan Puja, the day after Deepavali.", "Telugu": "దీపావళి మరుసటి రోజు: బలి చక్రవర్తి రోజు, గోవర్ధన పూజ."},
    celebrate: {"English": "Make a Govardhan of cow dung or food, do Bali puja and share annakut.", "Telugu": "గోవర్ధనం చేసి, బలి పూజ చేసి, అన్నకూటం పంచుకోండి."},
    wear: {"English": "Yellow or orange, warm and festive.", "Telugu": "పసుపు లేదా నారింజ."},
    colours: [{"name": "Yellow", "hex": "#FBC02D"}, {"name": "Orange", "hex": "#F57C00"}],
  },
  {
    id: "bhaidooj", dates: ["2026-11-11", "2027-10-31"], emoji: "🧡",
    name: {"English": "Bhai Dooj (Yama Dwitiya)", "Telugu": "భగినీ హస్త భోజనం (యమ ద్వితీయ)", "Hindi": "भाई दूज", "Tamil": "யம துவிதியை", "Kannada": "ಭಾಯಿ ದೂಜ್ (ಯಮ ದ್ವಿತೀಯಾ)", "Malayalam": "ഭായ് ദൂജ്", "Marathi": "भाऊबीज", "Bengali": "ভাইফোঁটা", "Gujarati": "ભાઈબીજ", "Punjabi": "ਭਾਈ ਦੂਜ", "Odia": "ଭାଇ ଦ୍ୱିତୀୟା", "Urdu": "بھائی دوج"},
    about: {"English": "Sisters pray for their brothers; brothers visit and eat at the sister's home (Bhagini Hasta Bhojanam).", "Telugu": "అక్కాచెల్లెళ్లు సోదరుల కోసం ప్రార్థిస్తారు; సోదరులు వారి ఇంట భోజనం చేస్తారు (భగినీ హస్త భోజనం)."},
    celebrate: {"English": "Visit your sister, eat a meal she serves and give her a gift.", "Telugu": "మీ సోదరి ఇంటికి వెళ్లి ఆమె వడ్డించిన భోజనం చేసి బహుమతి ఇవ్వండి."},
    wear: {"English": "Pink or orange, cheerful and warm.", "Telugu": "గులాబీ లేదా నారింజ."},
    colours: [{"name": "Pink", "hex": "#F48FB1"}, {"name": "Orange", "hex": "#F57C00"}],
  },
  {
    id: "nagulachavithi", dates: ["2026-11-13", "2027-11-02"], emoji: "🐍",
    name: {"English": "Nagula Chavithi", "Telugu": "నాగుల చవితి", "Hindi": "नागुला चविथि (नाग चतुर्थी)", "Tamil": "நாக சதுர்த்தி", "Kannada": "ನಾಗುಲ ಚವಿತಿ", "Malayalam": "നാഗ ചതുർഥി", "Marathi": "नाग चतुर्थी", "Bengali": "নাগ চতুর্থী", "Gujarati": "નાગ ચતુર્થી", "Punjabi": "ਨਾਗ ਚਤੁਰਥੀ", "Odia": "ନାଗ ଚତୁର୍ଥୀ (ନାଗୁଲ ଚବିତି)", "Urdu": "ناگولا چویتھی"},
    about: {"English": "Karthika Shukla Chavithi, when the naga devatas are worshipped for the family.", "Telugu": "కార్తీక శుద్ధ చవితి: కుటుంబం కోసం నాగదేవతల పూజ."},
    celebrate: {"English": "Pour milk at the anthill (putta), offer chalimidi and pray for the children.", "Telugu": "పుట్టలో పాలు పోసి, చలిమిడి నివేదించి, పిల్లల కోసం ప్రార్థించండి."},
    wear: {"English": "Yellow or white.", "Telugu": "పసుపు లేదా తెలుపు."},
    colours: [{"name": "Yellow", "hex": "#FBC02D"}, {"name": "White", "hex": "#F5F5F5"}],
  },
  {
    id: "childrensday", dates: ["2026-11-14", "2027-11-14"], emoji: "🎈",
    name: {"English": "Children's Day", "Telugu": "బాలల దినోత్సవం", "Hindi": "बाल दिवस", "Tamil": "குழந்தைகள் தினம்", "Kannada": "ಮಕ್ಕಳ ದಿನಾಚರಣೆ", "Malayalam": "ശിശുദിനം", "Marathi": "बालदिन", "Bengali": "শিশু দিবস", "Gujarati": "બાળ દિન", "Punjabi": "ਬਾਲ ਦਿਵਸ", "Odia": "ଶିଶୁ ଦିବସ", "Urdu": "یومِ اطفال"},
    about: {"English": "Pandit Nehru's birthday, celebrated for children.", "Telugu": "పండిట్ నెహ్రూ జన్మదినం, పిల్లల పండుగ."},
    celebrate: {"English": "Spend time with children, play a game and gift a book.", "Telugu": "పిల్లలతో సమయం గడపండి, ఆట ఆడండి, ఒక పుస్తకం బహుమతిగా ఇవ్వండి."},
    wear: {"English": "Bright, playful colours like yellow and light blue.", "Telugu": "పసుపు, లేత నీలం వంటి ఉల్లాస రంగులు."},
    colours: [{"name": "Yellow", "hex": "#FBC02D"}, {"name": "Light Blue", "hex": "#81D4FA"}],
  },
  {
    id: "karthikasomavaram", dates: ["2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07", "2027-11-01", "2027-11-08", "2027-11-15", "2027-11-22"], emoji: "🔱",
    name: {"English": "Karthika Somavaram", "Telugu": "కార్తీక సోమవారం", "Hindi": "कार्तिक सोमवार", "Tamil": "கார்த்திகை சோமவாரம்", "Kannada": "ಕಾರ್ತಿಕ ಸೋಮವಾರ", "Malayalam": "കാർത്തിക സോമവാരം", "Marathi": "कार्तिक सोमवार", "Bengali": "কার্তিক সোমবার", "Gujarati": "કાર્તિક સોમવાર", "Punjabi": "ਕੱਤਕ ਸੋਮਵਾਰ", "Odia": "କାର୍ତ୍ତିକ ସୋମବାର", "Urdu": "کارتک سوموار"},
    about: {"English": "Mondays in Karthika month are sacred to Lord Shiva.", "Telugu": "కార్తీక మాసంలో సోమవారాలు శివునికి ప్రీతికరం."},
    celebrate: {"English": "Fast till evening, do abhishekam at a Shiva temple and light a lamp at dusk.", "Telugu": "సాయంత్రం వరకు ఉపవాసం, శివాలయంలో అభిషేకం, సంధ్యాసమయంలో దీపం."},
    wear: {"English": "White or silver tones, calm and devotional.", "Telugu": "ప్రశాంతమైన తెలుపు లేదా వెండి రంగులు."},
    colours: [{"name": "White", "hex": "#F5F5F5"}, {"name": "Silver", "hex": "#B0BEC5"}],
  },
  {
    id: "karthika", dates: ["2026-11-24", "2027-11-14"], emoji: "🪔",
    name: {"English": "Karthika Pournami", "Telugu": "కార్తీక పౌర్ణమి", "Hindi": "कार्तिक पूर्णिमा (देव दीपावली)", "Tamil": "கார்த்திகை தீபம் (பௌர்ணமி)", "Kannada": "ಕಾರ್ತಿಕ ಪೂರ್ಣಿಮೆ", "Malayalam": "കാർത്തിക പൗർണമി", "Marathi": "त्रिपुरारी पौर्णिमा", "Bengali": "কার্তিক পূর্ণিমা (রাস পূর্ণিমা)", "Gujarati": "કાર્તિકી પૂનમ", "Punjabi": "ਕੱਤਕ ਪੂਰਨਮਾਸ਼ੀ", "Odia": "କାର୍ତ୍ତିକ ପୂର୍ଣ୍ଣିମା (ବୋଇତ ବନ୍ଦାଣ)", "Urdu": "کارتک پورنیما"},
    about: {"English": "The holiest full moon of Karthika month, dear to both Shiva and Vishnu.", "Telugu": "కార్తీక మాసంలో అత్యంత పవిత్రమైన పౌర్ణమి, శివకేశవులకు ప్రీతికరం."},
    celebrate: {"English": "Light 365 wicks (deepalu) at a temple or at home, float a lamp on water, and enjoy a vanabhojanam with family.", "Telugu": "గుడిలో లేదా ఇంట్లో 365 వత్తుల దీపం వెలిగించండి, నీటిలో దీపం వదలండి, కుటుంబంతో వనభోజనం చేయండి."},
    wear: {"English": "White, cream or silver tones that glow like the full moon, with a touch of gold.", "Telugu": "పౌర్ణమి చంద్రునిలా మెరిసే తెలుపు, క్రీమ్, వెండి రంగులు, కొంచెం బంగారు అంచుతో."},
    colours: [{"name": "White", "hex": "#F5F5F5"}, {"name": "Cream", "hex": "#FFF8E1"}, {"name": "Silver", "hex": "#B0BEC5"}],
  },
  {
    id: "gurunanak", dates: ["2026-11-24", "2027-11-14"], emoji: "🪯",
    name: {"English": "Guru Nanak Jayanti", "Telugu": "గురు నానక్ జయంతి", "Hindi": "गुरु नानक जयंती (गुरुपर्व)", "Tamil": "குரு நானக் ஜெயந்தி", "Kannada": "ಗುರು ನಾನಕ್ ಜಯಂತಿ", "Malayalam": "ഗുരു നാനാക്ക് ജയന്തി", "Marathi": "गुरु नानक जयंती", "Bengali": "গুরু নানক জয়ন্তী", "Gujarati": "ગુરુ નાનક જયંતી", "Punjabi": "ਗੁਰਪੁਰਬ (ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ ਦਾ ਪ੍ਰਕਾਸ਼ ਪੁਰਬ)", "Odia": "ଗୁରୁ ନାନକ ଜୟନ୍ତୀ", "Urdu": "گرو نانک جینتی"},
    about: {"English": "The birth of Guru Nanak Dev Ji, the first Sikh Guru (Gurpurab).", "Telugu": "మొదటి సిక్కు గురువు గురు నానక్ దేవ్ జీ జన్మదినం (గురుపురబ్)."},
    celebrate: {"English": "Visit a gurudwara, join the kirtan and serve or eat at the langar.", "Telugu": "గురుద్వారాకు వెళ్లి, కీర్తనలో పాల్గొని, లంగర్‌లో సేవ చేయండి."},
    wear: {"English": "Saffron, white or blue; cover your head at the gurudwara.", "Telugu": "కాషాయం, తెలుపు లేదా నీలం; గురుద్వారాలో తల కప్పుకోండి."},
    colours: [{"name": "Saffron", "hex": "#FF9933"}, {"name": "White", "hex": "#F5F5F5"}, {"name": "Blue", "hex": "#1565C0"}],
  },
  {
    id: "subrahmanya", dates: ["2026-12-15", "2027-12-04"], emoji: "🦚",
    name: {"English": "Subrahmanya Shashti", "Telugu": "సుబ్రహ్మణ్య షష్ఠి", "Hindi": "स्कंद षष्ठी (सुब्रह्मण्य षष्ठी)", "Tamil": "சுப்பிரமணிய சஷ்டி", "Kannada": "ಸುಬ್ರಹ್ಮಣ್ಯ ಷಷ್ಠಿ", "Malayalam": "സുബ്രഹ്മണ്യ ഷഷ്ഠി", "Marathi": "चंपाषष्ठी", "Bengali": "সুব্রহ্মণ্য ষষ্ঠী", "Gujarati": "સુબ્રહ્મણ્ય ષષ્ઠી", "Punjabi": "ਸੁਬਰਾਮਣੀਆ ਸ਼ਸ਼ਠੀ", "Odia": "ସୁବ୍ରହ୍ମଣ୍ୟ ଷଷ୍ଠୀ", "Urdu": "سبرامنیہ ششٹھی"},
    about: {"English": "Margashira Shukla Shashti, the day of Lord Subrahmanya (Kartikeya).", "Telugu": "మార్గశిర శుద్ధ షష్ఠి: సుబ్రహ్మణ్య స్వామి రోజు."},
    celebrate: {"English": "Visit a Subrahmanya temple, offer milk at the anthill and pray for children.", "Telugu": "సుబ్రహ్మణ్య ఆలయాన్ని దర్శించండి, పుట్టలో పాలు పోసి, సంతానం కోసం ప్రార్థించండి."},
    wear: {"English": "Red or yellow.", "Telugu": "ఎరుపు లేదా పసుపు."},
    colours: [{"name": "Red", "hex": "#C62828"}, {"name": "Yellow", "hex": "#FBC02D"}],
  },
  {
    id: "vaikunta", dates: ["2026-12-20"], emoji: "🪷",
    name: {"English": "Vaikunta Ekadashi (Mukkoti)", "Telugu": "వైకుంఠ ఏకాదశి (ముక్కోటి)", "Hindi": "वैकुंठ एकादशी (मोक्षदा)", "Tamil": "வைகுண்ட ஏகாதசி", "Kannada": "ವೈಕುಂಠ ಏಕಾದಶಿ", "Malayalam": "വൈകുണ്ഠ ഏകാദശി", "Marathi": "वैकुंठ एकादशी", "Bengali": "বৈকুণ্ঠ একাদশী", "Gujarati": "વૈકુંઠ એકાદશી", "Punjabi": "ਵੈਕੁੰਠ ਏਕਾਦਸ਼ੀ", "Odia": "ବୈକୁଣ୍ଠ ଏକାଦଶୀ", "Urdu": "ویکنٹھ ایکادشی"},
    about: {"English": "The gates of Vaikuntha open: the holiest Ekadashi for Lord Vishnu (Mukkoti). In 2027 it falls in early January 2028.", "Telugu": "వైకుంఠ ద్వారాలు తెరుచుకునే రోజు: విష్ణువుకు అత్యంత పవిత్రమైన ముక్కోటి ఏకాదశి. 2027లో ఇది జనవరి 2028లో వస్తుంది."},
    celebrate: {"English": "Fast, do the Uttara dwara darshanam at a Vishnu temple and stay awake in prayer.", "Telugu": "ఉపవాసం ఉండి, విష్ణు ఆలయంలో ఉత్తర ద్వార దర్శనం చేసి, జాగరణ చేయండి."},
    wear: {"English": "Yellow (pitambara) or white.", "Telugu": "పీతాంబర పసుపు లేదా తెలుపు."},
    colours: [{"name": "Yellow", "hex": "#FBC02D"}, {"name": "White", "hex": "#F5F5F5"}],
  },
  {
    id: "dattatreya", dates: ["2026-12-23", "2027-12-13"], emoji: "🙏",
    name: {"English": "Dattatreya Jayanti", "Telugu": "దత్తాత్రేయ జయంతి", "Hindi": "दत्तात्रेय जयंती", "Tamil": "தத்தாத்ரேய ஜெயந்தி", "Kannada": "ದತ್ತ ಜಯಂತಿ", "Malayalam": "ദത്താത്രേയ ജയന്തി", "Marathi": "दत्त जयंती", "Bengali": "দত্তাত্রেয় জয়ন্তী", "Gujarati": "દત્ત જયંતી", "Punjabi": "ਦੱਤਾਤ੍ਰੇਯ ਜਯੰਤੀ", "Odia": "ଦତ୍ତାତ୍ରେୟ ଜୟନ୍ତୀ", "Urdu": "دتاتریہ جینتی"},
    about: {"English": "Margashira Purnima, the birth of Lord Dattatreya, the guru of gurus.", "Telugu": "మార్గశిర పౌర్ణమి: గురువులకు గురువైన దత్తాత్రేయుని జన్మదినం."},
    celebrate: {"English": "Visit a Datta temple, read the Guru Charitra and feed the needy.", "Telugu": "దత్త ఆలయాన్ని దర్శించండి, గురుచరిత్ర చదవండి, అన్నదానం చేయండి."},
    wear: {"English": "Saffron or yellow.", "Telugu": "కాషాయం లేదా పసుపు."},
    colours: [{"name": "Saffron", "hex": "#FF9933"}, {"name": "Yellow", "hex": "#FBC02D"}],
  },
  {
    id: "christmas", dates: ["2026-12-25", "2027-12-25"], emoji: "🎄",
    name: {"English": "Christmas", "Telugu": "క్రిస్మస్", "Hindi": "क्रिसमस", "Tamil": "கிறிஸ்துமஸ்", "Kannada": "ಕ್ರಿಸ್ಮಸ್", "Malayalam": "ക്രിസ്മസ്", "Marathi": "नाताळ", "Bengali": "বড়দিন", "Gujarati": "નાતાલ", "Punjabi": "ਕ੍ਰਿਸਮਸ", "Odia": "ଖ୍ରୀଷ୍ଟମାସ (ବଡ଼ଦିନ)", "Urdu": "کرسمس"},
    about: {"English": "The birth of Jesus Christ: a festival of love, giving and peace.", "Telugu": "యేసుక్రీస్తు జన్మదినం: ప్రేమ, దానం, శాంతిల పండుగ."},
    celebrate: {"English": "Decorate a star or tree, sing carols, share cake, and give a small gift to someone who needs it.", "Telugu": "నక్షత్రం లేదా క్రిస్మస్ చెట్టు అలంకరించండి, కరోల్స్ పాడండి, కేక్ పంచుకోండి, అవసరమైన వారికి చిన్న బహుమతి ఇవ్వండి."},
    wear: {"English": "Red, green or white: the classic Christmas colours of joy, life and peace.", "Telugu": "ఎరుపు, ఆకుపచ్చ, తెలుపు: ఆనందం, జీవం, శాంతిని సూచించే క్రిస్మస్ రంగులు."},
    colours: [{"name": "Red", "hex": "#C62828"}, {"name": "Green", "hex": "#2E7D32"}, {"name": "White", "hex": "#F5F5F5"}],
  },
];

export interface FestivalHit {
  festival: Festival;
  date: string;
  inDays: number; // 0 = today
}

// Today's festivals, and the next ones within `withinDays` (sorted, nearest first)
export const festivalsAround = (d: Date = new Date(), withinDays = 7): { today: FestivalHit[]; upcoming: FestivalHit[]; next: FestivalHit | null } => {
  const key = istDay(d).key;
  const all: FestivalHit[] = [];
  FESTIVALS.forEach(f => f.dates.forEach(date => all.push({ festival: f, date, inDays: daysBetween(key, date) })));
  const future = all.filter(h => h.inDays >= 0).sort((a, b) => a.inDays - b.inDays);
  return {
    today: future.filter(h => h.inDays === 0),
    upcoming: future.filter(h => h.inDays > 0 && h.inDays <= withinDays),
    next: future.find(h => h.inDays > 0) || null,
  };
};

const tx = (r: ByLang, lang: AstroLang): string => r[lang] || r.English;

// Short "colours to wear" line for languages without a written wear text (built from the
// festival's colours, so every festival has its dress plan in all 12 languages).
const WEAR_LEAD: Record<AstroLang, string> = {
  English: 'Colours to wear', Telugu: 'ధరించవలసిన రంగులు', Hindi: 'पहनने के रंग', Tamil: 'அணிய வேண்டிய நிறங்கள்',
  Kannada: 'ಧರಿಸಬೇಕಾದ ಬಣ್ಣಗಳು', Malayalam: 'ധരിക്കേണ്ട നിറങ്ങൾ', Marathi: 'परिधानाचे रंग', Bengali: 'পরার রং',
  Gujarati: 'પહેરવાના રંગો', Punjabi: 'ਪਹਿਨਣ ਦੇ ਰੰਗ', Odia: 'ପିନ୍ଧିବା ରଙ୍ଗ', Urdu: 'پہننے کے رنگ',
};
export const wearText = (f: Festival, lang: AstroLang): string => {
  if (f.wear[lang]) return f.wear[lang]!;
  if (!f.colours.length) return f.wear.English;
  const sep = lang === 'Urdu' ? '، ' : ', ';
  return `${WEAR_LEAD[lang]}: ${f.colours.map(c => colourName(c.name, lang)).join(sep)}`;
};

export const festivalText = (f: Festival, lang: AstroLang) => ({
  name: tx(f.name, lang),
  about: tx(f.about, lang),
  celebrate: tx(f.celebrate, lang),
  wear: wearText(f, lang),
});
