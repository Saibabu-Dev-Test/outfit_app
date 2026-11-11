import { offlineTopicAnswer, politeLine } from '../src/services/stylistOffline';

const date = new Date(2026, 10, 11, 10);
const profile = { name: 'Sai', dob: '1996-05-14', placeOfBirth: 'Hyderabad, Telangana', timeOfBirth: '06:30', gender: 'male' };

describe('stylist offline answers', () => {
  it('answers app-help questions in three languages', () => {
    const a = offlineTopicAnswer('how do I add a dress to my wardrobe?', 'English', { date });
    expect(a?.topic).toBe('help');
    expect(a?.key).toBe('wardrobe');
    expect(a?.text).toMatch(/\+ Add/);
    expect(offlineTopicAnswer('circle ela create cheyali', 'Telugu', { date })?.key).toBe('circles');
    expect(offlineTopicAnswer('nearby circles kaise dekhe', 'Hindi', { date })?.key).toBe('nearby');
    expect(offlineTopicAnswer('how to share the app link', 'English', { date })?.key).toBe('share');
    expect(offlineTopicAnswer('how can I vote', 'English', { date })?.key).toBe('vote');
    expect(offlineTopicAnswer('how to wish a birthday', 'English', { date })?.key).toBe('birthday');
  });

  it('answers astrology from the offline jathakam', () => {
    const day = offlineTopicAnswer('how is my day today as per my rashi?', 'English', { profile, date });
    expect(day?.topic).toBe('astro');
    const star = offlineTopicAnswer('what is my nakshatra', 'English', { profile, date });
    expect(star?.key).toBe('star');
    expect(star?.text).toMatch(/Nakshatra|pada/i);
    const p = offlineTopicAnswer("today's panchang", 'Telugu', { profile, date });
    expect(p?.key).toBe('panchang');
    expect(p?.text).toMatch(/తిథి/);
    // without a date of birth it asks for it and still gives today
    const noDob = offlineTopicAnswer('my horoscope', 'English', { profile: {}, date });
    expect(noDob?.text).toMatch(/date of birth/);
  });

  it('gives style and life tips', () => {
    expect(offlineTopicAnswer('any tips to look taller?', 'English', { date })?.key).toBe('body');
    expect(offlineTopicAnswer('I feel stressed', 'English', { date })?.key).toBe('wellbeing');
    expect(offlineTopicAnswer('give me a fashion tip', 'Hindi', { date })?.topic).toBe('tip');
  });

  it('leaves other questions for Gemini / the polite line', () => {
    expect(offlineTopicAnswer('who won the cricket match yesterday', 'English', { date })).toBeNull();
    expect(politeLine('Telugu')).toMatch(/🙏/);
  });
});
