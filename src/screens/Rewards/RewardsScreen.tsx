// Me > 🪙 Rewards: coin balance, this month's tasks with progress bars (claim coins when done,
// optional "double with a short ad"), the reward catalog (redeem -> pending request for admins)
// and my past requests. Values: src/config/rewards.ts. Data: services/monthlyTasksApi.ts.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenShell from '../../components/ScreenShell';
import { ui } from '../../components/ui';
import KeyboardSafeView from '../../components/KeyboardSafeView';
import RewardedIntroModal from '../../ads/RewardedIntroModal';
import { useAuth } from '../../context/AuthContext';
import { DOUBLE_COINS_ENABLED, MONTHLY_TASKS, MonthlyTaskId, REWARD_CATALOG, RewardItem } from '../../config/rewards';
import {
  MonthState,
  Redemption,
  Wallet,
  claimTask,
  doubleTask,
  getMonthState,
  getMyRedemptions,
  getWallet,
  progressOf,
  redeemReward,
} from '../../services/monthlyTasksApi';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function RewardsScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const uid = user?.id || '';
  const [state, setState] = useState<MonthState | null>(null);
  const [wallet, setWallet] = useState<Wallet>({ coins: 0, earned: 0, spent: 0 });
  const [reqs, setReqs] = useState<Redemption[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [doubleFor, setDoubleFor] = useState<{ id: MonthlyTaskId; coins: number } | null>(null);
  const [redeemFor, setRedeemFor] = useState<RewardItem | null>(null);
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!uid) return;
    const [s, w, r] = await Promise.all([getMonthState(uid), getWallet(uid), getMyRedemptions(uid)]);
    setState(s);
    setWallet(w);
    setReqs(r);
    setRefreshing(false);
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const claim = async (id: MonthlyTaskId) => {
    setBusy(id);
    try {
      const coins = await claimTask(uid, id);
      await load();
      if (DOUBLE_COINS_ENABLED && !state?.doubled.includes(id)) setDoubleFor({ id, coins });
      else Alert.alert('Coins added', `+${coins} coins 🪙`);
    } catch (e: any) {
      Alert.alert('Could not claim', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const onDoubleDone = async (earned: boolean) => {
    const d = doubleFor;
    setDoubleFor(null);
    if (!d) return;
    if (earned) {
      const extra = await doubleTask(uid, d.id);
      if (extra) Alert.alert('Doubled!', `+${extra} more coins 🪙`);
      load();
    } else {
      Alert.alert('Coins added', `+${d.coins} coins 🪙`);
    }
  };

  const redeem = async () => {
    if (!redeemFor) return;
    setBusy(redeemFor.id);
    try {
      await redeemReward(uid, user?.name || 'User', redeemFor.id, contact, note);
      setRedeemFor(null);
      setNote('');
      Alert.alert('Request sent', 'Our team will check it and contact you. You can see the status below.');
      load();
    } catch (e: any) {
      Alert.alert('Could not redeem', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const monthName = state ? `${MONTHS[Number(state.month.slice(5, 7)) - 1]} ${state.month.slice(0, 4)}` : '';

  return (
    <ScreenShell title="Rewards" navigation={navigation}>
      <ScrollView
        contentContainerStyle={ui.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <View style={ui.card}>
          <Text style={ui.muted}>Your coins</Text>
          <Text style={ui.h1}>🪙 {wallet.coins.toLocaleString('en-IN')}</Text>
          <Text style={ui.muted}>
            Earned {wallet.earned.toLocaleString('en-IN')} · Spent {wallet.spent.toLocaleString('en-IN')}
          </Text>
        </View>

        <Text style={ui.h2}>Tasks for {monthName}</Text>
        {!state ? <ActivityIndicator /> : null}
        {state
          ? MONTHLY_TASKS.map(t => {
              const p = progressOf(state, t.id);
              return (
                <View key={t.id} style={ui.card}>
                  <View style={ui.row}>
                    <Text style={[ui.h2, ui.flex1]}>
                      {t.emoji} {t.title}
                    </Text>
                    <Text style={ui.muted}>+{t.coins} 🪙</Text>
                  </View>
                  <View style={ui.barBg}>
                    <View style={[ui.barFill, { width: `${Math.round(p.pct * 100)}%` }]} />
                  </View>
                  <View style={[ui.row, { marginTop: 8 }]}>
                    <Text style={[ui.muted, ui.flex1]}>
                      {p.count} / {p.target}
                    </Text>
                    {p.claimed ? (
                      <Text style={ui.good}>✓ Claimed</Text>
                    ) : (
                      <TouchableOpacity
                        style={[ui.btn, !p.done && ui.btnOff]}
                        disabled={!p.done || busy === t.id}
                        onPress={() => claim(t.id)}>
                        {busy === t.id ? <ActivityIndicator color="#fff" /> : <Text style={ui.btnText}>Claim</Text>}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          : null}
        <Text style={[ui.muted, { marginBottom: 12 }]}>New tasks every month. Unclaimed coins of a month can't be claimed later.</Text>

        <Text style={ui.h2}>Redeem</Text>
        {REWARD_CATALOG.map(r => {
          const can = wallet.coins >= r.coins;
          return (
            <View key={r.id} style={ui.card}>
              <View style={ui.row}>
                <Text style={{ fontSize: 28, marginRight: 10 }}>{r.emoji}</Text>
                <View style={ui.flex1}>
                  <Text style={ui.h2}>{r.title}</Text>
                  <Text style={ui.muted}>{r.detail}</Text>
                  <Text style={ui.body}>🪙 {r.coins.toLocaleString('en-IN')}</Text>
                </View>
                <TouchableOpacity style={[ui.btn, !can && ui.btnOff]} disabled={!can} onPress={() => setRedeemFor(r)}>
                  <Text style={ui.btnText}>Redeem</Text>
                </TouchableOpacity>
              </View>
              {!can ? (
                <View style={ui.barBg}>
                  <View style={[ui.barFill, { width: `${Math.min(100, Math.round((wallet.coins / r.coins) * 100))}%` }]} />
                </View>
              ) : null}
            </View>
          );
        })}

        {reqs.length ? <Text style={ui.h2}>My requests</Text> : null}
        {reqs.map(r => (
          <View key={r.id} style={ui.card}>
            <Text style={ui.h2}>{r.title}</Text>
            <Text style={r.status === 'rejected' ? ui.bad : r.status === 'pending' ? ui.muted : ui.good}>
              {r.status === 'pending'
                ? '⏳ Pending review'
                : r.status === 'approved'
                ? '✅ Approved'
                : r.status === 'fulfilled'
                ? '🎉 Sent'
                : '✖ Rejected (coins returned)'}
            </Text>
          </View>
        ))}
      </ScrollView>

      <RewardedIntroModal
        visible={!!doubleFor}
        title={doubleFor ? `+${doubleFor.coins} coins! Double them to ${doubleFor.coins * 2}?` : ''}
        onDone={onDoubleDone}
      />

      <Modal visible={!!redeemFor} transparent animationType="slide" onRequestClose={() => setRedeemFor(null)}>
        <KeyboardSafeView style={{ justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={[ui.card, { marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: 32 }]}>
            <Text style={ui.h2}>{redeemFor?.title}</Text>
            <Text style={ui.body}>🪙 {redeemFor?.coins.toLocaleString('en-IN')} coins will be held until the team reviews it.</Text>
            <Text style={[ui.muted, { marginTop: 10 }]}>Email or phone to send it to</Text>
            <TextInput style={ui.input} value={contact} onChangeText={setContact} placeholder="you@example.com / 98xxxxxxxx" autoCapitalize="none" />
            <Text style={ui.muted}>Size / colour / note (optional)</Text>
            <TextInput style={ui.input} value={note} onChangeText={setNote} placeholder="e.g. Shirt size M, blue" maxLength={300} />
            <View style={ui.row}>
              <TouchableOpacity style={[ui.btnGhost, ui.flex1, { marginRight: 8 }]} onPress={() => setRedeemFor(null)}>
                <Text style={ui.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ui.btn, ui.flex1]} onPress={redeem} disabled={busy === redeemFor?.id}>
                {busy === redeemFor?.id ? <ActivityIndicator color="#fff" /> : <Text style={ui.btnText}>Send request</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardSafeView>
      </Modal>
    </ScreenShell>
  );
}
