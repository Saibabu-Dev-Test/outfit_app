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
