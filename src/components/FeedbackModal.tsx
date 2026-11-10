// New feedback (or edit / quote) for the Feedback & Suggestions board: type, message (max 1000,
// bad-word checked), optional screenshot, "Show on the board" switch. Writes feedback/{autoId};
// admins see all of it, other users see the public ones on the board.
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Switch,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { borderRadius, colors, fontSize, fontWeight, spacing, themedStyles } from '../theme';
import { pickImage, POLL_PICK } from '../utils/imagePicker';
import { containsProfanity } from '../utils/profanity';
import {
  Feedback,
  FEEDBACK_MAX_IMAGE,
  FEEDBACK_MAX_TEXT,
  FEEDBACK_TYPES,
  FeedbackQuote,
  FeedbackType,
  submitFeedback,
  updateFeedback,
} from '../services/feedbackApi';

interface Props {
  visible: boolean;
  uid?: string | null;
  name?: string | null;
  onClose: () => void;
  quote?: FeedbackQuote | null; // quoting someone's feedback
  editing?: Feedback | null; // editing my own feedback
  onDone?: () => void; // after a successful send / save
}

const TYPE_ICON: Record<FeedbackType, string> = { Suggestion: '💡', Complaint: '😕', Bug: '🐞', Other: '💬' };

export default function FeedbackModal({ visible, uid, name, onClose, quote, editing, onDone }: Props) {
  const [type, setType] = useState<FeedbackType>('Suggestion');
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    if (visible) {
      const t = editing?.type as FeedbackType | undefined;
      setType(t && (FEEDBACK_TYPES as readonly string[]).includes(t) ? t : 'Suggestion');
      setText(editing?.text || '');
      setImage(null);
      setError(null);
      setDone(false);
      setIsPublic(editing ? editing.isPublic : true);
    }
  }, [visible, editing]);

  const addScreenshot = async () => {
    setError(null);
    setPicking(true);
    try {
      const picked = await pickImage('library', { ...POLL_PICK, maxChars: FEEDBACK_MAX_IMAGE });
      if (picked) setImage(picked.dataUri);
    } catch (e: any) {
      setError(e?.message || 'Could not add the screenshot.');
    } finally {
      setPicking(false);
    }
  };

  const submit = async () => {
    if (sending) return;
    const t = text.trim();
    if (!uid) {
      setError('Please sign in again to send feedback.');
      return;
    }
    if (!t) {
      setError('Please write your message.');
      return;
    }
    if (containsProfanity(t)) {
      setError('Please keep your message respectful 🙏');
      return;
    }
    setError(null);
    setSending(true);
    try {
      if (editing) {
        await updateFeedback(editing.id, { text: t, type, isPublic });
        onDone?.();
        onClose();
        return;
      }
      await submitFeedback({ uid, name, type, text: t, image, isPublic, quoteOf: quote || null });
      onDone?.();
      setDone(true);
    } catch (e: any) {
      setError(e?.message || 'Sending failed. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent>
      <SafeAreaProvider>
      {/* Edge-to-edge window: pad for the keyboard on both platforms (adjustResize does not apply) */}
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        {/* Sheet stays below the status bar and above the phone's navigation buttons */}
        <SafeAreaView edges={['top']} style={styles.topGap} pointerEvents="box-none" />
        <SafeAreaView style={styles.sheet} edges={['bottom', 'left', 'right']}>
          <View style={styles.headRow}>
            <Text style={styles.title}>
              {editing ? 'Edit feedback' : quote ? 'Quote feedback' : 'Feedback & Suggestions'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          {done ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneEmoji}>💌</Text>
              <Text style={styles.doneTitle}>Thanks! We read every message.</Text>
              {isPublic ? <Text style={styles.doneSub}>It's on the board now, so others can like and reply.</Text> : null}
              <TouchableOpacity style={styles.submit} onPress={onClose}>
                <Text style={styles.submitText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              {quote ? (
                <View style={styles.quoteBox}>
                  <Text style={styles.quoteName}>❝ {quote.name || 'Outfit user'}</Text>
                  <Text style={styles.quoteText} numberOfLines={4}>
                    {quote.text}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeRow}>
                {FEEDBACK_TYPES.map(t => {
                  const on = type === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeChip, on && styles.typeChipOn]}
                      onPress={() => setType(t)}
                      disabled={sending}>
                      <Text style={[styles.typeText, on && styles.typeTextOn]}>
                        {TYPE_ICON[t]} {t}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Message</Text>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder="Tell us what you like, what's broken, or what we should add…"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={FEEDBACK_MAX_TEXT}
                textAlignVertical="top"
                editable={!sending}
              />
              <Text style={styles.counter}>
                {text.length}/{FEEDBACK_MAX_TEXT}
              </Text>

              {editing ? null : <Text style={styles.label}>Screenshot (optional)</Text>}
              {editing ? null : image ? (
                <View style={styles.shotRow}>
                  <Image source={{ uri: image }} style={styles.shot} resizeMode="cover" />
                  <TouchableOpacity onPress={() => setImage(null)} disabled={sending}>
                    <Text style={styles.remove}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.addShot} onPress={addScreenshot} disabled={picking || sending}>
                  {picking ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.addShotText}>📎 Add a screenshot</Text>
                  )}
                </TouchableOpacity>
              )}

              <View style={styles.publicRow}>
                <View style={styles.flex1}>
                  <Text style={styles.publicTitle}>Show on the board</Text>
                  <Text style={styles.publicHint}>
                    {isPublic
                      ? 'Everyone can see, like, reply and quote it.'
                      : 'Only the Outfit team (admins) can see it.'}
                  </Text>
                </View>
                <Switch value={isPublic} onValueChange={setIsPublic} disabled={sending} />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.submit, (!text.trim() || sending) && styles.disabled]}
                onPress={submit}
                disabled={!text.trim() || sending}>
                {sending ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.submitText}>{editing ? 'Save' : 'Submit'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      maxHeight: '92%',
      paddingBottom: spacing.sm,
    },
    topGap: { flexShrink: 0 },
    headRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.base,
      paddingTop: spacing.base,
      paddingBottom: spacing.sm,
    },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
    close: { fontSize: 20, color: colors.textMuted },
    body: { paddingHorizontal: spacing.base, paddingBottom: spacing.lg },
    label: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginTop: spacing.md,
      marginBottom: 6,
    },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap' },
    typeChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginRight: 8,
      marginBottom: 8,
    },
    typeChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    typeText: { fontSize: fontSize.sm, fontWeight: fontWeight.semiBold, color: colors.textPrimary },
    typeTextOn: { color: colors.onPrimary },
    input: {
      minHeight: 140,
      maxHeight: 260,
      backgroundColor: colors.inputBg,
      borderRadius: borderRadius.lg,
      padding: spacing.base,
      fontSize: fontSize.md,
      lineHeight: 23,
      color: colors.textPrimary,
    },
    counter: { alignSelf: 'flex-end', fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },
    addShot: {
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    addShotText: { fontSize: fontSize.sm, fontWeight: fontWeight.semiBold, color: colors.primary },
    shotRow: { flexDirection: 'row', alignItems: 'center' },
    shot: { width: 72, height: 120, borderRadius: 8, backgroundColor: colors.surface },
    remove: { color: colors.error, fontWeight: fontWeight.bold, marginLeft: spacing.md },
    error: { color: colors.error, fontSize: fontSize.sm, marginTop: spacing.md },
    submit: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: spacing.lg,
      alignSelf: 'stretch',
    },
    submitText: { color: colors.onPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.base },
    disabled: { opacity: 0.5 },
    flex1: { flex: 1 },
    publicRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
    publicTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
    publicHint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    quoteBox: {
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    quoteName: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.accent },
    quoteText: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
    doneSub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
    doneBox: { alignItems: 'center', padding: spacing.xl },
    doneEmoji: { fontSize: 44 },
    doneTitle: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      color: colors.textPrimary,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
  }),
);
