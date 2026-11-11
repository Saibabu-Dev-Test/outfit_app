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
// (i18n/astroProse). The honest verdict (utils/astroVerdict.ts) adds a Good / Mixed / Caution
// rating with Positive and Be careful bullets, inauspicious times and remedies: weak days
// (Ashtama Chandra, Vipat / Pratyak / Naidhana tara, Sade Sati...) are said plainly.
// Traditional guidance for reflection, not a promise.
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
import { hasOwnVerdict, LABELS, verdictFor } from '../i18n/astroLabels';
import {
  Area,
  AREAS,
  assessDay,
  AVOID_COLOUR,
  DayRating,
  durmuhurtam,
  remedyPlanet,
  saturnRashiAt,
  yamagandam,
} from '../utils/astroVerdict';
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
  maritalStatus?: string | null; // 'Single' | 'Married' | 'Prefer not to say'
}

export type MaritalKind = 'married' | 'single' | 'unsaid';
// Profile marital status -> how relationship lines are worded (married: spouse and family only)
export const maritalKind = (v?: string | null): MaritalKind => {
  const s = (v || '').trim().toLowerCase();
  if (s.startsWith('married')) return 'married';
  if (s.startsWith('single')) return 'single';
  return 'unsaid';
};

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
  stars: number; // 1..5 from the verdict (Caution 1-2, Mixed 3, Good 4-5)
  verdict: DayVerdict | null; // null without a birth chart
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
  // Relationship card: married -> spouse and family at home (+ a good day for a family outing),
  // single / not said -> neutral friendships and connections. Never predicts specific people.
  relation: { kind: MaritalKind; level: 'high' | 'good' | 'gentle'; title: string; text: string; outing: string | null };
}

export interface VerdictBullet {
  area: Area;
  areaLabel: string;
  text: string;
}
export interface DayVerdict {
  lang: AstroLang; // language of the texts (English when `lang` has no verdict text yet)
  rating: DayRating;
  ratingLabel: string;
  summary: string;
  positives: VerdictBullet[];
  cautions: VerdictBullet[];
  badTimes: { label: string; value: string }[];
  remedies: { label: string; value: string }[];
  headings: { title: string; positive: string; careful: string; remedies: string; badTimes: string; timingLine: string };
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
const chartFor = (profile: AstroProfile, nowMs: number): { chart: BirthChart | null; jathakam: Jathakam | null; fromName: boolean } => {
  const place = birthPlaceOf(profile.placeOfBirth) || DEFAULT_PLACE;
  const j = computeJathakam(profile, place, nowMs);
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

// Birth-chart rows (labels and names in `lang`): rashi, nakshatra + pada, Lagna (with a birth
// time), Mahadasha / Antardasha (current), birth tithi, gana, yoni, nadi, numerology, place.
// Used by the Astrology tab and the Profile's auto-filled birth chart.
export const birthChartRows = (j: Jathakam, lang: AstroLang): { key: string; label: string; value: string }[] => {
  const L = LABELS[lang];
  const rows: { key: string; label: string; value: string }[] = [];
  const add = (key: string, label: string, value: string) => rows.push({ key, label, value });
  add('rashi', L.janmaRashi, `${RASHI_NAMES[lang][j.rashi]} · ${degText(j.moon)}`);
  add('nakshatra', L.nakshatra, `${NAKSHATRA_NAMES[lang][j.nakshatra]} · ${L.pada} ${j.pada + 1}`);
  if (j.lagnaRashi !== null && j.lagna !== null) add('lagna', L.lagna, `${RASHI_NAMES[lang][j.lagnaRashi]} · ${degText(j.lagna)}`);
  if (j.mahadasha) add('mahadasha', L.mahadasha, `${planetName(j.mahadasha.lord, lang)} · ${fill(L.until, { date: ymd(j.mahadasha.end) })}`);
  if (j.antardasha) add('antardasha', L.antardasha, `${planetName(j.antardasha.lord, lang)} · ${fill(L.until, { date: ymd(j.antardasha.end) })}`);
  add('tithi', L.birthTithi, tithiName(j.tithi, lang));
  add('gana', L.gana, GANA_NAMES[lang][j.gana]);
  add('yoni', L.yoni, YONI_NAMES[lang][j.yoni]);
  add('nadi', L.nadi, NADI_NAMES[lang][j.nadi]);
  add('lifePath', L.lifePath, String(j.lifePath));
  add('birthNumber', L.birthNumber, String(j.birthNumber));
  if (j.nameNumber) add('nameNumber', L.nameNumber, String(j.nameNumber));
  add('place', L.place, j.place.name);
  return rows;
};

// Honest verdict for the day: traditional factors (utils/astroVerdict.ts) -> rating, Positive /
// Be careful bullets by life area, inauspicious times and remedies. Same user + day = same text.
const HOUSE_AREA: Record<number, Area> = { 1: 'health', 2: 'money', 3: 'work', 4: 'travel', 5: 'relationships', 6: 'health', 7: 'relationships', 9: 'travel', 10: 'work', 11: 'money', 12: 'money' };
export const buildVerdict = (chart: BirthChart, jathakam: Jathakam | null, p: Panchang, lang: AstroLang, seed: number): DayVerdict => {
  const vl: AstroLang = hasOwnVerdict(lang) ? lang : 'English';
  const V = verdictFor(vl);
  const md = jathakam?.mahadasha?.lord ?? null;
  const ad = jathakam?.antardasha?.lord ?? null;
  const a = assessDay({
    janmaRashi: chart.rashi,
    janmaStar: chart.nakshatra,
    moonRashi: p.moonRashi,
    todayStar: p.nakshatra,
    weekdayLord: p.weekdayLord,
    saturnRashi: saturnRashiAt(p.sunrise),
    mahadashaLord: md,
    antardashaLord: ad,
  });
  const v = {
    tara: a.tara ? V.taras[a.tara - 1] : '',
    day: PLANET_NAMES[vl][p.weekdayLord],
    lord: md !== null ? PLANET_NAMES[vl][md] : '',
  };
  // Texts never repeat the area: the panel shows "Area: text"
  const b = (area: Area, text: string): VerdictBullet => ({ area, areaLabel: V.areas[area], text: fill(text, v) });
  const positives: VerdictBullet[] = [];
  const cautions: VerdictBullet[] = [];
  a.plus.forEach(f => {
    if (f === 'chandraGood') positives.push(b(HOUSE_AREA[a.house], V.chandraGood[a.house]));
    else if (f === 'taraGood') positives.push(b('work', V.taraGood));
    else if (f === 'dashaFriend') positives.push(b('work', V.dashaFriend));
    else if (f === 'antarFriend' && ad !== null) positives.push(b('work', fill(V.antarFriend, { ...v, lord: PLANET_NAMES[vl][ad] })));
  });
  a.minus.forEach(f => {
    if (f === 'ashtamaChandra') cautions.push(b('travel', V.ashtamaChandra), b('health', V.ashtamaChandra2));
    else if (f === 'chandraBad') cautions.push(b(HOUSE_AREA[a.house], V.chandraBad[a.house]));
    else if (f === 'chandraMixed') cautions.push(b(HOUSE_AREA[a.house], V.chandraMixed[a.house]));
    else if (f === 'taraBad') cautions.push(b('work', V.taraBad));
    else if (f === 'taraJanma') cautions.push(b('health', V.taraJanma));
    else if (f === 'sadeSati') cautions.push(b('work', V[a.shani as 'sadeSatiRising' | 'sadeSatiPeak' | 'sadeSatiSetting']));
    else if (f === 'ashtamaShani') cautions.push(b('health', V.ashtamaShani));
    else if (f === 'ardhashtamaShani') cautions.push(b('relationships', V.ardhashtamaShani));
    else if (f === 'dashaEnemy') cautions.push(b('work', V.dashaEnemy));
    else if (f === 'antarEnemy' && ad !== null) cautions.push(b('work', fill(V.antarEnemy, { ...v, lord: PLANET_NAMES[vl][ad] })));
  });
  // Area advice: more Positive on good days, more Be careful on weak ones (areas rotate by user + day)
  const order = AREAS.map((ar, i) => ({ ar, k: Math.floor(seed / 8 ** i) % 97 })).sort((x, y) => x.k - y.k).map(x => x.ar);
  const extraGood = a.rating === 'good' ? 2 : a.rating === 'mixed' ? 1 : 0;
  const extraBad = a.rating === 'caution' ? 2 : 1;
  const used = new Set<Area>();
  order.filter(ar => !cautions.some(c => c.area === ar)).slice(0, extraGood).forEach(ar => {
    used.add(ar);
    positives.push(b(ar, V.goodArea[ar]));
  });
  order.filter(ar => !used.has(ar) && !positives.some(c => c.area === ar)).slice(0, extraBad).forEach(ar => cautions.push(b(ar, V.badArea[ar])));
  if (!positives.length) positives.push(b('work', V.quietPositive));

  const range = (r: { start: number; end: number }) => `${istClock12(r.start)} – ${istClock12(r.end)}`;
  const badTimes = [
    { label: V.rahu, value: range(p.rahu) },
    { label: V.yama, value: range(yamagandam(p.day.weekday, p.sunrise, p.sunset)) },
    { label: V.durmuhurtam, value: durmuhurtam(p.day.weekday, p.sunrise, p.sunset).map(range).join(', ') },
  ];
  const pl = remedyPlanet(a, p.weekdayLord, md);
  const remedies = [
    { label: V.deity, value: V.deities[pl] },
    { label: V.mantra, value: V.mantras[pl] },
    { label: V.donate, value: V.donations[pl] },
  ];
  if (a.taraKind === 'bad' && a.tara) remedies.push({ label: `${V.taraDonate} (${v.tara})`, value: V.taraGifts[a.tara] });
  remedies.push({ label: V.avoidColour, value: colourName(AVOID_COLOUR[p.weekdayLord], vl) });
  return {
    lang: vl,
    rating: a.rating,
    ratingLabel: V.rating[a.rating],
    summary: V.summary[a.rating],
    positives,
    cautions,
    badTimes,
    remedies,
    headings: { title: V.title, positive: V.positive, careful: V.careful, remedies: V.remedies, badTimes: V.badTimes, timingLine: V.timingLine },
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
  const { chart, jathakam, fromName } = chartFor(profile, date.getTime());
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

  // Personal strength: Chandrabalam (+ Tarabalam when the birth star is known); the verdict below sets the stars.
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

  // Honest verdict decides the stars: Good 4-5, Mixed 3, Caution 1-2
  const verdict = chart ? buildVerdict(chart, jathakam, p, lang, seed) : null;
  if (verdict) {
    const ashtama = house === 8;
    stars = verdict.rating === 'good' ? (stars >= 5 ? 5 : 4) : verdict.rating === 'mixed' ? 3 : ashtama ? 1 : 2;
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

  // Relationship card strength: 5th / 7th / 11th house, Friday, Venus / Moon signs
  let score = seed % 3;
  if ([5, 7, 11].includes(house)) score += 2;
  else if ([1, 3, 10].includes(house)) score += 1;
  if (p.day.weekday === 5) score += 1;
  if ([1, 6, 3].includes(p.moonRashi)) score += 1;
  const level: 'high' | 'good' | 'gentle' = score >= 4 ? 'high' : score >= 2 ? 'good' : 'gentle';
  const kind = maritalKind(profile.maritalStatus);
  const married = kind === 'married';
  const relText = married
    ? level === 'high' ? t.relHighM : level === 'good' ? t.relGoodM : t.relGentleM
    : level === 'high' ? t.relHighS : level === 'good' ? t.relGoodS : t.relGentleS;
  // Married: the best day in the coming week for a family outing (good Chandrabalam + Tarabalam,
  // weekends preferred)
  let outing: string | null = null;
  if (married && chart) {
    let best = -1;
    let bestDay: Panchang | null = null;
    for (let i = 0; i < 7; i++) {
      const q = i === 0 ? p : panchangFor(new Date(date.getTime() + i * 86400000));
      let sc = GOOD_HOUSES.has(chandraHouse(chart.rashi, q.moonRashi)) ? 2 : 0;
      if (chart.nakshatra !== null && GOOD_TARAS.has(taraOf(chart.nakshatra, q.nakshatra))) sc += 1;
      if (q.day.weekday === 0 || q.day.weekday === 6) sc += 1;
      if (sc > best) {
        best = sc;
        bestDay = q;
      }
    }
    if (bestDay) {
      const [, mo, dd] = bestDay.day.key.split('-').map(Number);
      outing = fill(t.outing, { date: `${WEEKDAY_NAMES[pn][bestDay.day.weekday]} ${dd} ${MONTHS[mo - 1]}` });
    }
  }

  const first = (profile.name || '').trim().split(/\s+/)[0];
  let note: string | null = null;
  const placeName = (jathakam?.place.name || DEFAULT_PLACE.name).split(',')[0];
  if (fromName) note = t.nameStar;
  else if (chart && chart.rashiSource === 'computed') note = chart.timeKnown ? fill(t.computed, { place: placeName }) : t.approx;
  else if (chart && chart.nakshatra !== null && !chart.timeKnown && chart.uncertain) note = t.approxStar;

  // Birth-chart card (labels and names in the chosen language)
  const chartRows: { label: string; value: string }[] = [];
  if (jathakam) {
    chartRows.push(...birthChartRows(jathakam, lang));
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
    verdict,
    greeting: first ? fill(t.greeting, { name: first }) : t.greetingNoName,
    overview,
    mood,
    doList,
    avoidList,
    luckyTime: luckyParts.join(' · '),
    calmTime,
    dress: { colours, title: fill(t.dressTitle, { colours: words(pn) }), why, idea, pair },
    relation: { kind, level, title: married ? t.relTitleM : t.relTitleS, text: relText, outing },
  };
};
