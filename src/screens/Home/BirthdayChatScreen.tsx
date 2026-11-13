// 🎂 Birthday pages, one screen for two modes:
//   mode 'wishes' (uid): wishes for one person's birthday. Tap a wish to reply: the box starts with
//     "@Name " and the tagged person gets a notification (services/birthdayApi.ts sendWish).
//   mode 'circle': today's "Happy birthday to all" circle: chat + photos, only for people whose
//     opted-in birthday is today; it is gone tomorrow (rules only allow that day).
// Message box: same keyboard handling as circle chat (KeyboardSafeView: sits right on the keyboard, above the nav bar).
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
import { SafeAreaView } from 'react-native-safe-area-context';
import KeyboardSafeView from '../../components/KeyboardSafeView';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import { useDayKey } from '../../hooks/useDayKey';
import Avatar from '../../components/Avatar';
import ZoomableImage from '../../components/ZoomableImage';
import { clockTime } from '../../utils/date';
import { CHAT_PICK, pickImages } from '../../utils/imagePicker';
import { reviewPhotos } from '../../components/PhotoReviewHost';
import NameWithAge from '../../components/NameWithAge';
import TranslatedText from '../../components/TranslatedText';
import {
  BdayMessage,
  birthdayDateFor,
  daysUntil,
  deleteBdayMessage,
  getBdayFullPhoto,
  deleteWish,
  getBirthday,
  getMyBirthday,
  isMyBirthdayToday,
  mdLabel,
  mentionParts,
  mentionPrefix,
  sendBdayPhoto,
  sendBdayText,
  sendWish,
  subscribeBdayCircle,
  subscribeWishes,
  Wish,
  WISH_MAX,
  BDAY_MSG_MAX,
} from '../../services/birthdayApi';

type Row = {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  text: string;
  imageData?: string | null;
  hasFull?: boolean;
  createdAt: Date | null;
  wish?: Wish;
};

export default function BirthdayChatScreen({ navigation, route }: { navigation: any; route: any }) {
  const mode: 'wishes' | 'circle' = route?.params?.mode === 'circle' ? 'circle' : 'wishes';
  const { user } = useAuth();
  const uid = user?.id ? String(user.id) : '';
  const { isAdmin } = useIsAdmin(uid);
  const todayKey = useDayKey();
  const me = useMemo(() => ({ uid, name: user?.name, avatar: user?.avatarUrl }), [uid, user?.name, user?.avatarUrl]);

  // Wishes: whose birthday, and which date
  const personUid: string = mode === 'wishes' ? String(route?.params?.uid || uid) : '';
  const [person, setPerson] = useState<{ name: string; avatar: string | null; md: string } | null>(null);
  const [personLoading, setPersonLoading] = useState(mode === 'wishes');
  // Circle: allowed only on my own (opted-in) birthday
  const [circleOk, setCircleOk] = useState<boolean | null>(mode === 'circle' ? null : true);

  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ uid: string; name: string } | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'wishes' || !personUid) return;
    let alive = true;
    setPersonLoading(true);
    getBirthday(personUid).then(p => {
      if (!alive) return;
      setPerson(p);
      setPersonLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [mode, personUid]);

  useEffect(() => {
    if (mode !== 'circle' || !uid) return;
    let alive = true;
    getMyBirthday(uid).then(my => alive && setCircleOk(isMyBirthdayToday(my)));
    return () => {
      alive = false;
    };
  }, [mode, uid, todayKey]);

  const wishDay = person?.md ? birthdayDateFor(person.md) : '';
  const daysToGo = wishDay ? daysUntil(wishDay) : 0;

  // Live list (newest first for the inverted list)
  useEffect(() => {
    let unsub: (() => void) | null = null;
    if (mode === 'wishes' && personUid && wishDay) {
      unsub = subscribeWishes(
        personUid,
        wishDay,
        list => {
          setRows(
            list
              .map(w => ({ id: w.id, userId: w.userId, userName: w.userName, userAvatar: w.userAvatar, text: w.text, createdAt: w.createdAt, wish: w }))
              .reverse(),
          );
          setError(null);
        },
        setError,
      );
    } else if (mode === 'circle' && circleOk) {
      unsub = subscribeBdayCircle(
        todayKey,
        list => {
          setRows(list.map((m: BdayMessage) => ({ ...m })));
          setError(null);
        },
        setError,
      );
    }
    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, [mode, personUid, wishDay, circleOk, todayKey]);

  const isMyOwnPage = mode === 'wishes' && personUid === uid;
  const canWrite = mode === 'circle' ? !!circleOk : !!person && daysToGo >= 0 && daysToGo <= 7;

  const send = async () => {
    const t = text.trim();
    if (!t || sending || !uid) return;
    setSending(true);
    try {
      if (mode === 'circle') await sendBdayText(todayKey, me, t);
      else {
        // Keep the tag only while the text still starts with it
        const tag = replyTo && t.startsWith(mentionPrefix(replyTo.name).trim()) ? replyTo : null;
        await sendWish(personUid, wishDay, me, t, tag);
      }
      setText('');
      setReplyTo(null);
    } catch (e: any) {
      Alert.alert('Not sent', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const sendPhoto = async () => {
    if (sending) return;
    try {
      // Near-original photo (opened on tap) + small chat copy
      const r = await pickImages(1, CHAT_PICK);
      // Photo options (Blur face / Adjust) before sending; closing them sends nothing
      const picked = (await reviewPhotos(r.images, CHAT_PICK))[0];
      if (!picked?.dataUri) return;
      setSending(true);
      await sendBdayPhoto(todayKey, me, picked.clearUri || picked.dataUri, picked.clearUri ? picked.dataUri : null);
    } catch (e: any) {
      Alert.alert('Photo not sent', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Chat copy at once, then the near-original photo when there is one
  const openPhoto = (r: Row) => {
    if (!r.imageData) return;
    const shown = r.imageData;
    setViewer(shown);
    if (mode !== 'circle' || !r.hasFull) return;
    getBdayFullPhoto(todayKey, r).then(full => {
      if (full && full !== shown) setViewer(v => (v === shown ? full : v));
    });
  };

  const startReply = (r: Row) => {
    if (mode !== 'wishes' || !canWrite) return;
    if (r.userId === uid) return;
    setReplyTo({ uid: r.userId, name: r.userName });
    setText(prev => {
      const p = mentionPrefix(r.userName);
      return prev.startsWith('@') ? p : p + prev;
    });
  };

  const onLongPress = (r: Row) => {
    const canDelete = r.userId === uid || isAdmin || isMyOwnPage;
    if (!canDelete) return;
    Alert.alert('Delete?', 'This removes it for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (mode === 'circle') await deleteBdayMessage(todayKey, r.id, r.hasFull);
            else await deleteWish(personUid, r.id);
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  // Others' wishes show in the reader's language (TranslatedText, offline); @mentions stay highlighted
  const renderText = (t: string, mine: boolean, authorId?: string | null) => (
    <TranslatedText
      style={[styles.text, mine && styles.textMine]}
      authorId={authorId}
      text={t}
      renderBody={body =>
        mentionParts(body).map((p, i) =>
          p.mention ? (
            <Text key={i} style={[styles.mention, mine && styles.textMine]}>
              {p.text}
            </Text>
          ) : (
            p.text
          ),
        )
      }
    />
  );

  const renderRow = ({ item, index }: { item: Row; index: number }) => {
    const mine = item.userId === uid;
    const prev = rows[index + 1];
    const showName = !mine && (!prev || prev.userId !== item.userId);
    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
        {!mine && (
          <TouchableOpacity
            onPress={() => item.userId && navigation.navigate('UserProfile', { userId: item.userId })}
            style={styles.avatarSlot}>
            {showName ? <Avatar uri={item.userAvatar} name={item.userName} size={30} /> : null}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          activeOpacity={0.9}
          delayLongPress={350}
          onLongPress={() => onLongPress(item)}
          onPress={() => (item.imageData ? openPhoto(item) : startReply(item))}
          style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
          {showName ? <NameWithAge style={styles.name} uid={item.userId} name={item.userName} age={(item as any).userAge} /> : null}
          {item.imageData ? <Image source={{ uri: item.imageData }} style={styles.photo} resizeMode="cover" /> : null}
          {item.text ? renderText(item.text, mine, item.userId) : null}
          <View style={styles.metaRow}>
            {mode === 'wishes' && !mine && canWrite ? <Text style={styles.replyHint}>Reply</Text> : null}
            <Text style={[styles.time, mine && styles.timeMine]}>{clockTime(item.createdAt)}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Header
  let title = '🎉 Happy birthday to all';
  let sub = "Today's birthdays only · gone tomorrow";
  if (mode === 'wishes') {
    const name = isMyOwnPage ? 'Your' : person ? `${person.name}'s` : '';
    title = `🎂 ${name} birthday wishes`.replace('  ', ' ');
    sub = person?.md
      ? daysToGo <= 0
        ? `Today · ${mdLabel(person.md)}`
        : `${mdLabel(person.md)} · in ${daysToGo} day${daysToGo === 1 ? '' : 's'}`
      : ' ';
  }
  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.back}>‹</Text>
      </TouchableOpacity>
      {mode === 'wishes' && person ? <Avatar uri={person.avatar} name={person.name} size={34} style={styles.headerAvatar} /> : null}
      <View style={styles.flex1}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.headerSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </View>
  );

  let body: React.ReactNode;
  if (personLoading || circleOk === null) {
    body = <ActivityIndicator style={styles.center} color={colors.primary} />;
  } else if (mode === 'wishes' && !person) {
    body = (
      <View style={styles.centerBox}>
        <Text style={styles.centerText}>This birthday is not shown any more.</Text>
      </View>
    );
  } else if (mode === 'circle' && !circleOk) {
    body = (
      <View style={styles.centerBox}>
        <Text style={styles.bigEmoji}>🎉</Text>
        <Text style={styles.centerText}>
          This circle is only for people whose birthday is today and who turned on "Show my birthday" in Settings.
        </Text>
      </View>
    );
  } else {
    const empty =
      mode === 'circle'
        ? 'Happy birthday! 🎂 Everyone here shares your birthday today. Say hi or share a photo.'
        : isMyOwnPage
        ? 'Wishes from friends show up here.'
        : 'Be the first to wish! 🎉';
    body = (
      <>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={rows}
          inverted
          keyExtractor={r => r.id}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{empty}</Text>
            </View>
          }
        />
        {canWrite ? (
          <View>
            {replyTo ? (
              <View style={styles.replyBar}>
                <Text style={styles.replyText} numberOfLines={1}>
                  Replying to {replyTo.name}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setText(t => (t.startsWith(mentionPrefix(replyTo.name)) ? t.slice(mentionPrefix(replyTo.name).length) : t));
                    setReplyTo(null);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.replyClose}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.inputBar}>
              {mode === 'circle' ? (
                <TouchableOpacity style={styles.attachBtn} onPress={sendPhoto} disabled={sending}>
                  <Text style={styles.attachText}>📷</Text>
                </TouchableOpacity>
              ) : null}
              <TextInput
                style={styles.input}
                placeholder={mode === 'circle' ? 'Message' : isMyOwnPage ? 'Say thanks 🙏' : 'Write a birthday wish 🎂'}
                placeholderTextColor={colors.textMuted}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={mode === 'circle' ? BDAY_MSG_MAX : WISH_MAX}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!text.trim() || sending) && styles.disabled]}
                onPress={send}
                disabled={!text.trim() || sending}>
                {sending ? <ActivityIndicator size="small" color={colors.textInverse} /> : <Text style={styles.sendText}>➤</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : mode === 'wishes' ? (
          <Text style={styles.closedNote}>Wishes open 7 days before the birthday.</Text>
        ) : null}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle={statusBarStyle()} {...(Platform.OS === 'android' ? { backgroundColor: colors.surface } : {})} />
      {header}
      <KeyboardSafeView style={styles.flex1}>{body}</KeyboardSafeView>
      <ZoomableImage visible={!!viewer} images={viewer ? [viewer] : []} onClose={() => setViewer(null)} />
    </SafeAreaView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
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
    headerAvatar: { marginRight: spacing.sm },
    headerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
    headerSub: { fontSize: fontSize.xs, color: colors.textSecondary },
    center: { marginTop: spacing.xxxl },
    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
    centerText: { fontSize: fontSize.base, color: colors.textSecondary, textAlign: 'center' },
    bigEmoji: { fontSize: 56, marginBottom: spacing.sm },
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
    name: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.accent, marginBottom: 2 },
    photo: { width: 220, height: 260, borderRadius: borderRadius.md, backgroundColor: colors.divider, marginBottom: 4 },
    text: { fontSize: fontSize.base, color: colors.textPrimary, lineHeight: 21 },
    mention: { fontWeight: fontWeight.bold, color: colors.accent },
    textMine: { color: colors.textInverse },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2, gap: spacing.sm },
    replyHint: { fontSize: 11, color: colors.primary, fontWeight: fontWeight.semiBold },
    time: { fontSize: 10, color: colors.textMuted },
    timeMine: { color: colors.accentLight },
    replyBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      backgroundColor: colors.divider,
    },
    replyText: { flex: 1, fontSize: fontSize.xs, color: colors.textSecondary },
    replyClose: { fontSize: 14, color: colors.textSecondary },
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
    attachText: { fontSize: 20 },
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
    closedNote: { textAlign: 'center', color: colors.textMuted, fontSize: fontSize.xs, padding: spacing.md },
  }),
);
