import { formatDate, formatDayMonth, formatMonth, parseDisplayDate } from '../src/utils/formatDate';

describe('formatDate', () => {
  it('formats a stored ISO DOB as DD-MM-YYYY without a timezone shift', () => {
    expect(formatDate('1995-11-23')).toBe('23-11-1995');
    expect(formatDate('2026-01-05')).toBe('05-01-2026');
  });
  it('formats Date objects, epoch ms and Timestamp-like values', () => {
    const d = new Date(2026, 10, 12, 21, 8);
    expect(formatDate(d)).toBe('12-11-2026');
    expect(formatDate(d.getTime())).toBe('12-11-2026');
    expect(formatDate({ toDate: () => d })).toBe('12-11-2026');
  });
  it('keeps an already formatted date and rejects junk', () => {
    expect(formatDate('23-11-1995')).toBe('23-11-1995');
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate('hello')).toBe('');
    expect(formatDate(new Date('nope'))).toBe('');
  });
  it('formats day-month for birthdays without the year', () => {
    expect(formatDayMonth('11-23')).toBe('23-11');
    expect(formatDayMonth('1995-11-23')).toBe('23-11');
  });
  it('parses user input back to ISO', () => {
    expect(parseDisplayDate('23-11-1995')).toBe('1995-11-23');
    expect(parseDisplayDate('3/1/2027')).toBe('2027-01-03');
    expect(parseDisplayDate('1995-11-23')).toBe('1995-11-23');
    expect(parseDisplayDate('31-02-2026')).toBeNull();
    expect(parseDisplayDate('abc')).toBeNull();
  });
  it('formats month keys', () => {
    expect(formatMonth('2026-11')).toBe('11-2026');
  });
});
