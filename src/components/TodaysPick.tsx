// "Today's pick" on a profile: the wardrobe item with the most "Wear today" votes today, then the
// rest of today's ranking. Replaces the old Posts tab on Me / profiles. Resets at local midnight.
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import { Post } from '../services/feedApi';
import { WearVotes } from '../hooks/useWearVotes';
import FullScreenImageViewer, { ViewerVoteBar } from './FullScreenImageViewer';

interface Props {
  items: Post[]; // kind 'wardrobe'
  ownerName?: string;
  isOwner: boolean;
  wear: WearVotes;
  onOpenWardrobe?: () => void; // jump to the Wardrobe tab to vote
}

export default function TodaysPick({ items, ownerName, isOwner, wear, onOpenWardrobe }: Props) {
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const { tally } = wear;
  // Ranked by votes today (newest first on ties); only items still visible here
  const ranked = items
    .map((p, i) => ({ p, i, n: tally.counts[p.id] || 0 }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i);
  const name = (p: Post) => p.caption.replace(/^👗\s*/, '') || 'Item';
  const who = isOwner ? 'you' : ownerName || 'they';

  if (!ranked.length) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyEmoji}>👕</Text>
        <Text style={styles.emptyTitle}>No votes yet today</Text>
        <Text style={styles.emptyText}>
          {isOwner
            ? 'When friends open your profile they can vote which of your clothes you should wear today. The winner shows here.'
            : `Vote on ${ownerName || 'their'}'s wardrobe to pick what ${who} should wear today.`}
        </Text>
        {onOpenWardrobe ? (
          <TouchableOpacity style={styles.cta} onPress={onOpenWardrobe}>
            <Text style={styles.ctaText}>{isOwner ? 'See my wardrobe' : 'Vote now'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const [first, ...rest] = ranked;
  const tie = rest.length > 0 && rest[0].n === first.n;
  const pct = (n: number) => Math.round((n / Math.max(1, tally.total)) * 100);
  const viewerPhotos = ranked.map(x => ({ uri: x.p.imageData, label: name(x.p) }));

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>
        ⭐ {tie ? "Today's pick (tied)" : "Today's pick"} · {tally.total} {tally.total === 1 ? 'vote' : 'votes'}
      </Text>
      <TouchableOpacity style={styles.hero} activeOpacity={0.9} onPress={() => setViewIndex(0)}>
        <Image source={{ uri: first.p.imageData }} style={styles.heroImage} resizeMode="cover" />
        <View style={styles.heroFooter}>
          <Text style={styles.heroName} numberOfLines={1}>
            {name(first.p)}
          </Text>
          <Text style={styles.heroVotes}>
            {first.n} {first.n === 1 ? 'vote' : 'votes'} · {pct(first.n)}%
            {tally.myItemId === first.p.id ? ' · your pick' : ''}
          </Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.sub}>
        {isOwner ? 'Your friends say: wear this today!' : `Friends say ${ownerName || 'they'} should wear this today.`}
      </Text>

      {rest.map((x, k) => (
        <TouchableOpacity key={x.p.id} style={styles.row} activeOpacity={0.8} onPress={() => setViewIndex(k + 1)}>
          <Image source={{ uri: x.p.imageData }} style={styles.thumb} resizeMode="cover" />
          <View style={styles.rowMid}>
            <Text style={styles.rowName} numberOfLines={1}>
              {name(x.p)}
              {tally.myItemId === x.p.id ? ' · your pick' : ''}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct(x.n)}%` }]} />
            </View>
          </View>
          <Text style={styles.rowVotes}>{x.n}</Text>
        </TouchableOpacity>
      ))}

      {wear.canVote && onOpenWardrobe ? (
        <TouchableOpacity style={styles.cta} onPress={onOpenWardrobe}>
          <Text style={styles.ctaText}>{tally.myItemId ? 'Change my vote' : 'Vote now'}</Text>
        </TouchableOpacity>
      ) : null}

      <FullScreenImageViewer
        visible={viewIndex !== null}
        photos={viewerPhotos}
        index={viewIndex ?? 0}
        onClose={() => setViewIndex(null)}
        renderFooter={i => {
          const x = ranked[i];
          if (!x) return null;
          const mine = tally.myItemId === x.p.id;
          return (
            <ViewerVoteBar
              label={wear.canVote ? (mine ? '✓ Your pick for today' : '👕 Wear today') : `👕 ${x.n} today`}
              info={`${x.n} ${x.n === 1 ? 'vote' : 'votes'} · ${pct(x.n)}%`}
              active={mine}
              busy={wear.busyItem === x.p.id}
              onPress={wear.canVote ? () => wear.vote(x.p.id) : undefined}
            />
          );
        }}
      />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { padding: spacing.base },
  heading: { fontSize: fontSize.md, fontWeight: fontWeight.extraBold, color: colors.textPrimary, marginBottom: spacing.sm },
  hero: { borderRadius: borderRadius.lg, overflow: 'hidden', backgroundColor: colors.divider },
  heroImage: { width: '100%', aspectRatio: 1 },
  heroFooter: { padding: spacing.md, backgroundColor: colors.surfaceElevated },
  heroName: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  heroVotes: { fontSize: fontSize.sm, color: colors.accent, fontWeight: fontWeight.semiBold, marginTop: 2 },
  sub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  thumb: { width: 48, height: 48, borderRadius: borderRadius.sm, backgroundColor: colors.divider },
  rowMid: { flex: 1, marginHorizontal: spacing.md },
  rowName: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: fontWeight.semiBold },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.divider, marginTop: 5, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  rowVotes: { fontSize: fontSize.base, fontWeight: fontWeight.extraBold, color: colors.textPrimary, minWidth: 24, textAlign: 'right' },
  emptyBox: { alignItems: 'center', padding: spacing.xxl },
  emptyEmoji: { fontSize: 42 },
  emptyTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary, marginTop: spacing.sm },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, lineHeight: 19 },
  cta: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    height: 42,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  ctaText: { color: colors.onPrimary, fontWeight: fontWeight.bold },
}));
