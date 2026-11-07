// Round avatar: photo, or the first letter of the name
import React from 'react';
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, fontWeight } from '../theme';

interface Props {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export default function Avatar({ uri, name, size = 36, style }: Props) {
  const dims = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <View style={[styles.wrap, dims, style]}>
        <Image source={{ uri }} style={dims} resizeMode="cover" />
      </View>
    );
  }
  const initial = ((name || '').trim()[0] || '?').toUpperCase();
  return (
    <View style={[styles.wrap, styles.fallback, dims, style]}>
      <Text style={[styles.initial, { fontSize: Math.max(11, size * 0.42) }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: colors.divider },
  fallback: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.textInverse, fontWeight: fontWeight.extraBold },
});
