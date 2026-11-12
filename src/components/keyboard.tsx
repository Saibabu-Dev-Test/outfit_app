// Keyboard handling for the whole app: react-native-keyboard-controller. It follows the soft
// keyboard's own show / hide animation frame by frame on the UI thread (Android WindowInsets IME
// animation), edge-to-edge safe on Android 7-16, so a message box slides up glued to the top of the
// keyboard instead of jumping after the keyboard has finished opening.
//   - KeyboardProvider wraps the app (App.tsx).
//   - KeyboardSafeView (components/KeyboardSafeView.tsx) = KeyboardAvoidingView behavior="padding"
//     with automaticOffset (measures its own position on screen, so it is right under headers,
//     inside tabs and inside edge-to-edge modals without per-screen offsets).
// The browser build gets plain views from keyboard.web.tsx (no reanimated on the web).
// Start-up safety: the library is loaded lazily and guarded. In start-up safe mode (the app died
// while opening twice, native/safeMode.ts) or if the library fails to load, the plain stand-ins from
// keyboard.web.tsx are used instead (the window still resizes for the keyboard: adjustResize).
import * as Plain from './keyboard.web';
import { isSafeMode } from '../native/safeMode';

type Lib = typeof import('react-native-keyboard-controller');

const load = (): Lib => {
  if (isSafeMode()) return Plain as unknown as Lib;
  try {
    const lib = require('react-native-keyboard-controller') as Lib;
    if (lib && typeof lib.KeyboardProvider !== 'undefined') return lib;
  } catch (e: any) {
    console.warn('Keyboard controller unavailable:', e?.message);
  }
  return Plain as unknown as Lib;
};

const lib = load();

export const KeyboardProvider = lib.KeyboardProvider;
export const KeyboardAvoidingView = lib.KeyboardAvoidingView;
export const KeyboardStickyView = lib.KeyboardStickyView;
export const KeyboardChatScrollView = lib.KeyboardChatScrollView;
export const KeyboardEvents = lib.KeyboardEvents;
export const useReanimatedKeyboardAnimation = lib.useReanimatedKeyboardAnimation;
