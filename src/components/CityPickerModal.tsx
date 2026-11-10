// Place of birth picker: type to search the bundled Indian city list (offline). The chosen
// 'City, State' label is saved on the profile; the birth chart reads its lat / lng from the list.
import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { themedStyles, colors } from '../theme';
import { City, cityLabel, searchCities } from '../constants/indianCities';

interface Props {
  visible: boolean;
  selected?: string | null;
  onSelect: (label: string) => void;
  onClose: () => void;
}

export default function CityPickerModal({ visible, selected, onSelect, onClose }: Props) {
  const [q, setQ] = useState('');
  const results = useMemo(() => searchCities(q, 40), [q]);
  const pick = (c: City | null) => {
    onSelect(c ? cityLabel(c) : '');
    setQ('');
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>Place of birth</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search city or state"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            autoFocus
          />
          <FlatList
            data={results}
            keyExtractor={c => cityLabel(c)}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const label = cityLabel(item);
              const active = (selected || '').toLowerCase() === label.toLowerCase();
              return (
                <TouchableOpacity style={[styles.option, active && styles.optionActive]} onPress={() => pick(item)}>
                  <Text style={styles.optionText}>{item.name}</Text>
                  <Text style={styles.state}>{item.state}</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>Not in the list: pick the nearest big city.</Text>}
          />
          <View style={styles.row}>
            {selected ? (
              <TouchableOpacity style={styles.cancel} onPress={() => pick(null)}>
                <Text style={styles.cancelText}>Clear</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,25,64,0.45)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 16, maxHeight: '80%' },
  title: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: 18, marginBottom: 8 },
  input: {
    marginHorizontal: 18, marginBottom: 8, borderWidth: 1, borderColor: colors.divider, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, color: colors.textPrimary,
  },
  list: { flexGrow: 0 },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  optionActive: { backgroundColor: colors.divider },
  optionText: { fontSize: 15, color: colors.textPrimary },
  state: { fontSize: 12, color: colors.textSecondary },
  empty: { padding: 18, color: colors.textSecondary },
  row: { flexDirection: 'row', justifyContent: 'flex-end' },
  cancel: { alignSelf: 'flex-end', paddingHorizontal: 18, paddingTop: 10 },
  cancelText: { color: colors.primary, fontWeight: '700' },
}));
