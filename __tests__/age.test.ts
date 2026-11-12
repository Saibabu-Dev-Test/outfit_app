import { ACCESSORY_TYPES, groupSubTypesFor, CATEGORY_GROUPS, itemSubType, resolveCategory, typeLabel } from '../src/constants/wardrobe';
import { ageFromDobIST, displayNameWithAge, isValidDob, nameWithAge } from '../src/utils/age';

describe('displayNameWithAge', () => {
  const now = new Date('2026-11-11T10:00:00Z');
  it('adds the age in brackets', () => {
    expect(displayNameWithAge('Krishna Prasad', '1995-01-15', now)).toBe('Krishna Prasad (31)');
  });
  it('is the plain name without a DOB', () => {
    expect(displayNameWithAge('Krishna Prasad', undefined, now)).toBe('Krishna Prasad');
    expect(displayNameWithAge('Krishna Prasad', 'bad', now)).toBe('Krishna Prasad');
  });
  it('counts the birthday on the IST day', () => {
    // 2026-11-10 20:00 UTC is already 2026-11-11 01:30 IST
    expect(ageFromDobIST('1995-11-11', new Date('2026-11-10T20:00:00Z'))).toBe(31);
    expect(ageFromDobIST('1995-11-11', new Date('2026-11-10T18:00:00Z'))).toBe(30);
  });
  it('nameWithAge ignores invalid ages', () => {
    expect(nameWithAge('Asha', 24)).toBe('Asha (24)');
    expect(nameWithAge('Asha', -1)).toBe('Asha');
    expect(nameWithAge('Asha', null)).toBe('Asha');
  });
  it('validates DOBs', () => {
    expect(isValidDob('1995-02-30', now)).toBe(false);
    expect(isValidDob('2030-01-01', now)).toBe(false);
    expect(isValidDob('1995-02-28', now)).toBe(true);
  });
});

describe('accessory types', () => {
  it('includes the new jewellery and accessory types', () => {
    ['Earrings', 'Bangles', 'Necklace / Chain', 'Anklets (Payal)', 'Maang Tikka', 'Clutch', 'Hair Accessories'].forEach(t =>
      expect(ACCESSORY_TYPES).toContain(t),
    );
    expect(resolveCategory('payal')).toEqual({ category: 'Accessories', subType: 'Anklets (Payal)' });
    expect(itemSubType({ category: 'Accessories', subType: 'Bangles' })).toBe('Bangles');
  });
  it('hides female-only types for men and labels stay English by default', () => {
    const acc = CATEGORY_GROUPS.find(g => g.key === 'accessories')!;
    expect(groupSubTypesFor(acc, 'Male')).not.toContain('Bangles');
    expect(groupSubTypesFor(acc, 'Female')).toContain('Bangles');
    expect(typeLabel('Bangles')).toBe('Bangles');
    expect(typeLabel('Earrings', 'Telugu')).toBe('Earrings');
    expect(typeLabel('Necklace / Chain', 'Telugu')).toBe('Necklace / Chain');
    expect(typeLabel('Bracelets', 'Hindi')).toBe('Bracelets');
  });
});
