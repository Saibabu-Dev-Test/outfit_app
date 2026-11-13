// Admin > Reward requests: coin redemptions (vouchers / clothes, monthly tasks) and Earn UPI
// withdrawals. Pending first. Approve / reject / mark fulfilled or paid. Admins only.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenShell from '../../components/ScreenShell';
import { ui } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import { Redemption, decideRedemption, getRedemptionsForAdmin } from '../../services/monthlyTasksApi';
import { AdminWithdrawal, decideWithdrawal, getWithdrawalsForAdmin } from '../../services/earnApi';
import { timeAgo } from '../../utils/date';

const pendingFirst = <T extends { status: string }>(a: T, b: T) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1);

export default function AdminRewardRequestsScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const uid = user?.id || '';
  const { isAdmin, checked } = useIsAdmin(uid);
  const [reqs, setReqs] = useState<Redemption[] | null>(null);
  const [wds, setWds] = useState<AdminWithdrawal[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setError(null);
    try {
      const [r, w] = await Promise.all([getRedemptionsForAdmin(), getWithdrawalsForAdmin().catch(() => [])]);
      setReqs([...r].sort(pendingFirst));
      setWds([...w].sort(pendingFirst));
    } catch (e: any) {
      setError(e?.message || 'Could not load requests.');
      setReqs([]);
    } finally {
      setRefreshing(false);
    }
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e: any) {
      Alert.alert('Not saved', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (checked && !isAdmin) {
    return (
      <ScreenShell title="Reward requests" navigation={navigation}>
        <View style={ui.scroll}>
          <Text style={ui.body}>Admins only.</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Reward requests" navigation={navigation}>
      <ScrollView
        contentContainerStyle={ui.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {error ? <Text style={ui.bad}>{error}</Text> : null}
        <Text style={ui.h2}>UPI withdrawals (Earn)</Text>
        {!wds.length ? <Text style={ui.muted}>No withdrawal requests.</Text> : null}
        {wds.map(w => (
          <View key={w.id} style={ui.card}>
            <Text style={ui.h2}>
              ₹{w.rupees} · {w.upi}
            </Text>
            <Text style={ui.muted}>
              {w.status.toUpperCase()} · {w.coins} coins · {timeAgo(w.createdAt)} · user {w.uid.slice(0, 8)}
            </Text>
            {w.status === 'pending' ? (
              <View style={[ui.row, { marginTop: 8 }]}>
                <TouchableOpacity
                  style={[ui.btn, { marginRight: 8 }]}
                  disabled={!!busy}
                  onPress={() =>
                    Alert.alert('Mark as paid?', `Only after you sent ₹${w.rupees} to ${w.upi}. Check the user's withdrawable balance first.`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Paid', onPress: () => run(w.id, () => decideWithdrawal(w.id, 'paid', uid)) },
                    ])
                  }>
                  <Text style={ui.btnText}>Paid</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ui.btnGhost} disabled={!!busy} onPress={() => run(w.id, () => decideWithdrawal(w.id, 'rejected', uid))}>
                  <Text style={ui.btnGhostText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))}

        <Text style={[ui.h2, { marginTop: 12 }]}>Coin rewards (vouchers / clothes)</Text>
        {!reqs ? <ActivityIndicator /> : null}
        {reqs && !reqs.length ? <Text style={ui.muted}>No reward requests.</Text> : null}
        {(reqs || []).map(r => (
          <View key={r.id} style={ui.card}>
            <Text style={ui.h2}>{r.title}</Text>
            <Text style={ui.body}>
              {r.userName} · {r.contact}
            </Text>
            {r.note ? <Text style={ui.body}>“{r.note}”</Text> : null}
            <Text style={ui.muted}>
              {r.status.toUpperCase()} · 🪙 {r.coins} · {timeAgo(r.createdAt)}
            </Text>
            {r.status === 'pending' || r.status === 'approved' ? (
              <View style={[ui.row, { marginTop: 8 }]}>
                {r.status === 'pending' ? (
                  <TouchableOpacity style={[ui.btn, { marginRight: 8 }]} disabled={!!busy} onPress={() => run(r.id, () => decideRedemption(r, 'approved', uid))}>
                    <Text style={ui.btnText}>Approve</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[ui.btn, { marginRight: 8 }]} disabled={!!busy} onPress={() => run(r.id, () => decideRedemption(r, 'fulfilled', uid))}>
                    <Text style={ui.btnText}>Fulfilled</Text>
                  </TouchableOpacity>
                )}
                {r.status === 'pending' ? (
                  <TouchableOpacity style={ui.btnGhost} disabled={!!busy} onPress={() => run(r.id, () => decideRedemption(r, 'rejected', uid))}>
                    <Text style={ui.btnGhostText}>Reject (refund coins)</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}
