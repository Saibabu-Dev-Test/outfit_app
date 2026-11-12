// Runs the live activity listener while a user is signed in (services/activityWatcher.ts) and
// saves this phone's push token (services/pushApi.ts)
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { startActivityWatcher, stopActivityWatcher } from '../services/activityWatcher';
import { registerPush } from '../services/pushApi';

export default function ActivityWatcher() {
  const { isAuthenticated, user } = useAuth();
  const uid = user?.id;
  useEffect(() => {
    if (!isAuthenticated || !uid) {
      stopActivityWatcher();
      return;
    }
    const stop = startActivityWatcher(String(uid));
    registerPush(String(uid)); // FCM token for pushes while the app is closed (never throws)
    return stop;
  }, [isAuthenticated, uid]);
  return null;
}
