// Govt / Laws / Hospitals tabs labels, in Settings > App language (English by default, Telugu, Hindi).
import { AppLanguage } from './appLanguage';

export type CivicKey =
  | 'govtTitle'
  | 'lawsTitle'
  | 'hospTitle'
  | 'state'
  | 'district'
  | 'districtHint'
  | 'pickState'
  | 'loading'
  | 'noData'
  | 'pending'
  | 'aiOff'
  | 'updated'
  | 'overview'
  | 'departments'
  | 'schemes'
  | 'services'
  | 'helplines'
  | 'reviews'
  | 'yourReview'
  | 'writeReview'
  | 'submit'
  | 'report'
  | 'reported'
  | 'saved'
  | 'noReviews'
  | 'avg'
  | 'searchLaws'
  | 'allActs'
  | 'oldLaw'
  | 'punishment'
  | 'bail'
  | 'cognizable'
  | 'court'
  | 'timeLimit'
  | 'meaning'
  | 'examples'
  | 'source'
  | 'disclaimer'
  | 'whomToContact'
  | 'call'
  | 'results'
  | 'govtHosp'
  | 'privateHosp'
  | 'emergency'
  | 'emergencyLine'
  | 'askHospAi'
  | 'askHospHint'
  | 'ask'
  | 'hospAiNote'
  | 'verify'
  | 'error'
  | 'aiInfoNote'
  | 'leaders'
  | 'governor'
  | 'cm'
  | 'deputyCm'
  | 'ministers'
  | 'districtOfficials'
  | 'hq'
  | 'collector'
  | 'sp'
  | 'commissioner'
  | 'mps'
  | 'mlas'
  | 'offices'
  | 'stateScheme'
  | 'centralScheme'
  | 'eligibility'
  | 'benefit'
  | 'howApply'
  | 'grievance'
  | 'election'
  | 'lastAssembly'
  | 'lastLokSabha'
  | 'nextElection'
  | 'voterHelpline'
  | 'sources'
  | 'outdated'
  | 'collecting'
  | 'translating'
  | 'serverUpdate'
  | 'map'
  | 'schemesAccepted'
  | 'asOf'
  | 'party'
  | 'legalTitle'
  | 'aiTranslated'
  | 'open';

export const CIVIC_LABELS: Record<AppLanguage, Record<CivicKey, string>> = {
  English: {
    govtTitle: '🏛️ Govt',
    lawsTitle: '⚖️ Laws',
    hospTitle: '🏥 Hospitals',
    state: 'State',
    district: 'District',
    districtHint: 'District (optional, e.g. Hyderabad)',
    pickState: 'Pick your state',
    loading: 'Loading…',
    noData: 'No information yet for this place.',
    pending: 'We are collecting information for this place. Check back in a few hours.',
    aiOff: 'Information for this place is coming soon.',
    updated: 'Updated',
    overview: 'Overview',
    departments: 'Departments',
    schemes: 'Schemes',
    services: 'Citizen services',
    helplines: 'Helplines',
    reviews: 'People’s reviews',
    yourReview: 'Your review',
    writeReview: 'Share your experience (no abusive words, no phone numbers)',
    submit: 'Submit',
    report: 'Report',
    reported: 'Reported. Thank you.',
    saved: 'Saved',
    noReviews: 'No reviews yet. Be the first.',
    avg: 'Average',
    searchLaws: 'Search: word, section (318) or old IPC (420)',
    allActs: 'All',
    oldLaw: 'Old law',
    punishment: 'Punishment',
    bail: 'Bail',
    cognizable: 'Police can arrest without warrant',
    court: 'Court',
    timeLimit: 'Time limit to file',
    meaning: 'In simple words',
    examples: 'Examples',
    source: 'Official text',
    disclaimer: 'Not legal advice',
    whomToContact: 'Whom to contact',
    call: 'Call',
    results: 'results',
    govtHosp: 'Government',
    privateHosp: 'Private',
    emergency: 'Emergency',
    emergencyLine: 'Emergency? Call 108 (ambulance) or 112 now.',
    askHospAi: 'Hospital AI',
    askHospHint: 'Ask about these hospitals (e.g. which has 24x7 emergency?)',
    ask: 'Ask',
    hospAiNote: 'Answers only from the list above. It does not diagnose or give medical advice. Always verify with the hospital.',
    verify: 'Please verify with the hospital before you go.',
    error: 'Could not load. Pull down to try again.',
    aiInfoNote: 'Collected by AI from public sources. It may be out of date: check the official website.',
    leaders: 'State leaders',
    governor: 'Governor',
    cm: 'Chief Minister',
    deputyCm: 'Deputy Chief Minister',
    ministers: 'Ministers',
    districtOfficials: 'District officials & representatives',
    hq: 'District headquarters',
    collector: 'District Collector',
    sp: 'Superintendent of Police (SP)',
    commissioner: 'Commissioner of Police',
    mps: 'Members of Parliament (MP)',
    mlas: 'MLAs',
    offices: 'Government offices',
    stateScheme: 'State scheme',
    centralScheme: 'Central scheme',
    eligibility: 'Who can get it',
    benefit: 'Benefit',
    howApply: 'How to apply',
    grievance: 'Complaints & grievances',
    election: 'Elections',
    lastAssembly: 'Last Assembly election',
    lastLokSabha: 'Last Lok Sabha election',
    nextElection: 'Next elections',
    voterHelpline: 'Voter helpline',
    sources: 'Sources',
    outdated: 'Info may be outdated. Verify on the official site.',
    collecting: 'Collecting info for this place, check back in a few minutes.',
    translating: 'Translation is being prepared; English is shown for now.',
    serverUpdate: 'Server update pending. Pull down to try again later.',
    map: 'Map',
    schemesAccepted: 'Schemes accepted',
    asOf: 'As of',
    party: 'Party',
    legalTitle: 'Legal title',
    aiTranslated: 'Plain-language text is AI-written; the official legal text prevails.',
    open: 'Open',
  },
  Telugu: {
    govtTitle: '🏛️ ప్రభుత్వం',
    lawsTitle: '⚖️ చట్టాలు',
    hospTitle: '🏥 ఆసుపత్రులు',
    state: 'రాష్ట్రం',
    district: 'జిల్లా',
    districtHint: 'జిల్లా (ఐచ్ఛికం, ఉదా. హైదరాబాద్)',
    pickState: 'మీ రాష్ట్రాన్ని ఎంచుకోండి',
    loading: 'లోడ్ అవుతోంది…',
    noData: 'ఈ ప్రాంతానికి ఇంకా సమాచారం లేదు.',
    pending: 'ఈ ప్రాంతం సమాచారం సేకరిస్తున్నాం. కొన్ని గంటల తర్వాత చూడండి.',
    aiOff: 'ఈ ప్రాంతం సమాచారం త్వరలో వస్తుంది.',
    updated: 'నవీకరించబడింది',
    overview: 'సారాంశం',
    departments: 'శాఖలు',
    schemes: 'పథకాలు',
    services: 'పౌర సేవలు',
    helplines: 'హెల్ప్‌లైన్లు',
    reviews: 'ప్రజల అభిప్రాయాలు',
    yourReview: 'మీ అభిప్రాయం',
    writeReview: 'మీ అనుభవం రాయండి (తిట్లు, ఫోన్ నంబర్లు వద్దు)',
    submit: 'పంపండి',
    report: 'రిపోర్ట్',
    reported: 'రిపోర్ట్ చేశారు. ధన్యవాదాలు.',
    saved: 'సేవ్ అయింది',
    noReviews: 'ఇంకా అభిప్రాయాలు లేవు. మొదటివారు మీరే అవ్వండి.',
    avg: 'సగటు',
    searchLaws: 'వెతకండి: పదం, సెక్షన్ (318) లేదా పాత IPC (420)',
    allActs: 'అన్నీ',
    oldLaw: 'పాత చట్టం',
    punishment: 'శిక్ష',
    bail: 'బెయిల్',
    cognizable: 'వారెంట్ లేకుండా పోలీసులు అరెస్ట్ చేయవచ్చా',
    court: 'కోర్టు',
    timeLimit: 'ఫిర్యాదు గడువు',
    meaning: 'సులభంగా చెప్పాలంటే',
    examples: 'ఉదాహరణలు',
    source: 'అధికారిక పాఠం',
    disclaimer: 'ఇది న్యాయ సలహా కాదు',
    whomToContact: 'ఎవరిని సంప్రదించాలి',
    call: 'కాల్',
    results: 'ఫలితాలు',
    govtHosp: 'ప్రభుత్వ',
    privateHosp: 'ప్రైవేట్',
    emergency: 'అత్యవసరం',
    emergencyLine: 'అత్యవసరమా? వెంటనే 108 (అంబులెన్స్) లేదా 112 కి కాల్ చేయండి.',
    askHospAi: 'హాస్పిటల్ AI',
    askHospHint: 'ఈ ఆసుపత్రుల గురించి అడగండి (ఉదా. 24x7 ఎమర్జెన్సీ ఎక్కడ ఉంది?)',
    ask: 'అడగండి',
    hospAiNote: 'పై జాబితా నుండి మాత్రమే జవాబు. ఇది రోగ నిర్ధారణ లేదా వైద్య సలహా ఇవ్వదు. ఎప్పుడూ ఆసుపత్రితో నిర్ధారించుకోండి.',
    verify: 'వెళ్లే ముందు ఆసుపత్రితో నిర్ధారించుకోండి.',
    error: 'లోడ్ కాలేదు. మళ్లీ ప్రయత్నించడానికి కిందికి లాగండి.',
    aiInfoNote: 'పబ్లిక్ మూలాల నుండి AI సేకరించింది. పాతది కావచ్చు: అధికారిక వెబ్‌సైట్ చూడండి.',
    leaders: 'రాష్ట్ర నాయకులు',
    governor: 'గవర్నర్',
    cm: 'ముఖ్యమంత్రి',
    deputyCm: 'ఉప ముఖ్యమంత్రి',
    ministers: 'మంత్రులు',
    districtOfficials: 'జిల్లా అధికారులు, ప్రజాప్రతినిధులు',
    hq: 'జిల్లా కేంద్రం',
    collector: 'జిల్లా కలెక్టర్',
    sp: 'పోలీసు సూపరింటెండెంట్ (SP)',
    commissioner: 'పోలీసు కమిషనర్',
    mps: 'పార్లమెంటు సభ్యులు (MP)',
    mlas: 'శాసనసభ్యులు (MLA)',
    offices: 'ప్రభుత్వ కార్యాలయాలు',
    stateScheme: 'రాష్ట్ర పథకం',
    centralScheme: 'కేంద్ర పథకం',
    eligibility: 'ఎవరికి వర్తిస్తుంది',
    benefit: 'లాభం',
    howApply: 'ఎలా దరఖాస్తు చేయాలి',
    grievance: 'ఫిర్యాదులు',
    election: 'ఎన్నికలు',
    lastAssembly: 'గత అసెంబ్లీ ఎన్నికలు',
    lastLokSabha: 'గత లోక్‌సభ ఎన్నికలు',
    nextElection: 'తదుపరి ఎన్నికలు',
    voterHelpline: 'ఓటర్ హెల్ప్‌లైన్',
    sources: 'మూలాలు',
    outdated: 'సమాచారం పాతది కావచ్చు. అధికారిక సైట్‌లో నిర్ధారించుకోండి.',
    collecting: 'ఈ ప్రాంతం సమాచారం సేకరిస్తున్నాం, కొన్ని నిమిషాల్లో మళ్లీ చూడండి.',
    translating: 'తెలుగు అనువాదం సిద్ధమవుతోంది; ప్రస్తుతం ఇంగ్లీష్ చూపిస్తున్నాం.',
    serverUpdate: 'సర్వర్ అప్‌డేట్ పెండింగ్‌లో ఉంది. కాసేపటి తర్వాత కిందికి లాగి మళ్లీ ప్రయత్నించండి.',
    map: 'మ్యాప్',
    schemesAccepted: 'అంగీకరించే పథకాలు',
    asOf: 'నాటికి',
    party: 'పార్టీ',
    legalTitle: 'చట్టపరమైన శీర్షిక',
    aiTranslated: 'తెలుగు వివరణ AI రాసింది; అధికారిక చట్ట పాఠమే చెల్లుతుంది.',
    open: 'తెరవండి',
  },
  Hindi: {
    govtTitle: '🏛️ सरकार',
    lawsTitle: '⚖️ कानून',
    hospTitle: '🏥 अस्पताल',
    state: 'राज्य',
    district: 'ज़िला',
    districtHint: 'ज़िला (वैकल्पिक, जैसे हैदराबाद)',
    pickState: 'अपना राज्य चुनें',
    loading: 'लोड हो रहा है…',
    noData: 'इस जगह की जानकारी अभी नहीं है।',
    pending: 'इस जगह की जानकारी इकट्ठा हो रही है। कुछ घंटों बाद देखें।',
    aiOff: 'इस जगह की जानकारी जल्द आएगी।',
    updated: 'अपडेट',
    overview: 'सारांश',
    departments: 'विभाग',
    schemes: 'योजनाएँ',
    services: 'नागरिक सेवाएँ',
    helplines: 'हेल्पलाइन',
    reviews: 'लोगों की राय',
    yourReview: 'आपकी राय',
    writeReview: 'अपना अनुभव लिखें (गाली या फ़ोन नंबर नहीं)',
    submit: 'भेजें',
    report: 'रिपोर्ट',
    reported: 'रिपोर्ट हो गई। धन्यवाद।',
    saved: 'सेव हो गया',
    noReviews: 'अभी कोई राय नहीं। पहले आप लिखें।',
    avg: 'औसत',
    searchLaws: 'खोजें: शब्द, धारा (318) या पुरानी IPC (420)',
    allActs: 'सभी',
    oldLaw: 'पुराना कानून',
    punishment: 'सज़ा',
    bail: 'ज़मानत',
    cognizable: 'पुलिस बिना वारंट गिरफ़्तार कर सकती है?',
    court: 'अदालत',
    timeLimit: 'शिकायत की समय सीमा',
    meaning: 'आसान शब्दों में',
    examples: 'उदाहरण',
    source: 'आधिकारिक पाठ',
    disclaimer: 'यह कानूनी सलाह नहीं है',
    whomToContact: 'किससे संपर्क करें',
    call: 'कॉल',
    results: 'नतीजे',
    govtHosp: 'सरकारी',
    privateHosp: 'प्राइवेट',
    emergency: 'आपातकाल',
    emergencyLine: 'आपातकाल? अभी 108 (एम्बुलेंस) या 112 पर कॉल करें।',
    askHospAi: 'हॉस्पिटल AI',
    askHospHint: 'इन अस्पतालों के बारे में पूछें (जैसे 24x7 इमरजेंसी कहाँ है?)',
    ask: 'पूछें',
    hospAiNote: 'जवाब सिर्फ़ ऊपर की सूची से। यह बीमारी की पहचान या चिकित्सा सलाह नहीं देता। हमेशा अस्पताल से पुष्टि करें।',
    verify: 'जाने से पहले अस्पताल से पुष्टि करें।',
    error: 'लोड नहीं हुआ। दोबारा कोशिश के लिए नीचे खींचें।',
    aiInfoNote: 'AI ने सार्वजनिक स्रोतों से इकट्ठा किया। पुराना हो सकता है: आधिकारिक वेबसाइट देखें।',
    leaders: 'राज्य के नेता',
    governor: 'राज्यपाल',
    cm: 'मुख्यमंत्री',
    deputyCm: 'उपमुख्यमंत्री',
    ministers: 'मंत्री',
    districtOfficials: 'ज़िले के अधिकारी और जनप्रतिनिधि',
    hq: 'ज़िला मुख्यालय',
    collector: 'ज़िला कलेक्टर',
    sp: 'पुलिस अधीक्षक (SP)',
    commissioner: 'पुलिस आयुक्त',
    mps: 'सांसद (MP)',
    mlas: 'विधायक (MLA)',
    offices: 'सरकारी दफ़्तर',
    stateScheme: 'राज्य योजना',
    centralScheme: 'केंद्र योजना',
    eligibility: 'किसे मिलेगा',
    benefit: 'लाभ',
    howApply: 'आवेदन कैसे करें',
    grievance: 'शिकायत और समाधान',
    election: 'चुनाव',
    lastAssembly: 'पिछला विधानसभा चुनाव',
    lastLokSabha: 'पिछला लोकसभा चुनाव',
    nextElection: 'अगले चुनाव',
    voterHelpline: 'मतदाता हेल्पलाइन',
    sources: 'स्रोत',
    outdated: 'जानकारी पुरानी हो सकती है। आधिकारिक साइट पर जाँचें।',
    collecting: 'इस जगह की जानकारी इकट्ठा हो रही है, कुछ मिनट बाद देखें।',
    translating: 'हिंदी अनुवाद तैयार हो रहा है; अभी अंग्रेज़ी दिखा रहे हैं।',
    serverUpdate: 'सर्वर अपडेट बाकी है। थोड़ी देर बाद नीचे खींचकर दोबारा कोशिश करें।',
    map: 'नक्शा',
    schemesAccepted: 'स्वीकृत योजनाएँ',
    asOf: 'तक',
    party: 'पार्टी',
    legalTitle: 'कानूनी शीर्षक',
    aiTranslated: 'हिंदी विवरण AI ने लिखा है; आधिकारिक कानूनी पाठ ही मान्य है।',
    open: 'खोलें',
  },
};

export const civicText = (lang: AppLanguage, key: CivicKey): string =>
  (CIVIC_LABELS[lang] && CIVIC_LABELS[lang][key]) || CIVIC_LABELS.English[key];
