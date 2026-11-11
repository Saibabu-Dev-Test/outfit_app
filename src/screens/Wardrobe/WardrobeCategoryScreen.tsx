// All of the user's wardrobe items in one category, as a photo grid
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
  Alert,
  useWindowDimensions,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { deleteWardrobeItem, getWardrobeItems, WardrobeItemResponse } from '../../services/wardrobeApi';
import { categoryIcon, colorToHex, inCategory, isForGender, itemSubType, normalizeCategory, subTypesFor, typeLabel } from '../../constants/wardrobe';

export default function WardrobeCategoryScreen({ navigation, route }: { navigation: any; route: any }) {
  // Old names map in (Footwear -> Shoes, Jewellery -> Accessories)
  const category: string = normalizeCategory(route?.params?.category || 'Others');
  // Shoes / Accessories: filter by type. Items without a type show under All and Other.
  const { user } = useAuth();
  const [items, setItems] = useState<WardrobeItemResponse[]>([]);
  // Only the user's gender's types (plus unisex), and any type that already holds items
  const types = subTypesFor(category).filter(
    t => isForGender(t, user?.gender) || items.some(i => itemSubType(i) === t) || route?.params?.subType === t,
  );
  const [activeType, setActiveType] = useState<string>(
    route?.params?.subType && types.includes(route.params.subType) ? route.params.subType : 'All',
  );
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - spacing.base * 2 - spacing.sm) / 2);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!user?.id) return;
    try {
      const all = await getWardrobeItems(user.id, { force });
      setItems(all.filter(i => inCategory(i.category, category)));
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load your wardrobe.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, category]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const typeOf = (i: WardrobeItemResponse) => itemSubType(i) || 'Other';
  const hasUntyped = items.some(i => !itemSubType(i));
  const typeChips = types.length ? ['All', ...types, ...(hasUntyped ? ['Other'] : [])] : [];
  const shown = activeType === 'All' ? items : items.filter(i => typeOf(i) === activeType);
  const label = activeType === 'All' ? category : activeType;

  const onItemPress = (item: WardrobeItemResponse) =>
    Alert.alert(item.name, [itemSubType(item), item.color, item.wearType, item.fabric].filter(Boolean).join(' · ') || undefined, [
      { text: 'Edit', onPress: () => navigation.navigate('AddItem', { itemToEdit: item }) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWardrobeItem(item.id);
            setItems(prev => prev.filter(i => i.id !== item.id));
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not delete item.');
          }
        },
      },
      { text: 'Close', style: 'cancel' },
    ]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {categoryIcon(category)} {category}
          {!loading ? ` (${items.length})` : ''}
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddItem', { category, subType: types.includes(activeType) ? activeType : undefined })}>
          <Text style={styles.addText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      {typeChips.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.typeRow}
          contentContainerStyle={styles.typeRowContent}>
          {typeChips.map(t => {
            const active = activeType === t;
            const n = t === 'All' ? items.length : items.filter(i => typeOf(i) === t).length;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, active && styles.typeChipActive]}
                onPress={() => setActiveType(t)}
                activeOpacity={0.8}>
                <Text style={[styles.typeText, active && styles.typeTextActive]}>
                  {t === 'All' || t === 'Other' ? t : `${categoryIcon(t)} ${typeLabel(t, user?.language)}`}
                  {n ? ` ${n}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
      <FlatList
        data={shown}
        keyExtractor={i => i.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, { width: tile }]} onPress={() => onItemPress(item)} activeOpacity={0.85}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={{ width: tile, height: tile * 1.15 }} resizeMode="cover" />
            ) : (
              <View style={[styles.noImg, { width: tile, height: tile * 1.15, backgroundColor: colorToHex(item.colorHex || item.color) }]}>
                <Text style={styles.noImgEmoji}>{categoryIcon(itemSubType(item) || item.category)}</Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[itemSubType(item), item.color && !item.color.startsWith('#') ? item.color : '', item.wearType, item.isPublic ? '🌐 public' : '']
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.spinner} color={colors.primary} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{categoryIcon(label)}</Text>
              <Text style={styles.emptyText}>{error || `No ${label.toLowerCase()} yet.`}</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => navigation.navigate('AddItem', { category, subType: types.includes(activeType) ? activeType : undefined })}>
                <Text style={styles.addText}>+ Add {label}</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
  title: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addText: { color: colors.onPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  typeRow: { flexGrow: 0, flexShrink: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
  typeRowContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center', flexDirection: 'row' },
  typeChip: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  typeTextActive: { color: '#FFFFFF' },
  list: { padding: spacing.base, flexGrow: 1 },
  column: { justifyContent: 'space-between' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noImg: { alignItems: 'center', justifyContent: 'center' },
  noImgEmoji: { fontSize: 40 },
  info: { padding: spacing.sm },
  name: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  meta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  spinner: { marginTop: spacing.xxl },
  empty: { alignItems: 'center', padding: spacing.xxl },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: colors.textSecondary, marginVertical: spacing.md, textAlign: 'center' },
}));
