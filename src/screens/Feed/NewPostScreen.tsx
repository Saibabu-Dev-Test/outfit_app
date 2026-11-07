// New public post: pick a photo + caption
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { pickImage } from '../../utils/imagePicker';
import { createPost } from '../../services/feedApi';

export default function NewPostScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const [image, setImage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  const pick = async (source: 'camera' | 'library') => {
    try {
      const picked = await pickImage(source);
      if (picked) setImage(picked.dataUri);
    } catch (e: any) {
      Alert.alert('Photo problem', e?.message || 'Could not read that photo.');
    }
  };

  const choose = () =>
    Alert.alert('Add a photo', undefined, [
      { text: 'Take Photo', onPress: () => pick('camera') },
      { text: 'Choose from Library', onPress: () => pick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const share = async () => {
    if (!user?.id) {
      Alert.alert('Not signed in', 'Please sign in again.');
      return;
    }
    if (!image) {
      Alert.alert('Photo needed', 'Pick a photo to post.');
      return;
    }
    setPosting(true);
    try {
      await createPost({ uid: user.id, name: user.name, avatar: user.avatarUrl }, image, caption);
      navigation.popTo('Feed', { refreshAt: Date.now() });
    } catch (e: any) {
      Alert.alert('Post failed', e?.message || 'Please try again.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar
        barStyle="dark-content"
        {...(Platform.OS === 'android' ? { backgroundColor: colors.surface } : {})}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={posting}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New post</Text>
        <TouchableOpacity onPress={share} disabled={posting || !image}>
          {posting ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.share, !image && styles.disabled]}>Share</Text>
          )}
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.photoBox} onPress={choose} activeOpacity={0.85}>
            {image ? (
              <Image source={{ uri: image }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.plus}>📷</Text>
                <Text style={styles.placeholderText}>Tap to add a photo</Text>
              </View>
            )}
          </TouchableOpacity>
          {image ? (
            <TouchableOpacity onPress={choose}>
              <Text style={styles.change}>Change photo</Text>
            </TouchableOpacity>
          ) : null}
          <TextInput
            style={styles.caption}
            placeholder="Write a caption..."
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

const styles = StyleSheet.create({
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
  photo: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accentLight,
    borderRadius: borderRadius.lg,
  },
  plus: { fontSize: 40 },
  placeholderText: { color: colors.accent, fontWeight: fontWeight.bold, marginTop: spacing.sm },
  change: { color: colors.primary, fontWeight: fontWeight.bold, textAlign: 'center', marginTop: spacing.sm },
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
});
