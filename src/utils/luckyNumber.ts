// Lucky number for the daily reading (services/astrologyDaily.ts), computed on the phone.
// Traditional numerology, simplified:
// - Birth number (moolank): the day of birth reduced to 1-9 (e.g. 23 -> 5).
// - Destiny number (bhagyank): every digit of the date of birth reduced to 1-9.
// - Day number: every digit of today's IST date reduced to 1-9.
// Each number has a ruling planet: 1 Sun, 2 Moon, 3 Jupiter, 4 Rahu, 5 Mercury, 6 Venus, 7 Ketu,
// 8 Saturn, 9 Mars. Friends follow the classical planetary friendship (naisargika maitri); the
// shadow planets take the usual rule "Rahu acts like Saturn, Ketu like Mars".
// Pick: today's day number when it is the birth number or its friend (the day supports you), else
// a friend of the birth number chosen by the user + date seed. The second number is the destiny
// number when it is friendly, else another friend. Same user + same date = same numbers.
// Without a date of birth the name number (Chaldean, utils/jathakam nameNumber) stands in for the
// birth number; without a name, the rashi lord's number.
import { parseDob } from './astro';
import { nameNumber } from './jathakam';

export const digitRoot = (n: number): number => {
  let x = Math.abs(Math.floor(n));
  while (x > 9) x = String(x).split('').reduce((a, c) => a + Number(c), 0);
  return x;
};
const digitsRoot = (s: string) => digitRoot(s.replace(/\D/g, '').split('').reduce((a, c) => a + Number(c), 0));

// Number -> its friendly numbers (own number not included)
export const NUMBER_FRIENDS: Record<number, number[]> = {
  1: [2, 3, 9], // Sun: Moon, Jupiter, Mars
  2: [1, 5], // Moon: Sun, Mercury
  3: [1, 2, 9], // Jupiter: Sun, Moon, Mars
  4: [5, 6, 8], // Rahu (as Saturn): Mercury, Venus, Saturn
  5: [1, 6], // Mercury: Sun, Venus
  6: [5, 8], // Venus: Mercury, Saturn
  7: [1, 2, 3], // Ketu (as Mars): Sun, Moon, Jupiter
  8: [5, 6], // Saturn: Mercury, Venus
  9: [1, 2, 3], // Mars: Sun, Moon, Jupiter
};
export const isFriendly = (base: number, n: number) => n === base || NUMBER_FRIENDS[base].includes(n);

// Rashi lord (utils/astro planet index: 0 Sun, 1 Moon, 2 Mars, 3 Mercury, 4 Jupiter, 5 Venus, 6 Saturn) -> number
const PLANET_NUMBER = [1, 2, 9, 5, 3, 6, 8];

export interface LuckyNumbers {
  lucky: number;
  second: number | null;
  base: number; // birth number (or name / rashi stand-in)
  basis: 'dob' | 'name' | 'rashi';
  destiny: number | null;
  day: number;
}

export const luckyNumbers = (input: {
  dob?: string | null;
  name?: string | null;
  rashiLord?: number | null; // planet index of the rashi lord, when only the rashi is known
  dayKey: string; // IST date 'YYYY-MM-DD'
  seed: number; // hash of user + date
}): LuckyNumbers | null => {
  const dob = parseDob(input.dob);
  const nn = nameNumber(input.name || '');
  let base: number;
  let basis: LuckyNumbers['basis'];
  if (dob) {
    base = digitRoot(dob[2]);
    basis = 'dob';
  } else if (nn) {
    base = nn;
    basis = 'name';
  } else if (input.rashiLord != null && PLANET_NUMBER[input.rashiLord]) {
    base = PLANET_NUMBER[input.rashiLord];
    basis = 'rashi';
  } else {
    return null;
  }
  const destiny = dob ? digitsRoot(`${dob[0]}${dob[1]}${dob[2]}`) : null;
  const day = digitsRoot(input.dayKey);
  const seed = Math.abs(Math.floor(input.seed));
  const friendly = [base, ...NUMBER_FRIENDS[base]];
  const lucky = friendly.includes(day) ? day : friendly[seed % friendly.length];
  const rest = friendly.filter(n => n !== lucky);
  const second =
    destiny !== null && destiny !== lucky && isFriendly(base, destiny)
      ? destiny
      : rest.length
      ? rest[Math.floor(seed / 7) % rest.length]
      : null;
  return { lucky, second, base, basis, destiny, day };
};
