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

const g = global;
if (g.ErrorUtils?.setGlobalHandler) {
  const defaultHandler = g.ErrorUtils.getGlobalHandler?.();
  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    const msg = `${error?.name || 'Error'}: ${error?.message || String(error)}`;
    const stack = String(error?.stack || '').slice(0, 2500);
    console.warn('Global JS error:', msg, error?.stack);
    if (isFatal) {
      try {
        crash()?.saveJsCrash?.(`${msg}\n\n${stack}`);
      } catch (e) {}
      try {
        Alert.alert('App error (send this screenshot)', `${msg}\n\n${stack.slice(0, 600)}`);
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
