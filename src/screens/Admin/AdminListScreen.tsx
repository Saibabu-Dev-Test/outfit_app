// Owner only: the list behind one number on 📊 Admin tracking (registered / new today / new this
// week / active today users, wardrobe items, posts & polls, circles). Real Firestore docs
// (services/adminLists.ts); a tap opens the existing profile, post or circle screen.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { borderRadius, colors, fontSize, fontWeight, spacing, themedStyles } from '../../theme';
import { ADMIN_LIST_TITLE, AdminListKind, AdminListRow, loadAdminList } from '../../services/adminLists';
import { isOwnerUser } from '../../services/adminSystem';
import { useBottomSpace } from '../../hooks/useBottomSpace';

export default function AdminListScreen({ navigation, route }: { navigation: any; route: { params: { kind: AdminListKind } } }) {
  const kind = route.params?.kind || 'users';
  const bottomPad = useBottomSpace();
  const owner = isOwnerUser();
  const [rows, setRows] = useState<AdminListRow[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const page = await loadAdminList(kind);
      setRows(page.rows);
      setCursor(page.cursor);
    } catch (e: any) {
      setError(e?.message || 'Could not load the list.');
    }
    setLoading(false);
    setRefreshing(false);
  }, [kind]);

  useEffect(() => {
    if (owner) load();
    else setLoading(false);
  }, [owner, load]);

  const loadMore = async () => {
    if (!cursor || more) return;
    setMore(true);
    try {
      const page = await loadAdminList(kind, cursor);
      setRows(r => [...r, ...page.rows.filter(x => !r.some(y => y.id === x.id))]);
      setCursor(page.cursor);
    } catch (e: any) {
      setError(e?.message || 'Could not load more.');
    }
    setMore(false);
  };

  const renderRow = ({ item }: { item: AdminListRow }) => (
    <TouchableOpacity style={styles.row} onPress={() => navigation.push(item.open.screen, item.open.params)} activeOpacity={0.7}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.noPhoto]}>
          <Text style={styles.noPhotoText}>{item.emoji || item.title.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.flex1}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {item.subtitle}
        </Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {ADMIN_LIST_TITLE[kind]}
          {!loading && owner ? <Text style={styles.count}>  {rows.length}{cursor ? '+' : ''}</Text> : null}
        </Text>
      </View>
      {!owner ? (
        <Text style={styles.empty}>Owner only.</Text>
      ) : loading ? (
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.id}
          renderItem={renderRow}
          contentContainerStyle={{ paddingBottom: bottomPad }}
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
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : undefined}
          ListEmptyComponent={error ? undefined : <Text style={styles.empty}>Nothing here yet.</Text>}
          ListFooterComponent={
            cursor ? (
              <TouchableOpacity style={styles.more} onPress={loadMore} disabled={more}>
                {more ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.moreText}>Load more</Text>}
              </TouchableOpacity>
            ) : undefined
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.md },
    back: { fontSize: 32, color: colors.textPrimary, marginRight: spacing.md, lineHeight: 34 },
    headerTitle: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
    count: { fontSize: fontSize.md, color: colors.textSecondary, fontWeight: fontWeight.regular },
    spinner: { marginTop: spacing.xl },
    empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl },
    error: { color: colors.error, textAlign: 'center', margin: spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    photo: { width: 44, height: 44, borderRadius: borderRadius.md, marginRight: spacing.md, backgroundColor: colors.surface },
    noPhoto: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    noPhotoText: { fontSize: fontSize.md, color: colors.textSecondary, fontWeight: fontWeight.bold },
    flex1: { flex: 1 },
    title: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: fontWeight.semiBold },
    subtitle: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
    chev: { fontSize: 22, color: colors.textSecondary, marginLeft: spacing.sm },
    more: { margin: spacing.base, padding: spacing.md, alignItems: 'center', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
    moreText: { color: colors.primary, fontWeight: fontWeight.bold },
  }),
);
