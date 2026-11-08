// One post or public wardrobe photo, full size, with like / comment / A-F vote
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, Platform, useWindowDimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import PostCard from '../../components/PostCard';
import { getPost, getWardrobeAsPost, Post } from '../../services/feedApi';

export default function PostDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const kind: 'post' | 'wardrobe' = route?.params?.kind === 'wardrobe' ? 'wardrobe' : 'post';
  const id: string = route?.params?.id || '';
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin(user?.id);
  const { width } = useWindowDimensions();
  const [post, setPost] = useState<Post | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const p = kind === 'post' ? getPost(id).catch(() => null) : getWardrobeAsPost(id);
    p.then(x => alive && setPost(x));
    return () => {
      alive = false;
    };
  }, [kind, id]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.surface } : {})}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{kind === 'wardrobe' ? 'Wardrobe photo' : 'Post'}</Text>
      </View>
      {post === undefined ? (
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      ) : post === null ? (
        <Text style={styles.gone}>This post was deleted or is private.</Text>
      ) : (
        <ScrollView>
          <PostCard post={post} width={width} myUid={user?.id} isAdmin={isAdmin} onDeleted={() => navigation.goBack()} />
        </ScrollView>
      )}
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
  title: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  spinner: { marginTop: spacing.xxl },
  gone: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl },
}));
