// Offline list of major Indian / Telugu festivals for 2026 and 2027 (IST dates), with a short
// explanation, how to celebrate, and what to wear (colours + why), in English and Telugu.
// Dates checked (Nov 2026) against the Telangana general / optional holidays G.O.Rt.No.1715
// (telangana.gov.in/downloads/calendar-2026), ap7am.com/calendar/2026/telangana,
// teluguscope.com/panchangam/festivals (Lahiri, Hyderabad), teluguvaari.com Telugu calendar 2027,
// panchangtime.com Telugu festivals 2027 and publicholidays.info (Telangana 2027).
// Ramzan / Bakrid depend on the moon sighting and can move by a day. Varalakshmi Vratam 2026 is the
// Telugu-panchang date (21 Aug; some North-Indian panchangs give 28 Aug).
// Add the 2028 dates here before the end of 2027.
import { daysBetween, istDay } from '../utils/astro';
import type { AstroLang } from './astrologyDaily';

export interface Festival {
  id: string;
  dates: string[]; // YYYY-MM-DD (IST)
  emoji: string;
  name: { English: string; Telugu: string };
  about: { English: string; Telugu: string };
  celebrate: { English: string; Telugu: string };
  wear: { English: string; Telugu: string };
  colours: { name: string; hex: string }[];
}

export const FESTIVALS: Festival[] = [
  {
    id: 'newyear', dates: ['2026-01-01', '2027-01-01', '2028-01-01'], emoji: '🎆',
    name: { English: 'New Year', Telugu: 'నూతన సంవత్సరం' },
    about: { English: 'The first day of the year: a fresh start full of hope.', Telugu: 'సంవత్సరంలో మొదటి రోజు: ఆశలతో నిండిన కొత్త ప్రారంభం.' },
    celebrate: { English: 'Write three goals, call loved ones, visit a temple or church, and start a good habit today.', Telugu: 'మూడు లక్ష్యాలు రాసుకోండి, ఆత్మీయులకు ఫోన్ చేయండి, గుడి లేదా చర్చికి వెళ్లండి, ఒక మంచి అలవాటు ఈ రోజే మొదలుపెట్టండి.' },
    wear: { English: 'Something new in bright, happy colours: gold, red or white. A new outfit is a traditional sign of a good start.', Telugu: 'బంగారు, ఎరుపు లేదా తెలుపు వంటి ప్రకాశవంతమైన కొత్త బట్టలు. కొత్త బట్టలు శుభారంభానికి సంకేతం.' },
    colours: [{ name: 'Gold', hex: '#D4A017' }, { name: 'Red', hex: '#D32F2F' }, { name: 'White', hex: '#F5F5F5' }],
  },
  {
    id: 'bhogi', dates: ['2026-01-14', '2027-01-14'], emoji: '🔥',
    name: { English: 'Bhogi', Telugu: 'భోగి' },
    about: { English: 'The first day of Sankranti: old things go into the Bhogi fire to welcome new beginnings.', Telugu: 'సంక్రాంతి మొదటి రోజు: పాతవాటిని భోగి మంటల్లో వేసి కొత్తదనానికి స్వాగతం పలుకుతాం.' },
    celebrate: { English: 'Light the Bhogi fire at dawn, draw muggulu, and shower little ones with Bhogi pallu (regi fruits) for blessings.', Telugu: 'తెల్లవారుజామున భోగి మంటలు వేసి, ముగ్గులు వేసి, పిల్లలకు భోగి పళ్లు పోసి ఆశీర్వదించండి.' },
    wear: { English: 'Traditional wear in yellow, orange or red: warm colours for the fire and the harvest sun.', Telugu: 'పసుపు, నారింజ లేదా ఎరుపు రంగుల సంప్రదాయ దుస్తులు: మంటలకు, పంట సూర్యుడికి తగిన వెచ్చని రంగులు.' },
    colours: [{ name: 'Yellow', hex: '#FBC02D' }, { name: 'Orange', hex: '#F57C00' }, { name: 'Red', hex: '#D32F2F' }],
  },
  {
    id: 'sankranti', dates: ['2026-01-15', '2027-01-15'], emoji: '🪁',
    name: { English: 'Makara Sankranti', Telugu: 'మకర సంక్రాంతి' },
    about: { English: "The Sun enters Makara: the harvest festival of thanks to the Sun, farmers and cattle.", Telugu: 'సూర్యుడు మకర రాశిలోకి ప్రవేశించే పండుగ: సూర్యుడికి, రైతులకు, పశువులకు కృతజ్ఞతలు తెలిపే పంట పండుగ.' },
    celebrate: { English: 'Big rangoli (muggulu) with gobbemmalu, pongali and sweets like ariselu, kite flying and time with family.', Telugu: 'గొబ్బెమ్మలతో పెద్ద ముగ్గులు, పొంగలి, అరిసెలు, గాలిపటాలు, కుటుంబంతో సరదాగా గడపడం.' },
    wear: { English: 'New traditional clothes: silk saree / langa voni or kurta / pancha in yellow, green or maroon. Yellow and green stand for the harvest and prosperity.', Telugu: 'కొత్త సంప్రదాయ దుస్తులు: పసుపు, ఆకుపచ్చ లేదా మెరూన్ పట్టు చీర / లంగా ఓణీ లేదా కుర్తా / పంచె. పసుపు, ఆకుపచ్చ పంటకు, సమృద్ధికి సంకేతం.' },
    colours: [{ name: 'Yellow', hex: '#FBC02D' }, { name: 'Green', hex: '#388E3C' }, { name: 'Maroon', hex: '#800000' }],
  },
  {
    id: 'shivaratri', dates: ['2026-02-15', '2027-03-06'], emoji: '🔱',
    name: { English: 'Maha Shivaratri', Telugu: 'మహా శివరాత్రి' },
    about: { English: 'The great night of Lord Shiva: a night of prayer, fasting and staying awake (jagarana).', Telugu: 'శివుని మహా రాత్రి: ప్రార్థన, ఉపవాసం, జాగరణ చేసే పవిత్ర రాత్రి.' },
    celebrate: { English: 'Visit a Shiva temple, offer water, milk and bilva leaves, chant "Om Namah Shivaya" and keep a light fast if you can.', Telugu: 'శివాలయానికి వెళ్లి నీళ్లు, పాలు, బిల్వ పత్రాలతో అభిషేకం చేయండి, "ఓం నమః శివాయ" జపించండి, వీలైతే ఉపవాసం ఉండండి.' },
    wear: { English: 'White or light blue: simple, pure colours that match the calm, devotional night.', Telugu: 'తెలుపు లేదా లేత నీలం: ప్రశాంతమైన భక్తి రాత్రికి తగిన స్వచ్ఛమైన రంగులు.' },
    colours: [{ name: 'White', hex: '#F5F5F5' }, { name: 'Light Blue', hex: '#81D4FA' }],
  },
  {
    id: 'holi', dates: ['2026-03-03', '2027-03-22'], emoji: '🎨',
    name: { English: 'Holi', Telugu: 'హోలీ' },
    about: { English: 'The festival of colours: good over evil (Holika) and the joy of spring.', Telugu: 'రంగుల పండుగ: చెడుపై మంచి విజయం (హోలిక), వసంతానికి స్వాగతం.' },
    celebrate: { English: 'Play with safe, natural colours, share sweets, forgive and hug old friends.', Telugu: 'సహజమైన, సురక్షిత రంగులతో ఆడుకోండి, స్వీట్లు పంచుకోండి, పాత గొడవలు మరచి స్నేహితులను కలవండి.' },
    wear: { English: 'Old white cotton clothes: white makes every colour shine and washes easy.', Telugu: 'పాత తెల్లటి కాటన్ బట్టలు: తెలుపు మీద ప్రతి రంగు అందంగా కనిపిస్తుంది.' },
    colours: [{ name: 'White', hex: '#F5F5F5' }],
  },
  {
    id: 'ugadi', dates: ['2026-03-19', '2027-04-07'], emoji: '🌿',
    name: { English: 'Ugadi (Telugu New Year)', Telugu: 'ఉగాది' },
    about: { English: 'The Telugu New Year: the first day of Chaitra, a new beginning for the whole year.', Telugu: 'తెలుగు నూతన సంవత్సరం: చైత్ర శుద్ధ పాడ్యమి, సంవత్సరమంతటికీ కొత్త ప్రారంభం.' },
    celebrate: { English: 'Mango-leaf torans, oil bath, Ugadi pachadi (six tastes for every feeling of life) and listening to the Panchanga Shravanam.', Telugu: 'మామిడి తోరణాలు, తలస్నానం, షడ్రుచుల ఉగాది పచ్చడి, పంచాంగ శ్రవణం.' },
    wear: { English: 'New clothes in yellow, green or mango-leaf shades: fresh colours of a new season and new hopes.', Telugu: 'పసుపు, ఆకుపచ్చ, మామిడాకు రంగుల కొత్త బట్టలు: కొత్త ఋతువుకు, కొత్త ఆశలకు సంకేతం.' },
    colours: [{ name: 'Yellow', hex: '#FBC02D' }, { name: 'Green', hex: '#388E3C' }],
  },
  {
    id: 'ramzan', dates: ['2026-03-21', '2027-03-10'], emoji: '🌙',
    name: { English: 'Ramzan (Eid-ul-Fitr)', Telugu: 'రంజాన్ (ఈదుల్ ఫితర్)' },
    about: { English: 'Eid marks the end of the Ramzan month of fasting: a day of thanks, charity and togetherness. (Date depends on the moon sighting.)', Telugu: 'రంజాన్ ఉపవాస మాసం ముగింపు: కృతజ్ఞత, దానం, ఐక్యతల పండుగ. (తేదీ చంద్ర దర్శనాన్ని బట్టి మారవచ్చు.)' },
    celebrate: { English: 'Wish "Eid Mubarak", share sheer khurma and haleem with friends, and give to those in need.', Telugu: '"ఈద్ ముబారక్" చెప్పండి, స్నేహితులతో షీర్ ఖుర్మా, హలీమ్ పంచుకోండి, అవసరమైన వారికి దానం చేయండి.' },
    wear: { English: 'Clean new clothes in white, green or soft pastels: white for purity, green for peace and blessings.', Telugu: 'తెలుపు, ఆకుపచ్చ లేదా లేత రంగుల కొత్త బట్టలు: తెలుపు స్వచ్ఛతకు, ఆకుపచ్చ శాంతికి సంకేతం.' },
    colours: [{ name: 'White', hex: '#F5F5F5' }, { name: 'Green', hex: '#2E7D32' }],
  },
  {
    id: 'ramanavami', dates: ['2026-03-27', '2027-04-15'], emoji: '🏹',
    name: { English: 'Sri Rama Navami', Telugu: 'శ్రీరామ నవమి' },
    about: { English: "Lord Rama's birthday and the celestial wedding (Kalyanam) of Sita and Rama, famous at Bhadrachalam.", Telugu: 'శ్రీరాముని జన్మదినం, సీతారాముల కళ్యాణం (భద్రాచలంలో ప్రసిద్ధి).' },
    celebrate: { English: 'Watch or attend the Sita Rama Kalyanam, share panakam and vadapappu, and read a little of the Ramayana.', Telugu: 'సీతారాముల కళ్యాణం చూడండి, పానకం, వడపప్పు పంచుకోండి, రామాయణం కొంచెం చదవండి.' },
    wear: { English: 'Yellow (pitambara) or saffron, the colours of Lord Rama; light cotton for the summer heat.', Telugu: 'శ్రీరామునికి ప్రీతికరమైన పసుపు (పీతాంబరం) లేదా కాషాయం; ఎండకు తేలికపాటి కాటన్.' },
    colours: [{ name: 'Yellow', hex: '#FBC02D' }, { name: 'Saffron', hex: '#FF9933' }],
  },
  {
    id: 'bakrid', dates: ['2026-05-28', '2027-05-17'], emoji: '🌙',
    name: { English: 'Bakrid (Eid-ul-Adha)', Telugu: 'బక్రీద్ (ఈదుల్ అజ్హా)' },
    about: { English: 'The festival of sacrifice and sharing, remembering the faith of Prophet Ibrahim. (Date depends on the moon sighting.)', Telugu: 'ప్రవక్త ఇబ్రహీం విశ్వాసాన్ని గుర్తుచేసే త్యాగం, పంచుకోవడం పండుగ. (తేదీ చంద్ర దర్శనాన్ని బట్టి మారవచ్చు.)' },
    celebrate: { English: 'Greet friends with "Eid Mubarak", share food with neighbours and the needy, and spend time with family.', Telugu: '"ఈద్ ముబారక్" చెప్పండి, ఇరుగుపొరుగుతో, అవసరమైన వారితో ఆహారం పంచుకోండి.' },
    wear: { English: 'White or green traditional wear: clean and simple for prayers and gatherings.', Telugu: 'తెలుపు లేదా ఆకుపచ్చ సంప్రదాయ దుస్తులు: ప్రార్థనలకు, కలయికలకు సరళంగా.' },
    colours: [{ name: 'White', hex: '#F5F5F5' }, { name: 'Green', hex: '#2E7D32' }],
  },
  {
    id: 'varalakshmi', dates: ['2026-08-21', '2027-08-13'], emoji: '🪷',
    name: { English: 'Varalakshmi Vratam', Telugu: 'వరలక్ష్మీ వ్రతం' },
    about: { English: 'A Friday in Shravana when Goddess Lakshmi, the giver of boons, is worshipped for the whole family.', Telugu: 'శ్రావణ మాసంలో శుక్రవారం, వరాలిచ్చే లక్ష్మీదేవిని కుటుంబ శ్రేయస్సు కోసం పూజించే వ్రతం.' },
    celebrate: { English: 'Decorate the kalasham, do the puja, tie the sacred thread, and share tambulam with friends and neighbours.', Telugu: 'కలశం అలంకరించి పూజ చేయండి, తోరం కట్టుకోండి, ముత్తైదువలకు తాంబూలం ఇవ్వండి.' },
    wear: { English: 'A silk saree in red, pink, green or yellow with gold jewellery: auspicious, prosperous colours loved by Lakshmi. Men: kurta or pancha in cream or yellow.', Telugu: 'ఎరుపు, గులాబీ, ఆకుపచ్చ లేదా పసుపు పట్టు చీర, బంగారు నగలు: లక్ష్మీదేవికి ప్రీతికరమైన శుభ రంగులు. మగవారు: క్రీమ్ లేదా పసుపు కుర్తా / పంచె.' },
    colours: [{ name: 'Red', hex: '#C62828' }, { name: 'Pink', hex: '#F48FB1' }, { name: 'Green', hex: '#388E3C' }, { name: 'Gold', hex: '#D4A017' }],
  },
  {
    id: 'rakhi', dates: ['2026-08-28', '2027-08-17'], emoji: '🧵',
    name: { English: 'Raksha Bandhan (Rakhi Pournami)', Telugu: 'రాఖీ పౌర్ణమి' },
    about: { English: 'A thread of love and protection between brothers and sisters, on Shravana Pournami.', Telugu: 'శ్రావణ పౌర్ణమి రోజు అన్నాచెల్లెళ్ల, అక్కాతమ్ముళ్ల ప్రేమ, రక్షణకు గుర్తుగా రాఖీ.' },
    celebrate: { English: 'Tie a rakhi, share sweets and a small gift, and promise to always look out for each other.', Telugu: 'రాఖీ కట్టి, స్వీట్లు, చిన్న బహుమతి ఇచ్చిపుచ్చుకోండి, ఒకరికొకరు తోడుంటామని మాట ఇవ్వండి.' },
    wear: { English: 'Bright, cheerful colours like pink, orange or yellow: festive and full of affection.', Telugu: 'గులాబీ, నారింజ, పసుపు వంటి ఉల్లాసమైన రంగులు: పండుగ కళ, ఆప్యాయత.' },
    colours: [{ name: 'Pink', hex: '#F48FB1' }, { name: 'Orange', hex: '#F57C00' }, { name: 'Yellow', hex: '#FBC02D' }],
  },
  {
    id: 'krishnashtami', dates: ['2026-09-04', '2027-08-25'], emoji: '🦚',
    name: { English: 'Sri Krishnashtami', Telugu: 'శ్రీ కృష్ణాష్టమి' },
    about: { English: "Lord Krishna's birthday, celebrated with joy, songs and the Utti (dahi handi) fun.", Telugu: 'శ్రీకృష్ణుని జన్మదినం: పాటలు, ఉట్టి కొట్టడం, ఆనందంతో జరుపుకునే పండుగ.' },
    celebrate: { English: "Draw little Krishna footprints at the door, offer butter and sweets, and dress kids as Krishna and Radha.", Telugu: 'గుమ్మం నుంచి చిన్ని కృష్ణుని పాదాలు వేయండి, వెన్న, స్వీట్లు నైవేద్యం పెట్టండి, పిల్లలను కృష్ణుడు, రాధలా అలంకరించండి.' },
    wear: { English: 'Yellow (Krishna\'s pitambara) or peacock blue and green, inspired by his peacock feather.', Telugu: 'శ్రీకృష్ణుని పీతాంబరం పసుపు లేదా నెమలి పింఛం నీలం, ఆకుపచ్చ.' },
    colours: [{ name: 'Yellow', hex: '#FBC02D' }, { name: 'Peacock Blue', hex: '#00796B' }],
  },
  {
    id: 'vinayaka', dates: ['2026-09-14', '2027-09-04'], emoji: '🐘',
    name: { English: 'Vinayaka Chavithi', Telugu: 'వినాయక చవితి' },
    about: { English: 'The birthday of Lord Ganesha, the remover of obstacles: every good start begins with him.', Telugu: 'విఘ్నాలను తొలగించే వినాయకుని పుట్టినరోజు: ప్రతి శుభారంభం ఆయనతోనే.' },
    celebrate: { English: 'Bring home an eco-friendly clay Ganesha, offer 21 leaves (patri) and kudumulu / undrallu, and read the Vinayaka katha.', Telugu: 'మట్టి వినాయకుడిని తెచ్చి, ఏకవింశతి పత్రి, కుడుములు / ఉండ్రాళ్లు నైవేద్యం పెట్టి, వినాయక కథ చదవండి.' },
    wear: { English: 'Red, orange or yellow: bright, auspicious colours that Ganesha loves.', Telugu: 'ఎరుపు, నారింజ లేదా పసుపు: వినాయకునికి ఇష్టమైన శుభ రంగులు.' },
    colours: [{ name: 'Red', hex: '#D32F2F' }, { name: 'Orange', hex: '#F57C00' }, { name: 'Yellow', hex: '#FBC02D' }],
  },
  {
    id: 'bathukamma', dates: ['2026-10-11', '2027-09-30'], emoji: '🌼',
    name: { English: 'Bathukamma begins (Engili Pula)', Telugu: 'బతుకమ్మ ప్రారంభం (ఎంగిలి పూల)' },
    about: { English: "Telangana's flower festival: nine days of celebrating Goddess Gauri and the gift of life with flower towers.", Telugu: 'తెలంగాణ పూల పండుగ: తొమ్మిది రోజులు పూల బతుకమ్మలతో గౌరమ్మను, జీవితాన్ని పూజించే పండుగ.' },
    celebrate: { English: 'Stack tangedu, gunugu and marigold flowers into a Bathukamma, sing and dance in a circle with friends in the evening.', Telugu: 'తంగేడు, గునుగు, బంతి పూలతో బతుకమ్మను పేర్చి, సాయంత్రం స్నేహితులతో కలిసి పాటలు పాడుతూ ఆడండి.' },
    wear: { English: 'Bright silk sarees or langa voni in yellow, pink and green, the same colours as the flowers.', Telugu: 'పూల రంగులైన పసుపు, గులాబీ, ఆకుపచ్చ పట్టు చీరలు లేదా లంగా ఓణీలు.' },
    colours: [{ name: 'Yellow', hex: '#FBC02D' }, { name: 'Pink', hex: '#EC407A' }, { name: 'Green', hex: '#388E3C' }],
  },
  {
    id: 'saddula', dates: ['2026-10-18', '2027-10-07'], emoji: '🌸',
    name: { English: 'Saddula Bathukamma', Telugu: 'సద్దుల బతుకమ్మ' },
    about: { English: 'The grand last day of Bathukamma, when the biggest flower towers are made and sent off in the water.', Telugu: 'బతుకమ్మ చివరి రోజు: పెద్ద బతుకమ్మలు పేర్చి నీటిలో నిమజ్జనం చేసే రోజు.' },
    celebrate: { English: 'Make your biggest Bathukamma, dance with everyone, then share saddulu (five kinds of rice) after the immersion.', Telugu: 'పెద్ద బతుకమ్మ పేర్చి, అందరితో ఆడి, నిమజ్జనం తర్వాత సద్దులు (ఐదు రకాల అన్నాలు) పంచుకోండి.' },
    wear: { English: 'Your best silk saree or langa voni in rich pink, yellow or green with flowers in your hair.', Telugu: 'గులాబీ, పసుపు, ఆకుపచ్చ పట్టు చీర లేదా లంగా ఓణీ, జడలో పూలు.' },
    colours: [{ name: 'Pink', hex: '#EC407A' }, { name: 'Yellow', hex: '#FBC02D' }, { name: 'Green', hex: '#388E3C' }],
  },
  {
    id: 'dasara', dates: ['2026-10-20', '2027-10-09'], emoji: '🏹',
    name: { English: 'Dasara (Vijayadashami)', Telugu: 'దసరా (విజయదశమి)' },
    about: { English: 'The victory of good over evil: Goddess Durga over Mahishasura and Rama over Ravana. A great day to start anything new.', Telugu: 'చెడుపై మంచి విజయం: మహిషాసురునిపై దుర్గమ్మ, రావణునిపై శ్రీరాముని విజయం. ఏ కొత్త పనైనా మొదలుపెట్టడానికి మంచి రోజు.' },
    celebrate: { English: 'Do Ayudha puja for your tools and books, exchange jammi leaves (shami) for gold-like luck, and see the Alai Balai with friends.', Telugu: 'పనిముట్లకు, పుస్తకాలకు ఆయుధ పూజ చేయండి, జమ్మి ఆకు (బంగారం) ఇచ్చిపుచ్చుకోండి, అలయ్ బలయ్‌లో స్నేహితులను కలవండి.' },
    wear: { English: 'Red, maroon or gold traditional wear: the colours of Goddess Durga\'s power and victory.', Telugu: 'ఎరుపు, మెరూన్ లేదా బంగారు సంప్రదాయ దుస్తులు: దుర్గమ్మ శక్తికి, విజయానికి సంకేతాలు.' },
    colours: [{ name: 'Red', hex: '#C62828' }, { name: 'Maroon', hex: '#800000' }, { name: 'Gold', hex: '#D4A017' }],
  },
  {
    id: 'deepavali', dates: ['2026-11-08', '2027-10-29'], emoji: '🪔',
    name: { English: 'Deepavali', Telugu: 'దీపావళి' },
    about: { English: 'The festival of lights: Narakasura is defeated and Goddess Lakshmi is welcomed home.', Telugu: 'దీపాల పండుగ: నరకాసుర వధ, లక్ష్మీదేవికి ఇంటికి స్వాగతం.' },
    celebrate: { English: 'Light diyas at every door, do Lakshmi puja in the evening, share sweets, and enjoy safe, green crackers.', Telugu: 'ప్రతి గుమ్మం దగ్గర దీపాలు వెలిగించండి, సాయంత్రం లక్ష్మీ పూజ చేయండి, స్వీట్లు పంచుకోండి, సురక్షితంగా టపాసులు కాల్చండి.' },
    wear: { English: 'New clothes in gold, red, yellow or deep pink: the shining colours of lamps and prosperity. Avoid loose dupattas near diyas.', Telugu: 'బంగారు, ఎరుపు, పసుపు, ముదురు గులాబీ రంగుల కొత్త బట్టలు: దీపాల, సమృద్ధి రంగులు. దీపాల దగ్గర వదులు దుపట్టాలు జాగ్రత్త.' },
    colours: [{ name: 'Gold', hex: '#D4A017' }, { name: 'Red', hex: '#C62828' }, { name: 'Yellow', hex: '#FBC02D' }],
  },
  {
    id: 'karthika', dates: ['2026-11-24', '2027-11-14'], emoji: '🪔',
    name: { English: 'Karthika Pournami', Telugu: 'కార్తీక పౌర్ణమి' },
    about: { English: 'The holiest full moon of Karthika month, dear to both Shiva and Vishnu.', Telugu: 'కార్తీక మాసంలో అత్యంత పవిత్రమైన పౌర్ణమి, శివకేశవులకు ప్రీతికరం.' },
    celebrate: { English: 'Light 365 wicks (deepalu) at a temple or at home, float a lamp on water, and enjoy a vanabhojanam with family.', Telugu: 'గుడిలో లేదా ఇంట్లో 365 వత్తుల దీపం వెలిగించండి, నీటిలో దీపం వదలండి, కుటుంబంతో వనభోజనం చేయండి.' },
    wear: { English: 'White, cream or silver tones that glow like the full moon, with a touch of gold.', Telugu: 'పౌర్ణమి చంద్రునిలా మెరిసే తెలుపు, క్రీమ్, వెండి రంగులు, కొంచెం బంగారు అంచుతో.' },
    colours: [{ name: 'White', hex: '#F5F5F5' }, { name: 'Cream', hex: '#FFF8E1' }, { name: 'Silver', hex: '#B0BEC5' }],
  },
  {
    id: 'christmas', dates: ['2026-12-25', '2027-12-25'], emoji: '🎄',
    name: { English: 'Christmas', Telugu: 'క్రిస్మస్' },
    about: { English: 'The birth of Jesus Christ: a festival of love, giving and peace.', Telugu: 'యేసుక్రీస్తు జన్మదినం: ప్రేమ, దానం, శాంతిల పండుగ.' },
    celebrate: { English: 'Decorate a star or tree, sing carols, share cake, and give a small gift to someone who needs it.', Telugu: 'నక్షత్రం లేదా క్రిస్మస్ చెట్టు అలంకరించండి, కరోల్స్ పాడండి, కేక్ పంచుకోండి, అవసరమైన వారికి చిన్న బహుమతి ఇవ్వండి.' },
    wear: { English: 'Red, green or white: the classic Christmas colours of joy, life and peace.', Telugu: 'ఎరుపు, ఆకుపచ్చ, తెలుపు: ఆనందం, జీవం, శాంతిని సూచించే క్రిస్మస్ రంగులు.' },
    colours: [{ name: 'Red', hex: '#C62828' }, { name: 'Green', hex: '#2E7D32' }, { name: 'White', hex: '#F5F5F5' }],
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

const tx = (r: Record<string, string>, lang: AstroLang) => r[lang] || r.English;
export const festivalText = (f: Festival, lang: AstroLang) => ({
  name: tx(f.name, lang),
  about: tx(f.about, lang),
  celebrate: tx(f.celebrate, lang),
  wear: tx(f.wear, lang),
});
