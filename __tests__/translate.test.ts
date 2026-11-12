// services/translate.ts with the ML Kit native module (TranslateModule.kt) mocked
const mockNative = {
  identify: jest.fn(async (_t: string) => 'en'),
  translate: jest.fn(async (t: string, _from: string, to: string) => `[${to}] ${t}`),
  ensureModel: jest.fn(async (_l: string, _w: boolean) => true),
  hasModel: jest.fn(async (_l: string) => true),
};
// Getter: jest.mock is hoisted above `const mockNative`, so read it lazily
jest.mock('react-native', () => ({
  NativeModules: {
    get OutfitTranslate() {
      return mockNative;
    },
  },
  Platform: { OS: 'android' },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ASTRO_LANGS } from '../src/i18n/astroNames';
import {
  __resetTranslateCache,
  cacheKey,
  cachedTranslation,
  chipCodes,
  chipLabel,
  detectLanguage,
  hasWords,
  MAX_ENTRIES,
  onModelReady,
  scriptLanguage,
  targetCode,
  textHash,
  translateText,
} from '../src/services/translate';

beforeEach(async () => {
  jest.useRealTimers();
  __resetTranslateCache();
  await AsyncStorage.clear();
  Object.values(mockNative).forEach(f => f.mockClear());
});

describe('translate (offline, ML Kit mocked)', () => {
  it('maps reader languages to ML Kit codes, English for languages without a model', () => {
    expect(targetCode('Telugu')).toBe('te');
    expect(targetCode('Hindi')).toBe('hi');
    expect(targetCode('Urdu')).toBe('ur');
    expect(targetCode('Malayalam')).toBe('en');
    expect(targetCode('Punjabi')).toBe('en');
    expect(targetCode('Odia')).toBe('en');
    expect(targetCode('te')).toBe('te');
    expect(targetCode(null)).toBe('en');
  });

  it('translates into every app language ML Kit has a model for (12 app languages)', () => {
    const expected: Record<string, string> = {
      English: 'en', Telugu: 'te', Hindi: 'hi', Tamil: 'ta', Kannada: 'kn', Marathi: 'mr',
      Bengali: 'bn', Gujarati: 'gu', Urdu: 'ur',
      Malayalam: 'en', Punjabi: 'en', Odia: 'en', // no ML Kit translation model: English
    };
    ASTRO_LANGS.forEach(l => expect(targetCode(l)).toBe(expected[l]));
    ASTRO_LANGS.forEach(l => expect(chipCodes('te', targetCode(l)).map(chipLabel)).toContain('EN'));
  });

  it('reads the language from the script', () => {
    expect(scriptLanguage('ఎలా ఉన్నారు?')).toBe('te');
    expect(scriptLanguage('வணக்கம் நண்பா')).toBe('ta');
    expect(scriptLanguage('আপনি কেমন আছেন')).toBe('bn');
    expect(scriptLanguage('آپ کیسے ہیں')).toBe('ur');
    expect(scriptLanguage('Nice photo')).toBeNull();
    expect(hasWords('😍🔥 !!')).toBe(false);
    expect(hasWords('@sai https://x.y/z')).toBe(false);
    expect(hasWords('Super pic')).toBe(true);
  });

  it('builds chips: original, reader, English, deduplicated', () => {
    expect(chipCodes('te', 'hi')).toEqual(['te', 'hi', 'en']);
    expect(chipCodes('en', 'hi')).toEqual(['en', 'hi']);
    expect(chipCodes('te', 'en')).toEqual(['te', 'en']);
    expect(chipCodes('te', 'hi').map(chipLabel)).toEqual(['TE', 'HI', 'EN']);
  });

  it('keys the cache by hash(text) + target', () => {
    expect(textHash('abc')).toBe(textHash('abc'));
    expect(textHash('abc')).not.toBe(textHash('abd'));
    expect(cacheKey('abc', 'hi')).not.toBe(cacheKey('abc', 'te'));
  });

  it('translates once, then answers from the cache', async () => {
    const r1 = await translateText('బాగుంది', 'hi');
    expect(r1).toEqual({ from: 'te', text: '[hi] బాగుంది', translated: true });
    const r2 = await translateText('బాగుంది', 'hi');
    expect(r2.text).toBe('[hi] బాగుంది');
    expect(mockNative.translate).toHaveBeenCalledTimes(1);
    expect(mockNative.identify).not.toHaveBeenCalled(); // Telugu script needs no ML Kit call
    expect(cachedTranslation('బాగుంది', 'hi')).toBe('[hi] బాగుంది');
  });

  it('keeps translations readable after a restart (AsyncStorage)', async () => {
    jest.useFakeTimers();
    await translateText('నమస్తే', 'en');
    jest.advanceTimersByTime(1500);
    jest.useRealTimers();
    await Promise.resolve();
    __resetTranslateCache(); // app restart: memory gone, storage kept
    mockNative.translate.mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'NO_MODEL' }));
    const r = await translateText('నమస్తే', 'en');
    expect(r.translated).toBe(true);
    expect(r.text).toBe('[en] నమస్తే');
    expect(mockNative.translate).toHaveBeenCalledTimes(1);
  });

  it('does not translate text already in the reader language', async () => {
    const r = await translateText('Looking sharp!', 'en');
    expect(r).toEqual({ from: 'en', text: 'Looking sharp!', translated: false });
    expect(mockNative.translate).not.toHaveBeenCalled();
  });

  it('shows the original when the model is missing (offline) and asks for the models', async () => {
    mockNative.translate.mockRejectedValueOnce(Object.assign(new Error('no model'), { code: 'NO_MODEL' }));
    mockNative.hasModel.mockResolvedValue(false);
    const r = await translateText('ఈ రోజు బాగుంది', 'hi');
    expect(r).toEqual({ from: 'te', text: 'ఈ రోజు బాగుంది', translated: false });
    await new Promise<void>(res => setTimeout(res, 0));
    const calls = mockNative.ensureModel.mock.calls.map(c => `${c[0]}:${c[1]}`);
    expect(calls).toEqual(expect.arrayContaining(['hi:false', 'en:false', 'te:true'])); // post language: Wi-Fi only
    mockNative.hasModel.mockResolvedValue(true);
  });

  it('tells listeners when a model arrives', async () => {
    const cb = jest.fn();
    const off = onModelReady(cb);
    mockNative.hasModel.mockResolvedValueOnce(false);
    mockNative.translate.mockRejectedValueOnce(Object.assign(new Error('no model'), { code: 'NO_MODEL' }));
    await translateText('శుభోదయం', 'ta');
    await new Promise<void>(res => setTimeout(res, 0));
    expect(cb).toHaveBeenCalled();
    off();
  });

  it('skips romanized text, unsupported languages and emoji-only text', async () => {
    mockNative.identify.mockResolvedValueOnce('hi-Latn');
    expect(await detectLanguage('kya baat hai')).toBeNull();
    expect(await detectLanguage('സുഖമാണോ')).toBeNull(); // Malayalam: no ML Kit model
    expect((await translateText('🔥🔥', 'hi')).translated).toBe(false);
    expect(mockNative.translate).not.toHaveBeenCalled();
  });

  it('keeps the cache bounded', async () => {
    expect(MAX_ENTRIES).toBeGreaterThan(100);
    for (let i = 0; i < MAX_ENTRIES + 20; i++) await translateText(`పదం ${i}`, 'hi');
    expect(cachedTranslation('పదం 0', 'hi')).toBeUndefined(); // oldest dropped
    expect(cachedTranslation(`పదం ${MAX_ENTRIES + 19}`, 'hi')).toBeDefined();
  });
});
