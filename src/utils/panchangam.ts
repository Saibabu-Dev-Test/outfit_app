// Traditional vaara (weekday) colours by ruling graha. Guidance only: tithi/nakshatra are not computed.

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
    why: 'Sunday is ruled by Surya (Sun); red and orange are his colours, believed to bring confidence, energy and success.',
  },
  {
    weekday: 'Monday',
    vaara: 'Somavaram',
    graha: 'Chandra (Moon)',
    colours: [
      { name: 'White', hex: '#F5F5F5' },
      { name: 'Silver', hex: '#B0BEC5' },
    ],
    why: 'Monday is ruled by Chandra (Moon); white and silver are his colours, believed to bring calm, peace and a clear mind.',
  },
  {
    weekday: 'Tuesday',
    vaara: 'Mangalavaram',
    graha: 'Kuja / Mangala (Mars)',
    colours: [
      { name: 'Red', hex: '#C62828' },
      { name: 'Coral', hex: '#FF7043' },
    ],
    why: 'Tuesday is ruled by Kuja / Mangala (Mars); red and coral are his colours, believed to bring courage and strength.',
  },
  {
    weekday: 'Wednesday',
    vaara: 'Budhavaram',
    graha: 'Budha (Mercury)',
    colours: [{ name: 'Green', hex: '#388E3C' }],
    why: 'Wednesday is ruled by Budha (Mercury); green is his colour, believed to bring sharp thinking, good speech and growth.',
  },
  {
    weekday: 'Thursday',
    vaara: 'Guruvaram',
    graha: 'Guru / Brihaspati (Jupiter)',
    colours: [{ name: 'Yellow', hex: '#FBC02D' }],
    why: 'Thursday is ruled by Guru (Jupiter); yellow is his colour, believed to bring wisdom and luck.',
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
    why: 'Friday is ruled by Shukra (Venus); white, pink and light blue are his colours, believed to bring beauty, love and harmony.',
  },
  {
    weekday: 'Saturday',
    vaara: 'Shanivaram',
    graha: 'Shani (Saturn)',
    colours: [
      { name: 'Black', hex: '#212121' },
      { name: 'Dark Blue', hex: '#1A237E' },
    ],
    why: 'Saturday is ruled by Shani (Saturn); black and dark blue are his colours, worn to honour Shani and stay steady and protected.',
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
