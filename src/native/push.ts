// Push notifications (FCM) for circle polls. Android: PushModule.kt gives the FCM token; it is saved
// to fcmTokens/{uid} and the "Circle poll push" GitHub Actions job (every 5 min) sends a data
// message to every member of the circle except the poster. Never throws.
import { NativeModules, Platform } from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';

const Native: { getToken?: () => Promise<string> } | undefined = NativeModules.OutfitPush;

let saved = '';
export const registerPushToken = async (): Promise<boolean> => {
  try {
    if (Platform.OS !== 'android' || !Native?.getToken) return false;
    const uid = auth.currentUser?.uid;
    if (!uid) return false;
    const token = await Native.getToken();
    if (!token || saved === `${uid}|${token}`) return !!token;
    await setDoc(doc(db, 'fcmTokens', uid), { token, platform: 'android', updatedAt: serverTimestamp() });
    saved = `${uid}|${token}`;
    return true;
  } catch (e: any) {
    console.warn('push token failed:', e?.code || '', e?.message);
    return false;
  }
};
