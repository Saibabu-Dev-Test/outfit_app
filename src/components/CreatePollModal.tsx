// Build a photo poll: "Which should I buy?" / "Which should I wear?" with 2-6 photos labelled A-F
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import { pickImage, pickImages, POLL_PICK } from '../utils/imagePicker';
import {
  MAX_POLL_OPTIONS,
  MAX_POLL_TOTAL_CHARS,
  POLL_LETTERS,
  POLL_QUESTIONS,
  PollKind,
  PollOption,
} from '../services/circlesApi';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (kind: PollKind, options: PollOption[]) => Promise<void>;
  initialImages?: string[]; // photos picked together in the chat
}

export default function CreatePollModal({ visible, onClose, onSubmit, initialImages }: Props) {
  const [kind, setKind] = useState<PollKind>('wear');
  const [options, setOptions] = useState<PollOption[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible && initialImages?.length) {
      setOptions(initialImages.slice(0, MAX_POLL_OPTIONS).map(img => ({ imageData: img, label: '' })));
    }
  }, [visible, initialImages]);

  const reset = () => {
    setKind('wear');
    setOptions([]);
  };

  const close = () => {
    if (sending) return;
    reset();
    onClose();
  };

  const addPhoto = async (source: 'camera' | 'library') => {
    try {
      const picked = await pickImage(source, POLL_PICK);
      if (!picked) return;
      setOptions(prev =>
        prev.length >= MAX_POLL_OPTIONS ? prev : [...prev, { imageData: picked.dataUri, label: '' }],
      );
    } catch (e: any) {
      Alert.alert('Photo problem', e?.message || 'Could not read that photo.');
    }
  };

  const addSeveral = async () => {
    try {
      const room = MAX_POLL_OPTIONS - options.length;
      const r = await pickImages(room);
      if (r.skipped) Alert.alert('Some photos skipped', `${r.skipped} photo(s) were too large.`);
      if (!r.images.length) return;
      setOptions(prev =>
        [...prev, ...r.images.map(p => ({ imageData: p.dataUri, label: '' }))].slice(0, MAX_POLL_OPTIONS),
      );
    } catch (e: any) {
      Alert.alert('Photo problem', e?.message || 'Could not read those photos.');
    }
  };

  const askSource = () =>
    Alert.alert('Add a photo', undefined, [
      { text: 'Take Photo', onPress: () => addPhoto('camera') },
      { text: 'Choose several', onPress: addSeveral },
      { text: 'Choose from Library', onPress: () => addPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const total = options.reduce((n, o) => n + o.imageData.length, 0);
  const tooBig = total > MAX_POLL_TOTAL_CHARS;

  const submit = async () => {
    if (options.length < 2) {
      Alert.alert('Add photos', 'A poll needs at least 2 photos.');
      return;
    }
    if (tooBig) {
      Alert.alert('Too large', 'These photos are too large together. Remove one or pick smaller photos.');
      return;
    }
    setSending(true);
    try {
      await onSubmit(kind, options);
      reset();
      onClose();
    } catch (e: any) {
      Alert.alert('Could not send poll', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}>
        <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={close} />
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Photo poll</Text>
            <View style={styles.kindRow}>
              {(['wear', 'buy'] as PollKind[]).map(k => (
                <TouchableOpacity
                  key={k}
                  style={[styles.kind, kind === k && styles.kindActive]}
                  onPress={() => setKind(k)}>
                  <Text style={[styles.kindText, kind === k && styles.kindTextActive]}>
                    {POLL_QUESTIONS[k]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.hint}>Add 2 to {MAX_POLL_OPTIONS} photos, labelled A-F ({options.length}/{MAX_POLL_OPTIONS})</Text>
            <View style={styles.grid}>
              {options.map((o, i) => (
                <View key={i} style={styles.slot}>
                  <Image source={{ uri: o.imageData }} style={styles.slotImage} resizeMode="cover" />
                  <View style={styles.letter}>
                    <Text style={styles.letterText}>{POLL_LETTERS[i]}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.remove}
                    onPress={() => setOptions(prev => prev.filter((_, j) => j !== i))}>
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.labelInput}
                    placeholder={`Label ${POLL_LETTERS[i]} (optional)`}
                    placeholderTextColor={colors.textMuted}
                    value={o.label}
                    maxLength={40}
                    onChangeText={t =>
                      setOptions(prev => prev.map((x, j) => (j === i ? { ...x, label: t } : x)))
                    }
                  />
                </View>
              ))}
              {options.length < MAX_POLL_OPTIONS && (
                <TouchableOpacity style={[styles.slot, styles.addSlot]} onPress={askSource}>
                  <Text style={styles.addPlus}>＋</Text>
                  <Text style={styles.addText}>Add photo</Text>
                </TouchableOpacity>
              )}
            </View>
            {tooBig && (
              <Text style={styles.error}>Photos are too large together. Remove one or pick smaller photos.</Text>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={close} disabled={sending}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, (options.length < 2 || sending || tooBig) && styles.disabled]}
                onPress={submit}
                disabled={options.length < 2 || sending || tooBig}>
                {sending ? (
                  <ActivityIndicator color={colors.textInverse} size="small" />
                ) : (
                  <Text style={styles.sendText}>Send poll</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  flex1: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: '92%',
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.md },
  kindRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  kind: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  kindActive: { borderColor: colors.accent, backgroundColor: colors.surfaceElevated },
  kindText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.semiBold, textAlign: 'center' },
  kindTextActive: { color: colors.primary, fontWeight: fontWeight.bold },
  hint: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
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
  letterText: { color: colors.onPrimary, fontWeight: fontWeight.extraBold, fontSize: 12 },
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
  labelInput: { height: 38, paddingHorizontal: spacing.sm, fontSize: fontSize.sm, color: colors.textPrimary },
  addSlot: {
    aspectRatio: 0.8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: { fontSize: 30, color: colors.accent },
  addText: { fontSize: fontSize.sm, color: colors.accent, fontWeight: fontWeight.bold },
  error: { color: colors.error, fontSize: fontSize.xs, marginBottom: spacing.sm },
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
}));
