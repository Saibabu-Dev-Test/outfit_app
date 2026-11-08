// "Me" tab, Instagram-like: avatar, counts (posts, wardrobe, followers, following), bio,
// Edit profile, and Posts / Wardrobe / Likes grids. Settings live behind the ☰ button.
import React, { useCallback, useState } from 'react';
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
import PhotoGrid from '../../components/PhotoGrid';
import { getProfileCounts, ProfileCounts } from '../../services/socialApi';
import { getLikedItems, getUserPosts, Post } from '../../services/feedApi';
import { getWardrobeItems } from '../../services/wardrobeApi';
import { getUserProfile } from '../../services/userApi';
import { isWeeklyStar } from '../../services/rewardsApi';
import { getMyReferralCode, shareReferral } from '../../utils/referralLink';

type Tab = 'posts' | 'wardrobe' | 'likes';

export default function MeScreen({ navigation }: { navigation: any }) {
  const { user, updateUserData } = useAuth();
  const uid = user?.id || '';
  const [counts, setCounts] = useState<ProfileCounts | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [wardrobe, setWardrobe] = useState<Post[]>([]);
  const [likes, setLikes] = useState<Post[] | null>(null);
  const [tab, setTab] = useState<Tab>('posts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStar, setIsStar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    const errs: string[] = [];
    const [c, p, w, prof] = await Promise.all([
      getProfileCounts(uid, true),
      getUserPosts(uid).catch(e => {
        errs.push(e?.message);
        return [] as Post[];
      }),
      getWardrobeItems(uid).catch(e => {
        errs.push(e?.message);
        return [];
      }),
      getUserProfile(uid),
    ]);
    setCounts(c);
    setPosts(p);
    setWardrobe(
      w
        .filter(i => !!i.imageUrl)
        .map(i => ({
          id: i.id,
          kind: 'wardrobe' as const,
          userId: uid,
          userName: user?.name || 'Me',
          userAvatar: user?.avatarUrl || null,
          imageData: i.imageUrl || '',
          photos: [i.imageUrl || ''],
          caption: i.name,
          likeCount: 0,
          commentCount: 0,
          createdAt: i.createdAt ? new Date(i.createdAt) : null,
        })),
    );
    if (Object.keys(prof).length) {
      updateUserData({ bio: prof.bio, stylePrefs: prof.stylePrefs, isPublic: prof.isPublic !== false });
    }
    setError(errs[0] || null);
    setLoading(false);
    setRefreshing(false);
    isWeeklyStar(uid).then(setIsStar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      load();
      setLikes(null);
    }, [load]),
  );

  const openTab = async (t: Tab) => {
    setTab(t);
    if (t === 'likes' && likes === null && uid) {
      try {
        setLikes(await getLikedItems(uid));
      } catch (e: any) {
        setError(e?.message || 'Could not load likes');
        setLikes([]);
      }
    }
  };

  // Invite friends to download the app (link with my referral code)
  const invite = async () => {
    const code = await getMyReferralCode(uid);
    if (code) shareReferral(code);
    else navigation.navigate('Settings');
  };

  const open = (p: Post) => navigation.navigate('PostDetail', { kind: p.kind, id: p.id });
  const grid = tab === 'posts' ? posts : tab === 'wardrobe' ? wardrobe : likes || [];

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
        <TouchableOpacity style={styles.barBtn} onPress={() => navigation.navigate('NewPost')}>
          <Text style={styles.barIcon}>＋</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.barBtn} onPress={invite} accessibilityLabel="Invite friends to download the app">
          <Text style={styles.barIcon}>🎁</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.barBtn} onPress={() => navigation.navigate('Achievements')}>
          <Text style={styles.barIcon}>🏆</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.barBtn} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.barIcon}>☰</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setLikes(null);
              load();
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
          isPrivate={user?.isPublic === false}>
          <TouchableOpacity style={hb.btn} onPress={() => navigation.navigate('Settings', { edit: true })}>
            <Text style={hb.btnText}>Edit profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={hb.btn} onPress={() => navigation.navigate('Achievements')}>
            <Text style={hb.btnText}>Achievements</Text>
          </TouchableOpacity>
          <TouchableOpacity style={hb.btn} onPress={() => navigation.navigate('UserSearch')}>
            <Text style={hb.btnText}>Find people</Text>
          </TouchableOpacity>
        </ProfileHeader>

        <View style={styles.tabs}>
          {(['posts', 'wardrobe', 'likes'] as Tab[]).map(t => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabOn]} onPress={() => openTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                {t === 'posts' ? '▦ Posts' : t === 'wardrobe' ? '👗 Wardrobe' : '♡ Likes'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading || (tab === 'likes' && likes === null) ? (
          <ActivityIndicator style={styles.spinner} color={colors.primary} />
        ) : (
          <PhotoGrid
            items={grid}
            onPress={open}
            empty={
              tab === 'posts'
                ? 'No posts yet. Tap ＋ to share a look.'
                : tab === 'wardrobe'
                ? 'No wardrobe photos yet.'
                : 'Posts and photos you like show up here.'
            }
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
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabOn: { borderBottomWidth: 2, borderBottomColor: colors.textPrimary },
  tabText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semiBold },
  tabTextOn: { color: colors.textPrimary, fontWeight: fontWeight.bold },
  error: { color: colors.error, textAlign: 'center', padding: spacing.sm },
  spinner: { marginTop: spacing.xl },
}));
