// Forms and sheets: keeps the bottom of a screen (fields, buttons) directly on top of the soft keyboard.
// react-native-keyboard-controller's KeyboardAvoidingView pads the bottom frame-by-frame with the
// keyboard animation (no jump after the keyboard has opened), measuring its own position on screen
// (automaticOffset), so it works under headers, inside tabs, stacks and edge-to-edge modals.
// Chat screens use KeyboardChatScrollView + KeyboardStickyView instead (see keyboard.tsx).
import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { KeyboardAvoidingView } from './keyboard';

interface Props {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  extraOffset?: number; // extra gap above the keyboard (default 0)
}

export default function KeyboardSafeView({ style, children, extraOffset = 0 }: Props) {
  return (
    <KeyboardAvoidingView
      behavior="padding"
      automaticOffset
      keyboardVerticalOffset={extraOffset}
      style={[styles.flex1, style]}>
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex1: { flex: 1 } });
