// Like / dislike / comments row under a circle photo or A-F post
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { colors, fontSize, fontWeight, spacing, themedStyles } from '../theme';
import {
  Reaction,
  ReactionTally,
  countTargetComments,
  setReaction,
  subscribeReactions,
} from '../services/engagementApi';

interface Props {
  circleId: string;
  messageId: string;
  myUid?: string;
  canReact: boolean;
  onOpenComments: () => void;
}

export default function ReactionBar({ circleId, messageId, myUid, canReact, onOpenComments }: Props) {
  const [tally, setTally] = useState<ReactionTally>({ likes: 0, dislikes: 0, mine: null });
  const [comments, setComments] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = subscribeReactions(circleId, messageId, myUid, setTally);
    countTargetComments({ kind: 'circle', circleId, id: messageId }).then(setComments);
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [circleId, messageId, myUid]);

  const react = async (type: Reaction) => {
    if (!canReact || !myUid || busy) return;
    setBusy(true);
    try {
      await setReaction(circleId, messageId, myUid, type, tally.mine);
    } catch (e: any) {
      Alert.alert('Not saved', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.btn} onPress={() => react('like')} disabled={!canReact}>
        <Text style={[styles.icon, tally.mine === 'like' && styles.on]}>👍</Text>
        <Text style={[styles.count, tally.mine === 'like' && styles.onText]}>{tally.likes}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={() => react('dislike')} disabled={!canReact}>
        <Text style={[styles.icon, tally.mine === 'dislike' && styles.on]}>👎</Text>
        <Text style={[styles.count, tally.mine === 'dislike' && styles.onText]}>{tally.dislikes}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={onOpenComments}>
        <Text style={styles.icon}>💬</Text>
        <Text style={styles.count}>{comments}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: colors.divider,
  },
  icon: { fontSize: 14, opacity: 0.6 },
  on: { opacity: 1 },
  count: { fontSize: fontSize.xs, color: colors.textSecondary, marginLeft: 4, fontWeight: fontWeight.bold },
  onText: { color: colors.primary },
}));
