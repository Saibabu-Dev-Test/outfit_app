// Me > 🔮 Astrology (జాతకం): today's reading, computed on the phone (no network, no AI, instant).
// Inputs: the saved profile (name, dob, time + place of birth, rashi, gender, language) + today's
// IST date (+ the user's wardrobe for a dress pick). Same user + same date = same text.
// Method (traditional, simplified): today's panchang at Hyderabad sunrise (utils/astro.ts), the
// birth chart (utils/jathakam.ts: Lahiri Moon / Lagna / nakshatra / dasha at the birth place),
// Chandrabalam (today's Moon sign counted from the birth Moon sign), Tarabalam (today's star
// counted from the birth star), weekday ruling planet colours (utils/panchangam.ts), the rashi
// lord's colour and the user's own wardrobe (services/luckyPairs.ts). Without a dob: the saved
// rashi, else the name star (first syllable of the name, e.g. Sai -> Shatabhisha).
// 12 languages: labels / names in all (i18n/astroLabels, astroNames), prose where written
// (i18n/astroProse). Wording is always positive; guidance for fun and reflection, not a promise.
import {
  birthChart,
  BirthChart,
  chandraHouse,
  GOOD_HOUSES,
  GOOD_TARAS,
  hashString,
  istClock12,
  nakshatraLord,
  Panchang,
  panchangFor,
  pick,
  RASHI_LORD,
  rashiIndex,
  taraOf,
} from '../utils/astro';
import { getTodayVaaraColour } from '../utils/panchangam';
import { computeJathakam, DEFAULT_PLACE, Jathakam, nameStar } from '../utils/jathakam';
import { birthPlaceOf } from '../constants/indianCities';
import { pickLuckyPairs } from './luckyPairs';
import type { AiLanguage } from './aiStylist';
import type { WardrobeItemResponse } from './wardrobeApi';
import {
  AstroLang,
  astroLanguage,
  colourName,
  GANA_NAMES,
  NADI_NAMES,
  NAKSHATRA_NAMES,
  PLANET_NAMES,
  RASHI_NAMES,
  tithiName,
  WEEKDAY_NAMES,
  YONI_NAMES,
} from '../i18n/astroNames';
import { LABELS } from '../i18n/astroLabels';
import { hasOwnProse, proseFor } from '../i18n/astroProse';

export type { AstroLang };
export { astroLanguage };

export interface AstroProfile {
  name?: string | null;
  dob?: string | null;
  timeOfBirth?: string | null;
  placeOfBirth?: string | null;
  rashi?: string | null;
  gender?: string | null;
  language?: string | null;
}

export interface DailyReading {
  dayKey: string;
  lang: AstroLang;
  proseLang: AstroLang; // language the long texts are in (English when `lang` has no prose yet)
  chart: BirthChart | null;
  jathakam: Jathakam | null;
  chartRows: { label: string; value: string }[]; // the birth-chart card
  needsDob: boolean; // no saved rashi, no dob and no usable name: ask for the date of birth
  panchang: { label: string; value: string }[];
  rashiLine: string | null;
  note: string | null; // e.g. "approximate: add your time of birth"
  stars: number; // 3..5, always encouraging
  greeting: string;
  overview: string;
  mood: string;
  doList: string[];
  avoidList: string[];
  luckyTime: string;
  calmTime: string;
  dress: {
    colours: { name: string; hex: string }[];
    title: string;
    why: string;
    idea: string;
    pair: { top: WardrobeItemResponse; bottom: WardrobeItemResponse; why: string } | null;
  };
  crush: { level: 'high' | 'good' | 'gentle'; title: string; text: string };
}

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ymd = (ms: number) => {
  const d = new Date(ms + 330 * 60000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const degText = (x: number) => {
  const d = Math.floor(x % 30);
  const m = Math.floor(((x % 30) - d) * 60);
  return `${d}°${String(m).padStart(2, '0')}′`;
};
// The Stylist's languages (wardrobe pair reasons): English, Telugu, Hindi
const aiLang = (l: AstroLang): AiLanguage => (l === 'Telugu' || l === 'Hindi' ? l : 'English');

// Colour of each planet (Sun..Saturn) for the rashi-lord touch (English names, localized on use)
const PLANET_COLOUR: { en: string; hex: string }[] = [
  { en: 'Orange / Gold', hex: '#F57C00' },
  { en: 'White / Silver', hex: '#ECEFF1' },
  { en: 'Red', hex: '#C62828' },
  { en: 'Green', hex: '#388E3C' },
  { en: 'Yellow', hex: '#FBC02D' },
  { en: 'White / Pink', hex: '#F8BBD0' },
  { en: 'Blue / Navy', hex: '#1565C0' },
];

const planetName = (p: number, lang: AstroLang) => PLANET_NAMES[lang][p];
// Short planet name for "{hora} hora": the part in brackets in English ('Sun'), else the name
const shortPlanet = (p: number, lang: AstroLang) => {
  const n = PLANET_NAMES[lang][p];
  return lang === 'English' ? n.match(/\(([^)]+)\)/)?.[1] || n : n.replace(/\s*\(.*\)$/, '');
};

// First daytime hora (after 7 AM, before sunset) ruled by `planet` that does not overlap Rahu kalam
const horaFor = (p: Panchang, planet: number) =>
  p.horas.find(h => h.planet === planet && h.start >= p.sunrise + 30 * 60000 && !(h.start < p.rahu.end && h.end > p.rahu.start)) ||
  null;

// Birth chart from the profile: computed chart (dob) > saved rashi > name star
const chartFor = (profile: AstroProfile): { chart: BirthChart | null; jathakam: Jathakam | null; fromName: boolean } => {
  const place = birthPlaceOf(profile.placeOfBirth) || DEFAULT_PLACE;
  const j = computeJathakam(profile, place);
  const saved = rashiIndex(profile.rashi);
  if (j) {
    const rashi = saved >= 0 ? saved : j.rashi;
    const starOk = Math.floor((j.nakshatra * 4 + j.pada) / 9) === rashi;
    return {
      chart: {
        rashi,
        rashiSource: saved >= 0 ? 'saved' : 'computed',
        nakshatra: starOk ? j.nakshatra : null,
        pada: starOk ? j.pada : null,
        timeKnown: j.timeKnown,
        uncertain: j.uncertain,
      },
      jathakam: j,
      fromName: false,
    };
  }
  const legacy = birthChart(profile); // saved rashi only
  if (legacy) return { chart: legacy, jathakam: null, fromName: false };
  const ns = nameStar(profile.name);
  if (!ns) return { chart: null, jathakam: null, fromName: false };
  return {
    chart: { rashi: Math.floor((ns.nakshatra * 4 + ns.pada) / 9), rashiSource: 'computed', nakshatra: ns.nakshatra, pada: ns.pada, timeKnown: false, uncertain: false },
    jathakam: null,
    fromName: true,
  };
};

export const dailyReading = (
  profile: AstroProfile,
  opts: { uid?: string | null; date?: Date; lang?: AstroLang; wardrobe?: WardrobeItemResponse[] | null } = {},
): DailyReading => {
  const date = opts.date || new Date();
  const lang = opts.lang || astroLanguage(profile.language);
  const L = LABELS[lang];
  const prose = proseFor(lang);
  const t = prose.t;
  const proseLang: AstroLang = hasOwnProse(lang) ? lang : 'English';
  // Names follow the prose language inside sentences, the chosen language in labels / rows
  const pn = proseLang;
  const p = panchangFor(date);
  const { chart, jathakam, fromName } = chartFor(profile);
  const seed = hashString(`${opts.uid || profile.name || 'guest'}|${p.day.key}`);

  const nakName = (n: number, l: AstroLang = lang) => NAKSHATRA_NAMES[l][n];
  const rashiName = (r: number, l: AstroLang = lang) => RASHI_NAMES[l][r];
  const weekdayOf = (l: AstroLang) => WEEKDAY_NAMES[l][p.day.weekday];

  const panchang = [
    { label: L.tithi, value: tithiName(p.tithi, lang) },
    { label: L.nakshatra, value: nakName(p.nakshatra) },
    { label: L.vaara, value: `${weekdayOf(lang)} · ${planetName(p.weekdayLord, lang)}` },
    { label: L.moon, value: rashiName(p.moonRashi) },
    { label: L.sun, value: `${istClock12(p.sunrise)} / ${istClock12(p.sunset)}` },
  ];

  // Personal strength: Chandrabalam (+ Tarabalam when the birth star is known). Always 3..5 stars.
  let house = 0;
  let stars = 3 + (seed % 2);
  let overview: string;
  let mood: string;
  let doList: string[];
  let avoidList: string[];
  if (chart) {
    house = chandraHouse(chart.rashi, p.moonRashi);
    const h = prose.house[house - 1];
    const goodHouse = GOOD_HOUSES.has(house);
    const tara = chart.nakshatra !== null ? taraOf(chart.nakshatra, p.nakshatra) : 0;
    const goodTara = tara ? GOOD_TARAS.has(tara) : seed % 3 !== 0;
    stars = Math.min(5, 3 + (goodHouse ? 1 : 0) + (goodTara ? 1 : 0));
    overview = pick(h.overview, seed);
    mood = h.mood;
    doList = [...h.do, pick(prose.generalDo[p.weekdayLord], seed, 1)];
    avoidList = [h.avoid];
  } else {
    overview = fill(t.generalOverview, { day: weekdayOf(pn), planet: planetName(p.weekdayLord, pn) });
    mood = t.generalMood;
    doList = [...prose.generalDo[p.weekdayLord]];
    avoidList = [t.generalAvoid];
  }

  // Lucky time: the rashi lord's hora (else the weekday lord's), and Abhijit muhurtam
  const lord = chart ? RASHI_LORD[chart.rashi] : p.weekdayLord;
  const hora = horaFor(p, lord) || horaFor(p, p.weekdayLord);
  const luckyParts: string[] = [];
  if (hora) {
    const v = { hora: shortPlanet(hora.planet, pn), from: istClock12(hora.start), to: istClock12(hora.end), planet: planetName(hora.planet, pn) };
    luckyParts.push(fill(chart && hora.planet === lord ? t.lucky : t.luckyHora, v));
  }
  if (p.abhijit) luckyParts.push(fill(t.luckyAbhijit, { from: istClock12(p.abhijit.start), to: istClock12(p.abhijit.end) }));
  const calmTime = fill(t.calm, { from: istClock12(p.rahu.start), to: istClock12(p.rahu.end) });

  // Dress: weekday colours first, the rashi lord's colour as a touch, wardrobe pick when possible
  const vaara = getTodayVaaraColour(date);
  const words = (l: AstroLang) => vaara.colours.map(c => colourName(c.name, l)).join(' / ');
  const lc = PLANET_COLOUR[lord];
  const why = [
    fill(t.whyVaara, { day: weekdayOf(pn), planet: planetName(p.weekdayLord, pn), colours: words(pn), benefit: prose.benefit[p.weekdayLord] }),
    chart ? fill(t.whyRashi, { rashi: rashiName(chart.rashi, pn), lord: planetName(lord, pn), lordColour: pn === 'English' ? lc.en.toLowerCase() : colourName(lc.en, pn) }) : '',
    fill(t.whyStar, { star: nakName(p.nakshatra, pn), starLord: planetName(nakshatraLord(p.nakshatra), pn) }),
  ]
    .filter(Boolean)
    .join(' ');
  const g = (profile.gender || '').toLowerCase();
  const firstColour = colourName(vaara.colours[seed % vaara.colours.length].name, pn);
  const idea = fill(g.startsWith('f') ? t.ideaF : g.startsWith('m') ? t.ideaM : t.ideaO, {
    c: pn === 'English' ? firstColour.toLowerCase() : firstColour,
  });
  let pair: DailyReading['dress']['pair'] = null;
  if (opts.wardrobe && opts.wardrobe.length) {
    const r = pickLuckyPairs(opts.wardrobe, aiLang(lang), { date, max: 1 });
    if (r.pairs[0]) pair = { top: r.pairs[0].top, bottom: r.pairs[0].bottom, why: r.pairs[0].why };
  }
  const colours = vaara.colours.map(c => ({ name: colourName(c.name, lang), hex: c.hex }));
  if (chart && !vaara.colours.some(c => lc.en.toLowerCase().includes(c.name.toLowerCase()))) {
    colours.push({ name: colourName(lc.en, lang), hex: lc.hex });
  }

  // "Chance to see the person you like": 5th / 7th / 11th house, Friday, Venus / Moon signs
  let score = seed % 3;
  if ([5, 7, 11].includes(house)) score += 2;
  else if ([1, 3, 10].includes(house)) score += 1;
  if (p.day.weekday === 5) score += 1;
  if ([1, 6, 3].includes(p.moonRashi)) score += 1;
  const level: 'high' | 'good' | 'gentle' = score >= 4 ? 'high' : score >= 2 ? 'good' : 'gentle';
  const crushText = level === 'high' ? t.crushHigh : level === 'good' ? t.crushGood : t.crushGentle;

  const first = (profile.name || '').trim().split(/\s+/)[0];
  let note: string | null = null;
  const placeName = (jathakam?.place.name || DEFAULT_PLACE.name).split(',')[0];
  if (fromName) note = t.nameStar;
  else if (chart && chart.rashiSource === 'computed') note = chart.timeKnown ? fill(t.computed, { place: placeName }) : t.approx;
  else if (chart && chart.nakshatra !== null && !chart.timeKnown && chart.uncertain) note = t.approxStar;

  // Birth-chart card (labels and names in the chosen language)
  const chartRows: { label: string; value: string }[] = [];
  if (jathakam) {
    const j = jathakam;
    chartRows.push({ label: L.janmaRashi, value: `${rashiName(j.rashi)} · ${degText(j.moon)}` });
    chartRows.push({ label: L.nakshatra, value: `${nakName(j.nakshatra)} · ${L.pada} ${j.pada + 1}` });
    if (j.lagnaRashi !== null && j.lagna !== null) chartRows.push({ label: L.lagna, value: `${rashiName(j.lagnaRashi)} · ${degText(j.lagna)}` });
    if (j.mahadasha) chartRows.push({ label: L.mahadasha, value: `${planetName(j.mahadasha.lord, lang)} · ${fill(L.until, { date: ymd(j.mahadasha.end) })}` });
    if (j.antardasha) chartRows.push({ label: L.antardasha, value: `${planetName(j.antardasha.lord, lang)} · ${fill(L.until, { date: ymd(j.antardasha.end) })}` });
    chartRows.push({ label: L.birthTithi, value: tithiName(j.tithi, lang) });
    chartRows.push({ label: L.gana, value: GANA_NAMES[lang][j.gana] });
    chartRows.push({ label: L.yoni, value: YONI_NAMES[lang][j.yoni] });
    chartRows.push({ label: L.nadi, value: NADI_NAMES[lang][j.nadi] });
    chartRows.push({ label: L.lifePath, value: String(j.lifePath) });
    chartRows.push({ label: L.birthNumber, value: String(j.birthNumber) });
    if (j.nameNumber) chartRows.push({ label: L.nameNumber, value: String(j.nameNumber) });
    chartRows.push({ label: L.place, value: j.place.name });
  } else if (fromName && chart && chart.nakshatra !== null) {
    chartRows.push({ label: L.nameStar, value: `${nakName(chart.nakshatra)} · ${L.pada} ${(chart.pada || 0) + 1}` });
    chartRows.push({ label: L.janmaRashi, value: rashiName(chart.rashi) });
  }

  return {
    dayKey: p.day.key,
    lang,
    proseLang,
    chart,
    jathakam,
    chartRows,
    needsDob: !chart,
    panchang,
    rashiLine: chart
      ? chart.nakshatra !== null
        ? fill(t.rashiStar, { rashi: rashiName(chart.rashi, pn), star: nakName(chart.nakshatra, pn) })
        : fill(t.rashiLine, { rashi: rashiName(chart.rashi, pn) })
      : null,
    note,
    stars,
    greeting: first ? fill(t.greeting, { name: first }) : t.greetingNoName,
    overview,
    mood,
    doList,
    avoidList,
    luckyTime: luckyParts.join(' · '),
    calmTime,
    dress: { colours, title: fill(t.dressTitle, { colours: words(pn) }), why, idea, pair },
    crush: { level, title: t.crushTitle, text: crushText },
  };
};
