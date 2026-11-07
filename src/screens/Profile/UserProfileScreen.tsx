// Public profile: avatar, name, bio, rashi, posts grid and public wardrobe items
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  RefreshControl,
  StatusBar,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/Avatar';
import { getPublicUser, PublicUser } from '../../services/userApi';
import { getUserPosts, Post } from '../../services/feedApi';
import { firestoreErrorMessage } from '../../utils/firebaseErrors';
import { toDate } from '../../utils/date';
import { isWeeklyStar } from '../../services/rewardsApi';

interface PublicItem {
  id: string;
  name: string;
  imageUrl: string | null;
  category: string;
  createdAt: number;
}

// wardrobe where userId == X and isPublic == true (two equalities: no composite index). Sorted here.
const getPublicWardrobe = async (userId: string): Promise<PublicItem[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'wardrobe'), where('userId', '==', userId), where('isPublic', '==', true)),
    );
    return snap.docs
      .map(d => {
        const x: any = d.data();
        return {
          id: d.id,
          name: x?.name || x?.subCategory || x?.category || 'Item',
          imageUrl: x?.imageData || x?.imageUrl || null,
          category: x?.category || '',
          createdAt: toDate(x?.createdAt)?.getTime() || 0,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (e: any) {
    console.warn('getPublicWardrobe failed:', e?.code, e?.message);
    throw new Error(firestoreErrorMessage(e, 'Loading wardrobe'));
  }
};

type TabKey = 'posts' | 'wardrobe';

export default function UserProfileScreen({ navigation, route }: { navigation: any; route: any }) {
  const userId: string = route?.params?.userId || '';
  const { user: me } = useAuth();
  const isMe = !!me?.id && me.id === userId;
  const { width } = useWindowDimensions();
  const tile = Math.floor((width - 4) / 3);

  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'private' | 'missing' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [items, setItems] = useState<PublicItem[]>([]);
  const [tab, setTab] = useState<TabKey>('posts');
  const [refreshing, setRefreshing] = useState(false);
  const [openPost, setOpenPost] = useState<Post | null>(null);
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
    // Private profiles are visible only to their owner
    if (!r.user.isPublic && !isMe) {
      setStatus('private');
      setRefreshing(false);
      return;
    }
    setProfile(r.user);
    setStatus('ok');
    const errs: string[] = [];
    try {
      setPosts(await getUserPosts(userId));
    } catch (e: any) {
      errs.push(e?.message);
    }
    try {
      setItems(await getPublicWardrobe(userId));
    } catch (e: any) {
      errs.push(e?.message);
    }
    setSectionError(errs.length ? errs[0] : null);
    setRefreshing(false);
  }, [userId, isMe]);

  useEffect(() => {
    load();
  }, [load]);

  // ⭐ weekly celebrity badge
  useEffect(() => {
    let alive = true;
    isWeeklyStar(userId).then(v => alive && setIsStar(v));
    return () => {
      alive = false;
    };
  }, [userId]);

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
                  ? 'This profile is private'
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

  const grid = tab === 'posts' ? posts : items;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle="dark-content"
        {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})}
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
          />
        }>
        <View style={styles.top}>
          <Avatar uri={profile.avatarUrl} name={profile.name} size={86} />
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{posts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{items.length}</Text>
              <Text style={styles.statLabel}>Wardrobe</Text>
            </View>
          </View>
        </View>
        <View style={styles.bioBox}>
          <Text style={styles.name}>
            {profile.name}
            {isStar ? ' ⭐' : ''}
          </Text>
          {isStar && <Text style={styles.starBadge}>Weekly celebrity</Text>}
          {profile.rashi ? <Text style={styles.rashi}>✨ {profile.rashi}</Text> : null}
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          {isMe && !profile.isPublic ? (
            <Text style={styles.privateNote}>🔒 Your profile is private. Only you can see this page.</Text>
          ) : null}
        </View>

        <View style={styles.tabs}>
          {(['posts', 'wardrobe'] as TabKey[]).map(k => (
            <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabActive]} onPress={() => setTab(k)}>
              <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
                {k === 'posts' ? '▦ Posts' : '☰ Wardrobe'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {sectionError ? <Text style={styles.error}>{sectionError}</Text> : null}

        <View style={styles.grid}>
          {tab === 'posts'
            ? posts.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setOpenPost(p)} activeOpacity={0.85}>
                  <Image source={{ uri: p.imageData }} style={[styles.tile, { width: tile, height: tile }]} />
                </TouchableOpacity>
              ))
            : items.map(i => (
                <View key={i.id} style={{ width: tile }}>
                  {i.imageUrl ? (
                    <Image source={{ uri: i.imageUrl }} style={[styles.tile, { width: tile, height: tile }]} />
                  ) : (
                    <View style={[styles.tile, styles.tileEmpty, { width: tile, height: tile }]}>
                      <Text style={styles.tileEmptyText}>👕</Text>
                    </View>
                  )}
                  <Text style={styles.itemName} numberOfLines={1}>
                    {i.name}
                  </Text>
                </View>
              ))}
        </View>
        {!grid.length ? (
          <Text style={styles.emptyText}>
            {tab === 'posts' ? 'No posts yet.' : 'No public wardrobe items yet.'}
          </Text>
        ) : null}
      </ScrollView>

      <Modal visible={!!openPost} transparent animationType="fade" onRequestClose={() => setOpenPost(null)}>
        <TouchableOpacity style={styles.viewer} activeOpacity={1} onPress={() => setOpenPost(null)}>
          {openPost ? (
            <View style={styles.viewerCard}>
              <Image source={{ uri: openPost.imageData }} style={{ width: width - 32, height: width - 32 }} />
              <Text style={styles.viewerText}>
                ♥ {openPost.likeCount}
                {openPost.caption ? `   ${openPost.caption}` : ''}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  starBadge: { fontSize: fontSize.xs, color: '#F57C00', fontWeight: fontWeight.bold, marginTop: 2 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
  headerTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  lockEmoji: { fontSize: 48, marginBottom: spacing.sm },
  centerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  centerText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statNum: { fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  bioBox: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  rashi: { fontSize: fontSize.sm, color: colors.accent, marginTop: 2, fontWeight: fontWeight.semiBold },
  bio: { fontSize: fontSize.sm, color: colors.textPrimary, marginTop: 4, lineHeight: 19 },
  privateNote: { fontSize: fontSize.xs, color: '#92400E', marginTop: spacing.sm },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { borderTopWidth: 2, borderTopColor: colors.primary, marginTop: -1 },
  tabText: { color: colors.textMuted, fontWeight: fontWeight.semiBold },
  tabTextActive: { color: colors.primary, fontWeight: fontWeight.bold },
  error: { color: colors.error, textAlign: 'center', padding: spacing.sm, fontSize: fontSize.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  tile: { backgroundColor: colors.divider },
  tileEmpty: { alignItems: 'center', justifyContent: 'center' },
  tileEmptyText: { fontSize: 28 },
  itemName: { fontSize: fontSize.xs, color: colors.textSecondary, padding: 4 },
  emptyText: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  viewerCard: { alignItems: 'center', borderRadius: borderRadius.md, overflow: 'hidden' },
  viewerText: { color: colors.textInverse, fontSize: fontSize.base, marginTop: spacing.md, paddingHorizontal: spacing.base },
});
