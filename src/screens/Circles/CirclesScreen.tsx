// Circles: My Circles / Discover tabs, join with an invite code, create a public or private circle.
// Public = listed in Discover, anyone can join; private = invite link / code only. No location or
// "Nearby" features, and no Feed shortcut here (the Feed tab shows posts from my circles).
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import {
  Circle,
  createCircle,
  getDiscoverCircles,
  getMyCircles,
  joinCircle,
  joinWithCode,
  codeFromInvite,
} from '../../services/circlesApi';
import { timeAgo } from '../../utils/date';

const EMOJIS = ['👗', '🔥', '🤍', '💼', '🌟', '🕰️', '👟', '💍', '🎉', '🌸', '🧥', '🪔', '👜', '🕶️', '🥻', '💄'];

export const PRIVATE_NOTICE =
  'Private circles may be reviewed by moderators if reported, to keep the community safe.';

type TabKey = 'mine' | 'discover';

export default function CirclesScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const uid = user?.id;

  const [tab, setTab] = useState<TabKey>('mine');
  const [mine, setMine] = useState<Circle[]>([]);
  const [discover, setDiscover] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);

  // Create form
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEmoji, setNewEmoji] = useState(EMOJIS[0]);
  const [newPrivate, setNewPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  const openTab = (k: TabKey) => setTab(k);

  // Opened with { tab }: switch to that tab, then clear the param
  const route = useRoute<any>();
  const wantTab: TabKey | undefined = route.params?.tab;
  useEffect(() => {
    if (!wantTab) return;
    setTab(wantTab === 'discover' ? 'discover' : 'mine');
    navigation.setParams({ tab: undefined });
  }, [wantTab, navigation]);

  const load = useCallback(
    async (showSpinner = true) => {
      if (!uid) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (showSpinner) setLoading(true);
      const errors: string[] = [];
      try {
        setMine(await getMyCircles(uid));
      } catch (e: any) {
        errors.push(e?.message || 'Could not load your circles.');
      }
      try {
        setDiscover(await getDiscoverCircles());
      } catch (e: any) {
        errors.push(e?.message || 'Could not load circles.');
      }
      setError(errors.length ? errors[0] : null);
      setLoading(false);
      setRefreshing(false);
    },
    [uid],
  );

  // Back on this screen: reload
  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const openCircle = (c: Circle) => navigation.navigate('CircleChat', { circleId: c.id });

  const handleJoin = async (c: Circle) => {
    if (!uid) return;
    setJoiningId(c.id);
    try {
      await joinCircle(c, uid);
      await load(false);
      openCircle(c);
    } catch (e: any) {
      Alert.alert('Could not join', e?.message || 'Please try again.');
    } finally {
      setJoiningId(null);
    }
  };

  const handleJoinWithCode = async () => {
    if (!uid) return;
    setJoiningCode(true);
    try {
      const circleId = await joinWithCode(code, uid);
      setCode('');
      await load(false);
      navigation.navigate('CircleChat', { circleId });
    } catch (e: any) {
      Alert.alert('Could not join', e?.message || 'Please check the code.');
    } finally {
      setJoiningCode(false);
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewDesc('');
    setNewEmoji(EMOJIS[0]);
    setNewPrivate(false);
  };

  const handleCreate = async () => {
    if (!uid) {
      Alert.alert('Not signed in', 'Please sign in again.');
      return;
    }
    if (!newName.trim()) {
      Alert.alert('Name needed', 'Please give your circle a name.');
      return;
    }
    setCreating(true);
    try {
      const c = await createCircle(
        { name: newName, description: newDesc, emoji: newEmoji, isPrivate: newPrivate, location: null, radiusKm: null },
        uid,
      );
      setCreateOpen(false);
      resetForm();
      setTab('mine');
      load(false);
      openCircle(c);
    } catch (e: any) {
      Alert.alert('Could not create circle', e?.message || 'Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const data = tab === 'mine' ? mine : discover;

  const renderCircle = ({ item }: { item: Circle }) => {
    const isMember = !!uid && item.memberIds.includes(uid);
    const count = item.memberIds.length;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => (isMember ? openCircle(item) : handleJoin(item))}>
        <View style={styles.emojiBg}>
          <Text style={styles.emoji}>{item.emoji}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            {item.isPrivate && <Text style={styles.lock}>🔒</Text>}
          </View>
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
          <Text style={styles.cardMeta}>
            {count} {count === 1 ? 'member' : 'members'}
            {item.lastMessageAt ? ` · active ${timeAgo(item.lastMessageAt)}` : ''}
          </Text>
        </View>
        {isMember ? (
          <Text style={styles.openText}>›</Text>
        ) : (
          <View style={styles.joinBtn}>
            {joiningId === item.id ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Text style={styles.joinBtnText}>Join</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const header = (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={styles.subtitle}>Community</Text>
          <Text style={styles.title}>Circles</Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.createBtn} onPress={() => setCreateOpen(true)}>
            <Text style={styles.createBtnText}>+ Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Join with code */}
      <View style={styles.codeRow}>
        <TextInput
          style={styles.codeInput}
          placeholder="Join with code"
          placeholderTextColor={colors.textMuted}
          value={code}
          // A pasted invite link / message (outfit://join/CODE) becomes just the code
          onChangeText={t => setCode(codeFromInvite(t) || t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.codeBtn, (code.trim().length !== 6 || joiningCode) && styles.disabled]}
          disabled={code.trim().length !== 6 || joiningCode}
          onPress={handleJoinWithCode}>
          {joiningCode ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Text style={styles.codeBtnText}>Join</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['mine', 'discover'] as TabKey[]).map(k => (
          <TouchableOpacity
            key={k}
            style={[styles.tab, tab === k && styles.tabActive]}
            onPress={() => openTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit>
              {k === 'mine' ? `Mine (${mine.length})` : 'Discover'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})}
      />
      <FlatList
        data={loading ? [] : data}
        keyExtractor={c => c.id}
        renderItem={renderCircle}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(false);
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.spinner} color={colors.primary} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{tab === 'mine' ? '◎' : '🔎'}</Text>
              <Text style={styles.emptyText}>
                {tab === 'mine'
                  ? 'You have not joined any circles yet. Create one, join with a code, or look in Discover.'
                  : 'No public circles yet. Create the first one!'}
              </Text>
            </View>
          )
        }
      />

      {/* Create circle */}
      <Modal
        visible={createOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.flex1}
            activeOpacity={1}
            onPress={() => setCreateOpen(false)}
          />
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Create a circle</Text>

              <Text style={styles.label}>Emoji</Text>
              <View style={styles.emojiGrid}>
                {EMOJIS.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.emojiChoice, newEmoji === e && styles.emojiChoiceActive]}
                    onPress={() => setNewEmoji(e)}>
                    <Text style={styles.emojiChoiceText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Office Looks"
                placeholderTextColor={colors.textMuted}
                value={newName}
                onChangeText={setNewName}
                maxLength={60}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="What is this circle about?"
                placeholderTextColor={colors.textMuted}
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
                maxLength={300}
              />

              <View style={styles.visRow}>
                <View style={styles.flex1}>
                  <Text style={styles.visTitle}>{newPrivate ? '🔒 Private' : '🌍 Public'}</Text>
                  <Text style={styles.visHint}>
                    {newPrivate
                      ? 'Hidden from Discover. People join with your invite code.'
                      : 'Listed in Discover. Anyone can join.'}
                  </Text>
                </View>
                <Switch
                  value={newPrivate}
                  onValueChange={setNewPrivate}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.textInverse}
                />
              </View>
              {newPrivate && <Text style={styles.notice}>{PRIVATE_NOTICE}</Text>}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setCreateOpen(false)}
                  disabled={creating}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, creating && styles.disabled]}
                  onPress={handleCreate}
                  disabled={creating}>
                  {creating ? (
                    <ActivityIndicator color={colors.textInverse} size="small" />
                  ) : (
                    <Text style={styles.saveText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },
  listContent: { paddingBottom: spacing.xxxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.extraBold, color: colors.textPrimary, letterSpacing: -0.5 },
  headerBtns: { flexDirection: 'row', gap: spacing.sm },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  createBtnText: { color: colors.textInverse, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  codeRow: { flexDirection: 'row', paddingHorizontal: spacing.base, gap: spacing.sm, marginBottom: spacing.md },
  codeInput: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    letterSpacing: 2,
    fontWeight: fontWeight.bold,
  },
  codeBtn: {
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBtnText: { color: colors.textInverse, fontWeight: fontWeight.bold },
  disabled: { opacity: 0.5 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    backgroundColor: colors.divider,
    borderRadius: borderRadius.full,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.full, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surface },
  tabText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.semiBold },
  tabTextActive: { color: colors.primary, fontWeight: fontWeight.bold },
  error: { color: colors.error, fontSize: fontSize.sm, paddingHorizontal: spacing.base, marginBottom: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  emojiBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  emoji: { fontSize: 26 },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary, flexShrink: 1 },
  lock: { fontSize: 12, marginLeft: 4 },
  cardDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },
  openText: { fontSize: 26, color: colors.textMuted, marginLeft: spacing.sm },
  joinBtn: {
    minWidth: 64,
    height: 34,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginLeft: spacing.sm,
  },
  joinBtnText: { color: colors.textInverse, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  spinner: { marginTop: spacing.xxl },
  empty: { alignItems: 'center', padding: spacing.xxl },
  emptyEmoji: { fontSize: 40, color: colors.textMuted, marginBottom: spacing.sm },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.md },
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
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiChoiceActive: { borderColor: colors.accent, backgroundColor: colors.surfaceElevated },
  emojiChoiceText: { fontSize: 22 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  inputMulti: { height: 80, textAlignVertical: 'top', paddingTop: spacing.sm },
  visRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.base,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  visTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  visHint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  notice: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    color: '#92400E',
    backgroundColor: '#FFF7E6',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    lineHeight: 16,
  },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.textSecondary, fontWeight: fontWeight.bold },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: colors.textInverse, fontWeight: fontWeight.bold },
}));
