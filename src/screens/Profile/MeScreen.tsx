// "Me" tab, Instagram-like: avatar (tap for full screen), counts (wear votes today, wardrobe, followers,
// following), bio, Edit profile, and 🔮 Astrology / Wardrobe / Today's pick / Likes tabs.
// Astrology (components/AstrologyPanel.tsx) is computed on the phone from the saved profile.
// The old Posts tab was replaced by the wardrobe "Wear today" votes (old posts still open from the
// Feed / Likes). Settings live behind the ⚙️ button.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import ProfileHeader, { headerButtonStyles as hb } from '../../components/ProfileHeader';
import CoinBadge from '../../components/coins/CoinBadge';
import PhotoGrid from '../../components/PhotoGrid';
import WardrobeVoteGrid from '../../components/WardrobeVoteGrid';
import TodaysPick from '../../components/TodaysPick';
import useWearVotes from '../../hooks/useWearVotes';
import { getProfileCounts, ProfileCounts } from '../../services/socialApi';
import { getCachedLikedItems, getLikedItems, Post, rememberPosts } from '../../services/feedApi';
import { getWardrobeItems, WardrobeItemResponse } from '../../services/wardrobeApi';
import { getUserProfile, saveUserProfile, StoredProfile } from '../../services/userApi';
import { astroChartStale, birthProfileUpdate } from '../../services/birthProfile';
import AstrologyPanel from '../../components/AstrologyPanel';
import { countFriendsJoined, isWeeklyStar, joinedWithLinkText } from '../../services/rewardsApi';
import { shareMyReferral } from '../../utils/referralLink';
import useIsAdmin from '../../hooks/useIsAdmin';

type Tab = 'astro' | 'wardrobe' | 'pick' | 'likes';

export default function MeScreen({ navigation }: { navigation: any }) {
  const { user, updateUserData } = useAuth();
  const uid = user?.id || '';
  const [counts, setCounts] = useState<ProfileCounts | null>(null);
  const [privateIds, setPrivateIds] = useState<Set<string>>(new Set());
  const [wardrobe, setWardrobe] = useState<Post[]>([]);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItemResponse[] | null>(null);
  const [profile, setProfile] = useState<StoredProfile>({});
  const [likes, setLikes] = useState<Post[] | null>(null);
  const [tab, setTab] = useState<Tab>('astro');
  const wear = useWearVotes(uid, uid);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStar, setIsStar] = useState(false);
  const [joined, setJoined] = useState<number | null>(null); // people who signed up with my link
  const [error, setError] = useState<string | null>(null);
  // 👥 Users row: admins only (users/{uid}.role == 'admin', same check as Admin)
  const { isAdmin } = useIsAdmin(uid);

  const load = useCallback(async () => {
    if (!uid) return;
    const errs: string[] = [];
    const [c, w, prof] = await Promise.all([
      getProfileCounts(uid, true),
      getWardrobeItems(uid).catch(e => {
        errs.push(e?.message);
        return [];
      }),
      getUserProfile(uid),
    ]);
    setCounts(c);
    setWardrobeItems(w);
    // Birth chart auto-fill (rashi, nakshatra, dasha...) when it is missing or the details changed
    if (astroChartStale(prof, prof.astroChart)) {
      const upd = birthProfileUpdate(prof, { prevConfirmedKey: prof.birthConfirmedKey });
      Object.assign(prof, upd);
      saveUserProfile(uid, upd).catch(e => console.warn('Birth chart save failed:', e?.message));
    }
    setProfile(prof);
    setPrivateIds(new Set(w.filter(i => !!i.imageUrl && !i.isPublic).map(i => i.id)));
    const wardrobePosts: Post[] = w
        .filter(i => !!i.imageUrl)
        .map(i => ({
          id: i.id,
          kind: 'wardrobe' as const,
          userId: uid,
          userName: user?.name || 'Me',
          userAvatar: user?.avatarUrl || null,
          imageData: i.imageUrl || '',
          photos: [i.imageUrl || ''],
          hasMedia: i.hasMedia,
          caption: i.name,
          likeCount: 0,
          commentCount: 0,
          createdAt: i.createdAt ? new Date(i.createdAt) : null,
        }));
    rememberPosts(wardrobePosts);
    setWardrobe(wardrobePosts);
    if (Object.keys(prof).length) {
      updateUserData({ bio: prof.bio, stylePrefs: prof.stylePrefs, isPublic: prof.isPublic !== false });
    }
    setError(errs[0] || null);
    setLoading(false);
    setRefreshing(false);
    isWeeklyStar(uid).then(setIsStar);
    countFriendsJoined(uid).then(setJoined);
    wear.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Likes: the cached list shows at once, then a fresh one replaces it (getLikedItems never
  // hangs: slow network = cached / empty list). Re-checked every time the tab is shown or the
  // screen comes back into focus while on it (no more endless spinner).
  const likesReq = useRef(0);
  const loadLikes = useCallback(async () => {
    if (!uid) {
      setLikes([]);
      return;
    }
    const req = ++likesReq.current;
    const cached = await getCachedLikedItems(uid);
    if (req !== likesReq.current) return;
    setLikes(prev => prev ?? cached ?? null);
    try {
      const fresh = await getLikedItems(uid);
      if (req === likesReq.current) setLikes(fresh);
    } catch {
      // Nothing cached and the read failed: friendly empty state, no red error
      if (req === likesReq.current) setLikes(prev => prev ?? []);
    }
  }, [uid]);

  const tabRef = useRef<Tab>(tab);
  tabRef.current = tab;
  useFocusEffect(
    useCallback(() => {
      load();
      if (tabRef.current === 'likes') loadLikes();
    }, [load, loadLikes]),
  );
  useEffect(() => {
    if (tab === 'likes') loadLikes();
  }, [tab, loadLikes]);

  const openTab = (t: Tab) => setTab(t);

  // Invite friends to download the app (link with my referral code)
  const invite = async () => {
    await shareMyReferral(uid);
  };

  const open = (p: Post) => navigation.navigate('PostDetail', { kind: p.kind, id: p.id });
  const editProfile = () => navigation.navigate('Settings', { edit: true });
  // Saved profile (fresh read) over the signed-in copy
  const astroProfile = {
    name: profile.name ?? user?.name,
    dob: profile.dob ?? user?.dob,
    timeOfBirth: profile.timeOfBirth ?? user?.timeOfBirth,
    placeOfBirth: profile.placeOfBirth ?? (user as any)?.placeOfBirth,
    rashi: profile.rashi ?? user?.rashi,
    gender: profile.gender ?? user?.gender,
    maritalStatus: profile.maritalStatus ?? (user as any)?.maritalStatus,
    language: profile.language ?? user?.language,
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.surface } : {})}
      />
      <View style={styles.bar}>
        <Text style={styles.barTitle} numberOfLines={1}>
          {user?.name || 'Me'}
        </Text>
        <TouchableOpacity
          style={styles.barBtn}
          onPress={() => navigation.navigate('Wardrobe', { screen: 'AddItem' })}
          accessibilityLabel="Add clothes to my wardrobe">
          <Text style={styles.barIcon}>＋👗</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.barBtn} onPress={invite} accessibilityLabel="Invite friends to download the app">
          <Text style={styles.barIcon}>🎁</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.barBtn} onPress={() => navigation.navigate('Achievements')}>
          <Text style={styles.barIcon}>🏆</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.barBtn} onPress={() => navigation.navigate('Settings')} accessibilityLabel="Settings">
          <Text style={styles.barIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
              if (tab === 'likes') loadLikes();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }>
        <ProfileHeader
          userId={uid}
          name={user?.name || 'Set your name'}
          avatarUrl={user?.avatarUrl}
          bio={user?.bio}
          stylePrefs={user?.stylePrefs}
          counts={counts}
          isStar={isStar}
          isPrivate={user?.isPublic === false}
          todayVotes={wear.loading ? undefined : wear.tally.total}
          onPressTodayVotes={() => openTab('pick')}
          badge={<CoinBadge uid={uid} />}>
          <TouchableOpacity style={hb.btn} onPress={editProfile}>
            <Text style={hb.btnText}>Edit profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={hb.btn} onPress={() => navigation.navigate('Achievements')}>
            <Text style={hb.btnText}>Achievements</Text>
          </TouchableOpacity>
        </ProfileHeader>

        {/* Invite: how many people signed up with my link (referral code) */}
        <TouchableOpacity style={styles.invite} onPress={invite} activeOpacity={0.8}>
          <Text style={styles.inviteText} numberOfLines={1}>
            🎁 {joined === null ? 'Invite friends' : joinedWithLinkText(joined)}
          </Text>
          <Text style={styles.inviteCta}>Invite</Text>
        </TouchableOpacity>

        {isAdmin ? (
          <TouchableOpacity style={styles.invite} onPress={() => navigation.navigate('AdminUsers')} activeOpacity={0.8}>
            <Text style={styles.inviteText} numberOfLines={1}>
              👥 Users
            </Text>
            <Text style={styles.inviteCta}>Admin ›</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.tabs}>
          {(['astro', 'wardrobe', 'pick', 'likes'] as Tab[]).map(t => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabOn]} onPress={() => openTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                {t === 'astro' ? '🔮 Astro' : t === 'wardrobe' ? '👗 Wardrobe' : t === 'pick' ? "⭐ Today's pick" : '♡ Likes'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {tab === 'astro' ? (
          <AstrologyPanel
            uid={uid}
            profile={astroProfile}
            wardrobe={wardrobeItems}
            onEditProfile={editProfile}
            onOpenPorutham={() => navigation.navigate('Porutham', { self: astroProfile })}
          />
        ) : loading || (tab === 'likes' && likes === null) ? (
          <ActivityIndicator style={styles.spinner} color={colors.primary} />
        ) : tab === 'wardrobe' ? (
          <WardrobeVoteGrid
            items={wardrobe}
            ownerId={uid}
            ownerName={user?.name}
            isOwner
            wear={wear}
            privateIds={privateIds}
            empty="No wardrobe photos yet. Tap ＋👗 to add clothes."
          />
        ) : tab === 'pick' ? (
          <TodaysPick
            items={wardrobe}
            ownerName={user?.name}
            isOwner
            wear={wear}
            onOpenWardrobe={() => openTab('wardrobe')}
          />
        ) : (
          <PhotoGrid
            items={likes || []}
            onPress={open}
            empty="No likes yet. Photos you like (double-tap in the Feed) show up here."
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  barTitle: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  barBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  barIcon: { fontSize: 22, color: colors.textPrimary },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inviteText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: fontWeight.semiBold },
  inviteCta: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.bold, marginLeft: spacing.sm },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabOn: { borderBottomWidth: 2, borderBottomColor: colors.textPrimary },
  tabText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semiBold },
  tabTextOn: { color: colors.textPrimary, fontWeight: fontWeight.bold },
  error: { color: colors.error, textAlign: 'center', padding: spacing.sm },
  spinner: { marginTop: spacing.xl },
}));
