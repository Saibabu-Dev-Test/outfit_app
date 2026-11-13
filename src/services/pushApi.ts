// Push notifications (FCM) for likes, comments and follows while the app is closed.
//   users/{uid}/pushTokens/{tokenId} {token, platform, updatedAt}   saved by the app (owner only)
//   config/push {lastRunAt}                                         heartbeat of the sender job
// The sender (scripts/push/send-activity-push.js, GitHub Actions every 15 min) reads new
// users/{uid}/activity docs and sends one push per user (likes: "🪙 Gold coin likes! 12 people…",
// tap = the coins flip, like the local notification). While the sender is live (heartbeat < 2 h)
// the in-app watcher stops posting its own notifications so nothing shows twice.
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

const Native: { getPushToken?: () => Promise<string | null> } | undefined = NativeModules.OutfitNotifications;

export const SENDER_LIVE_MS = 2 * 60 * 60 * 1000;
const SAVED_KEY = (uid: string) => `outfitpush:saved:${uid}`;
const RESAVE_MS = 24 * 60 * 60 * 1000;

// Stable doc id for a token (tokens are long; ids must not contain '/')
export const tokenDocId = (token: string): string => {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < token.length; i++) {
    const c = token.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + c) | 0;
    h2 = ((h2 << 5) + h2 + c * 7) | 0;
  }
  return `t_${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
};

// Is the sender job running? (heartbeat within SENDER_LIVE_MS)
export const isSenderLive = (lastRunAtMs: number | null | undefined, now: number = Date.now()): boolean =>
  !!lastRunAtMs && now - lastRunAtMs >= -5 * 60 * 1000 && now - lastRunAtMs < SENDER_LIVE_MS;

let liveCache: { at: number; live: boolean } | null = null;
let myToken: string | null = null;

// true when this phone has a saved push token AND the sender is live. Cached 10 min. Never throws.
export const serverPushActive = async (): Promise<boolean> => {
  if (!myToken) return false;
  if (liveCache && Date.now() - liveCache.at < 10 * 60 * 1000) return liveCache.live;
  let live = false;
  try {
    const s = await getDoc(doc(db, 'config', 'push'));
    const v = (s.data() as any)?.lastRunAt;
    const ms = typeof v?.toMillis === 'function' ? v.toMillis() : Number(v) || 0;
    live = isSenderLive(ms);
  } catch {
    live = false;
  }
  liveCache = { at: Date.now(), live };
  return live;
};

// Saves this phone's push token for the signed-in user (once a day). Never throws.
export const registerPush = async (uid: string): Promise<void> => {
  if (Platform.OS !== 'android' || !uid) return;
  try {
    const token = await Native?.getPushToken?.();
    if (!token) return;
    myToken = token;
    const id = tokenDocId(token);
    const saved = await AsyncStorage.getItem(SAVED_KEY(uid)).catch(() => null);
    if (saved) {
      const [sid, at] = saved.split('|');
      if (sid === id && Date.now() - Number(at) < RESAVE_MS) return;
    }
    await setDoc(doc(db, 'users', uid, 'pushTokens', id), { token, platform: 'android', updatedAt: serverTimestamp() });
    await AsyncStorage.setItem(SAVED_KEY(uid), `${id}|${Date.now()}`).catch(() => undefined);
  } catch (e: any) {
    console.warn('registerPush failed:', e?.code, e?.message);
  }
};

// Sign-out: this phone stops getting that user's pushes. Never throws.
export const unregisterPush = async (uid: string | null | undefined): Promise<void> => {
  if (!uid || !myToken) return;
  const id = tokenDocId(myToken);
  myToken = null;
  liveCache = null;
  try {
    await AsyncStorage.removeItem(SAVED_KEY(uid));
    await deleteDoc(doc(db, 'users', uid, 'pushTokens', id));
  } catch (e: any) {
    console.warn('unregisterPush failed:', e?.code, e?.message);
  }
};
