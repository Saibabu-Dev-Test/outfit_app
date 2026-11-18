// Review text checks for the civic tabs: profanity / abuse filter (English, Hindi and Telugu
// words in Latin script plus a few in Devanagari / Telugu script), phone-number and link removal.
// Deliberately small and conservative; the owner can still hide anything via moderation.
const WORDS = [
  // English
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cunt', 'whore', 'slut', 'retard',
  // Hindi (Latin)
  'chutiya', 'chutiye', 'madarchod', 'behenchod', 'bhenchod', 'bhosdike', 'bhosdi', 'gandu', 'randi', 'harami', 'kutta', 'kamina', 'lauda', 'lavda', 'lund',
  // Telugu (Latin)
  'dengu', 'dengey', 'lanja', 'lanjakoduku', 'naakodaka', 'puku', 'modda', 'gudda', 'kojja', 'sulli', 'erripuku',
  // Devanagari / Telugu script
  'चूतिया', 'मादरचोद', 'भेनचोद', 'रंडी', 'गांडू', 'హరామి', 'లంజ', 'దెంగు', 'మొడ్డ', 'పూకు',
];

const norm = s =>
  String(s || '')
    .toLowerCase()
    .replace(/[@]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[$5]/g, 's')
    .replace(/(.)\1{2,}/g, '$1$1');

export function hasProfanity(text) {
  const t = norm(text);
  const tokens = t.split(/[^\p{L}\p{M}]+/u).filter(Boolean);
  const squashed = t.replace(/[^\p{L}\p{M}]+/gu, '');
  return WORDS.some(w => tokens.includes(w) || (w.length >= 6 && squashed.includes(w)));
}

// Strip links and phone numbers (privacy / spam) and collapse whitespace
export function cleanReviewText(text, max = 1000) {
  return String(text || '')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '')
    .replace(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g, '')
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}
