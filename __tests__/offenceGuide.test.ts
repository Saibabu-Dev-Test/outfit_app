// Laws tab > Offence guide (BNS 2023): static data shape, links to the official BNSS First Schedule
// rows, the punishment reader (jail range / fine), cognizable / bailable flags, BNSS complaint steps,
// and search in English / Telugu / Hindi / section / old IPC.
import { BNS_ROWS } from '../src/data/laws/bns.generated';
import { BNSS_SOURCE, BNS_SOURCE, OFFENCE_CATEGORIES, OFFENCE_GUIDE, SCHEDULE_SOURCE } from '../src/data/laws/offenceGuide';
import {
  bailableFlag,
  categoryLabel,
  cognizableFlag,
  complaintSteps,
  entryFlag,
  offenceGuide,
  parsePunishment,
  searchOffences,
  simplePunishment,
} from '../src/services/offenceGuide';

const TE = /[\u0C00-\u0C7F]/;
const HI = /[\u0900-\u097F]/;

describe('offence guide data', () => {
  it('unique ids, simple title + explanation in EN / TE / HI, known category', () => {
    expect(OFFENCE_GUIDE.length).toBeGreaterThanOrEqual(45);
    expect(new Set(OFFENCE_GUIDE.map(e => e.id)).size).toBe(OFFENCE_GUIDE.length);
    OFFENCE_GUIDE.forEach(e => {
      expect(OFFENCE_CATEGORIES[e.cat]).toBeDefined();
      [e.t, e.x].forEach(tri => {
        expect(tri.en.trim()).not.toBe('');
        expect(tri.te).toMatch(TE);
        expect(tri.hi).toMatch(HI);
      });
    });
    Object.values(OFFENCE_CATEGORIES).forEach(c => {
      expect(c.te).toMatch(TE);
      expect(c.hi).toMatch(HI);
    });
    expect(categoryLabel('property', 'te')).toBe(OFFENCE_CATEGORIES.property.te);
  });

  it('every entry links to real official Schedule rows (section, punishment, classification as published)', () => {
    const schedBases = new Set(BNS_ROWS.map(r => Number((r[0].match(/^\d+/) || ['0'])[0])));
    offenceGuide().forEach(e => {
      e.bases.forEach(b => expect(schedBases.has(b)).toBe(true));
      expect(e.rows.length).toBeGreaterThan(0);
      e.rows.forEach(r => {
        expect(r.act).toBe('BNS');
        expect(r.punishment.trim()).not.toBe('');
        expect(r.cognizable).toBeTruthy();
        expect(r.bailable).toBeTruthy();
        // straight from bns.generated.ts (official text), not rewritten
        const sec = r.section;
        expect(BNS_ROWS.some(x => x[0].replace(/~+$/, '') === sec && x[3].replace(/\s+/g, ' ').trim() === r.punishment)).toBe(true);
      });
      expect(e.sources).toEqual({ bns: BNS_SOURCE, bnss: BNSS_SOURCE, schedule: SCHEDULE_SOURCE });
    });
    expect(BNS_SOURCE).toMatch(/^https:\/\/www\.indiacode\.nic\.in\//);
    expect(BNSS_SOURCE).toMatch(/^https:\/\/www\.indiacode\.nic\.in\//);
    expect(SCHEDULE_SOURCE).toMatch(/^https:\/\/www\.ncrb\.mha\.gov\.in\//);
  });

  it('key offences map to the right BNS sections and old IPC', () => {
    const by = (id: string) => offenceGuide().find(e => e.id === id)!;
    expect(by('theft').rows.map(r => r.section)).toContain('303(2)');
    expect(by('cheating').rows.find(r => r.section === '318(4)')?.oldRef).toBe('IPC 420');
    expect(by('murder').rows.every(r => r.section.startsWith('103'))).toBe(true);
    expect(by('cruelty').rows[0].oldRef).toBe('IPC 498A');
  });
});

describe('punishment reader', () => {
  it('reads ranges, maxima, life, death and fines', () => {
    expect(parsePunishment('Imprisonment for 7 years and fine.')).toMatchObject({ minYears: null, maxYears: 7, fine: true, life: false });
    expect(parsePunishment('Imprisonment for 1 year which may extend to 5 years and fine.')).toMatchObject({ minYears: 1, maxYears: 5 });
    expect(parsePunishment('Imprisonment for not less than 3 years but which may extend to 7 years and fine.')).toMatchObject({ minYears: 3, maxYears: 7 });
    expect(parsePunishment('Rigorous imprisonment for not less than 10 years but which may extend to imprisonment for life, and fine.')).toMatchObject({
      minYears: 10,
      maxYears: null,
      life: true,
    });
    expect(parsePunishment('Death or imprisonment for life and fine.')).toMatchObject({ death: true, life: true, fine: true });
    expect(parsePunishment('Imprisonment for 1 year or fine of 10,000 rupees, or both.')).toMatchObject({ maxYears: 1, fineAmount: '₹10,000', orBoth: true });
    expect(parsePunishment('Fine of 1,000 rupees.')).toMatchObject({ fineOnly: true, fineAmount: '₹1,000' });
    expect(parsePunishment('Same as for offence abetted.').relative).toBe(true);
    expect(parsePunishment('Simple imprisonment for 1 month, or fine of 5,000 rupees, or both.').maxYears).toBeCloseTo(1 / 12);
  });

  it('simple lines in English, Telugu and Hindi', () => {
    expect(simplePunishment('Imprisonment for 1 year which may extend to 5 years and fine.', 'en')).toEqual(['Jail: 1 year to 5 years', 'Fine: yes']);
    expect(simplePunishment('Imprisonment for 7 years and fine.', 'en')).toEqual(['Jail: up to 7 years', 'Fine: yes']);
    expect(simplePunishment('Imprisonment for 3 years, or fine, or both.', 'en')).toEqual(['Jail: up to 3 years', 'Fine: yes (jail, or fine, or both)']);
    expect(simplePunishment('Death or imprisonment for life and fine.', 'en')[0]).toBe('Jail: life imprisonment; death penalty possible');
    expect(simplePunishment('Fine of 1,000 rupees.', 'en')).toEqual(['Fine only (₹1,000)']);
    expect(simplePunishment('Simple imprisonment for 1 month, or fine of 5,000 rupees, or both.', 'en')[0]).toBe('Jail: up to 1 month');
    expect(simplePunishment('Imprisonment for 7 years and fine.', 'te')).toEqual(['జైలు: గరిష్ఠంగా 7 సంవత్సరాలు', 'జరిమానా: ఉంది']);
    expect(simplePunishment('Imprisonment for 7 years and fine.', 'hi')).toEqual(['जेल: अधिकतम 7 साल', 'जुर्माना: हाँ']);
    expect(simplePunishment('Same as for offence abetted.', 'en')[0]).toMatch(/main offence/);
  });

  it('every guide row produces a simple line in all three languages', () => {
    offenceGuide().forEach(e =>
      e.rows.forEach(r => {
        (['en', 'te', 'hi'] as const).forEach(l => {
          const lines = simplePunishment(r.punishment, l);
          expect(lines.length).toBeGreaterThan(0);
          lines.forEach(x => expect(x).not.toMatch(/undefined|NaN|\{/));
        });
      }),
    );
  });
});

describe('classification flags + complaint steps (BNSS)', () => {
  it('cognizable / bailable flags from the official text', () => {
    expect(cognizableFlag('Cognizable.')).toBe('yes');
    expect(cognizableFlag('Non-cognizable.')).toBe('no');
    expect(cognizableFlag('Non-cognizable')).toBe('no');
    expect(cognizableFlag('Cognizable (only on the complaint of the victim).')).toBe('cond');
    expect(cognizableFlag('Cognizable if information relating to the commission of the offence is given ...')).toBe('cond');
    expect(cognizableFlag('According as offence abetted is cognizable or non-cognizable.')).toBe('depends');
    expect(bailableFlag('Bailable.')).toBe('yes');
    expect(bailableFlag('Non-bailable.')).toBe('no');
    expect(bailableFlag('Non-Bailable.')).toBe('no');
    expect(bailableFlag('According as offence abetted is bailable or non-bailable.')).toBe('depends');
    const theft = offenceGuide().find(e => e.id === 'theft')!;
    expect(entryFlag(theft.rows, r => cognizableFlag(r.cognizable))).toBe('mixed'); // < Rs 5,000 row is non-cognizable
  });

  it('steps cite the BNSS and differ for cognizable / non-cognizable', () => {
    const cog = complaintSteps('yes').map(s => s.ref);
    expect(cog).toEqual(['BNSS s.173(1)', 'BNSS s.173(2)', 'BNSS s.173(4)', 'BNSS s.175(3)', '112']);
    expect(complaintSteps('no').map(s => s.ref)).toEqual(['BNSS s.174(1)', 'BNSS s.174(2)', 'BNSS s.223', '112']);
    expect(complaintSteps('cond')[0].ref).toBe('BNSS First Schedule');
    expect(complaintSteps('depends').length).toBe(8);
    complaintSteps('depends').forEach(s => {
      expect(s.t.te).toMatch(TE);
      expect(s.t.hi).toMatch(HI);
    });
    expect(complaintSteps('yes')[0].t.en).toMatch(/Zero FIR/);
  });
});

describe('searchOffences', () => {
  it('words, Telugu, Hindi, section number and old IPC', () => {
    expect(searchOffences('theft')[0].id).toBe('theft');
    expect(searchOffences('దొంగతనం')[0].id).toBe('theft');
    expect(searchOffences('धोखाधड़ी')[0].id).toBe('cheating');
    expect(searchOffences('318')[0].id).toBe('cheating');
    expect(searchOffences('ipc 420')[0].id).toBe('cheating');
    expect(searchOffences('IPC 498A')[0].id).toBe('cruelty');
    expect(searchOffences('upi fraud')[0].id).toBe('cheating');
    expect(searchOffences('stalking')[0].id).toBe('stalking');
    expect(searchOffences('zzqx nothing')).toEqual([]);
    expect(searchOffences('', 'road').map(e => e.id)).toEqual(['rash-driving']);
    expect(searchOffences('').length).toBe(OFFENCE_GUIDE.length);
  });
});
