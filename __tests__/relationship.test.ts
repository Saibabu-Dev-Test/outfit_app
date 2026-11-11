import { PROSE } from '../src/i18n/astroProse';
import { dailyReading, maritalKind } from '../src/services/astrologyDaily';
import { istInstant } from '../src/utils/astro';

// Words that must never appear in the married relationship lines (dating / new romance)
const ROMANCE: Record<string, RegExp> = {
  English: /boyfriend|girlfriend|crush|dating|on a date|someone new|someone special|new romance|romance|the person you like/i,
  Telugu: /బాయ్‌?ఫ్రెండ్|గర్ల్‌?ఫ్రెండ్|ప్రియుడు|ప్రియురాలు|ప్రేమికుడు|ప్రేమికురాలు|కొత్త వ్యక్తి|నచ్చిన వారి|ప్రత్యేకమైన వారి|డేటింగ్/,
  Odia: /ବୟଫ୍ରେଣ୍ଡ|ଗର୍ଲଫ୍ରେଣ୍ଡ|ପ୍ରେମିକ|ପ୍ରେମିକା|ନୂଆ ମଣିଷ|ପସନ୍ଦର ମଣିଷ|ବିଶେଷ କାହା|ଡେଟିଂ/,
  Urdu: /بوائے ?فرینڈ|گرل ?فرینڈ|محبوب|محبوبہ|عاشق|نیا شخص|پسندیدہ شخص|کسی خاص|ڈیٹنگ/,
};
// Day-by-day predictions about specific family members ("you'll see / call your mother")
const MEMBERS: Record<string, RegExp> = {
  English: /\b(mother|father|mom|dad|brother|sister|aunt|uncle|grandma|grandpa)\b/i,
  Telugu: /అమ్మ|నాన్న|అన్న|తమ్ముడు|అక్క|చెల్లి|అత్త|మామ/,
  Odia: /ମାଆ|ବାପା|ଭାଇ|ଭଉଣୀ|ମାଉସୀ|ମାମୁଁ/,
  Urdu: /والدہ|والد|ماں|ابو|بھائی|بہن|خالہ|ماموں/,
};
const MARRIED_KEYS = ['relTitleM', 'relHighM', 'relGoodM', 'relGentleM', 'outing'] as const;

describe('relationship lines by marital status', () => {
  it('maps the profile value', () => {
    expect(maritalKind('Married')).toBe('married');
    expect(maritalKind('single')).toBe('single');
    expect(maritalKind('Prefer not to say')).toBe('unsaid');
    expect(maritalKind(undefined)).toBe('unsaid');
  });

  Object.keys(ROMANCE).forEach(lang => {
    it(`${lang}: married templates never mention dating or new romance`, () => {
      const t = PROSE[lang as keyof typeof PROSE]!.t;
      MARRIED_KEYS.forEach(k => {
        expect(t[k].trim().length).toBeGreaterThan(0);
        expect(t[k]).not.toMatch(ROMANCE[lang]);
      });
    });

    it(`${lang}: no template predicts a specific family member`, () => {
      const p = PROSE[lang as keyof typeof PROSE]!;
      const all = [
        ...Object.values(p.t),
        ...p.benefit,
        ...p.generalDo.flat(),
        ...p.house.flatMap(h => [...h.overview, h.mood, ...h.do, h.avoid]),
      ];
      all.forEach(s => expect(s).not.toMatch(MEMBERS[lang]));
      // single / neutral lines stay respectful too
      ['relHighS', 'relGoodS', 'relGentleS'].forEach(k => expect(p.t[k as 'relHighS']).not.toMatch(ROMANCE[lang]));
    });
  });

  it('married readings talk about family, with a family-outing day, over a whole month', () => {
    const base = { name: 'Sai', dob: '1996-11-25', timeOfBirth: '06:10 AM', placeOfBirth: 'Hyderabad, Telangana', gender: 'Female' };
    for (let d = 1; d <= 30; d++) {
      const date = new Date(istInstant(2026, 11, d, 9));
      (['English', 'Telugu', 'Odia', 'Urdu'] as const).forEach(lang => {
        const m = dailyReading({ ...base, maritalStatus: 'Married' }, { date, lang });
        expect(m.relation.kind).toBe('married');
        expect(m.relation.outing).toBeTruthy();
        const text = [m.relation.title, m.relation.text, m.relation.outing, m.overview, m.mood, ...m.doList, ...m.avoidList].join(' ');
        expect(text).not.toMatch(ROMANCE[lang]);
        expect(text).not.toMatch(MEMBERS[lang]);
        const s = dailyReading({ ...base, maritalStatus: 'Single' }, { date, lang });
        expect(s.relation.kind).toBe('single');
        expect(s.relation.outing).toBeNull();
        expect([s.relation.text, s.overview, ...s.doList].join(' ')).not.toMatch(MEMBERS[lang]);
      });
    }
  });
});
