// "Take photo" for votes: shoot several photos in a row with the camera. After each shot the user
// picks "Take another" or "Done" (up to `max` photos, labelled A-F). Opens the camera straight away.
// Used by the circle chat attach sheet and the photo-poll editor.
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import { pickImage, POLL_PICK } from '../utils/imagePicker';
import { reviewPhoto } from './PhotoReviewHost';
import { POLL_LETTERS } from '../services/circlesApi';
import FullScreenImageViewer from './FullScreenImageViewer';
import { useBottomSpace } from '../hooks/useBottomSpace';

interface Props {
  visible: boolean;
  max: number; // photos that still fit (6 - photos already in the poll)
  startIndex?: number; // letter of the first new photo (A = 0)
  onClose: () => void;
  onDone: (images: string[]) => void;
}

export default function MultiShotModal({ visible, max, startIndex = 0, onClose, onDone }: Props) {
  const bottomPad = useBottomSpace(16);
  const [shots, setShots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const count = useRef(0);
  const room = Math.max(0, max);

  const shoot = async () => {
    if (count.current >= room) return;
    setBusy(true);
    try {
      const picked = await reviewPhoto(await pickImage('camera', POLL_PICK), POLL_PICK);
      if (picked) {
        count.current += 1;
        setShots(prev => (prev.length >= room ? prev : [...prev, picked.dataUri]));
      } else if (count.current === 0) {
        // Camera closed before the first photo: nothing to keep
        onClose();
      }
    } catch (e: any) {
      Alert.alert('Photo problem', e?.message || 'Could not take that photo.');
      if (count.current === 0) onClose();
    } finally {
      setBusy(false);
    }
  };

  // Open the camera as soon as the sheet shows
  useEffect(() => {
    if (!visible) return;
    setShots([]);
    count.current = 0;
    const t = setTimeout(shoot, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const remove = (i: number) => {
    setShots(prev => prev.filter((_, j) => j !== i));
    count.current = Math.max(0, count.current - 1);
  };

  const done = () => {
    const list = shots.slice(0, room);
    onClose();
    if (list.length) onDone(list);
  };

  const letter = (i: number) => POLL_LETTERS[startIndex + i] || '';
  const full = shots.length >= room;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={busy ? undefined : onClose} />
        <View style={[styles.card, { paddingBottom: bottomPad }]}>
          <Text style={styles.title}>
            📷 Take photos ({shots.length}/{room})
          </Text>
          <Text style={styles.hint}>
            Shoot each outfit, then tap Done. Up to {room} {room === 1 ? 'photo' : 'photos'}, labelled{' '}
            {letter(0)}
            {room > 1 ? `–${letter(room - 1)}` : ''}.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {shots.map((uri, i) => (
              <TouchableOpacity key={i} style={styles.shot} activeOpacity={0.85} onPress={() => setViewIndex(i)}>
                <Image source={{ uri }} style={styles.shotImage} resizeMode="cover" />
                <View style={styles.letter}>
                  <Text style={styles.letterText}>{letter(i)}</Text>
                </View>
                <TouchableOpacity style={styles.remove} onPress={() => remove(i)} accessibilityLabel={`Remove ${letter(i)}`}>
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            {busy ? (
              <View style={[styles.shot, styles.waiting]}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}
            {!shots.length && !busy ? <Text style={styles.empty}>No photos yet.</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.anotherBtn, (full || busy) && styles.disabled]}
              onPress={shoot}
              disabled={full || busy}>
              <Text style={styles.anotherText}>{full ? 'All set' : shots.length ? '📷 Take another' : '📷 Take photo'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.doneBtn, (!shots.length || busy) && styles.disabled]}
              onPress={done}
              disabled={!shots.length || busy}>
              <Text style={styles.doneText}>Done{shots.length ? ` (${shots.length})` : ''}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <FullScreenImageViewer
        visible={viewIndex !== null}
        photos={shots.map((uri, i) => ({ uri, label: letter(i) }))}
        index={viewIndex ?? 0}
        onClose={() => setViewIndex(null)}
      />
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
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  hint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md },
  strip: { alignItems: 'center', minHeight: 130 },
  shot: {
    width: 96,
    height: 120,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginRight: spacing.sm,
    backgroundColor: colors.background,
  },
  shotImage: { width: 96, height: 120 },
  waiting: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border },
  empty: { color: colors.textMuted, fontSize: fontSize.sm },
  letter: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: { color: colors.onPrimary, fontWeight: fontWeight.extraBold, fontSize: 11 },
  remove: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#FFFFFF', fontWeight: fontWeight.bold, fontSize: 11 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    height: 46,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.textSecondary, fontWeight: fontWeight.bold },
  anotherBtn: {
    flex: 1,
    height: 46,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anotherText: { color: colors.accent, fontWeight: fontWeight.bold },
  doneBtn: {
    flex: 1,
    height: 46,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { color: colors.textInverse, fontWeight: fontWeight.bold },
  disabled: { opacity: 0.5 },
}));
