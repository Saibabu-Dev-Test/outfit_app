// Circle info: members, invite code, report, leave, delete (owner or admin)
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import Avatar from '../../components/Avatar';
import ReportModal, { ReportTarget } from '../../components/ReportModal';
import { Circle, subscribeCircle, leaveCircle, deleteCircle } from '../../services/circlesApi';
import { getPublicUser } from '../../services/userApi';
import { PRIVATE_NOTICE } from './CirclesScreen';

interface MemberRow {
  id: string;
  name: string;
  avatarUrl: string | null;
  isPrivate: boolean;
}

export default function CircleInfoScreen({ navigation, route }: { navigation: any; route: any }) {
  const circleId: string = route?.params?.circleId || '';
  const { user } = useAuth();
  const uid = user?.id;
  const { isAdmin } = useIsAdmin(uid);

  const [circle, setCircle] = useState<Circle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  useEffect(() => {
    const unsub = subscribeCircle(
      circleId,
      c => {
        setCircle(c);
        setError(c ? null : 'This circle was deleted.');
        setLoading(false);
      },
      msg => {
        setError(msg);
        setLoading(false);
      },
    );
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [circleId]);

  const memberKey = circle?.memberIds.join(',') || '';

  // Member names (private profiles show as "Private profile")
  useEffect(() => {
    let alive = true;
    const ids = memberKey ? memberKey.split(',') : [];
    Promise.all(
      ids.slice(0, 100).map(async id => {
        if (id === uid) {
          return { id, name: `${user?.name || 'You'} (you)`, avatarUrl: user?.avatarUrl || null, isPrivate: false };
        }
        const r = await getPublicUser(id);
        return r.status === 'ok'
          ? { id, name: r.user.name, avatarUrl: r.user.avatarUrl, isPrivate: false }
          : { id, name: 'Private profile', avatarUrl: null, isPrivate: true };
      }),
    )
      .then(rows => {
        if (alive) setMembers(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [memberKey, uid, user?.name, user?.avatarUrl]);

  const isMember = !!uid && !!circle && circle.memberIds.includes(uid);
  const isOwner = !!uid && !!circle && circle.ownerId === uid;

  const shareCode = async () => {
    if (!circle) return;
    try {
      await Share.share({
        message: `Join my circle "${circle.name}" on Outfit Vote. Open Circles, tap "Join with code" and enter ${circle.inviteCode}`,
      });
    } catch {}
  };

  const handleLeave = () => {
    if (!circle || !uid) return;
    Alert.alert('Leave circle?', `You will stop seeing messages from ${circle.name}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await leaveCircle(circle.id, uid);
            navigation.popTo('MainApp', { screen: 'Circles' });
          } catch (e: any) {
            Alert.alert('Could not leave', e?.message || 'Please try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    if (!circle) return;
    Alert.alert('Delete circle?', 'This deletes the circle and all its messages for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteCircle(circle);
            if (isOwner) navigation.popTo('MainApp', { screen: 'Circles' });
            else navigation.pop(2);
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Please try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Circle info</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      ) : error || !circle ? (
        <Text style={styles.error}>{error || 'Circle not found.'}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>{circle.emoji}</Text>
            <Text style={styles.heroName}>{circle.name}</Text>
            <Text style={styles.heroVis}>{circle.isPrivate ? '🔒 Private circle' : '🌍 Public circle'}</Text>
            {circle.description ? <Text style={styles.heroDesc}>{circle.description}</Text> : null}
          </View>

          {(isMember || isAdmin) && circle.inviteCode ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Invite code</Text>
              <View style={styles.codeRow}>
                <Text style={styles.code}>{circle.inviteCode}</Text>
                <TouchableOpacity style={styles.shareBtn} onPress={shareCode}>
                  <Text style={styles.shareText}>Share</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>Friends enter this in Circles › Join with code.</Text>
              {circle.isPrivate && <Text style={styles.notice}>{PRIVATE_NOTICE}</Text>}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Members ({circle.memberIds.length})</Text>
            {members.map(m => (
              <TouchableOpacity
                key={m.id}
                style={styles.memberRow}
                disabled={m.isPrivate}
                onPress={() => navigation.navigate('UserProfile', { userId: m.id })}>
                <Avatar uri={m.avatarUrl} name={m.name} size={36} />
                <Text style={styles.memberName} numberOfLines={1}>
                  {m.name}
                </Text>
                {m.id === circle.ownerId && <Text style={styles.ownerTag}>Owner</Text>}
              </TouchableOpacity>
            ))}
            {!members.length && <ActivityIndicator color={colors.primary} />}
          </View>

          <View style={styles.card}>
            {!isOwner && (
              <TouchableOpacity style={styles.action} onPress={() => setReportTarget({ circleId: circle.id })}>
                <Text style={styles.actionText}>🚩 Report circle</Text>
              </TouchableOpacity>
            )}
            {isMember && !isOwner && (
              <TouchableOpacity style={styles.action} onPress={handleLeave} disabled={busy}>
                <Text style={[styles.actionText, styles.danger]}>Leave circle</Text>
              </TouchableOpacity>
            )}
            {(isOwner || isAdmin) && (
              <TouchableOpacity style={styles.action} onPress={handleDelete} disabled={busy}>
                <Text style={[styles.actionText, styles.danger]}>
                  {isOwner ? 'Delete circle' : '🛡️ Delete circle (admin)'}
                </Text>
              </TouchableOpacity>
            )}
            {busy && <ActivityIndicator color={colors.primary} />}
          </View>
        </ScrollView>
      )}
      <ReportModal target={reportTarget} reporterId={uid} onClose={() => setReportTarget(null)} />
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  spinner: { marginTop: spacing.xxxl },
  error: { color: colors.error, textAlign: 'center', padding: spacing.xl },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl },
  hero: { alignItems: 'center', marginBottom: spacing.base },
  heroEmoji: { fontSize: 56 },
  heroName: { fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary, marginTop: spacing.xs },
  heroVis: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  heroDesc: { fontSize: fontSize.base, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.primary, marginBottom: spacing.sm },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: fontSize.xxl, fontWeight: fontWeight.extraBold, color: colors.textPrimary, letterSpacing: 4 },
  shareBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  shareText: { color: colors.textInverse, fontWeight: fontWeight.bold },
  hint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs },
  notice: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    color: '#92400E',
    backgroundColor: '#FFF7E6',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  memberName: { flex: 1, marginLeft: spacing.md, fontSize: fontSize.base, color: colors.textPrimary },
  ownerTag: {
    fontSize: fontSize.xs,
    color: colors.accent,
    fontWeight: fontWeight.bold,
    borderWidth: 1,
    borderColor: colors.accentLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  action: { paddingVertical: spacing.md },
  actionText: { fontSize: fontSize.base, fontWeight: fontWeight.semiBold, color: colors.textPrimary },
  danger: { color: colors.error },
}));
