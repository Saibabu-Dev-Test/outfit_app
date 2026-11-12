// Photo sizes for Firestore (free Spark plan: photos live inside documents, no Cloud Storage).
// Full photo: shown on detail screens and in the zoom viewer, kept in a separate media doc.
// Thumbnail: lists and grids read only this (on the light parent doc).
// Clear: what feed cards show full width, kept in a media/clear doc next to media/full.
// Sizes are encoded bytes; base64 adds a third (160 KB -> ~218K characters).
// Every photo is downscaled with filtering (never upscaled beyond the original), slightly
// contrast-stretched and sharpened, then saved as lossy WebP (Android; JPEG on the web / fallback)
// at the highest quality (60..92) that fits; below 60 the long edge is lowered instead.
// Since the "clearer photos" pass (Nov 2026): full 1600 px <= 160 KB (was 1080 px / 80 KB JPEG),
// clear 1080 px <= 80 KB (was 720 px / 45 KB), thumb 360 px <= 16 KB (was 200 px / 12 KB).
// Firestore limits these must respect: a full photo has a document of its own (media/full,
// media/full0..5 on multi-photo posts; firestore.rules allows imageData <= 950000 chars there),
// clear copies <= 300000 chars, poll / chat message docs (up to 6 photos) <= 1 MiB, feedback image
// <= 145000 chars, wardrobe cache in AsyncStorage (thumbs only). Older photos keep their old sizes.
export interface ImageSpec {
  maxEdge: number; // long edge in px
  maxBytes: number;
  sharpen?: number; // unsharp-mask amount; default 0.55 (0.35 for <= 400 px)
  jpeg?: boolean; // force JPEG (default: lossy WebP on Android, JPEG fallback)
  enhance?: boolean; // contrast + sharpen filter; false = keep the original look (default true)
  minQ?: number; // quality range searched (default 60..92)
  maxQ?: number;
}

// History: build 94 used ONE 1440 px / 170 KB WebP as both detail and feed photo (SHARP_SPEC).
// Since the "near original" pass (build 115): the full photo is a JPEG, long edge up to 2048 px, no
// filter, quality stepping down from 92 until it is at most 690 KB. Base64 makes that ~920K
// characters, so one full photo still fits in one Firestore document (1 MiB) with its few other
// fields. It is read only when a photo is opened (detail screen / zoom viewer). Feed cards show the
// CLEAR copy (~1080 px, <= 56 KB) and grids the THUMB (360 px, <= 16 KB), so lists stay light.
// Older photos (1440 px / 170 KB, 1080 px / 80 KB...) keep working: readers only look at the data URI.
export const FULL_SPEC: ImageSpec = { maxEdge: 2048, maxBytes: 690 * 1024, jpeg: true, enhance: false, minQ: 70, maxQ: 92 };
// The previous full photo size (still used where a document holds several photos)
export const SHARP_SPEC: ImageSpec = { maxEdge: 1440, maxBytes: 170 * 1024, sharpen: 0.6 };
export const THUMB_SPEC: ImageSpec = { maxEdge: 360, maxBytes: 16 * 1024 };
// Feed card / chat bubble photo (full width): sharp and still small (~40-60 KB)
export const CLEAR_SPEC: ImageSpec = { maxEdge: 1080, maxBytes: 56 * 1024, sharpen: 0.5 };
// Largest base64 length (characters, with the data: prefix) of one full photo
export const FULL_MAX_CHARS = Math.ceil((690 * 1024 * 4) / 3) + 64;
// Circle poll / chat photos (up to 6 in one message doc: 6 x ~109K chars < 1 MiB)
export const POLL_SPEC: ImageSpec = { maxEdge: 1080, maxBytes: 80 * 1024 };
// Profile photo and its tiny copy for posts / comments / likes (denormalised, <= 60000 chars)
export const AVATAR_SPEC: ImageSpec = { maxEdge: 400, maxBytes: 32 * 1024 };
export const AVATAR_THUMB_SPEC: ImageSpec = { maxEdge: 128, maxBytes: 8 * 1024 };

// Base64 characters of a data URI (approximate bytes * 4/3)
export const dataUriChars = (uri: string): number => uri.length - uri.indexOf(',') - 1;
// Upper bound on the base64 size of an image made with this spec (+ data: prefix slack)
export const specChars = (s: ImageSpec): number => Math.ceil((s.maxBytes * 4) / 3) + 64;
