// Web build: no on-device translation (ML Kit is Android only), so every text is shown as written
// and no chips appear. Same exports as translate.ts.
export interface Translation {
  from: string | null;
  text: string;
  translated: boolean;
}
export const MLKIT_LANGS = new Set<string>();
export const NO_MODEL_LANGS = new Set<string>();
export const MAX_ENTRIES = 0;
export const targetCode = (_lang?: string | null): string => 'en';
export const scriptLanguage = (_text: string): string | null => null;
export const hasWords = (_text: string) => false;
export const textHash = (s: string) => String(s.length);
export const cacheKey = (text: string, to: string) => `${textHash(text)}|${to}`;
export const chipCodes = (from: string, reader: string): string[] => Array.from(new Set([from, reader, 'en']));
export const chipLabel = (code: string) => code.toUpperCase();
export const cachedTranslation = (_text: string, _to: string): string | undefined => undefined;
export const cachedLanguage = (_text: string): string | undefined => '';
export const onModelReady = (_cb: () => void) => () => {};
export const prepareReaderModels = (_readerLang?: string | null) => {};
export const detectLanguage = async (_text: string): Promise<string | null> => null;
export const translateText = async (text: string, _to: string): Promise<Translation> => ({ from: null, text, translated: false });
export const __resetTranslateCache = () => {};
