// Feed tab, Instagram style: public posts + public wardrobe photos from public profiles,
// newest first, infinite scroll, pull to refresh. Like, comment and A-F voting live in PostCard.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  Platform,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import PostCard from '../../components/PostCard';
import { FeedLoader, Post } from '../../services/feedApi';
import { subscribeUnreadActivity } from '../../services/activityWatcher';

export default function FeedScreen({ navigation, route }: { navigation: any; route: any }) {
  const { user } = useAuth();
  const uid = user?.id;
  const { isAdmin } = useIsAdmin(uid);
  const { width } = useWindowDimensions();

  const [posts, setPosts] = useState<Post[]>([]);
  // New likes / comments / follows since Likes was last opened (badge on ♡)
  const [unreadActivity, setUnreadActivity] = useState(0);
  useEffect(() => subscribeUnreadActivity(setUnreadActivity), []);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loader = useRef<FeedLoader>(new FeedLoader(uid));
  const busy = useRef(false);

  const loadFirst = useCallback(async () => {
    busy.current = true;
    loader.current = new FeedLoader(uid);
    try {
      const list = await loader.current.next();
      setPosts(list);
      setHasMore(loader.current.hasMore);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load the feed.');
    } finally {
      busy.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  const loadMore = async () => {
    if (busy.current || loading || refreshing || !hasMore) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const list = await loader.current.next();
      setPosts(prev => {
        const seen = new Set(prev.map(p => `${p.kind}_${p.id}`));
        return [...prev, ...list.filter(p => !seen.has(`${p.kind}_${p.id}`))];
      });
      setHasMore(loader.current.hasMore);
    } catch (e: any) {
      setError(e?.message || 'Could not load more posts.');
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  };

  // First load, and again when a screen passes refreshAt
  const refreshAt = route?.params?.refreshAt;
  useEffect(() => {
    loadFirst();
  }, [loadFirst, refreshAt]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.surface } : {})}
      />
      <View style={styles.header}>
        {navigation.canGoBack() && route?.name !== 'Feed' ? (
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title}>Feed</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Likes')}>
          <Text style={styles.iconText}>♡</Text>
          {unreadActivity > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadActivity > 99 ? '99+' : unreadActivity}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('UserSearch')}>
          <Text style={styles.iconText}>🔍</Text>
        </TouchableOpacity>
        {/* No separate Post screen: wardrobe uploads show in the feed. This spot opens Nearby circles. */}
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.navigate('Circles', { tab: 'nearby' })}
          accessibilityLabel="Nearby circles">
          <Text style={styles.newText}>📍 Nearby</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => `${p.kind}_${p.id}`}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            width={width}
            myUid={uid}
            isAdmin={isAdmin}
            onDeleted={p => setPosts(prev => prev.filter(x => !(x.id === p.id && x.kind === p.kind)))}
          />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadFirst();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : undefined}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={styles.footer} color={colors.primary} />
          ) : !hasMore && posts.length > 0 ? (
            <Text style={styles.end}>You're all caught up ✨</Text>
          ) : undefined
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.footer} color={colors.primary} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📸</Text>
              <Text style={styles.emptyText}>No posts yet. Add a wardrobe photo to share the first look!</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Wardrobe')}>
                <Text style={styles.newText}>👗 Open wardrobe</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
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
  title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  iconBtn: { paddingHorizontal: spacing.sm },
  badge: {
    position: 'absolute',
    top: -4,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#E91E63',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  iconText: { fontSize: 22, color: colors.textPrimary },
  newBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginLeft: spacing.xs,
  },
  newText: { color: colors.onPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  error: { color: colors.error, textAlign: 'center', padding: spacing.md },
  footer: { marginVertical: spacing.xl },
  end: { textAlign: 'center', color: colors.textMuted, marginVertical: spacing.xl },
  empty: { alignItems: 'center', padding: spacing.xxxl },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.sm },
  emptyText: { color: colors.textSecondary, marginBottom: spacing.md },
  emptyBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
}));
