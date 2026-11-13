import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getWardrobeItems, deleteWardrobeItem, WardrobeItemResponse } from '../../services/wardrobeApi';

import {
  CATEGORY_GROUPS,
  groupCategoriesSorted,
  inCategory,
  isForGender,
  itemSubType,
  categoryIcon,
  colorToHex,
  WEAR_TYPES,
} from '../../constants/wardrobe';

// "Modes": filter the list by wear type (All / Daily Wear / Formal / Casual)
const MODES = ['All', ...WEAR_TYPES];

// ─── Component ────────────────────────────────────────────────────────────────
export default function WardrobeScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WardrobeItemResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<string>('All');

  const fetchItems = async (showLoading = true, force = false) => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      if (showLoading) setLoading(true);
      const data = await getWardrobeItems(user.id, { force });
      setItems(data || []);
      setLoadError(null);
    } catch (err: any) {
      console.warn('Failed to fetch wardrobe items:', err?.message);
      setLoadError(err?.message || 'Could not load your wardrobe.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchItems();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems(false, true); // pull to refresh: full reload
  };

  const handleDeleteItem = (item: WardrobeItemResponse) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to remove "${item.name}" from your wardrobe?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWardrobeItem(item.id);
              setItems(prev => prev.filter(i => i.id !== item.id));
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete item.');
            }
          },
        },
      ]
    );
  };

  // Sections: Tops / Bottoms / Ethnic & Dresses / Shoes / Accessories / Others (old names map in)
  const countIn = (cat: string) => items.filter(i => inCategory(i.category, cat)).length;
  // Only the user's gender's categories (plus unisex); a category or type that already holds items
  // stays visible so nothing saved earlier disappears.
  const sections = CATEGORY_GROUPS.map(g => {
    const cats = g.categories.filter(c => groupCategoriesSorted(g, user?.gender).includes(c) || countIn(c) > 0);
    const subTypes = g.subTypes
      ? g.subTypes.filter(
          t => isForGender(t, user?.gender) || items.some(i => inCategory(i.category, g.categories[0]) && itemSubType(i) === t),
        )
      : undefined;
    return { group: { ...g, subTypes }, cats };
  }).filter(s => s.group.subTypes || s.cats.length > 0);

  const visibleItems = items.filter(i => activeMode === 'All' || i.wearType === activeMode);

  const totalItems = items.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>My Collection</Text>
            <Text style={styles.title}>Wardrobe</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              style={[styles.addButton, { marginRight: 8 }]}
              onPress={() => navigation.navigate('AddItem', { quick: true })}
              activeOpacity={0.8}>
              <Text style={styles.addButtonText}>⚡ Quick add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('AddItem')}
              activeOpacity={0.8}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalItems}</Text>
            <Text style={styles.statLabel}>Total Items</Text>
          </View>
          <View style={[styles.statCard, styles.statCardAccent]}>
            <Text style={[styles.statNumber, styles.statNumberLight]}>
              {totalItems > 0 ? Math.floor(totalItems / 2) : 0}
            </Text>
            <Text style={[styles.statLabel, styles.statLabelLight]}>Outfits</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalItems}</Text>
            <Text style={styles.statLabel}>In Wardrobe</Text>
          </View>
        </View>

        {/* Categories, grouped */}
        <Text style={styles.sectionTitle}>Categories</Text>
        {sections.map(({ group, cats }) => {
          if (group.subTypes) {
            // Shoes / Accessories: one category, its types in a swipe row
            const cat = group.categories[0];
            const inCat = items.filter(i => inCategory(i.category, cat));
            return (
              <View key={group.key} style={styles.groupBlock}>
                <Text style={styles.groupTitle}>{group.icon} {group.label}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.typeSlider}
                  contentContainerStyle={styles.typeSliderContent}>
                  <TouchableOpacity
                    style={[styles.typeTile, styles.typeTileAll]}
                    onPress={() => navigation.navigate('WardrobeCategory', { category: cat })}
                    activeOpacity={0.8}>
                    <Text style={styles.typeTileEmoji}>{group.icon}</Text>
                    <Text style={styles.typeTileLabel} numberOfLines={1}>All {group.label}</Text>
                    <Text style={styles.categoryCount}>{inCat.length} items</Text>
                  </TouchableOpacity>
                  {group.subTypes.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={styles.typeTile}
                      onPress={() => navigation.navigate('WardrobeCategory', { category: cat, subType: t })}
                      activeOpacity={0.8}>
                      <Text style={styles.typeTileEmoji}>{categoryIcon(t)}</Text>
                      <Text style={styles.typeTileLabel} numberOfLines={2}>{t}</Text>
                      <Text style={styles.categoryCount}>{inCat.filter(i => itemSubType(i) === t).length} items</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            );
          }
          return (
            <View key={group.key} style={styles.groupBlock}>
              <Text style={styles.groupTitle}>{group.icon} {group.label}</Text>
              <View style={styles.categoryGrid}>
                {cats.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={styles.categoryCard}
                    onPress={() => navigation.navigate('WardrobeCategory', { category: cat })}
                    activeOpacity={0.8}>
                    <Text style={styles.categoryEmoji}>{categoryIcon(cat)}</Text>
                    <Text style={styles.categoryLabel} numberOfLines={1}>{cat}</Text>
                    <Text style={styles.categoryCount}>{countIn(cat)} items</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}

        {/* Modes: wear-type filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
          {MODES.map(m => {
            const active = activeMode === m;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.modeChip, active && styles.modeChipActive]}
                onPress={() => setActiveMode(m)}
                activeOpacity={0.8}>
                <Text style={[styles.modeText, active && styles.modeTextActive]}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

        {/* Recent Items / Backend Data List */}
        <Text style={styles.sectionTitle}>
          {activeMode !== 'All'
            ? `${activeMode} (${visibleItems.length})`
            : `My Items (${totalItems})`}
        </Text>

        {loading && items.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Fetching your wardrobe...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>👕</Text>
            <Text style={styles.emptyTitle}>Your Wardrobe is Empty</Text>
            <Text style={styles.emptySubtitle}>
              Tap the "+ Add" button above to upload clothing photos and save them to your wardrobe.
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => navigation.navigate('AddItem')}
              activeOpacity={0.85}>
              <Text style={styles.emptyAddBtnText}>+ Add Your First Item</Text>
            </TouchableOpacity>
          </View>
        ) : visibleItems.length === 0 ? (
          <Text style={styles.filterEmpty}>No items match this filter.</Text>
        ) : (
          <View style={styles.recentList}>
            {visibleItems.map(item => {
              const sub = itemSubType(item);
              const emoji = categoryIcon(sub || item.category);
              return (
                <View key={item.id} style={styles.recentItem}>
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.recentItemImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.recentEmojiBox, { backgroundColor: colorToHex(item.colorHex || item.color) }]}>
                      <Text style={styles.recentEmoji}>{emoji}</Text>
                    </View>
                  )}
                  <View style={styles.recentItemInfo}>
                    <Text style={styles.recentItemName}>{item.name}</Text>
                    <Text style={styles.recentItemCategory}>
                      {item.category}{sub ? ` › ${sub}` : ''}{item.color ? ` · ${item.color.startsWith('#') ? '' : item.color}` : ''}{item.subCategory ? ` · ${item.subCategory}` : ''}{item.wearType ? ` · ${item.wearType}` : ''}{item.fabric ? ` · ${item.fabric}` : ''}
                    </Text>
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => navigation.navigate('AddItem', { itemToEdit: item })}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.actionIconText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleDeleteItem(item)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.actionIconText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = themedStyles(() => StyleSheet.create({
  modeRow: { paddingHorizontal: spacing.base, paddingBottom: spacing.sm, gap: 8 },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  modeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  modeTextActive: { color: '#FFFFFF' },
  errorText: { color: colors.error, fontSize: 13, paddingHorizontal: spacing.base, marginBottom: spacing.sm },
  filterEmpty: { color: colors.textSecondary, fontSize: 14, paddingHorizontal: spacing.base, paddingVertical: spacing.md },
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

  groupBlock: { marginBottom: spacing.base },
  groupTitle: {
    fontSize: 12,
    fontWeight: fontWeight.extraBold,
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  typeSlider: { flexGrow: 0, flexShrink: 0 },
  typeSliderContent: { paddingHorizontal: spacing.base, paddingBottom: 6, alignItems: 'flex-start', flexDirection: 'row' },
  typeTile: {
    width: 96,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: 6,
    alignItems: 'center',
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeTileAll: { borderColor: colors.primary, borderWidth: 1.5 },
  typeTileEmoji: { fontSize: 24, marginBottom: 4 },
  typeTileLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textPrimary, textAlign: 'center', marginBottom: 2 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: spacing.base, gap: spacing.sm },
  categoryCard: {
    width: '30%',
    flexGrow: 0,
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
  recentItemImage: {
    width: 54,
    height: 54,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  recentEmojiBox: {
    width: 54,
    height: 54,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentEmoji: { fontSize: 28 },
  recentItemInfo: { flex: 1, marginLeft: spacing.md },
  recentItemName: { fontSize: fontSize.base, fontWeight: fontWeight.semiBold, color: colors.textPrimary },
  recentItemCategory: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconText: { fontSize: 16 },

  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },

  emptyCard: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyIcon: { fontSize: 44, marginBottom: spacing.sm },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: 4 },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  emptyAddBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
  },
  emptyAddBtnText: { color: colors.textInverse, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
}));
