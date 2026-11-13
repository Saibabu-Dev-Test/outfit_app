// Circle poll push notification tap: outfit://circle/CIRCLE_ID/MESSAGE_ID opens that circle's chat
// (the new poll is the newest message at the bottom). Waits for sign-in. Never throws.
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';

export const parseCircleLink = (url: string | null | undefined): { circleId: string; messageId?: string } | null => {
  const m = url ? /^outfit:\/\/circle\/([A-Za-z0-9_-]{1,64})(?:\/([A-Za-z0-9_-]{1,64}))?/i.exec(url) : null;
  return m ? { circleId: m[1], messageId: m[2] || undefined } : null;
};

let pending: { circleId: string; messageId?: string } | null = null;

export default function CircleDeepLink({
  navigationRef,
}: {
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>;
}) {
  const { isAuthenticated } = useAuth();
  const authRef = useRef(isAuthenticated);
  authRef.current = isAuthenticated;

  const go = () => {
    if (!pending || !authRef.current) return;
    const target = pending;
    const tryNav = (n: number) => {
      if (navigationRef.isReady()) {
        pending = null;
        navigationRef.navigate('CircleChat', target);
      } else if (n < 20) setTimeout(() => tryNav(n + 1), 250);
    };
    tryNav(0);
  };

  useEffect(() => {
    const handle = (url?: string | null) => {
      const t = parseCircleLink(url);
      if (!t) return;
      pending = t;
      go();
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', e => handle(e.url));
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isAuthenticated) go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return null;
}
