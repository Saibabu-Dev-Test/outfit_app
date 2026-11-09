// Another user's profile (Instagram style): counts, Follow / Unfollow, Share profile, their posts as a
// scrolling feed (like, comment, A-F vote) and their public wardrobe photos as a grid.
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
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import ProfileHeader, { headerButtonStyles as hb } from '../../components/ProfileHeader';
import PhotoGrid from '../../components/PhotoGrid';
import PostCard from '../../components/PostCard';
import { getPublicUser, PublicUser } from '../../services/userApi';
import { getUserPosts, getUserPublicWardrobePosts, Post } from '../../services/feedApi';
import { isWeeklyStar } from '../../services/rewardsApi';
import { follow, getProfileCounts, isFollowing, ProfileCounts, unfollow } from '../../services/socialApi';
import { shareWithReferral } from '../../utils/referralLink';

type TabKey = 'posts' | 'wardrobe';

export default function UserProfileScreen({ navigation, route }: { navigation: any; route: any }) {
  const userId: string = route?.params?.userId || '';
  const { user: me } = useAuth();
  const isMe = !!me?.id && me.id === userId;
  const { isAdmin } = useIsAdmin(me?.id);
  const { width } = useWindowDimensions();

  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'private' | 'missing' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [items, setItems] = useState<Post[]>([]);
  const [counts, setCounts] = useState<ProfileCounts | null>(null);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [tab, setTab] = useState<TabKey>('posts');
  const [refreshing, setRefreshing] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [isStar, setIsStar] = useState(false);

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
    const [p, w, c, f] = await Promise.all([
      getUserPosts(userId).catch(e => {
        errs.push(e?.message);
        return [] as Post[];
      }),
      getUserPublicWardrobePosts(userId).catch(e => {
        errs.push(e?.message);
        return [] as Post[];
      }),
      getProfileCounts(userId, isMe),
      me?.id && !isMe ? isFollowing(me.id, userId) : Promise.resolve(false),
    ]);
    setPosts(p.map(x => ({ ...x, userName: r.user.name, userAvatar: r.user.avatarUrl || x.userAvatar })));
    setItems(w);
    setCounts(c);
    setFollowing(f);
    setSectionError(errs.length ? errs[0] : null);
    setRefreshing(false);
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
          stylePrefs={profile.stylePrefs}
          counts={counts}
          isStar={isStar}
          isPrivate={!profile.isPublic}>
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
          {(['posts', 'wardrobe'] as TabKey[]).map(t => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabOn]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                {t === 'posts' ? `▤ Posts (${posts.length})` : `👗 Wardrobe (${items.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {sectionError ? <Text style={styles.error}>{sectionError}</Text> : null}

        {tab === 'posts' ? (
          posts.length ? (
            posts.map(p => (
              <PostCard
                key={p.id}
                post={p}
                width={width}
                myUid={me?.id}
                isAdmin={isAdmin}
                onDeleted={d => setPosts(prev => prev.filter(x => x.id !== d.id))}
              />
            ))
          ) : (
            <Text style={styles.empty}>No posts yet.</Text>
          )
        ) : (
          <PhotoGrid
            items={items}
            onPress={p => navigation.navigate('PostDetail', { kind: p.kind, id: p.id })}
            empty="No public wardrobe items."
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
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl },
}));
