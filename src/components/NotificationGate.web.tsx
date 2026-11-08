// Web build: never blocks the app. Shows a small, dismissible card offering browser notifications;
// the permission prompt only opens when the user taps "Allow" (browsers need a tap for it).
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import { browserPermission, requestNotifications } from '../native/notifications.web';

const DISMISSED_KEY = 'outfit.webNotifDismissed';

export default function NotificationGate({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    // Wait a little so it never covers the first screen while it loads
    const t = setTimeout(async () => {
      if (browserPermission() !== 'default') return;
      const dismissed = await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null);
      if (alive && !dismissed) setShow(true);
    }, 8000);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  const close = () => {
    setShow(false);
    AsyncStorage.setItem(DISMISSED_KEY, '1').catch(() => {});
  };

  const allow = async () => {
    await requestNotifications();
    close();
  };

  return (
    <View style={styles.root}>
      {children}
      {show && (
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.title}>🔔 Daily colour reminders?</Text>
          <Text style={styles.text}>Allow notifications for your daily colour and votes. You can change this any time.</Text>
          <View style={styles.row}>
            <TouchableOpacity onPress={close} style={styles.later} accessibilityRole="button">
              <Text style={styles.laterText}>Not now</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={allow} style={styles.btn} accessibilityRole="button">
              <Text style={styles.btnText}>Allow</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  root: { flex: 1 },
  card: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: spacing.md,
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 2000,
  },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  text: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm },
  later: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  laterText: { color: colors.textSecondary, fontWeight: fontWeight.semiBold },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginLeft: spacing.sm,
  },
  btnText: { color: colors.onPrimary, fontWeight: fontWeight.bold },
}));
