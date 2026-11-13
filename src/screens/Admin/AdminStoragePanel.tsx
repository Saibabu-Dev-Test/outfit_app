// Admin › Storage tab: where data lives, document counts (server count aggregations), ESTIMATED
// bytes (sampled), free-tier limits with a usage bar, top users by photos (on demand) and this
// phone's local cache. Everything is read-only and Spark-friendly (services/adminStorage).
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../../theme';
import {
  STORAGE_KINDS,
  StorageReport,
  TopUser,
  LocalCacheInfo,
  getLocalCacheInfo,
  getStorageReport,
  getTopUsers,
  TOP_USERS_MAX,
} from '../../services/adminStorage';
import { FREE_TIER, formatBytes, percentOf } from '../../utils/storageEstimate';
import { timeAgo } from '../../utils/date';
import NameWithAge from '../../components/NameWithAge';
import { CHAIN, ProviderId, VIDEO_UPLOADS_ENABLED, totalFreeBytes } from '../../config/storage';
import { ProviderStats, dailyRate, getStorageStats, pickProvider, providerStatus } from '../../services/photoStorage';

function Bar({ pct }: { pct: number }) {
  const p = Math.min(100, Math.max(0, pct));
  const tone = p >= 85 ? colors.error : p >= 60 ? colors.warning : colors.success;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.max(p, p > 0 ? 1 : 0)}%`, backgroundColor: tone }]} />
    </View>
  );
}

export default function AdminStoragePanel({ refreshKey, onNavigateUser }: { refreshKey: number; onNavigateUser?: (uid: string) => void }) {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [local, setLocal] = useState<LocalCacheInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [top, setTop] = useState<{ users: TopUser[]; scanned: number; readsUsed: number } | null>(null);
  const [topBusy, setTopBusy] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  // Photo storage chain (config/storage.ts): usage per free provider; read only, nothing is moved
  const [chain, setChain] = useState<{ stats: Record<string, ProviderStats>; activeId: ProviderId | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, l] = await Promise.all([getStorageReport(), getLocalCacheInfo().catch(() => null)]);
      setReport(r);
      setLocal(l);
      getStorageStats(0)
        .then(async st => setChain({ stats: st, activeId: (await pickProvider('image', st).catch(() => null))?.id || null }))
        .catch(() => undefined);
    } catch (e: any) {
      setError(e?.message || 'Could not load storage info.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const avgOf = (name: string) => report?.collections.find(c => c.name === name)?.avgBytes || 0;
  const loadTop = async () => {
    setTopBusy(true);
    setTopError(null);
    try {
      setTop(await getTopUsers(avgOf('wardrobe'), avgOf('posts')));
    } catch (e: any) {
      setTopError(e?.message || 'Could not load top users.');
    }
    setTopBusy(false);
  };

  const storagePct = report ? percentOf(report.totalEstBytes, FREE_TIER.storageBytes) : 0;

  return (
    <View>
      {/* Where things are stored */}
      <View style={styles.card}>
        <Text style={styles.kind}>Where data is stored</Text>
        {STORAGE_KINDS.map(k => (
          <View key={k.title} style={styles.kindRow}>
            <Text style={styles.kindIcon}>{k.icon}</Text>
            <View style={styles.flex1}>
              <Text style={styles.rowTitle}>{k.title}</Text>
              <Text style={styles.meta}>{k.body}</Text>
            </View>
          </View>
        ))}
      </View>

      {loading && !report ? <ActivityIndicator style={styles.spinner} color={colors.primary} /> : null}
      {error ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.btn} onPress={load}>
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {report ? (
        <>
          {/* Free tier */}
          <View style={styles.card}>
            <Text style={styles.kind}>Firestore free tier (Spark)</Text>
            <View style={styles.limitRow}>
              <Text style={styles.rowTitle}>Stored data (estimate)</Text>
              <Text style={styles.value}>
                ~{formatBytes(report.totalEstBytes)} / 1 GiB · {storagePct}%
              </Text>
            </View>
            <Bar pct={storagePct} />
            <Text style={styles.meta}>
              Estimate from sampled documents × counts; index storage not included, so real usage is somewhat higher.
            </Text>
            {[
              { label: 'Reads / day', limit: FREE_TIER.readsPerDay },
              { label: 'Writes / day', limit: FREE_TIER.writesPerDay },
              { label: 'Deletes / day', limit: FREE_TIER.deletesPerDay },
            ].map(x => (
              <View key={x.label} style={styles.limitRow}>
                <Text style={styles.rowTitle}>{x.label}</Text>
                <Text style={styles.value}>{x.limit.toLocaleString('en-IN')} free</Text>
              </View>
            ))}
            <Text style={styles.meta}>
              Today's reads / writes / deletes can't be measured from the app for free (Cloud Monitoring needs server
              credentials). See Firebase console › Firestore › Usage. This refresh used about{' '}
              {report.readsUsed.toLocaleString('en-IN')} reads ({percentOf(report.readsUsed, FREE_TIER.readsPerDay)}% of a
              day).
            </Text>
            <Bar pct={percentOf(report.readsUsed, FREE_TIER.readsPerDay)} />
          </View>

          {/* Per collection */}
          <View style={styles.card}>
            <Text style={styles.kind}>Collections</Text>
            <Text style={styles.meta}>Updated {timeAgo(report.at)} · pull down to refresh · sizes are estimates</Text>
            {report.collections.map(c => (
              <View key={c.name} style={styles.colRow}>
                <View style={styles.flex1}>
                  <Text style={styles.rowTitle}>{c.label}</Text>
                  <Text style={styles.meta} numberOfLines={2}>
                    {c.holds}
                  </Text>
                </View>
                <View style={styles.colRight}>
                  <Text style={styles.value}>{c.count === null ? '—' : c.count.toLocaleString('en-IN')} docs</Text>
                  <Text style={styles.metaRight}>
                    {c.error
                      ? c.error
                      : c.estBytes === null
                      ? ''
                      : `~${formatBytes(c.estBytes)}${c.avgBytes ? ` · ~${formatBytes(c.avgBytes)} each` : ''}`}
                  </Text>
                  {c.estBytes ? <Text style={styles.metaRight}>{percentOf(c.estBytes, FREE_TIER.storageBytes)}% of 1 GiB</Text> : null}
                </View>
              </View>
            ))}
            <Text style={styles.meta}>
              Not counted: subcollections (comments, likes, chat messages and their photos, activity). Wardrobe and post
              sizes include their media/full + media/clear photo docs.
            </Text>
          </View>

          {/* Top users */}
          <View style={styles.card}>
            <Text style={styles.kind}>Top users by photos</Text>
            <Text style={styles.meta}>
              Reads up to {TOP_USERS_MAX} users + 2 counts each (≈{(TOP_USERS_MAX * 3).toLocaleString('en-IN')} reads max), so it
              runs only when you tap.
            </Text>
            {topError ? <Text style={styles.error}>{topError}</Text> : null}
            {top ? (
              <>
                {top.users.map((u, i) => (
                  <TouchableOpacity key={u.uid} style={styles.colRow} onPress={() => onNavigateUser?.(u.uid)} activeOpacity={0.7}>
                    <Text style={styles.rank}>{i + 1}</Text>
                    <View style={styles.flex1}>
                      <NameWithAge uid={u.uid} name={u.name} style={styles.rowTitle} numberOfLines={1} />
                      <Text style={styles.meta}>
                        👗 {u.wardrobe} · 📰 {u.posts}
                      </Text>
                    </View>
                    <Text style={styles.value}>~{formatBytes(u.estBytes)}</Text>
                  </TouchableOpacity>
                ))}
                <Text style={styles.meta}>
                  {top.scanned} users scanned · ~{top.readsUsed.toLocaleString('en-IN')} reads · sizes = counts × average item size
                  (estimate)
                </Text>
              </>
            ) : null}
            <TouchableOpacity style={styles.btn} onPress={loadTop} disabled={topBusy}>
              {topBusy ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.btnText}>{top ? 'Refresh top users' : 'Find top users'}</Text>}
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      {/* Photo storage chain: new photos go to the first free provider with room */}
      <View style={styles.card}>
        <Text style={styles.kind}>Photo storage chain (free tiers)</Text>
        <Text style={styles.meta}>
          New photos go to the first provider below that is set up and under 95% of its free limit; when it fills up the next
          one takes over. Photos already saved are never moved or deleted. Wardrobe photos are kept; circle chat photos are
          hidden after 60 days. Videos: {VIDEO_UPLOADS_ENABLED ? 'on' : 'off (not enabled yet)'}.
        </Text>
        {chain ? (
          <>
            <View style={styles.limitRow}>
              <Text style={styles.rowTitle}>Counted uploads</Text>
              <Text style={styles.value}>
                {formatBytes(Object.values(chain.stats).reduce((n, x) => n + x.bytesUsed, 0))} / {formatBytes(totalFreeBytes('image'))}
              </Text>
            </View>
            {CHAIN.map(p => {
              const st = chain.stats[p.id];
              const status = providerStatus(p, st, chain.activeId);
              const bytes = st?.bytesUsed || 0;
              const rate = dailyRate(st);
              const daysLeft = rate > 0 ? Math.max(0, Math.floor((p.freeBytes * 0.95 - bytes) / rate)) : null;
              return (
                <View key={p.id} style={styles.chainRow}>
                  <View style={styles.limitRow}>
                    <Text style={[styles.rowTitle, styles.flex1]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text
                      style={[
                        styles.value,
                        status === 'active' ? styles.good : status === 'full' ? styles.error : styles.metaInline,
                      ]}>
                      {status.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.meta}>
                    {formatBytes(bytes)} of {formatBytes(p.freeBytes)} · {st?.fileCount || 0} files
                    {daysLeft !== null ? ` · switches in ~${daysLeft} days` : ''}
                  </Text>
                  <Bar pct={percentOf(bytes, p.freeBytes)} />
                  <Text style={styles.meta}>{status === 'needs setup' ? `Setup: ${p.setupNote}` : p.freeNote}</Text>
                </View>
              );
            })}
          </>
        ) : (
          <Text style={styles.meta}>{loading ? 'Loading…' : 'Not available.'}</Text>
        )}
      </View>

      {/* This phone */}
      <View style={styles.card}>
        <Text style={styles.kind}>This phone (local cache)</Text>
        {local ? (
          <>
            <View style={styles.limitRow}>
              <Text style={styles.rowTitle}>AsyncStorage</Text>
              <Text style={styles.value}>
                {formatBytes(local.bytes)} · {local.keys} keys
              </Text>
            </View>
            {local.groups.map(g => (
              <View key={g.prefix} style={styles.limitRow}>
                <Text style={styles.meta} numberOfLines={1}>
                  {g.prefix}
                </Text>
                <Text style={styles.metaRight}>
                  {formatBytes(g.bytes)} · {g.keys}
                </Text>
              </View>
            ))}
            <Text style={styles.meta}>Sizes count characters (≈ bytes). Android's image cache is separate and not measured.</Text>
          </>
        ) : (
          <Text style={styles.meta}>{loading ? 'Measuring…' : 'Not available.'}</Text>
        )}
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm },
  kind: { fontSize: fontSize.sm, fontWeight: fontWeight.extraBold, color: colors.primary, marginBottom: spacing.xs, textTransform: 'uppercase' },
  kindRow: { flexDirection: 'row', paddingVertical: 6 },
  kindIcon: { fontSize: 18, width: 28 },
  flex1: { flex: 1 },
  rowTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semiBold, color: colors.textPrimary },
  value: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  meta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  metaRight: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2, textAlign: 'right' },
  limitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  colRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  colRight: { alignItems: 'flex-end', marginLeft: spacing.sm, maxWidth: '45%' },
  rank: { width: 24, fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textMuted },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden', marginVertical: 6 },
  barFill: { height: 8, borderRadius: 4 },
  error: { color: colors.error, fontSize: fontSize.sm, marginBottom: spacing.xs },
  btn: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: 10, alignItems: 'center' },
  btnText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  spinner: { marginVertical: spacing.lg },
  chainRow: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  good: { color: colors.success },
  metaInline: { color: colors.textMuted },
}));
