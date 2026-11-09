// Circle invite links: outfit://join/CODE (Share in Circle info). Opening one asks to join the
// circle with its code and opens the chat. The code works from any distance (a circle with a
// distance limit can still be joined this way). Before sign-in the code waits until the user is
// signed in. Android opens these links through the intent filter in AndroidManifest.xml.
import { useEffect, useRef } from 'react';
import { Alert, Linking } from 'react-native';
import { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { codeFromInvite, joinWithCode } from '../services/circlesApi';
import type { RootStackParamList } from '../navigation/types';

// Kept outside React so a link that arrived before sign-in survives the navigator remount
let pendingCode = '';

const linkCode = (url: string | null | undefined): string =>
  url && /^outfit:\/\/join\//i.test(url) ? codeFromInvite(url) : '';

export default function CircleInviteLink({
  navigationRef,
}: {
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>;
}) {
  const { isAuthenticated, user } = useAuth();
  const uid = user?.id;
  const asking = useRef(false);

  const handle = (code: string) => {
    if (!code) return;
    pendingCode = code;
    if (!isAuthenticated || !uid || asking.current) return;
    asking.current = true;
    pendingCode = '';
    Alert.alert('Join circle?', `Join the circle with invite code ${code}?`, [
      { text: 'Not now', style: 'cancel', onPress: () => (asking.current = false) },
      {
        text: 'Join',
        onPress: async () => {
          try {
            const circleId = await joinWithCode(code, uid);
            if (navigationRef.isReady()) navigationRef.navigate('CircleChat', { circleId });
          } catch (e: any) {
            Alert.alert('Could not join', e?.message || 'Please check the invite link.');
          } finally {
            asking.current = false;
          }
        },
      },
    ]);
  };

  // Link that opened the app (cold start) + links while it is open
  useEffect(() => {
    Linking.getInitialURL()
      .then(url => handle(linkCode(url)))
      .catch(() => {});
    const sub = Linking.addEventListener('url', e => handle(linkCode(e.url)));
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signed in after the link arrived: ask now
  useEffect(() => {
    if (isAuthenticated && uid && pendingCode) {
      // Wait a moment for the main screens to mount
      const t = setTimeout(() => handle(pendingCode), 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, uid]);

  return null;
}
