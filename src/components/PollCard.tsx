// Photo poll in a circle chat: live vote counts, the user's choice highlighted.
// Tap a photo to open it in the zoom viewer (swipe between options); tap the bar under it to vote or change.
import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import { ChatMessage, POLL_LETTERS, PollTally, castPollVote, subscribePollVotes } from '../services/circlesApi';

interface Props {
  circleId: string;
  message: ChatMessage;
  myUid?: string;
  canVote: boolean; // false for admins reading a circle they are not in
  onLongPress?: () => void;
  onOpenImage?: (uri: string) => void;
  // Opens all option photos in the zoom viewer at `index` (preferred over onOpenImage)
  onOpenImages?: (uris: string[], index: number, labels: string[]) => void;
}

export default function PollCard({ circleId, message, myUid, canVote, onLongPress, onOpenImage, onOpenImages }: Props) {
  const options = message.poll?.options || [];
  const [tally, setTally] = useState<PollTally>({
    counts: new Array(options.length).fill(0),
    total: 0,
    myVote: null,
  });
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    const unsub = subscribePollVotes(circleId, message.id, options.length, myUid, setTally);
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [circleId, message.id, options.length, myUid]);

  const vote = async (index: number) => {
    if (!canVote || !myUid) return;
    if (tally.myVote === index || pending !== null) return;
    setPending(index);
    try {
      await castPollVote(circleId, message.id, myUid, index);
    } catch (e: any) {
      Alert.alert('Vote failed', e?.message || 'Please try again.');
    } finally {
      setPending(null);
    }
  };

  if (!message.poll) return null;

  const labelOf = (i: number) => {
    const o = options[i];
    return !o?.label || o.label === POLL_LETTERS[i] ? POLL_LETTERS[i] : `${POLL_LETTERS[i]} · ${o.label}`;
  };
  const openPhoto = (i: number) => {
    if (onOpenImages) {
      const withImg = options.map((o, j) => ({ uri: o.imageData, j })).filter(x => !!x.uri);
      const at = Math.max(0, withImg.findIndex(x => x.j === i));
      onOpenImages(
        withImg.map(x => x.uri),
        at,
        withImg.map(x => labelOf(x.j)),
      );
    } else if (options[i]?.imageData) {
      onOpenImage?.(options[i].imageData);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.question}>
        {message.poll.kind === 'wear' ? '👗 ' : '🛍️ '}
        {message.poll.question}
      </Text>
      <View style={styles.grid}>
        {options.map((o, i) => {
          const count = tally.counts[i] || 0;
          const pct = tally.total ? Math.round((count / tally.total) * 100) : 0;
          const mine = tally.myVote === i;
          const leading = tally.total > 0 && count === Math.max(...tally.counts);
          return (
            <View key={i} style={[styles.option, mine && styles.optionMine]}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openPhoto(i)}
                onLongPress={onLongPress}
                delayLongPress={350}
                accessibilityLabel={`View photo ${POLL_LETTERS[i]}`}>
                {o.imageData ? (
                  <Image source={{ uri: o.imageData }} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={[styles.image, styles.noImage]} />
                )}
                {pending === i && (
                  <View style={styles.pendingOverlay}>
                    <ActivityIndicator color={colors.textInverse} />
                  </View>
                )}
                {mine && (
                  <View style={styles.check}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                )}
                <View style={styles.zoomBadge}>
                  <Text style={styles.zoomText}>⤢</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.optionFooter}
                activeOpacity={0.7}
                disabled={!canVote}
                onPress={() => vote(i)}
                onLongPress={onLongPress}
                delayLongPress={350}
                accessibilityLabel={`Vote for ${POLL_LETTERS[i]}`}>
                <View style={styles.labelRow}>
                  <Text style={styles.optionLabel} numberOfLines={1}>
                    {labelOf(i)}
                  </Text>
                  {canVote ? (
                    <Text style={[styles.votePill, mine && styles.votePillMine]}>{mine ? 'Voted' : 'Vote'}</Text>
                  ) : null}
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${pct}%` },
                      leading && styles.barLeading,
                      mine && styles.barMine,
                    ]}
                  />
                </View>
                <Text style={styles.optionStats}>
                  {pct}% · {count} {count === 1 ? 'vote' : 'votes'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
      <Text style={styles.footer}>
        {tally.total} {tally.total === 1 ? 'vote' : 'votes'}
        {canVote
          ? tally.myVote !== null
            ? ' · tap Vote under another photo to change'
            : ' · tap Vote under a photo · tap a photo to zoom'
          : ''}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: { width: 260 },
  question: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  option: {
    width: '48.5%',
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  optionMine: { borderColor: colors.accent },
  image: { width: '100%', aspectRatio: 0.8 },
  noImage: { backgroundColor: colors.divider },
  pendingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    aspectRatio: 0.8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: colors.textInverse, fontWeight: fontWeight.extraBold, fontSize: 13 },
  optionFooter: { padding: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  votePill: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
    overflow: 'hidden',
  },
  votePillMine: { color: colors.textInverse, backgroundColor: colors.accent },
  zoomBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  optionLabel: { flexShrink: 1, fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textPrimary },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.divider, marginTop: 4, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.accentLight },
  barLeading: { backgroundColor: colors.primaryLight },
  barMine: { backgroundColor: colors.accent },
  optionStats: { fontSize: 10, color: colors.textSecondary, marginTop: 3 },
  footer: { fontSize: fontSize.xs, color: colors.textSecondary },
}));
