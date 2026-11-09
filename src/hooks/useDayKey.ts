// Today's local date key (YYYY-MM-DD) that changes by itself at 12:00 AM local time.
// A timer fires just after the next midnight; when the app comes back to the foreground the
// key is re-checked too (timers can be paused while the app is in the background).
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localDateKey } from '../utils/date';

// Milliseconds until the next local midnight (+1 s so the new day has surely started)
export const msUntilNextMidnight = (now: Date = new Date()): number => {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - now.getTime());
};

export const useDayKey = (): string => {
  const [dayKey, setDayKey] = useState<string>(localDateKey());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = () => setDayKey(prev => (prev === localDateKey() ? prev : localDateKey()));
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        check();
        arm();
      }, msUntilNextMidnight());
    };
    arm();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        check();
        arm();
      }
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return dayKey;
};
