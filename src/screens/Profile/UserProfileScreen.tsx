// Another user's profile (Instagram style): avatar (tap for full screen), counts, Follow / Unfollow,
// Share profile, their public wardrobe (vote "Wear today" once a day, like, comment) and "Today's pick"
// (the item with the most wear votes today). The old Posts tab was replaced; posts stay in the Feed.
// Private profiles show "This account is private".
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import ProfileHeader, { headerButtonStyles as hb } from '../../components/ProfileHeader';
import WardrobeVoteGrid from '../../components/WardrobeVoteGrid';
import TodaysPick from '../../components/TodaysPick';
import useWearVotes from '../../hooks/useWearVotes';
import { getPublicUser, PublicUser } from '../../services/userApi';
import { getUserPublicWardrobePosts, Post } from '../../services/feedApi';
import { isWeeklyStar } from '../../services/rewardsApi';
import { follow, getProfileCounts, isFollowing, ProfileCounts, unfollow } from '../../services/socialApi';
import { shareWithReferral } from '../../utils/referralLink';
import { useBottomSpace } from '../../hooks/useBottomSpace';

type TabKey = 'wardrobe' | 'pick';

export default function UserProfileScreen({ navigation, route }: { navigation: any; route: any }) {
  const bottomPad = useBottomSpace();
  const userId: string = route?.params?.userId || '';
  const { user: me } = useAuth();
  const isMe = !!me?.id && me.id === userId;

  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'private' | 'missing' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [items, setItems] = useState<Post[]>([]);
  const [counts, setCounts] = useState<ProfileCounts | null>(null);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [tab, setTab] = useState<TabKey>('wardrobe');
  const [refreshing, setRefreshing] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [isStar, setIsStar] = useState(false);
  // Only when the profile is visible (private profiles can't be voted on)
  const wear = useWearVotes(status === 'ok' ? userId : undefined, me?.id);

  const load = useCallback(async () => {
    if (!userId) {
      setStatus('missing');
      return;
    }
    const r = await getPublicUser(userId);
    if (r.status !== 'ok') {
      setStatus(r.status);
      setErrorMsg(r.status === 'error' ? r.message || null : null);
      setRefreshing(false);
      return;
    }
    if (!r.user.isPublic && !isMe) {
      setStatus('private');
      setRefreshing(false);
      return;
    }
    setProfile(r.user);
    setStatus('ok');
    const errs: string[] = [];
    const [w, c, f] = await Promise.all([
      getUserPublicWardrobePosts(userId).catch(e => {
        errs.push(e?.message);
        return [] as Post[];
      }),
      getProfileCounts(userId, isMe),
      me?.id && !isMe ? isFollowing(me.id, userId) : Promise.resolve(false),
    ]);
    setItems(w);
    setCounts(c);
    setFollowing(f);
    setSectionError(errs.length ? errs[0] : null);
    setRefreshing(false);
    wear.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isMe, me?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    isWeeklyStar(userId).then(v => alive && setIsStar(v));
    return () => {
      alive = false;
    };
  }, [userId]);

  const toggleFollow = async () => {
    if (!me?.id || !profile || followBusy) return;
    setFollowBusy(true);
    const was = following;
    setFollowing(!was);
    setCounts(c => (c ? { ...c, followers: Math.max(0, c.followers + (was ? -1 : 1)) } : c));
    try {
      if (was) await unfollow(me.id, userId);
      else
        await follow(
          { uid: me.id, name: me.name, avatar: me.avatarUrl },
          { uid: userId, name: profile.name, avatar: profile.avatarUrl },
        );
    } catch (e: any) {
      setFollowing(was);
      setCounts(c => (c ? { ...c, followers: Math.max(0, c.followers + (was ? 1 : -1)) } : c));
      Alert.alert(was ? 'Unfollow failed' : 'Follow failed', e?.message || 'Please try again.');
    } finally {
      setFollowBusy(false);
    }
  };

  // App link with my referral code, so friends download the app and find this profile
  const shareProfile = () => {
    if (!profile) return;
    const line = isMe
      ? 'Follow me on Outfit! Search for "' + profile.name + '" in the app.'
      : 'Check out ' + profile.name + "'s outfits on Outfit! Search for \"" + profile.name + '" in the app.';
    shareWithReferral(me?.id, line);
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.back}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {profile?.name || 'Profile'}
      </Text>
    </View>
  );

  if (status !== 'ok' || !profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {header}
        <View style={styles.center}>
          {status === 'loading' ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Text style={styles.lockEmoji}>{status === 'private' ? '🔒' : '👤'}</Text>
              <Text style={styles.centerTitle}>
                {status === 'private'
                  ? 'This account is private'
                  : status === 'missing'
                  ? 'Profile not found'
                  : 'Could not load profile'}
              </Text>
              {errorMsg ? <Text style={styles.centerText}>{errorMsg}</Text> : null}
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.surface } : {})}
      />
      {header}
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
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
        <ProfileHeader
          userId={userId}
          name={profile.name}
          avatarUrl={profile.avatarUrl}
          bio={profile.bio}
          counts={counts}
          isStar={isStar}
          isPrivate={!profile.isPublic}
          todayVotes={wear.loading ? undefined : wear.tally.total}
          onPressTodayVotes={() => setTab('pick')}>
          {isMe ? (
            <TouchableOpacity style={hb.btn} onPress={() => navigation.navigate('Settings', { edit: true })}>
              <Text style={hb.btnText}>Edit profile</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[hb.btn, !following && hb.btnPrimary]}
              onPress={toggleFollow}
              disabled={followBusy}
              accessibilityLabel={following ? 'Unfollow' : 'Follow'}>
              {followBusy ? (
                <ActivityIndicator size="small" color={following ? colors.primary : colors.onPrimary} />
              ) : (
                <Text style={[hb.btnText, !following && hb.btnTextPrimary]}>{following ? 'Unfollow' : 'Follow'}</Text>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={hb.btn} onPress={shareProfile}>
            <Text style={hb.btnText}>↗ Share profile</Text>
          </TouchableOpacity>
        </ProfileHeader>
        {profile.rashi ? <Text style={styles.rashi}>✨ {profile.rashi}</Text> : null}

        <View style={styles.tabs}>
          {(['wardrobe', 'pick'] as TabKey[]).map(t => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabOn]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                {t === 'wardrobe' ? `👗 Wardrobe (${items.length})` : "⭐ Today's pick"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {sectionError ? <Text style={styles.error}>{sectionError}</Text> : null}

        {tab === 'wardrobe' ? (
          <WardrobeVoteGrid
            items={items}
            ownerId={userId}
            ownerName={profile.name}
            isOwner={isMe}
            wear={wear}
            empty="No public wardrobe items."
          />
        ) : (
          <TodaysPick
            items={items}
            ownerName={profile.name}
            isOwner={isMe}
            wear={wear}
            onOpenWardrobe={() => setTab('wardrobe')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
  headerTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  lockEmoji: { fontSize: 48, marginBottom: spacing.sm },
  centerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary, textAlign: 'center' },
  centerText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  rashi: { fontSize: fontSize.sm, color: colors.accent, paddingHorizontal: spacing.base, marginBottom: spacing.sm },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabOn: { borderBottomWidth: 2, borderBottomColor: colors.textPrimary },
  tabText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semiBold },
  tabTextOn: { color: colors.textPrimary, fontWeight: fontWeight.bold },
  error: { color: colors.error, textAlign: 'center', padding: spacing.sm },
}));
