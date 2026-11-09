// Runs the live activity listener while a user is signed in (services/activityWatcher.ts)
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { startActivityWatcher, stopActivityWatcher } from '../services/activityWatcher';

export default function ActivityWatcher() {
  const { isAuthenticated, user } = useAuth();
  const uid = user?.id;
  useEffect(() => {
    if (!isAuthenticated || !uid) {
      stopActivityWatcher();
      return;
    }
    const stop = startActivityWatcher(String(uid));
    return stop;
  }, [isAuthenticated, uid]);
  return null;
}
