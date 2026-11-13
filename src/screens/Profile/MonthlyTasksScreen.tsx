// Monthly tasks (7) and coin rewards (4). Progress comes from this month's daily tasks and coin
// events; a finished task is claimed once a month for coins; rewards are redeemed with coins and
// wait for an admin's approval (a rejected claim gives the coins back).
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { MONTHLY_TASKS, REWARDS, TASK_COINS, Reward, MonthlyTask, canRedeem, coinBalance, monthKey, taskProgress } from '../../config/monthlyTasks';
import { MonthState, RewardClaim, claimTaskCoins, getMonthState, getMyClaims, redeemReward } from '../../services/monthlyTasksApi';
import { formatMonth } from '../../utils/formatDate';
import { useBottomSpace } from '../../hooks/useBottomSpace';

const STATUS_TEXT: Record<string, string> = { pending: '⏳ Waiting for approval', approved: '✅ Approved', rejected: '↩️ Rejected · coins returned' };

export default function MonthlyTasksScreen({ navigation }: { navigation: any }) {
  const bottomPad = useBottomSpace();
  const { user } = useAuth();
  const uid = user?.id || '';
  const [state, setState] = useState<MonthState | null>(null);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    const [s, c] = await Promise.all([getMonthState(uid, monthKey()), getMyClaims(uid)]);
    setState(s);
    setClaims(c);
    setRefreshing(false);
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const claim = async (t: MonthlyTask) => {
    if (!state || busy) return;
    setBusy(t.id);
    try {
      await claimTaskCoins(uid, t, state);
      await load();
    } catch (e: any) {
      Alert.alert('Could not claim', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const redeem = (r: Reward) => {
    if (!state || busy) return;
    Alert.alert(`${r.emoji} ${r.title}`, `Use ${r.cost.toLocaleString()} coins? The Outfit team approves it (coins come back if it is rejected).`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Redeem',
        onPress: async () => {
          setBusy(r.id);
          try {
            await redeemReward(uid, user?.name || '', r, state.month);
            await load();
          } catch (e: any) {
            Alert.alert('Could not redeem', e?.message || 'Please try again.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const balance = state ? coinBalance(state.coins, state.coinsSpent) : 0;
  const claimedThisMonth = new Set(claims.filter(c => c.month === state?.month).map(c => c.rewardId));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle={statusBarStyle()} {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Monthly tasks 🎯</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
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
        {!state ? (
          <ActivityIndicator style={styles.spinner} color={colors.primary} />
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroValue}>🪙 {balance.toLocaleString()}</Text>
              <Text style={styles.heroLabel}>coins to spend · {state.coins.toLocaleString()} earned in total</Text>
            </View>

            <Text style={styles.section}>This month · +{TASK_COINS} coins each</Text>
            <View style={styles.card}>
              {MONTHLY_TASKS.map(t => {
                const p = taskProgress(t, state.counts);
                const claimed = state.claimed.has(t.id);
                return (
                  <View key={t.id} style={styles.row}>
                    <Text style={styles.rowIcon}>{t.emoji}</Text>
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowTitle, claimed && styles.rowTitleDone]}>{t.title}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${Math.round(p.pct * 100)}%` }]} />
                      </View>
                      <Text style={styles.rowSub}>
                        {p.done}/{t.target}
                      </Text>
                    </View>
                    {claimed ? (
                      <Text style={styles.done}>✓ +{TASK_COINS}</Text>
                    ) : p.complete ? (
                      <TouchableOpacity style={styles.actionBtn} onPress={() => claim(t)} disabled={!!busy}>
                        {busy === t.id ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Text style={styles.actionText}>Claim</Text>}
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.pts}>+{TASK_COINS}</Text>
                    )}
                  </View>
                );
              })}
            </View>

            <Text style={styles.section}>Rewards</Text>
            <View style={styles.card}>
              {REWARDS.map(r => {
                const taken = claimedThisMonth.has(r.id);
                const can = canRedeem(r, state.coins, state.coinsSpent);
                return (
                  <View key={r.id} style={styles.row}>
                    <Text style={styles.rowIcon}>{r.emoji}</Text>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{r.title}</Text>
                      <Text style={styles.rowSub}>{r.description}</Text>
                    </View>
                    {taken ? (
                      <Text style={styles.done}>This month ✓</Text>
                    ) : (
                      <TouchableOpacity
                        style={[styles.actionBtn, !can && styles.actionOff]}
                        onPress={() => (can ? redeem(r) : Alert.alert('Not enough coins', `You need ${(r.cost - balance).toLocaleString()} more coins.`))}
                        disabled={!!busy}>
                        {busy === r.id ? (
                          <ActivityIndicator size="small" color={colors.onPrimary} />
                        ) : (
                          <Text style={styles.actionText}>🪙 {r.cost.toLocaleString()}</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>

            {claims.length ? (
              <>
                <Text style={styles.section}>My rewards</Text>
                <View style={styles.card}>
                  {claims.map(c => (
                    <View key={c.id} style={styles.row}>
                      <View style={styles.rowBody}>
                        <Text style={styles.rowTitle}>{c.title}</Text>
                        <Text style={styles.rowSub}>
                          {formatMonth(c.month)} · 🪙 {c.cost.toLocaleString()} · {STATUS_TEXT[c.status]}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
  title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl },
  spinner: { marginTop: spacing.xl },
  hero: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: spacing.lg, alignItems: 'center' },
  heroValue: { fontSize: 32, fontWeight: fontWeight.extraBold, color: colors.onPrimary },
  heroLabel: { fontSize: fontSize.sm, color: colors.onPrimary, opacity: 0.85, textAlign: 'center' },
  section: { fontSize: fontSize.md, fontWeight: fontWeight.extraBold, color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowIcon: { fontSize: 22, width: 34 },
  rowBody: { flex: 1, marginRight: 8 },
  rowTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  rowTitleDone: { color: colors.textSecondary },
  rowSub: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.divider, marginTop: 4, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.success },
  actionBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, minWidth: 64, alignItems: 'center' },
  actionOff: { opacity: 0.45 },
  actionText: { color: colors.onPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  pts: { fontSize: fontSize.sm, fontWeight: fontWeight.extraBold, color: colors.warning, minWidth: 46, textAlign: 'right' },
  done: { fontSize: fontSize.sm, fontWeight: fontWeight.extraBold, color: colors.success, textAlign: 'right' },
}));
