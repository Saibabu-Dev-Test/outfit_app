import { startOfToday, startOfWeek } from '../src/services/adminStats';

jest.mock('../src/config/firebaseConfig', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('../src/services/userApi', () => ({ ageFromDob: () => null }));
jest.mock('../src/constants/wardrobe', () => ({ genderKey: () => null }));
jest.mock('../src/utils/firebaseErrors', () => ({ firestoreErrorMessage: (e: any) => String(e) }));

describe('admin user counts date ranges', () => {
  it('today starts at local midnight', () => {
    const d = startOfToday(new Date(2026, 10, 11, 13, 46));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 11, 0, 0]);
  });
  it('week starts on Monday', () => {
    // Wed 11 Nov 2026 -> Mon 9 Nov
    expect(startOfWeek(new Date(2026, 10, 11, 9)).getDate()).toBe(9);
    // Sun 15 Nov 2026 -> Mon 9 Nov
    expect(startOfWeek(new Date(2026, 10, 15, 23)).getDate()).toBe(9);
    // Mon 16 Nov -> itself
    expect(startOfWeek(new Date(2026, 10, 16, 0, 5)).getDate()).toBe(16);
  });
});
