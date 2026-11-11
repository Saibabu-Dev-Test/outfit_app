// Browser build: the browser resizes the page for its own keyboard, so these are plain views with
// the same props as react-native-keyboard-controller's (keyboard.tsx). Type parity: web/shims.check.ts
import React, { forwardRef } from 'react';
import { ScrollView, ScrollViewProps, View, ViewProps } from 'react-native';

export function KeyboardProvider({ children }: { children?: React.ReactNode; [k: string]: unknown }) {
  return <>{children}</>;
}

type KavProps = ViewProps & {
  behavior?: 'height' | 'padding' | 'position' | 'translate-with-padding';
  keyboardVerticalOffset?: number;
  automaticOffset?: boolean;
  enabled?: boolean;
  children?: React.ReactNode;
};
export const KeyboardAvoidingView = forwardRef<any, KavProps>(
  ({ behavior: _b, keyboardVerticalOffset: _k, automaticOffset: _a, enabled: _e, ...rest }, ref) => (
    <View ref={ref} {...rest} />
  ),
);

type StickyProps = ViewProps & { offset?: { closed?: number; opened?: number }; enabled?: boolean; children?: React.ReactNode };
export const KeyboardStickyView = forwardRef<any, StickyProps>(({ offset: _o, enabled: _e, ...rest }, ref) => (
  <View ref={ref} {...rest} />
));

type ChatScrollProps = ScrollViewProps & {
  inverted?: boolean;
  offset?: number;
  keyboardLiftBehavior?: 'always' | 'whenAtEnd' | 'persistent' | 'never';
  children?: React.ReactNode;
};
export const KeyboardChatScrollView = forwardRef<any, ChatScrollProps>(
  ({ inverted: _i, offset: _o, keyboardLiftBehavior: _l, ...rest }, ref) => <ScrollView ref={ref} {...rest} />,
);
