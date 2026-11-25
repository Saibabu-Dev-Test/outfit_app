// Govt / Laws / Hospitals tabs labels, in Settings > App language. Static copies in English, Telugu and
// Hindi; the other app languages (Tamil, Kannada, ...) use an AI translation of the English labels,
// cached on the Worker (POST /v1/civic/translate) and on the phone (services/civicI18n.ts), and show
// English until it arrives.
import { AppLanguage, StaticLanguage } from './appLanguage';

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
  | 'open'
  | 'compareTitle'
  | 'compareNote'
  | 'compareShow'
  | 'centre'
  | 'previousGovt'
  | 'presentGovt'
  | 'areaBudget'
  | 'areaProjects'
  | 'areaStarted'
  | 'areaStopped'
  | 'notListed'
  | 'prmTitle'
  | 'prmNote'
  | 'prmShow'
  | 'prmManifesto'
  | 'prmTotal'
  | 'prmDone'
  | 'prmInProgress'
  | 'prmNotDone'
  | 'prmNoUpdate'
  | 'prmAll'
  | 'prmNoData'
  | 'prmHead'
  | 'prmNoneInFilter'
  | 'prmNotLive'
  | 'prmNoDataYet'
  | 'date'
  | 'allHosp'
  | 'publicNA'
  | 'timings'
  | 'emergency24'
  | 'specialities'
  | 'specialFor'
  | 'doctors'
  | 'experience'
  | 'facilities'
  | 'whereToGo'
  | 'whereHint'
  | 'matches'
  | 'noMatch'
  | 'sortFacts'
  | 'factsNote'
  | 'offenceGuide'
  | 'allSections'
  | 'searchOffence'
  | 'bnsNote'
  | 'jail'
  | 'fine'
  | 'bailable'
  | 'nonBailable'
  | 'dependsMain'
  | 'cogYes'
  | 'cogNo'
  | 'cogCond'
  | 'howToComplain'
  | 'cases'
  | 'officialText'
  | 'translationNote'
  | 'address'
  | 'phone'
  | 'englishToggle'
  | 'aiBusy'
  | 'aiQuota'
  | 'aiLimit'
  | 'askLaws'
  | 'askLawsHint'
  | 'lawsAiNote'
  | 'explainSimply'
  | 'showingSaved'
  | 'researchPaused'
  | 'langPicker'
  | 'alsoEnglish'
  | 'typeGovt'
  | 'typePrivate'
  | 'typeNotListed'
  | 'districtSite'
  | 'trLater'
  | 'sourceOne'
  | 'bestInIndia'
  | 'nirfRank'
  | 'nirfNote'
  | 'specialistInst'
  | 'seeSpecialities'
  | 'diseaseEmergency'
  | 'notDiagnosis'
  | 'didYouMean'
  | 'govtRates'
  | 'govtRatesNote'
  | 'cityTiers'
  | 'mayTreatTitle'
  | 'mayTreat'
  | 'typePrivateLikely';

export const CIVIC_LABELS: Record<StaticLanguage, Record<CivicKey, string>> = {
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
    compareTitle: 'Previous vs present government',
    compareNote: 'Facts only, side by side. Every point shows its source and date. No verdict or opinion: read and decide yourself.',
    compareShow: 'Show comparison',
    centre: 'Centre (India)',
    previousGovt: 'Previous government',
    presentGovt: 'Present government',
    areaBudget: 'Budget',
    areaProjects: 'Major projects',
    areaStarted: 'Schemes started',
    areaStopped: 'Schemes stopped / merged / renamed',
    notListed: 'No matching item with a public source',
    prmTitle: 'Promises: what was promised, done, pending',
    prmNote: 'Status is taken only from public sources (government orders, budgets, official sites, news of official figures), each with its date. No source = "No update". No verdict or opinion.',
    prmShow: 'Show promises',
    prmManifesto: 'Manifesto',
    prmTotal: 'Total',
    prmDone: 'Done',
    prmInProgress: 'In progress',
    prmNotDone: 'Not done',
    prmNoUpdate: 'No update',
    prmAll: 'All',
    prmNoData: 'No researched promises yet for this government. Researching from public sources, check back in a few minutes.',
    prmHead: 'Head of government',
    prmNoneInFilter: 'No promise with this status.',
    prmNotLive: 'Promises feature is not live on the server yet. No data yet: it will show here once the server is updated.',
    prmNoDataYet: 'No data yet for this government. Pull down to try again later.',
    date: 'Date',
    allHosp: 'All',
    publicNA: 'Public info not available',
    timings: 'Timings',
    emergency24: '24x7 emergency',
    specialities: 'Specialities',
    specialFor: 'Known for (as stated in public sources)',
    doctors: 'Specialist doctors (publicly listed)',
    experience: 'Experience',
    facilities: 'Facilities',
    whereToGo: 'Where to go for…',
    whereHint: 'Disease or speciality, e.g. heart, kidney, cancer, eye, delivery',
    matches: 'Matches',
    noMatch: 'No hospital in this list states this in public sources. Try another word.',
    sortFacts: 'Most specialities + facilities first',
    factsNote: 'Only a count of specialities and facilities listed in public sources. Not a rating or opinion.',
    offenceGuide: 'Offence guide (BNS 2023)',
    allSections: 'All sections',
    searchOffence: 'Search an offence: theft, cheating, 318, IPC 420…',
    bnsNote: 'The Bharatiya Nyaya Sanhita (BNS), 2023 replaced the IPC from 1 July 2024. Police and court procedure: Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023.',
    jail: 'Jail',
    fine: 'Fine',
    bailable: 'Bailable: bail is a right',
    nonBailable: 'Non-bailable: the court decides bail',
    dependsMain: 'Depends on the main offence',
    cogYes: 'Cognizable: police must register an FIR and can arrest without warrant',
    cogNo: 'Non-cognizable: police need a Magistrate\'s order to investigate',
    cogCond: 'Cognizable only in the case the law states (see the official text)',
    howToComplain: 'How to file a police complaint',
    cases: 'Cases in the law',
    officialText: 'Official text',
    translationNote: 'Telugu / Hindi lines are translations to help you; the official English text of the law prevails.',
    address: 'Address',
    phone: 'Phone',
    englishToggle: 'English',
    aiBusy: 'AI is busy right now (free limit). Saved info is shown; please try again in a few minutes.',
    aiQuota: 'AI is paused for today (free AI limit used up). Saved info still works.',
    aiLimit: "You've used today's AI questions. Please come back tomorrow.",
    askLaws: 'Ask about laws',
    askLawsHint: 'e.g. Someone cheated me online. Which law applies?',
    lawsAiNote: 'Answers only from the law sections in this app, in simple words. Not legal advice.',
    explainSimply: 'Explain simply',
    showingSaved: 'Showing saved info · updating…',
    researchPaused: 'Research paused (free AI limit used up), showing saved info.',
    langPicker: 'Language',
    alsoEnglish: 'Also show English',
    typeGovt: 'Govt',
    typePrivate: 'Private',
    typeNotListed: 'Type not listed',
    districtSite: 'District website',
    trLater: 'Translation is on the way; showing English for now.',
    sourceOne: 'Source',
    bestInIndia: 'Best in India for',
    nirfRank: 'NIRF rank',
    nirfNote: 'NIRF rank (teaching + research ranking, not a treatment-quality rating)',
    specialistInst: 'Specialist institute',
    seeSpecialities: 'Departments to see',
    diseaseEmergency: 'This can be an emergency. Call 108 or 112 now, or go to the nearest emergency department.',
    notDiagnosis: 'A guide to which department to visit, not a diagnosis. Please see a doctor.',
    didYouMean: 'Showing results for',
    govtRates: 'Govt package rates (what PM-JAY / CGHS pay a hospital)',
    govtRatesNote: "Official scheme rates for comparing a private hospital's quote. Not what every hospital charges; implants, medicines and room upgrades can be extra. Confirm with the hospital.",
    cityTiers: 'X = Tier 1 city, Y = Tier 2, Z = Tier 3. CGHS shown for NABH hospitals, semi-private ward.',
    mayTreatTitle: 'No hospital in this list states this in public sources. General / multi-speciality government hospitals that may treat this',
    mayTreat: 'May treat this — call to confirm (no public source states it)',
    typePrivateLikely: 'Likely private · ownership not confirmed',
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
    compareTitle: 'గత ప్రభుత్వం vs ప్రస్తుత ప్రభుత్వం',
    compareNote: 'కేవలం వాస్తవాలు, పక్కపక్కనే. ప్రతి అంశానికి మూలం, తేదీ చూపిస్తాం. ఏది మంచిదో తీర్పు లేదా అభిప్రాయం లేదు: చదివి మీరే నిర్ణయించుకోండి.',
    compareShow: 'పోలిక చూపించు',
    centre: 'కేంద్రం (భారత్)',
    previousGovt: 'గత ప్రభుత్వం',
    presentGovt: 'ప్రస్తుత ప్రభుత్వం',
    areaBudget: 'బడ్జెట్',
    areaProjects: 'ప్రధాన ప్రాజెక్టులు',
    areaStarted: 'ప్రారంభించిన పథకాలు',
    areaStopped: 'నిలిపివేసిన / విలీనం / పేరు మార్చిన పథకాలు',
    notListed: 'పబ్లిక్ మూలంతో సరిపోలే అంశం లేదు',
    prmTitle: 'హామీలు: ఏమి హామీ ఇచ్చారు, ఏమి చేశారు, ఏమి పెండింగ్',
    prmNote: 'స్థితి కేవలం పబ్లిక్ మూలాల నుండి (ప్రభుత్వ ఉత్తర్వులు, బడ్జెట్, అధికారిక సైట్లు, అధికారిక గణాంకాల వార్తలు), ప్రతిదానికి తేదీతో. మూలం లేకపోతే "అప్\u200cడేట్ లేదు". తీర్పు లేదా అభిప్రాయం లేదు.',
    prmShow: 'హామీలు చూపించు',
    prmManifesto: 'మేనిఫెస్టో',
    prmTotal: 'మొత్తం',
    prmDone: 'పూర్తయింది',
    prmInProgress: 'జరుగుతోంది',
    prmNotDone: 'చేయలేదు',
    prmNoUpdate: 'అప్\u200cడేట్ లేదు',
    prmAll: 'అన్నీ',
    prmNoData: 'ఈ ప్రభుత్వానికి ఇంకా పరిశోధించిన హామీలు లేవు. పబ్లిక్ మూలాల నుండి సేకరిస్తున్నాం, కొన్ని నిమిషాల తర్వాత చూడండి.',
    prmHead: 'ప్రభుత్వ అధిపతి',
    prmNoneInFilter: 'ఈ స్థితితో హామీ లేదు.',
    prmNotLive: 'హామీల ఫీచర్ ఇంకా సర్వర్‌లో అందుబాటులోకి రాలేదు. ఇంకా డేటా లేదు: సర్వర్ అప్‌డేట్ అయిన తర్వాత ఇక్కడ కనిపిస్తుంది.',
    prmNoDataYet: 'ఈ ప్రభుత్వానికి ఇంకా డేటా లేదు. కాసేపటి తర్వాత కిందికి లాగి మళ్లీ ప్రయత్నించండి.',
    date: 'తేదీ',
    allHosp: 'అన్నీ',
    publicNA: 'పబ్లిక్ సమాచారం అందుబాటులో లేదు',
    timings: 'సమయాలు',
    emergency24: '24x7 అత్యవసర సేవ',
    specialities: 'స్పెషాలిటీలు',
    specialFor: 'దీనికి ప్రత్యేకం (పబ్లిక్ మూలాల ప్రకారం)',
    doctors: 'స్పెషలిస్ట్ డాక్టర్లు (పబ్లిక్‌గా ప్రకటించినవారు)',
    experience: 'అనుభవం',
    facilities: 'సౌకర్యాలు',
    whereToGo: 'ఈ సమస్యకు ఎక్కడికి వెళ్లాలి…',
    whereHint: 'వ్యాధి లేదా స్పెషాలిటీ, ఉదా. గుండె, కిడ్నీ, క్యాన్సర్, కన్ను, ప్రసవం',
    matches: 'సరిపోలింది',
    noMatch: 'ఈ జాబితాలో ఏ ఆసుపత్రి పబ్లిక్ మూలాల్లో దీన్ని పేర్కొనలేదు. మరో పదం ప్రయత్నించండి.',
    sortFacts: 'ఎక్కువ స్పెషాలిటీలు + సౌకర్యాలు ముందు',
    factsNote: 'పబ్లిక్ మూలాల్లో ఉన్న స్పెషాలిటీలు, సౌకర్యాల సంఖ్య మాత్రమే. ఇది రేటింగ్ లేదా అభిప్రాయం కాదు.',
    offenceGuide: 'నేరాల గైడ్ (BNS 2023)',
    allSections: 'అన్ని సెక్షన్లు',
    searchOffence: 'నేరం వెతకండి: దొంగతనం, మోసం, 318, IPC 420…',
    bnsNote: 'భారతీయ న్యాయ సంహిత (BNS), 2023 జూలై 1, 2024 నుంచి IPC స్థానంలో వచ్చింది. పోలీసు, కోర్టు విధానం: భారతీయ నాగరిక సురక్షా సంహిత (BNSS), 2023.',
    jail: 'జైలు',
    fine: 'జరిమానా',
    bailable: 'బెయిలబుల్: బెయిల్ హక్కుగా వస్తుంది',
    nonBailable: 'నాన్-బెయిలబుల్: బెయిల్ కోర్టు నిర్ణయిస్తుంది',
    dependsMain: 'ప్రధాన నేరాన్ని బట్టి ఉంటుంది',
    cogYes: 'కాగ్నిజబుల్: పోలీసులు FIR నమోదు చేయాలి, వారెంట్ లేకుండా అరెస్టు చేయవచ్చు',
    cogNo: 'నాన్-కాగ్నిజబుల్: దర్యాప్తుకు మేజిస్ట్రేట్ ఆదేశం కావాలి',
    cogCond: 'చట్టం చెప్పిన సందర్భంలో మాత్రమే కాగ్నిజబుల్ (అధికారిక పాఠం చూడండి)',
    howToComplain: 'పోలీసు ఫిర్యాదు ఎలా చేయాలి',
    cases: 'చట్టంలోని సందర్భాలు',
    officialText: 'అధికారిక పాఠం',
    translationNote: 'తెలుగు / హిందీ పంక్తులు మీకు సహాయం కోసం చేసిన అనువాదాలు; చట్టం అధికారిక ఇంగ్లీష్ పాఠమే చెల్లుతుంది.',
    address: 'చిరునామా',
    phone: 'ఫోన్',
    englishToggle: 'English',
    aiBusy: 'AI ఇప్పుడు బిజీగా ఉంది (ఉచిత పరిమితి). సేవ్ చేసిన సమాచారం చూపిస్తున్నాం; కొన్ని నిమిషాల తర్వాత మళ్ళీ ప్రయత్నించండి.',
    aiQuota: 'ఈ రోజుకు AI ఆగింది (ఉచిత AI పరిమితి పూర్తయింది). సేవ్ చేసిన సమాచారం పనిచేస్తుంది.',
    aiLimit: 'ఈ రోజు AI ప్రశ్నలు పూర్తయ్యాయి. రేపు మళ్ళీ రండి.',
    askLaws: 'చట్టాల గురించి అడగండి',
    askLawsHint: 'ఉదా. ఆన్‌లైన్‌లో నన్ను మోసం చేశారు. ఏ చట్టం వర్తిస్తుంది?',
    lawsAiNote: 'ఈ యాప్‌లోని చట్ట సెక్షన్ల నుండి మాత్రమే, సులభమైన మాటల్లో సమాధానం. ఇది న్యాయ సలహా కాదు.',
    explainSimply: 'సులభంగా వివరించండి',
    showingSaved: 'సేవ్ చేసిన సమాచారం · అప్‌డేట్ అవుతోంది…',
    researchPaused: 'పరిశోధన ఆగింది (ఉచిత AI పరిమితి పూర్తయింది), సేవ్ చేసిన సమాచారం చూపిస్తున్నాం.',
    langPicker: 'భాష',
    alsoEnglish: 'English కూడా చూపించు',
    typeGovt: 'ప్రభుత్వ',
    typePrivate: 'ప్రైవేట్',
    typeNotListed: 'రకం పేర్కొనలేదు',
    districtSite: 'జిల్లా వెబ్‌సైట్',
    trLater: 'అనువాదం వస్తోంది; ప్రస్తుతానికి English చూపిస్తున్నాం.',
    sourceOne: 'మూలం',
    bestInIndia: 'భారతదేశంలో ఉత్తమమైనవి:',
    nirfRank: 'NIRF ర్యాంక్',
    nirfNote: 'NIRF ర్యాంక్ (బోధన + పరిశోధన ర్యాంకింగ్, చికిత్స నాణ్యత రేటింగ్ కాదు)',
    specialistInst: 'స్పెషాలిటీ సంస్థ',
    seeSpecialities: 'చూపించుకోవాల్సిన విభాగాలు',
    diseaseEmergency: 'ఇది అత్యవసర పరిస్థితి కావచ్చు. వెంటనే 108 లేదా 112కి కాల్ చేయండి, లేదా దగ్గరలోని ఎమర్జెన్సీ విభాగానికి వెళ్లండి.',
    notDiagnosis: 'ఏ విభాగానికి వెళ్లాలో చెప్పే మార్గదర్శి మాత్రమే, ఇది రోగ నిర్ధారణ కాదు. దయచేసి డాక్టర్‌ను సంప్రదించండి.',
    didYouMean: 'దీని కోసం ఫలితాలు',
    govtRates: 'ప్రభుత్వ ప్యాకేజీ ధరలు (PM-JAY / CGHS ఆసుపత్రికి చెల్లించేవి)',
    govtRatesNote: 'ప్రైవేట్ ఆసుపత్రి చెప్పిన ధరతో పోల్చుకోవడానికి అధికారిక పథకం ధరలు. ప్రతి ఆసుపత్రి ఇదే వసూలు చేయదు; ఇంప్లాంట్లు, మందులు, గది అప్\u200cగ్రేడ్ అదనం కావచ్చు. ఆసుపత్రితో నిర్ధారించుకోండి.',
    cityTiers: 'X = టైర్ 1 నగరం, Y = టైర్ 2, Z = టైర్ 3. CGHS ధరలు NABH ఆసుపత్రులకు, సెమీ-ప్రైవేట్ వార్డ్.',
    mayTreatTitle: 'ఈ జాబితాలో ఏ ఆసుపత్రీ పబ్లిక్ మూలాల్లో దీన్ని పేర్కొనలేదు. దీనికి చికిత్స చేయగల సాధారణ / మల్టీ-స్పెషాలిటీ ప్రభుత్వ ఆసుపత్రులు',
    mayTreat: 'చికిత్స చేయవచ్చు — ఫోన్ చేసి నిర్ధారించుకోండి (పబ్లిక్ మూలం పేర్కొనలేదు)',
    typePrivateLikely: 'ప్రైవేట్ కావచ్చు · యాజమాన్యం నిర్ధారించలేదు',
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
    compareTitle: 'पिछली सरकार बनाम मौजूदा सरकार',
    compareNote: 'केवल तथ्य, आमने-सामने। हर बिंदु के साथ उसका स्रोत और तारीख़। कोई फ़ैसला या राय नहीं: पढ़कर ख़ुद तय करें।',
    compareShow: 'तुलना दिखाएँ',
    centre: 'केंद्र (भारत)',
    previousGovt: 'पिछली सरकार',
    presentGovt: 'मौजूदा सरकार',
    areaBudget: 'बजट',
    areaProjects: 'बड़ी परियोजनाएँ',
    areaStarted: 'शुरू की गई योजनाएँ',
    areaStopped: 'बंद / विलय / नाम बदली गई योजनाएँ',
    notListed: 'सार्वजनिक स्रोत के साथ कोई मिलता-जुलता बिंदु नहीं',
    prmTitle: 'वादे: क्या वादा किया, क्या पूरा हुआ, क्या बाकी',
    prmNote: 'स्थिति सिर्फ़ सार्वजनिक स्रोतों से (सरकारी आदेश, बजट, आधिकारिक साइटें, आधिकारिक आँकड़ों की ख़बरें), हर एक की तारीख़ के साथ। स्रोत नहीं = "कोई अपडेट नहीं"। कोई फ़ैसला या राय नहीं।',
    prmShow: 'वादे दिखाएँ',
    prmManifesto: 'घोषणापत्र',
    prmTotal: 'कुल',
    prmDone: 'पूरा हुआ',
    prmInProgress: 'काम जारी',
    prmNotDone: 'पूरा नहीं हुआ',
    prmNoUpdate: 'कोई अपडेट नहीं',
    prmAll: 'सभी',
    prmNoData: 'इस सरकार के लिए अभी कोई शोधित वादा नहीं। सार्वजनिक स्रोतों से जानकारी जुटाई जा रही है, कुछ मिनट बाद देखें।',
    prmHead: 'सरकार प्रमुख',
    prmNoneInFilter: 'इस स्थिति वाला कोई वादा नहीं।',
    prmNotLive: 'वादों की सुविधा अभी सर्वर पर चालू नहीं हुई है। अभी कोई डेटा नहीं: सर्वर अपडेट होने के बाद यहाँ दिखेगा।',
    prmNoDataYet: 'इस सरकार के लिए अभी कोई डेटा नहीं। थोड़ी देर बाद नीचे खींचकर दोबारा कोशिश करें।',
    date: 'तारीख़',
    allHosp: 'सभी',
    publicNA: 'सार्वजनिक जानकारी उपलब्ध नहीं',
    timings: 'समय',
    emergency24: '24x7 आपातकालीन सेवा',
    specialities: 'स्पेशलिटी',
    specialFor: 'इसके लिए विशेष (सार्वजनिक स्रोतों के अनुसार)',
    doctors: 'विशेषज्ञ डॉक्टर (सार्वजनिक सूची में)',
    experience: 'अनुभव',
    facilities: 'सुविधाएँ',
    whereToGo: 'किसके लिए कहाँ जाएँ…',
    whereHint: 'बीमारी या स्पेशलिटी, जैसे दिल, किडनी, कैंसर, आँख, प्रसव',
    matches: 'मेल खाता है',
    noMatch: 'इस सूची में किसी अस्पताल ने सार्वजनिक स्रोतों में यह नहीं बताया। कोई दूसरा शब्द आज़माएँ।',
    sortFacts: 'ज़्यादा स्पेशलिटी + सुविधाएँ पहले',
    factsNote: 'सार्वजनिक स्रोतों में दी गई स्पेशलिटी और सुविधाओं की गिनती भर। यह रेटिंग या राय नहीं है।',
    offenceGuide: 'अपराध गाइड (BNS 2023)',
    allSections: 'सभी धाराएँ',
    searchOffence: 'अपराध खोजें: चोरी, धोखाधड़ी, 318, IPC 420…',
    bnsNote: 'भारतीय न्याय संहिता (BNS), 2023 ने 1 जुलाई 2024 से IPC की जगह ली। पुलिस और अदालत की प्रक्रिया: भारतीय नागरिक सुरक्षा संहिता (BNSS), 2023।',
    jail: 'जेल',
    fine: 'जुर्माना',
    bailable: 'ज़मानती: ज़मानत अधिकार है',
    nonBailable: 'गैर-ज़मानती: ज़मानत अदालत तय करती है',
    dependsMain: 'मुख्य अपराध पर निर्भर',
    cogYes: 'संज्ञेय: पुलिस को FIR दर्ज करनी होगी, बिना वारंट गिरफ़्तारी कर सकती है',
    cogNo: 'असंज्ञेय: जाँच के लिए मजिस्ट्रेट का आदेश चाहिए',
    cogCond: 'सिर्फ़ क़ानून में बताई स्थिति में संज्ञेय (आधिकारिक पाठ देखें)',
    howToComplain: 'पुलिस शिकायत कैसे करें',
    cases: 'क़ानून में स्थितियाँ',
    officialText: 'आधिकारिक पाठ',
    translationNote: 'तेलुगु / हिंदी पंक्तियाँ आपकी मदद के लिए अनुवाद हैं; क़ानून का आधिकारिक अंग्रेज़ी पाठ ही मान्य है।',
    address: 'पता',
    phone: 'फ़ोन',
    englishToggle: 'English',
    aiBusy: 'AI अभी व्यस्त है (मुफ़्त सीमा)। सहेजी गई जानकारी दिखाई जा रही है; कुछ मिनट बाद फिर कोशिश करें।',
    aiQuota: 'आज के लिए AI रुका है (मुफ़्त AI सीमा खत्म)। सहेजी गई जानकारी काम करती है।',
    aiLimit: 'आज के AI सवाल पूरे हो गए। कल फिर आइए।',
    askLaws: 'क़ानून के बारे में पूछें',
    askLawsHint: 'जैसे: किसी ने मुझसे ऑनलाइन धोखा किया। कौन सा क़ानून लागू होगा?',
    lawsAiNote: 'जवाब सिर्फ़ इस ऐप के क़ानूनी सेक्शन से, आसान शब्दों में। यह कानूनी सलाह नहीं है।',
    explainSimply: 'आसान भाषा में समझाएँ',
    showingSaved: 'सहेजी गई जानकारी · अपडेट हो रहा है…',
    researchPaused: 'रिसर्च रुकी है (मुफ़्त AI सीमा खत्म), सहेजी गई जानकारी दिखाई जा रही है।',
    langPicker: 'भाषा',
    alsoEnglish: 'English भी दिखाएँ',
    typeGovt: 'सरकारी',
    typePrivate: 'प्राइवेट',
    typeNotListed: 'प्रकार दर्ज नहीं',
    districtSite: 'ज़िले की वेबसाइट',
    trLater: 'अनुवाद आ रहा है; अभी English दिखा रहे हैं।',
    sourceOne: 'स्रोत',
    bestInIndia: 'भारत में सबसे अच्छे:',
    nirfRank: 'NIRF रैंक',
    nirfNote: 'NIRF रैंक (पढ़ाई + रिसर्च की रैंकिंग, इलाज की गुणवत्ता की रेटिंग नहीं)',
    specialistInst: 'स्पेशलिटी संस्थान',
    seeSpecialities: 'किस विभाग में दिखाएँ',
    diseaseEmergency: 'यह इमरजेंसी हो सकती है। अभी 108 या 112 पर कॉल करें, या पास के इमरजेंसी विभाग में जाएँ।',
    notDiagnosis: 'यह सिर्फ़ बताता है कि किस विभाग में जाएँ, यह बीमारी की जाँच (डायग्नोसिस) नहीं है। कृपया डॉक्टर को दिखाएँ।',
    didYouMean: 'इसके नतीजे दिखा रहे हैं',
    govtRates: 'सरकारी पैकेज दरें (PM-JAY / CGHS अस्पताल को जो देते हैं)',
    govtRatesNote: 'प्राइवेट अस्पताल के बताए खर्च से तुलना के लिए योजना की आधिकारिक दरें। हर अस्पताल यही नहीं लेता; इम्प्लांट, दवाइयाँ और कमरे का अपग्रेड अलग हो सकता है। अस्पताल से पुष्टि करें।',
    cityTiers: 'X = टियर 1 शहर, Y = टियर 2, Z = टियर 3। CGHS दरें NABH अस्पतालों के लिए, सेमी-प्राइवेट वार्ड।',
    mayTreatTitle: 'इस सूची में किसी अस्पताल ने सार्वजनिक स्रोतों में यह नहीं बताया। सामान्य / मल्टी-स्पेशियलिटी सरकारी अस्पताल जो इसका इलाज कर सकते हैं',
    mayTreat: 'इलाज कर सकते हैं — फ़ोन करके पुष्टि करें (किसी सार्वजनिक स्रोत में दर्ज नहीं)',
    typePrivateLikely: 'संभवतः प्राइवेट · स्वामित्व की पुष्टि नहीं',
  },
};

// AI-translated label packs for app languages without static labels (services/civicI18n.ts)
const aiPacks: Partial<Record<AppLanguage, Partial<Record<CivicKey, string>>>> = {};

export const hasStaticLabels = (lang: AppLanguage): lang is StaticLanguage => lang === 'English' || lang === 'Telugu' || lang === 'Hindi';

export const setAiLabels = (lang: AppLanguage, pack: Partial<Record<CivicKey, string>>): void => {
  if (hasStaticLabels(lang)) return;
  aiPacks[lang] = { ...(aiPacks[lang] || {}), ...pack };
};

export const aiLabelCount = (lang: AppLanguage): number => Object.keys(aiPacks[lang] || {}).length;

// Static label, else the AI pack, else English
export const civicText = (lang: AppLanguage, key: CivicKey): string =>
  (hasStaticLabels(lang) ? CIVIC_LABELS[lang][key] : aiPacks[lang]?.[key]) || CIVIC_LABELS.English[key];
