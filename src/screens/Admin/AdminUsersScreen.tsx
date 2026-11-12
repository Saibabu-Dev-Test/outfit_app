// 👥 Users (admins only, opened from the Me tab): total registered users, new today, new this week
// and active today. Four Firestore count() aggregations (services/adminStats.getUserCounts), so no
// user docs are read. The full gender / age breakdown stays in Admin > Stats.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { borderRadius, colors, fontSize, fontWeight, spacing, themedStyles } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import { getUserCounts, UserCounts } from '../../services/adminStats';
import { timeAgo } from '../../utils/date';
import { useBottomSpace } from '../../hooks/useBottomSpace';

const show = (n: number | null) => (n === null ? '—' : n.toLocaleString());

export default function AdminUsersScreen({ navigation }: { navigation: any }) {
  const bottomPad = useBottomSpace();
  const { user } = useAuth();
  const { isAdmin, checked } = useIsAdmin(user?.id);
  const [counts, setCounts] = useState<UserCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCounts(await getUserCounts());
    } catch (e: any) {
      setError(e?.message || 'Could not load user counts.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) load();
    }, [isAdmin, load]),
  );

  const tiles: { label: string; value: number | null }[] = counts
    ? [
        { label: 'Registered users', value: counts.total },
        { label: 'New today', value: counts.newToday },
        { label: 'New this week (since Mon)', value: counts.newThisWeek },
        { label: 'Active today', value: counts.activeToday },
      ]
    : [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>👥 Users</Text>
      </View>
      {!checked ? (
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      ) : !isAdmin ? (
        <Text style={styles.empty}>Admins only.</Text>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: bottomPad }]}
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
          }>
          {loading && !counts ? <ActivityIndicator style={styles.spinner} color={colors.primary} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.grid}>
            {tiles.map(t => (
              <View key={t.label} style={styles.tile}>
                <Text style={styles.value}>{show(t.value)}</Text>
                <Text style={styles.label}>{t.label}</Text>
              </View>
            ))}
          </View>
          {counts ? (
            <Text style={styles.meta}>Updated {timeAgo(counts.at)} · pull down to refresh</Text>
          ) : null}
          <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('Admin')}>
            <Text style={styles.linkText}>🛡️ Admin: reports, circles, feedback, gender / age stats ›</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.md },
    back: { fontSize: 32, color: colors.textPrimary, marginRight: spacing.md, lineHeight: 34 },
    title: { fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
    body: { padding: spacing.base },
    spinner: { marginTop: spacing.xl },
    empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl },
    error: { color: colors.error, textAlign: 'center', marginBottom: spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    tile: {
      width: '48%',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    value: { fontSize: 32, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
    label: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
    meta: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
    link: { marginTop: spacing.lg, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
    linkText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  }),
);
