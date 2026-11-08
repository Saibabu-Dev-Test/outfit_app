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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { deleteWardrobeItem, getWardrobeItems, WardrobeItemResponse } from '../../services/wardrobeApi';
import { categoryIcon, colorToHex, inCategory } from '../../constants/wardrobe';

export default function WardrobeCategoryScreen({ navigation, route }: { navigation: any; route: any }) {
  const category: string = route?.params?.category || 'Others';
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - spacing.base * 2 - spacing.sm) / 2);
  const [items, setItems] = useState<WardrobeItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const all = await getWardrobeItems(user.id);
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

  const onItemPress = (item: WardrobeItemResponse) =>
    Alert.alert(item.name, [item.color, item.wearType, item.fabric].filter(Boolean).join(' · ') || undefined, [
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
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddItem', { category })}>
          <Text style={styles.addText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
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
                <Text style={styles.noImgEmoji}>{categoryIcon(item.category)}</Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[item.color && !item.color.startsWith('#') ? item.color : '', item.wearType, item.isPublic ? '🌐 public' : '']
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
              <Text style={styles.emptyEmoji}>{categoryIcon(category)}</Text>
              <Text style={styles.emptyText}>{error || `No ${category.toLowerCase()} yet.`}</Text>
              <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddItem', { category })}>
                <Text style={styles.addText}>+ Add {category}</Text>
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
