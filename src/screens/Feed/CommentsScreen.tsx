// Comments on a feed post, a public wardrobe photo or a circle photo post: live list, add (bad-word filtered), long-press to report or delete.
// The feed shows comments inline on each card now; this screen stays for deep links / notifications.
// Replies (posts + wardrobe photos) are listed indented under their parent.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import KeyboardSafeView, { useKeyboardShown } from '../../components/KeyboardSafeView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import Avatar from '../../components/Avatar';
import ReportModal, { ReportTarget } from '../../components/ReportModal';
import { Comment, Post, MAX_COMMENT_CHARS, getPost, getWardrobeAsPost } from '../../services/feedApi';
import {
  CommentTarget,
  addTargetComment,
  deleteTargetComment,
  subscribeTargetComments,
} from '../../services/engagementApi';
import { containsProfanity, RESPECT_MESSAGE } from '../../utils/profanity';
import { timeAgo } from '../../utils/date';
import { logActivity } from '../../services/activityApi';
import { replyParentId, threadComments } from '../../utils/commentThreads';

export default function CommentsScreen({ navigation, route }: { navigation: any; route: any }) {
  // Old callers pass { postId }; new ones pass { target }
  const target: CommentTarget | null =
    route?.params?.target || (route?.params?.postId ? { kind: 'post', id: route.params.postId } : null);
  const postId: string = target?.kind === 'post' ? target.id : '';
  const targetKey = target ? `${target.kind}:${(target as any).circleId || ''}:${target.id}` : '';
  const highlightId: string | undefined = route?.params?.highlightId;
  const { user } = useAuth();
  const uid = user?.id;
  const { isAdmin } = useIsAdmin(uid);

  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [replyTo, setReplyTo] = useState<{ parentId: string; name: string } | null>(null);
  const canReply = target?.kind === 'post' || target?.kind === 'wardrobe';
  // Parents oldest first, each followed by its replies (orphaned replies at the end)
  const threaded = useMemo(() => {
    const { top, replies, orphans } = threadComments(comments);
    return [...top.flatMap(c => [c, ...(replies[c.id] || [])]), ...orphans];
  }, [comments]);
  const listRef = useRef<FlatList<Comment>>(null);
  // Keyboard opened: the list got shorter, keep the latest comments in view
  useKeyboardShown(() => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50));

  useEffect(() => {
    if (!target) return;
    if (target.kind === 'post') {
      getPost(target.id)
        .then(setPost)
        .catch(() => setPost(null));
    } else if (target.kind === 'wardrobe') {
      getWardrobeAsPost(target.id).then(setPost);
    }
    const unsub = subscribeTargetComments(
      target,
      list => {
        setComments(list);
        setError(null);
        setLoading(false);
      },
      msg => {
        setError(msg);
        setLoading(false);
      },
    );
    return () => {
      try {
        unsub();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  // Admin opening a reported comment: scroll to it
  useEffect(() => {
    if (!highlightId || !threaded.length) return;
    const i = threaded.findIndex(c => c.id === highlightId);
    if (i >= 0) {
      setTimeout(() => listRef.current?.scrollToIndex({ index: i, animated: true, viewPosition: 0.3 }), 300);
    }
  }, [highlightId, threaded]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    if (!uid) {
      Alert.alert('Not signed in', 'Please sign in again to comment.');
      return;
    }
    if (containsProfanity(t)) {
      Alert.alert('Not posted', RESPECT_MESSAGE);
      return;
    }
    setSending(true);
    try {
      if (!target) return;
      await addTargetComment(target, { uid, name: user?.name, avatar: user?.avatarUrl }, t, replyTo?.parentId);
      setReplyTo(null);
      // "<me> commented on your photo" in the owner's Activity (best-effort; owner looked up if not loaded)
      if (target.kind === 'post' || target.kind === 'wardrobe') {
        logActivity(
          post?.userId,
          { uid, name: user?.name, avatar: user?.avatarUrl },
          'comment',
          { kind: target.kind, id: target.id, thumbnail: post?.imageData },
          t,
        );
      }
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 300);
    } catch (e: any) {
      Alert.alert('Not posted', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const canDelete = (c: Comment) =>
    !!uid &&
    (c.userId === uid ||
      post?.userId === uid ||
      isAdmin ||
      (!!c.parentId && comments.some(p => p.id === c.parentId && p.userId === uid)));

  const startReply = (c: Comment) => {
    setReplyTo({ parentId: replyParentId(c), name: c.userName });
    setText(v => (v.trim() ? v : `@${c.userName.replace(/\s+/g, '')} `));
  };

  const onLongPress = (c: Comment) => {
    const buttons: any[] = [];
    if (canReply) buttons.push({ text: 'Reply', onPress: () => startReply(c) });
    // Reports cover feed post comments (the admin screen opens them by post)
    if (c.userId !== uid && postId) {
      buttons.push({ text: 'Report', onPress: () => setReportTarget({ postId, commentId: c.id }) });
    }
    if (canDelete(c)) {
      buttons.push({
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (target) await deleteTargetComment(target, c.id);
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Please try again.');
          }
        },
      });
    }
    if (!buttons.length) return;
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Comment', undefined, buttons);
  };

  const openProfile = (userId: string) => {
    if (userId) navigation.navigate('UserProfile', { userId });
  };

  const renderItem = ({ item }: { item: Comment }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onLongPress={() => onLongPress(item)}
      delayLongPress={350}
      style={[styles.row, !!item.parentId && styles.replyRow, item.id === highlightId && styles.rowHighlight]}>
      <TouchableOpacity onPress={() => openProfile(item.userId)}>
        <Avatar uri={item.userAvatar} name={item.userName} size={32} />
      </TouchableOpacity>
      <View style={styles.body}>
        <Text style={styles.text}>
          <Text style={styles.name} onPress={() => openProfile(item.userId)}>
            {item.userName}{' '}
          </Text>
          {item.text}
        </Text>
        <Text style={styles.time}>
          {timeAgo(item.createdAt)}
          {canReply ? (
            <Text style={styles.replyAction} onPress={() => startReply(item)}>
              {'   '}Reply
            </Text>
          ) : null}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const left = MAX_COMMENT_CHARS - text.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.surface } : {})}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Comments</Text>
      </View>

      {/* Comment box sits right on the keyboard (above the nav bar while it is closed) */}
      <KeyboardSafeView style={styles.flex1}>
        {post === null ? (
          <Text style={styles.empty}>This post was deleted.</Text>
        ) : (
          <FlatList
            ref={listRef}
            data={threaded}
            keyExtractor={c => c.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            onScrollToIndexFailed={() => {}}
            ListHeaderComponent={
              post?.caption ? (
                <View style={[styles.row, styles.captionRow]}>
                  <Avatar uri={post.userAvatar} name={post.userName} size={32} />
                  <View style={styles.body}>
                    <Text style={styles.text}>
                      <Text style={styles.name}>{post.userName} </Text>
                      {post.caption}
                    </Text>
                  </View>
                </View>
              ) : undefined
            }
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator style={styles.spinner} color={colors.primary} />
              ) : error ? (
                <Text style={styles.error}>{error}</Text>
              ) : (
                <Text style={styles.empty}>No comments yet. Say something nice ✨</Text>
              )
            }
          />
        )}

        {post !== null && replyTo ? (
          <View style={styles.replyBanner}>
            <Text style={styles.replyBannerText} numberOfLines={1}>
              Replying to @{replyTo.name}
            </Text>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.replyBannerX}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {post !== null ? (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={setText}
              maxLength={MAX_COMMENT_CHARS}
              multiline
            />
            {left <= 50 ? <Text style={styles.counter}>{left}</Text> : null}
            <TouchableOpacity onPress={send} disabled={!text.trim() || sending} style={styles.sendBtn}>
              {sending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.send, !text.trim() && styles.sendOff]}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardSafeView>
      <ReportModal target={reportTarget} reporterId={uid} onClose={() => setReportTarget(null)} />
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
  title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  list: { paddingVertical: spacing.sm, flexGrow: 1 },
  row: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  replyRow: { paddingLeft: spacing.md + 40 },
  replyAction: { fontWeight: fontWeight.bold },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  replyBannerText: { flex: 1, fontSize: fontSize.xs, color: colors.textSecondary },
  replyBannerX: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: 4 },
  rowHighlight: { backgroundColor: colors.divider },
  captionRow: { borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.xs },
  body: { flex: 1, marginLeft: spacing.sm },
  name: { fontWeight: fontWeight.bold, color: colors.textPrimary },
  text: { fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 19 },
  time: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  spinner: { marginTop: spacing.xxl },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl },
  error: { textAlign: 'center', color: colors.error, padding: spacing.md },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  counter: { fontSize: fontSize.xs, color: colors.textMuted, marginLeft: spacing.xs },
  sendBtn: { paddingLeft: spacing.md, minWidth: 48, alignItems: 'center' },
  send: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.base },
  sendOff: { opacity: 0.4 },
}));
