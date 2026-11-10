// Web entry. Outfit is an Android app only: the browser build runs ONLY for local development
// (npm run web:dev on localhost / a LAN address). Served from any other host it is not a usable
// app and sends visitors to the /get/ Android download page (query kept, so ?ref=CODE survives).
// Firebase Hosting never deploys this bundle (scripts/build-hosting.js, firebase.json).
/* global __webpack_public_path__ */
import { AppRegistry } from 'react-native';
import './polyfills';
import App from '../App';

const host = window.location.hostname;
const isLocalDev =
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host === '[::1]' ||
  /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host);

if (!isLocalDev) {
  window.location.replace(`${__webpack_public_path__}get/${window.location.search}`);
} else {
  AppRegistry.registerComponent('outfit', () => App);
  AppRegistry.runApplication('outfit', { rootTag: document.getElementById('root') });
}
