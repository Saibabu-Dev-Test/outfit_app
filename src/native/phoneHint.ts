// SIM number picker (Google Phone Number Hint, free, no SMS). Android only.
// Note: this runs in the app only. It shows numbers of SIMs in this phone, but it is not
// cryptographic proof of SIM ownership.
import { NativeModules, Platform } from 'react-native';

const Native: { requestPhoneNumber?: () => Promise<string> } | undefined =
  NativeModules.OutfitPhoneHint;

export const SIM_REQUIRED_MESSAGE = 'Insert the SIM card of this number to continue';

export type SimPickResult =
  | { ok: true; number: string } // E.164, e.g. +919876543210
  | { ok: false; cancelled: boolean; message: string };

// Opens the picker. Never throws.
export const pickSimNumber = async (): Promise<SimPickResult> => {
  if (Platform.OS !== 'android' || !Native?.requestPhoneNumber) {
    return { ok: false, cancelled: false, message: SIM_REQUIRED_MESSAGE };
  }
  try {
    const raw = await Native.requestPhoneNumber();
    const number = String(raw || '').replace(/[^\d+]/g, '');
    if (!number) return { ok: false, cancelled: false, message: SIM_REQUIRED_MESSAGE };
    return { ok: true, number };
  } catch (e: any) {
    console.warn('Phone hint failed:', e?.code, e?.message);
    return { ok: false, cancelled: e?.code === 'CANCELLED', message: SIM_REQUIRED_MESSAGE };
  }
};
