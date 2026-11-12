import { countLikers, decodeCoinRain, encodeCoinRain, likeNotificationText, rainCoinCount, MAX_RAIN_COINS } from '../src/services/likeCoins';

describe('like coin notifications', () => {
  it('counts distinct people among likes only', () => {
    const items = [
      { type: 'like', actorId: 'a' },
      { type: 'like', actorId: 'a' },
      { type: 'like', actorId: 'b' },
      { type: 'comment', actorId: 'c' },
    ];
    expect(countLikers(items)).toEqual({ likes: 3, people: 2 });
  });
  it('says the coin level and how many people liked', () => {
    const t = likeNotificationText(12, 12, 'gold');
    expect(t.title).toContain('Gold');
    expect(t.body).toContain('12 people');
    expect(t.body).toContain('Gold coin level');
    expect(likeNotificationText(1, 1, 'bronze').body).toContain('1 person liked your photo');
    expect(likeNotificationText(2, 5, 'diamond').body).toContain('5 likes');
  });
  it('payload round trip and validation', () => {
    expect(decodeCoinRain(encodeCoinRain({ level: 'silver', count: 7 }))).toEqual({ level: 'silver', count: 7 });
    expect(decodeCoinRain('{"t":"coinRain","level":"platinum","count":3}')).toBeNull();
    expect(decodeCoinRain('nope')).toBeNull();
    expect(decodeCoinRain(null)).toBeNull();
  });
  it('caps the coins on screen', () => {
    expect(rainCoinCount(3)).toBe(3);
    expect(rainCoinCount(500)).toBe(MAX_RAIN_COINS);
    expect(rainCoinCount(0)).toBe(1);
  });
});
