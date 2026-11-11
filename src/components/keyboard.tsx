// Keyboard handling for the whole app: react-native-keyboard-controller (frame-by-frame, driven by
// the keyboard's own animation on the UI thread, edge-to-edge safe on Android 7-16).
//   - KeyboardProvider wraps the app (App.tsx).
//   - Chat-like screens (AI Stylist, circle chat, comments): KeyboardChatScrollView for the list +
//     KeyboardStickyView for the message box, both with the same `offset` (the space between the
//     message box and the bottom of the screen while the keyboard is closed: nav bar or tab bar).
//     The box slides up glued to the keyboard and the latest message stays in view.
//   - Forms and sheets: KeyboardAvoidingView behavior="padding" (KeyboardSafeView).
// The browser build gets plain views from keyboard.web.tsx (no reanimated on the web).
export {
  KeyboardProvider,
  KeyboardAvoidingView,
  KeyboardStickyView,
  KeyboardChatScrollView,
} from 'react-native-keyboard-controller';
