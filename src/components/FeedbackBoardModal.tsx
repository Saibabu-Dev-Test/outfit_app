// Feedback & Suggestions as a board (full-screen modal, so no new navigation route):
//   Board = everyone's public feedback, Mine = my own (public or private), All = every user's
//   feedback including private ones (admins only: users.role 'admin' or listed in config/admins).
// Each item: like (one per user), replies (paged 10), quote (a new feedback that shows a snippet of
// the original), and for my own items edit / delete. Admins can also change the status and delete.
// Lists page 10 at a time.
// Layout: the header sits below the status bar and the bottom composer above the phone's
// navigation buttons (safe-area insets; the modal is edge-to-edge), and the composer moves up
// with the keyboard. Replies are typed in that bottom composer (tap 💬 Reply on a card).
// Load problems (e.g. rules not deployed yet) show a friendly empty state, never a red error.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  spacing,
  themedStyles,
  statusBarStyle,
} from '../theme';
import { timeAgo } from '../utils/date';
import { containsProfanity } from '../utils/profanity';
import { getAdminUids } from '../services/adminConfig';
import { getMyRole } from '../services/userApi';
import {
  addReply,
  deleteFeedback,
  deleteReply,
  editReply,
  Feedback,
  FEEDBACK_REPLY_MAX,
  FeedbackCursor,
  FeedbackQuote,
  FeedbackReply,
  FeedbackScope,
  FeedbackStatus,
  getFeedbackPage,
  getReplies,
  hasLikedFeedback,
  quoteFrom,
  setFeedbackLike,
  setFeedbackStatus,
} from '../services/feedbackApi';
import FeedbackModal from './FeedbackModal';
import ActionSheet, { SheetAction } from './ActionSheet';
import ZoomableImage from './ZoomableImage';

interface Props {
  visible: boolean;
  uid?: string | null;
  name?: string | null;
  onClose: () => void;
}

const TYPE_ICON: Record<string, string> = {
  Suggestion: '💡',
  Complaint: '😕',
  Bug: '🐞',
  Other: '💬',
};

interface Me {
  uid: string;
  name: string;
  isAdmin: boolean;
}

// ── One reply ──────────────────────────────────────────────────────────────
function ReplyRow({
  feedbackId,
  reply,
  me,
  canModerate,
  onChanged,
  onDeleted,
}: {
  feedbackId: string;
  reply: FeedbackReply;
  me: Me;
  canModerate: boolean; // feedback author or admin
  onChanged: (r: FeedbackReply) => void;
  onDeleted: (r: FeedbackReply) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reply.text);
  const [busy, setBusy] = useState(false);
  const mine = reply.uid === me.uid;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const text = await editReply(feedbackId, reply.id, draft);
      onChanged({ ...reply, text, editedAt: new Date() });
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Not saved', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete reply?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReply(feedbackId, reply.id);
            onDeleted(reply);
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Please try again.');
          }
        },
      },
    ]);

  return (
    <View style={styles.reply}>
      <Text style={styles.replyName}>
        {reply.name || 'Outfit user'}
        <Text style={styles.replyTime}>
          {'  '}
          {timeAgo(reply.createdAt)}
          {reply.editedAt ? ' · edited' : ''}
        </Text>
      </Text>
      {editing ? (
        <View>
          <TextInput
            style={styles.replyInput}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={FEEDBACK_REPLY_MAX}
            editable={!busy}
          />
          <View style={styles.inlineRow}>
            <TouchableOpacity onPress={() => setEditing(false)} disabled={busy}>
              <Text style={styles.link}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} disabled={busy || !draft.trim()}>
              <Text style={[styles.link, styles.linkStrong]}>
                {busy ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.replyText} selectable>
          {reply.text}
        </Text>
      )}
      {!editing && (mine || canModerate) ? (
        <View style={styles.inlineRow}>
          {mine ? (
            <TouchableOpacity
              onPress={() => {
                setDraft(reply.text);
                setEditing(true);
              }}
            >
              <Text style={styles.link}>Edit</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={remove}>
            <Text style={[styles.link, styles.linkDanger]}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

// ── One feedback card ──────────────────────────────────────────────────────
function FeedbackCard({
  item,
  me,
  onQuote,
  onEdit,
  onDeleted,
  onUpdated,
  onOpenImage,
  onReply,
  incoming,
}: {
  item: Feedback;
  me: Me;
  onReply: (f: Feedback) => void;
  // A reply just sent from the bottom composer for this card (n changes on every send)
  incoming: { reply: FeedbackReply; n: number } | null;
  onQuote: (f: Feedback) => void;
  onEdit: (f: Feedback) => void;
  onDeleted: (f: Feedback) => void;
  onUpdated: (f: Feedback) => void;
  onOpenImage: (uri: string) => void;
}) {
  const mine = item.uid === me.uid;
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<FeedbackReply[]>([]);
  const [replyCursor, setReplyCursor] = useState<FeedbackCursor>(null);
  const [moreReplies, setMoreReplies] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    hasLikedFeedback(item.id, me.uid).then(v => alive && setLiked(v));
    return () => {
      alive = false;
    };
  }, [item.id, me.uid]);

  const toggleLike = async () => {
    if (liking || !me.uid) return;
    const next = !liked;
    setLiking(true);
    setLiked(next);
    onUpdated({
      ...item,
      likeCount: Math.max(0, item.likeCount + (next ? 1 : -1)),
    });
    try {
      await setFeedbackLike(item.id, me.uid, next);
    } catch (e: any) {
      setLiked(!next);
      onUpdated(item);
      Alert.alert('Like failed', e?.message || 'Please try again.');
    } finally {
      setLiking(false);
    }
  };

  const loadReplies = async (more: boolean) => {
    if (loadingReplies) return;
    setLoadingReplies(true);
    try {
      const page = await getReplies(item.id, more ? replyCursor : null);
      setReplies(prev => (more ? [...prev, ...page.items] : page.items));
      setReplyCursor(page.cursor);
      setMoreReplies(page.hasMore);
    } catch (e: any) {
      Alert.alert('Could not load replies', e?.message || 'Please try again.');
    } finally {
      setLoadingReplies(false);
    }
  };

  const toggleReplies = () => {
    const next = !open;
    setOpen(next);
    if (next && !replies.length && item.replyCount > 0) loadReplies(false);
  };

  // Reply sent from the bottom composer: show it here (at the end only when every older reply
  // is already loaded) and open the replies
  const seenIncoming = useRef(0);
  useEffect(() => {
    if (!incoming || incoming.n === seenIncoming.current) return;
    seenIncoming.current = incoming.n;
    setOpen(true);
    if (!moreReplies) setReplies(prev => (prev.some(x => x.id === incoming.reply.id) ? prev : [...prev, incoming.reply]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  const remove = () =>
    Alert.alert('Delete feedback?', 'Its likes and replies are removed too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFeedback(item.id);
            onDeleted(item);
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Please try again.');
          }
        },
      },
    ]);

  const setStatus = async (st: FeedbackStatus) => {
    try {
      await setFeedbackStatus(item.id, st);
      onUpdated({ ...item, status: st });
    } catch (e: any) {
      Alert.alert('Not updated', e?.message || 'Please try again.');
    }
  };

  const menuActions: SheetAction[] = [];
  if (mine)
    menuActions.push({
      icon: '✏️',
      label: 'Edit',
      onPress: () => onEdit(item),
    });
  if (me.isAdmin) {
    (['new', 'read', 'done'] as FeedbackStatus[])
      .filter(st => st !== item.status)
      .forEach(st =>
        menuActions.push({
          icon: st === 'done' ? '✅' : '🏷️',
          label: `Mark ${st}`,
          onPress: () => setStatus(st),
        }),
      );
  }
  if (mine || me.isAdmin) {
    menuActions.push({
      icon: '🗑️',
      label: mine ? 'Delete' : 'Delete (admin)',
      onPress: remove,
    });
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName} numberOfLines={1}>
          {TYPE_ICON[item.type] || '💬'} {item.name || 'Outfit user'}
          {mine ? ' (you)' : ''}
        </Text>
        <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        {menuActions.length ? (
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.more}>⋯</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.badges}>
        <Text style={styles.badge}>{item.type}</Text>
        {!item.isPublic ? (
          <Text style={styles.badge}>🔒 Only admins</Text>
        ) : null}
        {mine || me.isAdmin ? (
          <Text style={[styles.badge, styles.badgeStatus]}>{item.status}</Text>
        ) : null}
        {item.editedAt ? <Text style={styles.edited}>edited</Text> : null}
      </View>

      {item.quoteOf ? (
        <View style={styles.quote}>
          <Text style={styles.quoteName}>
            ❝ {item.quoteOf.name || 'Outfit user'}
          </Text>
          <Text style={styles.quoteText} numberOfLines={4}>
            {item.quoteOf.text}
          </Text>
        </View>
      ) : null}

      <Text style={styles.text} selectable>
        {item.text}
      </Text>
      {item.image ? (
        <TouchableOpacity
          onPress={() => onOpenImage(item.image as string)}
          activeOpacity={0.85}
        >
          <Image
            source={{ uri: item.image }}
            style={styles.shot}
            resizeMode="cover"
          />
        </TouchableOpacity>
      ) : null}
      {me.isAdmin ? (
        <Text style={styles.meta}>
          {item.uid.slice(0, 8)}… · {item.platform || '?'} · v
          {item.appVersion || '?'}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.action}
          onPress={toggleLike}
          disabled={liking}
        >
          <Text style={[styles.actionText, liked && styles.liked]}>
            {liked ? '♥' : '♡'} {item.likeCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={toggleReplies}>
          <Text style={styles.actionText}>
            💬 {item.replyCount} {open ? '▴' : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => onReply(item)}>
          <Text style={styles.actionText}>↩ Reply</Text>
        </TouchableOpacity>
        {item.isPublic ? (
          <TouchableOpacity style={styles.action} onPress={() => onQuote(item)}>
            <Text style={styles.actionText}>❝ Quote</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {open ? (
        <View style={styles.replies}>
          {replies.map(r => (
            <ReplyRow
              key={r.id}
              feedbackId={item.id}
              reply={r}
              me={me}
              canModerate={mine || me.isAdmin}
              onChanged={nr =>
                setReplies(prev => prev.map(x => (x.id === nr.id ? nr : x)))
              }
              onDeleted={dr => {
                setReplies(prev => prev.filter(x => x.id !== dr.id));
                onUpdated({
                  ...item,
                  replyCount: Math.max(0, item.replyCount - 1),
                });
              }}
            />
          ))}
          {loadingReplies ? (
            <ActivityIndicator
              color={colors.primary}
              style={styles.smallSpin}
            />
          ) : null}
          {moreReplies && !loadingReplies ? (
            <TouchableOpacity onPress={() => loadReplies(true)}>
              <Text style={[styles.link, styles.linkStrong]}>
                Show more replies
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => onReply(item)} style={styles.replyCta}>
            <Text style={[styles.link, styles.linkStrong]}>💬 Write a reply</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ActionSheet
        visible={menuOpen}
        title="Feedback"
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
      />
    </View>
  );
}

// ── Board ──────────────────────────────────────────────────────────────────
export default function FeedbackBoardModal({
  visible,
  uid,
  name,
  onClose,
}: Props) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [scope, setScope] = useState<FeedbackScope>('board');
  const [items, setItems] = useState<Feedback[]>([]);
  const [cursor, setCursor] = useState<FeedbackCursor>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState<{
    quote?: FeedbackQuote | null;
    editing?: Feedback | null;
  } | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  // Bottom composer: replying to this feedback (null = "share an idea" button)
  const [replyTo, setReplyTo] = useState<Feedback | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [incoming, setIncoming] = useState<{ feedbackId: string; reply: FeedbackReply; n: number } | null>(null);
  const inputRef = useRef<any>(null);

  const me: Me = {
    uid: uid || '',
    name: (name || '').trim() || 'Outfit user',
    isAdmin,
  };

  // Admin = users.role 'admin' or listed in config/admins
  useEffect(() => {
    if (!visible || !uid) return;
    let alive = true;
    Promise.all([getMyRole(uid).catch(() => null), getAdminUids()]).then(
      ([role, admins]) => {
        if (alive) setIsAdmin(role === 'admin' || admins.includes(uid));
      },
    );
    return () => {
      alive = false;
    };
  }, [visible, uid]);

  const load = useCallback(
    async (more: boolean, which: FeedbackScope) => {
      setLoading(true);
      setError(null);
      try {
        const page = await getFeedbackPage(which, uid, more ? cursor : null);
        setItems(prev => {
          if (!more) return page.items;
          const seen = new Set(prev.map(p => p.id));
          return [...prev, ...page.items.filter(p => !seen.has(p.id))];
        });
        setCursor(page.cursor);
        setHasMore(page.hasMore);
      } catch (e: any) {
        setError(e?.message || 'Could not load feedback.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [uid, cursor],
  );

  useEffect(() => {
    if (!visible) return;
    setItems([]);
    setCursor(null);
    setHasMore(false);
    load(false, scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, scope, uid]);

  const refresh = () => {
    setRefreshing(true);
    load(false, scope);
  };

  const loadMore = () => {
    if (hasMore && !loading) load(true, scope);
  };

  const tabs: { key: FeedbackScope; label: string }[] = [
    { key: 'board', label: 'Board' },
    { key: 'mine', label: 'Mine' },
    ...(isAdmin ? [{ key: 'all' as FeedbackScope, label: 'All (admin)' }] : []),
  ];

  const update = (f: Feedback) =>
    setItems(prev => prev.map(x => (x.id === f.id ? f : x)));

  const startReply = (f: Feedback) => {
    setReplyTo(f);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const sendReply = async () => {
    const t = draft.trim();
    const target = replyTo;
    if (!t || sending || !uid || !target) return;
    if (containsProfanity(t)) {
      Alert.alert('Not sent', 'Please keep your reply respectful 🙏');
      return;
    }
    setSending(true);
    try {
      const r = await addReply(target.id, { uid: me.uid, name: me.name }, t);
      setDraft('');
      setIncoming(prev => ({ feedbackId: target.id, reply: r, n: (prev?.n || 0) + 1 }));
      setItems(prev =>
        prev.map(x => (x.id === target.id ? { ...x, replyCount: x.replyCount + 1 } : x)),
      );
      setReplyTo(null);
    } catch (e: any) {
      Alert.alert('Reply not sent', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SafeAreaProvider>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android'
          ? { backgroundColor: 'transparent', translucent: true }
          : {})}
      />
      {/* Edge-to-edge window: adjustResize does not shrink it, so pad for the keyboard on both platforms */}
      <KeyboardAvoidingView style={styles.root} behavior="padding">
      <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Feedback & Suggestions</Text>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => setComposer({})}
            disabled={!uid}
          >
            <Text style={styles.newText}>＋ New</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.tabs}>
          {tabs.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, scope === t.key && styles.tabOn]}
              onPress={() => setScope(t.key)}
            >
              <Text
                style={[styles.tabText, scope === t.key && styles.tabTextOn]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <FlatList
          data={items}
          keyExtractor={f => f.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          renderItem={({ item }) => (
            <FeedbackCard
              item={item}
              me={me}
              onQuote={f => setComposer({ quote: quoteFrom(f) })}
              onEdit={f => setComposer({ editing: f })}
              onDeleted={f => setItems(prev => prev.filter(x => x.id !== f.id))}
              onUpdated={update}
              onOpenImage={setShot}
              onReply={startReply}
              incoming={incoming && incoming.feedbackId === item.id ? incoming : null}
            />
          )}
          ListEmptyComponent={
            loading ? undefined : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>💡</Text>
                <Text style={styles.emptyTitle}>
                  {scope === 'mine' ? "You haven't shared anything yet" : 'No feedback here yet'}
                </Text>
                <Text style={styles.empty}>
                  {scope === 'mine'
                    ? 'Tell us what you like, what is broken, or what we should add. Tap ＋ New.'
                    : 'Be the first to share an idea! Tap ＋ New to post a suggestion.'}
                </Text>
                {error ? (
                  <TouchableOpacity onPress={refresh} style={styles.moreBtn}>
                    <Text style={[styles.link, styles.linkStrong]}>↻ Refresh</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )
          }
          ListFooterComponent={
            loading ? (
              <ActivityIndicator color={colors.primary} style={styles.spin} />
            ) : hasMore && !error ? (
              <TouchableOpacity onPress={loadMore} style={styles.moreBtn}>
                <Text style={[styles.link, styles.linkStrong]}>Load more</Text>
              </TouchableOpacity>
            ) : undefined
          }
        />

        {/* Bottom composer: above the navigation buttons, moves up with the keyboard */}
        {replyTo ? (
          <View style={styles.composer}>
            <View style={styles.composerHead}>
              <Text style={styles.composerTo} numberOfLines={1}>
                ↩ Replying to {replyTo.name || 'Outfit user'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setReplyTo(null);
                  setDraft('');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.composerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.replyBar}>
              <TextInput
                ref={inputRef}
                style={styles.replyBox}
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a reply…"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={FEEDBACK_REPLY_MAX}
                editable={!sending}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.replySend, (!draft.trim() || sending) && styles.disabled]}
                onPress={sendReply}
                disabled={!draft.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.replySendText}>➤</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.composer}
            activeOpacity={0.8}
            onPress={() => setComposer({})}
            disabled={!uid}
          >
            <View style={[styles.replyBox, styles.fakeInput]}>
              <Text style={styles.fakeInputText}>💡 Share an idea or suggestion…</Text>
            </View>
          </TouchableOpacity>
        )}
      </SafeAreaView>
      </KeyboardAvoidingView>
      </SafeAreaProvider>

      <FeedbackModal
        visible={!!composer}
        uid={uid}
        name={name}
        quote={composer?.quote || null}
        editing={composer?.editing || null}
        onClose={() => setComposer(null)}
        onDone={() => load(false, scope)}
      />
      <ZoomableImage
        visible={!!shot}
        images={shot ? [shot] : []}
        onClose={() => setShot(null)}
      />
    </Modal>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    back: {
      fontSize: 34,
      color: colors.primary,
      marginRight: spacing.sm,
      lineHeight: 36,
    },
    title: {
      flex: 1,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.extraBold,
      color: colors.textPrimary,
    },
    newBtn: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      minHeight: 36,
      justifyContent: 'center',
    },
    newText: {
      color: colors.onPrimary,
      fontWeight: fontWeight.bold,
      fontSize: fontSize.sm,
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      gap: spacing.sm,
    },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semiBold,
      color: colors.textPrimary,
    },
    tabTextOn: { color: colors.onPrimary },
    error: {
      color: colors.error,
      fontSize: fontSize.sm,
      padding: spacing.sm,
      textAlign: 'center',
    },
    list: { padding: spacing.md, paddingBottom: spacing.xxl },
    empty: {
      textAlign: 'center',
      color: colors.textMuted,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      fontSize: fontSize.sm,
      lineHeight: 20,
    },
    spin: { marginVertical: spacing.lg },
    smallSpin: { marginVertical: spacing.sm },
    moreBtn: { alignItems: 'center', paddingVertical: spacing.md },
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center' },
    cardName: {
      flex: 1,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      color: colors.textPrimary,
    },
    time: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
      marginLeft: spacing.sm,
    },
    more: {
      fontSize: 20,
      color: colors.textMuted,
      marginLeft: spacing.sm,
      lineHeight: 22,
    },
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      marginTop: 4,
    },
    badge: {
      fontSize: 10,
      fontWeight: fontWeight.bold,
      color: colors.textSecondary,
      backgroundColor: colors.divider,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 1,
      marginRight: 6,
      overflow: 'hidden',
    },
    badgeStatus: { color: colors.accent },
    edited: { fontSize: 10, color: colors.textMuted },
    quote: {
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    quoteName: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      color: colors.accent,
    },
    quoteText: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    text: {
      fontSize: fontSize.base,
      color: colors.textPrimary,
      marginTop: spacing.sm,
      lineHeight: 21,
    },
    shot: {
      width: 96,
      height: 150,
      borderRadius: 8,
      marginTop: spacing.sm,
      backgroundColor: colors.divider,
    },
    meta: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    actions: {
      flexDirection: 'row',
      marginTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      paddingTop: spacing.sm,
    },
    action: { marginRight: spacing.lg, paddingVertical: 2 },
    actionText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semiBold,
      color: colors.textSecondary,
    },
    liked: { color: colors.error },
    replies: { marginTop: spacing.sm },
    reply: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      marginBottom: 6,
    },
    replyName: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      color: colors.textPrimary,
    },
    replyTime: {
      fontSize: 10,
      fontWeight: fontWeight.regular,
      color: colors.textMuted,
    },
    replyText: {
      fontSize: fontSize.sm,
      color: colors.textPrimary,
      marginTop: 2,
      lineHeight: 19,
    },
    replyInput: {
      minHeight: 40,
      backgroundColor: colors.inputBg,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      fontSize: fontSize.sm,
      color: colors.textPrimary,
      marginTop: 4,
    },
    inlineRow: { flexDirection: 'row', marginTop: 4, gap: spacing.md },
    link: {
      fontSize: fontSize.xs,
      color: colors.textSecondary,
      fontWeight: fontWeight.semiBold,
    },
    linkStrong: { color: colors.primary, fontWeight: fontWeight.bold },
    linkDanger: { color: colors.error },
    replyCta: { marginTop: spacing.sm },
    composer: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    composerHead: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    composerTo: {
      flex: 1,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      color: colors.textSecondary,
    },
    composerClose: { fontSize: 16, color: colors.textMuted },
    fakeInput: { justifyContent: 'center' },
    fakeInputText: { fontSize: fontSize.base, color: colors.textMuted },
    emptyBox: { alignItems: 'center', paddingTop: spacing.xxl },
    emptyEmoji: { fontSize: 44 },
    emptyTitle: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      color: colors.textPrimary,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    replyBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    replyBox: {
      flex: 1,
      minHeight: 48,
      maxHeight: 140,
      backgroundColor: colors.inputBg,
      borderRadius: 22,
      paddingHorizontal: spacing.base,
      paddingTop: 12,
      paddingBottom: 12,
      fontSize: fontSize.base,
      lineHeight: 21,
      color: colors.textPrimary,
    },
    replySend: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    replySendText: { color: colors.onPrimary, fontSize: 18 },
    disabled: { opacity: 0.5 },
  }),
);
