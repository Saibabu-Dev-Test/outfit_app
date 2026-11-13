// Find people by name prefix (public profiles only)
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import Avatar from '../../components/Avatar';
import { PublicUser, searchUsers } from '../../services/userApi';
import NativeAdCard from '../../ads/NativeAdCard';
import { interleaveAds, isAdRow } from '../../ads/interleave';
import { ADS } from '../../config/ads';

export default function UserSearchScreen({ navigation }: { navigation: any }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = text.trim();
    if (!q) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    const mySeq = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchUsers(q);
        if (mySeq === seq.current) {
          setResults(r);
          setError(null);
        }
      } catch (e: any) {
        if (mySeq === seq.current) setError(e?.message || 'Search failed.');
      } finally {
        if (mySeq === seq.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Search people by name"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>
      {loading ? <ActivityIndicator style={styles.spinner} color={colors.primary} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={interleaveAds(results, ADS.listEvery)}
        keyExtractor={u => u.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) =>
          isAdRow(item) ? (
            <NativeAdCard width={0} variant="row" />
          ) : (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('UserProfile', { userId: item.id })}>
            <Avatar uri={item.avatarUrl} name={item.name} size={44} />
            <View style={styles.rowText}>
              <Text style={styles.name}>{item.name}</Text>
              {item.bio ? (
                <Text style={styles.bio} numberOfLines={1}>
                  {item.bio}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
          )
        }
        ListEmptyComponent={
          !loading && text.trim() && !error ? (
            <Text style={styles.empty}>No public profiles start with "{text.trim()}".</Text>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
  input: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.base,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  spinner: { marginTop: spacing.md },
  error: { color: colors.error, textAlign: 'center', padding: spacing.md, fontSize: fontSize.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.sm },
  rowText: { marginLeft: spacing.md, flex: 1 },
  name: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  bio: { fontSize: fontSize.sm, color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xl },
}));
