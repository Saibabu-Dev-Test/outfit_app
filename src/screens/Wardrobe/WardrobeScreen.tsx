import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

// ─── Types ────────────────────────────────────────────────────────────────────
interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  color: string;
  emoji: string;
}

interface Category {
  id: string;
  icon: string;
  label: string;
  count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const INITIAL_CATEGORIES: Category[] = [
  { id: '1', icon: '👔', label: 'Tops',        count: 24 },
  { id: '2', icon: '👖', label: 'Bottoms',     count: 18 },
  { id: '3', icon: '🥿', label: 'Shoes',       count: 12 },
  { id: '4', icon: '🧥', label: 'Outerwear',   count: 8  },
  { id: '5', icon: '👜', label: 'Bags',         count: 6  },
  { id: '6', icon: '💍', label: 'Accessories', count: 15 },
];

const INITIAL_RECENT: WardrobeItem[] = [
  { id: '1', name: 'White Oxford Shirt', category: 'Tops',      color: '#F8F8F8', emoji: '👔' },
  { id: '2', name: 'Navy Chinos',        category: 'Bottoms',   color: '#E8EBF8', emoji: '👖' },
  { id: '3', name: 'White Sneakers',     category: 'Shoes',     color: '#F0F0F0', emoji: '👟' },
  { id: '4', name: 'Beige Blazer',       category: 'Outerwear', color: '#F5ECD7', emoji: '🧥' },
];



// ─── Component ────────────────────────────────────────────────────────────────
export default function WardrobeScreen({ navigation }: { navigation: any }) {
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [recentItems, setRecentItems] = useState<WardrobeItem[]>(INITIAL_RECENT);

  // Pick up saved item when returning from AddItemScreen
  useFocusEffect(
    useCallback(() => {
      const savedItem = navigation?.getState?.()?.routes?.slice(-1)[0]?.params?.savedItem;
      if (savedItem) {
        const newItem: WardrobeItem = {
          id: Date.now().toString(),
          name: savedItem.name,
          category: savedItem.category,
          color: savedItem.color,
          emoji: savedItem.categoryIcon,
        };
        setRecentItems(prev => [newItem, ...prev]);
        setCategories(prev =>
          prev.map(c => c.label === savedItem.category ? { ...c, count: c.count + 1 } : c)
        );
      }
    }, [navigation])
  );

  const totalItems = categories.reduce((sum, c) => sum + c.count, 0);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle="dark-content"
        {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>My Collection</Text>
            <Text style={styles.title}>Wardrobe</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddItem')} activeOpacity={0.8}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalItems}</Text>
            <Text style={styles.statLabel}>Total Items</Text>
          </View>
          <View style={[styles.statCard, styles.statCardAccent]}>
            <Text style={[styles.statNumber, styles.statNumberLight]}>12</Text>
            <Text style={[styles.statLabel, styles.statLabelLight]}>Outfits</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>7</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
        </View>

        {/* Categories Grid */}
        <Text style={styles.sectionTitle}>Categories</Text>
        <View style={styles.categoryGrid}>
          {categories.map(cat => (
            <TouchableOpacity key={cat.id} style={styles.categoryCard} activeOpacity={0.85}>
              <Text style={styles.categoryEmoji}>{cat.icon}</Text>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
              <Text style={styles.categoryCount}>{cat.count} items</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Items */}
        <Text style={styles.sectionTitle}>Recently Added</Text>
        <View style={styles.recentList}>
          {recentItems.map(item => (
            <TouchableOpacity key={item.id} style={styles.recentItem} activeOpacity={0.85}>
              <View style={[styles.recentItemImage, { backgroundColor: item.color }]}>
                <Text style={styles.recentEmoji}>{item.emoji}</Text>
              </View>
              <View style={styles.recentItemInfo}>
                <Text style={styles.recentItemName}>{item.name}</Text>
                <Text style={styles.recentItemCategory}>{item.category}</Text>
              </View>
              <TouchableOpacity style={styles.moreBtn}>
                <Text style={styles.moreBtnText}>•••</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
  },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary, letterSpacing: -0.5 },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  addButtonText: { color: colors.textInverse, fontWeight: fontWeight.bold, fontSize: fontSize.sm },

  statsRow: { flexDirection: 'row', marginHorizontal: spacing.base, gap: spacing.sm, marginBottom: spacing.xl },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  statCardAccent: { backgroundColor: colors.primary },
  statNumber: { fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  statNumberLight: { color: colors.textInverse },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: fontWeight.medium, marginTop: 2 },
  statLabelLight: { color: colors.accentLight },

  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
  },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: spacing.base, gap: spacing.sm, marginBottom: spacing.xl },
  categoryCard: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryEmoji: { fontSize: 28, marginBottom: spacing.sm },
  categoryLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: 2 },
  categoryCount: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: fontWeight.medium },

  recentList: { marginHorizontal: spacing.base, gap: spacing.sm },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  recentItemImage: { width: 52, height: 52, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  recentEmoji: { fontSize: 28 },
  recentItemInfo: { flex: 1, marginLeft: spacing.md },
  recentItemName: { fontSize: fontSize.base, fontWeight: fontWeight.semiBold, color: colors.textPrimary },
  recentItemCategory: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  moreBtn: { padding: spacing.sm },
  moreBtnText: { color: colors.textMuted, fontWeight: fontWeight.bold, letterSpacing: 2 },

  // ── Modal ────────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10,25,64,0.35)', justifyContent: 'flex-end' },
  modalKAV: { justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.base,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D0CBDF',
    borderRadius: 99,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: '#0A1940', marginBottom: 4 },
  modalSubtitle: { fontSize: fontSize.sm, color: '#6B6B8A', marginBottom: spacing.lg },

  modalCategoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  modalCatCard: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: '#F8F7FC',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EBE9F3',
  },
  modalCatEmoji: { fontSize: 28, marginBottom: 6 },
  modalCatLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: '#0A1940' },

  cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelBtnText: { color: '#9E9EBA', fontSize: fontSize.sm, fontWeight: fontWeight.semiBold },

  backBtn: { marginBottom: spacing.md },
  backBtnText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  modalCatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3EFFF',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#DDD5F8',
  },
  modalCatBadgeEmoji: { fontSize: 14 },
  modalCatBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.primary },

  inputLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: '#4A4A6A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#E0DBF0',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.base,
    color: '#0A1940',
    backgroundColor: '#FAF9FC',
  },
  textInputError: { borderColor: '#F48FB1' },
  errorText: { color: '#E91E63', fontSize: fontSize.xs, fontWeight: fontWeight.semiBold, marginTop: 4 },

  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 6 },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E0DBF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: { borderWidth: 2.5, borderColor: colors.primary },
  swatchCheck: { fontSize: 14, color: colors.primary, fontWeight: fontWeight.bold },
  selectedColorLabel: { fontSize: fontSize.xs, color: '#6B6B8A', fontWeight: fontWeight.semiBold, marginBottom: spacing.md },

  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F7FC',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#EBE9F3',
  },
  previewThumb: { width: 48, height: 48, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  previewEmoji: { fontSize: 24 },
  previewName: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: '#0A1940' },
  previewCat: { fontSize: fontSize.xs, color: '#6B6B8A', marginTop: 2 },

  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    shadowColor: 'rgba(233,30,99,0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: fontSize.base, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
});

