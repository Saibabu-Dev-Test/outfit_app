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
// Firestore limits these must respect: media docs <= 300000 chars (firestore.rules), poll / chat
// message docs (up to 6 photos) <= 1 MiB, feedback image <= 145000 chars, wardrobe cache in
// AsyncStorage (thumbs only). Older photos keep their old sizes.
export interface ImageSpec {
  maxEdge: number; // long edge in px
  maxBytes: number;
  sharpen?: number; // unsharp-mask amount; default 0.55 (0.35 for <= 400 px)
}

// Since the "one sharp copy" pass (Nov 2026, build 94): ONE 1440 px photo <= 170 KB (WebP, far under
// 1 MB, always >= 1080 px when the original is) is both the detail photo and the feed photo; the
// separate 1080 px clear copy is no longer made. ~190 KB per item instead of ~256 KB, and sharper
// in the feed. Older items' clear copies are removed by compactMyClearCopies (wardrobeApi).
export const FULL_SPEC: ImageSpec = { maxEdge: 1440, maxBytes: 170 * 1024, sharpen: 0.6 };
export const THUMB_SPEC: ImageSpec = { maxEdge: 360, maxBytes: 16 * 1024 };
// Feed card photo (full width): sharp and still small
export const CLEAR_SPEC: ImageSpec = { maxEdge: 1080, maxBytes: 80 * 1024, sharpen: 0.65 };
// Circle poll / chat photos (up to 6 in one message doc: 6 x ~109K chars < 1 MiB)
export const POLL_SPEC: ImageSpec = { maxEdge: 1080, maxBytes: 80 * 1024 };
// Profile photo and its tiny copy for posts / comments / likes (denormalised, <= 60000 chars)
export const AVATAR_SPEC: ImageSpec = { maxEdge: 400, maxBytes: 32 * 1024 };
export const AVATAR_THUMB_SPEC: ImageSpec = { maxEdge: 128, maxBytes: 8 * 1024 };

// Base64 characters of a data URI (approximate bytes * 4/3)
export const dataUriChars = (uri: string): number => uri.length - uri.indexOf(',') - 1;
// Upper bound on the base64 size of an image made with this spec (+ data: prefix slack)
export const specChars = (s: ImageSpec): number => Math.ceil((s.maxBytes * 4) / 3) + 64;
