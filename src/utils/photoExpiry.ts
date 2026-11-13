// Circle chats: photos older than 60 days are hidden on the phone (text stays). Pure client-side
// check on the message's createdAt, so it costs no extra reads.
export const PHOTO_TTL_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

// createdAt null = still pending on the server (just sent): never expired
export const isPhotoExpired = (createdAt: Date | null | undefined, nowMs: number = Date.now()): boolean =>
  !!createdAt && nowMs - createdAt.getTime() > PHOTO_TTL_DAYS * DAY_MS;

export const PHOTO_EXPIRED_TEXT = `Photo expired after ${PHOTO_TTL_DAYS} days`;
