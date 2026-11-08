// New public post: 1 photo, or 2-6 photos as an A-F "which one?" vote post, + caption
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { pickImage, pickImages, POLL_PICK } from '../../utils/imagePicker';
import { createPost, MAX_POST_PHOTOS, MAX_POST_TOTAL_CHARS, OPTION_LABELS } from '../../services/feedApi';

export default function NewPostScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const [images, setImages] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  const multi = images.length > 1;
  const total = images.reduce((n, x) => n + x.length, 0);
  const tooBig = total > MAX_POST_TOTAL_CHARS;

  // One photo keeps full quality; extra photos are smaller so up to 6 fit in one post
  const addOne = async (source: 'camera' | 'library') => {
    try {
      const picked = await pickImage(source, images.length ? POLL_PICK : {});
      if (picked) setImages(prev => [...prev, picked.dataUri].slice(0, MAX_POST_PHOTOS));
    } catch (e: any) {
      Alert.alert('Photo problem', e?.message || 'Could not read that photo.');
    }
  };

  const addSeveral = async () => {
    try {
      const r = await pickImages(MAX_POST_PHOTOS - images.length);
      if (r.skipped) Alert.alert('Some photos skipped', `${r.skipped} photo(s) were too large.`);
      if (r.images.length) setImages(prev => [...prev, ...r.images.map(i => i.dataUri)].slice(0, MAX_POST_PHOTOS));
    } catch (e: any) {
      Alert.alert('Photo problem', e?.message || 'Could not read those photos.');
    }
  };

  const choose = () => {
    if (images.length >= MAX_POST_PHOTOS) {
      Alert.alert('Limit reached', `Up to ${MAX_POST_PHOTOS} photos per post.`);
      return;
    }
    Alert.alert('Add photos', 'Add 2-6 photos to let people vote A, B, C...', [
      { text: 'Take Photo', onPress: () => addOne('camera') },
      { text: 'Choose several', onPress: addSeveral },
      { text: 'Choose one', onPress: () => addOne('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const share = async () => {
    if (!user?.id) {
      Alert.alert('Not signed in', 'Please sign in again.');
      return;
    }
    if (!images.length) {
      Alert.alert('Photo needed', 'Pick a photo to post.');
      return;
    }
    if (tooBig) {
      Alert.alert('Too large', 'These photos are too large together. Remove one.');
      return;
    }
    setPosting(true);
    try {
      await createPost({ uid: user.id, name: user.name, avatar: user.avatarUrl }, images, caption);
      navigation.navigate('MainApp', { screen: 'Feed', params: { refreshAt: Date.now() } });
    } catch (e: any) {
      Alert.alert('Post failed', e?.message || 'Please try again.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.surface } : {})}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={posting}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{multi ? 'New A/B vote post' : 'New post'}</Text>
        <TouchableOpacity onPress={share} disabled={posting || !images.length || tooBig}>
          {posting ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.share, (!images.length || tooBig) && styles.disabled]}>Share</Text>
          )}
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {images.length === 0 ? (
            <TouchableOpacity style={styles.photoBox} onPress={choose} activeOpacity={0.85}>
              <View style={styles.placeholder}>
                <Text style={styles.plus}>📷</Text>
                <Text style={styles.placeholderText}>Tap to add photos</Text>
                <Text style={styles.placeholderSub}>2-6 photos = people vote A, B, C...</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.grid}>
              {images.map((img, i) => (
                <View key={i} style={[styles.tile, !multi && styles.tileFull]}>
                  <Image source={{ uri: img }} style={styles.photo} resizeMode="cover" />
                  {multi ? (
                    <View style={styles.letter}>
                      <Text style={styles.letterText}>{OPTION_LABELS[i]}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={styles.remove}
                    onPress={() => setImages(prev => prev.filter((_, j) => j !== i))}>
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < MAX_POST_PHOTOS ? (
                <TouchableOpacity style={[styles.tile, styles.addTile]} onPress={choose}>
                  <Text style={styles.plus}>＋</Text>
                  <Text style={styles.addText}>Add photo</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
          {tooBig ? <Text style={styles.error}>
              Photos are too large together. Remove one, or remove all and use "Choose several" (smaller photos).
            </Text> : null}
          <TextInput
            style={styles.caption}
            placeholder={multi ? 'Ask your question, e.g. Which one for the wedding?' : 'Write a caption...'}
            placeholderTextColor={colors.textMuted}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={500}
          />
          <Text style={styles.note}>Posts are public: everyone signed in can see them in the Feed.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancel: { fontSize: fontSize.base, color: colors.textSecondary },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  share: { fontSize: fontSize.base, color: colors.primary, fontWeight: fontWeight.bold },
  disabled: { opacity: 0.4 },
  content: { padding: spacing.base },
  photoBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48.5%',
    aspectRatio: 0.85,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  tileFull: { width: '100%', aspectRatio: 1 },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accentLight,
  },
  addText: { color: colors.accent, fontWeight: fontWeight.bold, marginTop: 4 },
  photo: { width: '100%', height: '100%' },
  letter: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: { color: colors.onPrimary, fontWeight: fontWeight.extraBold },
  remove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#FFFFFF', fontWeight: fontWeight.bold },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accentLight,
    borderRadius: borderRadius.lg,
  },
  plus: { fontSize: 40, color: colors.accent },
  placeholderText: { color: colors.accent, fontWeight: fontWeight.bold, marginTop: spacing.sm },
  placeholderSub: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4 },
  error: { color: colors.error, marginTop: spacing.sm },
  caption: {
    marginTop: spacing.base,
    minHeight: 90,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  note: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.sm },
}));
