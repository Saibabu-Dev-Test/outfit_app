// Referral share links: https://outfit-vote-9edca.web.app/?ref=CODE
// Opening the link prefills the code on the sign-up screen (web) and is kept until sign-up.
import { Alert, Linking, Platform, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureReferralCode } from '../services/rewardsApi';

export const APP_WEB_URL = 'https://outfit-vote-9edca.web.app/';
const PENDING_KEY = 'pendingReferralCode';
// Browser globals (typed loosely; RN's tsconfig has no DOM lib)
const g: any = globalThis as any;
const window: any = g.window;
const navigator: any = g.navigator;

const clean = (s: string | null | undefined) =>
  (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export const referralLink = (code: string) => `${APP_WEB_URL}?ref=${encodeURIComponent(code)}`;

export const referralMessage = (code: string) =>
  `Join me on Outfit Vote, your AI stylist & daily colour guide! Sign up with my link: ${referralLink(code)}\n(or enter my referral code ${code} when you create your account)`;

const refFromUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  const m = url.match(/[?&]ref=([^&#]+)/i);
  return m ? clean(decodeURIComponent(m[1])) : '';
};

// Code from the link that opened the app, else one saved earlier. '' when none.
export const readPendingReferral = async (): Promise<string> => {
  try {
    let fromLink = '';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      fromLink = refFromUrl(window.location?.search);
    } else {
      fromLink = refFromUrl(await Linking.getInitialURL());
    }
    if (fromLink.length === 6) {
      await AsyncStorage.setItem(PENDING_KEY, fromLink);
      return fromLink;
    }
    return clean(await AsyncStorage.getItem(PENDING_KEY));
  } catch {
    return '';
  }
};

export const clearPendingReferral = async () => {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {}
};

const copyText = async (text: string): Promise<boolean> => {
  try {
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {}
  return false;
};

// Phone share sheet; on a desktop browser with no share sheet, runs onNoShareSheet instead.
const shareText = async (message: string, onNoShareSheet: () => Promise<void>) => {
  try {
    if (Platform.OS === 'web') {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (nav?.share) {
        await nav.share({ title: 'Outfit Vote', text: message });
        return;
      }
      await onNoShareSheet();
      return;
    }
    await Share.share({ message });
  } catch (e: any) {
    if (e?.name !== 'AbortError') console.warn('Share failed:', e?.message);
  }
};

// On a desktop browser with no share sheet, copies the link instead.
export const shareReferral = async (code: string) =>
  shareText(referralMessage(code), () => copyReferralLink(code));

// My referral code, loaded once per session. null when it can't be loaded (never throws).
let myCode: { uid: string; p: Promise<string | null> } | null = null;
export const getMyReferralCode = (uid: string | undefined): Promise<string | null> => {
  if (!uid) return Promise.resolve(null);
  if (!myCode || myCode.uid !== uid) {
    const p = ensureReferralCode(uid).catch(() => null);
    myCode = { uid, p };
    // Don't keep a failure: try again next time
    p.then(c => {
      if (!c && myCode?.p === p) myCode = null;
    });
  }
  return myCode.p;
};

// "<line>" + app link with my referral code (plain app link if the code can't be loaded).
// Used by Share on posts and "Share profile".
export const shareWithReferral = async (uid: string | undefined, line: string) => {
  const code = await getMyReferralCode(uid);
  const link = code ? referralLink(code) : APP_WEB_URL;
  const message = `${line}\nGet Outfit Vote, your AI stylist & daily colour guide: ${link}${
    code ? `\n(referral code ${code})` : ''
  }`;
  await shareText(message, async () => {
    const ok = await copyText(message);
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(ok ? 'Link copied' : link);
  });
};

export const shareReferralOnWhatsApp = async (code: string) => {
  const url = `https://wa.me/?text=${encodeURIComponent(referralMessage(code))}`;
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('WhatsApp', 'Could not open WhatsApp. Use Share instead.');
  }
};

export const copyReferralLink = async (code: string) => {
  const link = referralLink(code);
  if (await copyText(link)) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert('Invite link copied');
    else Alert.alert('Copied', 'Invite link copied');
    return;
  }
  // Native without a clipboard module: open the share sheet with just the link
  try {
    await Share.share({ message: link });
  } catch {}
};
