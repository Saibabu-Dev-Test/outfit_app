// Traditional vaara (weekday) colours. Guidance only, not a computed panchangam.

export interface VaaraColour {
  weekday: string;
  vaara: string;
  graha: string;
  colours: { name: string; hex: string }[];
  why: string;
}

const VAARA: VaaraColour[] = [
  {
    weekday: 'Sunday',
    vaara: 'Ravivaram',
    graha: 'Surya (Sun)',
    colours: [
      { name: 'Red', hex: '#D32F2F' },
      { name: 'Orange', hex: '#F57C00' },
    ],
    why: 'Sunday is ruled by Surya. Red and orange reflect the Sun\u2019s energy, confidence and vitality.',
  },
  {
    weekday: 'Monday',
    vaara: 'Somavaram',
    graha: 'Chandra (Moon)',
    colours: [
      { name: 'White', hex: '#F5F5F5' },
      { name: 'Silver', hex: '#B0BEC5' },
    ],
    why: 'Monday is ruled by Chandra. White and silver echo moonlight and bring calm and clarity.',
  },
  {
    weekday: 'Tuesday',
    vaara: 'Mangalavaram',
    graha: 'Kuja / Mangala (Mars)',
    colours: [
      { name: 'Red', hex: '#C62828' },
      { name: 'Coral', hex: '#FF7043' },
    ],
    why: 'Tuesday is ruled by Kuja. Red and coral stand for courage, strength and drive.',
  },
  {
    weekday: 'Wednesday',
    vaara: 'Budhavaram',
    graha: 'Budha (Mercury)',
    colours: [{ name: 'Green', hex: '#388E3C' }],
    why: 'Wednesday is ruled by Budha. Green is linked to intellect, communication and growth.',
  },
  {
    weekday: 'Thursday',
    vaara: 'Guruvaram',
    graha: 'Guru / Brihaspati (Jupiter)',
    colours: [{ name: 'Yellow', hex: '#FBC02D' }],
    why: 'Thursday is ruled by Guru. Yellow stands for wisdom, learning and good fortune.',
  },
  {
    weekday: 'Friday',
    vaara: 'Shukravaram',
    graha: 'Shukra (Venus)',
    colours: [
      { name: 'White', hex: '#F5F5F5' },
      { name: 'Pink', hex: '#F48FB1' },
      { name: 'Light Blue', hex: '#81D4FA' },
    ],
    why: 'Friday is ruled by Shukra. Soft whites, pinks and light blues reflect beauty, love and harmony.',
  },
  {
    weekday: 'Saturday',
    vaara: 'Shanivaram',
    graha: 'Shani (Saturn)',
    colours: [
      { name: 'Black', hex: '#212121' },
      { name: 'Dark Blue', hex: '#1A237E' },
    ],
    why: 'Saturday is ruled by Shani. Black and dark blue are traditionally worn to honour Shani and stay grounded.',
  },
];

export const getTodayVaaraColour = (d: Date = new Date()): VaaraColour => VAARA[d.getDay()];

export const RASHIS = [
  'Mesha (Aries)',
  'Vrishabha (Taurus)',
  'Mithuna (Gemini)',
  'Karka (Cancer)',
  'Simha (Leo)',
  'Kanya (Virgo)',
  'Tula (Libra)',
  'Vrischika (Scorpio)',
  'Dhanu (Sagittarius)',
  'Makara (Capricorn)',
  'Kumbha (Aquarius)',
  'Meena (Pisces)',
];

// Lucky colour by rashi lord
const RASHI_LUCKY: { keys: string[]; lord: string; colour: string }[] = [
  { keys: ['mesha', 'aries', 'vrischika', 'scorpio'], lord: 'Kuja (Mars)', colour: 'Red' },
  { keys: ['vrishabha', 'taurus', 'tula', 'libra'], lord: 'Shukra (Venus)', colour: 'White' },
  { keys: ['mithuna', 'gemini', 'kanya', 'virgo'], lord: 'Budha (Mercury)', colour: 'Green' },
  { keys: ['karka', 'cancer'], lord: 'Chandra (Moon)', colour: 'White / Silver' },
  { keys: ['simha', 'leo'], lord: 'Surya (Sun)', colour: 'Orange / Gold' },
  { keys: ['dhanu', 'sagittarius', 'meena', 'pisces'], lord: 'Guru (Jupiter)', colour: 'Yellow' },
  { keys: ['makara', 'capricorn', 'kumbha', 'aquarius'], lord: 'Shani (Saturn)', colour: 'Blue / Black' },
];

export const getRashiLuckyColour = (
  rashi?: string | null,
): { rashi: string; lord: string; colour: string } | null => {
  if (!rashi) return null;
  const r = rashi.toLowerCase();
  const hit = RASHI_LUCKY.find(x => x.keys.some(k => r.includes(k)));
  return hit ? { rashi, lord: hit.lord, colour: hit.colour } : null;
};
