// Imported FIRST in index.js (before App), so an error while App's modules load is also caught.
// Release APK lo JS error vasthe app silent ga close avthundi: ee handler error ni Alert lo chupisthundi.
// A native crash from the last run (CrashModule.kt, files/last_crash.txt) is shown once on launch.
import { Alert, NativeModules, Platform } from 'react-native';

const g = global;
if (g.ErrorUtils?.setGlobalHandler) {
  const defaultHandler = g.ErrorUtils.getGlobalHandler?.();
  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    const msg = `${error?.name || 'Error'}: ${error?.message || String(error)}`;
    console.warn('Global JS error:', msg, error?.stack);
    if (isFatal) {
      Alert.alert('App error (send this screenshot)', `${msg}\n\n${String(error?.stack || '').slice(0, 600)}`);
    } else if (defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });
}

if (Platform.OS === 'android' && NativeModules.OutfitCrash?.getLastCrash) {
  NativeModules.OutfitCrash.getLastCrash()
    .then((text) => {
      if (text) setTimeout(() => Alert.alert('Last crash (send this screenshot)', String(text).slice(0, 900)), 1500);
    })
    .catch(() => {});
}
