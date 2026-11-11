// Keyboard handling for the whole app, React Native built-ins only (no keyboard library, no
// Reanimated): keeps the bottom of a screen or sheet (message box, comment box, send / save buttons)
// sitting directly ON TOP of the soft keyboard.
//
// Why not plain <KeyboardAvoidingView>: the app is edge-to-edge (gradle edgeToEdgeEnabled, and
// forced on Android 15+), so Android no longer resizes the window for the keyboard even with
// windowSoftInputMode="adjustResize" (kept in the manifest: it is what delivers the keyboard insets
// to the app on Android < 11). RN's KeyboardAvoidingView measures itself relative to its PARENT,
// so under headers, tab bars and inside modals it needs a hand-tuned keyboardVerticalOffset per
// screen. Here we measure where this view ends ON SCREEN (measureInWindow) and pad its bottom by
// exactly the part the keyboard covers, so it is right inside tabs, stacks and edge-to-edge modals.
//
// The tab bar is never hidden while the keyboard is open (that changed the screen height after
// the keyboard had opened and made the box jump); the keyboard simply covers it.
// The padding is applied once per keyboard open/close (no per-frame JS work, nothing to lag).
// Web (react-native-web): Keyboard never fires, so this is a plain View there.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardEvent,
  LayoutAnimation,
  Platform,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';

const SHOW = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

interface Props {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  extraOffset?: number; // extra gap above the keyboard (default 0; negative = overlap, e.g. a nav-bar pad)
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
}

export default function KeyboardSafeView({ style, children, extraOffset = 0, pointerEvents }: Props) {
  const ref = useRef<any>(null);
  const [pad, setPad] = useState(0);
  const kbTop = useRef<number | null>(null);

  const recompute = useCallback(() => {
    const top = kbTop.current;
    if (top == null) {
      setPad(p => (p === 0 ? p : 0));
      return;
    }
    ref.current?.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      // Padding is inside the view, so its frame (and bottom edge) does not move with it
      const next = Math.max(0, Math.round(y + h - top + extraOffset));
      setPad(prev => (Math.abs(next - prev) < 1 ? prev : next));
    });
  }, [extraOffset]);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      kbTop.current = e.endCoordinates.screenY;
      if (Platform.OS === 'ios' && e.duration) {
        LayoutAnimation.configureNext({ duration: e.duration, update: { type: 'keyboard' } });
      }
      recompute();
    };
    const onHide = (e?: KeyboardEvent) => {
      kbTop.current = null;
      if (Platform.OS === 'ios' && e?.duration) {
        LayoutAnimation.configureNext({ duration: e.duration, update: { type: 'keyboard' } });
      }
      setPad(0);
    };
    const subs = [Keyboard.addListener(SHOW, onShow), Keyboard.addListener(HIDE, onHide)];
    if (Platform.OS === 'ios') subs.push(Keyboard.addListener('keyboardWillChangeFrame', onShow));
    return () => subs.forEach(s => s.remove());
  }, [recompute]);

  return (
    <View
      ref={ref}
      pointerEvents={pointerEvents}
      style={[{ flex: 1 }, style, { paddingBottom: pad }]}
      onLayout={recompute}>
      {children}
    </View>
  );
}

// Calls `fn` each time the keyboard opens (e.g. scroll a non-inverted chat to its newest message).
export function useKeyboardShown(fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    const sub = Keyboard.addListener(SHOW, () => fnRef.current());
    return () => sub.remove();
  }, []);
}
