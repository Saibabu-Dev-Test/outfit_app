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
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getWardrobeItems, deleteWardrobeItem, WardrobeItemResponse } from '../../services/wardrobeApi';

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_CATEGORIES = [
  { id: '1', icon: '👔', label: 'Tops' },
  { id: '2', icon: '👖', label: 'Bottoms' },
  { id: '3', icon: '👟', label: 'Shoes' },
  { id: '4', icon: '🧥', label: 'Outerwear' },
  { id: '5', icon: '👜', label: 'Bags' },
  { id: '6', icon: '💍', label: 'Accessories' },
];

const CATEGORY_ICONS: Record<string, string> = {
  'Tops': '👔',
  'Bottoms': '👖',
  'Shoes': '👟',
  'Outerwear': '🧥',
  'Bags': '👜',
  'Accessories': '💍',
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function WardrobeScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WardrobeItemResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchItems = async (showLoading = true) => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      if (showLoading) setLoading(true);
      const data = await getWardrobeItems(user.id);
      setItems(data || []);
    } catch (err: any) {
      console.warn('Failed to fetch wardrobe items:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [user?.id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems(false);
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

  // Dynamic category count calculation from actual backend items
  const categories = BASE_CATEGORIES.map(cat => ({
    ...cat,
    count: items.filter(i => i.category.toLowerCase() === cat.label.toLowerCase()).length,
  }));

  const totalItems = items.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle="dark-content"
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
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddItem')}
            activeOpacity={0.8}>
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

        {/* Categories Grid */}
        <Text style={styles.sectionTitle}>Categories</Text>
        <View style={styles.categoryGrid}>
          {categories.map(cat => (
            <View key={cat.id} style={styles.categoryCard}>
              <Text style={styles.categoryEmoji}>{cat.icon}</Text>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
              <Text style={styles.categoryCount}>{cat.count} items</Text>
            </View>
          ))}
        </View>

        {/* Recent Items / Backend Data List */}
        <Text style={styles.sectionTitle}>My Items ({totalItems})</Text>

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
              Tap the "+ Add" button above to upload clothing photos and save them to your backend wardrobe.
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => navigation.navigate('AddItem')}
              activeOpacity={0.85}>
              <Text style={styles.emptyAddBtnText}>+ Add Your First Item</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.recentList}>
            {items.map(item => {
              const emoji = CATEGORY_ICONS[item.category] || '👕';
              return (
                <View key={item.id} style={styles.recentItem}>
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.recentItemImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.recentEmojiBox, { backgroundColor: item.color || '#F3F0FF' }]}>
                      <Text style={styles.recentEmoji}>{emoji}</Text>
                    </View>
                  )}
                  <View style={styles.recentItemInfo}>
                    <Text style={styles.recentItemName}>{item.name}</Text>
                    <Text style={styles.recentItemCategory}>
                      {item.category}{item.fabric ? ` · ${item.fabric}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.moreBtn}
                    onPress={() => handleDeleteItem(item)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Text style={styles.deleteIconText}>🗑️</Text>
                  </TouchableOpacity>
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
  moreBtn: { padding: spacing.sm },
  deleteIconText: { fontSize: 18 },

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
});
