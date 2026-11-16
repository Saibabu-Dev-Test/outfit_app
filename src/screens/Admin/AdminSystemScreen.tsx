// Admin > System (owner only): which data backend is active, today's free-tier usage (Firestore,
// D1, photo storage chain), Worker health, earn per partner, users and pending UPI withdrawals.
// Read-only. The Worker checks the owner email from the verified Firebase token on its side too.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import EarnShell from '../Earn/EarnShell';
import { ui } from '../Earn/earnUi';
import { formatBytes } from '../../utils/storageEstimate';
import { FIRESTORE_FREE, D1_FREE, WORKER_URL } from '../../config/backend';
import { PARTNER_LABEL, Partner, SystemSnapshot, getSystemSnapshot, isOwnerUser, nearLimit, pct } from '../../services/adminSystem';

const PARTNERS: Partner[] = ['bitlabs', 'cpx', 'offerwall'];
const n = (v: number | null | undefined) => (typeof v === 'number' ? v.toLocaleString('en-IN') : '–');

function Usage({ label, used, limit, bytes }: { label: string; used: number | null | undefined; limit: number; bytes?: boolean }) {
  const p = pct(used, limit);
  return (
    <View style={styles.usage}>
      <View style={ui.row}>
        <Text style={[ui.body, ui.flex1]}>{label}</Text>
        <Text style={nearLimit(used, limit) ? ui.bad : ui.body}>
          {bytes ? (typeof used === 'number' ? formatBytes(used) : '–') : n(used)} / {bytes ? formatBytes(limit) : n(limit)} ({p}%)
        </Text>
      </View>
      <View style={ui.barBg}>
        <View style={[ui.barFill, { width: `${Math.min(100, p)}%` }]} />
      </View>
    </View>
  );
}

export default function AdminSystemScreen({ navigation }: { navigation: any }) {
  const owner = isOwnerUser();
  const [snap, setSnap] = useState<SystemSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!owner) return;
    setLoading(true);
    try {
      setSnap(await getSystemSnapshot());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [owner]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!owner) {
    return (
      <EarnShell title="🖥️ System" navigation={navigation}>
        <View style={ui.scroll}>
          <Text style={ui.body}>Owner only.</Text>
        </View>
      </EarnShell>
    );
  }

  const s = snap?.server;
  const backend = s?.backend || snap?.backendHere;
  return (
    <EarnShell title="🖥️ System" navigation={navigation}>
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
        {loading && !snap ? <ActivityIndicator /> : null}
        {snap ? (
          <>
            <View style={ui.card}>
              <Text style={ui.h2}>Data backend: {backend === 'd1' ? 'Cloudflare D1 (fallback)' : 'Firestore'}</Text>
              <Text style={ui.muted}>
                {s ? `Reason: ${s.reason}. ` : ''}This phone: {snap.backendHere}. Switches to D1 at {Math.round((s?.switchAt || 0.95) * 100)}% of
                Firestore's free daily quota or when Firestore says quota exhausted. Old data keeps loading from Firestore.
              </Text>
            </View>

            <View style={ui.card}>
              <Text style={ui.h2}>Worker</Text>
              <Text style={snap.health.ok ? ui.good : ui.bad}>
                {snap.health.ok ? `● Healthy · ${snap.health.ms} ms · v${snap.health.version}` : `● Down: ${snap.health.error || 'no answer'}`}
              </Text>
              <Text style={ui.muted}>{WORKER_URL}</Text>
              {s ? <Text style={ui.muted}>Firestore mirror of earn credits: {s.worker.firebaseServiceAccount ? 'on' : 'off (FIREBASE_SA_JSON not set)'}</Text> : null}
              {snap.serverError ? <Text style={ui.bad}>{snap.serverError}</Text> : null}
            </View>

            <View style={ui.card}>
              <Text style={ui.h2}>Firestore today (Spark){s?.firestore.exhausted ? ' · QUOTA EXHAUSTED' : ''}</Text>
              <Usage label="Reads" used={s?.firestore.reads} limit={FIRESTORE_FREE.reads} />
              <Usage label="Writes" used={s?.firestore.writes} limit={FIRESTORE_FREE.writes} />
              <Text style={ui.muted}>Counted by the app on its main paths (estimate). Resets at midnight Pacific ({s?.firestore.day || '–'}).</Text>
            </View>

            <View style={ui.card}>
              <Text style={ui.h2}>Cloudflare D1 today (free)</Text>
              <Usage label="Rows read" used={s?.d1.reads} limit={D1_FREE.reads} />
              <Usage label="Rows written" used={s?.d1.writes} limit={D1_FREE.writes} />
              <Usage label="Storage" used={s?.d1.storageBytes ?? null} limit={D1_FREE.storageBytes} bytes />
              <Text style={ui.muted}>
                Posts {n(s?.d1.rows?.posts)} · votes {n(s?.d1.rows?.votes)} · coin events {n(s?.d1.rows?.coinEvents)} · earn entries{' '}
                {n(s?.d1.rows?.earnings)}. Resets 00:00 UTC ({s?.d1.day || '–'}).
              </Text>
            </View>

            <View style={ui.card}>
              <Text style={ui.h2}>Photo storage chain</Text>
              {(snap.chain || []).map(r => (
                <Usage key={r.id} label={`${r.name} · ${r.status} · ${n(r.fileCount)} files`} used={r.bytesUsed} limit={r.freeBytes} bytes />
              ))}
              {!snap.chain ? <Text style={ui.muted}>Could not read stats/storage/providers.</Text> : null}
            </View>

            <View style={ui.card}>
              <Text style={ui.h2}>Earn partners</Text>
              {PARTNERS.map(p => {
                const e = s?.earn?.[p];
                const ready = !!e?.configured && snap.appPartners[p];
                return (
                  <View key={p} style={styles.partner}>
                    <Text style={ui.body}>
                      <Text style={ready ? ui.good : ui.bad}>{ready ? '● ' : '○ '}</Text>
                      {PARTNER_LABEL[p]} · server secret {e?.configured ? 'set' : 'missing'} · app link {snap.appPartners[p] ? 'set' : 'missing'}
                    </Text>
                    <Text style={ui.muted}>
                      Postbacks today: {n(e?.postbacksToday.ok)} ok, {n(e?.postbacksToday.rejected)} rejected, {n(e?.postbacksToday.error)} errors
                      {e?.postbacksToday.not_configured ? `, ${n(e.postbacksToday.not_configured)} while not configured` : ''}
                    </Text>
                    <Text style={ui.muted}>
                      Pending {n(e?.pendingCoins)} coins · approved {n(e?.approvedCoins)} coins · reversed {n(e?.reversedCount)} · owner share ₹
                      {(e?.ownerRupees || 0).toFixed(2)}
                    </Text>
                  </View>
                );
              })}
              <Text style={ui.muted}>From the Worker's D1 earn ledger (where postbacks are recorded).</Text>
            </View>

            <View style={ui.card}>
              <Text style={ui.h2}>Users</Text>
              <Text style={ui.body}>
                Total {n(snap.users.total)} · new today {n(snap.users.newToday)} · active today {n(s?.users.activeToday)}
              </Text>
              <Text style={ui.muted}>Today = India time. Active = opened the app (counted by the Worker).</Text>
              {snap.users.error ? <Text style={ui.bad}>{snap.users.error}</Text> : null}
            </View>

            <TouchableOpacity style={ui.card} onPress={() => navigation.navigate('AdminWithdrawals')} activeOpacity={0.8}>
              <Text style={ui.h2}>Pending UPI withdrawals ›</Text>
              <Text style={snap.withdrawals.pending ? ui.bad : ui.body}>
                {n(snap.withdrawals.pending)} pending · ₹{snap.withdrawals.rupees.toFixed(2)}
              </Text>
              {snap.withdrawals.error ? <Text style={ui.bad}>{snap.withdrawals.error}</Text> : null}
            </TouchableOpacity>

            <Text style={ui.muted}>Updated {snap.at.toLocaleTimeString()} · pull down to refresh</Text>
          </>
        ) : null}
      </ScrollView>
    </EarnShell>
  );
}

const styles = StyleSheet.create({
  usage: { marginBottom: 8 },
  partner: { marginBottom: 10 },
});
