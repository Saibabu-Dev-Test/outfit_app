// Festival planning (Me ▸ 🔮 Astrology): from 7 days before each festival in services/festivals.ts,
// a card with how to get ready, fasting guidance, food to make, and the dress colour for the user
// (festival colours matched to the user's rashi lord). Texts: English + Telugu (other languages
// show the English text, like festivals.ts); short headings in all 12 languages.
// Fasting lines are traditional guidance only: health always comes first.
import type { AstroLang } from '../i18n/astroNames';
import { RASHI_LORD } from '../utils/astro';
import type { Festival } from './festivals';

type Bi = { English: string; Telugu: string };
export interface FestivalPlan {
  prep: Bi;
  fast: Bi;
  food: Bi;
}

const P = (prepEn: string, prepTe: string, fastEn: string, fastTe: string, foodEn: string, foodTe: string): FestivalPlan => ({
  prep: { English: prepEn, Telugu: prepTe },
  fast: { English: fastEn, Telugu: fastTe },
  food: { English: foodEn, Telugu: foodTe },
});

const NO_FAST: [string, string] = ['No fasting tradition for this day.', 'ఈ రోజుకు ఉపవాస సంప్రదాయం లేదు.'];
const NATIONAL = (prepEn: string, prepTe: string, foodEn: string, foodTe: string) => P(prepEn, prepTe, ...NO_FAST, foodEn, foodTe);

export const FESTIVAL_PLANS: Record<string, FestivalPlan> = {
  newyear: NATIONAL(
    'Clean your room, clear old messages and bills, and write 3 goals for the year.', 'గది శుభ్రం చేసి, పాత బిల్లులు సర్దుకుని, ఈ సంవత్సరానికి 3 లక్ష్యాలు రాసుకోండి.',
    'A sweet to start the year: kesari or payasam, and a family dinner.', 'కొత్త సంవత్సరానికి తీపి: కేసరి లేదా పాయసం, కుటుంబంతో విందు.'),
  bhogi: P(
    'Collect old wood / unused things for the Bhogi fire, buy regi pallu (jujube), flowers and rangoli colours.', 'భోగి మంటకు పాత కట్టెలు / వాడని వస్తువులు సేకరించండి, రేగి పళ్లు, పూలు, ముగ్గు రంగులు కొనండి.',
    'No fast; an early oil bath after the Bhogi fire is the custom.', 'ఉపవాసం లేదు; భోగి మంట తర్వాత తెల్లవారుజామున తలస్నానం ఆనవాయితీ.',
    'Pongali, chakkara pongali, and snacks like chakkiralu / murukulu.', 'పొంగలి, చక్కర పొంగలి, చక్కిలాలు / మురుకులు.'),
  sankranti: P(
    'Clean and whitewash the house, buy new clothes, rangoli colours, sesame, jaggery and kites; make gobbemmalu.', 'ఇల్లు శుభ్రం చేసి, కొత్త బట్టలు, ముగ్గు రంగులు, నువ్వులు, బెల్లం, గాలిపటాలు కొనండి; గొబ్బెమ్మలు చేయండి.',
    'No strict fast; many offer pongali to the Sun first and then eat.', 'కఠిన ఉపవాసం లేదు; ముందు సూర్యుడికి పొంగలి నివేదించి తర్వాత భోజనం.',
    'Ariselu, nuvvula undalu (sesame laddu), chakkara pongali and pulihora.', 'అరిసెలు, నువ్వుల ఉండలు, చక్కర పొంగలి, పులిహోర.'),
  kanuma: P(
    'Buy turmeric, kumkum and bells to decorate cattle; plan visits to relatives.', 'పశువుల అలంకరణకు పసుపు, కుంకుమ, గంటలు కొనండి; బంధువుల ఇంటికి వెళ్లే ప్లాన్.',
    ...NO_FAST,
    'Garelu, vegetable or meat curries as per family custom, and sweet pongali.', 'గారెలు, కుటుంబ ఆచారం ప్రకారం కూరలు, తీపి పొంగలి.'),
  vasantpanchami: P(
    'Keep books, pens and instruments clean for Saraswati puja; buy yellow flowers.', 'సరస్వతి పూజకు పుస్తకాలు, పెన్నులు, వాయిద్యాలు శుభ్రం చేయండి; పసుపు పూలు కొనండి.',
    'Optional fast until the puja; children usually do not fast.', 'పూజ వరకు ఐచ్ఛిక ఉపవాసం; పిల్లలు సాధారణంగా ఉపవాసం ఉండరు.',
    'Yellow foods: kesari, lemon rice and sweet pongali.', 'పసుపు వంటకాలు: కేసరి, నిమ్మకాయ పులిహోర, తీపి పొంగలి.'),
  rathasaptami: P(
    'Keep 7 jilledu (arka) leaves for the morning bath; draw a chariot rangoli.', 'తెల్లవారుజామున స్నానానికి 7 జిల్లేడు ఆకులు సిద్ధం చేయండి; రథం ముగ్గు వేయండి.',
    'Many fast or eat one simple meal after offering to the Sun.', 'చాలామంది సూర్యుడికి నివేదించిన తర్వాత ఒక పూట సాదా భోజనం చేస్తారు.',
    'Paramannam (milk rice) cooked in the sunlight, and chikkudu leaf offerings.', 'ఎండలో వండిన పరమాన్నం, చిక్కుడు ఆకులపై నైవేద్యం.'),
  republic: NATIONAL(
    'Iron your white / tricolour outfit, check the flag-hoisting time at school, office or colony.', 'తెల్ల / త్రివర్ణ దుస్తులు ఇస్త్రీ చేయండి, స్కూల్ / ఆఫీస్ / కాలనీ జెండా వందనం సమయం చూసుకోండి.',
    'Tricolour snacks: carrot halwa, coconut barfi and pista sweets; sweets for neighbours.', 'త్రివర్ణ తీపి: క్యారెట్ హల్వా, కొబ్బరి బర్ఫీ, పిస్తా స్వీట్స్; ఇరుగుపొరుగుకు పంచండి.'),
  shabebarat: P(
    'Clean the home, plan night prayers, and visit family graves if that is your custom.', 'ఇల్లు శుభ్రం చేసి, రాత్రి ప్రార్థనలు, ఆచారం ఉంటే కుటుంబ సమాధుల సందర్శన ప్లాన్ చేయండి.',
    'Many keep a voluntary fast the next day.', 'చాలామంది మరుసటి రోజు ఐచ్ఛిక ఉపవాసం ఉంటారు.',
    'Halwa (chana dal / suji) shared with neighbours and the needy.', 'హల్వా (శనగపప్పు / రవ్వ) ఇరుగుపొరుగుకు, అవసరమైన వారికి పంచండి.'),
  shivaratri: P(
    'Buy bilva leaves, milk, flowers; plan the temple visit and the night jagarana.', 'బిల్వ పత్రాలు, పాలు, పూలు కొనండి; గుడి దర్శనం, రాత్రి జాగరణ ప్లాన్ చేయండి.',
    'Traditional fast all day (fruits, milk or water as you can), broken the next morning. Skip or keep it light if you are unwell, pregnant or diabetic.', 'రోజంతా ఉపవాసం (వీలైనట్లు పండ్లు, పాలు, నీళ్లు), మరుసటి ఉదయం విరమణ. అనారోగ్యం, గర్భం, మధుమేహం ఉంటే మానండి లేదా తేలికగా ఉండండి.',
    'Fasting food: sabudana khichdi, fruits, sweet potato; next day pongali / payasam.', 'ఉపవాస ఆహారం: సగ్గుబియ్యం కిచిడీ, పండ్లు, చిలగడదుంప; మరుసటి రోజు పొంగలి / పాయసం.'),
  holi: P(
    'Buy natural / herbal colours, keep old clothes ready, oil your hair and skin before playing; protect phones.', 'సహజ రంగులు కొనండి, పాత బట్టలు సిద్ధం, ఆడే ముందు జుట్టుకు, చర్మానికి నూనె; ఫోన్లు జాగ్రత్త.',
    ...NO_FAST,
    'Gujiya, thandai (no bhang for kids), and pakodas.', 'గుజియా, తాండై, పకోడీలు.'),
  ugadi: P(
    'Clean the house, tie mango-leaf toranams, buy new clothes, neem flowers, raw mango and jaggery; check the panchanga sravanam time.', 'ఇల్లు శుభ్రం చేసి మామిడి తోరణాలు కట్టండి, కొత్త బట్టలు, వేప పూత, మామిడికాయ, బెల్లం కొనండి; పంచాంగ శ్రవణం సమయం చూసుకోండి.',
    'No fast; start the day with Ugadi pachadi before eating.', 'ఉపవాసం లేదు; భోజనానికి ముందు ఉగాది పచ్చడితో రోజు మొదలు.',
    'Ugadi pachadi (6 tastes), bobbatlu / puran poli and pulihora.', 'ఉగాది పచ్చడి (షడ్రుచులు), బొబ్బట్లు, పులిహోర.'),
  ramzan: P(
    'Buy new clothes, plan Eid prayers, set aside Zakat / Fitra before the prayer, and plan family visits.', 'కొత్త బట్టలు, ఈద్ నమాజ్ ప్లాన్, నమాజ్‌కు ముందు జకాత్ / ఫిత్రా, బంధువుల సందర్శన ప్లాన్ చేయండి.',
    'Eid itself is a day of feasting: fasting is not kept on Eid.', 'ఈద్ రోజు విందు రోజు: ఆ రోజు ఉపవాసం ఉండరు.',
    'Sheer khurma, biryani and haleem; dates to start the day.', 'షీర్ ఖుర్మా, బిర్యానీ, హలీం; రోజు ఖర్జూరంతో మొదలు.'),
  ramanavami: P(
    'Buy flowers, tulsi and items for Sita Rama kalyanam; plan the temple or pandal visit.', 'పూలు, తులసి, సీతారామ కళ్యాణ సామగ్రి కొనండి; గుడి / పందిరి దర్శనం ప్లాన్ చేయండి.',
    'Many fast until noon (the birth time of Rama), then eat the prasadam.', 'చాలామంది మధ్యాహ్నం (రాముని జనన సమయం) వరకు ఉపవాసం, తర్వాత ప్రసాదం.',
    'Panakam (jaggery-pepper drink), vadapappu (soaked moong dal) and chalimidi.', 'పానకం, వడపప్పు, చలిమిడి.'),
  mahavir: P(
    'Plan a visit to a Jain temple and an act of charity or kindness.', 'జైన దేవాలయ దర్శనం, ఒక దానం లేదా దయా కార్యం ప్లాన్ చేయండి.',
    'Jains often fast or eat before sunset; follow your family custom.', 'జైనులు తరచుగా ఉపవాసం లేదా సూర్యాస్తమయానికి ముందు భోజనం; కుటుంబ ఆచారం పాటించండి.',
    'Simple sattvic food without onion and garlic.', 'ఉల్లి, వెల్లుల్లి లేని సాత్విక ఆహారం.'),
  hanuman: P(
    'Buy sindoor, betel leaves and flowers; plan Hanuman Chalisa reading or the temple visit.', 'సిందూరం, తమలపాకులు, పూలు కొనండి; హనుమాన్ చాలీసా పఠనం లేదా గుడి దర్శనం ప్లాన్ చేయండి.',
    'Optional fast until the evening puja.', 'సాయంత్రం పూజ వరకు ఐచ్ఛిక ఉపవాసం.',
    'Garelu (vada mala), boondi laddu and appalu.', 'గారెలు (వడమాల), బూందీ లడ్డు, అప్పాలు.'),
  goodfriday: P(
    'Plan the church service and quiet time for prayer and reflection.', 'చర్చి ఆరాధన, ప్రార్థన, ఆత్మపరిశీలనకు సమయం ప్లాన్ చేయండి.',
    'Many keep a fast or avoid meat today; follow your church custom.', 'చాలామంది ఉపవాసం లేదా మాంసాహారం మానుతారు; మీ చర్చి ఆచారం పాటించండి.',
    'Simple meatless meals: fish or vegetable curry, rice.', 'సాదా భోజనం: చేప లేదా కూరగాయల కూర, అన్నం.'),
  easter: P(
    'Plan the sunrise or morning service, decorate eggs with kids, invite family for lunch.', 'ఉదయం ఆరాధన, పిల్లలతో గుడ్ల అలంకరణ, కుటుంబ భోజనానికి ఆహ్వానం ప్లాన్ చేయండి.',
    ...NO_FAST,
    'Festive lunch: biryani or roast, cake and decorated eggs.', 'పండుగ భోజనం: బిర్యానీ లేదా రోస్ట్, కేక్, అలంకరించిన గుడ్లు.'),
  ambedkar: NATIONAL(
    'Read about Dr. B. R. Ambedkar, join a local tribute and plan to help someone with their studies.', 'డా. బి.ఆర్. అంబేద్కర్ గురించి చదవండి, స్థానిక నివాళిలో పాల్గొనండి, ఎవరికైనా చదువులో సహాయం చేయండి.',
    'A simple family meal; share sweets.', 'సాదా కుటుంబ భోజనం; తీపి పంచండి.'),
  akshaya: P(
    'Plan a small auspicious purchase (gold / silver or anything useful) and a donation of water, curd or food.', 'చిన్న శుభ కొనుగోలు (బంగారం / వెండి లేదా ఉపయోగపడేది), నీరు, పెరుగు, ఆహార దానం ప్లాన్ చేయండి.',
    'Optional fast until the Lakshmi puja.', 'లక్ష్మీ పూజ వరకు ఐచ్ఛిక ఉపవాసం.',
    'Payasam, curd rice and cooling buttermilk.', 'పాయసం, దద్దోజనం, చల్లని మజ్జిగ.'),
  buddha: P(
    'Plan meditation, a visit to a Buddhist site, and a kind act.', 'ధ్యానం, బౌద్ధ క్షేత్ర సందర్శన, ఒక దయా కార్యం ప్లాన్ చేయండి.',
    'Many eat simple vegetarian food today.', 'చాలామంది ఈ రోజు సాదా శాకాహారం తింటారు.',
    'Kheer (rice and milk), fruits and simple vegetarian meals.', 'పాయసం, పండ్లు, సాదా శాకాహారం.'),
  bakrid: P(
    'Plan Eid prayers, new clothes, the Qurbani as per custom, and sharing with neighbours and the needy.', 'ఈద్ నమాజ్, కొత్త బట్టలు, ఆచారం ప్రకారం ఖుర్బానీ, ఇరుగుపొరుగుకు, అవసరమైన వారికి పంచడం ప్లాన్ చేయండి.',
    'No fast on Eid; many fast on the day of Arafah before it.', 'ఈద్ రోజు ఉపవాసం లేదు; ముందు రోజు అరఫా ఉపవాసం చాలామంది ఉంటారు.',
    'Mutton biryani, kebabs, and sheer khurma or double ka meetha.', 'మటన్ బిర్యానీ, కబాబ్‌లు, షీర్ ఖుర్మా లేదా డబుల్ కా మీఠా.'),
  telanganaday: NATIONAL(
    'Join the flag hoisting in your area and learn one thing about Telangana history.', 'మీ ప్రాంతంలో జెండా వందనంలో పాల్గొనండి, తెలంగాణ చరిత్ర గురించి ఒకటి తెలుసుకోండి.',
    'Telangana dishes: sarva pindi, sakinalu and bagara rice.', 'తెలంగాణ వంటలు: సర్వ పిండి, సకినాలు, బగారా అన్నం.'),
  muharram: P(
    'A day of remembrance: plan prayers or a majlis; keep it respectful and calm.', 'స్మరణ దినం: ప్రార్థనలు లేదా మజ్లిస్ ప్లాన్ చేయండి; గౌరవంగా, ప్రశాంతంగా ఉండండి.',
    'Many keep a fast on Ashura (the 9th and 10th).', 'చాలామంది ఆషూరా (9, 10 తేదీలు) ఉపవాసం ఉంటారు.',
    'Haleem, khichda and sharbat shared at gatherings.', 'హలీం, ఖిచ్డా, షర్బత్ పంచుతారు.'),
  bonalu: P(
    'Prepare the bonam pot (new pot, turmeric, neem leaves, lamp), plan the temple visit to the Ammavaru.', 'బోనం కుండ (కొత్త కుండ, పసుపు, వేపాకులు, దీపం) సిద్ధం చేసి, అమ్మవారి గుడి దర్శనం ప్లాన్ చేయండి.',
    'Women carrying the bonam often fast until offering it.', 'బోనం ఎత్తే మహిళలు సమర్పించే వరకు తరచుగా ఉపవాసం ఉంటారు.',
    'Bonam rice (with jaggery / curd / onion as per family custom).', 'బోనం అన్నం (కుటుంబ ఆచారం ప్రకారం బెల్లం / పెరుగు / ఉల్లితో).'),
  tholiekadashi: P(
    'Plan the Vishnu puja and Vishnu Sahasranama; the chaturmasa starts, so plan simple habits.', 'విష్ణు పూజ, విష్ణు సహస్రనామం ప్లాన్ చేయండి; చాతుర్మాస్యం మొదలు, సాదా అలవాట్లు ప్లాన్ చేయండి.',
    'Ekadashi fast: no rice and grains (fruits, milk), broken on Dwadashi morning. Skip if unwell.', 'ఏకాదశి ఉపవాసం: అన్నం, ధాన్యాలు వద్దు (పండ్లు, పాలు), ద్వాదశి ఉదయం విరమణ. అనారోగ్యంగా ఉంటే మానండి.',
    'Pelala pindi (puffed rice flour with jaggery) and fruits.', 'పేలాల పిండి (బెల్లంతో), పండ్లు.'),
  gurupurnima: P(
    'Thank a teacher or mentor: plan a call, a visit or a small gift.', 'గురువుకు, మార్గదర్శికి కృతజ్ఞత: ఫోన్, సందర్శన లేదా చిన్న బహుమతి ప్లాన్ చేయండి.',
    'Optional fast until the guru puja.', 'గురు పూజ వరకు ఐచ్ఛిక ఉపవాసం.',
    'Payasam and fruits as naivedyam.', 'నైవేద్యంగా పాయసం, పండ్లు.'),
  nagpanchami: P(
    'Buy milk, turmeric and flowers for the anthill / Naga puja.', 'పుట్ట / నాగ పూజకు పాలు, పసుపు, పూలు కొనండి.',
    'Many fast until the puja and avoid cutting / frying that day.', 'చాలామంది పూజ వరకు ఉపవాసం, ఆ రోజు కోయడం / వేయించడం మానుతారు.',
    'Chalimidi, chimmili (sesame-jaggery balls) and milk.', 'చలిమిడి, చిమ్మిలి, పాలు.'),
  independence: NATIONAL(
    'Iron a white / tricolour outfit, check the flag-hoisting time, and teach kids one freedom-fighter story.', 'తెల్ల / త్రివర్ణ దుస్తులు ఇస్త్రీ, జెండా వందనం సమయం చూసుకోండి, పిల్లలకు ఒక స్వాతంత్ర్య సమరయోధుని కథ చెప్పండి.',
    'Tricolour pulao or sweets, and sweets for the flag hoisting.', 'త్రివర్ణ పులావ్ లేదా స్వీట్స్, జెండా వందనానికి తీపి.'),
  varalakshmi: P(
    'Clean the puja room, set up the kalasham, buy flowers, fruits, a new saree / blouse piece and thoranam.', 'పూజ గది శుభ్రం చేసి కలశం ఏర్పాటు, పూలు, పండ్లు, కొత్త చీర / రవిక ముక్క, తోరం కొనండి.',
    'Many women fast until the vratam puja is done.', 'వ్రతం పూజ పూర్తయ్యే వరకు చాలామంది మహిళలు ఉపవాసం ఉంటారు.',
    'Nine naivedyams if you can: pulihora, payasam, garelu, bobbatlu and more.', 'వీలైతే తొమ్మిది నైవేద్యాలు: పులిహోర, పాయసం, గారెలు, బొబ్బట్లు మొదలైనవి.'),
  milad: P(
    'Plan prayers, listening to the Prophet\'s life story, and charity.', 'ప్రార్థనలు, ప్రవక్త జీవిత కథ వినడం, దానం ప్లాన్ చేయండి.',
    ...NO_FAST,
    'Sweets and kheer shared with neighbours.', 'తీపి, ఖీర్ ఇరుగుపొరుగుకు పంచండి.'),
  rakhi: P(
    'Buy rakhis early (post them if your brother / sister lives far), and plan a gift.', 'రాఖీలు ముందే కొనండి (దూరంగా ఉంటే పోస్ట్ చేయండి), బహుమతి ప్లాన్ చేయండి.',
    'Some sisters fast until they tie the rakhi; optional.', 'కొంతమంది సోదరీమణులు రాఖీ కట్టే వరకు ఉపవాసం; ఐచ్ఛికం.',
    'Sweets like kaju katli or kova, and a festive lunch together.', 'కాజు కత్లీ, కోవా వంటి తీపి, కలిసి పండుగ భోజనం.'),
  krishnashtami: P(
    'Draw little Krishna footprints, plan the uri / dahi handi and a cradle for Krishna; buy butter and flowers.', 'చిన్ని కృష్ణుని అడుగులు వేయండి, ఉట్టి, ఊయల ప్లాన్ చేయండి; వెన్న, పూలు కొనండి.',
    'Many fast until midnight (Krishna\'s birth), then eat the prasadam. Kids and elders can keep it light.', 'చాలామంది అర్ధరాత్రి (కృష్ణ జననం) వరకు ఉపవాసం, తర్వాత ప్రసాదం. పిల్లలు, పెద్దలు తేలికగా ఉండవచ్చు.',
    'Butter, curd, atukulu (poha) sweets, panjiri and murukulu.', 'వెన్న, పెరుగు, అటుకుల తీపి, పంజిరి, మురుకులు.'),
  vinayaka: P(
    'Buy a clay (eco-friendly) Ganesha, 21 patri leaves, flowers and fruits; plan the immersion at home in a bucket if you can.', 'మట్టి గణపతి, 21 పత్రి, పూలు, పండ్లు కొనండి; వీలైతే ఇంట్లోనే బకెట్‌లో నిమజ్జనం ప్లాన్ చేయండి.',
    'Many fast until the puja; avoid looking at the moon that night, as the tradition goes.', 'పూజ వరకు చాలామంది ఉపవాసం; ఆ రాత్రి చంద్రుని చూడకూడదని సంప్రదాయం.',
    'Kudumulu (modak), undrallu, vundrallu payasam and laddus.', 'కుడుములు, ఉండ్రాళ్లు, పాయసం, లడ్డూలు.'),
  mahalaya: P(
    'Remember elders who passed: plan tarpanam, a temple visit or feeding someone in their name.', 'దివంగత పెద్దలను స్మరించండి: తర్పణం, గుడి దర్శనం లేదా వారి పేరున అన్నదానం ప్లాన్ చేయండి.',
    'Many eat one simple meal until the rituals are done.', 'కర్మలు పూర్తయ్యే వరకు చాలామంది ఒక పూట సాదా భోజనం.',
    'Simple traditional food the elders liked; no onion / garlic in many homes.', 'పెద్దలకు ఇష్టమైన సాదా సంప్రదాయ భోజనం; చాలా ఇళ్లలో ఉల్లి / వెల్లుల్లి వాడరు.'),
  bathukamma: P(
    'Collect seasonal flowers (tangedu, gunugu, banti) and a plate to stack the Bathukamma; learn a song or two.', 'తంగేడు, గునుగు, బంతి వంటి పూలు సేకరించి బతుకమ్మ పేర్చడానికి పళ్లెం సిద్ధం చేయండి; ఒకటి రెండు పాటలు నేర్చుకోండి.',
    ...NO_FAST,
    'A different naivedyam each day: atukulu, muddapappu, nanu biyyam, and finally malida.', 'రోజుకో నైవేద్యం: అటుకులు, ముద్దపప్పు, నానుబియ్యం, చివరికి మలీద.'),
  navaratri: P(
    'Set up kalasham / golu, plan the 9 days\' colours and daily puja; clean the home.', 'కలశం / బొమ్మల కొలువు ఏర్పాటు, 9 రోజుల రంగులు, రోజువారీ పూజ ప్లాన్ చేయండి; ఇల్లు శుభ్రం చేయండి.',
    'Many fast some or all 9 days (fruits, milk, one meal). Choose what suits your health.', 'చాలామంది కొన్ని లేదా 9 రోజులూ ఉపవాసం (పండ్లు, పాలు, ఒక పూట). ఆరోగ్యానికి తగినది ఎంచుకోండి.',
    'Daily prasadam: pulihora, daddojanam, payasam, sundal / guggillu.', 'రోజువారీ ప్రసాదం: పులిహోర, దద్దోజనం, పాయసం, గుగ్గిళ్లు.'),
  saddula: P(
    'The big Bathukamma day: make the tallest Bathukamma, plan the evening immersion at the lake.', 'పెద్ద బతుకమ్మ రోజు: ఎత్తైన బతుకమ్మ పేర్చి, సాయంత్రం చెరువులో నిమజ్జనం ప్లాన్ చేయండి.',
    ...NO_FAST,
    'Five kinds of saddulu (flavoured rice): lemon, tamarind, coconut, sesame and curd.', 'ఐదు రకాల సద్దులు: నిమ్మ, చింతపండు, కొబ్బరి, నువ్వుల, పెరుగు.'),
  durgashtami: P(
    'Plan the Durga puja, ayudha puja items (tools, vehicles) cleaning, and kanya puja if your family does it.', 'దుర్గా పూజ, ఆయుధ పూజకు పనిముట్లు / వాహనాల శుభ్రత, కుటుంబ ఆచారం అయితే కన్యా పూజ ప్లాన్ చేయండి.',
    'Many fast until the Ashtami puja.', 'అష్టమి పూజ వరకు చాలామంది ఉపవాసం.',
    'Sweet pongali, chana sundal and halwa-puri for kanya puja.', 'చక్కర పొంగలి, శనగ గుగ్గిళ్లు, కన్యా పూజకు హల్వా-పూరీ.'),
  dasara: P(
    'Clean vehicles and tools for puja, buy jammi (shami) leaves, plan Ravana dahanam / Alai Balai visits.', 'వాహనాలు, పనిముట్లు పూజకు శుభ్రం చేయండి, జమ్మి ఆకులు కొనండి, రావణ దహనం / అలయ్ బలయ్ ప్లాన్ చేయండి.',
    'No fast on Vijayadashami; a day to celebrate.', 'విజయదశమి రోజు ఉపవాసం లేదు; వేడుక రోజు.',
    'Festive meal: pulihora, payasam, garelu; share jammi leaves with elders for blessings.', 'పండుగ భోజనం: పులిహోర, పాయసం, గారెలు; పెద్దలకు జమ్మి ఆకులు ఇచ్చి ఆశీర్వాదం.'),
  gandhi: NATIONAL(
    'Plan a clean-up of your street or a small act of service; read one of Gandhiji\'s quotes with kids.', 'వీధి శుభ్రత లేదా చిన్న సేవా కార్యం ప్లాన్ చేయండి; పిల్లలతో గాంధీజీ సూక్తి చదవండి.',
    'Simple vegetarian food, the Gandhian way.', 'గాంధీ మార్గంలో సాదా శాకాహారం.'),
  atlataddi: P(
    'Plan the swings and games with friends, buy gorintaku (henna) to apply the evening before.', 'స్నేహితులతో ఉయ్యాలలు, ఆటలు ప్లాన్ చేయండి, ముందు రోజు సాయంత్రం గోరింటాకు పెట్టుకోండి.',
    'Women fast from dawn until moonrise; eat the early-morning meal (before dawn) well.', 'మహిళలు తెల్లవారుజాము నుండి చంద్రోదయం వరకు ఉపవాసం; తెల్లవారకముందే బాగా భోజనం చేయండి.',
    'Pre-dawn: curd rice, gongura pachadi; evening: atlu (dosas) offered to the moon.', 'తెల్లవారకముందు: పెరుగన్నం, గోంగూర పచ్చడి; సాయంత్రం చంద్రుడికి అట్లు నివేదన.'),
  karvachauth: P(
    'Buy the karva, sieve, sargi items and henna; plan the evening puja and moonrise time.', 'కర్వా, జల్లెడ, సర్గీ సామగ్రి, గోరింటాకు కొనండి; సాయంత్రం పూజ, చంద్రోదయ సమయం చూసుకోండి.',
    'Married women fast from sunrise to moonrise after sargi; skip water fasting if unwell or pregnant.', 'సర్గీ తర్వాత సూర్యోదయం నుండి చంద్రోదయం వరకు ఉపవాసం; అనారోగ్యం / గర్భం ఉంటే నీరు లేని ఉపవాసం మానండి.',
    'Sargi: fruits, dry fruits, pheni; evening: puri, kheer and halwa.', 'సర్గీ: పండ్లు, డ్రై ఫ్రూట్స్; సాయంత్రం: పూరీ, ఖీర్, హల్వా.'),
  dhanteras: P(
    'Clean the house and doorway, buy something new in metal (a steel vessel works), and light a lamp at the door in the evening.', 'ఇల్లు, గుమ్మం శుభ్రం చేసి, లోహంతో కొత్త వస్తువు (స్టీల్ పాత్ర చాలు) కొనండి, సాయంత్రం గుమ్మం దగ్గర దీపం వెలిగించండి.',
    'Optional fast until the evening Lakshmi-Kubera puja.', 'సాయంత్రం లక్ష్మీ-కుబేర పూజ వరకు ఐచ్ఛిక ఉపవాసం.',
    'Sweets for the puja: kova, laddu and payasam.', 'పూజకు తీపి: కోవా, లడ్డు, పాయసం.'),
  narakachaturdashi: P(
    'Keep oil and sunnipindi (bath powder) for the early oil bath; lamps and safe crackers ready.', 'తెల్లవారుజామున అభ్యంగన స్నానానికి నూనె, సున్నిపిండి సిద్ధం; దీపాలు, సురక్షిత టపాసులు.',
    ...NO_FAST,
    'Sweets and savouries: laddu, mysore pak, chakralu.', 'తీపి, కారాలు: లడ్డు, మైసూర్ పాక్, చక్రాలు.'),
  deepavali: P(
    'Clean and decorate, buy diyas, oil, flowers and rangoli colours; plan Lakshmi puja time; keep a bucket of water near crackers.', 'ఇల్లు శుభ్రం చేసి అలంకరించండి, ప్రమిదలు, నూనె, పూలు, ముగ్గు రంగులు కొనండి; లక్ష్మీ పూజ సమయం; టపాసుల దగ్గర నీళ్ల బకెట్.',
    'Optional fast until the evening Lakshmi puja.', 'సాయంత్రం లక్ష్మీ పూజ వరకు ఐచ్ఛిక ఉపవాసం.',
    'Sweets to share: kaju katli, laddu, gulab jamun, and snacks like murukulu.', 'పంచుకునే తీపి: కాజు కత్లీ, లడ్డు, గులాబ్ జామూన్, మురుకులు.'),
  balipadyami: P(
    'Plan Govardhan / Bali puja and visits to relatives; many start new account books.', 'గోవర్ధన / బలి పూజ, బంధువుల సందర్శన ప్లాన్; చాలామంది కొత్త లెక్కల పుస్తకాలు మొదలుపెడతారు.',
    ...NO_FAST,
    'Annakoot: many dishes offered together; holige / bobbatlu.', 'అన్నకూట్: ఎన్నో వంటకాల నైవేద్యం; బొబ్బట్లు.'),
  bhaidooj: P(
    'Sisters invite brothers home; plan the tilak, aarti and a gift.', 'సోదరీమణులు సోదరులను ఇంటికి ఆహ్వానించండి; తిలకం, హారతి, బహుమతి ప్లాన్.',
    'Some sisters fast until the tilak; optional.', 'కొంతమంది సోదరీమణులు తిలకం వరకు ఉపవాసం; ఐచ్ఛికం.',
    'The brother\'s favourite meal and a sweet.', 'సోదరుడికి ఇష్టమైన భోజనం, తీపి.'),
  nagulachavithi: P(
    'Buy milk, eggs (if custom), flowers and turmeric for the anthill puja.', 'పుట్ట పూజకు పాలు, (ఆచారం అయితే) గుడ్లు, పూలు, పసుపు కొనండి.',
    'Many fast until the puja at the anthill.', 'పుట్ట పూజ వరకు చాలామంది ఉపవాసం.',
    'Chalimidi, chimmili and vadapappu.', 'చలిమిడి, చిమ్మిలి, వడపప్పు.'),
  childrensday: NATIONAL(
    'Plan a fun day for the kids: a park visit, a game, or let them choose dinner.', 'పిల్లలకు సరదా రోజు: పార్క్, ఆట, లేదా డిన్నర్ వారే ఎంచుకోనివ్వండి.',
    'Kids\' favourites: pizza at home, fruit custard or chocolate cake.', 'పిల్లలకు ఇష్టమైనవి: ఇంట్లో పిజ్జా, ఫ్రూట్ కస్టర్డ్, చాక్లెట్ కేక్.'),
  karthikasomavaram: P(
    'Plan the Shiva temple visit, lamps at dusk, and abhishekam items (milk, bilva).', 'శివాలయ దర్శనం, సంధ్యా దీపాలు, అభిషేక సామగ్రి (పాలు, బిల్వం) ప్లాన్ చేయండి.',
    'Many fast all day and eat after seeing the evening star / lamp; keep it light if unwell.', 'చాలామంది రోజంతా ఉపవాసం, సాయంత్రం నక్షత్ర దర్శనం / దీపం తర్వాత భోజనం; అనారోగ్యం ఉంటే తేలికగా.',
    'After the fast: simple pongali, curd rice and fruits.', 'ఉపవాసం తర్వాత: సాదా పొంగలి, పెరుగన్నం, పండ్లు.'),
  karthika: P(
    'Buy lamps, oil, banana stems / leaves for floating lamps; plan the temple or river / lake visit.', 'దీపాలు, నూనె, అరటి దొప్పలు కొనండి; గుడి లేదా నది / చెరువు దర్శనం ప్లాన్ చేయండి.',
    'Many fast until lighting 365 wicks (jwala thoranam / deepam) in the evening.', 'సాయంత్రం 365 వత్తుల దీపం వెలిగించే వరకు చాలామంది ఉపవాసం.',
    'Payasam, pulihora and fruits as prasadam.', 'ప్రసాదంగా పాయసం, పులిహోర, పండ్లు.'),
  gurunanak: P(
    'Plan a gurdwara visit, kirtan, and seva at the langar.', 'గురుద్వారా దర్శనం, కీర్తన, లంగర్‌లో సేవ ప్లాన్ చేయండి.',
    ...NO_FAST,
    'Kada prasad, and langar food: dal, roti and kheer.', 'కడా ప్రసాద్, లంగర్ భోజనం: పప్పు, రోటీ, ఖీర్.'),
  subrahmanya: P(
    'Plan the Subrahmanya temple visit and anthill / Naga puja; buy flowers and milk.', 'సుబ్రహ్మణ్య ఆలయ దర్శనం, పుట్ట / నాగ పూజ ప్లాన్; పూలు, పాలు కొనండి.',
    'Many fast until the puja.', 'పూజ వరకు చాలామంది ఉపవాసం.',
    'Chalimidi, vadapappu and panakam.', 'చలిమిడి, వడపప్పు, పానకం.'),
  vaikunta: P(
    'Plan the early-morning uttara dwara darshanam (temples are crowded: go early) and Vishnu Sahasranama.', 'తెల్లవారుజామున ఉత్తర ద్వార దర్శనం (రద్దీ ఎక్కువ: త్వరగా వెళ్లండి), విష్ణు సహస్రనామం ప్లాన్.',
    'Ekadashi fast: no rice and grains (fruits, milk), broken on Dwadashi morning. Skip if unwell.', 'ఏకాదశి ఉపవాసం: అన్నం, ధాన్యాలు వద్దు (పండ్లు, పాలు), ద్వాదశి ఉదయం విరమణ. అనారోగ్యంగా ఉంటే మానండి.',
    'Fasting food: fruits, milk, sabudana; Dwadashi: a simple full meal.', 'ఉపవాస ఆహారం: పండ్లు, పాలు, సగ్గుబియ్యం; ద్వాదశి: సాదా భోజనం.'),
  dattatreya: P(
    'Plan the Datta temple visit or Guru Charitra reading; feed someone in need.', 'దత్త ఆలయ దర్శనం లేదా గురుచరిత్ర పారాయణం ప్లాన్; అవసరమైన వారికి అన్నదానం.',
    'Optional fast until the evening puja.', 'సాయంత్రం పూజ వరకు ఐచ్ఛిక ఉపవాసం.',
    'Payasam and simple sattvic food.', 'పాయసం, సాదా సాత్విక భోజనం.'),
  christmas: P(
    'Put up the star and tree, plan the midnight / morning service, gifts and carol time.', 'నక్షత్రం, చెట్టు అలంకరించండి; అర్ధరాత్రి / ఉదయం ఆరాధన, బహుమతులు, కరోల్స్ ప్లాన్ చేయండి.',
    ...NO_FAST,
    'Plum cake, rose cookies (gulabilu), and a festive biryani lunch.', 'ప్లమ్ కేక్, గులాబీలు (రోజ్ కుకీస్), పండుగ బిర్యానీ భోజనం.'),
};

const GENERIC = P(
  'Clean the home, plan the puja or visit, and buy what you need a day early.', 'ఇల్లు శుభ్రం చేసి, పూజ లేదా సందర్శన ప్లాన్ చేయండి, కావలసినవి ముందు రోజే కొనండి.',
  'Follow your family custom; health comes first.', 'కుటుంబ ఆచారం పాటించండి; ఆరోగ్యం ముందు.',
  'A traditional sweet like payasam to share.', 'పంచుకోవడానికి పాయసం వంటి సంప్రదాయ తీపి.',
);

export const festivalPlan = (id: string): FestivalPlan => FESTIVAL_PLANS[id] || GENERIC;
export const planText = (id: string, lang: AstroLang) => {
  const p = festivalPlan(id);
  const pick = (b: Bi) => (lang === 'Telugu' ? b.Telugu : b.English);
  return { prep: pick(p.prep), fast: pick(p.fast), food: pick(p.food) };
};

// Headings in all 12 languages
export interface PlanLabels {
  plan: string;
  prep: string;
  fast: string;
  food: string;
  yourColour: string;
}
export const PLAN_LABELS: Record<AstroLang, PlanLabels> = {
  English: { plan: 'Plan ahead', prep: 'Get ready', fast: 'Fasting', food: 'Food to make', yourColour: 'Your colour (as per your rashi)' },
  Telugu: { plan: 'ముందస్తు ప్రణాళిక', prep: 'సన్నాహాలు', fast: 'ఉపవాసం', food: 'చేయవలసిన వంటలు', yourColour: 'మీ రాశి ప్రకారం మీ రంగు' },
  Hindi: { plan: 'पहले से तैयारी', prep: 'तैयारी', fast: 'उपवास', food: 'क्या बनाएँ', yourColour: 'आपकी राशि के अनुसार आपका रंग' },
  Tamil: { plan: 'முன்கூட்டியே திட்டம்', prep: 'ஏற்பாடுகள்', fast: 'விரதம்', food: 'செய்ய வேண்டிய உணவு', yourColour: 'உங்கள் ராசிப்படி உங்கள் நிறம்' },
  Kannada: { plan: 'ಮುಂಚಿತ ಯೋಜನೆ', prep: 'ತಯಾರಿ', fast: 'ಉಪವಾಸ', food: 'ಮಾಡಬೇಕಾದ ಅಡುಗೆ', yourColour: 'ನಿಮ್ಮ ರಾಶಿಯ ಪ್ರಕಾರ ನಿಮ್ಮ ಬಣ್ಣ' },
  Malayalam: { plan: 'മുൻകൂട്ടി ഒരുക്കം', prep: 'തയ്യാറെടുപ്പ്', fast: 'വ്രതം', food: 'ഉണ്ടാക്കേണ്ട ഭക്ഷണം', yourColour: 'നിങ്ങളുടെ രാശി പ്രകാരം നിങ്ങളുടെ നിറം' },
  Marathi: { plan: 'आधीची तयारी', prep: 'तयारी', fast: 'उपवास', food: 'काय बनवावे', yourColour: 'तुमच्या राशीनुसार तुमचा रंग' },
  Bengali: { plan: 'আগাম পরিকল্পনা', prep: 'প্রস্তুতি', fast: 'উপবাস', food: 'কী রান্না করবেন', yourColour: 'আপনার রাশি অনুযায়ী আপনার রং' },
  Gujarati: { plan: 'અગાઉથી તૈયારી', prep: 'તૈયારી', fast: 'ઉપવાસ', food: 'શું બનાવવું', yourColour: 'તમારી રાશિ મુજબ તમારો રંગ' },
  Punjabi: { plan: 'ਪਹਿਲਾਂ ਤਿਆਰੀ', prep: 'ਤਿਆਰੀ', fast: 'ਵਰਤ', food: 'ਕੀ ਬਣਾਈਏ', yourColour: 'ਤੁਹਾਡੀ ਰਾਸ਼ੀ ਅਨੁਸਾਰ ਤੁਹਾਡਾ ਰੰਗ' },
  Odia: { plan: 'ଆଗୁଆ ଯୋଜନା', prep: 'ପ୍ରସ୍ତୁତି', fast: 'ଉପବାସ', food: 'କଣ ରାନ୍ଧିବେ', yourColour: 'ଆପଣଙ୍କ ରାଶି ଅନୁସାରେ ଆପଣଙ୍କ ରଙ୍ଗ' },
  Urdu: { plan: 'پیشگی تیاری', prep: 'تیاری', fast: 'روزہ / ورت', food: 'کیا پکائیں', yourColour: 'آپ کی راشی کے مطابق آپ کا رنگ' },
};

// Colours of each planet (rashi lord): RASHI_LORD indexes into PLANET order Sun..Ketu
const PLANET_COLOURS: { name: string; hex: string }[][] = [
  [{ name: 'Orange', hex: '#F57C00' }, { name: 'Gold', hex: '#D4A017' }], // Surya
  [{ name: 'White', hex: '#F5F5F5' }, { name: 'Silver', hex: '#C0C0C0' }], // Chandra
  [{ name: 'Red', hex: '#D32F2F' }, { name: 'Maroon', hex: '#800000' }], // Kuja
  [{ name: 'Green', hex: '#388E3C' }], // Budha
  [{ name: 'Yellow', hex: '#FBC02D' }, { name: 'Gold', hex: '#D4A017' }], // Guru
  [{ name: 'White', hex: '#F5F5F5' }, { name: 'Pink', hex: '#E91E63' }, { name: 'Cream', hex: '#FFFDD0' }], // Shukra
  [{ name: 'Blue', hex: '#1D4ED8' }, { name: 'Navy', hex: '#1F2A44' }, { name: 'Black', hex: '#212121' }], // Shani
];

// Dress colour for this festival and this user: a festival colour that is also the rashi lord's
// colour when there is one, else the festival's main colour with the lord's colour as an accent.
// null when the rashi is unknown (the card then shows only the festival colours).
export const festivalDressFor = (
  f: Festival,
  rashiIndex: number | null | undefined,
): { main: { name: string; hex: string }; accent: { name: string; hex: string } | null } | null => {
  if (rashiIndex == null || rashiIndex < 0 || rashiIndex > 11 || !f.colours.length) return null;
  const lordCols = PLANET_COLOURS[RASHI_LORD[rashiIndex]] || [];
  const same = f.colours.find(c => lordCols.some(l => l.name.toLowerCase() === c.name.toLowerCase()));
  if (same) return { main: same, accent: null };
  return { main: f.colours[0], accent: lordCols[0] || null };
};
