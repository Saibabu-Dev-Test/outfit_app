// Web (browser / PWA) entry. The Android app keeps using ../index.js.
/* global __webpack_public_path__ */
import { AppRegistry } from 'react-native';
import './polyfills';
import App from '../App';

AppRegistry.registerComponent('outfit', () => App);
AppRegistry.runApplication('outfit', { rootTag: document.getElementById('root') });

// Offline shell (production build only)
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${__webpack_public_path__}sw.js`).catch(e => {
      console.warn('Service worker registration failed:', e && e.message);
    });
  });
}
