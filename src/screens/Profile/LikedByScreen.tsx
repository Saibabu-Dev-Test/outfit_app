// "Liked by": who liked one of my posts / wardrobe photos (tap the 👍 count on my own photo)
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StatusBar, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/Avatar';
import { getLikers, Liker } from '../../services/activityApi';
import { timeAgo } from '../../utils/date';

export default function LikedByScreen({ navigation, route }: { navigation: any; route: any }) {
  const kind: 'post' | 'wardrobe' = route?.params?.kind === 'wardrobe' ? 'wardrobe' : 'post';
  const id: string = route?.params?.id || '';
  const { user } = useAuth();
  const [list, setList] = useState<Liker[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getLikers(kind, id, user?.id)
      .then(l => alive && setList(l))
      .catch(e => {
        if (!alive) return;
        setError(e?.message || 'Could not load likes.');
        setList([]);
      });
    return () => {
      alive = false;
    };
  }, [kind, id, user?.id]);

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
          Liked by{list && list.length ? ` · ${list.length}` : ''}
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
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{error || 'No likes yet.'}</Text>}
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
  time: { fontSize: fontSize.xs, color: colors.textMuted, marginLeft: spacing.sm },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl },
}));
