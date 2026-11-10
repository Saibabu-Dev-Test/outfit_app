// Short headings / labels of the astrology panel, birth chart and festivals, in all 12 languages.
import type { AstroLang } from './astroNames';

export interface AstroLabels {
  panchang: string; jathakam: string; mood: string; do: string; avoid: string; lucky: string; calm: string;
  dress: string; fromWardrobe: string; festivalToday: string; upcoming: string; inDays: string; tomorrow: string;
  celebrate: string; wear: string; edit: string; more: string; moreLoading: string; showEnglish: string;
  tithi: string; nakshatra: string; vaara: string; moon: string; sun: string;
  chart: string; janmaRashi: string; pada: string; lagna: string; mahadasha: string; antardasha: string; until: string;
  birthTithi: string; gana: string; yoni: string; nadi: string; lifePath: string; birthNumber: string; nameNumber: string;
  place: string; nameStar: string;
}

export const LABELS: Record<AstroLang, AstroLabels> = {
  English: {
    panchang: "Today's panchang", jathakam: 'As per your jathakam today', mood: 'How to be today', do: 'Good to do', avoid: 'Better to avoid',
    lucky: 'Lucky time', calm: 'Pause time', dress: 'What to wear today', fromWardrobe: 'From your wardrobe', festivalToday: 'Festival today',
    upcoming: 'Coming up', inDays: 'in {n} days', tomorrow: 'tomorrow', celebrate: 'How to celebrate', wear: 'What to wear', edit: 'Edit profile',
    more: '✨ More details', moreLoading: 'Reading the stars…', showEnglish: 'Show English too',
    tithi: 'Tithi', nakshatra: 'Nakshatra', vaara: 'Weekday lord', moon: "Today's Moon", sun: 'Sunrise / Sunset',
    chart: 'Your birth chart', janmaRashi: 'Janma rashi (Moon sign)', pada: 'pada', lagna: 'Lagna (Ascendant)', mahadasha: 'Mahadasha',
    antardasha: 'Antardasha', until: 'until {date}', birthTithi: 'Birth tithi', gana: 'Gana', yoni: 'Yoni', nadi: 'Nadi',
    lifePath: 'Life path number', birthNumber: 'Birth number', nameNumber: 'Name number', place: 'Birth place', nameStar: 'Name star',
  },
  Telugu: {
    panchang: 'నేటి పంచాంగం', jathakam: 'మీ జాతకం ప్రకారం ఈ రోజు', mood: 'ఈ రోజు ఎలా ఉండాలి', do: 'చేయదగినవి', avoid: 'దూరంగా ఉంచదగినవి',
    lucky: 'శుభ సమయం', calm: 'విరామ సమయం', dress: 'ఈ రోజు ఏ దుస్తులు', fromWardrobe: 'మీ వార్డ్‌రోబ్ నుండి', festivalToday: 'ఈ రోజు పండుగ',
    upcoming: 'త్వరలో', inDays: '{n} రోజుల్లో', tomorrow: 'రేపు', celebrate: 'ఎలా జరుపుకోవాలి', wear: 'ఏ దుస్తులు ధరించాలి', edit: 'ప్రొఫైల్ మార్చండి',
    more: '✨ మరిన్ని వివరాలు', moreLoading: 'గ్రహాలను చదువుతున్నాం…', showEnglish: 'ఇంగ్లీష్ కూడా చూపించు',
    tithi: 'తిథి', nakshatra: 'నక్షత్రం', vaara: 'వార అధిపతి', moon: 'ఈ రోజు చంద్రుడు', sun: 'సూర్యోదయం / సూర్యాస్తమయం',
    chart: 'మీ జన్మ జాతకం', janmaRashi: 'జన్మ రాశి', pada: 'పాదం', lagna: 'లగ్నం', mahadasha: 'మహాదశ', antardasha: 'అంతర్దశ', until: '{date} వరకు',
    birthTithi: 'జన్మ తిథి', gana: 'గణం', yoni: 'యోని', nadi: 'నాడి', lifePath: 'జీవన సంఖ్య (లైఫ్ పాత్)', birthNumber: 'జన్మ సంఖ్య',
    nameNumber: 'నామ సంఖ్య', place: 'జన్మ స్థలం', nameStar: 'నామ నక్షత్రం',
  },
  Hindi: {
    panchang: 'आज का पंचांग', jathakam: 'आपकी कुंडली के अनुसार आज', mood: 'आज कैसे रहें', do: 'करने योग्य', avoid: 'इनसे बचें',
    lucky: 'शुभ समय', calm: 'विराम का समय', dress: 'आज क्या पहनें', fromWardrobe: 'आपकी वॉर्डरोब से', festivalToday: 'आज का त्योहार',
    upcoming: 'आने वाला', inDays: '{n} दिन में', tomorrow: 'कल', celebrate: 'कैसे मनाएँ', wear: 'क्या पहनें', edit: 'प्रोफ़ाइल बदलें',
    more: '✨ और जानकारी', moreLoading: 'ग्रहों को पढ़ रहे हैं…', showEnglish: 'अंग्रेज़ी भी दिखाएँ',
    tithi: 'तिथि', nakshatra: 'नक्षत्र', vaara: 'वार स्वामी', moon: 'आज का चंद्र', sun: 'सूर्योदय / सूर्यास्त',
    chart: 'आपकी जन्म कुंडली', janmaRashi: 'जन्म राशि', pada: 'चरण', lagna: 'लग्न', mahadasha: 'महादशा', antardasha: 'अंतर्दशा', until: '{date} तक',
    birthTithi: 'जन्म तिथि', gana: 'गण', yoni: 'योनि', nadi: 'नाड़ी', lifePath: 'मूलांक पथ (लाइफ़ पाथ)', birthNumber: 'मूलांक',
    nameNumber: 'नामांक', place: 'जन्म स्थान', nameStar: 'नाम नक्षत्र',
  },
  Tamil: {
    panchang: 'இன்றைய பஞ்சாங்கம்', jathakam: 'உங்கள் ஜாதகப்படி இன்று', mood: 'இன்று எப்படி இருக்கலாம்', do: 'செய்யத் தக்கவை', avoid: 'தவிர்க்க வேண்டியவை',
    lucky: 'நல்ல நேரம்', calm: 'ஓய்வு நேரம்', dress: 'இன்று என்ன அணியலாம்', fromWardrobe: 'உங்கள் அலமாரியிலிருந்து', festivalToday: 'இன்றைய பண்டிகை',
    upcoming: 'வரவிருப்பது', inDays: '{n} நாட்களில்', tomorrow: 'நாளை', celebrate: 'எப்படிக் கொண்டாடலாம்', wear: 'என்ன அணியலாம்', edit: 'சுயவிவரம் திருத்து',
    more: '✨ மேலும் விவரங்கள்', moreLoading: 'கிரகங்களைப் படிக்கிறோம்…', showEnglish: 'ஆங்கிலமும் காட்டு',
    tithi: 'திதி', nakshatra: 'நட்சத்திரம்', vaara: 'வார அதிபதி', moon: 'இன்றைய சந்திரன்', sun: 'சூரிய உதயம் / அஸ்தமனம்',
    chart: 'உங்கள் ஜனன ஜாதகம்', janmaRashi: 'ஜென்ம ராசி', pada: 'பாதம்', lagna: 'லக்னம்', mahadasha: 'மகா தசை', antardasha: 'அந்தர் தசை (புக்தி)', until: '{date} வரை',
    birthTithi: 'ஜென்ம திதி', gana: 'கணம்', yoni: 'யோனி', nadi: 'நாடி', lifePath: 'வாழ்க்கைப் பாதை எண்', birthNumber: 'பிறவி எண்',
    nameNumber: 'பெயர் எண்', place: 'பிறந்த இடம்', nameStar: 'பெயர் நட்சத்திரம்',
  },
  Kannada: {
    panchang: 'ಇಂದಿನ ಪಂಚಾಂಗ', jathakam: 'ನಿಮ್ಮ ಜಾತಕದ ಪ್ರಕಾರ ಇಂದು', mood: 'ಇಂದು ಹೇಗಿರಬೇಕು', do: 'ಮಾಡಬಹುದಾದವು', avoid: 'ತಪ್ಪಿಸುವುದು ಒಳ್ಳೆಯದು',
    lucky: 'ಶುಭ ಸಮಯ', calm: 'ವಿರಾಮ ಸಮಯ', dress: 'ಇಂದು ಏನು ಧರಿಸಬೇಕು', fromWardrobe: 'ನಿಮ್ಮ ವಾರ್ಡ್‌ರೋಬ್‌ನಿಂದ', festivalToday: 'ಇಂದಿನ ಹಬ್ಬ',
    upcoming: 'ಮುಂದಿನದು', inDays: '{n} ದಿನಗಳಲ್ಲಿ', tomorrow: 'ನಾಳೆ', celebrate: 'ಹೇಗೆ ಆಚರಿಸಬೇಕು', wear: 'ಏನು ಧರಿಸಬೇಕು', edit: 'ಪ್ರೊಫೈಲ್ ತಿದ್ದಿ',
    more: '✨ ಹೆಚ್ಚಿನ ವಿವರಗಳು', moreLoading: 'ಗ್ರಹಗಳನ್ನು ಓದುತ್ತಿದ್ದೇವೆ…', showEnglish: 'ಇಂಗ್ಲಿಷ್ ಕೂಡ ತೋರಿಸಿ',
    tithi: 'ತಿಥಿ', nakshatra: 'ನಕ್ಷತ್ರ', vaara: 'ವಾರಾಧಿಪತಿ', moon: 'ಇಂದಿನ ಚಂದ್ರ', sun: 'ಸೂರ್ಯೋದಯ / ಸೂರ್ಯಾಸ್ತ',
    chart: 'ನಿಮ್ಮ ಜನ್ಮ ಜಾತಕ', janmaRashi: 'ಜನ್ಮ ರಾಶಿ', pada: 'ಪಾದ', lagna: 'ಲಗ್ನ', mahadasha: 'ಮಹಾದಶೆ', antardasha: 'ಅಂತರ್ದಶೆ', until: '{date} ವರೆಗೆ',
    birthTithi: 'ಜನ್ಮ ತಿಥಿ', gana: 'ಗಣ', yoni: 'ಯೋನಿ', nadi: 'ನಾಡಿ', lifePath: 'ಜೀವನ ಪಥ ಸಂಖ್ಯೆ', birthNumber: 'ಜನ್ಮ ಸಂಖ್ಯೆ',
    nameNumber: 'ನಾಮ ಸಂಖ್ಯೆ', place: 'ಜನ್ಮ ಸ್ಥಳ', nameStar: 'ನಾಮ ನಕ್ಷತ್ರ',
  },
  Malayalam: {
    panchang: 'ഇന്നത്തെ പഞ്ചാംഗം', jathakam: 'നിങ്ങളുടെ ജാതകപ്രകാരം ഇന്ന്', mood: 'ഇന്ന് എങ്ങനെ ആകാം', do: 'ചെയ്യാവുന്നവ', avoid: 'ഒഴിവാക്കുന്നതാണ് നല്ലത്',
    lucky: 'ശുഭ സമയം', calm: 'വിശ്രമ സമയം', dress: 'ഇന്ന് എന്ത് ധരിക്കാം', fromWardrobe: 'നിങ്ങളുടെ വാർഡ്രോബിൽ നിന്ന്', festivalToday: 'ഇന്നത്തെ ഉത്സവം',
    upcoming: 'വരാനിരിക്കുന്നത്', inDays: '{n} ദിവസത്തിനുള്ളിൽ', tomorrow: 'നാളെ', celebrate: 'എങ്ങനെ ആഘോഷിക്കാം', wear: 'എന്ത് ധരിക്കാം', edit: 'പ്രൊഫൈൽ തിരുത്തുക',
    more: '✨ കൂടുതൽ വിവരങ്ങൾ', moreLoading: 'ഗ്രഹങ്ങളെ വായിക്കുന്നു…', showEnglish: 'ഇംഗ്ലീഷും കാണിക്കുക',
    tithi: 'തിഥി', nakshatra: 'നക്ഷത്രം', vaara: 'ആഴ്ചയുടെ അധിപൻ', moon: 'ഇന്നത്തെ ചന്ദ്രൻ', sun: 'സൂര്യോദയം / അസ്തമയം',
    chart: 'നിങ്ങളുടെ ജനന ജാതകം', janmaRashi: 'ജന്മ രാശി (കൂറ്)', pada: 'പാദം', lagna: 'ലഗ്നം', mahadasha: 'മഹാദശ', antardasha: 'അപഹാരം', until: '{date} വരെ',
    birthTithi: 'ജന്മ തിഥി', gana: 'ഗണം', yoni: 'യോനി', nadi: 'നാഡി', lifePath: 'ജീവിതപാത സംഖ്യ', birthNumber: 'ജന്മ സംഖ്യ',
    nameNumber: 'നാമ സംഖ്യ', place: 'ജനന സ്ഥലം', nameStar: 'നാമ നക്ഷത്രം',
  },
  Marathi: {
    panchang: 'आजचे पंचांग', jathakam: 'तुमच्या कुंडलीनुसार आज', mood: 'आज कसे राहावे', do: 'करण्यासारखे', avoid: 'टाळलेले बरे',
    lucky: 'शुभ वेळ', calm: 'विश्रांतीची वेळ', dress: 'आज काय घालावे', fromWardrobe: 'तुमच्या वॉर्डरोबमधून', festivalToday: 'आजचा सण',
    upcoming: 'येणारा', inDays: '{n} दिवसांत', tomorrow: 'उद्या', celebrate: 'कसा साजरा करावा', wear: 'काय घालावे', edit: 'प्रोफाइल बदला',
    more: '✨ अधिक माहिती', moreLoading: 'ग्रह वाचत आहोत…', showEnglish: 'इंग्रजीही दाखवा',
    tithi: 'तिथी', nakshatra: 'नक्षत्र', vaara: 'वारेश', moon: 'आजचा चंद्र', sun: 'सूर्योदय / सूर्यास्त',
    chart: 'तुमची जन्मकुंडली', janmaRashi: 'जन्म राशी', pada: 'चरण', lagna: 'लग्न', mahadasha: 'महादशा', antardasha: 'अंतर्दशा', until: '{date} पर्यंत',
    birthTithi: 'जन्म तिथी', gana: 'गण', yoni: 'योनी', nadi: 'नाडी', lifePath: 'जीवनमार्ग अंक', birthNumber: 'मूलांक',
    nameNumber: 'नामांक', place: 'जन्मस्थान', nameStar: 'नाम नक्षत्र',
  },
  Bengali: {
    panchang: 'আজকের পঞ্জিকা', jathakam: 'আপনার কোষ্ঠী অনুযায়ী আজ', mood: 'আজ কেমন থাকবেন', do: 'যা করা ভালো', avoid: 'যা এড়ানো ভালো',
    lucky: 'শুভ সময়', calm: 'বিরতির সময়', dress: 'আজ কী পরবেন', fromWardrobe: 'আপনার ওয়ার্ডরোব থেকে', festivalToday: 'আজকের উৎসব',
    upcoming: 'আসছে', inDays: '{n} দিন পরে', tomorrow: 'আগামীকাল', celebrate: 'কীভাবে পালন করবেন', wear: 'কী পরবেন', edit: 'প্রোফাইল বদলান',
    more: '✨ আরও বিস্তারিত', moreLoading: 'গ্রহ পড়ছি…', showEnglish: 'ইংরেজিও দেখান',
    tithi: 'তিথি', nakshatra: 'নক্ষত্র', vaara: 'বারের অধিপতি', moon: 'আজকের চাঁদ', sun: 'সূর্যোদয় / সূর্যাস্ত',
    chart: 'আপনার জন্মকুণ্ডলী', janmaRashi: 'জন্ম রাশি', pada: 'পাদ', lagna: 'লগ্ন', mahadasha: 'মহাদশা', antardasha: 'অন্তর্দশা', until: '{date} পর্যন্ত',
    birthTithi: 'জন্ম তিথি', gana: 'গণ', yoni: 'যোনি', nadi: 'নাড়ী', lifePath: 'জীবনপথ সংখ্যা', birthNumber: 'জন্ম সংখ্যা',
    nameNumber: 'নাম সংখ্যা', place: 'জন্মস্থান', nameStar: 'নাম নক্ষত্র',
  },
  Gujarati: {
    panchang: 'આજનું પંચાંગ', jathakam: 'તમારી કુંડળી મુજબ આજે', mood: 'આજે કેવી રીતે રહેવું', do: 'કરવા જેવું', avoid: 'ટાળવું સારું',
    lucky: 'શુભ સમય', calm: 'વિરામનો સમય', dress: 'આજે શું પહેરવું', fromWardrobe: 'તમારા વૉર્ડરોબમાંથી', festivalToday: 'આજનો તહેવાર',
    upcoming: 'આવનારું', inDays: '{n} દિવસમાં', tomorrow: 'આવતીકાલે', celebrate: 'કેવી રીતે ઉજવવું', wear: 'શું પહેરવું', edit: 'પ્રોફાઇલ બદલો',
    more: '✨ વધુ વિગતો', moreLoading: 'ગ્રહો વાંચી રહ્યા છીએ…', showEnglish: 'અંગ્રેજી પણ બતાવો',
    tithi: 'તિથિ', nakshatra: 'નક્ષત્ર', vaara: 'વારના સ્વામી', moon: 'આજનો ચંદ્ર', sun: 'સૂર્યોદય / સૂર્યાસ્ત',
    chart: 'તમારી જન્મકુંડળી', janmaRashi: 'જન્મ રાશિ', pada: 'ચરણ', lagna: 'લગ્ન', mahadasha: 'મહાદશા', antardasha: 'અંતર્દશા', until: '{date} સુધી',
    birthTithi: 'જન્મ તિથિ', gana: 'ગણ', yoni: 'યોનિ', nadi: 'નાડી', lifePath: 'જીવનપથ અંક', birthNumber: 'મૂળાંક',
    nameNumber: 'નામાંક', place: 'જન્મસ્થળ', nameStar: 'નામ નક્ષત્ર',
  },
  Punjabi: {
    panchang: 'ਅੱਜ ਦਾ ਪੰਚਾਂਗ', jathakam: 'ਤੁਹਾਡੀ ਜਨਮ ਕੁੰਡਲੀ ਅਨੁਸਾਰ ਅੱਜ', mood: 'ਅੱਜ ਕਿਵੇਂ ਰਹੀਏ', do: 'ਕਰਨ ਯੋਗ', avoid: 'ਇਨ੍ਹਾਂ ਤੋਂ ਬਚੋ',
    lucky: 'ਸ਼ੁਭ ਸਮਾਂ', calm: 'ਠਹਿਰਾਅ ਦਾ ਸਮਾਂ', dress: 'ਅੱਜ ਕੀ ਪਹਿਨੀਏ', fromWardrobe: 'ਤੁਹਾਡੀ ਵਾਰਡਰੋਬ ਵਿੱਚੋਂ', festivalToday: 'ਅੱਜ ਦਾ ਤਿਉਹਾਰ',
    upcoming: 'ਆਉਣ ਵਾਲਾ', inDays: '{n} ਦਿਨਾਂ ਵਿੱਚ', tomorrow: 'ਕੱਲ੍ਹ', celebrate: 'ਕਿਵੇਂ ਮਨਾਈਏ', wear: 'ਕੀ ਪਹਿਨੀਏ', edit: 'ਪ੍ਰੋਫਾਈਲ ਬਦਲੋ',
    more: '✨ ਹੋਰ ਵੇਰਵੇ', moreLoading: 'ਗ੍ਰਹਿ ਪੜ੍ਹ ਰਹੇ ਹਾਂ…', showEnglish: 'ਅੰਗਰੇਜ਼ੀ ਵੀ ਦਿਖਾਓ',
    tithi: 'ਤਿਥੀ', nakshatra: 'ਨਕਸ਼ੱਤਰ', vaara: 'ਵਾਰ ਦਾ ਸੁਆਮੀ', moon: 'ਅੱਜ ਦਾ ਚੰਦਰਮਾ', sun: 'ਸੂਰਜ ਚੜ੍ਹਨਾ / ਡੁੱਬਣਾ',
    chart: 'ਤੁਹਾਡੀ ਜਨਮ ਕੁੰਡਲੀ', janmaRashi: 'ਜਨਮ ਰਾਸ਼ੀ', pada: 'ਚਰਨ', lagna: 'ਲਗਨ', mahadasha: 'ਮਹਾਦਸ਼ਾ', antardasha: 'ਅੰਤਰਦਸ਼ਾ', until: '{date} ਤੱਕ',
    birthTithi: 'ਜਨਮ ਤਿਥੀ', gana: 'ਗਣ', yoni: 'ਯੋਨੀ', nadi: 'ਨਾੜੀ', lifePath: 'ਜੀਵਨ ਮਾਰਗ ਅੰਕ', birthNumber: 'ਜਨਮ ਅੰਕ',
    nameNumber: 'ਨਾਮ ਅੰਕ', place: 'ਜਨਮ ਸਥਾਨ', nameStar: 'ਨਾਮ ਨਕਸ਼ੱਤਰ',
  },
  Odia: {
    panchang: 'ଆଜିର ପାଞ୍ଜି', jathakam: 'ଆପଣଙ୍କ ଜାତକ ଅନୁସାରେ ଆଜି', mood: 'ଆଜି କିପରି ରହିବେ', do: 'କରିବା ଭଲ', avoid: 'ଏଡ଼ାଇବା ଭଲ',
    lucky: 'ଶୁଭ ସମୟ', calm: 'ବିରାମ ସମୟ', dress: 'ଆଜି କ’ଣ ପିନ୍ଧିବେ', fromWardrobe: 'ଆପଣଙ୍କ ୱାର୍ଡରୋବରୁ', festivalToday: 'ଆଜିର ପର୍ବ',
    upcoming: 'ଆସୁଛି', inDays: '{n} ଦିନ ପରେ', tomorrow: 'କାଲି', celebrate: 'କିପରି ପାଳନ କରିବେ', wear: 'କ’ଣ ପିନ୍ଧିବେ', edit: 'ପ୍ରୋଫାଇଲ୍ ବଦଳାନ୍ତୁ',
    more: '✨ ଅଧିକ ବିବରଣୀ', moreLoading: 'ଗ୍ରହଙ୍କୁ ପଢ଼ୁଛୁ…', showEnglish: 'ଇଂରାଜୀ ମଧ୍ୟ ଦେଖାନ୍ତୁ',
    tithi: 'ତିଥି', nakshatra: 'ନକ୍ଷତ୍ର', vaara: 'ବାରର ଅଧିପତି', moon: 'ଆଜିର ଚନ୍ଦ୍ର', sun: 'ସୂର୍ଯ୍ୟୋଦୟ / ସୂର୍ଯ୍ୟାସ୍ତ',
    chart: 'ଆପଣଙ୍କ ଜନ୍ମ କୁଣ୍ଡଳୀ', janmaRashi: 'ଜନ୍ମ ରାଶି', pada: 'ପାଦ', lagna: 'ଲଗ୍ନ', mahadasha: 'ମହାଦଶା', antardasha: 'ଅନ୍ତର୍ଦଶା', until: '{date} ପର୍ଯ୍ୟନ୍ତ',
    birthTithi: 'ଜନ୍ମ ତିଥି', gana: 'ଗଣ', yoni: 'ଯୋନି', nadi: 'ନାଡ଼ୀ', lifePath: 'ଜୀବନପଥ ସଂଖ୍ୟା', birthNumber: 'ଜନ୍ମ ସଂଖ୍ୟା',
    nameNumber: 'ନାମ ସଂଖ୍ୟା', place: 'ଜନ୍ମ ସ୍ଥାନ', nameStar: 'ନାମ ନକ୍ଷତ୍ର',
  },
  Urdu: {
    panchang: 'آج کا پنچانگ', jathakam: 'آپ کے زائچے کے مطابق آج', mood: 'آج کیسے رہیں', do: 'کرنے کے کام', avoid: 'ان سے بچیں',
    lucky: 'مبارک وقت', calm: 'ٹھہراؤ کا وقت', dress: 'آج کیا پہنیں', fromWardrobe: 'آپ کی وارڈروب سے', festivalToday: 'آج کا تہوار',
    upcoming: 'آنے والا', inDays: '{n} دن میں', tomorrow: 'کل', celebrate: 'کیسے منائیں', wear: 'کیا پہنیں', edit: 'پروفائل بدلیں',
    more: '✨ مزید تفصیل', moreLoading: 'ستارے پڑھ رہے ہیں…', showEnglish: 'انگریزی بھی دکھائیں',
    tithi: 'تتھی', nakshatra: 'نکشتر', vaara: 'دن کا مالک سیارہ', moon: 'آج کا چاند', sun: 'طلوعِ آفتاب / غروبِ آفتاب',
    chart: 'آپ کا پیدائشی زائچہ', janmaRashi: 'جنم راشی (چاند کا برج)', pada: 'پد', lagna: 'لگن (طالع)', mahadasha: 'مہا دشا', antardasha: 'انتر دشا', until: '{date} تک',
    birthTithi: 'پیدائشی تتھی', gana: 'گن', yoni: 'یونی', nadi: 'ناڑی', lifePath: 'لائف پاتھ نمبر', birthNumber: 'پیدائشی نمبر',
    nameNumber: 'نام کا نمبر', place: 'جائے پیدائش', nameStar: 'نام کا نکشتر',
  },
};
