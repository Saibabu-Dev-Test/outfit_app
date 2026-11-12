// Auto-translate other users' posts, comments, circle chat and birthday wishes into the reader's
// language, on the phone (Android: TranslateModule.kt = Google ML Kit Translation + Language ID).
// Free and offline: no server, no Cloud Functions, nothing leaves the phone. Each language model
// (~30 MB) is downloaded once; until then (or offline without it) the original text is shown.
// - Reader language: the profile `language` (i18n/astroNames astroLanguage). ML Kit has no model
//   for Malayalam, Punjabi or Odia, so those readers get English (targetCode).
// - Source language: the script first (Telugu, Tamil, Kannada... letters are unambiguous), ML Kit
//   Language ID for Devanagari (Hindi / Marathi) and Latin text. Romanized text ("hi-Latn") and
//   languages without a model are left as they are.
// - Cache: memory + AsyncStorage, keyed by hash(text) + target, so repeated text is instant and
//   stays readable offline. Bounded (MAX_ENTRIES, oldest dropped).
// - Models: the reader's language + English download on first online use (any network); the
//   source language of a post downloads on Wi-Fi only (saves mobile data), then the post re-renders.
// - Chips under a translated text: original, reader's language, English (deduplicated).
// Web: translate.web.ts returns the original text.
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AstroLang, astroLanguage, LANG_META } from '../i18n/astroNames';

interface NativeTranslate {
  identify: (text: string) => Promise<string>;
  translate: (text: string, from: string, to: string) => Promise<string>;
  ensureModel: (lang: string, wifiOnly: boolean) => Promise<boolean>;
  hasModel: (lang: string) => Promise<boolean>;
}
const native = (): NativeTranslate | undefined =>
  Platform.OS === 'android' ? (NativeModules.OutfitTranslate as NativeTranslate | undefined) : undefined;

// App languages ML Kit can translate (checked against ML Kit's supported list, 2026-11)
export const MLKIT_LANGS = new Set(['en', 'te', 'hi', 'ta', 'kn', 'mr', 'bn', 'gu', 'ur']);
// App languages without an ML Kit model: shown as they are; readers of these get English
export const NO_MODEL_LANGS = new Set(['ml', 'pa', 'or']);

// Reader's language -> ML Kit target code (English when ML Kit has no model for it)
export const targetCode = (lang: AstroLang | string | null | undefined): string => {
  const l: AstroLang = typeof lang === 'string' && lang in LANG_META ? (lang as AstroLang) : astroLanguage(lang);
  const code = LANG_META[l].code;
  return MLKIT_LANGS.has(code) ? code : 'en';
};

// Script -> language when the letters say it plainly (null: ask ML Kit)
const SCRIPTS: [RegExp, string][] = [
  [/[\u0C00-\u0C7F]/, 'te'],
  [/[\u0B80-\u0BFF]/, 'ta'],
  [/[\u0C80-\u0CFF]/, 'kn'],
  [/[\u0D00-\u0D7F]/, 'ml'],
  [/[\u0980-\u09FF]/, 'bn'],
  [/[\u0A80-\u0AFF]/, 'gu'],
  [/[\u0A00-\u0A7F]/, 'pa'],
  [/[\u0B00-\u0B7F]/, 'or'],
  [/[\u0600-\u06FF]/, 'ur'],
];
export const scriptLanguage = (text: string): string | null => {
  let best: string | null = null;
  let bestCount = 0;
  for (const [re, code] of SCRIPTS) {
    const n = (text.match(new RegExp(re.source, 'g')) || []).length;
    if (n > bestCount) {
      best = code;
      bestCount = n;
    }
  }
  return best;
};
// Nothing to translate: empty, only emoji / numbers / punctuation / @mentions / links
// (\p{M}: Indian scripts write vowels as combining marks)
export const hasWords = (text: string): boolean =>
  /\p{L}[\p{L}\p{M}]+/u.test(text.replace(/https?:\/\/\S+/g, '').replace(/@\S+/g, ''));

// 53-bit string hash (cyrb53): the cache key, so the cache never stores the text twice
export const textHash = (s: string): string => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};
export const cacheKey = (text: string, to: string) => `${textHash(text)}|${to}`;

// Chips under a translated text: original, reader's language, English (deduplicated, in order)
export const chipCodes = (from: string, reader: string): string[] => Array.from(new Set([from, reader, 'en']));
export const chipLabel = (code: string) => code.toUpperCase();

// ── Cache (memory + AsyncStorage) ─────────────────────────────────────────
const STORE_KEY = '@outfit_translate_cache_v1';
export const MAX_ENTRIES = 600;
// key -> translated text; "<hash>|@" -> detected language ('' = leave as is)
const mem = new Map<string, string>();
let loaded: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const load = () =>
  loaded ||
  (loaded = AsyncStorage.getItem(STORE_KEY)
    .then(raw => {
      if (!raw) return;
      const saved: [string, string][] = JSON.parse(raw);
      saved.forEach(([k, v]) => {
        if (!mem.has(k)) mem.set(k, v);
      });
    })
    .catch(() => undefined));

const remember = (k: string, v: string) => {
  mem.delete(k); // re-insert = newest
  mem.set(k, v);
  while (mem.size > MAX_ENTRIES) mem.delete(mem.keys().next().value as string);
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    AsyncStorage.setItem(STORE_KEY, JSON.stringify(Array.from(mem.entries()))).catch(() => undefined);
  }, 1000);
};

// Instant answer from memory (no await), for the first render
export const cachedTranslation = (text: string, to: string): string | undefined => mem.get(cacheKey(text, to));
export const cachedLanguage = (text: string): string | undefined => mem.get(`${textHash(text)}|@`);

// ── Models ────────────────────────────────────────────────────────────────
const modelListeners = new Set<() => void>();
// Called when a language model finishes downloading (TranslatedText retries what it could not translate)
export const onModelReady = (cb: () => void) => {
  modelListeners.add(cb);
  return () => {
    modelListeners.delete(cb);
  };
};
const tried = new Map<string, number>(); // lang -> last attempt (ms)
const RETRY_MS = 5 * 60000;
const ensure = async (lang: string, wifiOnly: boolean) => {
  const n = native();
  if (!n || !MLKIT_LANGS.has(lang)) return false;
  const last = tried.get(lang);
  if (last && Date.now() - last < RETRY_MS) return false;
  tried.set(lang, Date.now());
  try {
    const was = await n.hasModel(lang).catch(() => false);
    if (was) return true;
    await n.ensureModel(lang, wifiOnly);
    modelListeners.forEach(cb => cb());
    return true;
  } catch {
    return false; // offline / no Wi-Fi: try again later
  }
};
// First online use: the reader's language + English (any network). Safe to call often.
export const prepareReaderModels = (readerLang: string | null | undefined) => {
  const to = targetCode(readerLang);
  ensure(to, false);
  if (to !== 'en') ensure('en', false);
};

// ── Detect + translate ────────────────────────────────────────────────────
// ML Kit code of the text, or null when it can't / shouldn't be translated
export const detectLanguage = async (text: string): Promise<string | null> => {
  await load();
  const k = `${textHash(text)}|@`;
  const hit = mem.get(k);
  if (hit !== undefined) return hit || null;
  let code: string | null = hasWords(text) ? scriptLanguage(text) : null;
  if (!code && hasWords(text)) {
    try {
      const id = await native()?.identify(text);
      code = id && id !== 'und' && !id.includes('-') ? id.split('-')[0] : null; // "hi-Latn" = romanized: skip
    } catch {
      code = null;
    }
  }
  if (code && !MLKIT_LANGS.has(code)) code = null; // e.g. Malayalam: no model, show as is
  remember(k, code || '');
  return code;
};

export interface Translation {
  from: string | null; // detected language (null = not translatable)
  text: string; // translated text, or the original when it could not be translated
  translated: boolean;
}

// Never throws. Offline without the model -> the original text (translated: false).
export const translateText = async (text: string, to: string): Promise<Translation> => {
  const original: Translation = { from: null, text, translated: false };
  const n = native();
  if (!n || !text.trim()) return original;
  const from = await detectLanguage(text);
  if (!from) return original;
  if (from === to) return { from, text, translated: false };
  const k = cacheKey(text, to);
  const hit = mem.get(k);
  if (hit !== undefined) return { from, text: hit, translated: true };
  try {
    const out = await n.translate(text, from, to);
    remember(k, out);
    return { from, text: out, translated: true };
  } catch (e: any) {
    if (e?.code === 'NO_MODEL') {
      prepareReaderModels(to);
      ensure(from, true); // the post's language: Wi-Fi only
    }
    return { from, text, translated: false };
  }
};

// Tests only
export const __resetTranslateCache = () => {
  mem.clear();
  tried.clear();
  loaded = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
};
