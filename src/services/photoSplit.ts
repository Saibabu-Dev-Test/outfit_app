// Chat photos (circles, birthday circle): the message doc keeps a small ~1080 px "clear" copy that
// the chat list shows, and the near-original full photo (up to ~942K base64 chars, imageSpecs
// FULL_SPEC) goes in its own doc .../messages/{id}/media/full {imageData, userId, createdAt}, read
// only when the photo is opened. So a chat with many photos never loads megabytes per screen.
// Old messages have one inline photo and no media doc: they display as before.
import { canResize, resizeImage } from '../utils/imageResize';
import { CLEAR_SPEC, FULL_MAX_CHARS } from '../utils/imageSpecs';

// Largest photo kept inline in a chat message (old 80-160 KB photos are below this)
export const INLINE_MAX_CHARS = 230000;

const isImg = (s?: string | null): s is string => !!s && /^data:image\//.test(s);

export interface SplitPhoto {
  inline: string; // shown in the chat list
  full: string | null; // stored in media/full when set
}

// imageData: what the caller has (a clear copy or a full photo); full: the full photo when the
// caller already has both. Never makes the inline copy bigger than the original. Throws a readable
// Error only when the photo can't be stored at all.
export const splitChatPhoto = async (imageData: string, full?: string | null): Promise<SplitPhoto> => {
  if (!isImg(imageData)) throw new Error('Photo could not be read. Please pick it again.');
  const big = isImg(full) && full.length > imageData.length ? full : null;
  if (big && big.length > FULL_MAX_CHARS + 100) throw new Error('This photo is too large to send. Please pick a smaller photo.');
  if (imageData.length <= INLINE_MAX_CHARS) return { inline: imageData, full: big };
  // Only one big photo given: make the clear copy from it
  if (imageData.length > FULL_MAX_CHARS + 100) throw new Error('This photo is too large to send. Please pick a smaller photo.');
  if (canResize()) {
    try {
      const small = await resizeImage(imageData, CLEAR_SPEC);
      if (small.length < imageData.length) return { inline: small, full: big || imageData };
    } catch {}
  }
  // No resizer: keep it inline (still fits one Firestore document)
  return { inline: imageData, full: null };
};
