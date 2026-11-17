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

  it("Today's pick is removed everywhere", () => {
    expect(fs.existsSync(path.join(__dirname, '..', 'src/components/TodaysPick.tsx'))).toBe(false);
    expect(read('src/components/WardrobeVoteGrid.tsx')).not.toMatch(/Today's pick/);
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

  it('Earn tab shows no partner names or payout percentages (they live in Terms)', () => {
    const src = read('src/screens/Earn/EarnScreen.tsx');
    expect(src).not.toMatch(/from CPX Research|\(Offerwall\.GG\)|by BitLabs|Open BitLabs|from BitLabs/);
    expect(src).not.toMatch(/USER_SHARE|You get \{|see Terms/);
    expect(read('src/screens/Profile/TermsScreen.tsx')).toMatch(/USER_SHARE/);
  });

  it('Earn tab keeps the daily "watch 1 ad + vote 1 outfit" gate; the old per-survey ad stays removed', () => {
    const src = read('src/screens/Earn/EarnScreen.tsx');
    // until both steps are done today, the two steps show at the top
    expect(src).toMatch(/const unlocked = isUnlocked\(d\)/);
    expect(src).toMatch(/\{!unlocked \? \([\s\S]*Complete to start earning today[\s\S]*label="Watch 1 ad"[\s\S]*label="Vote on 1 outfit" cta="Go to Feed"[\s\S]*\) : null\}/);
    // two no-fills tick the ad step with no coins
    expect(src).toMatch(/adNoFill >= 2\) \{[\s\S]*recordEarnAd\(uid, \{ skipped: true \}\)/);
    expect(read('src/services/earnApi.ts')).toMatch(/adSkipped: true/);
    expect(read('src/services/earnLedger.ts')).toMatch(/export const isUnlocked = \(d: EarnDay\): boolean => d\.adWatched && d\.voted/);
    // check-in: gate checked before writing (plain message), and again in the rules
    const api = read('src/services/earnApi.ts');
    expect(api.slice(api.indexOf('export const dailyCheckIn'))).toMatch(/if \(!isUnlocked\(d\)\) throw new Error\(CHECKIN_GATE_MESSAGE\)/);
    expect(read('firestore.rules')).toMatch(/check-in only once the gate is open[\s\S]*adWatched', false\) == true && request\.resource\.data\.get\('voted', false\) == true/);
    // the old "one ad after each survey before the next one" stays removed
    expect(src).not.toMatch(/surveyAdOwed|payOwedAd|Watch ad to continue/);
    expect(api).not.toMatch(/clearSurveyAd/);
    expect(read('src/services/earnLedger.ts')).not.toMatch(/surveyAdOwed/);
  });

  it('Earn tab never hides the cards behind the gate: they render locked below it', () => {
    const src = read('src/screens/Earn/EarnScreen.tsx');
    // no early return for the locked state: one render path holds the gate and every card
    expect(src).not.toMatch(/if \(!unlocked\) \{\s*return/);
    const render = src.slice(src.indexOf('{!unlocked ? ('));
    const gateEnd = render.indexOf(') : null}');
    expect(gateEnd).toBeGreaterThan(0);
    const cards = render.slice(gateEnd);
    for (const card of ['Withdrawable', '📅 Daily check-in', '▶️ Watch an ad', '📝 Surveys', '🎯 Offers', '📋 Surveys & offers', '🎮 Games', '🧠 Quizzes & learning', '🤝 Invite friends', '💸 Withdraw to UPI']) {
      expect(cards).toContain(card);
    }
    // locked: dimmed buttons, the hint under each card, and a tap only shows the hint
    expect(src).toMatch(/export const GATE_HINT = 'Finish the 2 steps above to unlock'/);
    expect(src).toMatch(/const lockNote = locked \? <Text[^>]*>🔒 \{GATE_HINT\}<\/Text> : null/);
    expect(cards.split('{lockNote}').length - 1).toBeGreaterThanOrEqual(8);
    expect(cards.split('locked || busy ===').length - 1).toBeGreaterThanOrEqual(8);
    for (const fn of ['watchAd = async', 'checkIn = async', 'openSurveys = async', 'openOffers = ', 'openBitlabs = ', 'openGames = ', 'onShare = ', 'onSaveUpi = async', 'onWithdraw = async']) {
      expect(src.slice(src.indexOf(`const ${fn}`)).split('\n')[1]).toMatch(/if \(lockedHint\(\)\) return;/);
    }
    expect(src).toMatch(/const lockedHint = \(\): boolean => \{\s*if \(unlocked\) return false;\s*Alert\.alert\('Locked for today', `\$\{GATE_HINT\}/);
    // the gate's own ad step is never locked
    expect(src.slice(src.indexOf('const watchGateAd'), src.indexOf('const watchAd'))).not.toMatch(/lockedHint/);
  });
});
