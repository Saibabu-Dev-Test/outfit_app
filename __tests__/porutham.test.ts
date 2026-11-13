import { matchPorutham, rajjuOf } from '../src/utils/porutham';

describe('pelli porutham', () => {
  it('has 10 poruthams and a score', () => {
    const r = matchPorutham({ nakshatra: 3, rashi: 1 }, { nakshatra: 21, rashi: 9 });
    expect(r.items).toHaveLength(10);
    expect(r.score).toBe(r.items.filter(i => i.match).length);
  });
  it('same star -> same Rajju -> not recommended', () => {
    const r = matchPorutham({ nakshatra: 7, rashi: 3 }, { nakshatra: 7, rashi: 3 });
    expect(r.items.find(i => i.id === 'rajju')!.match).toBe(false);
    expect(r.essentialOk).toBe(false);
    expect(r.verdict).toBe('poor');
  });
  it('rajju groups cover 27 stars as 3/6/6/6/6', () => {
    const counts = [0, 0, 0, 0, 0];
    for (let s = 0; s < 27; s++) counts[rajjuOf(s)]++;
    expect(counts).toEqual([3, 6, 6, 6, 6]);
  });
  it('vedha pairs (Ashwini-Jyeshtha, Mrigashira-Chitra)', () => {
    expect(matchPorutham({ nakshatra: 0, rashi: 0 }, { nakshatra: 17, rashi: 7 }).items.find(i => i.id === 'vedha')!.match).toBe(false);
    expect(matchPorutham({ nakshatra: 4, rashi: 1 }, { nakshatra: 13, rashi: 5 }).items.find(i => i.id === 'vedha')!.match).toBe(false);
  });
  it('dina, mahendra and stree deergha follow the count from the bride', () => {
    // Bride Ashwini (0), groom Rohini (3): count 4 -> dina good, mahendra good, stree deergha no
    const r = matchPorutham({ nakshatra: 0, rashi: 0 }, { nakshatra: 3, rashi: 1 });
    const get = (id: string) => r.items.find(i => i.id === id)!.match;
    expect(get('dina')).toBe(true);
    expect(get('mahendra')).toBe(true);
    expect(get('streeDeergha')).toBe(false);
  });
  it('rasi 6/8 is not good, 7th is good', () => {
    const six = matchPorutham({ nakshatra: 0, rashi: 0 }, { nakshatra: 14, rashi: 5 });
    expect(six.items.find(i => i.id === 'rasi')!.match).toBe(false);
    const seven = matchPorutham({ nakshatra: 0, rashi: 0 }, { nakshatra: 14, rashi: 6 });
    expect(seven.items.find(i => i.id === 'rasi')!.match).toBe(true);
  });
  it('yoni enemies: Cat (Punarvasu) and Rat (Magha)', () => {
    const r = matchPorutham({ nakshatra: 6, rashi: 2 }, { nakshatra: 9, rashi: 4 });
    expect(r.items.find(i => i.id === 'yoni')!.match).toBe(false);
  });
});
