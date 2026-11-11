import { parseIntent } from '../src/services/stylistIntent';
import { occasionFit, occasionKey, pickLuckyPairs } from '../src/services/luckyPairs';

describe('parseIntent', () => {
  it('detects a request for exactly one pair', () => {
    expect(parseIntent('only 1 select for me').count).toBe(1);
    expect(parseIntent('just one please').count).toBe(1);
    expect(parseIntent('pick one for me').count).toBe(1);
    expect(parseIntent('okkati select cheyyi').count).toBe(1);
    expect(parseIntent('ఒక్కటి చెప్పు').count).toBe(1);
    expect(parseIntent('sirf ek batao').count).toBe(1);
    expect(parseIntent('only 1 select for me').wantsPairs).toBe(true);
    expect(parseIntent('what should I wear').count).toBeNull();
  });

  it('detects the occasion', () => {
    expect(parseIntent('beach ki emi veyyali').occasion).toBe('Beach');
    expect(parseIntent('date ki').occasion).toBe('Date');
    expect(parseIntent('interview tomorrow, what to wear').occasion).toBe('Interview');
    expect(parseIntent('గుడికి ఏం వేసుకోవాలి').occasion).toBe('Temple');
    expect(parseIntent('शादी में क्या पहनूं').occasion).toBe('Wedding / Function');
    expect(parseIntent('college').wantsPairs).toBe(true);
    expect(parseIntent('trip to ooty, what to wear').occasion).toBe('Hill station');
    expect(parseIntent('night wear for home').occasion).toBe('Home / Night');
    expect(parseIntent('picnic outfit').occasion).toBe('Outdoor');
  });

  it('detects colour, goes-with and weather questions', () => {
    expect(parseIntent('what colour suits me today').colourQ).toBe(true);
    expect(parseIntent('what goes with black jeans').goesWith).toBe('black');
    expect(parseIntent('rainy day outfit').weather).toBe('rain');
  });
});

describe('occasion scoring', () => {
  const it2 = (id: string, category: string, name: string, color: string) =>
    ({ id, userId: 'u', name, category, color, fabric: null, imageUrl: null, hasMedia: false, isPublic: false, createdAt: '', updatedAt: '' } as any);
  it('prefers kurta for temple and shorts for the beach, max 3 pairs', () => {
    expect(occasionKey('Wedding / Function')).toBe('wedding');
    expect(occasionFit(it2('k', 'Kurtas', 'Kurta', 'Yellow'), 'temple')).toBeGreaterThan(occasionFit(it2('t', 'T-Shirts', 'T-Shirt', 'Black'), 'temple'));
    const w = [
      it2('t1', 'T-Shirts', 'T-Shirt', 'White'), it2('t2', 'Shirts', 'Formal shirt', 'Blue'), it2('t3', 'Kurtas', 'Kurta', 'Yellow'),
      it2('b1', 'Shorts', 'Shorts', 'Beige'), it2('b2', 'Trousers', 'Formal trousers', 'Black'), it2('b3', 'Jeans', 'Jeans', 'Blue'),
    ];
    const r = pickLuckyPairs(w, 'English', { occasion: 'Beach' });
    expect(r.pairs.length).toBeLessThanOrEqual(3);
    expect(r.pairs[0].why).toMatch(/beach/);
    expect(pickLuckyPairs(w, 'English', { occasion: 'Interview' }).pairs[0].top.id).toBe('t2');
    expect(pickLuckyPairs(w, 'English', { max: 1 }).pairs).toHaveLength(1);
  });
});
