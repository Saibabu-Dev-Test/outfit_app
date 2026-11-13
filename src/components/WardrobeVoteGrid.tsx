// A profile's wardrobe as a 2-column grid. Visitors vote "Wear today" (one pick per day for this
// person, tap again to take it back) and like items; the owner sees today's tally and like counts.
// Tap a photo for full screen (swipe through the wardrobe, pinch-zoom, vote / like there).
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getWardrobeStats, Post, toggleWardrobeLike } from '../services/feedApi';
import { logActivity } from '../services/activityApi';
import { topWearItem } from '../services/wearVotesApi';
import { WearVotes } from '../hooks/useWearVotes';
import FullScreenImageViewer, { ViewerVoteBar } from './FullScreenImageViewer';
import LikersSheet from './LikersSheet';

interface Props {
  items: Post[]; // kind 'wardrobe'
  ownerId: string;
  ownerName?: string;
  isOwner: boolean;
  wear: WearVotes;
  privateIds?: Set<string>; // owner's items that aren't public (others can't see or vote on them)
  empty?: string;
}

interface LikeState {
  count: number;
  liked: boolean;
}

export default function WardrobeVoteGrid({ items, ownerId, ownerName, isOwner, wear, privateIds, empty }: Props) {
  const navigation = useNavigation<any>();
  const { user: me } = useAuth();
  const myUid = me?.id;
  const [likes, setLikes] = useState<Record<string, LikeState>>({});
  const [liking, setLiking] = useState<string | null>(null);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [likersFor, setLikersFor] = useState<string | null>(null);

  const ids = useMemo(() => items.map(i => i.id), [items]);
  const idsKey = ids.join(',');

  // Like counts + my likes (count queries, never throw)
  useEffect(() => {
    let alive = true;
    Promise.all(ids.map(id => getWardrobeStats(id, myUid).then(r => [id, r] as const))).then(rows => {
      if (!alive) return;
      const next: Record<string, LikeState> = {};
      rows.forEach(([id, r]) => {
        next[id] = { count: r.likeCount, liked: r.liked };
      });
      setLikes(next);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, myUid]);

  const like = async (p: Post) => {
    if (!myUid) {
      Alert.alert('Not signed in', 'Please sign in again to like clothes.');
      return;
    }
    if (liking) return;
    const was = likes[p.id] || { count: 0, liked: false };
    setLiking(p.id);
    setLikes(prev => ({ ...prev, [p.id]: { liked: !was.liked, count: Math.max(0, was.count + (was.liked ? -1 : 1)) } }));
    try {
      // Liking also clears my dislike (like XOR dislike, same as the feed)
      const nowLiked = await toggleWardrobeLike(p.id, myUid, was.liked, true);
      if (nowLiked && myUid !== ownerId) {
        logActivity(ownerId, { uid: myUid, name: me?.name, avatar: me?.avatarUrl }, 'like', {
          kind: 'wardrobe',
          id: p.id,
          thumbnail: p.imageData,
        });
      }
    } catch (e: any) {
      setLikes(prev => ({ ...prev, [p.id]: was }));
      Alert.alert('Like failed', e?.message || 'Please try again.');
    } finally {
      setLiking(null);
    }
  };

  const openComments = (p: Post) => navigation.navigate('PostDetail', { kind: 'wardrobe', id: p.id });

  if (!items.length) return <Text style={styles.empty}>{empty || 'No wardrobe items yet.'}</Text>;

  const top = wear.tally.total ? topWearItem(wear.tally, ids) : null;
  const name = (p: Post) => p.caption.replace(/^👗\s*/, '') || 'Item';
  const votesText = (n: number) => `${n} ${n === 1 ? 'vote' : 'votes'} today`;

  const viewerFooter = (i: number) => {
    const p = items[i];
    if (!p) return null;
    const n = wear.tally.counts[p.id] || 0;
    const mine = wear.tally.myItemId === p.id;
    const l = likes[p.id];
    const info = `${votesText(n)} · ♥ ${l?.count ?? 0}${l?.liked ? ' (you)' : ''}`;
    if (!wear.canVote || privateIds?.has(p.id)) {
      return <ViewerVoteBar label={isOwner ? `👕 ${votesText(n)}` : name(p)} info={`♥ ${l?.count ?? 0} likes`} />;
    }
    return (
      <ViewerVoteBar
        label={mine ? '✓ Your pick for today' : '👕 Wear today'}
        info={info}
        active={mine}
        busy={wear.busyItem === p.id}
        onPress={() => wear.vote(p.id)}
      />
    );
  };

  return (
    <View>
      <Text style={styles.intro}>
        {isOwner
          ? wear.tally.total
            ? `👕 ${wear.tally.total} ${wear.tally.total === 1 ? 'friend' : 'friends'} picked what you should wear today`
            : '👕 Friends who open your profile can vote what you wear today'
          : wear.tally.myItemId
          ? `✓ You picked what ${ownerName || 'they'} should wear today · tap again to take it back`
          : `👕 Pick what ${ownerName || 'they'} should wear today (1 vote a day)`}
      </Text>
      {wear.error ? <Text style={styles.error}>{wear.error}</Text> : null}
      <View style={styles.grid}>
        {items.map((p, i) => {
          const n = wear.tally.counts[p.id] || 0;
          const mine = wear.tally.myItemId === p.id;
          const l = likes[p.id];
          const isPrivate = !!privateIds?.has(p.id);
          return (
            <View key={p.id} style={[styles.tile, mine && styles.tileMine]}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setViewIndex(i)} accessibilityLabel={`Open ${name(p)} full screen`}>
                <Image source={{ uri: p.imageData }} style={styles.image} resizeMode="cover" />
                {top === p.id ? (
                  <View style={styles.topBadge}>
                    <Text style={styles.topBadgeText}>⭐ Today's pick</Text>
                  </View>
                ) : null}
                {isPrivate ? (
                  <View style={styles.lock}>
                    <Text style={styles.lockText}>🔒</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
              <Text style={styles.name} numberOfLines={1}>
                {name(p)}
              </Text>
              <View style={styles.row}>
                {wear.canVote && !isPrivate ? (
                  <TouchableOpacity
                    style={[styles.wearBtn, mine && styles.wearBtnOn]}
                    onPress={() => wear.vote(p.id)}
                    disabled={!!wear.busyItem}
                    accessibilityLabel={mine ? 'Take back my wear-today vote' : 'Vote wear today'}>
                    {wear.busyItem === p.id ? (
                      <ActivityIndicator size="small" color={mine ? colors.onPrimary : colors.primary} />
                    ) : (
                      <Text style={[styles.wearText, mine && styles.wearTextOn]} numberOfLines={1}>
                        {mine ? '✓ Wear' : '👕 Wear'} · {n}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.tallyText} numberOfLines={1}>
                    {isPrivate ? 'Only you' : `👕 ${n} today`}
                  </Text>
                )}
                <View style={styles.likeWrap}>
                  <TouchableOpacity
                    style={styles.heartBtn}
                    onPress={() => like(p)}
                    onLongPress={() => setLikersFor(p.id)}
                    disabled={liking === p.id}
                    accessibilityLabel={l?.liked ? 'Unlike' : 'Like'}
                    accessibilityHint="Long-press to see who liked">
                    <Text style={[styles.likeText, l?.liked && styles.likeTextOn]}>{l?.liked ? '♥' : '♡'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.countBtn}
                    onPress={() => setLikersFor(p.id)}
                    accessibilityLabel={`Liked by ${l?.count ?? 0}. See who liked`}>
                    <Text style={[styles.likeText, l?.liked && styles.likeTextOn]}>{l?.count ?? 0}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={() => openComments(p)} accessibilityLabel="Comments">
                  <Text style={styles.likeText}>💬</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
      <FullScreenImageViewer
        visible={viewIndex !== null}
        photos={items.map(p => ({ uri: p.imageData, label: name(p) }))}
        index={viewIndex ?? 0}
        onClose={() => setViewIndex(null)}
        renderFooter={viewerFooter}
      />
      <LikersSheet
        visible={!!likersFor}
        kind="wardrobe"
        id={likersFor}
        count={likersFor ? likes[likersFor]?.count : undefined}
        onClose={() => setLikersFor(null)}
      />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  intro: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: spacing.base, paddingVertical: spacing.sm },
  error: { color: colors.error, fontSize: fontSize.xs, paddingHorizontal: spacing.base },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
  tile: {
    width: '49%',
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  tileMine: { borderColor: colors.accent },
  image: { width: '100%', aspectRatio: 0.85, backgroundColor: colors.divider },
  topBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  topBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: fontWeight.extraBold },
  lock: { position: 'absolute', top: 6, right: 6 },
  lockText: { fontSize: 14 },
  name: { fontSize: fontSize.sm, fontWeight: fontWeight.semiBold, color: colors.textPrimary, paddingHorizontal: 8, paddingTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 6 },
  wearBtn: {
    flex: 1,
    height: 30,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  wearBtnOn: { backgroundColor: colors.primary },
  wearText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.primary },
  wearTextOn: { color: colors.onPrimary },
  tallyText: { flex: 1, fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: fontWeight.semiBold, paddingLeft: 2 },
  iconBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  likeWrap: { flexDirection: 'row', alignItems: 'center' },
  heartBtn: { paddingLeft: 6, paddingRight: 2, paddingVertical: 4 },
  countBtn: { paddingLeft: 2, paddingRight: 6, paddingVertical: 4 },
  likeText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.bold },
  likeTextOn: { color: colors.pink },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl, fontSize: fontSize.sm },
}));
