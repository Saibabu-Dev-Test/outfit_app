// Keeps the bottom of a screen or sheet (message box, comment box, send / save buttons) sitting
// directly ON TOP of the soft keyboard, moving WITH the keyboard frame by frame (like a normal chat
// app): react-native-keyboard-controller's KeyboardAvoidingView (behavior "padding") driven by the
// native WindowInsets IME animation on the UI thread. No keyboardDidShow listener: the old version
// padded only after the keyboard had finished opening, which made the box jump.
// automaticOffset: the view measures its own position on screen, so it is right inside tabs,
// stacks and edge-to-edge modals (no hand-tuned offsets).
// Web: keyboard.web.tsx gives a plain View.
import React, { useEffect, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { KeyboardAvoidingView, KeyboardEvents } from './keyboard';

interface Props {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  extraOffset?: number; // extra gap above the keyboard (default 0; negative = overlap, e.g. a nav-bar pad)
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
}

export default function KeyboardSafeView({ style, children, extraOffset = 0, pointerEvents }: Props) {
  return (
    <KeyboardAvoidingView
      behavior="padding"
      automaticOffset
      keyboardVerticalOffset={extraOffset}
      pointerEvents={pointerEvents}
      style={[{ flex: 1 }, style]}>
      {children}
    </KeyboardAvoidingView>
  );
}

// Calls `fn` as the keyboard starts opening (e.g. scroll a non-inverted chat to its newest message).
export function useKeyboardShown(fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    try {
      sub = KeyboardEvents.addListener('keyboardWillShow', () => fnRef.current());
    } catch {
      sub = null;
    }
    return () => sub?.remove();
  }, []);
}
