// Simple full-screen page: back arrow + title, then the content
import React from 'react';
import { Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, themedStyles, statusBarStyle } from '../theme';

export default function ScreenShell({
  title,
  navigation,
  children,
  right,
}: {
  title: string;
  navigation: any;
  children?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle={statusBarStyle()} {...(Platform.OS === 'android' ? { backgroundColor: colors.surface } : {})} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {right}
      </View>
      {children}
    </SafeAreaView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
    title: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  }),
);
