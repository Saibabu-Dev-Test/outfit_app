// Photo options labels (Original / Blur / Remove BG / Adjust / Blur face and the Adjust screen),
// in the Settings > App language (English by default, Telugu, Hindi).
import { AppLanguage } from './appLanguage';

export type PhotoEditKey =
  | 'original'
  | 'blur'
  | 'removeBg'
  | 'adjust'
  | 'adjusted'
  | 'blurFace'
  | 'photoOptions'
  | 'adjustTitle'
  | 'adjustHint'
  | 'aspectPhoto'
  | 'reset'
  | 'cancel'
  | 'apply'
  | 'usePhoto'
  | 'usePhotos'
  | 'noFace'
  | 'faceUnavailable'
  | 'facesBlurred'
  | 'zoomHint'
  | 'imagePreview'
  | 'tooLarge';

export const PHOTO_EDIT_LABELS: Record<AppLanguage, Record<PhotoEditKey, string>> = {
  English: {
    original: 'Original',
    blur: 'Blur',
    removeBg: 'Remove BG',
    adjust: 'Adjust',
    adjusted: 'Adjusted',
    blurFace: 'Blur face',
    photoOptions: 'Photo options',
    adjustTitle: 'Adjust photo',
    adjustHint: 'Pinch to zoom, drag to move. Only what is inside the frame is uploaded.',
    aspectPhoto: 'Photo',
    reset: 'Reset',
    cancel: 'Cancel',
    apply: 'Apply',
    usePhoto: 'Use photo',
    usePhotos: 'Use {n} photos',
    noFace: 'No face found in this photo',
    faceUnavailable: 'Face blur is not available on this phone yet',
    facesBlurred: '{n} face(s) blurred',
    zoomHint: 'Pinch or double-tap to zoom',
    imagePreview: 'Image Preview',
    tooLarge: 'This photo is too large. Try another option.',
  },
  Telugu: {
    original: 'ఒరిజినల్',
    blur: 'బ్లర్',
    removeBg: 'BG తీసివేయి',
    adjust: 'సర్దుబాటు',
    adjusted: 'సర్దుబాటు చేశారు',
    blurFace: 'ముఖం బ్లర్',
    photoOptions: 'ఫోటో ఎంపికలు',
    adjustTitle: 'ఫోటో సర్దుబాటు',
    adjustHint: 'జూమ్ కోసం రెండు వేళ్లతో పించ్ చేయండి, కదపడానికి లాగండి. ఫ్రేమ్ లోపల ఉన్నది మాత్రమే అప్‌లోడ్ అవుతుంది.',
    aspectPhoto: 'ఫోటో',
    reset: 'రీసెట్',
    cancel: 'రద్దు',
    apply: 'వర్తింపజేయి',
    usePhoto: 'ఫోటో వాడండి',
    usePhotos: '{n} ఫోటోలు వాడండి',
    noFace: 'ఈ ఫోటోలో ముఖం కనబడలేదు',
    faceUnavailable: 'ఈ ఫోన్‌లో ముఖం బ్లర్ ఇంకా అందుబాటులో లేదు',
    facesBlurred: '{n} ముఖం(లు) బ్లర్ చేశాం',
    zoomHint: 'జూమ్ కోసం పించ్ చేయండి లేదా రెండుసార్లు నొక్కండి',
    imagePreview: 'ఫోటో ప్రివ్యూ',
    tooLarge: 'ఈ ఫోటో చాలా పెద్దది. వేరే ఎంపిక ప్రయత్నించండి.',
  },
  Hindi: {
    original: 'ओरिजिनल',
    blur: 'ब्लर',
    removeBg: 'BG हटाएँ',
    adjust: 'एडजस्ट',
    adjusted: 'एडजस्ट किया',
    blurFace: 'चेहरा ब्लर',
    photoOptions: 'फ़ोटो विकल्प',
    adjustTitle: 'फ़ोटो एडजस्ट करें',
    adjustHint: 'ज़ूम के लिए दो उंगलियों से पिंच करें, खिसकाने के लिए खींचें। फ़्रेम के अंदर का हिस्सा ही अपलोड होगा।',
    aspectPhoto: 'फ़ोटो',
    reset: 'रीसेट',
    cancel: 'रद्द करें',
    apply: 'लागू करें',
    usePhoto: 'फ़ोटो इस्तेमाल करें',
    usePhotos: '{n} फ़ोटो इस्तेमाल करें',
    noFace: 'इस फ़ोटो में कोई चेहरा नहीं मिला',
    faceUnavailable: 'इस फ़ोन पर चेहरा ब्लर अभी उपलब्ध नहीं है',
    facesBlurred: '{n} चेहरे ब्लर किए',
    zoomHint: 'ज़ूम के लिए पिंच या डबल-टैप करें',
    imagePreview: 'फ़ोटो प्रीव्यू',
    tooLarge: 'यह फ़ोटो बहुत बड़ी है। कोई दूसरा विकल्प आज़माएँ।',
  },
};

/** Label in the app language (falls back to English); {n} is replaced by n. */
export const photoText = (key: PhotoEditKey, lang?: AppLanguage | null, n?: number): string => {
  const table = (lang && PHOTO_EDIT_LABELS[lang]) || PHOTO_EDIT_LABELS.English;
  const s = table[key] || PHOTO_EDIT_LABELS.English[key];
  return n == null ? s : s.replace('{n}', String(n));
};

/** Short note after "Blur face": how many faces were blurred, none found, or not available. */
export const faceMessage = (faces: number | undefined | null, lang?: AppLanguage | null): string => {
  if (faces == null || faces < 0) return photoText('faceUnavailable', lang);
  if (faces === 0) return photoText('noFace', lang);
  return photoText('facesBlurred', lang, faces);
};
