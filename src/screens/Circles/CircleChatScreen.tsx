// Realtime circle chat: text, photos, photo polls. Admins who are not members read it read-only.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import Avatar from '../../components/Avatar';
import PollCard from '../../components/PollCard';
import CreatePollModal from '../../components/CreatePollModal';
import ReportModal, { ReportTarget } from '../../components/ReportModal';
import {
  Circle,
  ChatMessage,
  ChatAuthor,
  subscribeCircle,
  subscribeMessages,
  sendTextMessage,
  sendImageMessage,
  sendPollMessage,
  deleteMessage,
  joinPublicCircle,
} from '../../services/circlesApi';
import { pickImage } from '../../utils/imagePicker';
import { clockTime } from '../../utils/date';

export default function CircleChatScreen({ navigation, route }: { navigation: any; route: any }) {
  const circleId: string = route?.params?.circleId || '';
  const { user } = useAuth();
  const uid = user?.id;
  const { isAdmin } = useIsAdmin(uid);

  const [circle, setCircle] = useState<Circle | null>(null);
  const [circleLoading, setCircleLoading] = useState(true);
  const [circleError, setCircleError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [joining, setJoining] = useState(false);

  const isMember = !!uid && !!circle && circle.memberIds.includes(uid);
  const isOwner = !!uid && !!circle && circle.ownerId === uid;
  const canRead = isMember || isAdmin;

  const me: ChatAuthor = useMemo(
    () => ({ uid: uid || '', name: user?.name, avatar: user?.avatarUrl }),
    [uid, user?.name, user?.avatarUrl],
  );

  // Circle doc (name, members) live
  useEffect(() => {
    if (!circleId) {
      setCircleLoading(false);
      setCircleError('Circle not found.');
      return;
    }
    const unsub = subscribeCircle(
      circleId,
      c => {
        setCircle(c);
        setCircleError(c ? null : 'This circle was deleted.');
        setCircleLoading(false);
      },
      (msg, code) => {
        setCircleError(code === 'permission-denied' ? 'This circle is private. Join it with an invite code.' : msg);
        setCircleLoading(false);
      },
    );
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [circleId]);

  // Messages live, once we are allowed to read them
  useEffect(() => {
    if (!circleId || !canRead) return;
    const unsub = subscribeMessages(
      circleId,
      list => {
        setMessages(list);
        setMsgError(null);
      },
      setMsgError,
    );
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [circleId, canRead]);

  const handleSend = async () => {
    const t = text.trim();
    if (!t || !uid || sending) return;
    setSending(true);
    setText('');
    try {
      await sendTextMessage(circleId, me, t);
    } catch (e: any) {
      setText(t);
      Alert.alert('Not sent', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const sendPhoto = async (source: 'camera' | 'library') => {
    try {
      const picked = await pickImage(source);
      if (!picked) return;
      setSending(true);
      await sendImageMessage(circleId, me, picked.dataUri);
    } catch (e: any) {
      Alert.alert('Photo not sent', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const openAttach = () =>
    Alert.alert('Share', undefined, [
      { text: 'Photo poll', onPress: () => setPollOpen(true) },
      { text: 'Take Photo', onPress: () => sendPhoto('camera') },
      { text: 'Choose from Library', onPress: () => sendPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const handleJoin = async () => {
    if (!uid) return;
    setJoining(true);
    try {
      await joinPublicCircle(circleId, uid);
    } catch (e: any) {
      Alert.alert('Could not join', e?.message || 'Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const onMessageLongPress = (m: ChatMessage) => {
    const canDelete = m.userId === uid || isOwner || isAdmin;
    const buttons: any[] = [];
    if (m.userId !== uid) {
      buttons.push({ text: 'Report', onPress: () => setReportTarget({ circleId, messageId: m.id }) });
    }
    if (canDelete) {
      buttons.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete message?', 'This removes it for everyone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteMessage(circleId, m);
                } catch (e: any) {
                  Alert.alert('Delete failed', e?.message || 'Please try again.');
                }
              },
            },
          ]),
      });
    }
    if (!buttons.length) return;
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Message', undefined, buttons);
  };

  const openProfile = (userId: string) => {
    if (userId) navigation.navigate('UserProfile', { userId });
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const mine = item.userId === uid;
    // Inverted list: the next item in the array is the previous message on screen
    const prev = messages[index + 1];
    const showName = !mine && (!prev || prev.userId !== item.userId);
    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
        {!mine && (
          <TouchableOpacity onPress={() => openProfile(item.userId)} style={styles.avatarSlot}>
            {showName ? <Avatar uri={item.userAvatar} name={item.userName} size={30} /> : null}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={() => onMessageLongPress(item)}
          delayLongPress={350}
          onPress={() => (item.type === 'image' && item.imageData ? setViewer(item.imageData) : undefined)}
          style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleOther,
            item.type !== 'text' && styles.bubbleMedia,
          ]}>
          {showName && (
            <Text style={styles.name} onPress={() => openProfile(item.userId)}>
              {item.userName}
            </Text>
          )}
          {item.type === 'image' && item.imageData ? (
            <Image source={{ uri: item.imageData }} style={styles.photo} resizeMode="cover" />
          ) : null}
          {item.type === 'poll' ? (
            <PollCard
              circleId={circleId}
              message={item}
              myUid={uid}
              canVote={isMember}
              onLongPress={() => onMessageLongPress(item)}
              onOpenImage={setViewer}
            />
          ) : null}
          {item.text ? <Text style={[styles.text, mine && styles.textMine]}>{item.text}</Text> : null}
          <Text style={[styles.time, mine && styles.timeMine]}>{clockTime(item.createdAt)}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.back}>‹</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.headerMid}
        disabled={!circle}
        onPress={() => navigation.navigate('CircleInfo', { circleId })}>
        <Text style={styles.headerEmoji}>{circle?.emoji || '◎'}</Text>
        <View style={styles.flex1}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {circle?.name || 'Circle'} {circle?.isPrivate ? '🔒' : ''}
          </Text>
          <Text style={styles.headerSub}>
            {circle ? `${circle.memberIds.length} members · tap for info` : ' '}
          </Text>
        </View>
      </TouchableOpacity>
      {circle ? (
        <TouchableOpacity onPress={() => navigation.navigate('CircleInfo', { circleId })}>
          <Text style={styles.infoIcon}>ⓘ</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  let body: React.ReactNode;
  if (circleLoading) {
    body = <ActivityIndicator style={styles.center} color={colors.primary} />;
  } else if (circleError || !circle) {
    body = (
      <View style={styles.centerBox}>
        <Text style={styles.centerText}>{circleError || 'Circle not found.'}</Text>
      </View>
    );
  } else if (!canRead) {
    body = (
      <View style={styles.centerBox}>
        <Text style={styles.bigEmoji}>{circle.emoji}</Text>
        <Text style={styles.centerTitle}>{circle.name}</Text>
        {circle.description ? <Text style={styles.centerText}>{circle.description}</Text> : null}
        <TouchableOpacity style={styles.joinBtn} onPress={handleJoin} disabled={joining}>
          {joining ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.joinText}>Join circle</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  } else {
    body = (
      <>
        {!isMember && (
          <View style={styles.readOnlyBar}>
            <Text style={styles.readOnlyText}>🛡️ Admin view: read-only. Long-press a message to delete it.</Text>
          </View>
        )}
        {msgError ? <Text style={styles.error}>{msgError}</Text> : null}
        <FlatList
          data={messages}
          inverted
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No messages yet. Say hi, share a look, or start a poll!</Text>
            </View>
          }
        />
        {isMember && (
          <View style={styles.inputBar}>
            <TouchableOpacity style={styles.attachBtn} onPress={openAttach} disabled={sending}>
              <Text style={styles.attachText}>＋</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Message"
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || sending) && styles.disabled]}
              onPress={handleSend}
              disabled={!text.trim() || sending}>
              {sending ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={styles.sendText}>➤</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar
        barStyle="dark-content"
        {...(Platform.OS === 'android' ? { backgroundColor: colors.surface } : {})}
      />
      {header}
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        {body}
      </KeyboardAvoidingView>

      <CreatePollModal
        visible={pollOpen}
        onClose={() => setPollOpen(false)}
        onSubmit={(kind, options) => sendPollMessage(circleId, me, kind, options)}
      />
      <ReportModal target={reportTarget} reporterId={uid} onClose={() => setReportTarget(null)} />

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <TouchableOpacity style={styles.viewer} activeOpacity={1} onPress={() => setViewer(null)}>
          {viewer ? <Image source={{ uri: viewer }} style={styles.viewerImage} resizeMode="contain" /> : null}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
  headerMid: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerEmoji: { fontSize: 28, marginRight: spacing.sm },
  headerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  headerSub: { fontSize: fontSize.xs, color: colors.textSecondary },
  infoIcon: { fontSize: 22, color: colors.primary, paddingHorizontal: spacing.sm },
  center: { marginTop: spacing.xxxl },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  centerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  centerText: { fontSize: fontSize.base, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  bigEmoji: { fontSize: 56, marginBottom: spacing.sm },
  joinBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xxl,
    height: 46,
    justifyContent: 'center',
  },
  joinText: { color: colors.textInverse, fontWeight: fontWeight.bold, fontSize: fontSize.base },
  readOnlyBar: { backgroundColor: '#FFF7E6', padding: spacing.sm },
  readOnlyText: { fontSize: fontSize.xs, color: '#92400E', textAlign: 'center' },
  error: { color: colors.error, fontSize: fontSize.sm, padding: spacing.sm, textAlign: 'center' },
  listContent: { padding: spacing.md, flexGrow: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, transform: [{ scaleY: -1 }] },
  emptyText: { color: colors.textSecondary, textAlign: 'center', fontSize: fontSize.sm },
  row: { flexDirection: 'row', marginVertical: 3, alignItems: 'flex-end' },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatarSlot: { width: 34, marginRight: 4 },
  bubble: { maxWidth: '78%', borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  bubbleMedia: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  name: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.accent, marginBottom: 2 },
  photo: { width: 220, height: 260, borderRadius: borderRadius.md, backgroundColor: colors.divider },
  text: { fontSize: fontSize.base, color: colors.textPrimary, lineHeight: 21 },
  textMine: { color: colors.textInverse },
  time: { fontSize: 10, color: colors.textMuted, alignSelf: 'flex-end', marginTop: 2 },
  timeMine: { color: colors.accentLight },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  attachBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachText: { fontSize: 24, color: colors.primary },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: 21,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.base,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: colors.textInverse, fontSize: 18 },
  disabled: { opacity: 0.5 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
});
