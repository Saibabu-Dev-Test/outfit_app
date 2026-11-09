// Notifications must be on to use the app (user's choice): if the permission (Android 13+)
// isn't granted or the app's notifications are off, a blocking screen asks to turn them on.
// Checked at start and every time the app comes back to the foreground.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View, Text, TouchableOpacity, StatusBar, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../theme';
import {
  NotifState,
  canAskAgain,
  checkNotifications,
  openNotificationSettings,
  requestNotifications,
  scheduleDaily,
} from '../native/notifications';

const ASKED_KEY = 'outfit.notifAsked';

export default function NotificationGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NotifState | 'checking'>('checking');
  const [blocked, setBlocked] = useState(false); // "don't ask again": settings only
  const busy = useRef(false);

  const check = useCallback(async (askIfNew: boolean) => {
    if (busy.current) return;
    busy.current = true;
    try {
      let s = await checkNotifications();
      if (s === 'off' && askIfNew && canAskAgain()) {
        // First run: show the system prompt once
        const asked = await AsyncStorage.getItem(ASKED_KEY).catch(() => null);
        if (!asked) {
          await AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {});
          const r = await requestNotifications();
          if (r === 'blocked') setBlocked(true);
          s = await checkNotifications();
        }
      }
      setState(s);
      // Notifications on: (re)arm the 8 AM / 1 PM / 7 PM reminders (idempotent)
      if (s === 'on') scheduleDaily();
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    check(true);
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') check(false);
    });
    return () => sub.remove();
  }, [check]);

  const turnOn = async () => {
    // Android 13+: try the system prompt first; if it's blocked, open settings
    if (canAskAgain() && !blocked) {
      const r = await requestNotifications();
      if (r === 'granted') {
        check(false);
        return;
      }
      if (r === 'blocked') setBlocked(true);
    }
    const s = await checkNotifications();
    if (s === 'on') {
      setState('on');
      scheduleDaily();
      return;
    }
    await openNotificationSettings();
  };

  if (state === 'on') return <>{children}</>;

  return (
    <View style={styles.wrap}>
      <StatusBar barStyle={statusBarStyle()} />
      {state === 'checking' ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <Text style={styles.emoji}>🔔</Text>
          <Text style={styles.title}>Turn on notifications to use OUTFIT</Text>
          <Text style={styles.text}>
            OUTFIT sends your daily colour, votes and circle updates as notifications. Please allow notifications to
            continue.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={turnOn} activeOpacity={0.85}>
            <Text style={styles.btnText}>Open settings</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => check(false)} style={styles.again}>
            <Text style={styles.againText}>I turned them on</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  emoji: { fontSize: 56, marginBottom: spacing.md },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extraBold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  text: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 22,
  },
  btn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  btnText: { color: colors.onPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.md },
  again: { marginTop: spacing.lg, padding: spacing.sm },
  againText: { color: colors.primary, fontWeight: fontWeight.semiBold },
}));
