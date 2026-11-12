// Instagram-like profile header: avatar, counts (tap followers/following to open lists), name, bio, style chips
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import Avatar from './Avatar';
import ZoomableImage from './ZoomableImage';
import { ProfileCounts } from '../services/socialApi';

interface Props {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  bio?: string;
  stylePrefs?: string[];
  counts: ProfileCounts | null;
  isStar?: boolean;
  isPrivate?: boolean;
  children?: React.ReactNode; // buttons row
  badge?: React.ReactNode; // small line under the name (e.g. coins + tier)
}

export default function ProfileHeader({ userId, name, avatarUrl, bio, stylePrefs, counts, isStar, isPrivate, children, badge }: Props) {
  const navigation = useNavigation<any>();
  const [photoOpen, setPhotoOpen] = useState(false);
  const stat = (label: string, value: number | undefined, onPress?: () => void) => (
    <TouchableOpacity style={styles.stat} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <Text style={styles.statValue}>{value === undefined ? '–' : value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
  const openList = (mode: 'followers' | 'following') => () =>
    navigation.navigate('FollowList', { userId, mode, name });

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <TouchableOpacity
          disabled={!avatarUrl}
          activeOpacity={0.8}
          onPress={() => setPhotoOpen(true)}
          accessibilityLabel="View profile photo">
          <Avatar uri={avatarUrl} name={name} size={84} />
        </TouchableOpacity>
        <View style={styles.stats}>
          {stat('Posts', counts?.posts)}
          {stat('Wardrobe', counts?.wardrobe)}
          {stat('Followers', counts?.followers, openList('followers'))}
          {stat('Following', counts?.following, openList('following'))}
        </View>
      </View>
      <Text style={styles.name}>
        {name}
        {isStar ? ' ⭐' : ''}
        {isPrivate ? ' 🔒' : ''}
      </Text>
      {badge || null}
      {bio ? <Text style={styles.bio}>{bio}</Text> : null}
      {stylePrefs && stylePrefs.length ? (
        <View style={styles.chips}>
          {stylePrefs.map(p => (
            <View key={p} style={styles.chip}>
              <Text style={styles.chipText}>{p}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {children ? <View style={styles.buttons}>{children}</View> : null}
      {avatarUrl ? (
        <ZoomableImage visible={photoOpen} images={[avatarUrl]} onClose={() => setPhotoOpen(false)} />
      ) : null}
    </View>
  );
}

export const headerButtonStyles = themedStyles(() => StyleSheet.create({
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    backgroundColor: colors.divider,
    marginHorizontal: 3,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  btnTextPrimary: { color: colors.onPrimary },
}));

const styles = themedStyles(() => StyleSheet.create({
  wrap: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center' },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: spacing.md },
  stat: { alignItems: 'center', paddingHorizontal: 2 },
  statValue: { fontSize: fontSize.md, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  name: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary, marginTop: spacing.sm },
  bio: { fontSize: fontSize.sm, color: colors.textPrimary, marginTop: 2, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: colors.divider,
    marginRight: 6,
    marginBottom: 4,
  },
  chipText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: fontWeight.semiBold },
  buttons: { flexDirection: 'row', marginTop: spacing.md, marginHorizontal: -3 },
}));
