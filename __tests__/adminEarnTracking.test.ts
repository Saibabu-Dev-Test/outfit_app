// Admin tracking: earn sources in 🧩 Features come from the real config, 💰 Earnings is owner-only
// and never shows sample numbers, the Earn tab keeps every earning option, and the drill-down
// rows are built from real docs.
jest.mock('../src/config/firebaseConfig', () => ({ db: {}, auth: {} }));
jest.mock('firebase/firestore', () => ({}));
jest.mock('../src/services/userApi', () => ({ ageFromDob: () => null }));
jest.mock('../src/constants/wardrobe', () => ({ genderKey: () => null }));
jest.mock('../src/utils/firebaseErrors', () => ({ firestoreErrorMessage: (e: any) => String(e) }));

import { POSTBACK_URLS, currentEarnConfig, earnFeatures } from '../src/config/featureTracker';
import { BITLABS_TOKEN, OFFERWALL_GG_URL, isCpxConfigured } from '../src/config/earn';
import { circleRow, imageOf, postRow, shortDate, toMs, userRow, wardrobeRow } from '../src/services/adminLists';

declare const require: (m: string) => any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');
const read = (rel: string): string => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const byTitle = (list: any[], part: string) => list.find(f => f.title.includes(part));

describe('earn sources in Admin tracking > Features', () => {
  it('current release: Offerwall.GG + BitLabs walls live, CPX needs the owner', () => {
    expect(OFFERWALL_GG_URL).toMatch(/^https:\/\/offerwall\.gg\/wall\//);
    expect(BITLABS_TOKEN).toBeTruthy();
    const f = earnFeatures({ app: currentEarnConfig() });
    expect(byTitle(f, 'Offerwall.GG').status).toBe('live');
    expect(byTitle(f, 'BitLabs').status).toBe('live');
    expect(byTitle(f, 'Games').status).toBe('live');
    expect(byTitle(f, 'Games').note).toMatch(/display_mode=gaming/);
    expect(byTitle(f, 'CPX').status).toBe(isCpxConfigured() ? 'live' : 'owner_todo');
    if (!isCpxConfigured()) expect(byTitle(f, 'CPX').note).toMatch(/CPX_APP_ID.*CPX_SECURE_HASH/);
    expect(byTitle(f, 'Quizzes').status).toBe('owner_todo');
    expect(byTitle(f, 'Quizzes').note).toMatch(/Coming soon/);
  });

  it('a missing Worker secret turns a live wall into Needs you with the exact step', () => {
    const f = earnFeatures({ app: { offerwall: true, bitlabs: true, cpx: false }, worker: { offerwall: true, bitlabs: false, cpx: false } });
    expect(byTitle(f, 'Offerwall.GG')).toMatchObject({ status: 'live', note: expect.stringMatching(/credits recorded/) });
    expect(byTitle(f, 'BitLabs').status).toBe('owner_todo');
    expect(byTitle(f, 'BitLabs').note).toContain('BITLABS_SECRET');
    expect(byTitle(f, 'BitLabs').note).toContain(POSTBACK_URLS.bitlabs);
    const none = earnFeatures({ app: { offerwall: false, bitlabs: false, cpx: false } });
    expect(none.filter(x => x.title.startsWith('Earn:') && x.status === 'live').map(x => x.title)).toEqual([
      'Earn: 📅 Daily check-in, 📺 ads, 🤝 invite friends, 💸 UPI withdrawal',
    ]);
  });
});

describe('Earn tab keeps every earning option (names hidden, nothing removed)', () => {
  const src = read('src/screens/Earn/EarnScreen.tsx');
  it('all three walls have a card + button that opens them', () => {
    expect(src).toMatch(/📝 Surveys<\/Text>/);
    expect(src).toMatch(/🎯 Offers<\/Text>/);
    expect(src).toMatch(/📋 Surveys & offers<\/Text>/);
    expect(src).toMatch(/onPress=\{openSurveys\}/);
    expect(src).toMatch(/onPress=\{openOffers\}/);
    expect(src).toMatch(/onPress=\{openBitlabs\}/);
    expect(src).toMatch(/navigation\.navigate\('EarnWall', \{ url: bitlabsWallUrl\(uid\)/);
    expect(src).toMatch(/navigation\.navigate\('EarnWall', \{ url, title: 'Offers'/);
  });
  it('games + quizzes cards: games open a wall, quizzes stay Coming soon (no partner link)', () => {
    expect(src).toMatch(/🎮 Games<\/Text>/);
    expect(src).toMatch(/onPress=\{openGames\}/);
    expect(src).toMatch(/bitlabsGamesUrl\(uid\)/);
    expect(src).toMatch(/🧠 Quizzes & learning<\/Text>/);
    expect(src).toMatch(/'Coming soon'/);
  });
  it('every card renders for every signed-in user (no locked screen)', () => {
    expect(src).not.toMatch(/Unlocks after these 2 steps|Complete to start earning today|isUnlocked/);
  });
});

describe('Earnings report is real and owner only', () => {
  const screen = read('src/screens/Admin/AdminUsersScreen.tsx');
  const svc = read('src/services/adminEarnings.ts');
  it('reads the Worker ledger, owner-gated, with an empty state', () => {
    expect(svc).toMatch(/workerFetch<EarningsReport>\('\/v1\/admin\/earnings'\)/);
    expect(screen).toMatch(/const earningsSection = !owner \? null/);
    expect(screen).toMatch(/No earnings yet/);
    expect(svc + screen).not.toMatch(/Math\.random|DEMO_|SAMPLE_|fake/);
  });
  it('drill-downs are owner only', () => {
    expect(screen).toMatch(/disabled=\{!owner\}/);
    expect(read('src/screens/Admin/AdminListScreen.tsx')).toMatch(/Owner only\./);
  });
});

describe('Admin drill-down rows', () => {
  it('users: name, short id, joined, last active, photo only when real; opens the profile', () => {
    const r = userRow('abcdefghij', { name: ' Sai ', createdAt: { toMillis: () => new Date(2026, 10, 2).getTime() }, lastActive: '2026-11-16', avatarUrl: 'data:image/jpeg;base64,AA' });
    expect(r).toMatchObject({ title: 'Sai', image: 'data:image/jpeg;base64,AA', open: { screen: 'UserProfile', params: { userId: 'abcdefghij' } } });
    expect(r.subtitle).toBe('@abcdef · Joined 2 Nov 2026 · Last active 2026-11-16');
    const bare = userRow('u1', {});
    expect(bare).toMatchObject({ title: 'No name', image: null, at: 0 });
    expect(bare.subtitle).toContain('Joined — · Last active —');
  });
  it('wardrobe / posts / circles open their own screens', () => {
    expect(wardrobeRow('w1', { name: 'Kurta', category: 'Tops', userId: 'user123456' }).open).toEqual({ screen: 'PostDetail', params: { kind: 'wardrobe', id: 'w1' } });
    const p = postRow('p1', { caption: '', morePhotos: ['b', 'c'], likeCount: 2, userName: 'Sai' });
    expect(p.title).toBe('Poll (3 photos)');
    expect(p.subtitle).toContain('poll A–C');
    expect(p.open).toEqual({ screen: 'PostDetail', params: { kind: 'post', id: 'p1' } });
    expect(circleRow('c1', { name: 'Family', isPrivate: true, memberIds: ['a', 'b'] })).toMatchObject({
      title: 'Family',
      subtitle: expect.stringContaining('🔒 Private · 2 members'),
      open: { screen: 'CircleInfo', params: { circleId: 'c1' } },
    });
  });
  it('helpers', () => {
    expect(imageOf('file:///x.jpg')).toBeNull();
    expect(imageOf('https://x/y.png')).toBe('https://x/y.png');
    expect(toMs({ seconds: 2 })).toBe(2000);
    expect(shortDate(0)).toBe('—');
  });
});
