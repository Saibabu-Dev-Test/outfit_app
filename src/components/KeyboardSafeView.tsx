// Keeps the bottom of a screen (message box, comment box, send / enter buttons, option chips)
// sitting directly ON TOP of the soft keyboard: the keyboard opens only below them, never over them.
// Why not KeyboardAvoidingView + adjustResize: the app is edge-to-edge (gradle edgeToEdgeEnabled),
// so Android no longer resizes the window for the keyboard and behavior="height" leaves the box
// hidden or floating. Here we measure where this view ends on screen and pad its bottom by exactly
// the part the keyboard covers (works on Android 7-16 and iOS, inside tabs, stacks and modals).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardEvent, LayoutAnimation, Platform, StyleProp, View, ViewStyle } from 'react-native';

interface Props {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  extraOffset?: number; // extra gap above the keyboard (default 0)
}

export default function KeyboardSafeView({ style, children, extraOffset = 0 }: Props) {
  const ref = useRef<any>(null);
  const [pad, setPad] = useState(0);
  const kbTop = useRef<number | null>(null);

  const recompute = useCallback(() => {
    const top = kbTop.current;
    if (top == null) {
      setPad(0);
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
    const subs =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', onShow),
            Keyboard.addListener('keyboardWillChangeFrame', onShow),
            Keyboard.addListener('keyboardWillHide', onHide),
          ]
        : [Keyboard.addListener('keyboardDidShow', onShow), Keyboard.addListener('keyboardDidHide', onHide)];
    return () => subs.forEach(s => s.remove());
  }, [recompute]);

  return (
    <View ref={ref} style={[{ flex: 1 }, style, { paddingBottom: pad }]} onLayout={recompute}>
      {children}
    </View>
  );
}
