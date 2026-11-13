// Pelli Porutham (South-Indian marriage matching, 10 poruthams) from the bride's and groom's
// Moon nakshatra (0 = Ashwini .. 26 = Revati) and Moon rashi (0 = Mesha .. 11 = Meena).
// Pure and offline; nakshatra / rashi come from the birth-chart engine (utils/jathakam.ts).
// Counting is from the BRIDE's star / rashi to the GROOM's (inclusive), as South-Indian
// panchangams do. Rajju and Vedha are treated as essential (a mismatch there is called out).
import { GANA, YONI_OF } from './jathakam';

export type PoruthamId =
  | 'dina' | 'gana' | 'mahendra' | 'streeDeergha' | 'yoni'
  | 'rasi' | 'rasiAdhipathi' | 'vasya' | 'rajju' | 'vedha';

export interface PoruthamResult {
  id: PoruthamId;
  name: string;
  match: boolean;
  short: string; // one line, free
  detail: string; // explanation (behind the rewarded ad)
}

export interface MatchResult {
  items: PoruthamResult[];
  score: number; // matches out of 10
  essentialOk: boolean; // Rajju and Vedha both match
  verdict: 'excellent' | 'good' | 'average' | 'poor';
  summary: string;
}

const starCount = (from: number, to: number) => ((to - from + 27) % 27) + 1; // 1..27
const rasiCount = (from: number, to: number) => ((to - from + 12) % 12) + 1; // 1..12

// Rashi lords: 0 Sun 1 Moon 2 Mars 3 Mercury 4 Jupiter 5 Venus 6 Saturn
const RASI_LORD = [2, 5, 3, 1, 0, 3, 5, 2, 4, 6, 6, 4];
const PLANET = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
// Natural enemies (Naisargika shatru)
const ENEMIES: Record<number, number[]> = {
  0: [5, 6], 1: [], 2: [3], 3: [1], 4: [3, 5], 5: [0, 1], 6: [0, 1, 2],
};
// Vasya rashis of each rashi
const VASYA: Record<number, number[]> = {
  0: [4, 7], 1: [3, 6], 2: [5], 3: [7, 8], 4: [6], 5: [2, 11],
  6: [5, 9], 7: [3], 8: [11], 9: [0, 10], 10: [0], 11: [9],
};
// Rajju groups: 0 Siro (head) 1 Kanta (neck) 2 Udara (navel) 3 Kati (waist) 4 Paada (feet)
const RAJJU_OF = [4, 3, 2, 1, 0, 1, 2, 3, 4, 4, 3, 2, 1, 0, 1, 2, 3, 4, 4, 3, 2, 1, 0, 1, 2, 3, 4];
const RAJJU_EN = ['Siro (head)', 'Kanta (neck)', 'Udara (navel)', 'Kati (waist)', 'Paada (feet)'];
// Vedha (mutually obstructing) stars
const VEDHA_PAIRS: [number, number][] = [
  [0, 17], [1, 16], [2, 15], [3, 14], [5, 21], [6, 20], [7, 19], [8, 18],
  [9, 26], [10, 25], [11, 24], [12, 23], [4, 13], [13, 22], [4, 22],
];
// Yoni enemies: Horse-Buffalo, Elephant-Lion, Goat-Monkey, Serpent-Mongoose, Dog-Deer, Cat-Rat, Cow-Tiger
const YONI_ENEMY: [number, number][] = [[0, 8], [1, 13], [2, 11], [3, 12], [4, 10], [5, 6], [7, 9]];
const GANA_EN = ['Deva', 'Manushya', 'Rakshasa'];
const YONI_EN = ['Horse', 'Elephant', 'Goat', 'Serpent', 'Dog', 'Cat', 'Rat', 'Cow', 'Buffalo', 'Tiger', 'Deer', 'Monkey', 'Mongoose', 'Lion'];

export const rajjuOf = (star: number) => RAJJU_OF[star];

export function matchPorutham(
  bride: { nakshatra: number; rashi: number },
  groom: { nakshatra: number; rashi: number },
): MatchResult {
  const g = bride.nakshatra;
  const b = groom.nakshatra;
  const c = starCount(g, b);
  const items: PoruthamResult[] = [];

  // 1. Dina: count / 9 leaves 2, 4, 6, 8 or 0 (9)
  const dinaOk = [0, 2, 4, 6, 8].includes(c % 9);
  items.push({
    id: 'dina', name: 'Dina', match: dinaOk,
    short: dinaOk ? 'Good health and daily harmony' : 'Daily harmony needs effort',
    detail: `Counting from the bride's star to the groom's gives ${c}. ${c} ÷ 9 leaves ${c % 9 || 9}; 2, 4, 6, 8 and 9 are good. Dina porutham speaks of health, long life and day-to-day happiness together.`,
  });

  // 2. Gana
  const gg = GANA[g];
  const bg = GANA[b];
  const ganaOk = gg === bg || (gg !== 2 && bg !== 2);
  items.push({
    id: 'gana', name: 'Gana', match: ganaOk,
    short: ganaOk ? 'Temperaments suit each other' : 'Very different temperaments',
    detail: `Bride: ${GANA_EN[gg]} gana, groom: ${GANA_EN[bg]} gana. The same gana, or Deva with Manushya, is good; Rakshasa with Deva / Manushya is not. Gana describes nature and temperament.`,
  });

  // 3. Mahendra: count 4, 7, 10, 13, 16, 19, 22, 25
  const mahOk = c >= 4 && (c - 4) % 3 === 0 && c <= 25;
  items.push({
    id: 'mahendra', name: 'Mahendra', match: mahOk,
    short: mahOk ? 'Blessing for children and wealth' : 'No Mahendra blessing',
    detail: `Count ${c}. Mahendra matches when the count is 4, 7, 10, 13, 16, 19, 22 or 25. It speaks of children, wealth and the family growing.`,
  });

  // 4. Stree Deergha: groom's star more than 13 from the bride's
  const sdOk = c > 13;
  items.push({
    id: 'streeDeergha', name: 'Stree Deergha', match: sdOk,
    short: sdOk ? "Bride's well-being and prosperity" : 'Stars are too close for Stree Deergha',
    detail: `Count ${c}. More than 13 is good (more than 9 is accepted by some). It speaks of the bride's long, happy and prosperous life.`,
  });

  // 5. Yoni
  const gy = YONI_OF[g];
  const by = YONI_OF[b];
  const yoniEnemy = YONI_ENEMY.some(([x, y]) => (x === gy && y === by) || (x === by && y === gy));
  items.push({
    id: 'yoni', name: 'Yoni', match: !yoniEnemy,
    short: !yoniEnemy ? 'Physical compatibility is fine' : 'Yoni animals are enemies',
    detail: `Bride: ${YONI_EN[gy]} yoni, groom: ${YONI_EN[by]} yoni. ${yoniEnemy ? 'These are enemy animals.' : 'They are not enemies.'} Yoni speaks of physical and intimate compatibility.`,
  });

  // 6. Rasi: 2/12, 5/9 and 6/8 positions are not good
  const r = rasiCount(bride.rashi, groom.rashi);
  const rasiOk = ![2, 12, 5, 9, 6, 8].includes(r);
  items.push({
    id: 'rasi', name: 'Rasi', match: rasiOk,
    short: rasiOk ? 'Rashis support the family line' : 'Rashis sit in a difficult position',
    detail: `The groom's rashi is ${r === 1 ? 'the same as' : `${r}${r === 2 ? 'nd' : r === 3 ? 'rd' : 'th'} from`} the bride's. The 2/12, 5/9 and 6/8 positions are avoided; others are good. Rasi porutham speaks of the family line and harmony.`,
  });

  // 7. Rasi Adhipathi: lords not enemies
  const gl = RASI_LORD[bride.rashi];
  const bl = RASI_LORD[groom.rashi];
  const lordEnemy = gl !== bl && (ENEMIES[gl].includes(bl) || ENEMIES[bl].includes(gl));
  items.push({
    id: 'rasiAdhipathi', name: 'Rasi Adhipathi', match: !lordEnemy,
    short: !lordEnemy ? 'Rashi lords are friendly' : 'Rashi lords are enemies',
    detail: `Bride's rashi lord: ${PLANET[gl]}, groom's: ${PLANET[bl]}. ${lordEnemy ? 'They are natural enemies.' : 'They are friends, neutral or the same planet.'} It speaks of mutual understanding and the family's prosperity.`,
  });

  // 8. Vasya
  const vasyaOk = VASYA[bride.rashi].includes(groom.rashi) || VASYA[groom.rashi].includes(bride.rashi);
  items.push({
    id: 'vasya', name: 'Vasya', match: vasyaOk,
    short: vasyaOk ? 'Natural attraction between you' : 'No Vasya attraction',
    detail: `Vasya matches when one rashi is "vasya" (attracted) to the other. ${vasyaOk ? 'Your rashis are.' : 'Your rashis are not.'} It speaks of affection and attraction.`,
  });

  // 9. Rajju (essential)
  const rajjuOk = RAJJU_OF[g] !== RAJJU_OF[b];
  items.push({
    id: 'rajju', name: 'Rajju', match: rajjuOk,
    short: rajjuOk ? 'Rajju is fine (essential)' : 'Same Rajju (essential porutham missing)',
    detail: `Bride: ${RAJJU_EN[RAJJU_OF[g]]} rajju, groom: ${RAJJU_EN[RAJJU_OF[b]]} rajju. Different rajjus are needed; it is the most important porutham and speaks of the husband's long life and the marriage lasting.`,
  });

  // 10. Vedha (essential)
  const vedha = VEDHA_PAIRS.some(([x, y]) => (x === g && y === b) || (x === b && y === g));
  items.push({
    id: 'vedha', name: 'Vedha', match: !vedha,
    short: !vedha ? 'No Vedha obstruction' : 'Stars obstruct each other (Vedha)',
    detail: `${vedha ? 'Your stars are a Vedha pair: they obstruct each other.' : 'Your stars are not a Vedha pair.'} Vedha speaks of troubles and obstacles in married life.`,
  });

  const score = items.filter(i => i.match).length;
  const essentialOk = rajjuOk && !vedha;
  const verdict: MatchResult['verdict'] = !essentialOk
    ? 'poor'
    : score >= 8
    ? 'excellent'
    : score >= 6
    ? 'good'
    : score >= 5
    ? 'average'
    : 'poor';
  const summary =
    verdict === 'excellent'
      ? `${score}/10 poruthams match, including Rajju and Vedha. A very good match.`
      : verdict === 'good'
      ? `${score}/10 poruthams match, including Rajju and Vedha. A good match.`
      : verdict === 'average'
      ? `${score}/10 poruthams match. Average; please also consult a family astrologer.`
      : !essentialOk
      ? `${score}/10 match, but ${!rajjuOk ? 'Rajju' : 'Vedha'}${!rajjuOk && vedha ? ' and Vedha' : ''} do not. Traditionally not recommended without a full horoscope check.`
      : `${score}/10 poruthams match. Not a strong match.`;
  return { items, score, essentialOk, verdict, summary };
}
