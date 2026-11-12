// Simple dropdown: RN Modal + FlatList (no native deps)
import React from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { themedStyles, colors } from '../theme';
import { useBottomSpace } from '../hooks/useBottomSpace';

interface Props {
  visible: boolean;
  title: string;
  options: string[];
  selected?: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export default function SelectModal({ visible, title, options, selected, onSelect, onClose }: Props) {
  const bottomPad = useBottomSpace();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingBottom: bottomPad }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={item => item}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = (selected || '').toLowerCase() === item.toLowerCase();
              return (
                <TouchableOpacity
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  activeOpacity={0.8}>
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{item}</Text>
                  {active && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,25,64,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 16,
    maxHeight: '75%',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  optionActive: { backgroundColor: colors.divider },
  optionText: { fontSize: 15, color: colors.textPrimary },
  optionTextActive: { color: '#6C5CE7', fontWeight: '700' },
  check: { color: '#6C5CE7', fontWeight: '800', fontSize: 16 },
  cancel: { alignSelf: 'flex-end', paddingHorizontal: 18, paddingTop: 10 },
  cancelText: { color: colors.textSecondary, fontWeight: '700', fontSize: 14 },
}));
