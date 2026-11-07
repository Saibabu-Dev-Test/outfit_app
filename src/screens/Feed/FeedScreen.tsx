// Instagram-style public feed: infinite scroll, pull to refresh, like (tap heart or double-tap the photo)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  StatusBar,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import Avatar from '../../components/Avatar';
import ReportModal, { ReportTarget } from '../../components/ReportModal';
import { FeedCursor, Post, deletePost, getFeedPage, getLikedPostIds, toggleLike } from '../../services/feedApi';
import { timeAgo } from '../../utils/date';

interface PostCardProps {
  post: Post;
  liked: boolean;
  width: number;
  onToggleLike: (post: Post, forceLike?: boolean) => void;
  onOpenProfile: (userId: string) => void;
  onMenu: (post: Post) => void;
}

function PostCard({ post, liked, width, onToggleLike, onOpenProfile, onMenu }: PostCardProps) {
  const lastTap = useRef(0);
  const heart = useRef(new Animated.Value(0)).current;

  const onImagePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      heart.setValue(0);
      Animated.sequence([
        Animated.spring(heart, { toValue: 1, useNativeDriver: true, friction: 4 }),
        Animated.timing(heart, { toValue: 0, duration: 250, delay: 300, useNativeDriver: true }),
      ]).start();
      if (!liked) onToggleLike(post, true);
    } else {
      lastTap.current = now;
    }
  };

  return (
    <View style={styles.post}>
      <View style={styles.postHeader}>
        <TouchableOpacity style={styles.postUser} onPress={() => onOpenProfile(post.userId)}>
          <Avatar uri={post.userAvatar} name={post.userName} size={34} />
          <View style={styles.postUserText}>
            <Text style={styles.postName} numberOfLines={1}>
              {post.userName}
            </Text>
            <Text style={styles.postTime}>{timeAgo(post.createdAt)}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onMenu(post)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.menu}>⋯</Text>
        </TouchableOpacity>
      </View>

      <Pressable onPress={onImagePress}>
        <Image source={{ uri: post.imageData }} style={{ width, height: width }} resizeMode="cover" />
        <Animated.Text
          style={[
            styles.bigHeart,
            { opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }] },
          ]}>
          ♥
        </Animated.Text>
      </Pressable>

      <View style={styles.actions}>
        <TouchableOpacity onPress={() => onToggleLike(post)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.heart, liked && styles.heartOn]}>{liked ? '♥' : '♡'}</Text>
        </TouchableOpacity>
        <Text style={styles.likes}>
          {post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}
        </Text>
      </View>
      {post.caption ? (
        <Text style={styles.caption}>
          <Text style={styles.captionName} onPress={() => onOpenProfile(post.userId)}>
            {post.userName}{' '}
          </Text>
          {post.caption}
        </Text>
      ) : null}
    </View>
  );
}

export default function FeedScreen({ navigation, route }: { navigation: any; route: any }) {
  const { user } = useAuth();
  const uid = user?.id;
  const { isAdmin } = useIsAdmin(uid);
  const { width } = useWindowDimensions();

  const [posts, setPosts] = useState<Post[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<FeedCursor>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const liking = useRef<Set<string>>(new Set());

  const markLiked = useCallback(
    async (list: Post[]) => {
      if (!uid || !list.length) return;
      const ids = await getLikedPostIds(list.map(p => p.id), uid);
      setLiked(prev => {
        const next = new Set(prev);
        list.forEach(p => (ids.has(p.id) ? next.add(p.id) : next.delete(p.id)));
        return next;
      });
    },
    [uid],
  );

  const loadFirst = useCallback(async () => {
    try {
      const page = await getFeedPage(null);
      setPosts(page.posts);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      setError(null);
      markLiked(page.posts);
    } catch (e: any) {
      setError(e?.message || 'Could not load the feed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [markLiked]);

  const loadMore = async () => {
    if (loading || loadingMore || refreshing || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await getFeedPage(cursor);
      setPosts(prev => {
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...page.posts.filter(p => !seen.has(p.id))];
      });
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      markLiked(page.posts);
    } catch (e: any) {
      setError(e?.message || 'Could not load more posts.');
    } finally {
      setLoadingMore(false);
    }
  };

  // First load, and again after a new post (NewPost passes refreshAt)
  const refreshAt = route?.params?.refreshAt;
  useEffect(() => {
    loadFirst();
  }, [loadFirst, refreshAt]);

  const handleToggleLike = async (post: Post, forceLike = false) => {
    if (!uid) {
      Alert.alert('Not signed in', 'Please sign in again to like posts.');
      return;
    }
    const isLiked = liked.has(post.id);
    if (forceLike && isLiked) return;
    if (liking.current.has(post.id)) return;
    liking.current.add(post.id);
    // Optimistic
    const apply = (nowLiked: boolean, count: number) => {
      setLiked(prev => {
        const next = new Set(prev);
        if (nowLiked) next.add(post.id);
        else next.delete(post.id);
        return next;
      });
      setPosts(prev => prev.map(p => (p.id === post.id ? { ...p, likeCount: count } : p)));
    };
    apply(!isLiked, Math.max(0, post.likeCount + (isLiked ? -1 : 1)));
    try {
      const r = await toggleLike(post.id, uid);
      apply(r.liked, r.likeCount);
    } catch (e: any) {
      apply(isLiked, post.likeCount);
      Alert.alert('Like failed', e?.message || 'Please try again.');
    } finally {
      liking.current.delete(post.id);
    }
  };

  const handleMenu = (post: Post) => {
    const buttons: any[] = [];
    if (post.userId !== uid) {
      buttons.push({ text: 'Report', onPress: () => setReportTarget({ postId: post.id }) });
    }
    if (post.userId === uid || isAdmin) {
      buttons.push({
        text: post.userId === uid ? 'Delete post' : 'Delete post (admin)',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(post.id);
            setPosts(prev => prev.filter(p => p.id !== post.id));
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Please try again.');
          }
        },
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Post', undefined, buttons);
  };

  const openProfile = (userId: string) => {
    if (userId) navigation.navigate('UserProfile', { userId });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle="dark-content"
        {...(Platform.OS === 'android' ? { backgroundColor: colors.surface } : {})}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Feed</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('UserSearch')}>
          <Text style={styles.iconText}>🔍</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate('NewPost')}>
          <Text style={styles.newText}>＋ New post</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            liked={liked.has(item.id)}
            width={width}
            onToggleLike={handleToggleLike}
            onOpenProfile={openProfile}
            onMenu={handleMenu}
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
              <Text style={styles.emptyText}>No posts yet. Share the first look!</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('NewPost')}>
                <Text style={styles.newText}>＋ New post</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
      <ReportModal target={reportTarget} reporterId={uid} onClose={() => setReportTarget(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  iconText: { fontSize: 20 },
  newBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginLeft: spacing.xs,
  },
  newText: { color: colors.textInverse, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  post: { marginBottom: spacing.base },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  postUser: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  postUserText: { marginLeft: spacing.sm, flex: 1 },
  postName: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  postTime: { fontSize: fontSize.xs, color: colors.textMuted },
  menu: { fontSize: 22, color: colors.textSecondary, paddingHorizontal: spacing.sm },
  bigHeart: {
    position: 'absolute',
    alignSelf: 'center',
    top: '35%',
    fontSize: 96,
    color: colors.textInverse,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowRadius: 12,
  },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  heart: { fontSize: 28, color: colors.textPrimary, marginRight: spacing.sm },
  heartOn: { color: '#E91E63' },
  likes: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  caption: { fontSize: fontSize.sm, color: colors.textPrimary, paddingHorizontal: spacing.md, paddingTop: 4, lineHeight: 19 },
  captionName: { fontWeight: fontWeight.bold },
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
});
