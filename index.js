/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry, Alert } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Release APK lo JS error vasthe app silent ga close avthundi.
// Ee handler error ni Alert lo chupisthundi, so manaki real reason telusthundi.
const g = global;
if (g.ErrorUtils?.setGlobalHandler) {
  const defaultHandler = g.ErrorUtils.getGlobalHandler?.();
  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    const msg = `${error?.name || 'Error'}: ${error?.message || String(error)}`;
    console.warn('Global JS error:', msg, error?.stack);
    if (isFatal) {
      Alert.alert('App error (send this screenshot)', msg.slice(0, 500));
    } else if (defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });
}

AppRegistry.registerComponent(appName, () => App);
