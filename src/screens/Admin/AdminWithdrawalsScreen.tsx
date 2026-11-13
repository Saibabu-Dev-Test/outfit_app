// Admin > Earn UPI withdrawals: pending first. Mark paid (after sending the money by UPI) or reject.
// Admins only (firestore.rules: withdrawals/{id} update by isAdmin()).
import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import EarnShell from '../Earn/EarnShell';
import { ui } from '../Earn/earnUi';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import { AdminWithdrawal, decideWithdrawal, getWithdrawalsForAdmin } from '../../services/earnApi';
import { timeAgo } from '../../utils/date';

const pendingFirst = <T extends { status: string }>(a: T, b: T) =>
  (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1);

export default function AdminWithdrawalsScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const uid = user?.id || '';
  const { isAdmin, checked } = useIsAdmin(uid);
  const [wds, setWds] = useState<AdminWithdrawal[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setError(null);
    try {
      const w = await getWithdrawalsForAdmin();
      setWds([...w].sort(pendingFirst));
    } catch (e: any) {
      setError(e?.message || 'Could not load withdrawals.');
      setWds([]);
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
      <EarnShell title="UPI withdrawals" navigation={navigation}>
        <View style={ui.scroll}>
          <Text style={ui.body}>Admins only.</Text>
        </View>
      </EarnShell>
    );
  }

  return (
    <EarnShell title="UPI withdrawals" navigation={navigation}>
      <ScrollView
        contentContainerStyle={ui.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }>
        {error ? <Text style={ui.bad}>{error}</Text> : null}
        {wds && !wds.length ? <Text style={ui.muted}>No withdrawal requests.</Text> : null}
        {(wds || []).map(w => (
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
                <TouchableOpacity
                  style={ui.btnGhost}
                  disabled={!!busy}
                  onPress={() => run(w.id, () => decideWithdrawal(w.id, 'rejected', uid))}>
                  <Text style={ui.btnGhostText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </EarnShell>
  );
}
