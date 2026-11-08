// Clipboard (Android / iOS) through @react-native-clipboard/clipboard. Never throws.
// Android 10+ only lets the app read the clipboard while it is in the foreground (fine on launch).
import Clipboard from '@react-native-clipboard/clipboard';

export const readClipboardText = async (): Promise<string> => {
  try {
    return (await Clipboard.getString()) || '';
  } catch {
    return '';
  }
};

export const setClipboardText = async (text: string): Promise<boolean> => {
  try {
    Clipboard.setString(text);
    return true;
  } catch {
    return false;
  }
};

export const clearClipboardText = async (): Promise<void> => {
  try {
    Clipboard.setString('');
  } catch {}
};
