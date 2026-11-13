// Another user's profile (Instagram style): avatar (tap for full screen), counts, Follow / Unfollow,
// Share profile, their public wardrobe (vote "Wear today" once a day, like, comment) and Likes (the
// posts and public wardrobe photos they liked, 20 per page, loaded when the tab opens). The old Posts
// and Today's pick tabs were removed; posts stay in the Feed. Private profiles show "This account is private".
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
  Alert,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import ProfileHeader, { headerButtonStyles as hb } from '../../components/ProfileHeader';
import WardrobeVoteGrid from '../../components/WardrobeVoteGrid';
import useWearVotes from '../../hooks/useWearVotes';
import { getPublicUser, PublicUser } from '../../services/userApi';
import { FeedCursor, getUserLikesPage, getUserPublicWardrobePosts, Post } from '../../services/feedApi';
import { isWeeklyStar } from '../../services/rewardsApi';
import { follow, getProfileCounts, isFollowing, ProfileCounts, unfollow } from '../../services/socialApi';
import { shareWithReferral } from '../../utils/referralLink';
import { useBottomSpace } from '../../hooks/useBottomSpace';

type TabKey = 'wardrobe' | 'likes';

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
  // Likes tab: null = not loaded yet (first page loads when the tab opens)
  const [likes, setLikes] = useState<Post[] | null>(null);
  const [likesCursor, setLikesCursor] = useState<FeedCursor>(null);
  const [likesMore, setLikesMore] = useState(false);
  const [likesBusy, setLikesBusy] = useState(false);
  const [likesError, setLikesError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - 4) / 3);
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

  // One page of this user's likes; reset = first page (tab opened / pull to refresh)
  const loadLikes = useCallback(
    async (reset: boolean) => {
      if (!userId) return;
      setLikesBusy(true);
      try {
        const r = await getUserLikesPage(userId, reset ? null : likesCursor);
        setLikes(prev => {
          const base = reset || !prev ? [] : prev;
          const seen = new Set(base.map(p => `${p.kind}_${p.id}`));
          return base.concat(r.items.filter(p => !seen.has(`${p.kind}_${p.id}`)));
        });
        setLikesCursor(r.cursor);
        setLikesMore(r.hasMore);
        setLikesError(null);
      } catch (e: any) {
        setLikes(prev => prev ?? []);
        setLikesMore(false);
        setLikesError(e?.message || 'Could not load likes.');
      } finally {
        setLikesBusy(false);
        setRefreshing(false);
      }
    },
    [userId, likesCursor],
  );

  useEffect(() => {
    if (tab !== 'likes' || status !== 'ok' || likesBusy) return;
    if (likes === null) loadLikes(true);
    // A page of only hidden items (private photos, deleted posts): fetch the next one
    else if (!likes.length && likesMore && !likesError) loadLikes(false);
  }, [tab, status, likes, likesBusy, likesMore, likesError, loadLikes]);

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
      <FlatList
        data={tab === 'likes' ? likes || [] : []}
        keyExtractor={p => `${p.kind}_${p.id}`}
        numColumns={3}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        ListHeaderComponent={
          <>
            <ProfileHeader
              userId={userId}
              name={profile.name}
              avatarUrl={profile.avatarUrl}
              bio={profile.bio}
              counts={counts}
              isStar={isStar}
              isPrivate={!profile.isPublic}
              todayVotes={wear.loading ? undefined : wear.tally.total}
              onPressTodayVotes={() => setTab('wardrobe')}>
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
              {(['wardrobe', 'likes'] as TabKey[]).map(t => (
                <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabOn]} onPress={() => setTab(t)}>
                  <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                    {t === 'wardrobe' ? `👗 Wardrobe (${items.length})` : '♥ Likes'}
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
            ) : likesError ? (
              <Text style={styles.error}>{likesError}</Text>
            ) : null}
          </>
        }
        renderItem={({ item: p }) => (
          <TouchableOpacity
            style={[styles.likeTile, { width: tile, height: tile }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('PostDetail', { kind: p.kind, id: p.id })}
            accessibilityLabel="Open liked photo">
            <Image source={{ uri: p.imageData }} style={{ width: tile, height: tile }} resizeMode="cover" />
            {p.photos.length > 1 ? (
              <View style={styles.likeBadge}>
                <Text style={styles.likeBadgeText}>A-{String.fromCharCode(64 + p.photos.length)}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          tab === 'likes' ? (
            likes === null || likesBusy ? (
              <ActivityIndicator style={styles.spinner} color={colors.primary} />
            ) : likesError ? undefined : (
              <Text style={styles.empty}>{`${profile.name} hasn't liked any public photos yet.`}</Text>
            )
          ) : undefined
        }
        ListFooterComponent={
          tab === 'likes' && likesBusy && !!likes?.length ? (
            <ActivityIndicator style={styles.spinner} color={colors.primary} />
          ) : undefined
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (tab === 'likes' && likesMore && !likesBusy) loadLikes(false);
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
              if (tab === 'likes') loadLikes(true);
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
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
  spinner: { marginTop: spacing.xl },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl, fontSize: fontSize.sm },
  likeTile: { margin: 0.66, backgroundColor: colors.divider },
  likeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  likeBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
}));
