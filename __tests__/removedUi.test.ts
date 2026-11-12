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
});
