// Photo sizes for Firestore (free Spark plan: photos live inside documents, no Cloud Storage).
// Full photo: shown only on detail screens, kept in a separate media doc.
// Thumbnail: lists, grids and the feed read only this (on the light parent doc).
// Sizes are JPEG bytes; base64 adds a third (80 KB -> ~107K characters).
// Every photo is downscaled with filtering, slightly contrast-stretched and sharpened, then saved
// at the highest JPEG quality (60..92) that fits; below 60 the long edge is lowered instead.
export interface ImageSpec {
  maxEdge: number; // long edge in px
  maxBytes: number;
}

export const FULL_SPEC: ImageSpec = { maxEdge: 1080, maxBytes: 80 * 1024 };
export const THUMB_SPEC: ImageSpec = { maxEdge: 200, maxBytes: 12 * 1024 };
// Circle poll / chat photos (up to 6 in one message doc)
export const POLL_SPEC: ImageSpec = { maxEdge: 720, maxBytes: 40 * 1024 };
// Profile photo and its tiny copy for posts / comments / likes (denormalised)
export const AVATAR_SPEC: ImageSpec = { maxEdge: 256, maxBytes: 20 * 1024 };
export const AVATAR_THUMB_SPEC: ImageSpec = { maxEdge: 96, maxBytes: 5 * 1024 };

// Base64 characters of a data URI (approximate bytes * 4/3)
export const dataUriChars = (uri: string): number => uri.length - uri.indexOf(',') - 1;
// Upper bound on the base64 size of an image made with this spec (+ data: prefix slack)
export const specChars = (s: ImageSpec): number => Math.ceil((s.maxBytes * 4) / 3) + 64;
