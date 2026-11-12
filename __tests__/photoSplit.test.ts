// Chat photo split (build 115): small inline copy + near-original full photo in media/full
jest.mock('../src/utils/imageResize', () => ({
  canResize: () => true,
  resizeImage: jest.fn(async () => 'data:image/webp;base64,' + 'a'.repeat(70000)),
}));
import { INLINE_MAX_CHARS, splitChatPhoto } from '../src/services/photoSplit';
import { CLEAR_SPEC, FULL_MAX_CHARS, FULL_SPEC, specChars } from '../src/utils/imageSpecs';
import { MAX_BASE64_CHARS } from '../src/utils/imagePicker';

const img = (n: number) => 'data:image/jpeg;base64,' + 'b'.repeat(n);

test('full photo fits one Firestore doc (1 MiB) after base64', () => {
  expect(FULL_SPEC.maxBytes).toBeLessThanOrEqual(700 * 1024);
  expect(FULL_SPEC.maxEdge).toBe(2048);
  expect(FULL_SPEC.jpeg).toBe(true);
  expect(FULL_MAX_CHARS).toBeLessThan(950000); // firestore.rules media limit
  expect(MAX_BASE64_CHARS).toBe(FULL_MAX_CHARS);
  expect(specChars(CLEAR_SPEC)).toBeLessThan(INLINE_MAX_CHARS);
});

test('small photo stays inline, no media doc', async () => {
  const r = await splitChatPhoto(img(100000));
  expect(r.full).toBeNull();
  expect(r.inline.length).toBe(100000 + 23);
});

test('clear + full given: clear inline, full separate', async () => {
  const r = await splitChatPhoto(img(70000), img(900000));
  expect(r.inline.length).toBeLessThan(INLINE_MAX_CHARS);
  expect(r.full?.length).toBe(900000 + 23);
});

test('one big photo: a clear copy is made for the chat', async () => {
  const r = await splitChatPhoto(img(900000));
  expect(r.inline.length).toBeLessThan(INLINE_MAX_CHARS);
  expect(r.full?.length).toBe(900000 + 23);
});

test('too large photo is refused', async () => {
  await expect(splitChatPhoto(img(FULL_MAX_CHARS + 1000))).rejects.toThrow();
  await expect(splitChatPhoto('file:///x.jpg')).rejects.toThrow();
});
