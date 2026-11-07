import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { getUserProfile, recordDailyLogin } from '../../services/userApi';
import { hasUploadedToday } from '../../services/wardrobeApi';
import { getTodayVaaraColour, getRashiLuckyColour } from '../../utils/panchangam';
import { localDateKey, greetingForNow } from '../../utils/date';
import { firestoreErrorMessage, SERVER_SETUP_MESSAGE } from '../../utils/firebaseErrors';
import Avatar from '../../components/Avatar';
import {
  checkWeeklyStars,
  countFriendsJoined,
  DayState,
  getDay,
  getLastWeekStars,
  getPoints,
  recordTask,
  REFERRAL_POINTS,
  setStarProfile,
  TaskResult,
  WeeklyStar,
} from '../../services/rewardsApi';

const outfitA = require('../../assets/outfit_a.jpg');

// Colours shown in the daily vote
const VOTE_COLOURS = [
  { name: 'Blue', hex: '#1D92F3' },
  { name: 'Green', hex: '#3FA73F' },
  { name: 'Purple', hex: '#8E24AA' },
  { name: 'Pink', hex: '#E91E63' },
  { name: 'Yellow', hex: '#FBC02D' },
  { name: 'Orange', hex: '#F57C00' },
  { name: 'Red', hex: '#D32F2F' },
  { name: 'Black', hex: '#212121' },
  { name: 'Brown', hex: '#8B4513' },
  { name: 'White', hex: '#EEEEEE' },
];

interface ColourTally {
  rank: number;
  name: string;
  hex: string;
  votes: number;
  men: string;
  women: string;
  percentage: string;
}

const pct = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '0%');

type VoteMap = Map<string, { color: string; gender: string }>;
const colourIndex = (name: string) => VOTE_COLOURS.findIndex(c => c.name === name);

// Tallies from one-vote-per-user map. Stable order: votes desc, then VOTE_COLOURS order.
const tally = (map: VoteMap): ColourTally[] => {
  const counts: Record<string, { total: number; men: number; women: number }> = {};
  let total = 0;
  map.forEach(v => {
    const c = counts[v.color] || { total: 0, men: 0, women: 0 };
    c.total += 1;
    if (v.gender === 'male') c.men += 1;
    if (v.gender === 'female') c.women += 1;
    counts[v.color] = c;
    total += 1;
  });
  const results: ColourTally[] = VOTE_COLOURS.map(col => {
    const c = counts[col.name] || { total: 0, men: 0, women: 0 };
    return {
      rank: 0,
      name: col.name,
      hex: col.hex,
      votes: c.total,
      men: pct(c.men, c.total),
      women: pct(c.women, c.total),
      percentage: pct(c.total, total),
    };
  });
  results.sort((a, b) => b.votes - a.votes || colourIndex(a.name) - colourIndex(b.name));
  results.forEach((item, idx) => {
    item.rank = idx + 1;
  });
  return results;
};

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user, updateUserData } = useAuth();
  const uid = user?.id;
  const [topColours, setTopColours] = useState<ColourTally[]>(
    VOTE_COLOURS.map((c, i) => ({ rank: i + 1, ...c, votes: 0, men: '0%', women: '0%', percentage: '0%' })),
  );
  const [myVote, setMyVote] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);
  const [votesLoading, setVotesLoading] = useState<boolean>(true);
  const [streak, setStreak] = useState<number>(0);
  const [day, setDay] = useState<DayState>({ opened: false, voted: false, uploaded: false });
  const [points, setPoints] = useState<number>(0);
  const [friends, setFriends] = useState<number>(0);
  const [stars, setStars] = useState<WeeklyStar[]>([]);
  const [flashName, setFlashName] = useState<string | null>(null);
  // Votes by userId, and our last write (a refetch must not undo it with stale data)
  const votesRef = useRef<VoteMap>(new Map());
  const lastWriteRef = useRef<{ color: string; date: string; at: number } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [greeting, setGreeting] = useState<string>(greetingForNow());

  const displayName = (user?.name || '').trim() || 'there';
  const firstName = displayName.split(' ')[0];
  const initial = displayName === 'there' ? '🙂' : displayName.charAt(0).toUpperCase();
  const vaara = getTodayVaaraColour();
  const lucky = getRashiLuckyColour(user?.rashi);

  const showVotes = useCallback(
    (map: VoteMap) => {
      setTopColours(tally(map));
      setMyVote(uid ? map.get(uid)?.color ?? null : null);
    },
    [uid],
  );

  // Applies a task result (day checklist + points)
  const applyTask = useCallback(
    (r: TaskResult) => {
      setDay(r.day);
      // Re-read the saved total (avoids double counting with a parallel load)
      if (r.pointsAdded && uid) getPoints(uid).then(setPoints);
    },
    [uid],
  );

  // Today's votes. Only docs with id top_colors_{today}_{userId} count (old builds used random ids),
  // so each user counts once and "my vote" comes from my own doc.
  const fetchVotes = useCallback(async () => {
    try {
      const today = localDateKey();
      const snap = await getDocs(
        query(collection(db, 'votes'), where('systemId', '==', 'top_colors'), where('date', '==', today)),
      );
      const map: VoteMap = new Map();
      snap.forEach(d => {
        const v: any = d.data();
        if (!v?.color || !v?.userId) return;
        if (d.id !== `top_colors_${today}_${v.userId}`) return;
        map.set(v.userId, { color: v.color, gender: String(v.voterGender || '').toLowerCase() });
      });
      // Our own recent write wins over a stale read
      const lw = lastWriteRef.current;
      if (uid && lw && lw.date === today && Date.now() - lw.at < 30000 && map.get(uid)?.color !== lw.color) {
        map.set(uid, { color: lw.color, gender: String(user?.gender || '').toLowerCase() });
      }
      votesRef.current = map;
      showVotes(map);
      // Voted earlier (or on another device): tick the daily task
      if (uid && map.has(uid)) recordTask(uid, 'voted').then(applyTask);
    } catch (error: any) {
      console.warn('Error fetching votes:', error?.code, error?.message);
    } finally {
      setVotesLoading(false);
    }
  }, [uid, user?.gender, showVotes, applyTask]);

  // Day checklist, points and referral count
  const refreshRewards = useCallback(async () => {
    if (!uid) return;
    const [d, p, f] = await Promise.all([getDay(uid), getPoints(uid), countFriendsJoined(uid)]);
    setDay(d);
    setPoints(p);
    setFriends(f);
    // Uploaded before this build tracked it: tick the task now
    if (!d.uploaded && (await hasUploadedToday(uid))) {
      applyTask(await recordTask(uid, 'uploaded'));
    }
  }, [uid, applyTask]);

  // Load profile + mark daily login once per user
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    (async () => {
      try {
        const stored = await getUserProfile(uid);
        if (alive && Object.keys(stored).length) {
          updateUserData({
            name: stored.name,
            avatarUrl: stored.avatarUrl,
            rashi: stored.rashi,
            gender: stored.gender,
            dob: stored.dob,
            language: stored.language,
            timeOfBirth: stored.timeOfBirth,
            bio: stored.bio,
          });
        }
      } catch (e: any) {
        console.warn('Home profile load failed:', e?.message);
      }
      const res = await recordDailyLogin(uid);
      if (alive) setStreak(res.streak);
      const opened = await recordTask(uid, 'opened');
      if (alive) applyTask(opened);
      // Weekly celebrities: claim a finished week, then load last week's list
      await checkWeeklyStars(uid);
      const list = await getLastWeekStars();
      if (alive) setStars(list);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Refresh votes/tasks/greeting whenever Home is shown
  useFocusEffect(
    useCallback(() => {
      setGreeting(greetingForNow());
      fetchVotes();
      refreshRewards();
    }, [fetchVotes, refreshRewards]),
  );

  // Celebrities card uses the current name/avatar
  useEffect(() => {
    setStarProfile({ name: user?.name, avatar: user?.avatarUrl });
  }, [user?.name, user?.avatarUrl]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  // Tapping a colour sets (or changes) today's vote. Overwrites the same doc, so the old vote is gone.
  const handleVoteColor = async (colorName: string) => {
    if (!uid) {
      Alert.alert('Please login to vote!');
      return;
    }
    if (colorName === myVote || voting) return;
    const today = localDateKey();
    const voteId = `top_colors_${today}_${uid}`;
    const previous = myVote;
    setVoting(colorName);
    setMyVote(colorName); // optimistic
    try {
      await setDoc(doc(db, 'votes', voteId), {
        systemId: 'top_colors',
        color: colorName,
        userId: uid,
        voterGender: user?.gender || null,
        date: today,
        timestamp: serverTimestamp(),
      });
    } catch (error: any) {
      console.warn('Voting error:', error?.code, error?.message);
      setMyVote(previous);
      setVoting(null);
      Alert.alert(
        'Vote not saved',
        error?.code === 'permission-denied'
          ? SERVER_SETUP_MESSAGE
          : firestoreErrorMessage(error, 'Voting'),
      );
      return;
    }
    // Saved: show it now from the written value, even if the refetch fails
    lastWriteRef.current = { color: colorName, date: today, at: Date.now() };
    const map: VoteMap = new Map(votesRef.current);
    map.set(uid, { color: colorName, gender: String(user?.gender || '').toLowerCase() });
    votesRef.current = map;
    showVotes(map);
    setFlashName(colorName);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashName(null), 1500);
    setVoting(null);
    recordTask(uid, 'voted').then(applyTask);
    fetchVotes(); // never throws; keeps our vote if the read is stale
  };

  const tasks = [
    { id: 'opened', label: 'Open the app', done: day.opened },
    { id: 'voted', label: "Vote today's colour", done: day.voted || !!myVote },
    { id: 'uploaded', label: 'Upload one item (wardrobe or feed post)', done: day.uploaded },
  ];
  const doneCount = tasks.filter(t => t.done).length;
  const totalPoints = points + friends * REFERRAL_POINTS;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle="dark-content"
        {...(Platform.OS === 'android' ? { backgroundColor: '#FAF9FC' } : {})}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <Text style={styles.greeting} numberOfLines={1}>
              {greeting}, {firstName}
            </Text>
          </View>
          <TouchableOpacity style={styles.notifBadge} activeOpacity={0.7}>
            <Text style={styles.notifIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Public feed entry */}
        <TouchableOpacity
          style={styles.feedCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Feed')}>
          <Text style={styles.feedEmoji}>📸</Text>
          <View style={styles.feedTextWrap}>
            <Text style={styles.feedTitle}>Style Feed</Text>
            <Text style={styles.feedSub}>See today's looks from the community and share yours</Text>
          </View>
          <Text style={styles.feedArrow}>›</Text>
        </TouchableOpacity>

        {/* Daily tasks */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Today's tasks</Text>
          <Text style={styles.streakText}>🔥 {streak} day streak</Text>
        </View>
        <View style={styles.tasksCard}>
          {tasks.map(t => (
            <View key={t.id} style={styles.taskRow}>
              <View style={[styles.taskCheck, t.done && styles.taskCheckDone]}>
                {t.done && <Text style={styles.taskCheckMark}>✓</Text>}
              </View>
              <Text style={[styles.taskLabel, t.done && styles.taskLabelDone]}>{t.label}</Text>
            </View>
          ))}
          <Text style={styles.taskSummary}>
            {doneCount}/3 done · 10 pts each, +20 for all 3
          </Text>
          <View style={styles.pointsRow}>
            <Text style={styles.pointsValue}>🏅 {totalPoints.toLocaleString()} points</Text>
            {friends > 0 && <Text style={styles.pointsSub}>incl. {friends} friend{friends === 1 ? '' : 's'} joined</Text>}
          </View>
          <Text style={styles.rewardsSoon}>Rewards coming soon for active members</Text>
        </View>

        {/* Last week's celebrities */}
        <View style={styles.plainHeaderRow}>
          <Text style={styles.sectionTitle}>Congratulations! This week's celebrities ⭐</Text>
        </View>
        <View style={styles.tasksCard}>
          {stars.length === 0 ? (
            <Text style={styles.starsEmpty}>
              No celebrities yet. Finish all 3 tasks every day this week to be here next week!
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {stars.map(st => (
                <TouchableOpacity
                  key={st.uid}
                  style={styles.starItem}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('UserProfile', { userId: st.uid })}>
                  <Avatar uri={st.avatar} name={st.name} size={52} />
                  <Text style={styles.starName} numberOfLines={1}>
                    ⭐ {st.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Panchangam colour */}
        <View style={styles.plainHeaderRow}>
          <Text style={styles.sectionTitle}>Today's colour as per Panchangam</Text>
        </View>
        <View style={styles.panchangCard}>
          <View style={styles.swatchRow}>
            {vaara.colours.map(c => (
              <View key={c.name} style={styles.swatchItem}>
                <View style={[styles.swatchCircle, { backgroundColor: c.hex }]} />
                <Text style={styles.swatchLabel}>{c.name}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.panchangTitle}>
            {vaara.weekday} · {vaara.vaara} · {vaara.graha}
          </Text>
          <Text style={styles.panchangWhy}>{vaara.why}</Text>
          {lucky ? (
            <Text style={styles.panchangLucky}>
              Your rashi ({lucky.rashi}) lord is {lucky.lord}: lucky colour {lucky.colour}.
            </Text>
          ) : null}
          <Text style={styles.panchangNote}>Traditional guidance</Text>
        </View>

        {/* Today's Top Colours */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Today's Top Colours</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE RESULTS</Text>
          </View>
        </View>
        <Text style={styles.voteHint}>
          {myVote ? `Your vote: ${myVote}. Tap another colour to change it.` : 'Tap a colour to vote for today.'}
        </Text>

        <View style={styles.topColoursCard}>
          {votesLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#E91E63" />
              <Text style={styles.loadingText}>Loading votes...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.topColoursScroll}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}>
              {topColours.map((item, index) => (
                <React.Fragment key={item.name}>
                  <TouchableOpacity
                    style={[
                      styles.colorRow,
                      myVote === item.name && styles.colorRowVoted,
                      flashName === item.name && styles.colorRowFlash,
                    ]}
                    activeOpacity={0.7}
                    disabled={!!voting}
                    onPress={() => handleVoteColor(item.name)}>
                    <Text style={styles.colorRank}>{item.rank}</Text>
                    <View style={[styles.colorCircle, { backgroundColor: item.hex }]} />
                    <View style={styles.colorDetails}>
                      <Text style={styles.colorName}>
                        {item.name}
                        {myVote === item.name ? '  ✓ Your vote' : ''}
                      </Text>
                      <Text style={styles.votesCountText}>{item.votes.toLocaleString()} votes</Text>
                      <View style={styles.genderRow}>
                        <Text style={styles.genderText}>🧍‍♂️ Men: {item.men}</Text>
                        <View style={styles.genderDivider} />
                        <Text style={styles.genderText}>🧍‍♀️ Women: {item.women}</Text>
                      </View>
                    </View>
                    {voting === item.name ? (
                      <ActivityIndicator size="small" color="#E91E63" />
                    ) : (
                      <Text style={styles.colorPercentage}>{item.percentage}</Text>
                    )}
                  </TouchableOpacity>
                  {index < topColours.length - 1 && <View style={styles.rowDivider} />}
                </React.Fragment>
              ))}
            </ScrollView>
          )}
        </View>

        {/* What do you think? */}
        <View style={styles.plainHeaderRow}>
          <Text style={styles.sectionTitle}>What do you think?</Text>
        </View>

        <View style={styles.outfitCard}>
          <Image source={outfitA} style={styles.outfitImage} />
          <View style={styles.outfitBadge}>
            <Text style={styles.outfitBadgeText}>OUTFIT A</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatarFallback: {
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    backgroundColor: '#2D1F6E',
  },
  feedEmoji: { fontSize: 30, marginRight: spacing.md },
  feedTextWrap: { flex: 1 },
  feedTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  feedSub: { color: '#C4B5FD', fontSize: 13, marginTop: 2 },
  feedArrow: { color: '#FFFFFF', fontSize: 28, marginLeft: spacing.sm },
  streakText: { fontSize: 13, fontWeight: '700', color: '#F57C00' },
  tasksCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: spacing.base,
    borderWidth: 1,
    borderColor: '#EBE9F3',
    padding: spacing.base,
  },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  taskCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D0CBDF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  taskCheckDone: { backgroundColor: '#3FA73F', borderColor: '#3FA73F' },
  taskCheckMark: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  taskLabel: { fontSize: 14, color: '#0A1940', fontWeight: '600' },
  taskLabelDone: { color: '#6B6B8A', textDecorationLine: 'line-through' },
  taskSummary: { fontSize: 12, color: '#6B6B8A', marginTop: 6, textAlign: 'right' },
  panchangCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: spacing.base,
    borderWidth: 1,
    borderColor: '#EBE9F3',
    padding: spacing.base,
  },
  swatchRow: { flexDirection: 'row', marginBottom: 10 },
  swatchItem: { alignItems: 'center', marginRight: 16 },
  swatchCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#E0DDEA' },
  swatchLabel: { fontSize: 12, fontWeight: '700', color: '#0A1940', marginTop: 4 },
  panchangTitle: { fontSize: 14, fontWeight: '800', color: '#0A1940', marginBottom: 4 },
  panchangWhy: { fontSize: 13, color: '#4A4A6A', lineHeight: 19 },
  panchangLucky: { fontSize: 13, color: '#6C5CE7', fontWeight: '600', marginTop: 6 },
  panchangNote: { fontSize: 11, color: '#9E9EBA', marginTop: 8, fontStyle: 'italic' },
  voteHint: { fontSize: 12, color: '#6B6B8A', paddingHorizontal: spacing.base, marginBottom: spacing.sm },
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF9FC',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F2F8',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.md,
  },
  greeting: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0A1940',
  },
  notifBadge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifIcon: {
    fontSize: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  plainHeaderRow: {
    paddingHorizontal: spacing.base,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A1940',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E91E63',
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E91E63',
    marginRight: 6,
  },
  liveText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#E91E63',
    letterSpacing: 0.5,
  },
  topColoursCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: spacing.base,
    borderWidth: 1,
    borderColor: '#EBE9F3',
    shadowColor: 'rgba(10, 25, 64, 0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  topColoursScroll: {
    height: 254,
  },
  colorRowFlash: { backgroundColor: '#FFD6E7' },
  pointsRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10, flexWrap: 'wrap' },
  pointsValue: { fontSize: 16, fontWeight: '800', color: '#0A1940', marginRight: 8 },
  pointsSub: { fontSize: 12, color: '#6B6B8A' },
  rewardsSoon: { fontSize: 12, color: '#6C5CE7', fontWeight: '600', marginTop: 4 },
  starsEmpty: { fontSize: 13, color: '#6B6B8A', lineHeight: 19 },
  starItem: { alignItems: 'center', width: 76, marginRight: 8 },
  starName: { fontSize: 11, fontWeight: '700', color: '#0A1940', marginTop: 4, maxWidth: 76 },
  colorRowVoted: {
    backgroundColor: "#FFF0F5",
    borderRadius: 12,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
  },
  colorRank: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0A1940',
    width: 24,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia-Bold' : 'serif',
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 12,
    marginRight: 12,
  },
  colorDetails: {
    flex: 1,
  },
  colorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A1940',
    marginBottom: 2,
  },
  votesCountText: {
    fontSize: 12,
    color: '#6B6B8A',
    fontWeight: '400',
    marginBottom: 4,
  },
  genderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  genderText: {
    fontSize: 11,
    color: '#4A4A6A',
    fontWeight: '500',
  },
  genderDivider: {
    width: 1,
    height: 8,
    backgroundColor: '#E8E6F0',
    marginHorizontal: spacing.sm,
  },
  colorPercentage: {
    fontSize: 16,
    fontWeight: '800',
    color: '#E91E63',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#FAF9FC',
    marginHorizontal: spacing.base,
  },
  styleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: spacing.base,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EBE9F3',
    shadowColor: 'rgba(10, 25, 64, 0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  sageGreenBlock: {
    height: 140,
    backgroundColor: '#A8B5A0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sageGreenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  sageGreenHex: {
    fontSize: 11,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 6,
    letterSpacing: 2,
    fontWeight: '600',
  },
  styleDescriptionBox: {
    padding: spacing.base,
  },
  styleDescriptionText: {
    fontSize: 14,
    color: '#4A4A6A',
    lineHeight: 22,
    fontWeight: '400',
  },
  whyColorCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: spacing.base,
    padding: spacing.base,
    borderWidth: 1.5,
    borderColor: '#D8CFFC',
    shadowColor: 'rgba(10, 25, 64, 0.03)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  whyColorIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4A148C',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  whyColorIcon: {
    fontSize: 18,
  },
  whyColorContent: {
    flex: 1,
    marginLeft: 12,
  },
  whyColorTextMain: {
    fontSize: 13,
    color: '#0A1940',
    lineHeight: 19,
    fontWeight: '500',
    marginBottom: 6,
  },
  whyColorTextSub: {
    fontSize: 12,
    color: '#6B6B8A',
    lineHeight: 18,
    fontWeight: '400',
  },
  outfitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: spacing.base,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EBE9F3',
    position: 'relative',
    shadowColor: 'rgba(10, 25, 64, 0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  outfitImage: {
    width: '100%',
    height: 360,
    resizeMode: 'cover',
  },
  outfitBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  outfitBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0A1940',
    letterSpacing: 1,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: '#6B6B8A',
  },
});

