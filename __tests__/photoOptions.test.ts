// Photo options (Blur face / Adjust) are offered in every photo upload flow.
import { faceMessage } from '../src/i18n/photoEditLabels';
import { reviewPhoto, reviewPhotos } from '../src/components/PhotoReviewHost';
import { editPhoto, isPhotoEditSupported } from '../src/native/photoEdit';

declare const require: (m: string) => any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');
const read = (rel: string): string => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('photo options', () => {
  it('face blur note: count, none found, not available', () => {
    expect(faceMessage(2)).toBe('2 face(s) blurred');
    expect(faceMessage(0)).toBe('No face found in this photo');
    expect(faceMessage(-1)).toBe('Face blur is not available on this phone yet');
    expect(faceMessage(undefined, 'Telugu')).toBe('ఈ ఫోన్‌లో ముఖం బ్లర్ ఇంకా అందుబాటులో లేదు');
  });

  it('passes photos through unchanged when the native module / host is missing', async () => {
    expect(isPhotoEditSupported()).toBe(false);
    const imgs = [{ dataUri: 'data:image/jpeg;base64,AA', uri: 'file:///a.jpg' }];
    await expect(reviewPhotos(imgs)).resolves.toBe(imgs);
    await expect(reviewPhoto(null)).resolves.toBeNull();
    await expect(editPhoto('file:///a.jpg', { blurFaces: true })).resolves.toEqual({
      uri: 'file:///a.jpg',
      changed: false,
      faces: -1,
    });
  });

  it('every photo upload flow opens the photo options', () => {
    [
      'src/screens/Wardrobe/QuickAddScreen.tsx',
      'src/screens/Circles/CircleChatScreen.tsx',
      'src/screens/Home/BirthdayChatScreen.tsx',
      'src/screens/Profile/ProfileScreen.tsx',
      'src/components/CameraPollModal.tsx',
      'src/components/CreatePollModal.tsx',
      'src/components/MultiShotModal.tsx',
      'src/components/FeedbackModal.tsx',
    ].forEach(f => expect(read(f)).toMatch(/reviewPhotos?\(/));
    const add = read('src/screens/Wardrobe/AddItemScreen.tsx');
    expect(add).toMatch(/blurFaces/);
    expect(add).toMatch(/PhotoAdjustModal/);
    expect(add).toMatch(/ZoomableImage/);
    expect(read('App.tsx')).toMatch(/<PhotoReviewHost \/>/);
  });

  it('native face blur module is registered and the web has a stub', () => {
    expect(read('android/app/src/main/java/com/outfit/OutfitNativePackage.kt')).toMatch(/PhotoEditModule\(reactContext\)/);
    expect(read('android/app/build.gradle')).toMatch(/com\.google\.mlkit:face-detection/);
    expect(read('src/native/photoEdit.web.ts')).toMatch(/isPhotoEditSupported = \(\): boolean => false/);
  });
});
