// Daily-reading prose (overview, mood, do / avoid, dress reasons, notes) per language.
// English and Telugu here, Odia and Urdu in astroProseOrUr.ts. Languages without their own prose
// yet use English text (labels and names are still in that language: astroLabels / astroNames).
import type { AstroLang } from './astroNames';
import { ODIA, URDU } from './astroProseOrUr';

export const PROSE_KEYS = [
  'greeting', 'greetingNoName', 'rashiLine', 'rashiStar', 'approx', 'approxStar', 'computed', 'nameStar', 'lucky',
  'luckyHora', 'luckyAbhijit', 'calm', 'dressTitle', 'whyVaara', 'whyRashi', 'whyStar', 'ideaF', 'ideaM', 'ideaO',
  'relTitleM', 'relHighM', 'relGoodM', 'relGentleM', 'outing', 'relTitleS', 'relHighS', 'relGoodS', 'relGentleS', 'generalOverview', 'generalMood', 'generalAvoid', 'needDob',
  'moreFail', 'disclaimer', 'next',
] as const;
export type ProseKey = (typeof PROSE_KEYS)[number];

export interface HouseText {
  overview: string[];
  mood: string;
  do: string[];
  avoid: string;
}
export interface AstroProse {
  t: Record<ProseKey, string>;
  benefit: string[]; // by weekday lord (Sun..Saturn)
  generalDo: string[][]; // by weekday lord
  house: HouseText[]; // Moon house 1..12 from the birth rashi
}

const ENGLISH: AstroProse = {
  t: {
    greeting: 'Good day, {name}! ✨',
    greetingNoName: 'Good day! ✨',
    rashiLine: 'Your moon sign: {rashi}',
    rashiStar: 'Your moon sign: {rashi} · Star: {star}',
    approx: 'Worked out from your date of birth (noon, Hyderabad). Add your time of birth in your profile for a more exact moon sign.',
    approxStar: 'Your birth star is approximate. Add your time of birth in your profile for a more exact reading.',
    computed: 'Moon sign worked out from your birth details (Lahiri, {place}).',
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
    relTitleM: 'Family & home 🏡',
    relHighM: 'Bright ✨ The Moon favours harmony at home today. A lovely day for quality time with your spouse and family: share a meal and plan something together.',
    relGoodM: 'Good 🙂 A warm, steady day for the family. A kind word and a little shared time keep home life happy.',
    relGentleM: 'Gentle 🌱 A quiet day at home: listen patiently, keep plans simple and enjoy small moments with your family.',
    outing: 'Good day to plan a family outing: {date}',
    relTitleS: 'Heart & connections 💫',
    relHighS: 'Bright ✨ A warm day for friendships and kind conversations. Be yourself; your good nature shines.',
    relGoodS: 'Good 🙂 An easy day to stay in touch with friends and family. Keep it light and respectful.',
    relGentleS: 'Gentle 🌱 A calm day for the heart: rest, reflect and enjoy your own company. Good things come in time.',
    nameStar: 'No date of birth yet, so your name star comes from the first sound of your name. Add your date of birth for your real birth star.',
    generalOverview: 'Today is {day}, ruled by {planet}. A positive mind turns every task into a win.',
    generalMood: 'Stay calm and hopeful.',
    generalAvoid: 'Needless arguments',
    needDob: "Add your date of birth (and time and place of birth, if you know them) so I can read your moon sign and star. Today's panchang and lucky colours are below.",
    moreFail: 'More details are not available right now. Your reading above is complete for today.',
    disclaimer: 'Traditional guidance for a positive day (Lahiri, Hyderabad sunrise). Your choices shape your day!',
    next: 'Next festival: {name} · {date} ({n} days)',
  },
  benefit: ['confidence and energy', 'calm and a clear mind', 'courage and strength', 'sharp thinking and growth', 'wisdom and good luck', 'beauty, grace and harmony', 'steadiness and protection'],
  generalDo: [
    ['Step out in the morning sun', 'Lead with confidence'], ['Keep your mind calm', 'Call a loved one'],
    ['Do the brave task first', 'Exercise a little'], ['Learn something new', 'Write down your ideas'],
    ['Respect elders and teachers', 'Share what you know'], ['Dress up and compliment someone', 'Enjoy music or art'],
    ['Finish pending work', 'Help someone who works hard'],
  ],
  house: [
    { overview: ['The Moon is in your own sign today: you feel like yourself, fresh and confident.', 'A "you" day: your presence is noticed and your ideas get a fair hearing.'], mood: 'Confident and self-aware. Smile first; people respond warmly.', do: ['Start something you care about', 'Take care of your looks and health'], avoid: 'Taking on everyone else\'s work; your own goals come first today' },
    { overview: ['Family and money matters go smoothly with a calm, kind word.', 'Today favours saving, planning and sweet talk at home.'], mood: 'Warm and grounded. Speak gently and your words carry weight.', do: ['Plan your budget or a small saving', 'Eat a good home meal with family'], avoid: 'Impulse shopping; sleep on big purchases' },
    { overview: ['Courage is high today: messages, calls and short trips go your way.', 'A brave, energetic day; the first step is the hardest and you have the strength for it.'], mood: 'Bold and chatty. Your energy lifts others.', do: ['Send that message or make that call', 'Try a new skill or a workout'], avoid: 'Rushing; double-check before you hit send' },
    { overview: ['A cosy, heart-centred day: home and comfort bring peace.', 'Today rewards slowing down and making your space beautiful.'], mood: 'Soft and emotional in a good way. Be kind to yourself.', do: ['Tidy your room or wardrobe', 'Call an elder or a loved one'], avoid: 'Overthinking small things; let them go' },
    { overview: ['Creativity and joy glow today; your ideas sparkle.', 'A playful, lucky day for studies, art and heartfelt moments.'], mood: 'Cheerful and creative. Your smile is your best accessory.', do: ['Make or create something', 'Spend time on a hobby you love'], avoid: 'Risky bets; enjoy fun that is safe' },
    { overview: ['You can beat any obstacle today: work, health and routine improve.', 'A strong day to fix problems and finish pending tasks.'], mood: 'Focused and determined. Small wins add up.', do: ['Clear a pending task early', 'Drink water and take a short walk'], avoid: 'Arguments; let results speak for you' },
    { overview: ['Partnerships shine today: friends, colleagues and teamwork bring joy.', 'A social day; good company opens good doors.'], mood: 'Friendly and charming. People enjoy your company.', do: ['Meet a friend or a colleague', 'Work together on something'], avoid: 'Being stubborn; meet others halfway' },
    { overview: ['A quiet, reflective day: rest and inner strength recharge you.', 'Go easy today; calm choices protect your energy and bring insight.'], mood: 'Thoughtful and private. Gentle routines feel best.', do: ['Meditate or pray for a few minutes', 'Finish things slowly and carefully'], avoid: 'Big risks or new loans today; plan instead' },
    { overview: ['Luck and blessings are with you today; elders and teachers help.', 'A fortunate day for learning, prayer and kind deeds.'], mood: 'Hopeful and generous. Gratitude multiplies your luck.', do: ['Visit a temple or do something kind', 'Learn from someone wiser'], avoid: 'Ignoring good advice; listen today' },
    { overview: ['Career and reputation rise today; your effort is seen.', 'A productive, responsible day; leaders notice your work.'], mood: 'Ambitious and steady. Dress sharp; it shows.', do: ['Take the lead on a task', 'Update your CV or plan your next goal'], avoid: 'Delaying important work; start early' },
    { overview: ['Gains and friends come together today; wishes move closer.', 'One of the best days: help comes from friends and good news arrives.'], mood: 'Happy and social. Share your plans; support follows.', do: ['Reach out to your circle', 'Ask for what you want, politely'], avoid: 'Comparing yourself with others; your path is your own' },
    { overview: ['A peaceful, spiritual day; rest and giving bring calm.', 'Slow down today and recharge; quiet time brings fresh ideas.'], mood: 'Calm and dreamy. Early sleep will feel wonderful.', do: ['Donate or help someone quietly', 'Get good sleep and rest your eyes'], avoid: 'Late nights and overspending' },
  ],
};

const TELUGU: AstroProse = {
  t: {
    greeting: 'శుభదినం, {name}! ✨',
    greetingNoName: 'శుభదినం! ✨',
    rashiLine: 'మీ రాశి: {rashi}',
    rashiStar: 'మీ రాశి: {rashi} · నక్షత్రం: {star}',
    approx: 'మీ పుట్టిన తేదీ నుంచి లెక్కించాం (మధ్యాహ్నం, హైదరాబాద్). ఖచ్చితమైన రాశి కోసం Edit profileలో పుట్టిన సమయం చేర్చండి.',
    approxStar: 'మీ జన్మ నక్షత్రం సుమారుగా లెక్కించాం. ఖచ్చితమైన ఫలితం కోసం Edit profileలో పుట్టిన సమయం చేర్చండి.',
    computed: 'మీ పుట్టిన వివరాల నుంచి రాశి లెక్కించాం (లాహిరి, {place}).',
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
    relTitleM: 'కుటుంబం & ఇల్లు 🏡',
    relHighM: 'శుభం ✨ ఈ రోజు చంద్రుడు ఇంట్లో సామరస్యానికి అనుకూలం. జీవిత భాగస్వామి, కుటుంబంతో ఆనందంగా గడపడానికి మంచి రోజు: కలిసి భోజనం చేసి, ఏదైనా కలిసి ప్లాన్ చేయండి.',
    relGoodM: 'మంచిది 🙂 కుటుంబానికి ఆప్యాయమైన, స్థిరమైన రోజు. ఒక మంచి మాట, కొంచెం కలిసి గడిపే సమయం ఇంటిని సంతోషంగా ఉంచుతాయి.',
    relGentleM: 'నెమ్మదిగా 🌱 ఇంట్లో ప్రశాంతమైన రోజు: ఓపికగా వినండి, ప్లాన్లు సింపుల్‌గా ఉంచండి, కుటుంబంతో చిన్న చిన్న క్షణాలు ఆస్వాదించండి.',
    outing: 'కుటుంబంతో విహారానికి ప్లాన్ చేయడానికి మంచి రోజు: {date}',
    relTitleS: 'మనసు & అనుబంధాలు 💫',
    relHighS: 'శుభం ✨ స్నేహాలకు, మంచి మాటలకు ఆప్యాయమైన రోజు. మీలాగే ఉండండి; మీ మంచితనం వెలుగుతుంది.',
    relGoodS: 'మంచిది 🙂 స్నేహితులతో, కుటుంబంతో మాట్లాడుకోవడానికి సులువైన రోజు. సరదాగా, మర్యాదగా ఉండండి.',
    relGentleS: 'నెమ్మదిగా 🌱 మనసుకు ప్రశాంతమైన రోజు: విశ్రాంతి తీసుకోండి, ఆలోచించండి, మీ సమయాన్ని మీరే ఆస్వాదించండి. మంచి రోజులు తప్పక వస్తాయి.',
    nameStar: 'పుట్టిన తేదీ లేనందున మీ పేరులోని మొదటి అక్షరం నుంచి నామ నక్షత్రం తీసుకున్నాం. అసలు జన్మ నక్షత్రం కోసం పుట్టిన తేదీ చేర్చండి.',
    generalOverview: 'ఈ రోజు {day}, అధిపతి {planet}. సానుకూలంగా ఆలోచిస్తే ప్రతి పనీ కలిసొస్తుంది.',
    generalMood: 'ప్రశాంతంగా, ఆశాభావంతో ఉండండి.',
    generalAvoid: 'అనవసరమైన వాదనలు',
    needDob: 'మీ రాశి, నక్షత్రం తెలుసుకోవడానికి పుట్టిన తేదీ (తెలిస్తే పుట్టిన సమయం, స్థలం కూడా) చేర్చండి. నేటి పంచాంగం, అదృష్ట రంగులు కింద ఉన్నాయి.',
    moreFail: 'మరిన్ని వివరాలు ఇప్పుడు అందుబాటులో లేవు. పైన ఉన్న ఫలితం ఈ రోజుకి పూర్తి.',
    disclaimer: 'సానుకూలమైన రోజు కోసం సంప్రదాయ సూచనలు (లాహిరి, హైదరాబాద్ సూర్యోదయం). మీ నిర్ణయాలే మీ రోజును తీర్చిదిద్దుతాయి!',
    next: 'తదుపరి పండుగ: {name} · {date} ({n} రోజులు)',
  },
  benefit: ['ఆత్మవిశ్వాసం, శక్తి', 'ప్రశాంతత, స్పష్టమైన మనసు', 'ధైర్యం, బలం', 'చురుకైన ఆలోచన, ఎదుగుదల', 'జ్ఞానం, అదృష్టం', 'అందం, సౌమ్యత, సామరస్యం', 'స్థిరత్వం, రక్షణ'],
  generalDo: [
    ['ఉదయం ఎండలో కాసేపు నడవండి', 'ఆత్మవిశ్వాసంతో ముందడుగు వేయండి'], ['మనసు ప్రశాంతంగా ఉంచుకోండి', 'ఆత్మీయులకు ఫోన్ చేయండి'],
    ['ధైర్యం కావలసిన పని ముందు చేయండి', 'కొంచెం వ్యాయామం చేయండి'], ['ఏదైనా కొత్తది నేర్చుకోండి', 'మీ ఆలోచనలు రాసుకోండి'],
    ['పెద్దలను, గురువులను గౌరవించండి', 'మీకు తెలిసింది పంచుకోండి'], ['చక్కగా తయారై ఎవరినైనా మెచ్చుకోండి', 'సంగీతం లేదా కళను ఆస్వాదించండి'],
    ['పెండింగ్ పనులు పూర్తి చేయండి', 'కష్టపడే వారికి సహాయం చేయండి'],
  ],
  house: [
    { overview: ['ఈ రోజు చంద్రుడు మీ రాశిలోనే ఉన్నాడు: మీరు ఉత్సాహంగా, ఆత్మవిశ్వాసంతో ఉంటారు.', 'ఇది "మీ" రోజు: మీ మాటకు, మీ ఆలోచనలకు విలువ పెరుగుతుంది.'], mood: 'ఆత్మవిశ్వాసంతో ఉంటారు. ముందుగా చిరునవ్వు చిందిస్తే అందరూ ఆప్యాయంగా స్పందిస్తారు.', do: ['మీకు ఇష్టమైన పని మొదలుపెట్టండి', 'మీ ఆరోగ్యం, అందం మీద శ్రద్ధ పెట్టండి'], avoid: 'అందరి పనులూ మీ మీద వేసుకోవడం; ఈ రోజు మీ లక్ష్యాలకే ప్రాధాన్యం' },
    { overview: ['మృదువైన మాటతో కుటుంబ, ధన విషయాలు సాఫీగా సాగుతాయి.', 'పొదుపు, ప్రణాళిక, ఇంట్లో మధురమైన మాటలకు ఈ రోజు అనుకూలం.'], mood: 'ప్రశాంతంగా, ఆప్యాయంగా ఉంటారు. మీ మాటకు బరువు ఉంటుంది.', do: ['బడ్జెట్ లేదా చిన్న పొదుపు ప్లాన్ చేయండి', 'కుటుంబంతో కలిసి ఇంటి భోజనం చేయండి'], avoid: 'ఆవేశంలో షాపింగ్; పెద్ద కొనుగోళ్లు ఒక రోజు ఆలోచించి చేయండి' },
    { overview: ['ఈ రోజు ధైర్యం ఎక్కువ: మెసేజ్‌లు, ఫోన్లు, చిన్న ప్రయాణాలు కలిసొస్తాయి.', 'ధైర్యమైన, ఉత్సాహమైన రోజు; మొదటి అడుగు వేసే శక్తి మీకుంది.'], mood: 'ధైర్యంగా, చురుకుగా ఉంటారు. మీ ఉత్సాహం ఇతరులకూ స్ఫూర్తి.', do: ['ఆ మెసేజ్ పంపండి లేదా ఆ ఫోన్ చేయండి', 'కొత్త నైపుణ్యం లేదా వ్యాయామం ప్రయత్నించండి'], avoid: 'తొందరపాటు; పంపే ముందు ఒకసారి చూసుకోండి' },
    { overview: ['హాయిగా, మనసుకు దగ్గరగా ఉండే రోజు: ఇల్లు, సౌకర్యం ప్రశాంతతనిస్తాయి.', 'నెమ్మదిగా సాగుతూ మీ చుట్టూ అందంగా తీర్చిదిద్దుకుంటే మంచిది.'], mood: 'మృదువుగా, భావోద్వేగంగా ఉంటారు. మీ మీద మీరు దయగా ఉండండి.', do: ['మీ గది లేదా వార్డ్‌రోబ్ సర్దుకోండి', 'పెద్దవారికో ఆత్మీయులకో ఫోన్ చేయండి'], avoid: 'చిన్న విషయాలు ఎక్కువగా ఆలోచించడం; వదిలేయండి' },
    { overview: ['సృజనాత్మకత, ఆనందం ఈ రోజు వెలుగుతాయి; మీ ఆలోచనలు మెరుస్తాయి.', 'చదువు, కళలు, మనసుకు నచ్చిన క్షణాలకు అదృష్టమైన, సరదా రోజు.'], mood: 'ఉల్లాసంగా ఉంటారు. మీ చిరునవ్వే మీ అందమైన ఆభరణం.', do: ['ఏదైనా కొత్తగా తయారుచేయండి', 'మీకు ఇష్టమైన హాబీకి సమయం ఇవ్వండి'], avoid: 'రిస్క్ ఉన్న పందాలు; సురక్షితమైన సరదాలు ఆనందించండి' },
    { overview: ['ఈ రోజు ఏ అడ్డంకినైనా దాటగలరు: పని, ఆరోగ్యం, దినచర్య మెరుగవుతాయి.', 'సమస్యలు పరిష్కరించి, పెండింగ్ పనులు పూర్తి చేయడానికి బలమైన రోజు.'], mood: 'ఏకాగ్రతతో, పట్టుదలతో ఉంటారు. చిన్న విజయాలే పెద్దవవుతాయి.', do: ['పెండింగ్ పని ఉదయమే పూర్తి చేయండి', 'నీళ్లు తాగుతూ కాసేపు నడవండి'], avoid: 'వాదనలు; మీ ఫలితాలే మాట్లాడతాయి' },
    { overview: ['భాగస్వామ్యాలు మెరుస్తాయి: స్నేహితులు, సహోద్యోగులు, టీమ్‌వర్క్ ఆనందాన్నిస్తాయి.', 'సామాజికమైన రోజు; మంచి సాంగత్యం మంచి అవకాశాలు తెస్తుంది.'], mood: 'స్నేహపూర్వకంగా, ఆకర్షణీయంగా ఉంటారు. అందరూ మీ సాంగత్యం ఇష్టపడతారు.', do: ['స్నేహితుడిని లేదా సహోద్యోగిని కలవండి', 'కలిసి ఏదైనా పని చేయండి'], avoid: 'మొండితనం; సగం దూరం మీరూ వెళ్లండి' },
    { overview: ['నిశ్శబ్దంగా ఆలోచించే రోజు: విశ్రాంతి, అంతర్గత శక్తి మిమ్మల్ని రీఛార్జ్ చేస్తాయి.', 'ఈ రోజు నెమ్మదిగా సాగండి; ప్రశాంత నిర్ణయాలు మీ శక్తిని కాపాడతాయి.'], mood: 'ఆలోచనాత్మకంగా ఉంటారు. సున్నితమైన దినచర్య బాగుంటుంది.', do: ['కొన్ని నిమిషాలు ధ్యానం లేదా ప్రార్థన చేయండి', 'పనులు నెమ్మదిగా, జాగ్రత్తగా పూర్తి చేయండి'], avoid: 'పెద్ద రిస్క్‌లు, కొత్త అప్పులు; ఈ రోజు ప్లాన్ చేయండి చాలు' },
    { overview: ['అదృష్టం, ఆశీస్సులు మీతోనే; పెద్దలు, గురువులు సహాయం చేస్తారు.', 'చదువు, ప్రార్థన, మంచి పనులకు అదృష్టమైన రోజు.'], mood: 'ఆశాభావంతో, ఉదారంగా ఉంటారు. కృతజ్ఞత మీ అదృష్టాన్ని పెంచుతుంది.', do: ['గుడికి వెళ్లండి లేదా ఒక మంచి పని చేయండి', 'అనుభవజ్ఞుల నుంచి నేర్చుకోండి'], avoid: 'మంచి సలహాను పట్టించుకోకపోవడం; ఈ రోజు వినండి' },
    { overview: ['ఉద్యోగం, పేరు ప్రతిష్ఠలు పెరుగుతాయి; మీ కృషి కనిపిస్తుంది.', 'బాధ్యతాయుతమైన, ఫలవంతమైన రోజు; పెద్దలు మీ పని గమనిస్తారు.'], mood: 'లక్ష్యంతో, స్థిరంగా ఉంటారు. చక్కగా డ్రెస్ చేసుకోండి; అది కనిపిస్తుంది.', do: ['ఒక పనిలో ముందుండి నడిపించండి', 'మీ CV అప్‌డేట్ చేయండి లేదా తదుపరి లక్ష్యం ప్లాన్ చేయండి'], avoid: 'ముఖ్యమైన పనులు వాయిదా వేయడం; ఉదయమే మొదలుపెట్టండి' },
    { overview: ['లాభాలు, స్నేహితులు కలిసి వస్తారు; కోరికలు దగ్గరవుతాయి.', 'చాలా మంచి రోజు: స్నేహితుల సహాయం, శుభవార్తలు అందుతాయి.'], mood: 'సంతోషంగా ఉంటారు. మీ ప్లాన్లు పంచుకుంటే మద్దతు దొరుకుతుంది.', do: ['మీ సర్కిల్‌తో మాట్లాడండి', 'మీకు కావలసింది మర్యాదగా అడగండి'], avoid: 'ఇతరులతో పోల్చుకోవడం; మీ దారి మీదే' },
    { overview: ['ప్రశాంతమైన, ఆధ్యాత్మిక రోజు; విశ్రాంతి, దానం మనశ్శాంతినిస్తాయి.', 'నెమ్మదించి రీఛార్జ్ అవ్వండి; నిశ్శబ్ద సమయం కొత్త ఆలోచనలు తెస్తుంది.'], mood: 'ప్రశాంతంగా, కలల్లో తేలుతున్నట్టు ఉంటారు. త్వరగా నిద్రపోతే హాయిగా ఉంటుంది.', do: ['మౌనంగా ఎవరికైనా సహాయం లేదా దానం చేయండి', 'బాగా నిద్రపోండి, కళ్లకు విశ్రాంతి ఇవ్వండి'], avoid: 'అర్ధరాత్రి వరకు మేల్కోవడం, అధిక ఖర్చు' },
  ],
};

export const PROSE: Partial<Record<AstroLang, AstroProse>> = { English: ENGLISH, Telugu: TELUGU, Odia: ODIA, Urdu: URDU };
export const hasOwnProse = (lang: AstroLang) => !!PROSE[lang];
export const proseFor = (lang: AstroLang): AstroProse => PROSE[lang] || ENGLISH;
