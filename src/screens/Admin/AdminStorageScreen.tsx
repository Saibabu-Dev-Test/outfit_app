// Admin > Storage: each photo-storage provider in the free-tier chain (config/storage.ts) with its
// usage, status (active / standby / full / needs setup) and a days-left estimate. Read only:
// photos are never moved or deleted from here.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenShell from '../../components/ScreenShell';
import { ui } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import { CHAIN, ProviderId, VIDEO_UPLOADS_ENABLED, totalFreeBytes } from '../../config/storage';
import { ProviderStats, dailyRate, getStorageStats, pickProvider, providerStatus } from '../../services/photoStorage';

const GB = 1024 * 1024 * 1024;
export const fmtBytes = (b: number) =>
  b >= GB ? `${(b / GB).toFixed(2)} GB` : b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

export default function AdminStorageScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const { isAdmin, checked } = useIsAdmin(user?.id);
  const [stats, setStats] = useState<Record<string, ProviderStats> | null>(null);
  const [activeId, setActiveId] = useState<ProviderId | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (force = false) => {
      if (!isAdmin) return;
      const s = await getStorageStats(force ? 0 : undefined);
      const active = await pickProvider('image', s).catch(() => null);
      setStats(s);
      setActiveId(active?.id || null);
      setRefreshing(false);
    },
    [isAdmin],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (checked && !isAdmin) {
    return (
      <ScreenShell title="Storage" navigation={navigation}>
        <View style={ui.scroll}>
          <Text style={ui.body}>Admins only.</Text>
        </View>
      </ScreenShell>
    );
  }

  const used = stats ? Object.values(stats).reduce((s, x) => s + x.bytesUsed, 0) : 0;

  return (
    <ScreenShell title="Storage" navigation={navigation}>
      <ScrollView
        contentContainerStyle={ui.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}>
        <View style={ui.card}>
          <Text style={ui.muted}>All free tiers (photos)</Text>
          <Text style={ui.h1}>
            {fmtBytes(used)} / {fmtBytes(totalFreeBytes('image'))}
          </Text>
          <Text style={ui.muted}>Videos: {VIDEO_UPLOADS_ENABLED ? 'on' : 'off (not enabled yet)'}</Text>
        </View>
        {!stats ? <ActivityIndicator /> : null}
        {stats
          ? CHAIN.map(p => {
              const s = stats[p.id];
              const st = providerStatus(p, s, activeId);
              const bytes = s?.bytesUsed || 0;
              const pct = p.freeBytes ? Math.min(100, (bytes / p.freeBytes) * 100) : 0;
              const rate = dailyRate(s);
              const daysLeft = rate > 0 ? Math.floor((p.freeBytes - bytes) / rate) : null;
              return (
                <View key={p.id} style={ui.card}>
                  <View style={ui.row}>
                    <Text style={[ui.h2, ui.flex1]}>{p.name}</Text>
                    <Text style={st === 'active' ? ui.good : st === 'full' ? ui.bad : ui.muted}>{st.toUpperCase()}</Text>
                  </View>
                  <Text style={ui.body}>
                    {fmtBytes(bytes)} of {fmtBytes(p.freeBytes)} · {s?.fileCount || 0} files
                  </Text>
                  <View style={ui.barBg}>
                    <View style={[ui.barFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={ui.muted}>
                    {p.freeNote}
                    {daysLeft !== null ? ` · about ${daysLeft} days left at the current rate` : ''}
                  </Text>
                  {st === 'needs setup' ? <Text style={ui.muted}>Setup: {p.setupNote}</Text> : null}
                </View>
              );
            })
          : null}
      </ScrollView>
    </ScreenShell>
  );
}
