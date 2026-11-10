import { pickLuckyPairs } from '../src/services/luckyPairs';

const item = (id: string, category: string, color: string, extra: any = {}) => ({
  id,
  userId: 'u',
  name: category,
  category,
  color,
  fabric: null,
  imageUrl: `data:image/jpeg;base64,${id}`,
  hasMedia: false,
  isPublic: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '',
  ...extra,
});

// Tuesday (IST) = Red / Coral
const TUESDAY = new Date('2026-11-10T06:00:00Z');

describe('pickLuckyPairs', () => {
  const wardrobe: any[] = [
    item('t1', 'Shirts', 'Red'),
    item('t2', 'T-Shirts', 'White'),
    item('t3', 'Shirts', 'Green'),
    item('t4', 'Kurtas', 'Orange'),
    item('b1', 'Jeans', 'Blue'),
    item('b2', 'Trousers', 'Black'),
    item('b3', 'Pants', 'Beige'),
    item('s1', 'Shoes', 'Black'),
  ];

  it('gives 3 to 5 top + bottom pairs led by the lucky colour', () => {
    const r = pickLuckyPairs(wardrobe, 'English', { date: TUESDAY });
    expect(r.vaara.weekday).toBe('Tuesday');
    expect(r.pairs.length).toBeGreaterThanOrEqual(3);
    expect(r.pairs.length).toBeLessThanOrEqual(5);
    expect(r.pairs[0].top.color).toBe('Red');
    r.pairs.forEach(p => {
      expect(['Shirts', 'T-Shirts', 'Kurtas']).toContain(p.top.category);
      expect(['Jeans', 'Trousers', 'Pants']).toContain(p.bottom.category);
      expect(p.why.length).toBeGreaterThan(10);
    });
    expect(r.pairs[0].why).toMatch(/lucky colour/);
  });

  it('explains in Telugu and Hindi', () => {
    expect(pickLuckyPairs(wardrobe, 'Telugu', { date: TUESDAY }).pairs[0].why).toMatch(/అదృష్ట/);
    expect(pickLuckyPairs(wardrobe, 'Hindi', { date: TUESDAY }).pairs[0].why).toMatch(/शुभ/);
  });

  it('returns no pairs without tops or bottoms', () => {
    expect(pickLuckyPairs([item('t1', 'Shirts', 'Red')] as any, 'English').pairs).toHaveLength(0);
  });
});
