import { estimateDocBytes, formatBytes, percentOf, valueBytes, GIB } from '../src/utils/storageEstimate';

describe('storageEstimate', () => {
  it('sizes values like Firestore', () => {
    expect(valueBytes('abc')).toBe(4);
    expect(valueBytes(12)).toBe(8);
    expect(valueBytes(true)).toBe(1);
    expect(valueBytes(['a', 'b'])).toBe(4);
    expect(valueBytes({ ab: 'x' })).toBe(3 + 2);
  });
  it('counts a base64 photo at ~1 byte per character', () => {
    const photo = 'data:image/jpeg;base64,' + 'A'.repeat(100000);
    const b = estimateDocBytes('wardrobe/abc', { imageData: photo });
    expect(b).toBeGreaterThan(100000);
    expect(b).toBeLessThan(100200);
  });
  it('formats bytes and percents', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.50 KB');
    expect(formatBytes(GIB)).toBe('1.00 GB');
    expect(formatBytes(null)).toBe('—');
    expect(percentOf(GIB / 4, GIB)).toBe(25);
    expect(percentOf(5, 0)).toBe(0);
  });
});
