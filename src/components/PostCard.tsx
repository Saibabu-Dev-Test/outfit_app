// One feed item (post or public wardrobe photo), Instagram style:
// header, photo(s), double-tap like, 👍 / 👎 / 💬 / Follow / Share, caption. 2-6 photos = A-F vote post.
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
import { useAuth } from '../context/AuthContext';
import {
  OPTION_LABELS,
  Post,
  VoteTally,
  castPostVote,
  deletePost,
  getDislikeState,
  getClearPhotos,
  getFullPhotos,
  getLikedPostIds,
  getPostVotes,
  getWardrobeStats,
  onCommentCountChange,
  toggleDislike,
  toggleLike,
  toggleWardrobeLike,
} from '../services/feedApi';
import { follow, isFollowingCached, onFollowChange, unfollow } from '../services/socialApi';
import { shareWithReferral } from '../utils/referralLink';
import { logActivity } from '../services/activityApi';
import { timeAgo } from '../utils/date';
import NameWithAge from './NameWithAge';

interface Props {
  post: Post;
  width: number;
  myUid?: string;
  isAdmin?: boolean;
  onDeleted?: (post: Post) => void;
  // Single tap on a photo (after the double-tap-to-like window) opens it full screen
  onOpenPhoto?: (photos: string[], index: number) => void;
  // Detail screen: loads the full-size photos. Lists / the feed show the clear ~720 px copies
  // (older items: full photo, then thumbnail); a single tap on the photo opens the detail screen.
  detail?: boolean;
}

export default function PostCard({ post, width, myUid, isAdmin, onDeleted, onOpenPhoto, detail }: Props) {
  const navigation = useNavigation<any>();
  const { user: me } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [disliked, setDisliked] = useState(false);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [page, setPage] = useState(0);
  const [votes, setVotes] = useState<VoteTally | null>(null);
  const [voting, setVoting] = useState<number | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const liking = useRef(false);
  const lastTap = useRef(0);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (openTimer.current) clearTimeout(openTimer.current);
    },
    [],
  );
  const [shownPhotos, setShownPhotos] = useState<string[]>(post.photos);
  const heart = useRef(new Animated.Value(0)).current;
  const multi = post.kind === 'post' && post.photos.length > 1;
  const isMine = !!myUid && post.userId === myUid;
  const canFollow = !!myUid && !!post.userId && !isMine;

  // Detail screen: full-size photos (1 read; older posts already hold them).
  // Feed card: the clear ~720 px photos (thumbnail shows first, then swaps to the sharp copy).
  useEffect(() => {
    setShownPhotos(post.photos);
    if (!detail && !post.hasClear && !post.hasMedia) return; // oldest items: photos are already full size
    if (detail && !post.hasMedia) return;
    let alive = true;
    (detail ? getFullPhotos(post) : getClearPhotos(post)).then(p => alive && setShownPhotos(p));
    return () => {
      alive = false;
    };
  }, [detail, post]);

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

  // My dislike + dislike count
  useEffect(() => {
    let alive = true;
    getDislikeState(post.kind, post.id, myUid).then(r => {
      if (!alive) return;
      setDisliked(r.disliked);
      setDislikeCount(r.dislikeCount);
    });
    return () => {
      alive = false;
    };
  }, [post.id, post.kind, myUid]);

  // Am I following the author (shared across cards; updates when I follow on another card)
  useEffect(() => {
    if (!canFollow || !myUid) return;
    let alive = true;
    isFollowingCached(myUid, post.userId).then(f => alive && setFollowing(f));
    const off = onFollowChange((meUid, targetUid, f) => {
      if (meUid === myUid && targetUid === post.userId) setFollowing(f);
    });
    return () => {
      alive = false;
      off();
    };
  }, [canFollow, myUid, post.userId]);

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

  // "<me> liked your photo" in the owner's Activity (best-effort, skipped on my own photos)
  const notifyOwner = (type: 'like' | 'dislike') => {
    if (!myUid || isMine) return;
    logActivity(post.userId, { uid: myUid, name: me?.name, avatar: me?.avatarUrl }, type, {
      kind: post.kind,
      id: post.id,
      thumbnail: post.imageData,
    });
  };

  // My own photo: who liked it
  const openLikedBy = () => navigation.navigate('LikedBy', { kind: post.kind, id: post.id });

  const like = async (force = false) => {
    if (!myUid) {
      Alert.alert('Not signed in', 'Please sign in again to like posts.');
      return;
    }
    if ((force && liked) || liking.current) return;
    liking.current = true;
    const was = liked;
    const wasCount = likeCount;
    const wasDisliked = disliked;
    const wasDislikeCount = dislikeCount;
    const clearDislike = !was && wasDisliked; // like XOR dislike
    setLiked(!was);
    setLikeCount(Math.max(0, wasCount + (was ? -1 : 1)));
    if (clearDislike) {
      setDisliked(false);
      setDislikeCount(Math.max(0, wasDislikeCount - 1));
    }
    try {
      let nowLiked: boolean;
      if (post.kind === 'post') {
        const r = await toggleLike(post.id, myUid, clearDislike, { name: me?.name, avatar: me?.avatarUrl });
        setLiked(r.liked);
        setLikeCount(r.likeCount);
        nowLiked = r.liked;
      } else {
        nowLiked = await toggleWardrobeLike(post.id, myUid, was, clearDislike);
        setLiked(nowLiked);
      }
      if (nowLiked) notifyOwner('like');
    } catch (e: any) {
      setLiked(was);
      setLikeCount(wasCount);
      setDisliked(wasDisliked);
      setDislikeCount(wasDislikeCount);
      Alert.alert('Like failed', e?.message || 'Please try again.');
    } finally {
      liking.current = false;
    }
  };

  const dislike = async () => {
    if (!myUid) {
      Alert.alert('Not signed in', 'Please sign in again to react to posts.');
      return;
    }
    if (liking.current) return;
    liking.current = true;
    const was = disliked;
    const wasCount = dislikeCount;
    const wasLiked = liked;
    const wasLikeCount = likeCount;
    setDisliked(!was);
    setDislikeCount(Math.max(0, wasCount + (was ? -1 : 1)));
    if (!was && wasLiked) {
      setLiked(false);
      setLikeCount(Math.max(0, wasLikeCount - 1));
    }
    try {
      const r = await toggleDislike(post.kind, post.id, myUid, was, wasLiked);
      if (r.disliked) notifyOwner('dislike');
      setDisliked(r.disliked);
      setLiked(r.liked);
      if (typeof r.likeCount === 'number') setLikeCount(r.likeCount);
    } catch (e: any) {
      setDisliked(was);
      setDislikeCount(wasCount);
      setLiked(wasLiked);
      setLikeCount(wasLikeCount);
      Alert.alert('Not saved', e?.message || 'Please try again.');
    } finally {
      liking.current = false;
    }
  };

  const toggleFollow = async () => {
    if (!canFollow || !myUid || followBusy) return;
    setFollowBusy(true);
    const was = following;
    setFollowing(!was);
    try {
      if (was) await unfollow(myUid, post.userId);
      else
        await follow(
          { uid: myUid, name: me?.name, avatar: me?.avatarUrl },
          { uid: post.userId, name: post.userName, avatar: post.userAvatar },
        );
    } catch (e: any) {
      setFollowing(was);
      Alert.alert(was ? 'Unfollow failed' : 'Follow failed', e?.message || 'Please try again.');
    } finally {
      setFollowBusy(false);
    }
  };

  // App link with my referral code + a short line about this post
  const share = () => {
    const who = isMine ? 'my' : `${post.userName}'s`;
    const what = post.kind === 'wardrobe' ? 'wardrobe pick' : multi ? 'outfit vote (help pick one!)' : 'look';
    const cap = post.caption.trim();
    const line = `Check out ${who} ${what} on Outfit${cap ? `: "${cap.length > 80 ? `${cap.slice(0, 77)}...` : cap}"` : ''}`;
    shareWithReferral(myUid, line);
  };

  const onImagePress = (index: number = 0) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      if (openTimer.current) clearTimeout(openTimer.current);
      openTimer.current = null;
      heart.setValue(0);
      Animated.sequence([
        Animated.spring(heart, { toValue: 1, useNativeDriver: true, friction: 4 }),
        Animated.timing(heart, { toValue: 0, duration: 250, delay: 300, useNativeDriver: true }),
      ]).start();
      if (!liked) like(true);
    } else {
      lastTap.current = now;
      if (onOpenPhoto) {
        if (openTimer.current) clearTimeout(openTimer.current);
        openTimer.current = setTimeout(() => {
          openTimer.current = null;
          if (lastTap.current === now) {
            lastTap.current = 0;
            onOpenPhoto(shownPhotos.length ? shownPhotos : [post.imageData], index);
          }
        }, 310);
      } else if (!detail) {
        // Single tap in a list: open the full-size photo (after the double-tap window)
        if (openTimer.current) clearTimeout(openTimer.current);
        openTimer.current = setTimeout(() => {
          openTimer.current = null;
          navigation.navigate('PostDetail', { kind: post.kind, id: post.id });
        }, 300);
      }
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
    <Pressable key={i} onPress={() => onImagePress(i)}>
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
            <NameWithAge style={styles.postName} numberOfLines={1} uid={post.userId} name={post.userName} age={(post as any).userAge} />
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
            {shownPhotos.map(photo)}
          </ScrollView>
        ) : (
          photo(shownPhotos[0] || post.imageData, 0)
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
        {isMine ? (
          // My photo: 👍 likes, the count opens "Liked by"
          <View style={[styles.pill, liked && styles.pillOn]}>
            <TouchableOpacity
              onPress={() => like()}
              accessibilityLabel="Like"
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 2 }}>
              <Text style={[styles.pillIcon, liked && styles.pillIconOn]}>👍</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openLikedBy}
              accessibilityLabel={`Liked by ${likeCount}`}
              hitSlop={{ top: 6, bottom: 6, left: 2, right: 4 }}>
              <Text style={[styles.pillCount, styles.pillCountLink, liked && styles.pillCountOn]}>{likeCount}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.pill, liked && styles.pillOn]}
            onPress={() => like()}
            accessibilityLabel={`Like, ${likeCount}`}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
            <Text style={[styles.pillIcon, liked && styles.pillIconOn]}>👍</Text>
            <Text style={[styles.pillCount, liked && styles.pillCountOn]}>{likeCount}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.pill, disliked && styles.pillOn]}
          onPress={dislike}
          accessibilityLabel={`Dislike, ${dislikeCount}`}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
          <Text style={[styles.pillIcon, disliked && styles.pillIconOn]}>👎</Text>
          <Text style={[styles.pillCount, disliked && styles.pillCountOn]}>{dislikeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.pill}
          onPress={openComments}
          accessibilityLabel={`Comments, ${commentCount}`}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
          <Text style={[styles.pillIcon, styles.pillIconOn]}>💬</Text>
          <Text style={styles.pillCount}>{commentCount}</Text>
        </TouchableOpacity>
        <View style={styles.spacer} />
        {canFollow ? (
          <TouchableOpacity
            style={[styles.followBtn, following && styles.followBtnOn]}
            onPress={toggleFollow}
            disabled={followBusy}
            activeOpacity={0.8}>
            <Text style={[styles.followText, following && styles.followTextOn]}>
              {following ? 'Following ✓' : 'Follow'}
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={share}
          accessibilityLabel="Share"
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
          <Text style={styles.shareText}>↗ Share</Text>
        </TouchableOpacity>
      </View>
      {post.caption ? (
        <Text style={styles.caption}>
          <NameWithAge style={styles.captionName} onPress={openProfile} uid={post.userId} name={post.userName} age={(post as any).userAge} />
          {' '}
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: borderRadius.full,
    backgroundColor: colors.divider,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginRight: 6,
  },
  pillOn: { borderColor: colors.accent },
  pillIcon: { fontSize: 16, opacity: 0.6 },
  pillIconOn: { opacity: 1 },
  pillCount: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textSecondary, marginLeft: 4 },
  pillCountOn: { color: colors.accent },
  pillCountLink: { textDecorationLine: 'underline', paddingHorizontal: 2 },
  spacer: { flex: 1 },
  followBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginRight: 6,
  },
  followBtnOn: { backgroundColor: colors.surface, borderColor: colors.border },
  followText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.onPrimary },
  followTextOn: { color: colors.textPrimary },
  shareBtn: { paddingVertical: 5, paddingHorizontal: 4 },
  shareText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  viewComments: { fontSize: fontSize.sm, color: colors.textMuted, paddingHorizontal: spacing.md, paddingTop: 4 },
  caption: { fontSize: fontSize.sm, color: colors.textPrimary, paddingHorizontal: spacing.md, paddingTop: 4, lineHeight: 19 },
  captionName: { fontWeight: fontWeight.bold },
}));
