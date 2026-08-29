import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

const wardrobeCategories = [
  { id: '1', icon: '👔', label: 'Tops', count: 24 },
  { id: '2', icon: '👖', label: 'Bottoms', count: 18 },
  { id: '3', icon: '🥿', label: 'Shoes', count: 12 },
  { id: '4', icon: '🧥', label: 'Outerwear', count: 8 },
  { id: '5', icon: '👜', label: 'Bags', count: 6 },
  { id: '6', icon: '💍', label: 'Accessories', count: 15 },
];

const recentItems = [
  { id: '1', name: 'White Oxford Shirt', category: 'Tops', color: '#F8F8F8', emoji: '👔' },
  { id: '2', name: 'Navy Chinos', category: 'Bottoms', color: '#E8EBF8', emoji: '👖' },
  { id: '3', name: 'White Sneakers', category: 'Shoes', color: '#F0F0F0', emoji: '👟' },
  { id: '4', name: 'Beige Blazer', category: 'Outerwear', color: '#F5ECD7', emoji: '🧥' },
];

export default function WardrobeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
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
          <TouchableOpacity style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>83</Text>
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
          {wardrobeCategories.map(cat => (
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extraBold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  addButtonText: {
    color: colors.textInverse,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.sm,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
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
  statNumber: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extraBold,
    color: colors.textPrimary,
  },
  statNumberLight: { color: colors.textInverse },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
    marginTop: 2,
  },
  statLabelLight: { color: colors.accentLight },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: spacing.base,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
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
  categoryLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  recentList: {
    marginHorizontal: spacing.base,
    gap: spacing.sm,
  },
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
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentEmoji: { fontSize: 28 },
  recentItemInfo: { flex: 1, marginLeft: spacing.md },
  recentItemName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.textPrimary,
  },
  recentItemCategory: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  moreBtn: { padding: spacing.sm },
  moreBtnText: {
    color: colors.textMuted,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
  },
});
