// Photo options pipeline: background (Blur / Remove BG) on the full-size ORIGINAL first, then Blur
// face, then the Adjust crop LAST, so zoom / crop never cuts or blurs the subject's outline; the
// preview gets the full-size processed file (fileUri), not the small feed copy.
const calls: string[] = [];

jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn(), launchImageLibrary: jest.fn() }));
jest.mock('../src/utils/imageResize', () => ({
  canResize: () => true,
  resizeImage: async (uri: string, spec: { maxEdge: number }) => {
    calls.push(`resize:${uri}:${spec.maxEdge}`);
    return `data:image/jpeg;base64,${spec.maxEdge}`;
  },
}));
jest.mock('../src/native/photoBackground', () => ({
  applyPhotoBg: async (uri: string, mode: string, level: number) => {
    calls.push(`bg:${uri}:${mode}:${level}`);
    return 'file:///bg.jpg';
  },
}));
jest.mock('../src/native/photoEdit', () => ({
  editPhoto: async (uri: string, e: { blurFaces?: boolean; crop?: unknown }) => {
    if (e.blurFaces) {
      calls.push(`faces:${uri}`);
      return { uri: 'file:///faces.jpg', changed: true, faces: 1 };
    }
    calls.push(`crop:${uri}`);
    return { uri: 'file:///crop.jpg', changed: true, faces: 0 };
  },
}));

import { remakeImage, PHOTO_PICK } from '../src/utils/imagePicker';

beforeEach(() => {
  calls.length = 0;
});

describe('remakeImage', () => {
  it('runs background -> Blur face -> crop, each on the previous full-size result', async () => {
    const crop = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 };
    const p = await remakeImage('file:///orig.jpg', { mode: 'blur', level: 4, blurFaces: true, crop }, PHOTO_PICK);
    expect(calls.slice(0, 3)).toEqual(['bg:file:///orig.jpg:blur:4', 'faces:file:///bg.jpg', 'crop:file:///faces.jpg']);
    // Every upload size is made from the final processed file
    expect(calls.slice(3).every(c => c.startsWith('resize:file:///crop.jpg:'))).toBe(true);
    expect(p).toMatchObject({ uri: 'file:///orig.jpg', faces: 1, baseUri: 'file:///faces.jpg', fileUri: 'file:///crop.jpg' });
  });

  it('Remove BG without crop: the preview and Adjust both use the full-size processed file', async () => {
    const p = await remakeImage('file:///orig.jpg', { mode: 'plain' }, PHOTO_PICK);
    expect(calls[0]).toBe('bg:file:///orig.jpg:plain:undefined'); // default level inside applyPhotoBg
    expect(calls.some(c => c.startsWith('crop:') || c.startsWith('faces:'))).toBe(false);
    expect(p).toMatchObject({ baseUri: 'file:///bg.jpg', fileUri: 'file:///bg.jpg' });
  });

  it('Original: no processing, no processed file', async () => {
    const p = await remakeImage('file:///orig.jpg', { mode: 'off' }, PHOTO_PICK);
    expect(calls.every(c => c.startsWith('resize:file:///orig.jpg:'))).toBe(true);
    expect(p?.fileUri).toBeUndefined();
    expect(p?.baseUri).toBeUndefined();
  });
});
