// Short headings / labels of the astrology panel, birth chart and festivals, in all 12 languages.
import type { AstroLang } from './astroNames';

export interface AstroLabels {
  panchang: string; jathakam: string; mood: string; do: string; avoid: string; lucky: string; luckyNumber: string; calm: string;
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
    lucky: 'Lucky time', luckyNumber: 'Lucky number', calm: 'Pause time', dress: 'What to wear today', fromWardrobe: 'From your wardrobe', festivalToday: 'Festival today',
    upcoming: 'Coming up', inDays: 'in {n} days', tomorrow: 'tomorrow', celebrate: 'How to celebrate', wear: 'What to wear', edit: 'Edit profile',
    more: '✨ More details', moreLoading: 'Reading the stars…', showEnglish: 'Show English too',
    tithi: 'Tithi', nakshatra: 'Nakshatra', vaara: 'Weekday lord', moon: "Today's Moon", sun: 'Sunrise / Sunset',
    chart: 'Your birth chart', janmaRashi: 'Janma rashi (Moon sign)', pada: 'pada', lagna: 'Lagna (Ascendant)', mahadasha: 'Mahadasha',
    antardasha: 'Antardasha', until: 'until {date}', birthTithi: 'Birth tithi', gana: 'Gana', yoni: 'Yoni', nadi: 'Nadi',
    lifePath: 'Life path number', birthNumber: 'Birth number', nameNumber: 'Name number', place: 'Birth place', nameStar: 'Name star',
  },
  Telugu: {
    panchang: 'నేటి పంచాంగం', jathakam: 'మీ జాతకం ప్రకారం ఈ రోజు', mood: 'ఈ రోజు ఎలా ఉండాలి', do: 'చేయదగినవి', avoid: 'దూరంగా ఉంచదగినవి',
    lucky: 'శుభ సమయం', luckyNumber: 'అదృష్ట సంఖ్య', calm: 'విరామ సమయం', dress: 'ఈ రోజు ఏ దుస్తులు', fromWardrobe: 'మీ వార్డ్‌రోబ్ నుండి', festivalToday: 'ఈ రోజు పండుగ',
    upcoming: 'త్వరలో', inDays: '{n} రోజుల్లో', tomorrow: 'రేపు', celebrate: 'ఎలా జరుపుకోవాలి', wear: 'ఏ దుస్తులు ధరించాలి', edit: 'ప్రొఫైల్ మార్చండి',
    more: '✨ మరిన్ని వివరాలు', moreLoading: 'గ్రహాలను చదువుతున్నాం…', showEnglish: 'ఇంగ్లీష్ కూడా చూపించు',
    tithi: 'తిథి', nakshatra: 'నక్షత్రం', vaara: 'వార అధిపతి', moon: 'ఈ రోజు చంద్రుడు', sun: 'సూర్యోదయం / సూర్యాస్తమయం',
    chart: 'మీ జన్మ జాతకం', janmaRashi: 'జన్మ రాశి', pada: 'పాదం', lagna: 'లగ్నం', mahadasha: 'మహాదశ', antardasha: 'అంతర్దశ', until: '{date} వరకు',
    birthTithi: 'జన్మ తిథి', gana: 'గణం', yoni: 'యోని', nadi: 'నాడి', lifePath: 'జీవన సంఖ్య (లైఫ్ పాత్)', birthNumber: 'జన్మ సంఖ్య',
    nameNumber: 'నామ సంఖ్య', place: 'జన్మ స్థలం', nameStar: 'నామ నక్షత్రం',
  },
  Hindi: {
    panchang: 'आज का पंचांग', jathakam: 'आपकी कुंडली के अनुसार आज', mood: 'आज कैसे रहें', do: 'करने योग्य', avoid: 'इनसे बचें',
    lucky: 'शुभ समय', luckyNumber: 'भाग्यशाली अंक', calm: 'विराम का समय', dress: 'आज क्या पहनें', fromWardrobe: 'आपकी वॉर्डरोब से', festivalToday: 'आज का त्योहार',
    upcoming: 'आने वाला', inDays: '{n} दिन में', tomorrow: 'कल', celebrate: 'कैसे मनाएँ', wear: 'क्या पहनें', edit: 'प्रोफ़ाइल बदलें',
    more: '✨ और जानकारी', moreLoading: 'ग्रहों को पढ़ रहे हैं…', showEnglish: 'अंग्रेज़ी भी दिखाएँ',
    tithi: 'तिथि', nakshatra: 'नक्षत्र', vaara: 'वार स्वामी', moon: 'आज का चंद्र', sun: 'सूर्योदय / सूर्यास्त',
    chart: 'आपकी जन्म कुंडली', janmaRashi: 'जन्म राशि', pada: 'चरण', lagna: 'लग्न', mahadasha: 'महादशा', antardasha: 'अंतर्दशा', until: '{date} तक',
    birthTithi: 'जन्म तिथि', gana: 'गण', yoni: 'योनि', nadi: 'नाड़ी', lifePath: 'मूलांक पथ (लाइफ़ पाथ)', birthNumber: 'मूलांक',
    nameNumber: 'नामांक', place: 'जन्म स्थान', nameStar: 'नाम नक्षत्र',
  },
  Tamil: {
    panchang: 'இன்றைய பஞ்சாங்கம்', jathakam: 'உங்கள் ஜாதகப்படி இன்று', mood: 'இன்று எப்படி இருக்கலாம்', do: 'செய்யத் தக்கவை', avoid: 'தவிர்க்க வேண்டியவை',
    lucky: 'நல்ல நேரம்', luckyNumber: 'அதிர்ஷ்ட எண்', calm: 'ஓய்வு நேரம்', dress: 'இன்று என்ன அணியலாம்', fromWardrobe: 'உங்கள் அலமாரியிலிருந்து', festivalToday: 'இன்றைய பண்டிகை',
    upcoming: 'வரவிருப்பது', inDays: '{n} நாட்களில்', tomorrow: 'நாளை', celebrate: 'எப்படிக் கொண்டாடலாம்', wear: 'என்ன அணியலாம்', edit: 'சுயவிவரம் திருத்து',
    more: '✨ மேலும் விவரங்கள்', moreLoading: 'கிரகங்களைப் படிக்கிறோம்…', showEnglish: 'ஆங்கிலமும் காட்டு',
    tithi: 'திதி', nakshatra: 'நட்சத்திரம்', vaara: 'வார அதிபதி', moon: 'இன்றைய சந்திரன்', sun: 'சூரிய உதயம் / அஸ்தமனம்',
    chart: 'உங்கள் ஜனன ஜாதகம்', janmaRashi: 'ஜென்ம ராசி', pada: 'பாதம்', lagna: 'லக்னம்', mahadasha: 'மகா தசை', antardasha: 'அந்தர் தசை (புக்தி)', until: '{date} வரை',
    birthTithi: 'ஜென்ம திதி', gana: 'கணம்', yoni: 'யோனி', nadi: 'நாடி', lifePath: 'வாழ்க்கைப் பாதை எண்', birthNumber: 'பிறவி எண்',
    nameNumber: 'பெயர் எண்', place: 'பிறந்த இடம்', nameStar: 'பெயர் நட்சத்திரம்',
  },
  Kannada: {
    panchang: 'ಇಂದಿನ ಪಂಚಾಂಗ', jathakam: 'ನಿಮ್ಮ ಜಾತಕದ ಪ್ರಕಾರ ಇಂದು', mood: 'ಇಂದು ಹೇಗಿರಬೇಕು', do: 'ಮಾಡಬಹುದಾದವು', avoid: 'ತಪ್ಪಿಸುವುದು ಒಳ್ಳೆಯದು',
    lucky: 'ಶುಭ ಸಮಯ', luckyNumber: 'ಅದೃಷ್ಟ ಸಂಖ್ಯೆ', calm: 'ವಿರಾಮ ಸಮಯ', dress: 'ಇಂದು ಏನು ಧರಿಸಬೇಕು', fromWardrobe: 'ನಿಮ್ಮ ವಾರ್ಡ್‌ರೋಬ್‌ನಿಂದ', festivalToday: 'ಇಂದಿನ ಹಬ್ಬ',
    upcoming: 'ಮುಂದಿನದು', inDays: '{n} ದಿನಗಳಲ್ಲಿ', tomorrow: 'ನಾಳೆ', celebrate: 'ಹೇಗೆ ಆಚರಿಸಬೇಕು', wear: 'ಏನು ಧರಿಸಬೇಕು', edit: 'ಪ್ರೊಫೈಲ್ ತಿದ್ದಿ',
    more: '✨ ಹೆಚ್ಚಿನ ವಿವರಗಳು', moreLoading: 'ಗ್ರಹಗಳನ್ನು ಓದುತ್ತಿದ್ದೇವೆ…', showEnglish: 'ಇಂಗ್ಲಿಷ್ ಕೂಡ ತೋರಿಸಿ',
    tithi: 'ತಿಥಿ', nakshatra: 'ನಕ್ಷತ್ರ', vaara: 'ವಾರಾಧಿಪತಿ', moon: 'ಇಂದಿನ ಚಂದ್ರ', sun: 'ಸೂರ್ಯೋದಯ / ಸೂರ್ಯಾಸ್ತ',
    chart: 'ನಿಮ್ಮ ಜನ್ಮ ಜಾತಕ', janmaRashi: 'ಜನ್ಮ ರಾಶಿ', pada: 'ಪಾದ', lagna: 'ಲಗ್ನ', mahadasha: 'ಮಹಾದಶೆ', antardasha: 'ಅಂತರ್ದಶೆ', until: '{date} ವರೆಗೆ',
    birthTithi: 'ಜನ್ಮ ತಿಥಿ', gana: 'ಗಣ', yoni: 'ಯೋನಿ', nadi: 'ನಾಡಿ', lifePath: 'ಜೀವನ ಪಥ ಸಂಖ್ಯೆ', birthNumber: 'ಜನ್ಮ ಸಂಖ್ಯೆ',
    nameNumber: 'ನಾಮ ಸಂಖ್ಯೆ', place: 'ಜನ್ಮ ಸ್ಥಳ', nameStar: 'ನಾಮ ನಕ್ಷತ್ರ',
  },
  Malayalam: {
    panchang: 'ഇന്നത്തെ പഞ്ചാംഗം', jathakam: 'നിങ്ങളുടെ ജാതകപ്രകാരം ഇന്ന്', mood: 'ഇന്ന് എങ്ങനെ ആകാം', do: 'ചെയ്യാവുന്നവ', avoid: 'ഒഴിവാക്കുന്നതാണ് നല്ലത്',
    lucky: 'ശുഭ സമയം', luckyNumber: 'ഭാഗ്യ സംഖ്യ', calm: 'വിശ്രമ സമയം', dress: 'ഇന്ന് എന്ത് ധരിക്കാം', fromWardrobe: 'നിങ്ങളുടെ വാർഡ്രോബിൽ നിന്ന്', festivalToday: 'ഇന്നത്തെ ഉത്സവം',
    upcoming: 'വരാനിരിക്കുന്നത്', inDays: '{n} ദിവസത്തിനുള്ളിൽ', tomorrow: 'നാളെ', celebrate: 'എങ്ങനെ ആഘോഷിക്കാം', wear: 'എന്ത് ധരിക്കാം', edit: 'പ്രൊഫൈൽ തിരുത്തുക',
    more: '✨ കൂടുതൽ വിവരങ്ങൾ', moreLoading: 'ഗ്രഹങ്ങളെ വായിക്കുന്നു…', showEnglish: 'ഇംഗ്ലീഷും കാണിക്കുക',
    tithi: 'തിഥി', nakshatra: 'നക്ഷത്രം', vaara: 'ആഴ്ചയുടെ അധിപൻ', moon: 'ഇന്നത്തെ ചന്ദ്രൻ', sun: 'സൂര്യോദയം / അസ്തമയം',
    chart: 'നിങ്ങളുടെ ജനന ജാതകം', janmaRashi: 'ജന്മ രാശി (കൂറ്)', pada: 'പാദം', lagna: 'ലഗ്നം', mahadasha: 'മഹാദശ', antardasha: 'അപഹാരം', until: '{date} വരെ',
    birthTithi: 'ജന്മ തിഥി', gana: 'ഗണം', yoni: 'യോനി', nadi: 'നാഡി', lifePath: 'ജീവിതപാത സംഖ്യ', birthNumber: 'ജന്മ സംഖ്യ',
    nameNumber: 'നാമ സംഖ്യ', place: 'ജനന സ്ഥലം', nameStar: 'നാമ നക്ഷത്രം',
  },
  Marathi: {
    panchang: 'आजचे पंचांग', jathakam: 'तुमच्या कुंडलीनुसार आज', mood: 'आज कसे राहावे', do: 'करण्यासारखे', avoid: 'टाळलेले बरे',
    lucky: 'शुभ वेळ', luckyNumber: 'भाग्यांक', calm: 'विश्रांतीची वेळ', dress: 'आज काय घालावे', fromWardrobe: 'तुमच्या वॉर्डरोबमधून', festivalToday: 'आजचा सण',
    upcoming: 'येणारा', inDays: '{n} दिवसांत', tomorrow: 'उद्या', celebrate: 'कसा साजरा करावा', wear: 'काय घालावे', edit: 'प्रोफाइल बदला',
    more: '✨ अधिक माहिती', moreLoading: 'ग्रह वाचत आहोत…', showEnglish: 'इंग्रजीही दाखवा',
    tithi: 'तिथी', nakshatra: 'नक्षत्र', vaara: 'वारेश', moon: 'आजचा चंद्र', sun: 'सूर्योदय / सूर्यास्त',
    chart: 'तुमची जन्मकुंडली', janmaRashi: 'जन्म राशी', pada: 'चरण', lagna: 'लग्न', mahadasha: 'महादशा', antardasha: 'अंतर्दशा', until: '{date} पर्यंत',
    birthTithi: 'जन्म तिथी', gana: 'गण', yoni: 'योनी', nadi: 'नाडी', lifePath: 'जीवनमार्ग अंक', birthNumber: 'मूलांक',
    nameNumber: 'नामांक', place: 'जन्मस्थान', nameStar: 'नाम नक्षत्र',
  },
  Bengali: {
    panchang: 'আজকের পঞ্জিকা', jathakam: 'আপনার কোষ্ঠী অনুযায়ী আজ', mood: 'আজ কেমন থাকবেন', do: 'যা করা ভালো', avoid: 'যা এড়ানো ভালো',
    lucky: 'শুভ সময়', luckyNumber: 'ভাগ্যের সংখ্যা', calm: 'বিরতির সময়', dress: 'আজ কী পরবেন', fromWardrobe: 'আপনার ওয়ার্ডরোব থেকে', festivalToday: 'আজকের উৎসব',
    upcoming: 'আসছে', inDays: '{n} দিন পরে', tomorrow: 'আগামীকাল', celebrate: 'কীভাবে পালন করবেন', wear: 'কী পরবেন', edit: 'প্রোফাইল বদলান',
    more: '✨ আরও বিস্তারিত', moreLoading: 'গ্রহ পড়ছি…', showEnglish: 'ইংরেজিও দেখান',
    tithi: 'তিথি', nakshatra: 'নক্ষত্র', vaara: 'বারের অধিপতি', moon: 'আজকের চাঁদ', sun: 'সূর্যোদয় / সূর্যাস্ত',
    chart: 'আপনার জন্মকুণ্ডলী', janmaRashi: 'জন্ম রাশি', pada: 'পাদ', lagna: 'লগ্ন', mahadasha: 'মহাদশা', antardasha: 'অন্তর্দশা', until: '{date} পর্যন্ত',
    birthTithi: 'জন্ম তিথি', gana: 'গণ', yoni: 'যোনি', nadi: 'নাড়ী', lifePath: 'জীবনপথ সংখ্যা', birthNumber: 'জন্ম সংখ্যা',
    nameNumber: 'নাম সংখ্যা', place: 'জন্মস্থান', nameStar: 'নাম নক্ষত্র',
  },
  Gujarati: {
    panchang: 'આજનું પંચાંગ', jathakam: 'તમારી કુંડળી મુજબ આજે', mood: 'આજે કેવી રીતે રહેવું', do: 'કરવા જેવું', avoid: 'ટાળવું સારું',
    lucky: 'શુભ સમય', luckyNumber: 'શુભ અંક', calm: 'વિરામનો સમય', dress: 'આજે શું પહેરવું', fromWardrobe: 'તમારા વૉર્ડરોબમાંથી', festivalToday: 'આજનો તહેવાર',
    upcoming: 'આવનારું', inDays: '{n} દિવસમાં', tomorrow: 'આવતીકાલે', celebrate: 'કેવી રીતે ઉજવવું', wear: 'શું પહેરવું', edit: 'પ્રોફાઇલ બદલો',
    more: '✨ વધુ વિગતો', moreLoading: 'ગ્રહો વાંચી રહ્યા છીએ…', showEnglish: 'અંગ્રેજી પણ બતાવો',
    tithi: 'તિથિ', nakshatra: 'નક્ષત્ર', vaara: 'વારના સ્વામી', moon: 'આજનો ચંદ્ર', sun: 'સૂર્યોદય / સૂર્યાસ્ત',
    chart: 'તમારી જન્મકુંડળી', janmaRashi: 'જન્મ રાશિ', pada: 'ચરણ', lagna: 'લગ્ન', mahadasha: 'મહાદશા', antardasha: 'અંતર્દશા', until: '{date} સુધી',
    birthTithi: 'જન્મ તિથિ', gana: 'ગણ', yoni: 'યોનિ', nadi: 'નાડી', lifePath: 'જીવનપથ અંક', birthNumber: 'મૂળાંક',
    nameNumber: 'નામાંક', place: 'જન્મસ્થળ', nameStar: 'નામ નક્ષત્ર',
  },
  Punjabi: {
    panchang: 'ਅੱਜ ਦਾ ਪੰਚਾਂਗ', jathakam: 'ਤੁਹਾਡੀ ਜਨਮ ਕੁੰਡਲੀ ਅਨੁਸਾਰ ਅੱਜ', mood: 'ਅੱਜ ਕਿਵੇਂ ਰਹੀਏ', do: 'ਕਰਨ ਯੋਗ', avoid: 'ਇਨ੍ਹਾਂ ਤੋਂ ਬਚੋ',
    lucky: 'ਸ਼ੁਭ ਸਮਾਂ', luckyNumber: 'ਖ਼ੁਸ਼ਕਿਸਮਤ ਅੰਕ', calm: 'ਠਹਿਰਾਅ ਦਾ ਸਮਾਂ', dress: 'ਅੱਜ ਕੀ ਪਹਿਨੀਏ', fromWardrobe: 'ਤੁਹਾਡੀ ਵਾਰਡਰੋਬ ਵਿੱਚੋਂ', festivalToday: 'ਅੱਜ ਦਾ ਤਿਉਹਾਰ',
    upcoming: 'ਆਉਣ ਵਾਲਾ', inDays: '{n} ਦਿਨਾਂ ਵਿੱਚ', tomorrow: 'ਕੱਲ੍ਹ', celebrate: 'ਕਿਵੇਂ ਮਨਾਈਏ', wear: 'ਕੀ ਪਹਿਨੀਏ', edit: 'ਪ੍ਰੋਫਾਈਲ ਬਦਲੋ',
    more: '✨ ਹੋਰ ਵੇਰਵੇ', moreLoading: 'ਗ੍ਰਹਿ ਪੜ੍ਹ ਰਹੇ ਹਾਂ…', showEnglish: 'ਅੰਗਰੇਜ਼ੀ ਵੀ ਦਿਖਾਓ',
    tithi: 'ਤਿਥੀ', nakshatra: 'ਨਕਸ਼ੱਤਰ', vaara: 'ਵਾਰ ਦਾ ਸੁਆਮੀ', moon: 'ਅੱਜ ਦਾ ਚੰਦਰਮਾ', sun: 'ਸੂਰਜ ਚੜ੍ਹਨਾ / ਡੁੱਬਣਾ',
    chart: 'ਤੁਹਾਡੀ ਜਨਮ ਕੁੰਡਲੀ', janmaRashi: 'ਜਨਮ ਰਾਸ਼ੀ', pada: 'ਚਰਨ', lagna: 'ਲਗਨ', mahadasha: 'ਮਹਾਦਸ਼ਾ', antardasha: 'ਅੰਤਰਦਸ਼ਾ', until: '{date} ਤੱਕ',
    birthTithi: 'ਜਨਮ ਤਿਥੀ', gana: 'ਗਣ', yoni: 'ਯੋਨੀ', nadi: 'ਨਾੜੀ', lifePath: 'ਜੀਵਨ ਮਾਰਗ ਅੰਕ', birthNumber: 'ਜਨਮ ਅੰਕ',
    nameNumber: 'ਨਾਮ ਅੰਕ', place: 'ਜਨਮ ਸਥਾਨ', nameStar: 'ਨਾਮ ਨਕਸ਼ੱਤਰ',
  },
  Odia: {
    panchang: 'ଆଜିର ପାଞ୍ଜି', jathakam: 'ଆପଣଙ୍କ ଜାତକ ଅନୁସାରେ ଆଜି', mood: 'ଆଜି କିପରି ରହିବେ', do: 'କରିବା ଭଲ', avoid: 'ଏଡ଼ାଇବା ଭଲ',
    lucky: 'ଶୁଭ ସମୟ', luckyNumber: 'ଶୁଭ ସଂଖ୍ୟା', calm: 'ବିରାମ ସମୟ', dress: 'ଆଜି କ’ଣ ପିନ୍ଧିବେ', fromWardrobe: 'ଆପଣଙ୍କ ୱାର୍ଡରୋବରୁ', festivalToday: 'ଆଜିର ପର୍ବ',
    upcoming: 'ଆସୁଛି', inDays: '{n} ଦିନ ପରେ', tomorrow: 'କାଲି', celebrate: 'କିପରି ପାଳନ କରିବେ', wear: 'କ’ଣ ପିନ୍ଧିବେ', edit: 'ପ୍ରୋଫାଇଲ୍ ବଦଳାନ୍ତୁ',
    more: '✨ ଅଧିକ ବିବରଣୀ', moreLoading: 'ଗ୍ରହଙ୍କୁ ପଢ଼ୁଛୁ…', showEnglish: 'ଇଂରାଜୀ ମଧ୍ୟ ଦେଖାନ୍ତୁ',
    tithi: 'ତିଥି', nakshatra: 'ନକ୍ଷତ୍ର', vaara: 'ବାରର ଅଧିପତି', moon: 'ଆଜିର ଚନ୍ଦ୍ର', sun: 'ସୂର୍ଯ୍ୟୋଦୟ / ସୂର୍ଯ୍ୟାସ୍ତ',
    chart: 'ଆପଣଙ୍କ ଜନ୍ମ କୁଣ୍ଡଳୀ', janmaRashi: 'ଜନ୍ମ ରାଶି', pada: 'ପାଦ', lagna: 'ଲଗ୍ନ', mahadasha: 'ମହାଦଶା', antardasha: 'ଅନ୍ତର୍ଦଶା', until: '{date} ପର୍ଯ୍ୟନ୍ତ',
    birthTithi: 'ଜନ୍ମ ତିଥି', gana: 'ଗଣ', yoni: 'ଯୋନି', nadi: 'ନାଡ଼ୀ', lifePath: 'ଜୀବନପଥ ସଂଖ୍ୟା', birthNumber: 'ଜନ୍ମ ସଂଖ୍ୟା',
    nameNumber: 'ନାମ ସଂଖ୍ୟା', place: 'ଜନ୍ମ ସ୍ଥାନ', nameStar: 'ନାମ ନକ୍ଷତ୍ର',
  },
  Urdu: {
    panchang: 'آج کا پنچانگ', jathakam: 'آپ کے زائچے کے مطابق آج', mood: 'آج کیسے رہیں', do: 'کرنے کے کام', avoid: 'ان سے بچیں',
    lucky: 'مبارک وقت', luckyNumber: 'خوش قسمت نمبر', calm: 'ٹھہراؤ کا وقت', dress: 'آج کیا پہنیں', fromWardrobe: 'آپ کی وارڈروب سے', festivalToday: 'آج کا تہوار',
    upcoming: 'آنے والا', inDays: '{n} دن میں', tomorrow: 'کل', celebrate: 'کیسے منائیں', wear: 'کیا پہنیں', edit: 'پروفائل بدلیں',
    more: '✨ مزید تفصیل', moreLoading: 'ستارے پڑھ رہے ہیں…', showEnglish: 'انگریزی بھی دکھائیں',
    tithi: 'تتھی', nakshatra: 'نکشتر', vaara: 'دن کا مالک سیارہ', moon: 'آج کا چاند', sun: 'طلوعِ آفتاب / غروبِ آفتاب',
    chart: 'آپ کا پیدائشی زائچہ', janmaRashi: 'جنم راشی (چاند کا برج)', pada: 'پد', lagna: 'لگن (طالع)', mahadasha: 'مہا دشا', antardasha: 'انتر دشا', until: '{date} تک',
    birthTithi: 'پیدائشی تتھی', gana: 'گن', yoni: 'یونی', nadi: 'ناڑی', lifePath: 'لائف پاتھ نمبر', birthNumber: 'پیدائشی نمبر',
    nameNumber: 'نام کا نمبر', place: 'جائے پیدائش', nameStar: 'نام کا نکشتر',
  },
};

// ── Honest daily verdict (utils/astroVerdict.ts): rating, Positive / Be careful bullets, timings
// and remedies. English, Telugu and Hindi written; the other languages use English for now.
// Placeholders: {house} Moon's house, {tara} tara name, {lord} dasha lord, {day} weekday lord.
export interface VerdictText {
  title: string; positive: string; careful: string; remedies: string; badTimes: string;
  rating: { good: string; mixed: string; caution: string };
  summary: { good: string; mixed: string; caution: string };
  areas: { health: string; money: string; work: string; travel: string; relationships: string };
  taras: string[]; // 9 tara names, Janma..Parama Mitra
  rahu: string; yama: string; durmuhurtam: string;
  chandraGood: string[]; // by house 1,3,6,7,10,11 (index = house)
  chandraMixed: string[]; // houses 2,5,9
  chandraBad: string[]; // houses 4,12
  ashtamaChandra: string; ashtamaChandra2: string;
  taraGood: string; taraJanma: string; taraBad: string;
  sadeSatiRising: string; sadeSatiPeak: string; sadeSatiSetting: string; ashtamaShani: string; ardhashtamaShani: string;
  dashaFriend: string; dashaEnemy: string; antarFriend: string; antarEnemy: string;
  goodArea: { health: string; money: string; work: string; travel: string; relationships: string };
  badArea: { health: string; money: string; work: string; travel: string; relationships: string };
  timingLine: string; quietPositive: string;
  deity: string; mantra: string; donate: string; avoidColour: string; taraDonate: string;
  deities: string[]; mantras: string[]; donations: string[]; // by planet 0 Sun .. 8 Ketu
  taraGifts: Record<number, string>; // 3 Vipat, 5 Pratyak, 7 Naidhana
}

const EN_VERDICT: VerdictText = {
  title: "Today's honest reading", positive: 'Positive', careful: 'Be careful', remedies: 'Remedies', badTimes: 'Inauspicious times',
  rating: { good: 'Good day', mixed: 'Mixed day', caution: 'Caution day' },
  summary: {
    good: 'Chandrabalam and Tarabalam both support you today: a good day to start and push important things.',
    mixed: 'A mixed day: some factors help, some do not. Go ahead with routine work; plan big decisions carefully.',
    caution: 'A weak day for you: keep it simple, postpone big decisions, investments and long travel if you can.',
  },
  areas: { health: 'Health', money: 'Money', work: 'Work', travel: 'Travel', relationships: 'Relationships' },
  taras: ['Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyak', 'Sadhana', 'Naidhana', 'Mitra', 'Parama Mitra'],
  rahu: 'Rahu kalam', yama: 'Yamagandam', durmuhurtam: 'Durmuhurtam',
  chandraGood: ['', 'Moon in your 1st house: good energy, confidence and a clear mind.', '', 'Moon in your 3rd house: courage and effort pay off; good for short trips and calls.', '', '', 'Moon in your 6th house: you win over obstacles, rivals and pending health issues.', 'Moon in your 7th house: good for partnerships, meetings and time with people close to you.', '', '', 'Moon in your 10th house: work and reputation are supported; good for important tasks.', 'Moon in your 11th house: gains, good news and help from friends.'],
  chandraMixed: ['', '', 'Moon in your 2nd house: money matters are mixed; speak gently and check bills before paying.', '', '', 'Moon in your 5th house: mind may wander; fine for learning, careful with speculation.', '', '', '', 'Moon in your 9th house: blessings are there but plans may change; keep travel flexible.'],
  chandraBad: ['', '', '', '', 'Moon in your 4th house: restlessness at home and mental unease; drive carefully.', '', '', '', '', '', '', '', 'Moon in your 12th house: unexpected expenses and poor sleep; avoid lending money.'],
  ashtamaChandra: 'Ashtama Chandra (Moon in your 8th house): the weakest day of the month for you. Avoid new starts, big purchases, arguments and risky travel.',
  ashtamaChandra2: 'Health can be low today: eat light, rest well and do not ignore small symptoms.',
  taraGood: '{tara} tara today: the day\'s star is friendly to your birth star.',
  taraJanma: 'Janma tara (your own birth star) today: stay calm, avoid strain and new risks.',
  taraBad: '{tara} tara today: the day\'s star is unfriendly to your birth star; expect delays and obstacles.',
  sadeSatiRising: 'Sade Sati (first phase) is running: Saturn in the 12th from your Moon sign brings expenses and pressure; be patient.',
  sadeSatiPeak: 'Sade Sati (peak phase) is running: Saturn on your Moon sign brings heavy work and stress; avoid shortcuts.',
  sadeSatiSetting: 'Sade Sati (last phase) is running: Saturn in the 2nd from your Moon sign tests money and speech; save and speak softly.',
  ashtamaShani: 'Ashtama Shani is running: Saturn in the 8th from your Moon sign; take extra care of health and avoid risky deals.',
  ardhashtamaShani: 'Ardhashtama Shani is running: Saturn in the 4th from your Moon sign; peace at home and vehicles need care.',
  dashaFriend: 'Your {lord} dasha is friendly with today\'s lord {day}: efforts move forward.',
  dashaEnemy: 'Your {lord} dasha is hostile to today\'s lord {day}: work may feel blocked; avoid confrontations.',
  antarFriend: 'Your {lord} antardasha supports today\'s lord {day}.',
  antarEnemy: 'Your {lord} antardasha clashes with today\'s lord {day}: double-check details.',
  goodArea: {
    health: 'energy is steady; a good day to start a healthy habit.',
    money: 'a fair day for planned payments and savings.',
    work: 'good for finishing pending tasks and meeting seniors.',
    travel: 'short trips go smoothly.',
    relationships: 'a good day to clear misunderstandings with people close to you.',
  },
  badArea: {
    health: 'watch diet and sleep; avoid overexertion.',
    money: 'avoid lending, borrowing and impulse buying today.',
    work: 'avoid signing important papers or starting new projects today.',
    travel: 'postpone long or night travel if you can; drive carefully.',
    relationships: 'words can hurt today; avoid arguments and keep patience.',
  },
  timingLine: 'Do not start anything important during the inauspicious times below.',
  quietPositive: 'Routine work, prayer and rest go well today; keep important work for the lucky time.',
  deity: 'Pray to', mantra: 'Chant (108 times)', donate: 'Donate', avoidColour: 'Colour to avoid', taraDonate: 'For the tara',
  deities: ['Surya Narayana', 'Lord Shiva and Goddess Parvati', 'Lord Subrahmanya (Kartikeya)', 'Lord Vishnu', 'Lord Dakshinamurthy (Guru)', 'Goddess Lakshmi', 'Lord Hanuman and Shani Deva', 'Goddess Durga', 'Lord Ganesha'],
  mantras: ['Om Suryaya Namah', 'Om Somaya Namah', 'Om Angarakaya Namah', 'Om Budhaya Namah', 'Om Gurave Namah', 'Om Shukraya Namah', 'Om Shanaischaraya Namah', 'Om Rahave Namah', 'Om Ketave Namah'],
  donations: ['wheat and jaggery', 'rice, milk or white cloth', 'red lentils (masoor dal)', 'green gram (moong dal)', 'chana dal and turmeric', 'curd, sugar or white cloth', 'sesame seeds, black urad dal or mustard oil', 'black gram or a blanket', 'seven grains (saptadhanya) or food for street dogs'],
  taraGifts: { 3: 'jaggery', 5: 'salt', 7: 'sesame seeds' },
};

const TE_VERDICT: VerdictText = {
  title: 'ఈ రోజు నిజమైన ఫలితం', positive: 'అనుకూలం', careful: 'జాగ్రత్తలు', remedies: 'పరిహారాలు', badTimes: 'అశుభ సమయాలు',
  rating: { good: 'మంచి రోజు', mixed: 'మిశ్రమ ఫలితం', caution: 'జాగ్రత్త రోజు' },
  summary: {
    good: 'ఈ రోజు చంద్రబలం, తారాబలం రెండూ అనుకూలం: ముఖ్యమైన పనులు మొదలుపెట్టడానికి మంచి రోజు.',
    mixed: 'మిశ్రమ రోజు: కొన్ని అనుకూలం, కొన్ని ప్రతికూలం. రోజువారీ పనులు చేయండి; పెద్ద నిర్ణయాలు ఆలోచించి తీసుకోండి.',
    caution: 'మీకు బలహీనమైన రోజు: సాధ్యమైతే పెద్ద నిర్ణయాలు, పెట్టుబడులు, దూర ప్రయాణాలు వాయిదా వేయండి.',
  },
  areas: { health: 'ఆరోగ్యం', money: 'ధనం', work: 'ఉద్యోగం / పని', travel: 'ప్రయాణం', relationships: 'సంబంధాలు' },
  taras: ['జన్మ', 'సంపత్', 'విపత్', 'క్షేమ', 'ప్రత్యక్', 'సాధన', 'నైధన', 'మిత్ర', 'పరమ మిత్ర'],
  rahu: 'రాహుకాలం', yama: 'యమగండం', durmuhurtam: 'దుర్ముహూర్తం',
  chandraGood: ['', 'చంద్రుడు 1వ స్థానంలో: మంచి ఉత్సాహం, ఆత్మవిశ్వాసం, స్పష్టమైన ఆలోచన.', '', 'చంద్రుడు 3వ స్థానంలో: ధైర్యం, ప్రయత్నం ఫలిస్తాయి; చిన్న ప్రయాణాలకు అనుకూలం.', '', '', 'చంద్రుడు 6వ స్థానంలో: అడ్డంకులు, శత్రువులపై విజయం; ఆరోగ్యం మెరుగు.', 'చంద్రుడు 7వ స్థానంలో: భాగస్వామ్యాలు, సమావేశాలు, ఆత్మీయులతో సమయానికి అనుకూలం.', '', '', 'చంద్రుడు 10వ స్థానంలో: పని, పేరు ప్రతిష్ఠలకు అనుకూలం; ముఖ్యమైన పనులకు మంచిది.', 'చంద్రుడు 11వ స్థానంలో: లాభాలు, శుభవార్తలు, స్నేహితుల సహాయం.'],
  chandraMixed: ['', '', 'చంద్రుడు 2వ స్థానంలో: ధన విషయాలు మిశ్రమం; మృదువుగా మాట్లాడండి, బిల్లులు చూసి చెల్లించండి.', '', '', 'చంద్రుడు 5వ స్థానంలో: మనసు చంచలం; చదువుకు సరే, జూదం / స్పెక్యులేషన్ వద్దు.', '', '', '', 'చంద్రుడు 9వ స్థానంలో: దైవానుగ్రహం ఉంది కానీ ప్రణాళికలు మారవచ్చు; ప్రయాణాలు సర్దుబాటుగా ఉంచండి.'],
  chandraBad: ['', '', '', '', 'చంద్రుడు 4వ స్థానంలో: ఇంట్లో అశాంతి, మనసులో ఆందోళన; వాహనం జాగ్రత్తగా నడపండి.', '', '', '', '', '', '', '', 'చంద్రుడు 12వ స్థానంలో: అనుకోని ఖర్చులు, నిద్రలేమి; అప్పు ఇవ్వకండి.'],
  ashtamaChandra: 'అష్టమ చంద్రుడు (చంద్రుడు 8వ స్థానంలో): ఈ నెలలో మీకు అత్యంత బలహీనమైన రోజు. కొత్త పనులు, పెద్ద కొనుగోళ్లు, వాదనలు, ప్రమాదకర ప్రయాణాలు వద్దు.',
  ashtamaChandra2: 'ఈ రోజు ఆరోగ్యం బలహీనంగా ఉండవచ్చు: తేలికపాటి ఆహారం, విశ్రాంతి; చిన్న లక్షణాలను నిర్లక్ష్యం చేయకండి.',
  taraGood: 'ఈ రోజు {tara} తార: నేటి నక్షత్రం మీ జన్మ నక్షత్రానికి అనుకూలం.',
  taraJanma: 'ఈ రోజు జన్మ తార (మీ జన్మ నక్షత్రమే): ప్రశాంతంగా ఉండండి, అధిక శ్రమ, కొత్త రిస్కులు వద్దు.',
  taraBad: 'ఈ రోజు {tara} తార: నేటి నక్షత్రం మీ జన్మ నక్షత్రానికి ప్రతికూలం; ఆలస్యాలు, అడ్డంకులు రావచ్చు.',
  sadeSatiRising: 'ఏలినాటి శని (మొదటి దశ) నడుస్తోంది: శని మీ రాశికి 12వ స్థానంలో; ఖర్చులు, ఒత్తిడి; ఓపిక అవసరం.',
  sadeSatiPeak: 'ఏలినాటి శని (జన్మ శని) నడుస్తోంది: శని మీ రాశిలోనే; పని భారం, ఒత్తిడి; అడ్డదారులు వద్దు.',
  sadeSatiSetting: 'ఏలినాటి శని (చివరి దశ) నడుస్తోంది: శని మీ రాశికి 2వ స్థానంలో; ధనం, మాటలలో జాగ్రత్త; పొదుపు చేయండి.',
  ashtamaShani: 'అష్టమ శని నడుస్తోంది: శని మీ రాశికి 8వ స్థానంలో; ఆరోగ్యం పట్ల అదనపు జాగ్రత్త, రిస్కీ వ్యవహారాలు వద్దు.',
  ardhashtamaShani: 'అర్ధాష్టమ శని నడుస్తోంది: శని మీ రాశికి 4వ స్థానంలో; ఇంటి శాంతి, వాహనాల విషయంలో జాగ్రత్త.',
  dashaFriend: 'మీ {lord} మహాదశ నేటి వారాధిపతి {day}కి మిత్రుడు: ప్రయత్నాలు ముందుకు సాగుతాయి.',
  dashaEnemy: 'మీ {lord} మహాదశ నేటి వారాధిపతి {day}కి శత్రువు: పనులు ఆగినట్టు అనిపించవచ్చు; ఘర్షణలు వద్దు.',
  antarFriend: 'మీ {lord} అంతర్దశ నేటి వారాధిపతి {day}కి అనుకూలం.',
  antarEnemy: 'మీ {lord} అంతర్దశ నేటి వారాధిపతి {day}కి ప్రతికూలం: వివరాలు రెండుసార్లు సరిచూసుకోండి.',
  goodArea: {
    health: 'శక్తి స్థిరంగా ఉంటుంది; మంచి అలవాటు మొదలుపెట్టడానికి అనుకూలం.',
    money: 'ప్రణాళిక ప్రకారం చెల్లింపులు, పొదుపుకు అనుకూలం.',
    work: 'పెండింగ్ పనులు పూర్తి చేయడానికి, పెద్దలను కలవడానికి మంచిది.',
    travel: 'చిన్న ప్రయాణాలు సాఫీగా సాగుతాయి.',
    relationships: 'ఆత్మీయులతో అపార్థాలు తొలగించుకోవడానికి మంచి రోజు.',
  },
  badArea: {
    health: 'ఆహారం, నిద్ర జాగ్రత్త; అధిక శ్రమ వద్దు.',
    money: 'ఈ రోజు అప్పు ఇవ్వడం, తీసుకోవడం, అనవసర కొనుగోళ్లు వద్దు.',
    work: 'ఈ రోజు ముఖ్యమైన పత్రాలపై సంతకాలు, కొత్త ప్రాజెక్టులు వద్దు.',
    travel: 'వీలైతే దూర / రాత్రి ప్రయాణాలు వాయిదా వేయండి; జాగ్రత్తగా నడపండి.',
    relationships: 'మాటలు బాధ పెట్టవచ్చు; వాదనలు వద్దు, ఓపికగా ఉండండి.',
  },
  timingLine: 'కింది అశుభ సమయాల్లో ముఖ్యమైన పనులు మొదలుపెట్టకండి.',
  quietPositive: 'రోజువారీ పనులు, పూజ, విశ్రాంతి ఈ రోజు బాగా సాగుతాయి; ముఖ్యమైన పని శుభ సమయంలో చేయండి.',
  deity: 'పూజించవలసిన దైవం', mantra: 'జపం (108 సార్లు)', donate: 'దానం', avoidColour: 'వద్దనుకునే రంగు', taraDonate: 'తారా దోష పరిహారం',
  deities: ['సూర్య నారాయణుడు', 'శివ పార్వతులు', 'సుబ్రహ్మణ్య స్వామి', 'శ్రీ మహావిష్ణువు', 'దక్షిణామూర్తి (గురువు)', 'లక్ష్మీ దేవి', 'ఆంజనేయ స్వామి, శనైశ్చరుడు', 'దుర్గా దేవి', 'వినాయకుడు'],
  mantras: ['ఓం సూర్యాయ నమః', 'ఓం సోమాయ నమః', 'ఓం అంగారకాయ నమః', 'ఓం బుధాయ నమః', 'ఓం గురవే నమః', 'ఓం శుక్రాయ నమః', 'ఓం శనైశ్చరాయ నమః', 'ఓం రాహవే నమః', 'ఓం కేతవే నమః'],
  donations: ['గోధుమలు, బెల్లం', 'బియ్యం, పాలు లేదా తెల్లని వస్త్రం', 'ఎర్ర కందిపప్పు (మసూర్)', 'పెసలు', 'శనగపప్పు, పసుపు', 'పెరుగు, చక్కెర లేదా తెల్లని వస్త్రం', 'నువ్వులు, మినుములు లేదా నువ్వుల నూనె', 'మినుములు లేదా కంబళి', 'నవధాన్యాలు లేదా వీధి కుక్కలకు ఆహారం'],
  taraGifts: { 3: 'బెల్లం', 5: 'ఉప్పు', 7: 'నువ్వులు' },
};

const HI_VERDICT: VerdictText = {
  title: 'आज का सच्चा फल', positive: 'अनुकूल', careful: 'सावधान रहें', remedies: 'उपाय', badTimes: 'अशुभ समय',
  rating: { good: 'शुभ दिन', mixed: 'मिश्रित दिन', caution: 'सावधानी का दिन' },
  summary: {
    good: 'आज चंद्रबल और ताराबल दोनों आपके साथ हैं: ज़रूरी काम शुरू करने के लिए अच्छा दिन।',
    mixed: 'मिश्रित दिन: कुछ बातें अनुकूल, कुछ प्रतिकूल। रोज़ के काम करें; बड़े फ़ैसले सोच-समझकर लें।',
    caution: 'आपके लिए कमज़ोर दिन: हो सके तो बड़े फ़ैसले, निवेश और लंबी यात्रा टाल दें।',
  },
  areas: { health: 'स्वास्थ्य', money: 'धन', work: 'काम', travel: 'यात्रा', relationships: 'संबंध' },
  taras: ['जन्म', 'संपत', 'विपत', 'क्षेम', 'प्रत्यक', 'साधक', 'नैधन', 'मित्र', 'परम मित्र'],
  rahu: 'राहु काल', yama: 'यमगंड', durmuhurtam: 'दुर्मुहूर्त',
  chandraGood: ['', 'चंद्र पहले भाव में: अच्छी ऊर्जा, आत्मविश्वास और साफ़ सोच।', '', 'चंद्र तीसरे भाव में: साहस और मेहनत का फल; छोटी यात्राओं के लिए अच्छा।', '', '', 'चंद्र छठे भाव में: बाधाओं और विरोधियों पर जीत; सेहत में सुधार।', 'चंद्र सातवें भाव में: साझेदारी, मुलाक़ातों और अपनों के साथ समय के लिए अच्छा।', '', '', 'चंद्र दसवें भाव में: काम और मान-सम्मान को सहारा; ज़रूरी कामों के लिए अच्छा।', 'चंद्र ग्यारहवें भाव में: लाभ, शुभ समाचार और मित्रों से मदद।'],
  chandraMixed: ['', '', 'चंद्र दूसरे भाव में: धन के मामले मिश्रित; नरमी से बोलें, भुगतान से पहले बिल जाँचें।', '', '', 'चंद्र पाँचवें भाव में: मन चंचल; पढ़ाई ठीक, सट्टे से बचें।', '', '', '', 'चंद्र नौवें भाव में: भाग्य साथ है पर योजनाएँ बदल सकती हैं; यात्रा में लचीलापन रखें।'],
  chandraBad: ['', '', '', '', 'चंद्र चौथे भाव में: घर में अशांति और मन में बेचैनी; वाहन सावधानी से चलाएँ।', '', '', '', '', '', '', '', 'चंद्र बारहवें भाव में: अचानक ख़र्च और नींद की कमी; उधार न दें।'],
  ashtamaChandra: 'अष्टम चंद्र (चंद्र आठवें भाव में): इस महीने का आपके लिए सबसे कमज़ोर दिन। नई शुरुआत, बड़ी ख़रीदारी, बहस और जोखिम भरी यात्रा से बचें।',
  ashtamaChandra2: 'आज सेहत कमज़ोर रह सकती है: हल्का भोजन, पूरा आराम; छोटे लक्षणों को नज़रअंदाज़ न करें।',
  taraGood: 'आज {tara} तारा: आज का नक्षत्र आपके जन्म नक्षत्र के अनुकूल है।',
  taraJanma: 'आज जन्म तारा (आपका अपना जन्म नक्षत्र): शांत रहें, ज़्यादा थकान और नए जोखिम से बचें।',
  taraBad: 'आज {tara} तारा: आज का नक्षत्र आपके जन्म नक्षत्र के प्रतिकूल है; देरी और रुकावटें संभव।',
  sadeSatiRising: 'साढ़ेसाती (पहला चरण) चल रही है: शनि आपकी राशि से बारहवें भाव में; ख़र्च और दबाव; धैर्य रखें।',
  sadeSatiPeak: 'साढ़ेसाती (मध्य चरण) चल रही है: शनि आपकी ही राशि में; काम का बोझ और तनाव; शॉर्टकट से बचें।',
  sadeSatiSetting: 'साढ़ेसाती (अंतिम चरण) चल रही है: शनि आपकी राशि से दूसरे भाव में; धन और वाणी पर संयम; बचत करें।',
  ashtamaShani: 'अष्टम शनि (ढैया) चल रहा है: शनि आपकी राशि से आठवें भाव में; सेहत का विशेष ध्यान, जोखिम भरे सौदों से बचें।',
  ardhashtamaShani: 'अर्धाष्टम शनि (कंटक शनि / ढैया) चल रहा है: शनि आपकी राशि से चौथे भाव में; घर की शांति और वाहन का ध्यान रखें।',
  dashaFriend: 'आपकी {lord} महादशा आज के वार स्वामी {day} की मित्र है: प्रयास आगे बढ़ेंगे।',
  dashaEnemy: 'आपकी {lord} महादशा आज के वार स्वामी {day} की शत्रु है: काम अटक सकते हैं; टकराव से बचें।',
  antarFriend: 'आपकी {lord} अंतर्दशा आज के वार स्वामी {day} के अनुकूल है।',
  antarEnemy: 'आपकी {lord} अंतर्दशा आज के वार स्वामी {day} के प्रतिकूल है: बातें दोबारा जाँचें।',
  goodArea: {
    health: 'ऊर्जा स्थिर; अच्छी आदत शुरू करने का अच्छा दिन।',
    money: 'योजना के अनुसार भुगतान और बचत के लिए ठीक दिन।',
    work: 'अधूरे काम पूरे करने और बड़ों से मिलने के लिए अच्छा।',
    travel: 'छोटी यात्राएँ आसानी से होंगी।',
    relationships: 'अपनों से ग़लतफ़हमी दूर करने का अच्छा दिन।',
  },
  badArea: {
    health: 'खान-पान और नींद का ध्यान रखें; ज़्यादा मेहनत से बचें।',
    money: 'आज उधार देने-लेने और बेवजह ख़रीदारी से बचें।',
    work: 'आज ज़रूरी काग़ज़ों पर हस्ताक्षर या नया प्रोजेक्ट शुरू करने से बचें।',
    travel: 'हो सके तो लंबी या रात की यात्रा टालें; सावधानी से चलाएँ।',
    relationships: 'आज शब्द चुभ सकते हैं; बहस से बचें, धैर्य रखें।',
  },
  timingLine: 'नीचे दिए अशुभ समय में कोई ज़रूरी काम शुरू न करें।',
  quietPositive: 'रोज़ के काम, पूजा और आराम आज अच्छे रहेंगे; ज़रूरी काम शुभ समय में करें।',
  deity: 'पूजा करें', mantra: 'जाप (108 बार)', donate: 'दान करें', avoidColour: 'इस रंग से बचें', taraDonate: 'तारा दोष के लिए',
  deities: ['सूर्य नारायण', 'भगवान शिव और माता पार्वती', 'भगवान कार्तिकेय', 'भगवान विष्णु', 'दक्षिणामूर्ति (गुरु)', 'माता लक्ष्मी', 'हनुमान जी और शनि देव', 'माँ दुर्गा', 'भगवान गणेश'],
  mantras: ['ॐ सूर्याय नमः', 'ॐ सोमाय नमः', 'ॐ अंगारकाय नमः', 'ॐ बुधाय नमः', 'ॐ गुरवे नमः', 'ॐ शुक्राय नमः', 'ॐ शनैश्चराय नमः', 'ॐ राहवे नमः', 'ॐ केतवे नमः'],
  donations: ['गेहूँ और गुड़', 'चावल, दूध या सफ़ेद वस्त्र', 'मसूर दाल', 'मूँग दाल', 'चने की दाल और हल्दी', 'दही, चीनी या सफ़ेद वस्त्र', 'तिल, काली उड़द या सरसों का तेल', 'काली उड़द या कंबल', 'सप्तधान्य या गली के कुत्तों को भोजन'],
  taraGifts: { 3: 'गुड़', 5: 'नमक', 7: 'तिल' },
};

export const VERDICT_TEXT: Partial<Record<AstroLang, VerdictText>> = { English: EN_VERDICT, Telugu: TE_VERDICT, Hindi: HI_VERDICT };
export const hasOwnVerdict = (lang: AstroLang) => !!VERDICT_TEXT[lang];
export const verdictFor = (lang: AstroLang): VerdictText => VERDICT_TEXT[lang] || EN_VERDICT;
