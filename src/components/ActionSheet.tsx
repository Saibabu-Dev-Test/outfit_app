// Bottom action sheet (RN Modal, no native deps). Android's Alert shows at most 3 buttons, so
// menus with more choices use this instead.
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';

export interface SheetAction {
  label: string;
  icon?: string;
  hint?: string;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
  cancelLabel?: string;
}

export default function ActionSheet({ visible, title, actions, onClose, cancelLabel = 'Cancel' }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {actions.map(a => (
            <TouchableOpacity
              key={a.label}
              style={styles.row}
              activeOpacity={0.7}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                // Let this sheet close before a picker / another modal opens
                setTimeout(a.onPress, 250);
              }}>
              {a.icon ? <Text style={styles.icon}>{a.icon}</Text> : null}
              <View style={styles.flex1}>
                <Text style={styles.label}>{a.label}</Text>
                {a.hint ? <Text style={styles.hint}>{a.hint}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancel} onPress={onClose} accessibilityRole="button">
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  icon: { fontSize: 22, width: 36 },
  flex1: { flex: 1 },
  label: { fontSize: fontSize.base, color: colors.textPrimary, fontWeight: fontWeight.semiBold },
  hint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  cancel: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  cancelText: { fontSize: fontSize.base, color: colors.textSecondary, fontWeight: fontWeight.bold },
}));
