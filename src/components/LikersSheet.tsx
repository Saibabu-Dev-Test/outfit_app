// "Liked by" bottom sheet (TikTok style), open to every user: tap a like count or long-press the
// heart. Lists likers newest first with avatar and "Name (age)"; tap a row to open their profile.
// Pages of 30 (services/activityApi.getLikersPage) so a popular photo stays cheap to open.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { colors, fontSize, fontWeight, spacing, themedStyles } from '../theme';
import Avatar from './Avatar';
import NameWithAge from './NameWithAge';
import { getLikersPage, Liker } from '../services/activityApi';
import type { FeedKind } from '../services/feedApi';
import { timeAgo } from '../utils/date';
import { useBottomSpace } from '../hooks/useBottomSpace';

interface Props {
  visible: boolean;
  kind: FeedKind;
  id: string | null;
  count?: number; // known like count for the title
  onClose: () => void;
}

export default function LikersSheet({ visible, kind, id, count, onClose }: Props) {
  const bottomPad = useBottomSpace(12);
  const navigation = useNavigation<any>();
  const [list, setList] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursor = useRef<QueryDocumentSnapshot | null>(null);
  const busy = useRef(false);
  const openId = useRef<string | null>(null);

  const loadMore = useCallback(async () => {
    if (!id || busy.current || done) return;
    busy.current = true;
    setLoading(true);
    const forId = id;
    try {
      const page = await getLikersPage(kind, id, cursor.current);
      if (openId.current !== forId) return;
      cursor.current = page.cursor;
      setList(prev => {
        const seen = new Set(prev.map(x => x.uid));
        return prev.concat(page.likers.filter(x => !seen.has(x.uid)));
      });
      setDone(page.done);
    } catch (e: any) {
      if (openId.current === forId) setError(e?.message || 'Could not load likes.');
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [id, kind, done]);

  // Fresh list each time the sheet opens
  useEffect(() => {
    if (!visible || !id) return;
    openId.current = id;
    cursor.current = null;
    busy.current = false;
    setList([]);
    setDone(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, id, kind]);
  useEffect(() => {
    if (visible && id && !list.length && !done && !error) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, id, list.length, done, error]);

  const openProfile = (uid: string) => {
    onClose();
    setTimeout(() => navigation.push('UserProfile', { userId: uid }), 200);
  };

  const n = typeof count === 'number' ? count : list.length;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.card, { paddingBottom: bottomPad }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>♥ Liked by{n ? ` · ${n}` : ''}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <FlatList
            data={list}
            keyExtractor={x => x.uid}
            style={styles.list}
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (list.length) loadMore();
            }}
            ListEmptyComponent={loading || error ? undefined : <Text style={styles.empty}>No likes yet.</Text>}
            ListFooterComponent={loading ? <ActivityIndicator style={styles.spinner} color={colors.primary} /> : undefined}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => openProfile(item.uid)}>
                <Avatar uri={item.avatar} name={item.name} size={40} />
                <View style={styles.body}>
                  <NameWithAge uid={item.uid} name={item.name} style={styles.name} numberOfLines={1} />
                  {item.createdAt ? <Text style={styles.time}>{timeAgo(item.createdAt)}</Text> : null}
                </View>
                <Text style={styles.heart}>♥</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.base,
    maxHeight: '75%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.extraBold, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  body: { flex: 1, marginLeft: spacing.md },
  name: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  time: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  heart: { fontSize: 16, color: colors.pink },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingVertical: spacing.xl },
  error: { textAlign: 'center', color: colors.error, fontSize: fontSize.xs, marginBottom: spacing.sm },
  spinner: { marginVertical: spacing.md },
}));
