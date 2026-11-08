// Achievements: today's tasks (pending / completed) with points, this week's progress
// toward weekly celebrity (7/7 days), and referrals.
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
  Share,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import {
  ALL_TASKS_BONUS,
  DayState,
  REFERRAL_POINTS,
  TASK_POINTS,
  WEEKLY_REQUIRED_DAYS,
  WeekProgress,
  countFriendsJoined,
  ensureReferralCode,
  getDay,
  getPoints,
  getWeekProgress,
  isFullDay,
  isWeeklyStar,
} from '../../services/rewardsApi';
import { getUserProfile } from '../../services/userApi';
import { localDateKey } from '../../utils/date';

interface Item {
  id: string;
  icon: string;
  title: string;
  sub: string;
  points: string;
  done: boolean;
  action?: { label: string; onPress: () => void };
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function AchievementsScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const uid = user?.id || '';
  const [day, setDay] = useState<DayState | null>(null);
  const [points, setPoints] = useState(0);
  const [friends, setFriends] = useState(0);
  const [week, setWeek] = useState<WeekProgress | null>(null);
  const [streak, setStreak] = useState(0);
  const [star, setStar] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    const [d, p, f, w, prof, s] = await Promise.all([
      getDay(uid),
      getPoints(uid),
      countFriendsJoined(uid),
      getWeekProgress(uid),
      getUserProfile(uid),
      isWeeklyStar(uid),
    ]);
    setDay(d);
    setPoints(p);
    setFriends(f);
    setWeek(w);
    setStreak(prof.lastLoginDate === localDateKey() ? prof.streak || 1 : prof.streak || 0);
    setStar(s);
    setRefreshing(false);
    ensureReferralCode(uid)
      .then(setCode)
      .catch(() => {});
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const invite = async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `Join me on Outfit, your AI stylist & daily colour guide! Use my referral code ${code} when you create your account.`,
      });
    } catch {}
  };

  const fullDays = week?.fullDays || 0;
  const items: Item[] = day
    ? [
        { id: 'opened', icon: '📱', title: 'Open the app', sub: 'Daily task', points: `+${TASK_POINTS}`, done: day.opened },
        {
          id: 'voted',
          icon: '🎨',
          title: "Vote today's colour",
          sub: 'Daily task',
          points: `+${TASK_POINTS}`,
          done: day.voted,
          action: { label: 'Vote', onPress: () => navigation.navigate('MainApp', { screen: 'Home' }) },
        },
        {
          id: 'uploaded',
          icon: '📸',
          title: 'Upload one item',
          sub: 'Wardrobe photo or feed post',
          points: `+${TASK_POINTS}`,
          done: day.uploaded,
          action: { label: 'Upload', onPress: () => navigation.navigate('NewPost') },
        },
        {
          id: 'bonus',
          icon: '🎯',
          title: 'Finish all 3 today',
          sub: 'Daily bonus',
          points: `+${ALL_TASKS_BONUS}`,
          done: isFullDay(day),
        },
        {
          id: 'week',
          icon: '⭐',
          title: 'Weekly celebrity',
          sub: `All 3 tasks on ${WEEKLY_REQUIRED_DAYS} days this week · ${Math.min(fullDays, WEEKLY_REQUIRED_DAYS)}/${WEEKLY_REQUIRED_DAYS} done`,
          points: 'Badge',
          done: fullDays >= WEEKLY_REQUIRED_DAYS || star,
        },
        {
          id: 'invite',
          icon: '🎁',
          title: friends > 0 ? `${friends} friend${friends === 1 ? '' : 's'} joined` : 'Invite a friend',
          sub: `${REFERRAL_POINTS} points per friend who joins with your code`,
          points: friends > 0 ? `+${friends * REFERRAL_POINTS}` : `+${REFERRAL_POINTS}`,
          done: friends > 0,
          action: { label: 'Invite', onPress: invite },
        },
      ]
    : [];
  const pending = items.filter(i => !i.done);
  const completed = items.filter(i => i.done);
  const total = points + friends * REFERRAL_POINTS;
  const todayPts = day
    ? (day.opened ? TASK_POINTS : 0) + (day.voted ? TASK_POINTS : 0) + (day.uploaded ? TASK_POINTS : 0) + (isFullDay(day) ? ALL_TASKS_BONUS : 0)
    : 0;

  const row = (i: Item) => (
    <View key={i.id} style={styles.row}>
      <Text style={styles.rowIcon}>{i.icon}</Text>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, i.done && styles.rowTitleDone]}>{i.title}</Text>
        <Text style={styles.rowSub}>{i.sub}</Text>
      </View>
      {!i.done && i.action ? (
        <TouchableOpacity style={styles.actionBtn} onPress={i.action.onPress}>
          <Text style={styles.actionText}>{i.action.label}</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={[styles.pts, i.done && styles.ptsDone]}>{i.done ? `✓ ${i.points}` : i.points}</Text>
    </View>
  );

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
        <Text style={styles.title}>Achievements 🏆</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }>
        <View style={styles.hero}>
          <Text style={styles.heroValue}>🏅 {total.toLocaleString()}</Text>
          <Text style={styles.heroLabel}>total points</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroChip}>Today +{todayPts}</Text>
            <Text style={styles.heroChip}>🔥 {streak} day streak</Text>
            {star ? <Text style={styles.heroChip}>⭐ Celebrity</Text> : null}
          </View>
        </View>

        {!day ? (
          <ActivityIndicator style={styles.spinner} color={colors.primary} />
        ) : (
          <>
            <Text style={styles.section}>This week</Text>
            <View style={styles.card}>
              <View style={styles.weekRow}>
                {(week?.days || []).map((d, i) => {
                  const full = isFullDay(d.state);
                  const today = d.key === localDateKey();
                  return (
                    <View key={d.key} style={styles.weekCol}>
                      <View style={[styles.weekDot, full && styles.weekDotFull, today && styles.weekDotToday]}>
                        <Text style={[styles.weekDotText, full && styles.weekDotTextFull]}>{full ? '✓' : DAY_LETTERS[i]}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.weekText}>
                {Math.min(fullDays, WEEKLY_REQUIRED_DAYS)}/{WEEKLY_REQUIRED_DAYS} full days · finish all 3 tasks every day to be next
                week's celebrity
              </Text>
            </View>

            <Text style={styles.section}>Pending ({pending.length})</Text>
            <View style={styles.card}>
              {pending.length ? pending.map(row) : <Text style={styles.allDone}>All done for today! 🎉</Text>}
            </View>

            <Text style={styles.section}>Completed ({completed.length})</Text>
            <View style={styles.card}>
              {completed.length ? completed.map(row) : <Text style={styles.allDone}>Nothing completed yet today.</Text>}
            </View>
            <Text style={styles.note}>Rewards coming soon for active members</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
  title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl },
  hero: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: spacing.lg, alignItems: 'center' },
  heroValue: { fontSize: 32, fontWeight: fontWeight.extraBold, color: colors.onPrimary },
  heroLabel: { fontSize: fontSize.sm, color: colors.onPrimary, opacity: 0.8 },
  heroRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.md },
  heroChip: {
    color: colors.onPrimary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 4,
    marginBottom: 4,
    overflow: 'hidden',
  },
  spinner: { marginTop: spacing.xl },
  section: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extraBold,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowIcon: { fontSize: 22, width: 34 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  rowTitleDone: { color: colors.textSecondary },
  rowSub: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  actionText: { color: colors.onPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  pts: { fontSize: fontSize.sm, fontWeight: fontWeight.extraBold, color: colors.warning, minWidth: 46, textAlign: 'right' },
  ptsDone: { color: colors.success },
  allDone: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', padding: spacing.sm },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekCol: { alignItems: 'center', flex: 1 },
  weekDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotFull: { backgroundColor: colors.success, borderColor: colors.success },
  weekDotToday: { borderColor: colors.primary },
  weekDotText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textSecondary },
  weekDotTextFull: { color: '#FFFFFF' },
  weekText: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
  note: { fontSize: fontSize.xs, color: colors.accent, textAlign: 'center', marginTop: spacing.lg, fontWeight: fontWeight.semiBold },
}));
