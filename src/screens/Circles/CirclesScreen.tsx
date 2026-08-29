import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

const circles = [
  { id: '1', name: 'Street Style', members: 1240, posts: 340, emoji: '🔥', isJoined: true },
  { id: '2', name: 'Minimal Fits', members: 876, posts: 210, emoji: '🤍', isJoined: true },
  { id: '3', name: 'Office Looks', members: 654, posts: 178, emoji: '💼', isJoined: false },
  { id: '4', name: 'Festival Vibes', members: 2340, posts: 890, emoji: '🌟', isJoined: false },
  { id: '5', name: 'Vintage Finds', members: 430, posts: 124, emoji: '🕰️', isJoined: false },
];

const trendingPosts = [
  {
    id: '1',
    user: 'Alex K.',
    circle: 'Street Style',
    caption: 'Layering season is finally here 🧥',
    votes: 234,
    emoji: '🧥',
    color: '#E8EBF8',
  },
  {
    id: '2',
    user: 'Priya M.',
    circle: 'Minimal Fits',
    caption: 'Less is more. Monochrome day 🤍',
    votes: 187,
    emoji: '🤍',
    color: '#F5F5F5',
  },
];

export default function CirclesScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>Community</Text>
            <Text style={styles.title}>Circles</Text>
          </View>
          <TouchableOpacity style={styles.createBtn}>
            <Text style={styles.createBtnText}>+ Create</Text>
          </TouchableOpacity>
        </View>

        {/* My Circles */}
        <Text style={styles.sectionTitle}>My Circles</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.myCirclesScroll}
          contentContainerStyle={styles.myCirclesContent}>
          {circles.filter(c => c.isJoined).map(circle => (
            <TouchableOpacity key={circle.id} style={styles.myCircleCard} activeOpacity={0.85}>
              <View style={styles.circleEmojiBg}>
                <Text style={styles.circleEmoji}>{circle.emoji}</Text>
              </View>
              <Text style={styles.circleName}>{circle.name}</Text>
              <Text style={styles.circleMembers}>{circle.members} members</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addCircleCard}>
            <Text style={styles.addCircleIcon}>+</Text>
            <Text style={styles.addCircleText}>Find More</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Trending Posts */}
        <Text style={styles.sectionTitle}>Trending Now</Text>
        {trendingPosts.map(post => (
          <TouchableOpacity key={post.id} style={styles.postCard} activeOpacity={0.9}>
            <View style={[styles.postImage, { backgroundColor: post.color }]}>
              <Text style={styles.postEmoji}>{post.emoji}</Text>
            </View>
            <View style={styles.postFooter}>
              <View style={styles.postMeta}>
                <Text style={styles.postUser}>{post.user}</Text>
                <Text style={styles.postCircle}>in {post.circle}</Text>
              </View>
              <Text style={styles.postCaption}>{post.caption}</Text>
              <View style={styles.postActions}>
                <TouchableOpacity style={styles.voteBtn}>
                  <Text style={styles.voteIcon}>🔥</Text>
                  <Text style={styles.voteCount}>{post.votes}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.commentBtn}>
                  <Text style={styles.commentText}>💬 Comment</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareBtn}>
                  <Text style={styles.shareText}>↗ Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* Discover Circles */}
        <Text style={styles.sectionTitle}>Discover</Text>
        <View style={styles.discoverList}>
          {circles.filter(c => !c.isJoined).map(circle => (
            <TouchableOpacity key={circle.id} style={styles.discoverCard} activeOpacity={0.85}>
              <View style={styles.discoverLeft}>
                <View style={styles.discoverEmojiBox}>
                  <Text style={styles.discoverEmoji}>{circle.emoji}</Text>
                </View>
                <View>
                  <Text style={styles.discoverName}>{circle.name}</Text>
                  <Text style={styles.discoverMeta}>{circle.members} members • {circle.posts} posts</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.joinBtn}>
                <Text style={styles.joinBtnText}>Join</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
  },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary, letterSpacing: -0.5 },
  createBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  createBtnText: { color: colors.textInverse, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  myCirclesScroll: { marginBottom: spacing.xl },
  myCirclesContent: { paddingHorizontal: spacing.base, gap: spacing.md, paddingBottom: 4 },
  myCircleCard: {
    width: 100,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  circleEmojiBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  circleEmoji: { fontSize: 24 },
  circleName: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  circleMembers: { fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  addCircleCard: {
    width: 100,
    backgroundColor: colors.divider,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addCircleIcon: { fontSize: 24, color: colors.textMuted, marginBottom: spacing.xs },
  addCircleText: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: fontWeight.medium },
  postCard: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  postImage: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postEmoji: { fontSize: 80 },
  postFooter: { padding: spacing.base },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  postUser: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  postCircle: { fontSize: fontSize.sm, color: colors.textSecondary },
  postCaption: { fontSize: fontSize.base, color: colors.textPrimary, marginBottom: spacing.md },
  postActions: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voteIcon: { fontSize: 16 },
  voteCount: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  commentBtn: {},
  commentText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  shareBtn: {},
  shareText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  discoverList: { marginHorizontal: spacing.base, gap: spacing.sm },
  discoverCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  discoverLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  discoverEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverEmoji: { fontSize: 22 },
  discoverName: { fontSize: fontSize.base, fontWeight: fontWeight.semiBold, color: colors.textPrimary },
  discoverMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  joinBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  joinBtnText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
});
