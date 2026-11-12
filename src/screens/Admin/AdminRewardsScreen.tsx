// Admin: reward claims waiting for approval. Approve, or reject (the user's coins come back).
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import { RewardClaim, decideClaim, getPendingClaims } from '../../services/monthlyTasksApi';
import { formatDate, formatMonth } from '../../utils/formatDate';
import { useBottomSpace } from '../../hooks/useBottomSpace';

export default function AdminRewardsScreen({ navigation }: { navigation: any }) {
  const bottomPad = useBottomSpace();
  const { user } = useAuth();
  const uid = user?.id || '';
  const { isAdmin, checked } = useIsAdmin(uid);
  const [claims, setClaims] = useState<RewardClaim[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setClaims(await getPendingClaims());
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load claims.');
      setClaims([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) load();
    }, [isAdmin, load]),
  );

  const decide = (c: RewardClaim, approve: boolean) => {
    Alert.alert(approve ? 'Approve reward?' : 'Reject reward?', `${c.title} for ${c.name} (🪙 ${c.cost.toLocaleString()})${approve ? '' : '\nThe coins go back to the user.'}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: approve ? 'Approve' : 'Reject',
        style: approve ? 'default' : 'destructive',
        onPress: async () => {
          setBusy(c.id);
          try {
            await decideClaim(c, approve, uid);
            setClaims(list => (list || []).filter(x => x.id !== c.id));
          } catch (e: any) {
            Alert.alert('Failed', e?.message || 'Please try again.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item: c }: { item: RewardClaim }) => (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: c.uid })}>
        <Text style={styles.name}>{c.name}</Text>
      </TouchableOpacity>
      <Text style={styles.sub}>
        {c.title} · 🪙 {c.cost.toLocaleString()} · {formatMonth(c.month)}
        {c.createdAt ? ` · ${formatDate(c.createdAt)}` : ''}
      </Text>
      <View style={styles.btns}>
        {busy === c.id ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <TouchableOpacity style={[styles.btn, styles.ok]} onPress={() => decide(c, true)}>
              <Text style={styles.btnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.no]} onPress={() => decide(c, false)}>
              <Text style={styles.btnText}>Reject</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🎁 Reward claims</Text>
      </View>
      {!checked || (isAdmin && claims === null) ? (
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      ) : !isAdmin ? (
        <Text style={styles.empty}>Admins only.</Text>
      ) : (
        <FlatList
          data={claims || []}
          keyExtractor={c => c.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : undefined}
          ListEmptyComponent={<Text style={styles.empty}>No claims waiting. 🎉</Text>}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
  title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  spinner: { marginTop: spacing.xl },
  list: { padding: spacing.base },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  name: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.primary },
  sub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  btns: { flexDirection: 'row', marginTop: spacing.sm },
  btn: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6, marginRight: spacing.sm },
  ok: { backgroundColor: colors.success },
  no: { backgroundColor: colors.error },
  btnText: { color: '#FFFFFF', fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.sm },
}));
