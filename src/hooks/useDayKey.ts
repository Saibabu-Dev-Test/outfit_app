// Today's local date key (YYYY-MM-DD) that changes by itself at 12:00 AM local time.
// A timer fires just after the next midnight; when the app comes back to the foreground the
// key is re-checked too (timers can be paused while the app is in the background).
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localDateKey } from '../utils/date';
import { istDateKey, msUntilNextIstMidnight } from '../services/astroUnlock';

// Milliseconds until the next local midnight (+1 s so the new day has surely started)
export const msUntilNextMidnight = (now: Date = new Date()): number => {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next.getTime() - now.getTime());
};

const useRollingKey = (keyFn: () => string, untilNext: () => number): string => {
  const [dayKey, setDayKey] = useState<string>(keyFn());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = () => setDayKey(prev => (prev === keyFn() ? prev : keyFn()));
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        check();
        arm();
      }, untilNext());
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return dayKey;
};

export const useDayKey = (): string => useRollingKey(localDateKey, () => msUntilNextMidnight());

// India date (IST) key that rolls over at 12:00 AM IST: used for the once-a-day astrology unlock
export const useIstDayKey = (): string => useRollingKey(() => istDateKey(), () => msUntilNextIstMidnight());
