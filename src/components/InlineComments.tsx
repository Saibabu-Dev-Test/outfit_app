// Instagram-style comments inside a feed card: the latest 2 comments, "View all N comments" that
// expands in place (paged), one level of replies ("Reply" -> "Replying to @name ✕", replies
// indented under their parent behind "View N replies"), and the comment box right on the card.
// The feed scrolls the focused box above the keyboard through CommentInputFocusContext.
import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import { useAuth } from '../context/AuthContext';
import { Comment, MAX_COMMENT_CHARS, Post } from '../services/feedApi';
import {
  CommentCursor,
  CommentTarget,
  addTargetComment,
  deleteTargetComment,
  fetchCommentsPage,
  fetchLatestComments,
  fetchReplies,
} from '../services/engagementApi';
import { latestTopLevel, mergeComments, replyParentId, replyTotal, threadComments } from '../utils/commentThreads';
import { containsProfanity, RESPECT_MESSAGE } from '../utils/profanity';
import { logActivity } from '../services/activityApi';
import { timeAgo } from '../utils/date';

// Provided by the feed: called with the focused comment box so the list can scroll it above the keyboard
export const CommentInputFocusContext = createContext<((box: FocusBox | null) => void) | null>(null);
export type FocusBox = React.ComponentRef<typeof View>;

export interface InlineCommentsHandle {
  focus: () => void;
}

interface Props {
  post: Post;
  commentCount: number;
  myUid?: string;
  isAdmin?: boolean;
  onReport?: (commentId: string) => void;
}

const PREVIEW = 2;

const InlineComments = forwardRef<InlineCommentsHandle, Props>(function InlineCommentsInner(
  { post, commentCount, myUid, isAdmin, onReport },
  ref,
) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const reveal = useContext(CommentInputFocusContext);
  const target = useMemo<CommentTarget>(
    () => ({ kind: post.kind === 'post' ? 'post' : 'wardrobe', id: post.id }),
    [post.kind, post.id],
  );

  const [preview, setPreview] = useState<Comment[]>([]);
  const [paged, setPaged] = useState<Comment[]>([]); // pages + loaded replies
  const [added, setAdded] = useState<Comment[]>([]); // mine, this session
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [replyDelta, setReplyDelta] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState(false);
  const [cursor, setCursor] = useState<CommentCursor>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openReplies, setOpenReplies] = useState<Record<string, boolean>>({});
  const [loadingReplies, setLoadingReplies] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{
    parentId: string;
    name: string;
  } | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const boxRef = useRef<React.ComponentRef<typeof View>>(null);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  // Latest comments for the preview (only when there are any)
  const hasAny = commentCount > 0;
  useEffect(() => {
    if (!hasAny) return;
    let alive = true;
    fetchLatestComments(target, 6)
      .then(list => alive && setPreview(list))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [target, hasAny]);

  const all = useMemo(
    () => mergeComments(expanded ? paged : [...preview, ...paged], added).filter(c => !removed.has(c.id)),
    [expanded, preview, paged, added, removed],
  );
  const { top, replies } = useMemo(() => threadComments(all), [all]);
  const shownTop = expanded ? top : latestTopLevel(top, PREVIEW);

  const loadPage = async (from: CommentCursor) => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await fetchCommentsPage(target, from);
      setPaged(prev => mergeComments(prev, r.items));
      setCursor(r.cursor);
      setHasMore(r.hasMore);
    } catch (e: any) {
      Alert.alert('Comments', e?.message || 'Could not load comments.');
    } finally {
      setLoadingMore(false);
    }
  };

  const expand = () => {
    setExpanded(true);
    loadPage(null);
  };

  const totalReplies = (c: Comment) =>
    Math.max(0, replyTotal({ ...c, replyCount: c.replyCount + (replyDelta[c.id] || 0) }, (replies[c.id] || []).length));

  const toggleReplies = async (c: Comment) => {
    const open = !openReplies[c.id];
    setOpenReplies(o => ({ ...o, [c.id]: open }));
    if (!open || (replies[c.id] || []).length >= totalReplies(c)) return;
    setLoadingReplies(c.id);
    try {
      const list = await fetchReplies(target, c.id);
      setPaged(prev => mergeComments(prev, list));
    } catch (e: any) {
      Alert.alert('Replies', e?.message || 'Could not load replies.');
    } finally {
      setLoadingReplies(null);
    }
  };

  const startReply = (c: Comment) => {
    setReplyTo({ parentId: replyParentId(c), name: c.userName });
    setText(t => (t.trim() ? t : `@${c.userName.replace(/\s+/g, '')} `));
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyTo(null);
    setText(t => (/^@\S+\s*$/.test(t) ? '' : t));
  };

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    if (!myUid) {
      Alert.alert('Not signed in', 'Please sign in again to comment.');
      return;
    }
    if (containsProfanity(t)) {
      Alert.alert('Not posted', RESPECT_MESSAGE);
      return;
    }
    setSending(true);
    try {
      const me = { uid: myUid, name: user?.name, avatar: user?.avatarUrl };
      const parentId = replyTo?.parentId || null;
      const c = await addTargetComment(target, me, t, parentId);
      if (c) setAdded(prev => [...prev, c]);
      if (parentId) {
        setReplyDelta(d => ({ ...d, [parentId]: (d[parentId] || 0) + 1 }));
        setOpenReplies(o => ({ ...o, [parentId]: true }));
      }
      logActivity(post.userId, me, 'comment', { kind: post.kind, id: post.id, thumbnail: post.imageData }, t);
      setText('');
      setReplyTo(null);
    } catch (e: any) {
      Alert.alert('Not posted', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const canDelete = (c: Comment) => {
    if (!myUid) return false;
    if (c.userId === myUid || post.userId === myUid || isAdmin) return true;
    const parent = c.parentId ? all.find(x => x.id === c.parentId) : null;
    return !!parent && parent.userId === myUid;
  };

  const remove = async (c: Comment) => {
    try {
      await deleteTargetComment(target, c.id);
      setRemoved(prev => {
        const next = new Set(prev);
        next.add(c.id);
        (replies[c.id] || []).forEach(r => next.add(r.id));
        return next;
      });
      if (c.parentId) {
        const pid = c.parentId;
        setReplyDelta(d => ({ ...d, [pid]: (d[pid] || 0) - 1 }));
      }
      if (replyTo?.parentId === c.id) setReplyTo(null);
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message || 'Please try again.');
    }
  };

  const onLongPress = (c: Comment) => {
    const buttons: any[] = [{ text: 'Reply', onPress: () => startReply(c) }];
    if (c.userId !== myUid && post.kind === 'post' && onReport) {
      buttons.push({ text: 'Report', onPress: () => onReport(c.id) });
    }
    if (canDelete(c))
      buttons.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove(c),
      });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Comment', undefined, buttons);
  };

  const openProfile = (userId: string) => {
    if (userId) navigation.navigate('UserProfile', { userId });
  };

  const row = (c: Comment, reply: boolean) => (
    <TouchableOpacity
      key={c.id}
      activeOpacity={0.7}
      onLongPress={() => onLongPress(c)}
      delayLongPress={350}
      style={[styles.row, reply && styles.replyRow]}
    >
      <Text style={styles.text}>
        <Text style={styles.name} onPress={() => openProfile(c.userId)}>
          {c.userName}{' '}
        </Text>
        {c.text}
      </Text>
      <View style={styles.meta}>
        <Text style={styles.time}>{timeAgo(c.createdAt)}</Text>
        <Text style={styles.action} onPress={() => startReply(c)}>
          Reply
        </Text>
      </View>
    </TouchableOpacity>
  );

  const thread = (c: Comment) => {
    const n = totalReplies(c);
    const open = !!openReplies[c.id];
    return (
      <View key={c.id}>
        {row(c, false)}
        {n > 0 ? (
          <TouchableOpacity onPress={() => toggleReplies(c)} style={styles.repliesToggle}>
            <Text style={styles.toggleText}>
              {open ? '── Hide replies' : `── View ${n} ${n === 1 ? 'reply' : 'replies'}`}
            </Text>
            {loadingReplies === c.id ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </TouchableOpacity>
        ) : null}
        {open ? (replies[c.id] || []).map(r => row(r, true)) : null}
      </View>
    );
  };

  const left = MAX_COMMENT_CHARS - text.length;
  const hiddenCount = expanded ? 0 : commentCount - shownTop.length;

  return (
    <View>
      {!expanded && hiddenCount > 0 ? (
        <TouchableOpacity onPress={expand}>
          <Text style={styles.viewAll}>
            View all {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
          </Text>
        </TouchableOpacity>
      ) : null}
      {shownTop.map(thread)}
      {expanded && (hasMore || loadingMore) ? (
        <TouchableOpacity onPress={() => loadPage(cursor)} disabled={loadingMore} style={styles.more}>
          {loadingMore ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.viewAll}>Load more comments</Text>
          )}
        </TouchableOpacity>
      ) : null}
      {expanded ? (
        <TouchableOpacity onPress={() => setExpanded(false)}>
          <Text style={styles.viewAll}>Hide comments</Text>
        </TouchableOpacity>
      ) : null}

      <View ref={boxRef} collapsable={false}>
        {replyTo ? (
          <View style={styles.replyBanner}>
            <Text style={styles.replyBannerText} numberOfLines={1}>
              Replying to @{replyTo.name}
            </Text>
            <TouchableOpacity onPress={cancelReply} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.replyBannerX}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={replyTo ? `Reply to ${replyTo.name}...` : 'Add a comment...'}
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            maxLength={MAX_COMMENT_CHARS}
            multiline
            onFocus={() => reveal?.(boxRef.current)}
          />
          {left <= 50 ? <Text style={styles.counter}>{left}</Text> : null}
          {text.trim() || sending ? (
            <TouchableOpacity onPress={send} disabled={sending} style={styles.sendBtn}>
              {sending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.send}>Post</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
});

export default InlineComments;

const styles = themedStyles(() =>
  StyleSheet.create({
    viewAll: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
      paddingHorizontal: spacing.md,
      paddingTop: 4,
    },
    row: { paddingHorizontal: spacing.md, paddingTop: 4 },
    replyRow: { paddingLeft: spacing.md + 28 },
    name: { fontWeight: fontWeight.bold, color: colors.textPrimary },
    text: { fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 19 },
    meta: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
    time: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
      marginRight: spacing.md,
    },
    action: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
      fontWeight: fontWeight.bold,
    },
    repliesToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: spacing.md + 28,
      paddingTop: 4,
    },
    toggleText: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
      fontWeight: fontWeight.bold,
      marginRight: spacing.xs,
    },
    more: { paddingVertical: 2 },
    replyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.md,
      marginTop: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: borderRadius.md,
      backgroundColor: colors.background,
    },
    replyBannerText: {
      flex: 1,
      fontSize: fontSize.xs,
      color: colors.textSecondary,
    },
    replyBannerX: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      paddingHorizontal: 4,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xs,
    },
    input: {
      flex: 1,
      maxHeight: 90,
      minHeight: 36,
      backgroundColor: colors.background,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      fontSize: fontSize.sm,
      color: colors.textPrimary,
    },
    counter: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
      marginLeft: spacing.xs,
    },
    sendBtn: { paddingLeft: spacing.md, minWidth: 44, alignItems: 'center' },
    send: {
      color: colors.primary,
      fontWeight: fontWeight.bold,
      fontSize: fontSize.sm,
    },
  }),
);
