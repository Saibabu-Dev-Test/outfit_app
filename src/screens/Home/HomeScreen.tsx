// Home. App open lands straight here (no vote-first / "Continue to Home" screen): live results in one fixed-height box that scrolls inside itself (tap Boys / Girls
// to see who voted), then today's lucky colour (Panchangam, IST date), the weekly celebrities and
// the feed entry. Points / daily tasks live in Achievements (Me tab).
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize, fontWeight, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { getUserProfile, recordDailyLogin, saveUserProfile } from '../../services/userApi';
import { compactMyClearCopies, hasUploadedToday } from '../../services/wardrobeApi';
import { getTodayVaaraColour, getRashiLuckyColour, getTodayLuckyMessage } from '../../utils/panchangam';
import { localDateKey, greetingForNow } from '../../utils/date';
import { useDayKey } from '../../hooks/useDayKey';
import { markColourVoted } from '../../native/notifications';
import { firestoreErrorMessage, SERVER_SETUP_MESSAGE } from '../../utils/firebaseErrors';
import Avatar from '../../components/Avatar';
import { DobRequiredModal } from '../../components/DobPicker';
import NameWithAge from '../../components/NameWithAge';
import { ageFromDobIST, isValidDob } from '../../utils/age';
import BirthdaysCard from '../../components/BirthdaysCard';
import FunctionPlanCard from '../../components/FunctionPlanCard';
import {
  checkWeeklyStars,
  getDay,
  getLastWeekStars,
  recordTask,
  setStarProfile,
  WeeklyStar,
} from '../../services/rewardsApi';

// Colours shown in the daily vote: exactly 10, ranked 1..10
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

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user, updateUserData } = useAuth();
  // Once per user: drop the old duplicate 1080 px feed copies (free-tier space); runs in the background
  useEffect(() => {
    const id = user?.id ? String(user.id) : null;
    if (!id) return;
    const t = setTimeout(() => compactMyClearCopies(id), 8000);
    return () => clearTimeout(t);
  }, [user?.id]);
  // Gender is mandatory: older accounts (signed up when it was optional) pick it once
  const genderAsked = useRef(false);
  useEffect(() => {
    const id = user?.id ? String(user.id) : null;
    if (!id || genderAsked.current) return;
    let alive = true;
    getUserProfile(id)
      .then((p: any) => {
        if (!alive || genderAsked.current || (p?.gender || '').trim()) return;
        genderAsked.current = true;
        const save = (g: string) =>
          saveUserProfile(id, { gender: g } as any)
            .then(() => updateUserData({ gender: g } as any))
            .catch(() => {
              genderAsked.current = false;
            });
        Alert.alert(
          'Select your gender',
          'Gender is required for outfit and astrology suggestions.',
          [
            { text: 'Male', onPress: () => save('Male') },
            { text: 'Female', onPress: () => save('Female') },
            { text: 'Other', onPress: () => save('Other') },
          ],
          { cancelable: false },
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  // Date of birth is mandatory too: older accounts without one get a blocking prompt once
  const [needDob, setNeedDob] = useState(false);
  useEffect(() => {
    const id = user?.id ? String(user.id) : null;
    if (!id) return;
    let alive = true;
    getUserProfile(id)
      .then((p: any) => {
        if (alive && !isValidDob(p?.dob)) setNeedDob(true);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user?.id]);
  const saveDob = async (dob: string) => {
    const id = String(user?.id || '');
    if (!id) return;
    await saveUserProfile(id, { dob } as any);
    updateUserData({ dob } as any);
    setNeedDob(false);
  };
  const uid = user?.id;
  const [topColours, setTopColours] = useState<ColourTally[]>(emptyTally());
  const [myVote, setMyVote] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);
  const [votesLoading, setVotesLoading] = useState<boolean>(true);
  const [stars, setStars] = useState<WeeklyStar[]>([]);
  const [flashName, setFlashName] = useState<string | null>(null);
  const [voterList, setVoterList] = useState<{ title: string; voters: Voter[] } | null>(null);
  // Votes by userId, and our last write (a refetch must not undo it with stale data)
  const votesRef = useRef<VoteMap>(new Map());
  const lastWriteRef = useRef<{ color: string; date: string; at: number } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [greeting, setGreeting] = useState<string>(greetingForNow());

  const displayName = (user?.name || '').trim() || 'there';
  const firstName = displayName.split(' ')[0];
  // Changes at 12:00 AM local time: today's colour votes start again from 0
  const dayKey = useDayKey();
  const vaara = getTodayVaaraColour();
  const luckyMessage = getTodayLuckyMessage();
  const lucky = getRashiLuckyColour(user?.rashi);
  // The results box never takes more than ~55% of the screen; it scrolls inside itself
  const { height: windowHeight } = useWindowDimensions();
  const voteBoxMaxHeight = Math.max(260, Math.round(windowHeight * 0.55));

  const showVotes = useCallback(
    (map: VoteMap) => {
      setTopColours(tally(map));
      setMyVote(uid ? map.get(uid)?.color ?? null : null);
    },
    [uid],
  );

  // Daily tasks (shown in Achievements): uploaded before this build tracked it -> tick the task now
  const refreshPoints = useCallback(async () => {
    if (!uid) return;
    try {
      const d = await getDay(uid);
      if (!d.uploaded && (await hasUploadedToday(uid))) await recordTask(uid, 'uploaded');
    } catch (e: any) {
      console.warn('Daily task check failed:', e?.message);
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
          age: ageFromDobIST(user?.dob),
        });
      }
      votesRef.current = map;
      showVotes(map);
      // Voted earlier (or on another device): tick the daily task and stop today's vote reminders
      if (uid && map.has(uid)) {
        recordTask(uid, 'voted').then(() => refreshPoints());
        markColourVoted(uid, today);
      }
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
            placeOfBirth: stored.placeOfBirth,
            bio: stored.bio,
            stylePrefs: stored.stylePrefs,
            isPublic: stored.isPublic !== false,
          });
        }
      } catch (e: any) {
        console.warn('Home profile load failed:', e?.message);
      }
      await recordDailyLogin(uid);
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

  // Midnight while Home is open (or the app comes back on a new day): clear yesterday's tallies and
  // my vote, then load the new day's votes (none yet = all 0).
  const dayKeyRef = useRef(dayKey);
  useEffect(() => {
    if (dayKeyRef.current === dayKey) return;
    dayKeyRef.current = dayKey;
    votesRef.current = new Map();
    lastWriteRef.current = null;
    setTopColours(emptyTally());
    setMyVote(null);
    setVoterList(null);
    setGreeting(greetingForNow());
    fetchVotes();
    refreshPoints();
    if (uid) recordTask(uid, 'opened').then(() => refreshPoints());
  }, [dayKey, fetchVotes, refreshPoints, uid]);

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
  // voterName/voterAge are stored so the Boys/Girls lists need no extra reads.
  const handleVoteColor = async (colorName: string) => {
    if (!uid) {
      Alert.alert('Please login to vote!');
      return;
    }
    if (colorName === myVote || voting) return;
    const today = localDateKey();
    const voteId = `top_colors_${today}_${uid}`;
    const previous = myVote;
    const age = ageFromDobIST(user?.dob);
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
    // No more hourly vote reminders until 1 AM tomorrow (written locally + native alarm)
    markColourVoted(uid, today);
    fetchVotes();
  };

  const openVoters = (colour: string, gender: 'male' | 'female') => {
    const voters: Voter[] = [];
    votesRef.current.forEach(v => {
      if (v.color === colour && v.gender === gender) voters.push(v);
    });
    voters.sort((a, b) => a.name.localeCompare(b.name));
    setVoterList({ title: `${gender === 'male' ? '👦 Boys' : '👧 Girls'} who voted ${colour}`, voters });
  };

  const voteList = (
    <View style={[styles.topColoursCard, { maxHeight: voteBoxMaxHeight }]}>
      {votesLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.pink} />
          <Text style={styles.loadingText}>Loading votes...</Text>
        </View>
      ) : (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          style={[styles.voteScroll, { maxHeight: voteBoxMaxHeight }]}
          contentContainerStyle={styles.voteScrollContent}>
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
                <Text style={styles.colorRank} numberOfLines={1}>
                  {index + 1}
                </Text>
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
          ))}
        </ScrollView>
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
                <NameWithAge style={styles.voterName} uid={item.uid} name={item.name} age={item.age} />
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

        {/* Today's lucky colour (Panchangam: weekday ruling planet, IST date) */}
        <View style={styles.plainHeaderRow}>
          <Text style={styles.sectionTitle}>Today's lucky colour</Text>
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
          <Text style={styles.luckyName}>{vaara.colours.map(c => c.name).join(' / ')}</Text>
          <Text style={styles.panchangTitle}>
            {vaara.weekday} · {vaara.vaara} · ruled by {vaara.graha}
          </Text>
          <Text style={styles.panchangWhy}>{vaara.why}</Text>
          {lucky ? (
            <Text style={styles.panchangLucky}>
              Your rashi ({lucky.rashi}) lord is {lucky.lord}: lucky colour {lucky.colour}.
            </Text>
          ) : null}
          <View style={styles.motivationBox}>
            <Text style={styles.motivationText}>✨ {luckyMessage}</Text>
          </View>
          <Text style={styles.panchangNote}>Traditional Panchangam guidance (weekday ruling planet)</Text>
        </View>

        {/* 🎂 Birthdays today + next 7 days (opt-in), wishes, and the birthday circle on my birthday */}
        {user?.id ? <FunctionPlanCard uid={String(user.id)} /> : null}
        {user?.id ? <BirthdaysCard uid={String(user.id)} /> : null}
        <DobRequiredModal visible={needDob} onSave={saveDob} />

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
            <Text style={styles.feedSub}>See today's looks from your circles and vote A / B / C</Text>
          </View>
          <Text style={styles.feedArrow}>›</Text>
        </TouchableOpacity>
      </ScrollView>
      {voterModal}
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl + spacing.xl },
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
  luckyName: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  motivationBox: {
    marginTop: 10,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.pinkSoft,
  },
  motivationText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, lineHeight: 19 },
  panchangNote: { fontSize: 11, color: colors.textMuted, marginTop: 8, fontStyle: 'italic' },
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
  voteScroll: { flexGrow: 0, flexShrink: 1 },
  voteScrollContent: { paddingBottom: spacing.sm },
  colorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.base },
  colorRowVoted: { backgroundColor: colors.pinkSoft },
  colorRowFlash: { backgroundColor: colors.accentLight },
  colorRank: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    minWidth: 34,
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
