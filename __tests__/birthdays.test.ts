import {
  birthdayDateFor,
  daysUntil,
  entriesFor,
  isMyBirthdayToday,
  mdFromDob,
  mdKeysOn,
  mdLabel,
  mentionParts,
  mentionPrefix,
  upcomingDays,
} from '../src/services/birthdayApi';

jest.mock('../src/config/firebaseConfig', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('../src/services/userApi', () => ({ inlineAvatar: (a: any) => a || null, saveUserProfile: async () => undefined }));
jest.mock('../src/services/activityApi', () => ({ logActivity: () => undefined }));
jest.mock('../src/utils/firebaseErrors', () => ({ firestoreErrorMessage: (e: any) => String(e) }));

describe('birthdays (day + month only)', () => {
  it('keeps only month and day of the date of birth', () => {
    expect(mdFromDob('1996-11-14')).toBe('11-14');
    expect(mdFromDob('')).toBeNull();
    expect(mdFromDob('14/11/1996')).toBeNull();
    expect(mdFromDob('1996-13-01')).toBeNull();
    expect(mdLabel('11-14')).toBe('14 Nov');
  });

  it('lists today and the next 7 days', () => {
    const days = upcomingDays(new Date(2026, 10, 11, 10));
    expect(days).toHaveLength(8);
    expect(days[0]).toEqual({ dateKey: '2026-11-11', inDays: 0, mds: ['11-11'] });
    expect(days[7].dateKey).toBe('2026-11-18');
    // across the year end
    expect(upcomingDays(new Date(2026, 11, 29)).map(d => d.mds[0])).toContain('01-04');
  });

  it('celebrates 29 Feb on 28 Feb in other years', () => {
    expect(mdKeysOn(new Date(2027, 1, 28))).toEqual(['02-28', '02-29']);
    expect(mdKeysOn(new Date(2028, 1, 28))).toEqual(['02-28']);
    expect(birthdayDateFor('02-29', new Date(2027, 1, 1))).toBe('2027-02-28');
    expect(birthdayDateFor('02-29', new Date(2028, 1, 1))).toBe('2028-02-29');
  });

  it('picks this year or next year for wishes', () => {
    const today = new Date(2026, 10, 11);
    expect(birthdayDateFor('11-11', today)).toBe('2026-11-11');
    expect(birthdayDateFor('11-15', today)).toBe('2026-11-15');
    expect(birthdayDateFor('11-10', today)).toBe('2026-11-10'); // yesterday: grace day
    expect(birthdayDateFor('11-01', today)).toBe('2027-11-01');
    expect(daysUntil('2026-11-15', today)).toBe(4);
  });

  it('sorts entries today first and drops other dates', () => {
    const list = entriesFor(
      [
        { uid: 'b', d: { name: 'Bala', md: '11-13' } },
        { uid: 'a', d: { name: 'Anu', md: '11-11' } },
        { uid: 'c', d: { name: 'Chinni', md: '12-25' } },
      ],
      new Date(2026, 10, 11),
    );
    expect(list.map(e => [e.uid, e.inDays])).toEqual([
      ['a', 0],
      ['b', 2],
    ]);
    // never carries a year or an age
    expect(Object.keys(list[0]).sort()).toEqual(['avatar', 'dateKey', 'inDays', 'md', 'name', 'uid']);
  });

  it('knows when today is my birthday (only when opted in)', () => {
    const d = new Date(2026, 10, 11);
    expect(isMyBirthdayToday({ on: true, md: '11-11' }, d)).toBe(true);
    expect(isMyBirthdayToday({ on: false, md: '11-11' }, d)).toBe(false);
    expect(isMyBirthdayToday({ on: true, md: '11-12' }, d)).toBe(false);
  });

  it('tags replies with @name', () => {
    expect(mentionPrefix('Sai Babu')).toBe('@Sai ');
    expect(mentionParts('@Sai thank you!')).toEqual([
      { text: '@Sai', mention: true },
      { text: ' thank you!', mention: false },
    ]);
  });
});
