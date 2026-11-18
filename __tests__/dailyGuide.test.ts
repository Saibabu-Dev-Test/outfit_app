import { istInstant, panchangFor, HYDERABAD } from '../src/utils/astro';
import {
  ageGroup,
  ageTipKeys,
  bestOutingWindow,
  buyAdvice,
  dailyRashiColour,
  goOutAdvice,
  houseKind,
  isRiktaTithi,
  parseTodayWeather,
  weatherAlerts,
  TodayWeather,
} from '../src/utils/dailyGuide';
import { DAILY_GUIDE_TEXT, hourLabel } from '../src/i18n/dailyGuideText';
import { janmaRashiOf } from '../src/components/DailyAstroExtras';

const at = (y: number, m: number, d: number, h = 8) => new Date(istInstant(y, m, d, h));
const VRISCHIKA = 7;
const KARKA = 3;

describe('daily rashi colour (Chandra gochara)', () => {
  it('Moon rashi for a known date: 18 Nov 2026 Hyderabad = Kumbha, Shatabhisha, Shukla Navami', () => {
    // Drik Panchang, Hyderabad, 18 Nov 2026: Moonsign Kumbha, Shatabhisha, Shukla Navami, Rahu 12:01-1:26 PM
    const p = panchangFor(at(2026, 11, 18, 11), HYDERABAD);
    expect(p.moonRashi).toBe(10); // Kumbha
    expect(p.nakshatra).toBe(23); // Shatabhisha
    expect(p.tithi).toBe(9); // Shukla Navami
    const rahuStartIst = new Date(p.rahu.start + 330 * 60000);
    expect(rahuStartIst.getUTCHours()).toBe(12);
    expect(rahuStartIst.getUTCMinutes()).toBeLessThanOrEqual(3);
  });

  it('counts the house from the janma rashi and picks the colour', () => {
    const p = panchangFor(at(2026, 11, 18, 11));
    const v = dailyRashiColour(VRISCHIKA, p)!;
    expect(v.house).toBe(4); // Kumbha is 4th from Vrischika
    expect(v.kind).toBe('weak');
    expect(v.colour.name).toBe('White'); // weak house: Chandra's colour to calm the Moon
    // Mesha: Kumbha is 11th (good) -> colour of Kumbha's lord Shani = Blue
    const m = dailyRashiColour(0, p)!;
    expect(m.house).toBe(11);
    expect(m.kind).toBe('good');
    expect(m.colour.name).toBe('Blue');
    // Karka: Kumbha is 8th -> Chandrashtama
    expect(dailyRashiColour(KARKA, p)!.kind).toBe('chandrashtama');
    expect(dailyRashiColour(-1, p)).toBeNull();
  });

  it('changes from day to day as the Moon moves', () => {
    const names = new Set<string>();
    for (let d = 10; d <= 20; d++) {
      const v = dailyRashiColour(VRISCHIKA, panchangFor(at(2026, 11, d)))!;
      names.add(`${v.moonRashi}-${v.colour.name}`);
    }
    expect(names.size).toBeGreaterThanOrEqual(4);
  });

  it('classifies houses', () => {
    expect([1, 3, 6, 7, 10, 11].map(houseKind)).toEqual(Array(6).fill('good'));
    expect([2, 5, 9].map(houseKind)).toEqual(['mixed', 'mixed', 'mixed']);
    expect([4, 12].map(houseKind)).toEqual(['weak', 'weak']);
    expect(houseKind(8)).toBe('chandrashtama');
  });

  it('janma rashi: saved one first, else from the date of birth', () => {
    expect(janmaRashiOf({ rashi: 'Vrischika (Scorpio)' })).toBe(VRISCHIKA);
    expect(janmaRashiOf({})).toBe(-1);
    expect(janmaRashiOf({ dob: '1996-11-14', timeOfBirth: '07:30 AM' })).toBeGreaterThanOrEqual(0);
  });
});

describe('good day to buy', () => {
  it('Rikta tithis', () => {
    expect([4, 9, 14, 19, 24, 29].every(isRiktaTithi)).toBe(true);
    expect([1, 5, 15, 30].some(isRiktaTithi)).toBe(false);
  });

  it('18 Nov 2026 for a Vrischika user: Careful (Navami is Rikta, Shatabhisha is average)', () => {
    const p = panchangFor(at(2026, 11, 18, 11));
    const b = buyAdvice(p, VRISCHIKA);
    expect(b.verdict).toBe('careful');
    expect(b.reasons).toEqual(['rikta', 'plainNakshatra']);
  });

  it('Chandrashtama and Amavasya say No; a clean day says Yes', () => {
    const p = panchangFor(at(2026, 11, 18, 11));
    expect(buyAdvice(p, KARKA).verdict).toBe('no');
    expect(buyAdvice(p, KARKA).reasons[0]).toBe('chandrashtama');
    expect(buyAdvice({ ...p, tithi: 30, nakshatra: 3 }).verdict).toBe('no');
    const good = buyAdvice({ ...p, tithi: 5, nakshatra: 3 }, -1); // Panchami + Rohini
    expect(good.verdict).toBe('yes');
    expect(good.reasons).toEqual(['goodDay']);
    expect(buyAdvice({ ...p, tithi: 5, nakshatra: 18 }).verdict).toBe('careful'); // Mula
  });
});

// Shape of the Open-Meteo responses (forecast + air quality)
const fc = (o: Partial<Record<string, number>> = {}, hourly?: { feels?: number[]; rain?: number[] }) => ({
  utc_offset_seconds: 19800,
  current: { time: '2026-11-18T05:30', temperature_2m: 22 },
  hourly: {
    time: Array.from({ length: 24 }, (_, h) => `2026-11-18T${String(h).padStart(2, '0')}:00`),
    temperature_2m: Array(24).fill(26),
    apparent_temperature: hourly?.feels || Array.from({ length: 24 }, (_, h) => (h >= 11 && h <= 16 ? 34 : 24)),
    precipitation_probability: hourly?.rain || Array(24).fill(0),
    uv_index: Array.from({ length: 24 }, (_, h) => (h >= 11 && h <= 14 ? 8 : 1)),
    wind_speed_10m: Array(24).fill(10),
    weather_code: Array(24).fill(1),
  },
  daily: {
    time: ['2026-11-18'],
    weather_code: [o.code ?? 1],
    temperature_2m_max: [o.tMax ?? 30],
    temperature_2m_min: [o.tMin ?? 20],
    apparent_temperature_max: [o.feelsMax ?? 31],
    precipitation_sum: [o.rainMm ?? 0],
    precipitation_probability_max: [o.rainChance ?? 0],
    wind_speed_10m_max: [o.windMax ?? 12],
    wind_gusts_10m_max: [o.gustMax ?? 20],
    uv_index_max: [o.uvMax ?? 6],
  },
});
const air = (aqi = 60) => ({
  current: { us_aqi: aqi, pm2_5: 20 },
  hourly: { time: Array.from({ length: 24 }, (_, h) => `2026-11-18T${String(h).padStart(2, '0')}:00`), us_aqi: Array(24).fill(aqi) },
});
const wx = (o: Partial<Record<string, number>> = {}, aqi = 60): TodayWeather => parseTodayWeather(fc(o), air(aqi), 0)!;

describe('weather card logic', () => {
  it('parses Open-Meteo forecast + air quality', () => {
    const w = wx({ tMax: 31, tMin: 19, rainChance: 40 }, 110);
    expect(w.date).toBe('2026-11-18');
    expect(w.tMax).toBe(31);
    expect(w.tMin).toBe(19);
    expect(w.rainChance).toBe(40);
    expect(w.aqi).toBe(110);
    expect(w.hours).toHaveLength(24);
    expect(w.hours[8].aqi).toBe(110);
    expect(w.nowHour).toBe(5);
    expect(parseTodayWeather({}, null)).toBeNull();
  });

  it('flags severe weather', () => {
    expect(weatherAlerts(wx())).toEqual([]);
    expect(weatherAlerts(wx({ gustMax: 95, rainMm: 80 })).map(a => a.kind)).toEqual(['cyclone', 'heavyRain']);
    expect(weatherAlerts(wx({ rainMm: 130 }))[0]).toEqual({ kind: 'veryHeavyRain', severe: true });
    expect(weatherAlerts(wx({ tMax: 42, feelsMax: 43 }))[0].kind).toBe('heatwave');
    expect(weatherAlerts(wx({ tMax: 46 }))[0]).toEqual({ kind: 'severeHeat', severe: true });
    expect(weatherAlerts(wx({ gustMax: 60 }))[0].kind).toBe('highWind');
    expect(weatherAlerts(wx({}, 250))[0]).toEqual({ kind: 'severeAir', severe: true });
  });

  it('age groups and tips', () => {
    expect([5, 11, 12, 17, 18, 59, 60, 80].map(ageGroup)).toEqual(['child', 'child', 'teen', 'teen', 'adult', 'adult', 'senior', 'senior']);
    expect(ageGroup(null)).toBe('adult');
    expect(ageTipKeys(wx())).toEqual(['fine']);
    expect(ageTipKeys(wx({ tMax: 38, rainChance: 70 }, 120))).toEqual(['heat', 'rain', 'pollution']);
  });

  it('go out: avoid in severe weather, careful for kids / 60+ on a hot day, best window avoids the afternoon', () => {
    expect(goOutAdvice(wx({ gustMax: 100, rainMm: 60 }), 'adult').verdict).toBe('avoid');
    expect(goOutAdvice(wx({ tMax: 41, feelsMax: 42 }), 'senior').verdict).toBe('avoid');
    expect(goOutAdvice(wx({ tMax: 41, feelsMax: 42 }), 'adult').verdict).toBe('careful');
    expect(goOutAdvice(wx(), 'adult').verdict).toBe('yes');
    const win = bestOutingWindow(wx(), 5)!;
    expect(win.to - win.from).toBe(2);
    expect(win.from < 11 || win.from >= 17).toBe(true);
    expect(bestOutingWindow(wx(), 20)).toBeNull();
  });

  it('flags Rahu kalam inside the best window', () => {
    const p = panchangFor(at(2026, 11, 18, 11));
    // Only 12-14 is pleasant -> window 12-2 PM overlaps Rahu kalam 12:01-1:26 PM
    const feels = Array.from({ length: 24 }, (_, h) => (h === 12 || h === 13 ? 25 : 38));
    const w = parseTodayWeather(fc({}, { feels }), air(), 0)!;
    const g = goOutAdvice(w, 'adult', p.rahu, 5);
    expect(g.window).toEqual({ from: 12, to: 14 });
    expect(g.rahuOverlap).toBe(true);
  });
});

describe('daily guide text', () => {
  it('has every string in English, Telugu and Hindi', () => {
    const keys = (o: any): string[] =>
      Object.keys(o).flatMap(k => (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? keys(o[k]).map(s => `${k}.${s}`) : [k]));
    const en = keys(DAILY_GUIDE_TEXT.English).sort();
    expect(keys(DAILY_GUIDE_TEXT.Telugu).sort()).toEqual(en);
    expect(keys(DAILY_GUIDE_TEXT.Hindi).sort()).toEqual(en);
  });

  it('writes the rashi reason line', () => {
    const line = DAILY_GUIDE_TEXT.English.rashiLine({
      moon: 'Dhanu',
      house: 2,
      rashi: 'Vrischika (Scorpio)',
      colour: 'Yellow',
      lord: 'Guru (Jupiter)',
      kind: 'mixed',
    });
    expect(line).toBe("Moon in Dhanu today, 2nd from your rashi (Vrischika (Scorpio)): lucky colour Yellow (Guru (Jupiter)'s colour).");
    expect(hourLabel(7)).toBe('7 AM');
    expect(hourLabel(12)).toBe('12 PM');
    expect(hourLabel(0)).toBe('12 AM');
  });
});
