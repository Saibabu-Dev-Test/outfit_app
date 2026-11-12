// Notification permission (Android 13+) + the app's notification toggle. Android only.
import { Linking, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from '../utils/date';

const Native:
  | {
      areNotificationsEnabled?: () => Promise<boolean>;
      openNotificationSettings?: () => Promise<boolean>;
      scheduleDaily?: () => Promise<boolean>;
      cancelDaily?: () => Promise<boolean>;
      postNotification?: (title: string, body: string) => Promise<boolean>;
      postNotificationWithPayload?: (title: string, body: string, payload: string) => Promise<boolean>;
      consumeLaunchPayload?: () => Promise<string | null>;
      setUserFirstName?: (name: string) => Promise<boolean>;
      scheduleVoteReminder?: () => Promise<boolean>;
      markColourVoted?: (day: string) => Promise<boolean>;
      cancelVoteReminder?: () => Promise<boolean>;
    }
  | undefined = NativeModules.OutfitNotifications;

const POST = (PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS || 'android.permission.POST_NOTIFICATIONS';
const needsRuntimePermission = () => Platform.OS === 'android' && Number(Platform.Version) >= 33;

export type NotifState = 'on' | 'off';

// Never throws. Anything we can't check counts as on (iOS, missing module).
export const checkNotifications = async (): Promise<NotifState> => {
  if (Platform.OS !== 'android') return 'on';
  try {
    if (needsRuntimePermission() && !(await PermissionsAndroid.check(POST))) return 'off';
    if (Native?.areNotificationsEnabled) return (await Native.areNotificationsEnabled()) ? 'on' : 'off';
    return 'on';
  } catch (e: any) {
    console.warn('notification check failed:', e?.message);
    return 'on';
  }
};

// Shows the system prompt (Android 13+). 'blocked' = the user said "don't ask again". Never throws.
export const requestNotifications = async (): Promise<'granted' | 'denied' | 'blocked'> => {
  if (!needsRuntimePermission()) return 'denied';
  try {
    const r = await PermissionsAndroid.request(POST);
    if (r === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
    if (r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
    return 'denied';
  } catch {
    return 'denied';
  }
};

export const openNotificationSettings = async (): Promise<void> => {
  try {
    if (Native?.openNotificationSettings) {
      await Native.openNotificationSettings();
      return;
    }
  } catch (e: any) {
    console.warn('open notification settings failed:', e?.message);
  }
  Linking.openSettings().catch(() => {});
};

export const canAskAgain = needsRuntimePermission;

// Daily reminders at 8 AM, 1 PM and 7 PM local time (OutfitNotifier.kt). Idempotent: called on
// every launch once notifications are on. Never throws.
export const scheduleDaily = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  try {
    await Native?.scheduleDaily?.();
  } catch (e: any) {
    console.warn('scheduleDaily failed:', e?.message);
  }
};

// A local notification on the "activity" channel. false when it could not be shown. Never throws.
export const postNotification = async (title: string, body: string): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  try {
    return !!(await Native?.postNotification?.(title, body));
  } catch {
    return false;
  }
};

// Same, with a payload the app gets back when the user taps it (consumeLaunchPayload).
// Older native builds without the method: a plain notification. Never throws.
export const postNotificationWithPayload = async (title: string, body: string, payload: string): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  try {
    if (Native?.postNotificationWithPayload) return !!(await Native.postNotificationWithPayload(title, body, payload));
    return !!(await Native?.postNotification?.(title, body));
  } catch {
    return false;
  }
};

// Payload of the notification the app was just opened from (returned once), else null. Never throws.
export const consumeLaunchPayload = async (): Promise<string | null> => {
  if (Platform.OS !== 'android') return null;
  try {
    return (await Native?.consumeLaunchPayload?.()) || null;
  } catch {
    return null;
  }
};

// First word of the display name ("Priya Sharma" -> "Priya"); '' when there is none
export const firstNameOf = (displayName?: string | null): string => {
  const first = String(displayName || '').trim().split(/\s+/)[0] || '';
  return first.includes('@') ? '' : first.slice(0, 30);
};

// Saves the user's first name in the app's SharedPreferences so the native 8 AM alarm can say
// "Good morning, {name}! ☀️" even when the app is closed. Pass null/'' on sign-out. Never throws.
export const setNotificationName = async (displayName?: string | null): Promise<void> => {
  if (Platform.OS !== 'android') return;
  try {
    await Native?.setUserFirstName?.(firstNameOf(displayName));
  } catch (e: any) {
    console.warn('setNotificationName failed:', e?.message);
  }
};

// ── Colour-vote reminder (OutfitNotifier.kt) ──────────────────────────────
// From 1:00 AM local time the phone reminds every hour until today's colour is voted; after the
// vote it stays quiet until 1:00 AM the next day. The vote day is also kept in AsyncStorage so a
// fresh launch (or a reinstall of the alarm after an update) knows today is already done.
const VOTED_KEY = (uid: string) => `outfit:colourVoted:${uid}`;

// Call after the user's vote for today is saved (or found on the server). Never throws.
export const markColourVoted = async (uid?: string | null, day: string = localDateKey()): Promise<void> => {
  if (uid) await AsyncStorage.setItem(VOTED_KEY(uid), day).catch(() => undefined);
  if (Platform.OS !== 'android') return;
  try {
    await Native?.markColourVoted?.(day);
  } catch (e: any) {
    console.warn('markColourVoted failed:', e?.message);
  }
};

// Signed in: arm the hourly reminder (idempotent), and tell the phone if today's vote is already in.
// Never throws.
export const syncVoteReminder = async (uid: string): Promise<void> => {
  if (Platform.OS !== 'android') return;
  try {
    const today = localDateKey();
    const voted = await AsyncStorage.getItem(VOTED_KEY(uid)).catch(() => null);
    await Native?.scheduleVoteReminder?.();
    if (voted === today) await Native?.markColourVoted?.(today);
  } catch (e: any) {
    console.warn('syncVoteReminder failed:', e?.message);
  }
};

// Signed out: no reminders. Never throws.
export const cancelVoteReminder = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  try {
    await Native?.cancelVoteReminder?.();
  } catch (e: any) {
    console.warn('cancelVoteReminder failed:', e?.message);
  }
};
