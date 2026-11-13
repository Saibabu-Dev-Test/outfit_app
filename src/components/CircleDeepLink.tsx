// Circle push notification tap: outfit://circle/CIRCLE_ID[/MESSAGE_ID] opens that circle's chat.
// The push carries the link as the FCM data key outfit_link (pushApi / OutfitMessagingService);
// MainActivity turns it into the intent's data uri, so it arrives here through Linking, like a
// link tapped anywhere else. Waits for sign-in. Never throws.
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { CircleLinkTarget, parseCircleLink } from '../utils/circleLink';

// Kept outside React so a link that arrived before sign-in survives the navigator remount
let pending: CircleLinkTarget | null = null;

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
      try {
        if (navigationRef.isReady()) {
          pending = null;
          navigationRef.navigate('CircleChat', { circleId: target.circleId });
        } else if (n < 20) {
          setTimeout(() => tryNav(n + 1), 250);
        }
      } catch (e: any) {
        console.warn('circle deep link failed:', e?.message);
      }
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
