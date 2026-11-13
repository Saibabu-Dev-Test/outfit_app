import {
  PlannedFunction,
  daysUntil,
  deleteFunction,
  isValidDate,
  isValidTime,
  loadFunctions,
  reminderId,
  remindersFor,
  saveFunction,
  upcomingFunctions,
  whenText,
} from '../src/services/functionPlanner';
import { parseForecast, weatherText, weatherTip } from '../src/services/weatherApi';

const fn = (over: Partial<PlannedFunction> = {}): PlannedFunction => ({
  id: 'f1',
  title: "Ravi's wedding",
  type: 'wedding',
  date: '2026-11-20',
  time: '18:30',
  city: 'Vijayawada',
  note: '',
  createdAt: 0,
  ...over,
});

describe('function planner', () => {
  it('validates dates and times', () => {
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('20-11-2026')).toBe(false);
    expect(isValidTime('18:30')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
  });
  it('days until and labels', () => {
    expect(daysUntil('2026-11-20', '2026-11-12')).toBe(8);
    expect(daysUntil('2026-11-11', '2026-11-12')).toBe(-1);
    expect(whenText(0)).toBe('Today');
    expect(whenText(1)).toBe('Tomorrow');
    expect(whenText(5)).toBe('In 5 days');
  });
  it('upcoming: future only, soonest first', () => {
    const list = [fn({ id: 'a', date: '2026-12-01' }), fn({ id: 'b', date: '2026-11-01' }), fn({ id: 'c', date: '2026-11-12' })];
    expect(upcomingFunctions(list, '2026-11-12').map(f => f.id)).toEqual(['c', 'a']);
  });
  it('reminders: evening before and morning of, future only, stable ids', () => {
    const f = fn();
    const r = remindersFor(f, new Date(2026, 10, 12).getTime());
    expect(r).toHaveLength(2);
    expect(new Date(r[0].at).getHours()).toBe(19);
    expect(new Date(r[0].at).getDate()).toBe(19);
    expect(new Date(r[1].at).getHours()).toBe(8);
    expect(r[0].id).toBe(reminderId('f1', 0));
    expect(r[1].id).toBe(reminderId('f1', 1));
    expect(remindersFor(f, new Date(2026, 10, 19, 20).getTime())).toHaveLength(1);
  });
  it('saves and deletes per user', async () => {
    await saveFunction('u1', fn());
    expect(await loadFunctions('u1')).toHaveLength(1);
    expect(await loadFunctions('u2')).toHaveLength(0);
    await deleteFunction('u1', 'f1');
    expect(await loadFunctions('u1')).toHaveLength(0);
  });
});

describe('weather', () => {
  it('parses an Open-Meteo daily forecast', () => {
    const days = parseForecast({
      daily: {
        time: ['2026-11-20'],
        weathercode: [61],
        temperature_2m_max: [31.6],
        temperature_2m_min: [22.2],
        precipitation_probability_max: [70],
      },
    });
    expect(days).toEqual([{ date: '2026-11-20', code: 61, tMax: 32, tMin: 22, rainChance: 70 }]);
    expect(parseForecast(null)).toEqual([]);
  });
  it('codes and tips', () => {
    expect(weatherText(0).label).toBe('Clear sky');
    expect(weatherText(95).emoji).toBe('⛈️');
    expect(weatherTip({ date: 'x', code: 61, tMax: 30, tMin: 22, rainChance: 80 })).toMatch(/Rain/);
    expect(weatherTip({ date: 'x', code: 0, tMax: 38, tMin: 27, rainChance: 0 })).toMatch(/Hot/);
    expect(weatherTip({ date: 'x', code: 0, tMax: 22, tMin: 10, rainChance: 0 })).toMatch(/Cool/);
  });
});
