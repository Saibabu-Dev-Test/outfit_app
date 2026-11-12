jest.mock('../src/services/wardrobeApi', () => ({
  addWardrobeItem: jest.fn(async (p: any) => {
    if (p.category === 'Bad') throw new Error('nope');
    return { id: `id_${p.name}`, name: p.name, category: p.category };
  }),
}));

import { addWardrobeItem } from '../src/services/wardrobeApi';
import { quickNames, saveQuickItems } from '../src/services/quickAdd';
import { batchStoredBytes, fitsInFirestore, formatBytes, imageBytes } from '../src/utils/photoStorage';

const photo = (n: number) => `data:image/jpeg;base64,${'A'.repeat(n)}`;

describe('photo storage sizes', () => {
  it('decoded and stored bytes', () => {
    expect(imageBytes('data:image/jpeg;base64,QUJD')).toBe(3);
    expect(imageBytes('data:image/jpeg;base64,QUI=')).toBe(2);
    expect(imageBytes(null)).toBe(0);
    const p = { dataUri: photo(1000), thumbUri: photo(100) };
    expect(batchStoredBytes([p, p])).toBe(2 * (1023 + 123));
  });
  it('Firestore 1 MiB document limit', () => {
    expect(fitsInFirestore({ dataUri: photo(200000) })).toBe(true);
    expect(fitsInFirestore({ dataUri: photo(1048576) })).toBe(false);
  });
  it('formats', () => {
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('quick add', () => {
  it('numbers names per category only when repeated', () => {
    expect(quickNames([{ category: 'Kurtas' }, { category: 'Jeans' }, { category: 'Kurtas' }])).toEqual(['Kurtas 1', 'Jeans', 'Kurtas 2']);
  });
  it('saves one by one, reports failures and progress', async () => {
    const progress: number[] = [];
    const r = await saveQuickItems(
      'u1',
      'Female',
      [
        { key: 'a', category: 'Kurtis', dataUri: photo(10) },
        { key: 'b', category: 'Bad', dataUri: photo(10) },
        { key: 'c', category: 'Sarees', dataUri: photo(10), thumbUri: photo(5) },
      ],
      false,
      d => progress.push(d),
    );
    expect(r.saved.map(s => s.id)).toEqual(['id_Kurtis', 'id_Sarees']);
    expect(r.failed).toEqual([{ key: 'b', error: 'nope' }]);
    expect(progress).toEqual([1, 2, 3]);
    expect((addWardrobeItem as jest.Mock).mock.calls[2][0]).toMatchObject({ userId: 'u1', isPublic: false, imageThumb: photo(5) });
  });
});
