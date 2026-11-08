// One feed item (post or public wardrobe photo), Instagram style:
// header, photo(s), double-tap like, ♥ / 💬, caption. 2-6 photos = A-F vote post.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import Avatar from './Avatar';
import ReportModal, { ReportTarget } from './ReportModal';
import {
  OPTION_LABELS,
  Post,
  VoteTally,
  castPostVote,
  deletePost,
  getLikedPostIds,
  getPostVotes,
  getWardrobeStats,
  onCommentCountChange,
  toggleLike,
  toggleWardrobeLike,
} from '../services/feedApi';
import { timeAgo } from '../utils/date';

interface Props {
  post: Post;
  width: number;
  myUid?: string;
  isAdmin?: boolean;
  onDeleted?: (post: Post) => void;
}

export default function PostCard({ post, width, myUid, isAdmin, onDeleted }: Props) {
  const navigation = useNavigation<any>();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [page, setPage] = useState(0);
  const [votes, setVotes] = useState<VoteTally | null>(null);
  const [voting, setVoting] = useState<number | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const liking = useRef(false);
  const lastTap = useRef(0);
  const heart = useRef(new Animated.Value(0)).current;
  const multi = post.kind === 'post' && post.photos.length > 1;

  // My like + counts
  useEffect(() => {
    let alive = true;
    if (post.kind === 'post') {
      if (myUid) getLikedPostIds([post.id], myUid).then(s => alive && setLiked(s.has(post.id)));
    } else {
      getWardrobeStats(post.id, myUid).then(r => {
        if (!alive) return;
        setLiked(r.liked);
        setLikeCount(r.likeCount);
        setCommentCount(r.commentCount);
      });
    }
    return () => {
      alive = false;
    };
  }, [post.id, post.kind, myUid]);

  useEffect(() => {
    setLikeCount(post.likeCount);
    setCommentCount(post.commentCount);
  }, [post.likeCount, post.commentCount]);

  // Comment count updates from the Comments screen (posts)
  useEffect(
    () =>
      onCommentCountChange((id, delta) => {
        if (id === post.id) setCommentCount(c => Math.max(0, c + delta));
      }),
    [post.id],
  );

  // A-F votes
  useEffect(() => {
    let alive = true;
    if (multi) getPostVotes(post.id, post.photos.length, myUid).then(v => alive && setVotes(v));
    return () => {
      alive = false;
    };
  }, [multi, post.id, post.photos.length, myUid]);

  const like = async (force = false) => {
    if (!myUid) {
      Alert.alert('Not signed in', 'Please sign in again to like posts.');
      return;
    }
    if ((force && liked) || liking.current) return;
    liking.current = true;
    const was = liked;
    const wasCount = likeCount;
    setLiked(!was);
    setLikeCount(Math.max(0, wasCount + (was ? -1 : 1)));
    try {
      if (post.kind === 'post') {
        const r = await toggleLike(post.id, myUid);
        setLiked(r.liked);
        setLikeCount(r.likeCount);
      } else {
        const now = await toggleWardrobeLike(post.id, myUid, was);
        setLiked(now);
      }
    } catch (e: any) {
      setLiked(was);
      setLikeCount(wasCount);
      Alert.alert('Like failed', e?.message || 'Please try again.');
    } finally {
      liking.current = false;
    }
  };

  const onImagePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      heart.setValue(0);
      Animated.sequence([
        Animated.spring(heart, { toValue: 1, useNativeDriver: true, friction: 4 }),
        Animated.timing(heart, { toValue: 0, duration: 250, delay: 300, useNativeDriver: true }),
      ]).start();
      if (!liked) like(true);
    } else {
      lastTap.current = now;
    }
  };

  const vote = async (i: number) => {
    if (!myUid || voting !== null || votes?.myVote === i) return;
    setVoting(i);
    try {
      await castPostVote(post.id, myUid, i);
      setVotes(await getPostVotes(post.id, post.photos.length, myUid));
    } catch (e: any) {
      Alert.alert('Vote failed', e?.message || 'Please try again.');
    } finally {
      setVoting(null);
    }
  };

  const openProfile = () => {
    if (post.userId) navigation.navigate('UserProfile', { userId: post.userId });
  };
  const openComments = () =>
    navigation.navigate('Comments', { target: { kind: post.kind, id: post.id } });

  const menu = () => {
    const buttons: any[] = [];
    if (post.userId !== myUid && post.kind === 'post') {
      buttons.push({ text: 'Report', onPress: () => setReportTarget({ postId: post.id }) });
    }
    if (post.kind === 'post' && (post.userId === myUid || isAdmin)) {
      buttons.push({
        text: post.userId === myUid ? 'Delete post' : 'Delete post (admin)',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(post.id);
            onDeleted?.(post);
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Please try again.');
          }
        },
      });
    }
    if (!buttons.length) return;
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Post', undefined, buttons);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)));

  const photo = (uri: string, i: number) => (
    <Pressable key={i} onPress={onImagePress}>
      <Image source={{ uri }} style={{ width, height: width }} resizeMode="cover" />
      {multi ? (
        <View style={styles.letter}>
          <Text style={styles.letterText}>{OPTION_LABELS[i]}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <View style={styles.post}>
      <View style={styles.postHeader}>
        <TouchableOpacity style={styles.postUser} onPress={openProfile}>
          <Avatar uri={post.userAvatar} name={post.userName} size={34} />
          <View style={styles.postUserText}>
            <Text style={styles.postName} numberOfLines={1}>
              {post.userName}
            </Text>
            <Text style={styles.postTime}>
              {timeAgo(post.createdAt)}
              {post.kind === 'wardrobe' ? ' · wardrobe' : multi ? ` · vote ${OPTION_LABELS.slice(0, post.photos.length).join('/')}` : ''}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={menu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.menu}>⋯</Text>
        </TouchableOpacity>
      </View>

      <View>
        {multi ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            nestedScrollEnabled>
            {post.photos.map(photo)}
          </ScrollView>
        ) : (
          photo(post.imageData, 0)
        )}
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.bigHeart,
            { opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }] },
          ]}>
          ♥
        </Animated.Text>
      </View>
      {multi ? (
        <View style={styles.dots}>
          {post.photos.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
      ) : null}

      {multi ? (
        <View style={styles.voteBox}>
          <Text style={styles.voteTitle}>
            {votes?.myVote != null ? `You voted ${OPTION_LABELS[votes.myVote]} · tap another to change` : 'Which one? Tap to vote'}
          </Text>
          <View style={styles.voteRow}>
            {post.photos.map((_, i) => {
              const c = votes?.counts[i] || 0;
              const pct = votes && votes.total ? Math.round((c / votes.total) * 100) : 0;
              const mine = votes?.myVote === i;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.voteBtn, mine && styles.voteBtnMine]}
                  onPress={() => vote(i)}
                  disabled={voting !== null}
                  activeOpacity={0.8}>
                  {voting === i ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Text style={[styles.voteLetter, mine && styles.voteLetterMine]}>{OPTION_LABELS[i]}</Text>
                      <Text style={[styles.votePct, mine && styles.voteLetterMine]}>{pct}%</Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.voteTotal}>
            {votes ? `${votes.total} ${votes.total === 1 ? 'vote' : 'votes'}` : ' '}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity onPress={() => like()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.heart, liked && styles.heartOn]}>{liked ? '♥' : '♡'}</Text>
        </TouchableOpacity>
        <Text style={styles.likes}>
          {likeCount} {likeCount === 1 ? 'like' : 'likes'}
        </Text>
        <TouchableOpacity style={styles.commentBtn} onPress={openComments} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.commentIcon}>💬</Text>
          <Text style={styles.likes}>{commentCount}</Text>
        </TouchableOpacity>
      </View>
      {post.caption ? (
        <Text style={styles.caption}>
          <Text style={styles.captionName} onPress={openProfile}>
            {post.userName}{' '}
          </Text>
          {post.caption}
        </Text>
      ) : null}
      <TouchableOpacity onPress={openComments}>
        <Text style={styles.viewComments}>
          {commentCount > 0
            ? `View all ${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`
            : 'Add a comment...'}
        </Text>
      </TouchableOpacity>
      <ReportModal target={reportTarget} reporterId={myUid} onClose={() => setReportTarget(null)} />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  post: { marginBottom: spacing.base, backgroundColor: colors.surface },
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
  letter: {
    position: 'absolute',
    top: 10,
    left: 10,
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: { color: '#FFFFFF', fontWeight: fontWeight.extraBold, fontSize: 15 },
  bigHeart: {
    position: 'absolute',
    alignSelf: 'center',
    top: '35%',
    fontSize: 96,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowRadius: 12,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', paddingTop: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border, marginHorizontal: 3 },
  dotOn: { backgroundColor: colors.primary },
  voteBox: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  voteTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: 6 },
  voteRow: { flexDirection: 'row', flexWrap: 'wrap' },
  voteBtn: {
    minWidth: 52,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 6,
    backgroundColor: colors.background,
  },
  voteBtnMine: { borderColor: colors.primary, backgroundColor: colors.primary },
  voteLetter: { fontSize: fontSize.md, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  votePct: { fontSize: fontSize.xs, color: colors.textSecondary },
  voteLetterMine: { color: colors.onPrimary },
  voteTotal: { fontSize: fontSize.xs, color: colors.textMuted },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  heart: { fontSize: 28, color: colors.textPrimary, marginRight: spacing.sm },
  heartOn: { color: colors.pink },
  likes: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  commentBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: spacing.lg },
  commentIcon: { fontSize: 20, marginRight: 4 },
  viewComments: { fontSize: fontSize.sm, color: colors.textMuted, paddingHorizontal: spacing.md, paddingTop: 4 },
  caption: { fontSize: fontSize.sm, color: colors.textPrimary, paddingHorizontal: spacing.md, paddingTop: 4, lineHeight: 19 },
  captionName: { fontWeight: fontWeight.bold },
}));
