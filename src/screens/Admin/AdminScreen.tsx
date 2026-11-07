// Moderation for users/{uid}.role == 'admin': reports and every circle (private ones too)
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getMyRole } from '../../services/userApi';
import { Report, getReports, deleteReport } from '../../services/moderationApi';
import { Circle, getAllCircles, deleteCircle, deleteMessageById } from '../../services/circlesApi';
import { deletePost } from '../../services/feedApi';
import { timeAgo } from '../../utils/date';

type TabKey = 'reports' | 'circles';

export default function AdminScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const uid = user?.id;
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [tab, setTab] = useState<TabKey>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getMyRole(uid);
    setRole(r);
    if (r !== 'admin') {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const errs: string[] = [];
    try {
      setReports(await getReports());
    } catch (e: any) {
      errs.push(e?.message);
    }
    try {
      setCircles(await getAllCircles());
    } catch (e: any) {
      errs.push(e?.message);
    }
    setError(errs.length ? errs[0] : null);
    setLoading(false);
    setRefreshing(false);
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const circleName = (id: string | null) => {
    if (!id) return null;
    const c = circles.find(x => x.id === id);
    return c ? `${c.emoji} ${c.name}${c.isPrivate ? ' 🔒' : ''}` : 'Deleted or unknown circle';
  };

  const run = async (id: string, fn: () => Promise<void>, done?: string) => {
    setBusyId(id);
    try {
      await fn();
      if (done) Alert.alert('Done', done);
      await load();
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const confirm = (title: string, onOk: () => void) =>
    Alert.alert(title, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onOk },
    ]);

  const renderReport = ({ item }: { item: Report }) => {
    const kind = item.postId ? 'Post' : item.messageId ? 'Message' : 'Circle';
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.kind}>{kind}</Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>
        <Text style={styles.reason}>{item.reason}</Text>
        {item.circleId ? <Text style={styles.meta}>{circleName(item.circleId)}</Text> : null}
        <Text style={styles.meta}>Reporter: {item.reporterId.slice(0, 8)}…</Text>
        <View style={styles.btnRow}>
          {item.circleId ? (
            <TouchableOpacity
              style={styles.btn}
              onPress={() => navigation.navigate('CircleChat', { circleId: item.circleId })}>
              <Text style={styles.btnText}>Open chat</Text>
            </TouchableOpacity>
          ) : null}
          {item.messageId && item.circleId ? (
            <TouchableOpacity
              style={[styles.btn, styles.btnDanger]}
              onPress={() =>
                confirm('Delete this message?', () =>
                  run(item.id, async () => {
                    await deleteMessageById(item.circleId as string, item.messageId as string);
                    await deleteReport(item.id);
                  }),
                )
              }>
              <Text style={styles.btnDangerText}>Delete message</Text>
            </TouchableOpacity>
          ) : null}
          {item.postId ? (
            <TouchableOpacity
              style={[styles.btn, styles.btnDanger]}
              onPress={() =>
                confirm('Delete this post?', () =>
                  run(item.id, async () => {
                    await deletePost(item.postId as string);
                    await deleteReport(item.id);
                  }),
                )
              }>
              <Text style={styles.btnDangerText}>Delete post</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.btn} onPress={() => run(item.id, () => deleteReport(item.id))}>
            {busyId === item.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.btnText}>Dismiss</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCircle = ({ item }: { item: Circle }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.circleName} numberOfLines={1}>
          {item.emoji} {item.name} {item.isPrivate ? '🔒' : ''}
        </Text>
        <Text style={styles.time}>{item.memberIds.length} members</Text>
      </View>
      {item.description ? (
        <Text style={styles.meta} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('CircleChat', { circleId: item.id })}>
          <Text style={styles.btnText}>Open (read-only)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnDanger]}
          onPress={() => confirm(`Delete "${item.name}"?`, () => run(item.id, () => deleteCircle(item), 'Circle deleted.'))}>
          {busyId === item.id ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <Text style={styles.btnDangerText}>Delete circle</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.back}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.title}>🛡️ Admin</Text>
    </View>
  );

  if (loading || role === undefined) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {header}
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (role !== 'admin') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {header}
        <Text style={styles.empty}>Admins only.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle="dark-content"
        {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})}
      />
      {header}
      <View style={styles.tabs}>
        {(['reports', 'circles'] as TabKey[]).map(k => (
          <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabActive]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
              {k === 'reports' ? `Reports (${reports.length})` : `All circles (${circles.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList<any>
        data={tab === 'reports' ? reports : circles}
        keyExtractor={x => x.id}
        renderItem={tab === 'reports' ? renderReport : renderCircle}
        contentContainerStyle={styles.list}
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
        ListEmptyComponent={
          <Text style={styles.empty}>{tab === 'reports' ? 'No open reports 🎉' : 'No circles yet.'}</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  spinner: { marginTop: spacing.xxxl },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    backgroundColor: colors.divider,
    borderRadius: borderRadius.full,
    padding: 4,
    marginBottom: spacing.sm,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.full, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surface },
  tabText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.semiBold },
  tabTextActive: { color: colors.primary, fontWeight: fontWeight.bold },
  error: { color: colors.error, textAlign: 'center', padding: spacing.sm, fontSize: fontSize.sm },
  list: { padding: spacing.base, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kind: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  time: { fontSize: fontSize.xs, color: colors.textMuted },
  reason: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary, marginTop: 4 },
  circleName: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  meta: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  btn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  btnText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  btnDanger: { borderColor: colors.error },
  btnDangerText: { color: colors.error, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl },
});
