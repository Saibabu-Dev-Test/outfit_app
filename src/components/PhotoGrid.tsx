// 3-column photo grid (Instagram profile style). Multi-photo posts show a ▣ badge.
import React from 'react';
import { View, Text, TouchableOpacity, Image, useWindowDimensions, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, themedStyles } from '../theme';
import { Post } from '../services/feedApi';

interface Props {
  items: Post[];
  onPress: (p: Post) => void;
  empty?: string;
}

export default function PhotoGrid({ items, onPress, empty }: Props) {
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - 4) / 3);
  if (!items.length) return <Text style={styles.empty}>{empty || 'Nothing here yet.'}</Text>;
  return (
    <View style={styles.grid}>
      {items.map(p => (
        <TouchableOpacity
          key={`${p.kind}_${p.id}`}
          style={[styles.tile, { width: tile, height: tile }]}
          activeOpacity={0.85}
          onPress={() => onPress(p)}>
          <Image source={{ uri: p.imageData }} style={{ width: tile, height: tile }} resizeMode="cover" />
          {p.photos.length > 1 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>A-{String.fromCharCode(64 + p.photos.length)}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { margin: 0.66, backgroundColor: colors.divider },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl, fontSize: fontSize.sm },
}));
