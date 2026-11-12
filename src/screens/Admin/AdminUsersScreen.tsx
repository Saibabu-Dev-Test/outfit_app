// 📊 Admin tracking (admins only, opened from the Me tab): users (total, new today / this week,
// active today), app content counts, ads status on this phone, and every feature with its status. Four Firestore count() aggregations (services/adminStats.getUserCounts), so no
// user docs are read. The full gender / age breakdown stays in Admin > Stats.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { borderRadius, colors, fontSize, fontWeight, spacing, themedStyles } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import { AppCounts, getAppCounts, getUserCounts, UserCounts } from '../../services/adminStats';
import { adStatuses } from '../../native/ads';
import { FEATURE_STATUS_LABEL, TRACKED_FEATURES } from '../../config/featureTracker';
import { timeAgo } from '../../utils/date';

const show = (n: number | null) => (n === null ? '—' : n.toLocaleString());

export default function AdminUsersScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const { isAdmin, checked } = useIsAdmin(user?.id);
  const [counts, setCounts] = useState<UserCounts | null>(null);
  const [app, setApp] = useState<AppCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, a] = await Promise.all([getUserCounts(), getAppCounts().catch(() => null)]);
      setCounts(u);
      setApp(a);
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
        ...(app
          ? [
              { label: 'Wardrobe items', value: app.wardrobe },
              { label: 'Posts & polls', value: app.posts },
              { label: 'Circles', value: app.circles },
            ]
          : []),
      ]
    : [];
  const ads = adStatuses();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📊 Admin tracking</Text>
      </View>
      {!checked ? (
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      ) : !isAdmin ? (
        <Text style={styles.empty}>Admins only.</Text>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
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

          <Text style={styles.section}>📺 Ads on this phone</Text>
          {ads.length ? (
            ads.map(a => (
              <Text key={a.slot} style={styles.row}>
                {a.ok ? '✅' : '⚠️'} {a.slot}: {a.message} · {timeAgo(new Date(a.at))}
              </Text>
            ))
          ) : (
            <Text style={styles.row}>No ad requested yet in this session. Open Feed, Circles or Astro, then come back.</Text>
          )}

          <Text style={styles.section}>🧩 Features</Text>
          {TRACKED_FEATURES.map(f => (
            <View key={f.title} style={styles.feature}>
              <Text style={styles.featureTitle}>
                {f.title}
                {f.pr ? <Text style={styles.featurePr}>  #{f.pr}</Text> : null}
              </Text>
              <Text style={styles.featureStatus}>{FEATURE_STATUS_LABEL[f.status]}</Text>
              {f.note ? <Text style={styles.featureNote}>{f.note}</Text> : null}
            </View>
          ))}

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
    section: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
    row: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: 4 },
    feature: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    featureTitle: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: fontWeight.semiBold },
    featurePr: { color: colors.textSecondary, fontWeight: fontWeight.regular },
    featureStatus: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
    featureNote: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
  }),
);
