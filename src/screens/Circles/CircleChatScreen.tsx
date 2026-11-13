// Realtime circle chat: text, photos, photo polls. Admins who are not members read it read-only.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import KeyboardSafeView from '../../components/KeyboardSafeView';
import { maybeShowInterstitial } from '../../ads/adsService';

// A poll was posted (natural break): at most one interstitial per 5 minutes, after the sheet has
// closed and the keyboard is down (never while typing). Never throws.
const afterPollPosted = () => {
  setTimeout(() => {
    maybeShowInterstitial().catch(() => {});
  }, 900);
};
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import Avatar from '../../components/Avatar';
import PollCard from '../../components/PollCard';
import CreatePollModal from '../../components/CreatePollModal';
import ActionSheet from '../../components/ActionSheet';
import WardrobePickerModal from '../../components/WardrobePickerModal';
import ReactionBar from '../../components/ReactionBar';
import ReportModal, { ReportTarget } from '../../components/ReportModal';
import ZoomableImage from '../../components/ZoomableImage';
import CameraPollModal, { CAMERA_POLL_MAX } from '../../components/CameraPollModal';
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
  joinCircle,
} from '../../services/circlesApi';
import { resolveMyPlace } from '../../services/districtApi';
import { MAX_BASE64_CHARS, pickImages } from '../../utils/imagePicker';
import { clockTime } from '../../utils/date';
import NameWithAge from '../../components/NameWithAge';
import TranslatedText from '../../components/TranslatedText';

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
  const [pollImages, setPollImages] = useState<string[] | undefined>(undefined);
  const [viewer, setViewer] = useState<{ images: string[]; index: number; labels?: string[] } | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [joining, setJoining] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

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

  // Several photos together: 1 = normal photo, 2-6 = A-F vote post
  const sendSeveral = async () => {
    try {
      const r = await pickImages(6);
      if (r.skipped) Alert.alert('Some photos skipped', `${r.skipped} photo(s) were too large.`);
      if (!r.images.length) return;
      if (r.images.length === 1) {
        setSending(true);
        await sendImageMessage(circleId, me, r.images[0].dataUri);
        return;
      }
      setPollImages(r.images.map(i => i.dataUri));
      setPollOpen(true);
    } catch (e: any) {
      Alert.alert('Photos not sent', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const openComments = (m: ChatMessage) =>
    navigation.navigate('Comments', { target: { kind: 'circle', circleId, id: m.id } });

  // Wardrobe photos: 1 = normal photo, 2-6 = A-F vote (poll editor opens with them)
  const sendFromWardrobe = async (images: string[]) => {
    if (images.length === 1) {
      setSending(true);
      try {
        await sendImageMessage(circleId, me, images[0]);
      } catch (e: any) {
        Alert.alert('Photo not sent', e?.message || 'Please try again.');
      } finally {
        setSending(false);
      }
      return;
    }
    setPollImages(images);
    setPollOpen(true);
  };

  // Attach: From Wardrobe / Take photo / Several photos (A-F vote) / Cancel.
  // (Android's Alert shows only 3 buttons, so this is an ActionSheet.)
  const openAttach = () => setAttachOpen(true);

  const handleJoin = async () => {
    if (!uid || !circle) return;
    setJoining(true);
    try {
      // Public: my district or within 3 km (see joinCircle); private circles need the code
      const place = await resolveMyPlace(uid);
      await joinCircle(circle, uid, { districtKey: place.district?.districtKey, coords: place.coords });
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
          onPress={() =>
            item.type === 'image' && item.imageData ? setViewer({ images: [item.imageData], index: 0 }) : undefined
          }
          style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleOther,
            item.type !== 'text' && styles.bubbleMedia,
          ]}>
          {showName && (
            <NameWithAge style={styles.name} onPress={() => openProfile(item.userId)} uid={item.userId} name={item.userName} age={(item as any).userAge} />
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
              onOpenImages={(images, at, labels) => setViewer({ images, index: at, labels })}
            />
          ) : null}
          {item.text ? <TranslatedText style={[styles.text, mine && styles.textMine]} authorId={item.userId} text={item.text} /> : null}
          {item.type !== 'text' ? (
            <ReactionBar
              circleId={circleId}
              messageId={item.id}
              myUid={uid}
              canReact={isMember}
              onOpenComments={() => openComments(item)}
            />
          ) : null}
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
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.surface } : {})}
      />
      {header}
      <KeyboardSafeView style={styles.flex1}>{body}</KeyboardSafeView>

      <CreatePollModal
        visible={pollOpen}
        onClose={() => {
          setPollOpen(false);
          setPollImages(undefined);
        }}
        initialImages={pollImages}
        userId={uid}
        onSubmit={async (kind, options) => {
          await sendPollMessage(circleId, me, kind, options);
          afterPollPosted();
        }}
      />
      <ActionSheet
        visible={attachOpen}
        title="Share photos"
        onClose={() => setAttachOpen(false)}
        actions={[
          {
            icon: '👗',
            label: 'From Wardrobe',
            hint: 'One photo, or 2-6 for an A–F vote',
            onPress: () => setWardrobeOpen(true),
          },
          {
            icon: '📷',
            label: 'Take photo',
            hint: `One photo, or up to ${CAMERA_POLL_MAX} in a row for a photo poll`,
            onPress: () => setCameraOpen(true),
          },
          {
            icon: '🖼️',
            label: 'Several photos (A–F vote)',
            hint: 'Pick up to 6 from your gallery, labelled A–F',
            onPress: sendSeveral,
          },
        ]}
      />
      <CameraPollModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onSendPhoto={img => sendImageMessage(circleId, me, img)}
        onSendPoll={async (kind, options) => {
          await sendPollMessage(circleId, me, kind, options);
          afterPollPosted();
        }}
      />
      <WardrobePickerModal
        visible={wardrobeOpen}
        userId={uid}
        max={6}
        maxChars={MAX_BASE64_CHARS}
        onClose={() => setWardrobeOpen(false)}
        onDone={sendFromWardrobe}
      />
      <ReportModal target={reportTarget} reporterId={uid} onClose={() => setReportTarget(null)} />

      <ZoomableImage
        visible={!!viewer}
        images={viewer?.images || []}
        initialIndex={viewer?.index || 0}
        labels={viewer?.labels}
        onClose={() => setViewer(null)}
      />
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
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
}));
