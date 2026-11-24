// Govt package rates (PM-JAY HBP 2022 + CGHS 2025) for the procedures that treat a searched disease.
import { CGHS, PMJAY, priceLine, ratesFor, rowTitle, specialtyFits } from '../src/services/procedureRates';

const codes = (q: string) => {
  const r = ratesFor(q);
  return { id: r.disease?.id, pm: r.pmjay.map(h => h.row.code), cg: r.cghs.map(h => h.row.code), r };
};

describe('procedure rates data', () => {
  it('bundles the official files with source + date', () => {
    expect(PMJAY.procedures).toHaveLength(1949);
    expect(PMJAY.source).toMatch(/^https:\/\/nha\.gov\.in\//);
    expect(PMJAY.asOf).toBe('2022-04-06');
    expect(PMJAY.tiers).toEqual(['National Reference Price (NRP)', 'Tier3 (Z)', 'Tier2 (Y)', 'Tier1 (X)']);
    expect(CGHS.procedures).toHaveLength(1998);
    expect(CGHS.asOf).toBe('2025-10-03');
    expect(CGHS.tiers).toHaveLength(9);
  });

  it('keeps official numbers (spot checks against the source PDFs)', () => {
    const pcnl = PMJAY.procedures.find(p => p.code === 'SU007A');
    expect(pcnl?.rates).toEqual({ 'National Reference Price (NRP)': 45000, 'Tier3 (Z)': 45000, 'Tier2 (Y)': 52700, 'Tier1 (X)': 56300 });
    const opd = CGHS.procedures.find(p => p.code === 'CN001');
    expect(Object.values(opd?.rates || {})).toEqual(Array(9).fill(350));
  });
});

describe('ratesFor', () => {
  it('kidney stone (EN / HI) -> PCNL, ESWL', () => {
    for (const q of ['kidney stone', 'पथरी']) {
      const c = codes(q);
      expect(c.id).toBe('kidney-stone');
      expect(c.pm).toContain('SU007A');
      expect(c.r.pmjay.every(h => h.row.specialty === 'Urology')).toBe(true);
      expect(c.cg).toEqual(expect.arrayContaining(['NU128']));
    }
  });

  it('cataract, knee replacement, heart attack, piles, gallstones', () => {
    expect(codes('cataract').pm).toEqual(expect.arrayContaining(['SE020A']));
    expect(codes('knee replacement').pm).toContain('SB039A');
    expect(codes('heart attack').pm).toContain('MC011A');
    expect(codes('heart attack').pm).not.toContain('MC002A'); // DVT thrombolysis is not for heart attack
    expect(codes('piles').cg).toContain('GS018');
    expect(codes('gall stones').pm.some(c => c.startsWith('SG039'))).toBe(true);
  });

  it('returns nothing for no match', () => {
    expect(ratesFor('zzzz qqqq')).toEqual({ disease: null, pmjay: [], cghs: [] });
  });

  it('price line: city tiers X / Y / Z in rupees', () => {
    const h = ratesFor('kidney stone').pmjay.find(x => x.row.code === 'SU007A');
    expect(priceLine(h!)).toBe('X ₹56,300 · Y ₹52,700 · Z ₹45,000');
  });

  it('short PM-JAY procedure names get their package', () => {
    expect(rowTitle({ code: 'SG017A', name: 'Open', specialty: 'General Surgery', package: 'Appendicectomy' })).toBe('Appendicectomy - Open');
    expect(specialtyFits('Neuro-Surgery Procedure', ['Neurosurgery'])).toBe(true);
    expect(specialtyFits('Urology', ['Cardiology'])).toBe(false);
  });
});
