// Comments on a feed post: live list, add (bad-word filtered), long-press to report or delete
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import Avatar from '../../components/Avatar';
import ReportModal, { ReportTarget } from '../../components/ReportModal';
import {
  Comment,
  Post,
  MAX_COMMENT_CHARS,
  addComment,
  deleteComment,
  getPost,
  subscribeComments,
} from '../../services/feedApi';
import { containsProfanity, RESPECT_MESSAGE } from '../../utils/profanity';
import { timeAgo } from '../../utils/date';

export default function CommentsScreen({ navigation, route }: { navigation: any; route: any }) {
  const postId: string = route?.params?.postId || '';
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
  const listRef = useRef<FlatList<Comment>>(null);

  useEffect(() => {
    if (!postId) return;
    getPost(postId)
      .then(setPost)
      .catch(() => setPost(null));
    const unsub = subscribeComments(
      postId,
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
  }, [postId]);

  // Admin opening a reported comment: scroll to it
  useEffect(() => {
    if (!highlightId || !comments.length) return;
    const i = comments.findIndex(c => c.id === highlightId);
    if (i >= 0) {
      setTimeout(() => listRef.current?.scrollToIndex({ index: i, animated: true, viewPosition: 0.3 }), 300);
    }
  }, [highlightId, comments]);

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
      await addComment(postId, { uid, name: user?.name, avatar: user?.avatarUrl }, t);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 300);
    } catch (e: any) {
      Alert.alert('Not posted', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const canDelete = (c: Comment) => !!uid && (c.userId === uid || post?.userId === uid || isAdmin);

  const onLongPress = (c: Comment) => {
    const buttons: any[] = [];
    if (c.userId !== uid) {
      buttons.push({ text: 'Report', onPress: () => setReportTarget({ postId, commentId: c.id }) });
    }
    if (canDelete(c)) {
      buttons.push({
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(postId, c.id);
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
      style={[styles.row, item.id === highlightId && styles.rowHighlight]}>
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
        <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  const left = MAX_COMMENT_CHARS - text.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar
        barStyle="dark-content"
        {...(Platform.OS === 'android' ? { backgroundColor: colors.surface } : {})}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Comments</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        {post === null ? (
          <Text style={styles.empty}>This post was deleted.</Text>
        ) : (
          <FlatList
            ref={listRef}
            data={comments}
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
      </KeyboardAvoidingView>
      <ReportModal target={reportTarget} reporterId={uid} onClose={() => setReportTarget(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
});
