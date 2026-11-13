// ⚡ Quick add: pick up to 10 photos at once, give each a category (or one for all), save all.
// Shows how much space the photos take in storage (base64 in Firestore, utils/photoStorage.ts).
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import SelectModal from '../../components/SelectModal';
import { PHOTO_PICK, pickImages } from '../../utils/imagePicker';
import { reviewPhotos } from '../../components/PhotoReviewHost';
import { getAllCategoriesSorted } from '../../constants/wardrobe';
import { QUICK_ADD_MAX, QuickItem, quickNames, saveQuickItems } from '../../services/quickAdd';
import { batchStoredBytes, fitsInFirestore, formatBytes } from '../../utils/photoStorage';

export default function QuickAddScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const uid = user?.id ? String(user.id) : '';
  const categories = useMemo(() => getAllCategoriesSorted(user?.gender), [user?.gender]);
  const [items, setItems] = useState<QuickItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [pickFor, setPickFor] = useState<string | 'all' | null>(null);
  const names = quickNames(items);

  const pick = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const room = QUICK_ADD_MAX - items.length;
      const picked = await pickImages(room, PHOTO_PICK);
      const skipped = picked.skipped;
      // Photo options: Original / Blur / Remove BG / Adjust / Blur face
      const images = await reviewPhotos(picked.images, PHOTO_PICK, { bg: true });
      const def = items[items.length - 1]?.category || categories[0] || 'Others';
      setItems(prev => [
        ...prev,
        ...images.slice(0, room).map((p, i) => ({
          key: `${Date.now()}_${i}`,
          category: def,
          dataUri: p.dataUri,
          thumbUri: p.thumbUri,
          clearUri: p.clearUri,
        })),
      ]);
      if (skipped) Alert.alert('Some photos skipped', `${skipped} photo(s) could not be read or were too large.`);
    } catch (e: any) {
      Alert.alert('Photos', e?.message || 'Could not open your photos.');
    } finally {
      setPicking(false);
    }
  };

  const setCategory = (value: string) => {
    setItems(prev => prev.map(i => (pickFor === 'all' || i.key === pickFor ? { ...i, category: value } : i)));
    setPickFor(null);
  };

  const save = async () => {
    if (!uid || !items.length || saving) return;
    setSaving({ done: 0, total: items.length });
    const r = await saveQuickItems(uid, user?.gender, items, isPublic, (done, total) => setSaving({ done, total }));
    setSaving(null);
    const failedKeys = new Set(r.failed.map(f => f.key));
    setItems(prev => prev.filter(i => failedKeys.has(i.key)));
    if (!r.failed.length) {
      Alert.alert('Added ✨', `${r.saved.length} item${r.saved.length === 1 ? '' : 's'} added to your wardrobe.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Partly saved', `${r.saved.length} saved, ${r.failed.length} failed: ${r.failed[0].error}. The failed ones are still here to retry.`);
    }
  };

  const bytes = batchStoredBytes(items);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={!!saving} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>⚡ Quick add</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.help}>Pick up to {QUICK_ADD_MAX} photos, tap a category to change it, then save them all at once.</Text>
        <View style={styles.grid}>
          {items.map((it, i) => (
            <View key={it.key} style={styles.cell}>
              <Image source={{ uri: it.thumbUri || it.dataUri }} style={styles.img} />
              <TouchableOpacity
                style={styles.remove}
                onPress={() => setItems(prev => prev.filter(x => x.key !== it.key))}
                disabled={!!saving}
                accessibilityLabel="Remove photo">
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.catBtn} onPress={() => setPickFor(it.key)} disabled={!!saving}>
                <Text style={styles.catText} numberOfLines={1}>
                  {names[i]} ▾
                </Text>
              </TouchableOpacity>
              {!fitsInFirestore(it) ? <Text style={styles.tooBig}>Too large</Text> : null}
            </View>
          ))}
          {items.length < QUICK_ADD_MAX ? (
            <TouchableOpacity style={[styles.cell, styles.addCell]} onPress={pick} disabled={picking || !!saving}>
              {picking ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.addCellText}>＋{'\n'}Photos</Text>}
            </TouchableOpacity>
          ) : null}
        </View>

        {items.length ? (
          <>
            <TouchableOpacity style={styles.allBtn} onPress={() => setPickFor('all')} disabled={!!saving}>
              <Text style={styles.allText}>Same category for all ▾</Text>
            </TouchableOpacity>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Show in the public feed</Text>
              <Switch value={isPublic} onValueChange={setIsPublic} disabled={!!saving} />
            </View>
            <Text style={styles.storage}>
              📦 {items.length} photo{items.length === 1 ? '' : 's'} · about {formatBytes(bytes)} of storage
            </Text>
            <TouchableOpacity style={[styles.saveBtn, !!saving && styles.saveOff]} onPress={save} disabled={!!saving}>
              {saving ? (
                <Text style={styles.saveText}>
                  Saving {saving.done}/{saving.total}…
                </Text>
              ) : (
                <Text style={styles.saveText}>Save {items.length} to wardrobe</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
      <SelectModal
        visible={pickFor !== null}
        title={pickFor === 'all' ? 'Category for all photos' : 'Category'}
        options={categories}
        selected={pickFor && pickFor !== 'all' ? items.find(i => i.key === pickFor)?.category : null}
        onSelect={setCategory}
        onClose={() => setPickFor(null)}
      />
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
  title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl },
  help: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cell: { width: '48%', marginBottom: spacing.md, borderRadius: borderRadius.lg, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  img: { width: '100%', aspectRatio: 0.8, backgroundColor: colors.inputBg },
  remove: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#FFFFFF', fontWeight: fontWeight.bold },
  catBtn: { paddingHorizontal: spacing.sm, paddingVertical: 8 },
  catText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  tooBig: { fontSize: fontSize.xs, color: colors.error, paddingHorizontal: spacing.sm, paddingBottom: 6 },
  addCell: { aspectRatio: 0.8, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: colors.primary },
  addCellText: { textAlign: 'center', color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.base },
  allBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  allText: { color: colors.primary, fontWeight: fontWeight.bold },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  label: { fontSize: fontSize.base, color: colors.textPrimary },
  storage: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.md },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 24, paddingVertical: 13, alignItems: 'center', marginTop: spacing.lg },
  saveOff: { opacity: 0.6 },
  saveText: { color: colors.onPrimary, fontWeight: fontWeight.extraBold, fontSize: fontSize.base },
}));
