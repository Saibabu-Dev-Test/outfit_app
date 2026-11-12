// ♡ from the Feed header. Two tabs:
//   Activity (default): who liked / disliked / commented on my photos and who followed me, newest first
//   My likes: everything I have liked (posts and wardrobe photos), newest first, as a grid
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { markActivitySeen } from '../../services/activityWatcher';
import PhotoGrid from '../../components/PhotoGrid';
import Avatar from '../../components/Avatar';
import { getCachedLikedItems, getLikedItems, Post } from '../../services/feedApi';
import { ActivityItem, activityLine, getMyActivity, getTargetThumbnail } from '../../services/activityApi';
import { timeAgo } from '../../utils/date';
import { useBottomSpace } from '../../hooks/useBottomSpace';

type Tab = 'activity' | 'likes';

// Photo on the right of an activity row (loaded on demand when the doc has none)
function RowThumb({ item }: { item: ActivityItem }) {
  const [uri, setUri] = useState<string | null>(item.thumbnail);
  useEffect(() => {
    let alive = true;
    if (!item.thumbnail && item.targetKind && item.targetKind !== 'birthday' && item.targetId) {
      getTargetThumbnail(item.targetKind, item.targetId).then(u => alive && setUri(u));
    }
    return () => {
      alive = false;
    };
  }, [item.thumbnail, item.targetKind, item.targetId]);
  if (!item.targetKind) return null;
  return uri ? (
    <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
  ) : (
    <View style={[styles.thumb, styles.thumbEmpty]} />
  );
}

export default function LikesScreen({ navigation, route }: { navigation: any; route: any }) {
  const bottomPad = useBottomSpace();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>(route?.params?.tab === 'likes' ? 'likes' : 'activity');
  const [items, setItems] = useState<Post[] | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadLikes = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      return;
    }
    // Cached list at once, then the fresh one; a failed read shows the empty state, not an error
    const cached = await getCachedLikedItems(user.id);
    setItems(prev => prev ?? cached ?? null);
    try {
      setItems(await getLikedItems(user.id));
    } catch {
      setItems(prev => prev ?? []);
    }
    setError(null);
  }, [user?.id]);

  const loadActivity = useCallback(async () => {
    if (!user?.id) return;
    try {
      setActivity(await getMyActivity(user.id));
      setActivityError(null);
    } catch (e: any) {
      setActivityError(e?.message || 'Could not load activity.');
      setActivity([]);
    }
  }, [user?.id]);

  const load = useCallback(async () => {
    try {
      await (tab === 'activity' ? loadActivity() : loadLikes());
    } finally {
      setRefreshing(false);
    }
  }, [tab, loadActivity, loadLikes]);

  useFocusEffect(
    useCallback(() => {
      load();
      markActivitySeen(user?.id); // clears the ♡ badge
    }, [load, user?.id]),
  );

  const refresh = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      tintColor={colors.primary}
      colors={[colors.primary]}
    />
  );

  const openActivity = (a: ActivityItem) => {
    if (a.targetKind === 'birthday') {
      navigation.navigate('BirthdayChat', { mode: 'wishes', uid: a.targetId || user?.id });
      return;
    }
    if (a.type === 'follow' || !a.targetKind || !a.targetId) {
      if (a.actorId) navigation.navigate('UserProfile', { userId: a.actorId });
      return;
    }
    navigation.navigate('PostDetail', { kind: a.targetKind, id: a.targetId });
  };

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
        <Text style={styles.title}>{tab === 'activity' ? 'Activity ♥' : 'Likes ♥'}</Text>
      </View>
      <View style={styles.tabs}>
        {(['activity', 'likes'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabOn]}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}>
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t === 'activity' ? 'Activity' : 'My likes'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'activity' ? (
        activity === null ? (
          <ActivityIndicator style={styles.spinner} color={colors.primary} />
        ) : (
          <FlatList
            contentContainerStyle={{ paddingBottom: bottomPad }}
            data={activity}
            keyExtractor={a => a.id}
            refreshControl={refresh}
            initialNumToRender={12}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => openActivity(item)} activeOpacity={0.7}>
                <TouchableOpacity
                  onPress={() => item.actorId && navigation.navigate('UserProfile', { userId: item.actorId })}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Avatar uri={item.actorAvatar} name={item.actorName} size={44} />
                </TouchableOpacity>
                <View style={styles.rowText}>
                  <Text style={styles.line} numberOfLines={3}>
                    {activityLine(item)}
                    <Text style={styles.time}>{item.createdAt ? `  ${timeAgo(item.createdAt)}` : ''}</Text>
                  </Text>
                </View>
                <RowThumb item={item} />
              </TouchableOpacity>
            )}
            ListHeaderComponent={activityError ? <Text style={styles.error}>{activityError}</Text> : undefined}
            ListEmptyComponent={
              activityError ? undefined : (
                <Text style={styles.empty}>
                  When someone likes, comments on your photos or follows you, you'll see it here.
                </Text>
              )
            }
          />
        )
      ) : (
        <ScrollView refreshControl={refresh} contentContainerStyle={{ paddingBottom: bottomPad }}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {items === null ? (
            <ActivityIndicator style={styles.spinner} color={colors.primary} />
          ) : (
            <PhotoGrid
              items={items}
              onPress={p => navigation.navigate('PostDetail', { kind: p.kind, id: p.id })}
              empty="Posts and photos you like show up here. Double-tap a photo in the Feed to like it."
            />
          )}
        </ScrollView>
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
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.primary },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textMuted },
  tabTextOn: { color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.sm },
  rowText: { flex: 1, marginHorizontal: spacing.md },
  line: { fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 19 },
  time: { fontSize: fontSize.xs, color: colors.textMuted },
  thumb: { width: 46, height: 46, borderRadius: borderRadius.sm },
  thumbEmpty: { backgroundColor: colors.divider },
  error: { color: colors.error, textAlign: 'center', padding: spacing.md },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl },
  spinner: { marginTop: spacing.xxl },
}));
