// Traditional vaara (weekday) colours by ruling graha. Guidance only: tithi/nakshatra are not computed.
// The day is always the Asia/Kolkata (IST) calendar day, whatever the device time zone is.

export interface VaaraColour {
  weekday: string;
  vaara: string;
  graha: string;
  colours: { name: string; hex: string }[];
  why: string;
  // Positive lines for the day; one is picked per date so it changes week to week
  messages: string[];
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
    messages: [
      'Shine bright today: your confidence lights up every room you walk into.',
      'Like the Sun, rise strong and give today your full energy.',
      'Lead with warmth today; success follows a bold heart.',
      'Today is yours to own. Step out, stand tall and go for it.',
    ],
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
    messages: [
      'Start the week calm and clear; a peaceful mind makes the best choices.',
      'Let today flow gently. Small, steady steps carry you far.',
      'Keep your heart light today and kindness will come back to you.',
      'Fresh week, fresh start: you are ready for whatever it brings.',
    ],
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
    messages: [
      'Be brave today. The task you have been putting off is smaller than you think.',
      'Your courage is your superpower today. Take the first step.',
      'Push through today with strength; every effort counts.',
      'Face today head on. You are stronger than any challenge in front of you.',
    ],
  },
  {
    weekday: 'Wednesday',
    vaara: 'Budhavaram',
    graha: 'Budha (Mercury)',
    colours: [{ name: 'Green', hex: '#388E3C' }],
    why: 'Wednesday is ruled by Budha (Mercury); green is his colour, believed to bring sharp thinking, good speech and growth.',
    messages: [
      'Think sharp and speak kind today; your words open doors.',
      'Learn one new thing today and watch yourself grow.',
      'Ideas flow easily today. Write them down and act on one.',
      'Stay curious today: clever choices lead to big wins.',
    ],
  },
  {
    weekday: 'Thursday',
    vaara: 'Guruvaram',
    graha: 'Guru / Brihaspati (Jupiter)',
    colours: [{ name: 'Yellow', hex: '#FBC02D' }],
    why: 'Thursday is ruled by Guru (Jupiter); yellow is his colour, believed to bring wisdom and luck.',
    messages: [
      'Good luck is on your side today. Share your wisdom generously.',
      'Today rewards patience and a positive heart. Keep going.',
      'Be grateful today; blessings grow when you count them.',
      "Aim high today. Guru's grace supports honest effort.",
    ],
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
    messages: [
      'Spread a little love today: compliment someone and make their day.',
      'Let your style speak today. You look and feel wonderful.',
      'Enjoy the beauty around you today; joy is everywhere.',
      'Harmony starts with you today. Smile, and the world smiles back.',
    ],
  },
  {
    weekday: 'Saturday',
    vaara: 'Shanivaram',
    graha: 'Shani (Saturn)',
    colours: [
      { name: 'Blue', hex: '#1565C0' },
      { name: 'Black', hex: '#212121' },
      { name: 'Navy', hex: '#1A237E' },
    ],
    why: 'Saturday is ruled by Shani (Saturn); blue, black and navy are his colours, worn to honour Shani and stay steady, disciplined and protected.',
    messages: [
      'Steady effort today builds the future you want. Keep at it.',
      'Discipline today is a gift to your tomorrow. You have got this.',
      'Slow and steady wins: finish what you started today.',
      'Stay grounded today. Patience turns hard work into results.',
    ],
  },
];

// The Asia/Kolkata calendar date of an instant. IST is UTC+5:30 all year (no daylight saving),
// so shifting the UTC time by 5h30m and reading the UTC fields gives the IST date on any device.
const IST_OFFSET_MS = 330 * 60 * 1000;
export const kolkataDate = (d: Date = new Date()): { year: number; month: number; day: number; weekday: number } => {
  const x = new Date(d.getTime() + IST_OFFSET_MS);
  return { year: x.getUTCFullYear(), month: x.getUTCMonth() + 1, day: x.getUTCDate(), weekday: x.getUTCDay() };
};

export const getTodayVaaraColour = (d: Date = new Date()): VaaraColour => VAARA[kolkataDate(d).weekday];

// Today's positive line: rotates by IST day number, so the same weekday shows a different line next week
export const getTodayLuckyMessage = (d: Date = new Date()): string => {
  const k = kolkataDate(d);
  const pool = VAARA[k.weekday].messages;
  const dayNumber = Math.floor(Date.UTC(k.year, k.month - 1, k.day) / 86400000);
  const week = Math.floor(dayNumber / 7);
  return pool[((week % pool.length) + pool.length) % pool.length];
};

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
