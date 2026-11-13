// Pick photos from my wardrobe (wardrobeApi) for a poll: tap to select, in order (A, B, C ...).
// Photos already in Firestore are reused as they are (base64 data URIs); ones too large for a
// poll message are shown but can't be picked.
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import { getWardrobeFullImage, getWardrobeItems, WardrobeItemResponse } from '../services/wardrobeApi';
import { canResize, resizeImage } from '../utils/imageResize';
import { POLL_SPEC, specChars } from '../utils/imageSpecs';
import { POLL_LETTERS } from '../services/circlesApi';
import { useBottomSpace } from '../hooks/useBottomSpace';

interface Props {
  visible: boolean;
  userId?: string;
  max: number; // how many can still be added
  startIndex?: number; // letters continue after the photos already in the poll
  maxChars: number; // per-photo size limit (data URI length)
  onClose: () => void;
  onDone: (images: string[]) => void;
}

export default function WardrobePickerModal({
  visible,
  userId,
  max,
  startIndex = 0,
  maxChars,
  onClose,
  onDone,
}: Props) {
  const bottomPad = useBottomSpace(16);
  const [items, setItems] = useState<WardrobeItemResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]); // item ids, in order

  useEffect(() => {
    if (!visible) return;
    setPicked([]);
    if (!userId) {
      setError('Please sign in again.');
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    getWardrobeItems(userId)
      .then(list => {
        if (alive) setItems(list.filter(i => !!i.imageUrl));
      })
      .catch(e => {
        if (alive) setError(e?.message || 'Could not load your wardrobe.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [visible, userId]);

  const tooBig = (i: WardrobeItemResponse) => (i.imageUrl || '').length > maxChars;

  const toggle = (i: WardrobeItemResponse) => {
    if (tooBig(i)) return;
    setPicked(prev =>
      prev.includes(i.id) ? prev.filter(x => x !== i.id) : prev.length >= max ? prev : [...prev, i.id],
    );
  };

  // Items keep a small thumbnail; the poll gets the full photo (1 read each). Full photos are up to
  // 1600 px / 160 KB now, so for a 2-6 photo poll (one Firestore doc, 1 MiB) or a smaller limit they
  // are re-made at the poll size (1080 px, <= 80 KB) on the phone. The thumbnail is the last resort.
  const done = async () => {
    const byId = new Map(items.map(i => [i.id, i]));
    const chosen = picked.map(id => byId.get(id)).filter((i): i is WardrobeItemResponse => !!i);
    onClose();
    const images = await Promise.all(
      chosen.map(async i => {
        const full = await getWardrobeFullImage(i);
        const limit = chosen.length > 1 ? Math.min(maxChars, specChars(POLL_SPEC)) : maxChars;
        // Full copy on another storage provider (https URL): polls need inline photos -> thumbnail
        if (full && !/^data:/.test(full)) return i.imageUrl || '';
        if (full && full.length <= limit) return full;
        if (full && canResize()) {
          try {
            const small = await resizeImage(full, POLL_SPEC);
            if (small.length <= limit) return small;
          } catch {}
        }
        return i.imageUrl || '';
      }),
    );
    const ok = images.filter(Boolean);
    if (ok.length) onDone(ok);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { paddingBottom: bottomPad }]}>
          <View style={styles.head}>
            <Text style={styles.title}>From Wardrobe</Text>
            <Text style={styles.count}>
              {picked.length}/{max}
            </Text>
          </View>
          <Text style={styles.hint}>Tap photos in the order you want them (A-F).</Text>
          {loading ? (
            <ActivityIndicator style={styles.spinner} color={colors.primary} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={i => i.id}
              numColumns={3}
              style={styles.list}
              columnWrapperStyle={styles.columns}
              ListEmptyComponent={
                <Text style={styles.empty}>No wardrobe photos yet. Add clothes in the Wardrobe tab first.</Text>
              }
              renderItem={({ item }) => {
                const n = picked.indexOf(item.id);
                const big = tooBig(item);
                return (
                  <TouchableOpacity
                    style={[styles.cell, n >= 0 && styles.cellOn, big && styles.cellOff]}
                    activeOpacity={0.8}
                    disabled={big}
                    onPress={() => toggle(item)}>
                    <Image source={{ uri: item.imageUrl || '' }} style={styles.image} resizeMode="cover" />
                    {n >= 0 ? (
                      <View style={styles.letter}>
                        <Text style={styles.letterText}>{POLL_LETTERS[startIndex + n] || '✓'}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.name} numberOfLines={1}>
                      {big ? 'Too large for a poll' : item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.doneBtn, !picked.length && styles.disabled]}
              disabled={!picked.length}
              onPress={done}>
              <Text style={styles.doneText}>Add {picked.length || ''}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: '88%',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  count: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.semiBold },
  hint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.sm },
  spinner: { marginVertical: spacing.xl },
  error: { color: colors.error, marginVertical: spacing.md },
  empty: { color: colors.textSecondary, textAlign: 'center', marginVertical: spacing.xl },
  list: { flexGrow: 0 },
  columns: { gap: spacing.sm },
  cell: {
    width: '31.5%',
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.background,
  },
  cellOn: { borderColor: colors.primary },
  cellOff: { opacity: 0.4 },
  image: { width: '100%', aspectRatio: 0.8 },
  letter: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: { color: colors.onPrimary, fontWeight: fontWeight.extraBold, fontSize: 11 },
  name: { fontSize: fontSize.xs, color: colors.textSecondary, paddingHorizontal: 4, paddingVertical: 3 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.textSecondary, fontWeight: fontWeight.bold },
  doneBtn: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { color: colors.textInverse, fontWeight: fontWeight.bold },
  disabled: { opacity: 0.5 },
}));
