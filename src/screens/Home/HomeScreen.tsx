// Home. On app open it first shows ONLY today's colour vote; after voting (or Skip / Continue)
// the rest shows: panchangam lucky colour, live results (tap Boys / Girls to see who voted),
// achievements shortcut and the weekly celebrities. Daily tasks moved to Achievements.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize, fontWeight, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { ageFromDob, getUserProfile, recordDailyLogin } from '../../services/userApi';
import { hasUploadedToday } from '../../services/wardrobeApi';
import { getTodayVaaraColour, getRashiLuckyColour } from '../../utils/panchangam';
import { localDateKey, greetingForNow } from '../../utils/date';
import { firestoreErrorMessage, SERVER_SETUP_MESSAGE } from '../../utils/firebaseErrors';
import Avatar from '../../components/Avatar';
import {
  checkWeeklyStars,
  countFriendsJoined,
  getDay,
  getLastWeekStars,
  getPoints,
  recordTask,
  REFERRAL_POINTS,
  setStarProfile,
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

interface Voter {
  uid: string;
  color: string;
  gender: string; // 'male' | 'female' | ''
  name: string;
  age: number | null;
}

interface ColourTally {
  rank: number;
  name: string;
  hex: string;
  votes: number;
  boys: number;
  girls: number;
  men: string;
  women: string;
  percentage: string;
}

const pct = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '0%');

type VoteMap = Map<string, Voter>;
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
      boys: c.men,
      girls: c.women,
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

const emptyTally = (): ColourTally[] =>
  VOTE_COLOURS.map((c, i) => ({ rank: i + 1, ...c, votes: 0, boys: 0, girls: 0, men: '0%', women: '0%', percentage: '0%' }));

// The vote-first screen shows once per app open
let voteGateDone = false;

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user, updateUserData } = useAuth();
  const uid = user?.id;
  const [gateDone, setGateDone] = useState<boolean>(voteGateDone);
  const [topColours, setTopColours] = useState<ColourTally[]>(emptyTally());
  const [myVote, setMyVote] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);
  const [votesLoading, setVotesLoading] = useState<boolean>(true);
  const [streak, setStreak] = useState<number>(0);
  const [points, setPoints] = useState<number>(0);
  const [friends, setFriends] = useState<number>(0);
  const [doneToday, setDoneToday] = useState<number>(0);
  const [stars, setStars] = useState<WeeklyStar[]>([]);
  const [flashName, setFlashName] = useState<string | null>(null);
  const [voterList, setVoterList] = useState<{ title: string; voters: Voter[] } | null>(null);
  // Votes by userId, and our last write (a refetch must not undo it with stale data)
  const votesRef = useRef<VoteMap>(new Map());
  const lastWriteRef = useRef<{ color: string; date: string; at: number } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [greeting, setGreeting] = useState<string>(greetingForNow());

  const displayName = (user?.name || '').trim() || 'there';
  const firstName = displayName.split(' ')[0];
  const vaara = getTodayVaaraColour();
  const lucky = getRashiLuckyColour(user?.rashi);

  const finishGate = useCallback(() => {
    voteGateDone = true;
    setGateDone(true);
  }, []);

  const showVotes = useCallback(
    (map: VoteMap) => {
      setTopColours(tally(map));
      setMyVote(uid ? map.get(uid)?.color ?? null : null);
    },
    [uid],
  );

  const refreshPoints = useCallback(async () => {
    if (!uid) return;
    const [d, p, f] = await Promise.all([getDay(uid), getPoints(uid), countFriendsJoined(uid)]);
    setDoneToday([d.opened, d.voted, d.uploaded].filter(Boolean).length);
    setPoints(p);
    setFriends(f);
    // Uploaded before this build tracked it: tick the task now
    if (!d.uploaded && (await hasUploadedToday(uid))) {
      await recordTask(uid, 'uploaded');
      setPoints(await getPoints(uid));
    }
  }, [uid]);

  // Today's votes. Only docs with id top_colors_{today}_{userId} count (old builds used random ids).
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
        map.set(v.userId, {
          uid: v.userId,
          color: v.color,
          gender: String(v.voterGender || '').toLowerCase(),
          name: typeof v.voterName === 'string' && v.voterName.trim() ? v.voterName.trim() : 'Outfit user',
          age: typeof v.voterAge === 'number' ? v.voterAge : null,
        });
      });
      // Our own recent write wins over a stale read
      const lw = lastWriteRef.current;
      if (uid && lw && lw.date === today && Date.now() - lw.at < 30000 && map.get(uid)?.color !== lw.color) {
        map.set(uid, {
          uid,
          color: lw.color,
          gender: String(user?.gender || '').toLowerCase(),
          name: displayName,
          age: ageFromDob(user?.dob),
        });
      }
      votesRef.current = map;
      showVotes(map);
      // Voted earlier (or on another device): tick the daily task
      if (uid && map.has(uid)) recordTask(uid, 'voted').then(() => refreshPoints());
    } catch (error: any) {
      console.warn('Error fetching votes:', error?.code, error?.message);
    } finally {
      setVotesLoading(false);
    }
  }, [uid, user?.gender, user?.dob, displayName, showVotes, refreshPoints]);

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
            stylePrefs: stored.stylePrefs,
            isPublic: stored.isPublic !== false,
          });
        }
      } catch (e: any) {
        console.warn('Home profile load failed:', e?.message);
      }
      const res = await recordDailyLogin(uid);
      if (alive) setStreak(res.streak);
      await recordTask(uid, 'opened');
      if (alive) refreshPoints();
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

  useFocusEffect(
    useCallback(() => {
      setGreeting(greetingForNow());
      fetchVotes();
      refreshPoints();
    }, [fetchVotes, refreshPoints]),
  );

  useEffect(() => {
    setStarProfile({ name: user?.name, avatar: user?.avatarUrl });
  }, [user?.name, user?.avatarUrl]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (gateTimer.current) clearTimeout(gateTimer.current);
    },
    [],
  );

  // Tapping a colour sets (or changes) today's vote. Overwrites the same doc, so the old vote is gone.
  // voterName/voterAge are stored so the Boys/Girls lists need no extra reads.
  const handleVoteColor = async (colorName: string) => {
    if (!uid) {
      Alert.alert('Please login to vote!');
      return;
    }
    if (colorName === myVote || voting) {
      if (!gateDone && colorName === myVote) finishGate();
      return;
    }
    const today = localDateKey();
    const voteId = `top_colors_${today}_${uid}`;
    const previous = myVote;
    const age = ageFromDob(user?.dob);
    setVoting(colorName);
    setMyVote(colorName); // optimistic
    try {
      await setDoc(doc(db, 'votes', voteId), {
        systemId: 'top_colors',
        color: colorName,
        userId: uid,
        voterGender: user?.gender || null,
        voterName: displayName === 'there' ? 'Outfit user' : displayName.slice(0, 60),
        voterAge: age,
        date: today,
        timestamp: serverTimestamp(),
      });
    } catch (error: any) {
      console.warn('Voting error:', error?.code, error?.message);
      setMyVote(previous);
      setVoting(null);
      Alert.alert(
        'Vote not saved',
        error?.code === 'permission-denied' ? SERVER_SETUP_MESSAGE : firestoreErrorMessage(error, 'Voting'),
      );
      return;
    }
    lastWriteRef.current = { color: colorName, date: today, at: Date.now() };
    const map: VoteMap = new Map(votesRef.current);
    map.set(uid, { uid, color: colorName, gender: String(user?.gender || '').toLowerCase(), name: displayName, age });
    votesRef.current = map;
    showVotes(map);
    setFlashName(colorName);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashName(null), 1500);
    setVoting(null);
    recordTask(uid, 'voted').then(() => refreshPoints());
    fetchVotes();
    // First screen: show the rest of Home after a moment
    if (!gateDone) {
      if (gateTimer.current) clearTimeout(gateTimer.current);
      gateTimer.current = setTimeout(finishGate, 900);
    }
  };

  const openVoters = (colour: string, gender: 'male' | 'female') => {
    const voters: Voter[] = [];
    votesRef.current.forEach(v => {
      if (v.color === colour && v.gender === gender) voters.push(v);
    });
    voters.sort((a, b) => a.name.localeCompare(b.name));
    setVoterList({ title: `${gender === 'male' ? '👦 Boys' : '👧 Girls'} who voted ${colour}`, voters });
  };

  const totalPoints = points + friends * REFERRAL_POINTS;
  const totalVotes = topColours.reduce((n, c) => n + c.votes, 0);

  const voteList = (
    <View style={styles.topColoursCard}>
      {votesLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.pink} />
          <Text style={styles.loadingText}>Loading votes...</Text>
        </View>
      ) : (
        topColours.map((item, index) => (
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
                  <TouchableOpacity
                    style={styles.genderChip}
                    disabled={!item.boys}
                    onPress={() => openVoters(item.name, 'male')}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                    <Text style={[styles.genderText, item.boys > 0 && styles.genderLink]}>
                      👦 Boys {item.boys} ({item.men})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.genderChip}
                    disabled={!item.girls}
                    onPress={() => openVoters(item.name, 'female')}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                    <Text style={[styles.genderText, item.girls > 0 && styles.genderLink]}>
                      👧 Girls {item.girls} ({item.women})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {voting === item.name ? (
                <ActivityIndicator size="small" color={colors.pink} />
              ) : (
                <Text style={styles.colorPercentage}>{item.percentage}</Text>
              )}
            </TouchableOpacity>
            {index < topColours.length - 1 && <View style={styles.rowDivider} />}
          </React.Fragment>
        ))
      )}
    </View>
  );

  const voterModal = (
    <Modal visible={!!voterList} transparent animationType="fade" onRequestClose={() => setVoterList(null)}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVoterList(null)}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{voterList?.title}</Text>
          <FlatList
            data={voterList?.voters || []}
            keyExtractor={v => v.uid}
            style={styles.modalList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.voterRow}
                onPress={() => {
                  setVoterList(null);
                  navigation.navigate('UserProfile', { userId: item.uid });
                }}>
                <Text style={styles.voterName}>
                  {item.name}
                  {item.age !== null ? ` (${item.age})` : ''}
                </Text>
                <Text style={styles.voterArrow}>›</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.loadingText}>No votes yet.</Text>}
          />
          <TouchableOpacity style={styles.modalClose} onPress={() => setVoterList(null)}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const statusBar = (
    <StatusBar barStyle={statusBarStyle()} {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})} />
  );

  // ── First screen: only today's colour vote ──
  if (!gateDone) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {statusBar}
        <View style={styles.gateHeader}>
          <View style={styles.flex1}>
            <Text style={styles.gateHello}>
              {greeting}, {firstName} 👋
            </Text>
            <Text style={styles.gateTitle}>Vote today's colour</Text>
          </View>
          <TouchableOpacity onPress={finishGate} style={styles.skipBtn}>
            <Text style={styles.skipText}>{myVote ? 'Continue ›' : 'Skip'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.gateLucky}>
          {vaara.colours.map(c => (
            <View key={c.name} style={[styles.luckyDot, { backgroundColor: c.hex }]} />
          ))}
          <Text style={styles.gateLuckyText}>Panchangam colour: {vaara.colours.map(c => c.name).join(' / ')}</Text>
        </View>
        <Text style={styles.voteHint}>
          {myVote ? `Your vote: ${myVote}. Tap another colour to change it.` : 'Which colour will you wear today? Tap to vote.'}
          {totalVotes ? `  ·  ${totalVotes} votes today` : ''}
        </Text>
        <ScrollView contentContainerStyle={styles.gateScroll} showsVerticalScrollIndicator={false}>
          {voteList}
          {myVote ? (
            <TouchableOpacity style={styles.continueBtn} onPress={finishGate}>
              <Text style={styles.continueText}>Continue to Home</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
        {voterModal}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {statusBar}
      <ScrollView style={styles.flex1} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerLeft} onPress={() => navigation.navigate('Me')} activeOpacity={0.8}>
            <Avatar uri={user?.avatarUrl} name={displayName === 'there' ? '🙂' : displayName} size={40} />
            <Text style={styles.greeting} numberOfLines={1}>
              {greeting}, {firstName}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.notifBadge} activeOpacity={0.7} onPress={() => navigation.navigate('Achievements')}>
            <Text style={styles.notifIcon}>🏆</Text>
          </TouchableOpacity>
        </View>

        {/* Panchangam colour */}
        <View style={styles.plainHeaderRow}>
          <Text style={styles.sectionTitle}>Today's lucky colour (Panchangam)</Text>
        </View>
        <View style={styles.card}>
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
          <Text style={styles.panchangWhy}>Why: {vaara.why}</Text>
          {lucky ? (
            <Text style={styles.panchangLucky}>
              Your rashi ({lucky.rashi}) lord is {lucky.lord}: lucky colour {lucky.colour}.
            </Text>
          ) : null}
          <Text style={styles.panchangNote}>Traditional guidance (weekday ruling planet)</Text>
        </View>

        {/* Achievements shortcut (today's tasks live there now) */}
        <TouchableOpacity style={styles.achCard} activeOpacity={0.85} onPress={() => navigation.navigate('Achievements')}>
          <Text style={styles.achEmoji}>🏅</Text>
          <View style={styles.flex1}>
            <Text style={styles.achTitle}>{totalPoints.toLocaleString()} points</Text>
            <Text style={styles.achSub}>
              {doneToday}/3 tasks today · 🔥 {streak} day streak · tap for achievements
            </Text>
          </View>
          <Text style={styles.achArrow}>›</Text>
        </TouchableOpacity>

        {/* Today's Top Colours */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Today's Top Colours</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE RESULTS</Text>
          </View>
        </View>
        <Text style={styles.voteHint}>
          {myVote ? `Your vote: ${myVote}. Tap another colour to change it.` : 'Tap a colour to vote for today.'} Tap Boys /
          Girls to see who voted.
        </Text>
        {voteList}

        {/* Last week's celebrities */}
        <View style={styles.plainHeaderRow}>
          <Text style={styles.sectionTitle}>Congratulations! This week's celebrities ⭐</Text>
        </View>
        <View style={styles.card}>
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

        {/* Feed entry */}
        <TouchableOpacity style={styles.feedCard} activeOpacity={0.85} onPress={() => navigation.navigate('Feed')}>
          <Text style={styles.feedEmoji}>📸</Text>
          <View style={styles.flex1}>
            <Text style={styles.feedTitle}>Style Feed</Text>
            <Text style={styles.feedSub}>See today's looks from the community and vote A / B / C</Text>
          </View>
          <Text style={styles.feedArrow}>›</Text>
        </TouchableOpacity>

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
      {voterModal}
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl },
  // Vote-first screen
  gateHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingTop: spacing.md },
  gateHello: { fontSize: fontSize.sm, color: colors.textSecondary },
  gateTitle: { fontSize: fontSize.xxl, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  skipBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  skipText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.base },
  gateLucky: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  luckyDot: { width: 18, height: 18, borderRadius: 9, marginRight: 4, borderWidth: 1, borderColor: colors.border },
  gateLuckyText: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: fontWeight.semiBold, marginLeft: 4, flex: 1 },
  gateScroll: { paddingBottom: spacing.xxxl },
  continueBtn: {
    marginHorizontal: spacing.base,
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  continueText: { color: colors.onPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.md },
  // Home
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  greeting: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginLeft: spacing.md, flex: 1 },
  notifBadge: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  notifIcon: { fontSize: 20 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  plainHeaderRow: { paddingHorizontal: spacing.base, marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginHorizontal: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  swatchRow: { flexDirection: 'row', marginBottom: 10 },
  swatchItem: { alignItems: 'center', marginRight: 16 },
  swatchCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border },
  swatchLabel: { fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  panchangTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  panchangWhy: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  panchangLucky: { fontSize: 13, color: colors.accent, fontWeight: '600', marginTop: 6 },
  panchangNote: { fontSize: 11, color: colors.textMuted, marginTop: 8, fontStyle: 'italic' },
  achCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: spacing.lg,
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  achEmoji: { fontSize: 28, marginRight: spacing.md },
  achTitle: { fontSize: fontSize.md, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  achSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  achArrow: { fontSize: 26, color: colors.textMuted, marginLeft: spacing.sm },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.pink,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.surface,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.pink, marginRight: 6 },
  liveText: { fontSize: 9, fontWeight: 'bold', color: colors.pink, letterSpacing: 0.5 },
  voteHint: { fontSize: 12, color: colors.textSecondary, paddingHorizontal: spacing.base, marginBottom: spacing.sm },
  topColoursCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginHorizontal: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  colorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.base },
  colorRowVoted: { backgroundColor: colors.pinkSoft },
  colorRowFlash: { backgroundColor: colors.accentLight },
  colorRank: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    width: 24,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia-Bold' : 'serif',
  },
  colorCircle: { width: 36, height: 36, borderRadius: 18, marginLeft: 12, marginRight: 12, borderWidth: 1, borderColor: colors.border },
  colorDetails: { flex: 1 },
  colorName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  votesCountText: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  genderRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  genderChip: { marginRight: spacing.md, paddingVertical: 2 },
  genderText: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  genderLink: { color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' },
  colorPercentage: { fontSize: 16, fontWeight: '800', color: colors.pink },
  rowDivider: { height: 1, backgroundColor: colors.divider, marginHorizontal: spacing.base },
  loadingContainer: { padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: spacing.sm, fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  starsEmpty: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  starItem: { alignItems: 'center', width: 76, marginRight: 8 },
  starName: { fontSize: 11, fontWeight: '700', color: colors.textPrimary, marginTop: 4, maxWidth: 76 },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: spacing.xl,
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
  },
  feedEmoji: { fontSize: 30, marginRight: spacing.md },
  feedTitle: { color: colors.onPrimary, fontSize: 17, fontWeight: '800' },
  feedSub: { color: colors.onPrimary, opacity: 0.8, fontSize: 13, marginTop: 2 },
  feedArrow: { color: colors.onPrimary, fontSize: 28, marginLeft: spacing.sm },
  outfitCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginHorizontal: spacing.base,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  outfitImage: { width: '100%', height: 360, resizeMode: 'cover' },
  outfitBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  outfitBadgeText: { fontSize: 10, fontWeight: '800', color: '#0A1940', letterSpacing: 1 },
  // Voter list modal
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  modalCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, maxHeight: '75%' },
  modalTitle: { fontSize: fontSize.md, fontWeight: fontWeight.extraBold, color: colors.textPrimary, marginBottom: spacing.sm },
  modalList: { flexGrow: 0 },
  voterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  voterName: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary, fontWeight: fontWeight.semiBold },
  voterArrow: { fontSize: 22, color: colors.textMuted },
  modalClose: { alignSelf: 'flex-end', marginTop: spacing.md, padding: spacing.sm },
  modalCloseText: { color: colors.primary, fontWeight: fontWeight.bold },
}));
