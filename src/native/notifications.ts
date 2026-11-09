// Notification permission (Android 13+) + the app's notification toggle. Android only.
import { Linking, NativeModules, PermissionsAndroid, Platform } from 'react-native';

const Native:
  | {
      areNotificationsEnabled?: () => Promise<boolean>;
      openNotificationSettings?: () => Promise<boolean>;
      scheduleDaily?: () => Promise<boolean>;
      cancelDaily?: () => Promise<boolean>;
      postNotification?: (title: string, body: string) => Promise<boolean>;
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
