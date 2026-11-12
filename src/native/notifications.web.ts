// Web build: notifications never block the app. The browser permission is asked politely and
// only after a tap (NotificationGate.web.tsx), because Safari/Chrome require a user gesture.
export type NotifState = 'on' | 'off';

const N = (): any => (globalThis as any).Notification;

export const browserNotificationsSupported = (): boolean => typeof N() === 'function';
export const browserPermission = (): 'granted' | 'denied' | 'default' | 'unsupported' =>
  browserNotificationsSupported() ? N().permission : 'unsupported';

// The gate counts the web as always "on" (never blocks)
export const checkNotifications = async (): Promise<NotifState> => 'on';

export const requestNotifications = async (): Promise<'granted' | 'denied' | 'blocked'> => {
  if (!browserNotificationsSupported()) return 'denied';
  try {
    const r = await N().requestPermission();
    if (r === 'granted') return 'granted';
    return r === 'denied' ? 'blocked' : 'denied';
  } catch {
    return 'denied';
  }
};

export const openNotificationSettings = async (): Promise<void> => {};
export const canAskAgain = (): boolean => browserPermission() === 'default';

// Daily reminders: Android only
export const scheduleDaily = async (): Promise<void> => {};

// Browser notification when permission was granted (tab open); false otherwise. Never throws.
export const postNotification = async (title: string, body: string): Promise<boolean> => {
  try {
    if (browserPermission() !== 'granted') return false;
    // eslint-disable-next-line no-new
    new (N())(title, { body, icon: '/icons/icon-192.png' });
    return true;
  } catch {
    return false;
  }
};

// Web: a plain notification (no tap payload); the coin flips are Android only
export const postNotificationWithPayload = (title: string, body: string, _payload: string): Promise<boolean> =>
  postNotification(title, body);
export const consumeLaunchPayload = async (): Promise<string | null> => null;

// One-off reminders: Android only
export const scheduleReminder = async (_id: number, _at: number, _title: string, _body: string): Promise<boolean> => false;
export const cancelReminder = async (_id: number): Promise<void> => {};

// Android only (the 8 AM greeting's name); nothing to save in the browser
export const firstNameOf = (displayName?: string | null): string =>
  String(displayName || '').trim().split(/\s+/)[0] || '';
export const setNotificationName = async (_displayName?: string | null): Promise<void> => {};

// Colour-vote reminder: Android only (AlarmManager)
export const markColourVoted = async (_uid?: string | null, _day?: string): Promise<void> => {};
export const syncVoteReminder = async (_uid: string): Promise<void> => {};
export const cancelVoteReminder = async (): Promise<void> => {};
