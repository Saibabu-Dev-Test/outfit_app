// Referral share links: <SHARE_BASE>/get/?ref=CODE (app download page, src/config/links.ts).
// The /get/ page copies "OUTFITREF:CODE" to the clipboard before the APK download starts; the
// Android app reads it on the sign-up screen (sideloaded APKs get no Play Install Referrer).
// Every share path (Share, WhatsApp, Copy link, post / profile / circle shares) sends this link
// with the sharer's code; a share waits for the code and never goes out without it.
// /get/ detects the platform: Android gets the APK (+ a small "Open in browser" link), iPhone /
// iPad / computers get only "Open Outfit in browser" (/?ref=CODE&web=1, code prefilled at sign-up).
// The web root sends /?ref=CODE on to /get/ only on Android, and never when web=1.
import { Alert, Linking, Platform, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureReferralCode } from '../services/rewardsApi';
import { readClipboardText, clearClipboardText, setClipboardText } from '../native/clipboard';
import { APP_GET_URL, APP_WEB_URL } from '../config/links';

export { APP_GET_URL, APP_WEB_URL };
// What the /get/ page puts on the clipboard (web/public/get/index.html)
const CLIPBOARD_REF = /^OUTFITREF:([A-Z0-9]{4,8})$/;
const PENDING_KEY = 'pendingReferralCode';
// Browser globals (typed loosely; RN's tsconfig has no DOM lib)
const g: any = globalThis as any;
const window: any = g.window;
const navigator: any = g.navigator;

const clean = (s: string | null | undefined) =>
  (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export const referralLink = (code: string) => `${APP_GET_URL}?ref=${encodeURIComponent(code)}`;

export const referralMessage = (code: string) =>
  `Join me on Outfit, vote on outfits with friends! Download Outfit: ${referralLink(code)}\n(my referral code ${code} is filled in for you, or enter it when you create your account)`;

const refFromUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  const m = url.match(/[?&]ref=([^&#]+)/i);
  return m ? clean(decodeURIComponent(m[1])) : '';
};

// Android: "OUTFITREF:CODE" copied by the /get/ download page. Saved as the pending code and
// removed from the clipboard. '' when none. Never throws.
const refFromClipboard = async (): Promise<string> => {
  if (Platform.OS !== 'android') return '';
  try {
    const text = (await readClipboardText()).trim();
    const m = text.match(CLIPBOARD_REF);
    if (!m) return '';
    const code = clean(m[1]);
    if (!code) return '';
    await AsyncStorage.setItem(PENDING_KEY, code);
    await clearClipboardText();
    return code;
  } catch {
    return '';
  }
};

// Code from the link that opened the app, else one saved earlier, else (Android) the clipboard
// text left by the download page. '' when none.
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
    const saved = clean(await AsyncStorage.getItem(PENDING_KEY));
    if (saved) return saved;
    return await refFromClipboard();
  } catch {
    return '';
  }
};

// First launch after install (any screen): pick up the clipboard code early, before anything
// else is copied. Later launches leave the clipboard alone (Android 12+ shows a "pasted" toast).
// No-op when a code is already pending or off Android. Never throws.
const FIRST_LAUNCH_KEY = 'outfitref:launched'; // not "outfit:", so logout keeps it
export const captureClipboardReferral = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  try {
    if (await AsyncStorage.getItem(FIRST_LAUNCH_KEY)) return;
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, '1');
    if (clean(await AsyncStorage.getItem(PENDING_KEY))) return;
    await refFromClipboard();
  } catch {}
};

export const clearPendingReferral = async () => {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {}
};

const copyText = async (text: string): Promise<boolean> => {
  if (Platform.OS !== 'web') return setClipboardText(text);
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
        await nav.share({ title: 'Outfit', text: message });
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

const notify = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
};
const NO_CODE_MESSAGE = 'Could not load your invite code. Check your internet connection and try again.';

// My code, waiting for it (creates it when missing; one retry after a failure). null = no code.
export const requireMyReferralCode = async (uid: string | undefined): Promise<string | null> => {
  if (!uid) return null;
  const first = await getMyReferralCode(uid);
  if (first) return first;
  myCode = null;
  return getMyReferralCode(uid);
};

// Invite (share sheet) with my code; waits for the code first
export const shareMyReferral = async (uid: string | undefined) => {
  const code = await requireMyReferralCode(uid);
  if (code) await shareReferral(code);
  else notify('Invite', NO_CODE_MESSAGE);
};

// "<line>" + app download link with my referral code. Used by Share on posts, "Share profile"
// and circle invites. Never shares a link without the code.
export const shareWithReferral = async (uid: string | undefined, line: string) => {
  const code = await requireMyReferralCode(uid);
  if (!code) {
    notify('Share', NO_CODE_MESSAGE);
    return;
  }
  const link = referralLink(code);
  const message = `${line}\nDownload Outfit: ${link}\n(referral code ${code})`;
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
