// Keyboard handling for the whole app: react-native-keyboard-controller. It follows the soft
// keyboard's own show / hide animation frame by frame on the UI thread (Android WindowInsets IME
// animation), edge-to-edge safe on Android 7-16, so a message box slides up glued to the top of the
// keyboard instead of jumping after the keyboard has finished opening.
//   - KeyboardProvider wraps the app (App.tsx).
//   - KeyboardSafeView (components/KeyboardSafeView.tsx) = KeyboardAvoidingView behavior="padding"
//     with automaticOffset (measures its own position on screen, so it is right under headers,
//     inside tabs and inside edge-to-edge modals without per-screen offsets).
// The browser build gets plain views from keyboard.web.tsx (no reanimated on the web).
export {
  KeyboardProvider,
  KeyboardAvoidingView,
  KeyboardStickyView,
  KeyboardChatScrollView,
  KeyboardEvents,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
