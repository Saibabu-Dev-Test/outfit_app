// Live "new activity" while the app runs: likes, dislikes, comments, follows and (for admins)
// feedback on users/{me}/activity. Docs newer than lastSeen count as unread (badge on the Feed ♡);
// docs newer than lastNotified also post a local notification. Opening Likes sets lastSeen.
// Both marks live in AsyncStorage per user (not under "outfit:", so sign-out keeps them).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, limit, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { toDate } from '../utils/date';
import { activityLine, ActivityItem } from './activityApi';
import { postNotification, postNotificationWithPayload } from '../native/notifications';
import { likeLevelFor } from '../config/likeLevels';
import { loadLikesReceived } from './coinsApi';
import { countLikers, encodeCoinRain, likeNotificationText } from './likeCoins';
import { serverPushActive } from './pushApi';

const seenKey = (uid: string) => `outfitact:lastSeen:${uid}`;
const notifiedKey = (uid: string) => `outfitact:lastNotified:${uid}`;
const FIRST_RUN_LOOKBACK = 24 * 60 * 60 * 1000; // first run: badge the last day, notify nothing old
const MAX_EACH = 3; // individual notifications per batch; the rest go in one summary

let unread = 0;
const listeners = new Set<(n: number) => void>();
const emit = (n: number) => {
  unread = n;
  listeners.forEach(l => l(n));
};

export const getUnreadActivity = () => unread;
export const subscribeUnreadActivity = (l: (n: number) => void): (() => void) => {
  listeners.add(l);
  l(unread);
  return () => {
    listeners.delete(l);
  };
};

const readMs = async (key: string): Promise<number | null> => {
  try {
    const v = await AsyncStorage.getItem(key);
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
};
const writeMs = (key: string, ms: number) => AsyncStorage.setItem(key, String(ms)).catch(() => undefined);

let current: { uid: string; stop: () => void } | null = null;
let restart: (() => void) | null = null;

const itemFrom = (id: string, d: any): ActivityItem => ({
  id,
  type: d?.type || 'like',
  actorId: String(d?.actorId || ''),
  actorName: d?.actorName || 'Outfit user',
  actorAvatar: null,
  targetKind: d?.targetKind === 'post' || d?.targetKind === 'wardrobe' || d?.targetKind === 'birthday' ? d.targetKind : null,
  targetId: d?.targetId || null,
  thumbnail: null,
  text: d?.text || '',
  createdAt: toDate(d?.createdAt),
});

// "🪙 Gold coin likes! 12 people liked your photos..." (my own level from users/{me}.likesReceived)
const notifyLikeCoins = async (uid: string, people: number, likes: number): Promise<void> => {
  try {
    const level = likeLevelFor((await loadLikesReceived(uid)) ?? 0);
    const { title, body } = likeNotificationText(people, likes, level);
    await postNotificationWithPayload(title, body, encodeCoinRain({ level, count: people }));
  } catch {}
};

// Starts (or restarts) the listener for this user. Returns a stop function.
export const startActivityWatcher = (uid: string): (() => void) => {
  stopActivityWatcher();
  let alive = true;
  let unsub: (() => void) | null = null;

  const run = async () => {
    if (unsub) {
      unsub();
      unsub = null;
    }
    const now = Date.now();
    let lastSeen = await readMs(seenKey(uid));
    let lastNotified = await readMs(notifiedKey(uid));
    if (lastSeen == null) {
      lastSeen = now - FIRST_RUN_LOOKBACK;
      writeMs(seenKey(uid), lastSeen);
    }
    if (lastNotified == null) {
      lastNotified = now;
      writeMs(notifiedKey(uid), lastNotified);
    }
    if (!alive) return;
    const since = lastSeen;
    let pushOn = false;
    serverPushActive()
      .then(v => (pushOn = v))
      .catch(() => undefined);
    let notifiedMark = lastNotified;
    try {
      unsub = onSnapshot(
        query(
          collection(db, 'users', uid, 'activity'),
          where('createdAt', '>', Timestamp.fromMillis(since)),
          orderBy('createdAt', 'desc'),
          limit(99),
        ),
        snap => {
          const items = snap.docs.map(d => itemFrom(d.id, d.data({ serverTimestamps: 'estimate' })));
          emit(items.length);
          const fresh = items.filter(a => (a.createdAt?.getTime() || 0) > notifiedMark);
          if (!fresh.length) return;
          notifiedMark = Math.max(...fresh.map(a => a.createdAt?.getTime() || 0));
          writeMs(notifiedKey(uid), notifiedMark);
          // Push sender live and this phone registered: the push shows it (no double notification)
          if (pushOn) return;
          // Likes: ONE notification with the coin level and how many people liked; tapping it
          // flips those coins across the screen (CoinRain)
          const liked = countLikers(fresh);
          if (liked.likes) notifyLikeCoins(uid, liked.people, liked.likes);
          const others = fresh.filter(a => a.type !== 'like');
          others.slice(0, MAX_EACH).forEach(a => {
            postNotification(a.type === 'feedback' ? 'New feedback' : a.type === 'wish' || a.type === 'mention' ? '🎂 Birthday wishes' : 'Outfit', activityLine(a));
          });
          if (others.length > MAX_EACH) {
            postNotification('Outfit', `${others.length - MAX_EACH} more new comments and follows`);
          }
        },
        e => console.warn('activity watcher error:', e?.code, e?.message),
      );
    } catch (e: any) {
      console.warn('activity watcher failed:', e?.message);
    }
  };

  run();
  restart = () => {
    if (alive) run();
  };
  const stop = () => {
    alive = false;
    if (unsub) unsub();
    unsub = null;
    restart = null;
    emit(0);
  };
  current = { uid, stop };
  return stop;
};

export const stopActivityWatcher = () => {
  if (current) current.stop();
  current = null;
};

// Opening Likes / Activity: everything so far is seen
export const markActivitySeen = async (uid: string | null | undefined): Promise<void> => {
  if (!uid) return;
  const now = Date.now();
  await writeMs(seenKey(uid), now);
  const n = await readMs(notifiedKey(uid));
  if (n == null || n < now) await writeMs(notifiedKey(uid), now);
  emit(0);
  if (current?.uid === uid && restart) restart();
};
