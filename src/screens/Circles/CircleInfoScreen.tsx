// Circle info: members, invite code, report, leave, delete (owner or admin), and settings:
//   Owner: ✏️ edit name (unique), description and emoji (circlesApi.updateCircleDetails).
//   Owner / admin: Public <-> Private. Public saves the current approximate location (~100 m) so the
//   circle shows in 📍 Nearby to people within 3 km; private removes the location (invite code only).
// There is no global Discover list: far-away and private circles are joined with the invite code.
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
  Switch,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import Avatar from '../../components/Avatar';
import ReportModal, { ReportTarget } from '../../components/ReportModal';
import {
  Circle,
  subscribeCircle,
  leaveCircle,
  deleteCircle,
  updateCircleVisibility,
  updateCircleDetails,
  setCircleLocationHere,
  circleInviteLink,
  NEARBY_KM,
  MAX_NAME_CHARS,
} from '../../services/circlesApi';
import { getApproxLocation } from '../../native/location';
import { getPublicUser } from '../../services/userApi';
import { PRIVATE_NOTICE, EMOJIS } from './CirclesScreen';
import { shareWithReferral } from '../../utils/referralLink';
import NameWithAge from '../../components/NameWithAge';

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

  // Owner edit form (name / description / emoji)
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editEmoji, setEditEmoji] = useState(EMOJIS[0]);
  const [saving, setSaving] = useState(false);

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

  const canEdit = isOwner || isAdmin;

  const startEdit = () => {
    if (!circle) return;
    setEditName(circle.name);
    setEditDesc(circle.description);
    setEditEmoji(circle.emoji);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!circle || !uid || saving) return;
    if (!editName.trim()) {
      Alert.alert('Name needed', 'Please give your circle a name.');
      return;
    }
    setSaving(true);
    try {
      await updateCircleDetails(circle.id, { name: editName, description: editDesc, emoji: editEmoji }, uid);
      setEditing(false);
    } catch (e: any) {
      // e.g. 'A circle called "X" already exists. Please choose a different name.'
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Public <-> Private. Public saves my approximate location (Nearby, 3 km); private removes it.
  const changeVisibility = (makePrivate: boolean) => {
    if (!circle || makePrivate === circle.isPrivate) return;
    const title = makePrivate ? 'Make circle private?' : 'Make circle public?';
    const body = makePrivate
      ? 'It will be removed from Nearby and its location deleted. Members stay, and new people join with the invite code or link.'
      : `Your approximate location (about 100 m) is saved as the circle's location, so people within ${NEARBY_KM} km can find and join it in Nearby. Anyone further away joins with the invite code.`;
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: makePrivate ? 'Make private' : 'Make public',
        onPress: async () => {
          setBusy(true);
          try {
            if (makePrivate) {
              await updateCircleVisibility(circle.id, true);
            } else {
              const loc = await getApproxLocation();
              if (!loc.ok) {
                Alert.alert(
                  'Location needed',
                  `A public circle needs your approximate location to show in Nearby.\n${loc.message}`,
                );
                return;
              }
              await updateCircleVisibility(circle.id, false, loc.coords, null);
            }
          } catch (e: any) {
            Alert.alert('Could not change', e?.message || 'Please try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  // Public circle: move its Nearby location to where I am now (also fixes legacy public circles
  // without a location, or with an old distance limit)
  const moveLocationHere = () => {
    if (!circle || busy) return;
    Alert.alert(
      'Use my location?',
      `The circle's location becomes your current approximate location (about 100 m). People within ${NEARBY_KM} km of it see it in Nearby.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use my location',
          onPress: async () => {
            setBusy(true);
            try {
              await setCircleLocationHere(circle.id);
            } catch (e: any) {
              Alert.alert('Could not update location', e?.message || 'Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const shareCode = async () => {
    if (!circle) return;
    // Invite link (opens the app and joins, from any distance) + the code, plus the app download
    // link with my referral code for friends who don't have the app yet
    await shareWithReferral(
      uid,
      `Join my circle "${circle.name}" on Outfit: ${circleInviteLink(circle.inviteCode)}\nOr open Circles, tap "Join with code" and enter ${circle.inviteCode}`,
    );
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
            <Text style={styles.heroVis}>
              {circle.isPrivate ? '🔒 Private circle' : '🌍 Public circle'}
            </Text>
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
              <Text style={styles.hint}>
                Share the invite link, or friends enter the code in Circles › Join with code.
              </Text>
              {circle.isPrivate && <Text style={styles.notice}>{PRIVATE_NOTICE}</Text>}
            </View>
          ) : null}

          {isOwner ? (
            <View style={styles.card}>
              <View style={styles.cardHeadRow}>
                <Text style={[styles.cardTitle, styles.flex1]}>Edit circle</Text>
                {!editing ? (
                  <TouchableOpacity onPress={startEdit} disabled={busy}>
                    <Text style={styles.link}>✏️ Edit</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {editing ? (
                <View>
                  <Text style={styles.label}>Emoji</Text>
                  <View style={styles.emojiGrid}>
                    {EMOJIS.map(e => (
                      <TouchableOpacity
                        key={e}
                        style={[styles.emojiChoice, editEmoji === e && styles.emojiChoiceActive]}
                        onPress={() => setEditEmoji(e)}>
                        <Text style={styles.emojiChoiceText}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.label}>Name (must be unique)</Text>
                  <TextInput
                    style={styles.input}
                    value={editName}
                    onChangeText={setEditName}
                    maxLength={MAX_NAME_CHARS}
                    placeholder="Circle name"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.inputMulti]}
                    value={editDesc}
                    onChangeText={setEditDesc}
                    maxLength={300}
                    multiline
                    placeholder="What is this circle about?"
                    placeholderTextColor={colors.textMuted}
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)} disabled={saving}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, saving && styles.disabled]}
                      onPress={saveEdit}
                      disabled={saving}>
                      {saving ? (
                        <ActivityIndicator color={colors.textInverse} size="small" />
                      ) : (
                        <Text style={styles.saveText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.hint}>Change the name, description or emoji. Names are unique across Outfit.</Text>
              )}
            </View>
          ) : null}

          {canEdit ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Visibility{isOwner ? '' : ' (admin)'}</Text>
              <View style={styles.settingRow}>
                <View style={styles.flex1}>
                  <Text style={styles.settingTitle}>{circle.isPrivate ? '🔒 Private' : '🌍 Public'}</Text>
                  <Text style={styles.hint}>
                    {circle.isPrivate
                      ? 'Not shown in Nearby. People join with the invite code or link.'
                      : `Shown in 📍 Nearby to people within ${NEARBY_KM} km. Anyone further away joins with the invite code.`}
                  </Text>
                </View>
                <Switch
                  value={circle.isPrivate}
                  onValueChange={changeVisibility}
                  disabled={busy}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.textInverse}
                />
              </View>
              <Text style={styles.hint}>Switch on for private.</Text>
              {!circle.isPrivate ? (
                <View>
                  {!circle.location ? (
                    <Text style={styles.notice}>
                      This circle has no location yet, so it does not show in Nearby (only the invite code works).
                    </Text>
                  ) : circle.radiusKm && circle.radiusKm < NEARBY_KM ? (
                    <Text style={styles.hint}>Old distance limit: {circle.radiusKm} km. Updating the location clears it.</Text>
                  ) : null}
                  <TouchableOpacity style={styles.action} onPress={moveLocationHere} disabled={busy}>
                    <Text style={styles.actionText}>
                      📍 {circle.location ? 'Move location to where I am' : 'Show in Nearby (use my location)'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
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
                <NameWithAge style={styles.memberName} numberOfLines={1} uid={m.isPrivate || m.id === uid ? null : m.id} name={m.name} />
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
  flex1: { flex: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  settingTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semiBold, color: colors.textPrimary },
  action: { paddingVertical: spacing.md },
  actionText: { fontSize: fontSize.base, fontWeight: fontWeight.semiBold, color: colors.textPrimary },
  danger: { color: colors.error },
  cardHeadRow: { flexDirection: 'row', alignItems: 'center' },
  link: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.bold, marginBottom: spacing.sm },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emojiChoice: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiChoiceActive: { borderColor: colors.accent, backgroundColor: colors.surfaceElevated },
  emojiChoiceText: { fontSize: 20 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    height: 46,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  inputMulti: { height: 80, textAlignVertical: 'top', paddingTop: spacing.sm },
  editActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.textSecondary, fontWeight: fontWeight.bold },
  saveBtn: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: colors.textInverse, fontWeight: fontWeight.bold },
  disabled: { opacity: 0.5 },
}));
