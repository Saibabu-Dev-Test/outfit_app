// Followers / Following list of a user; tap a person to open their profile
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StatusBar, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, themedStyles, statusBarStyle } from '../../theme';
import Avatar from '../../components/Avatar';
import { FollowEntry, getFollowList } from '../../services/socialApi';

export default function FollowListScreen({ navigation, route }: { navigation: any; route: any }) {
  const userId: string = route?.params?.userId || '';
  const mode: 'followers' | 'following' = route?.params?.mode === 'following' ? 'following' : 'followers';
  const [list, setList] = useState<FollowEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getFollowList(userId, mode)
      .then(l => alive && setList(l))
      .catch(e => {
        if (!alive) return;
        setError(e?.message || 'Could not load the list.');
        setList([]);
      });
    return () => {
      alive = false;
    };
  }, [userId, mode]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.surface } : {})}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {mode === 'followers' ? 'Followers' : 'Following'}
          {route?.params?.name ? ` · ${route.params.name}` : ''}
        </Text>
      </View>
      {list === null ? (
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={x => x.uid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.push('UserProfile', { userId: item.uid })}
              activeOpacity={0.7}>
              <Avatar uri={item.avatar} name={item.name} size={44} />
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {error || (mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.')}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
  title: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  spinner: { marginTop: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.sm },
  name: { marginLeft: spacing.md, fontSize: fontSize.base, fontWeight: fontWeight.semiBold, color: colors.textPrimary, flex: 1 },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl },
}));
