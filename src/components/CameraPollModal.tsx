// Circle "Take photo" flow: take up to 4 photos one after another with the camera (or add some
// from the gallery), preview them (tap to zoom), then send.
//   1 photo  -> a normal photo message
//   2-4      -> a photo poll ("Which should I wear / buy?") where members vote for one option
// Photos are compressed with the shared picker helpers (POLL_PICK) and stored in the existing
// poll message structure (circles/{id}/messages/{msgId}.poll, votes in .../votes/{uid}).
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  themedStyles,
} from '../theme';
import { pickImage, pickImages, POLL_PICK } from '../utils/imagePicker';
import ZoomableImage from './ZoomableImage';
import {
  MAX_POLL_TOTAL_CHARS,
  POLL_LETTERS,
  POLL_QUESTIONS,
  PollKind,
  PollOption,
} from '../services/circlesApi';
import { useBottomSpace } from '../hooks/useBottomSpace';

export const CAMERA_POLL_MAX = 4;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSendPhoto: (imageData: string) => Promise<void>;
  onSendPoll: (kind: PollKind, options: PollOption[]) => Promise<void>;
}

export default function CameraPollModal({
  visible,
  onClose,
  onSendPhoto,
  onSendPoll,
}: Props) {
  const bottomPad = useBottomSpace(16);
  const [photos, setPhotos] = useState<string[]>([]);
  const [kind, setKind] = useState<PollKind>('wear');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const autoOpened = useRef(false);

  const room = CAMERA_POLL_MAX - photos.length;

  const takePhoto = async () => {
    if (busy || room <= 0) return;
    setBusy(true);
    try {
      const picked = await pickImage('camera', POLL_PICK);
      if (picked)
        setPhotos(prev =>
          prev.length >= CAMERA_POLL_MAX ? prev : [...prev, picked.dataUri],
        );
      return picked;
    } catch (e: any) {
      Alert.alert('Photo problem', e?.message || 'Could not read that photo.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const fromGallery = async () => {
    if (busy || room <= 0) return;
    setBusy(true);
    try {
      const r = await pickImages(room, POLL_PICK);
      if (r.skipped)
        Alert.alert(
          'Some photos skipped',
          `${r.skipped} photo(s) were too large.`,
        );
      if (r.images.length) {
        setPhotos(prev =>
          [...prev, ...r.images.map(i => i.dataUri)].slice(0, CAMERA_POLL_MAX),
        );
      }
    } catch (e: any) {
      Alert.alert(
        'Photo problem',
        e?.message || 'Could not read those photos.',
      );
    } finally {
      setBusy(false);
    }
  };

  // Opening the flow goes straight to the camera; cancelling the first shot closes it again
  useEffect(() => {
    if (!visible) {
      autoOpened.current = false;
      return;
    }
    if (autoOpened.current) return;
    autoOpened.current = true;
    (async () => {
      const first = await takePhoto();
      if (!first) onClose();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const reset = () => {
    setPhotos([]);
    setKind('wear');
    setViewerAt(null);
  };

  const close = () => {
    if (sending) return;
    reset();
    onClose();
  };

  const total = photos.reduce((n, p) => n + p.length, 0);
  const tooBig = total > MAX_POLL_TOTAL_CHARS;

  const send = async () => {
    if (!photos.length || sending) return;
    if (tooBig) {
      Alert.alert(
        'Too large',
        'These photos are too large together. Remove one and try again.',
      );
      return;
    }
    setSending(true);
    try {
      if (photos.length === 1) {
        await onSendPhoto(photos[0]);
      } else {
        await onSendPoll(
          kind,
          photos.map((p, i) => ({ imageData: p, label: POLL_LETTERS[i] })),
        );
      }
      reset();
      onClose();
    } catch (e: any) {
      Alert.alert(
        photos.length === 1 ? 'Photo not sent' : 'Poll not sent',
        e?.message || 'Please try again.',
      );
    } finally {
      setSending(false);
    }
  };

  // Nothing to show until the first photo is taken (the camera is open)
  const showSheet = visible && photos.length > 0;

  return (
    <Modal
      visible={showSheet}
      animationType="slide"
      transparent
      onRequestClose={close}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.flex1}
          activeOpacity={1}
          onPress={close}
        />
        <View style={[styles.card, { paddingBottom: bottomPad }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>
              {photos.length > 1
                ? `Photo poll · ${photos.length} options`
                : 'Your photo'}
            </Text>
            <Text style={styles.hint}>
              Take up to {CAMERA_POLL_MAX} photos. 2 or more become a poll where
              members vote for one. Tap a photo to zoom.
            </Text>

            {photos.length > 1 ? (
              <View style={styles.kindRow}>
                {(['wear', 'buy'] as PollKind[]).map(k => (
                  <TouchableOpacity
                    key={k}
                    style={[styles.kind, kind === k && styles.kindActive]}
                    onPress={() => setKind(k)}
                  >
                    <Text
                      style={[
                        styles.kindText,
                        kind === k && styles.kindTextActive,
                      ]}
                    >
                      {POLL_QUESTIONS[k]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <View style={styles.grid}>
              {photos.map((p, i) => (
                <View key={i} style={styles.slot}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setViewerAt(i)}
                  >
                    <Image
                      source={{ uri: p }}
                      style={styles.slotImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                  {photos.length > 1 ? (
                    <View style={styles.letter}>
                      <Text style={styles.letterText}>{POLL_LETTERS[i]}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={styles.remove}
                    disabled={sending}
                    onPress={() =>
                      setPhotos(prev => prev.filter((_, j) => j !== i))
                    }
                    accessibilityLabel={`Remove photo ${i + 1}`}
                  >
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {room > 0 ? (
              <View style={styles.addRow}>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={takePhoto}
                  disabled={busy || sending}
                >
                  <Text style={styles.addText}>
                    📷 Take another ({photos.length}/{CAMERA_POLL_MAX})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={fromGallery}
                  disabled={busy || sending}
                >
                  <Text style={styles.addText}>🖼️ Gallery</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {tooBig ? (
              <Text style={styles.error}>
                Photos are too large together. Remove one.
              </Text>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={close}
                disabled={sending}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (sending || tooBig || busy) && styles.disabled,
                ]}
                onPress={send}
                disabled={sending || tooBig || busy}
              >
                {sending ? (
                  <ActivityIndicator color={colors.textInverse} size="small" />
                ) : (
                  <Text style={styles.sendText}>
                    {photos.length > 1 ? 'Post poll' : 'Send photo'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
      <ZoomableImage
        visible={viewerAt !== null}
        images={photos}
        initialIndex={viewerAt || 0}
        labels={
          photos.length > 1 ? photos.map((_, i) => POLL_LETTERS[i]) : undefined
        }
        onClose={() => setViewerAt(null)}
      />
    </Modal>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    flex1: { flex: 1 },
    card: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      padding: spacing.xl,
      maxHeight: '92%',
    },
    title: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    hint: {
      fontSize: fontSize.xs,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    kindRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    kind: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
    },
    kindActive: {
      borderColor: colors.accent,
      backgroundColor: colors.surfaceElevated,
    },
    kindText: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      fontWeight: fontWeight.semiBold,
      textAlign: 'center',
    },
    kindTextActive: { color: colors.primary, fontWeight: fontWeight.bold },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    slot: {
      width: '48.5%',
      marginBottom: spacing.sm,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
      backgroundColor: colors.background,
    },
    slotImage: { width: '100%', aspectRatio: 0.8 },
    letter: {
      position: 'absolute',
      top: 6,
      left: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    letterText: {
      color: colors.onPrimary,
      fontWeight: fontWeight.extraBold,
      fontSize: 12,
    },
    remove: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeText: { color: colors.textInverse, fontWeight: fontWeight.bold },
    addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    addBtn: {
      flex: 1,
      height: 44,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.accentLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addText: {
      color: colors.accent,
      fontWeight: fontWeight.bold,
      fontSize: fontSize.sm,
    },
    error: {
      color: colors.error,
      fontSize: fontSize.xs,
      marginTop: spacing.sm,
    },
    actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
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
    sendBtn: {
      flex: 1,
      height: 48,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendText: { color: colors.textInverse, fontWeight: fontWeight.bold },
    disabled: { opacity: 0.5 },
  }),
);
