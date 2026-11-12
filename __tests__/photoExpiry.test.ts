import { isPhotoExpired, PHOTO_TTL_DAYS } from '../src/utils/photoExpiry';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 12, 6, 0);

test('photos older than 60 days are expired', () => {
  expect(PHOTO_TTL_DAYS).toBe(60);
  expect(isPhotoExpired(new Date(now - 61 * DAY), now)).toBe(true);
  expect(isPhotoExpired(new Date(now - 60 * DAY - 1000), now)).toBe(true);
});

test('recent or pending photos stay visible', () => {
  expect(isPhotoExpired(new Date(now - 59 * DAY), now)).toBe(false);
  expect(isPhotoExpired(new Date(now - 60 * DAY), now)).toBe(false);
  expect(isPhotoExpired(null, now)).toBe(false);
  expect(isPhotoExpired(undefined, now)).toBe(false);
});
