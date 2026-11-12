// Imported FIRST in index.js (before App), so an error while App's modules load is also caught.
// Release APK lo JS error vasthe app silent ga close avthundi: ee handler error ni Alert lo chupisthundi.
// Fatal JS errors are also saved natively (CrashModule.saveJsCrash -> files/last_crash.txt), so the
// next launch shows them even if this Alert never gets drawn. Native crashes, ANRs and low-memory
// kills of the last run are shown by MainActivity in a native dialog before JS starts (newer APKs);
// older APKs fall back to the JS Alert below.
import { Alert, NativeModules, Platform } from 'react-native';

const crash = () => {
  try {
    return Platform.OS === 'android' ? NativeModules.OutfitCrash : undefined;
  } catch (e) {
    return undefined;
  }
};

// "Name: message" + the top 15 stack lines (the stack's own first line repeats the message)
export const formatJsError = (error, isFatal) => {
  const name = error?.name || error?.constructor?.name || 'Error';
  const message = error?.message || String(error);
  const lines = String(error?.stack || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith(`${name}:`) && l !== message);
  const top = lines.slice(0, 15);
  const more = lines.length > top.length ? `\n  ... ${lines.length - top.length} more` : '';
  const stack = top.length ? top.map(l => `  ${l}`).join('\n') + more : '  (no stack)';
  return `${isFatal ? 'Fatal' : 'Error'} at ${new Date().toISOString()}\n${name}: ${message}\n${stack}`;
};

const g = global;
if (g.ErrorUtils?.setGlobalHandler) {
  const defaultHandler = g.ErrorUtils.getGlobalHandler?.();
  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    let text = '';
    try {
      text = formatJsError(error, isFatal);
    } catch (e) {
      text = String(error);
    }
    console.warn('Global JS error:', text);
    if (isFatal) {
      // Saved natively first: shown with Copy in the native dialog on the next launch
      try {
        crash()?.saveJsCrash?.(text.slice(0, 3500));
      } catch (e) {}
      try {
        Alert.alert('App error (send this screenshot)', text.slice(0, 900));
      } catch (e) {}
    } else if (defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });
}

// Unhandled promise rejections never close the app; they are only logged.

try {
  const n = crash();
  const nativeDialog = !!(n && (n.nativeDialog || n.getConstants?.()?.nativeDialog));
  if (n?.getLastCrash && !nativeDialog) {
    n.getLastCrash()
      .then(text => {
        if (text) setTimeout(() => Alert.alert('Last crash (send this screenshot)', String(text).slice(0, 900)), 1500);
      })
      .catch(() => {});
  }
} catch (e) {}
