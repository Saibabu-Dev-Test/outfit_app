// Guards for UI the owner removed on purpose. These came back once through merges of older
// branches; if one of these fails, a merge has re-added something that was deleted.
import { ACCESSORY_TYPES, typeLabel } from '../src/constants/wardrobe';

// Node built-ins without @types/node (jest runs in node)
declare const require: (m: string) => any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');
const read = (rel: string): string => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('removed UI stays removed', () => {
  it('profile header shows no style preference chips', () => {
    const src = read('src/components/ProfileHeader.tsx');
    expect(src).not.toMatch(/stylePrefs/);
    expect(read('src/screens/Profile/MeScreen.tsx')).not.toMatch(/stylePrefs=\{/);
    expect(read('src/screens/Profile/UserProfileScreen.tsx')).not.toMatch(/stylePrefs=\{/);
  });

  it('Upload Clothing has no Fabric Type section', () => {
    const src = read('src/screens/Wardrobe/AddItemScreen.tsx');
    expect(src).not.toMatch(/FABRIC TYPE/i);
    expect(src).not.toMatch(/FABRIC_TYPES/);
  });

  it('wardrobe / accessory type labels are English for every language', () => {
    ACCESSORY_TYPES.forEach(t => {
      expect(typeLabel(t)).toBe(t);
      expect(typeLabel(t, 'Telugu')).toBe(t);
      expect(typeLabel(t, 'Hindi')).toBe(t);
    });
  });

  it('wardrobe labels follow only Settings > App language (English by default), never the profile language', () => {
    ['src/screens/Wardrobe/AddItemScreen.tsx', 'src/screens/Wardrobe/WardrobeCategoryScreen.tsx'].forEach(f => {
      const src = read(f);
      expect(src).not.toMatch(/ypeLabel\([^)]*user\?*\.language/);
      expect(src).not.toMatch(/ypeLabel\([^)]*profile\?*\.language/);
    });
    expect(read('src/i18n/appLanguage.ts')).toMatch(/let current: AppLanguage = 'English'/);
  });

  it("Me profile has no Today's pick tab", () => {
    const src = read('src/screens/Profile/MeScreen.tsx');
    expect(src).not.toMatch(/Today's pick/);
    expect(src).not.toMatch(/TodaysPick/);
    expect(src).not.toMatch(/'pick'/);
  });

  it('astrology festivals and Porutham sit behind the daily ad unlock', () => {
    const src = read('src/components/AstrologyPanel.tsx');
    const lockedAt = src.indexOf('{unlocked ? (');
    const elseAt = src.indexOf(') : (', src.indexOf('moreFail'));
    expect(lockedAt).toBeGreaterThan(-1);
    const fest = src.indexOf('shownFest.map(festivalCard)');
    const por = src.indexOf('onOpenPorutham ? (');
    expect(fest).toBeGreaterThan(lockedAt);
    expect(fest).toBeLessThan(elseAt);
    expect(por).toBeGreaterThan(lockedAt);
    expect(por).toBeLessThan(elseAt);
    expect(src).toMatch(/Watch 1 ad to see full astrology/);
  });
  it('full astrology never opens free when no ad loads (only after watching 1 ad)', () => {
    const src = read('src/components/AstrologyPanel.tsx');
    const noAd = src.slice(src.indexOf("r === 'no_ad'"), src.indexOf('Closed before the reward'));
    expect(noAd).not.toMatch(/saveAstroUnlock|setUnlocked\(true\)/);
  });
});
