// Home: 🎂 Birthdays today and in the next 7 days (day and month only, never the year or age),
// only people who turned on "Show my birthday". Tap a person to send a wish; on your own birthday
// the "Happy birthday to all" circle shows here too. One Firestore query per day (cached).
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import { useDayKey } from '../hooks/useDayKey';
import Avatar from './Avatar';
import NameWithAge from './NameWithAge';
import {
  BirthdayEntry,
  getMyBirthday,
  getUpcomingBirthdays,
  isMyBirthdayToday,
  mdLabel,
  MyBirthday,
} from '../services/birthdayApi';

export const whenLabel = (e: { inDays: number; md: string }): string =>
  e.inDays === 0 ? 'Today 🎉' : e.inDays === 1 ? `Tomorrow · ${mdLabel(e.md)}` : `${mdLabel(e.md)} · in ${e.inDays} days`;

export default function BirthdaysCard({ uid }: { uid: string }) {
  const navigation = useNavigation<any>();
  const dayKey = useDayKey();
  const [list, setList] = useState<BirthdayEntry[]>([]);
  const [my, setMy] = useState<MyBirthday>({ on: false, md: null });

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let alive = true;
      getUpcomingBirthdays().then(l => alive && setList(l));
      getMyBirthday(uid).then(m => alive && setMy(m));
      return () => {
        alive = false;
      };
      // dayKey: refetch after midnight
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid, dayKey]),
  );

  const mineToday = isMyBirthdayToday(my);
  const others = list.filter(e => e.uid !== uid);
  if (!others.length && !mineToday) return null;

  return (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.title}>🎂 Birthdays</Text>
      </View>
      <View style={styles.card}>
        {mineToday ? (
          <TouchableOpacity
            style={styles.partyRow}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('BirthdayChat', { mode: 'circle' })}>
            <Text style={styles.partyEmoji}>🎉</Text>
            <View style={styles.flex1}>
              <Text style={styles.partyTitle}>Happy birthday to you!</Text>
              <Text style={styles.partySub}>Join today's "Happy birthday to all" circle · see your wishes</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ) : null}
        {mineToday ? (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('BirthdayChat', { mode: 'wishes', uid })}>
            <Text style={styles.myWishes}>💌 My birthday wishes</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ) : null}
        {others.map(e => (
          <TouchableOpacity
            key={e.uid}
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('BirthdayChat', { mode: 'wishes', uid: e.uid })}>
            <Avatar uri={e.avatar} name={e.name} size={38} />
            <View style={styles.flex1}>
              <NameWithAge style={styles.name} numberOfLines={1} uid={e.uid} name={e.name} age={(e as any).age} />
              <Text style={[styles.when, e.inDays === 0 && styles.today]}>{whenLabel(e)}</Text>
            </View>
            <View style={styles.wishBtn}>
              <Text style={styles.wishText}>{e.inDays === 0 ? 'Wish 🎂' : 'Wish early'}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {!my.on ? (
          <Text style={styles.hint}>Want friends to see yours? Turn on "Show my birthday" in Settings (day and month only).</Text>
        ) : null}
      </View>
    </>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    flex1: { flex: 1, marginLeft: spacing.sm },
    headerRow: { paddingHorizontal: spacing.base, marginTop: spacing.xl, marginBottom: spacing.sm },
    title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    card: {
      marginHorizontal: spacing.base,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: spacing.base,
      borderWidth: 1,
      borderColor: colors.border,
    },
    partyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: colors.background,
      marginBottom: spacing.xs,
    },
    partyEmoji: { fontSize: 30 },
    partyTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
    partySub: { fontSize: fontSize.xs, color: colors.textSecondary },
    myWishes: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semiBold, color: colors.primary },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
    name: { fontSize: fontSize.base, fontWeight: fontWeight.semiBold, color: colors.textPrimary },
    when: { fontSize: fontSize.xs, color: colors.textSecondary },
    today: { color: colors.accent, fontWeight: fontWeight.bold },
    wishBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
    },
    wishText: { color: colors.textInverse, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    arrow: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
    hint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs },
  }),
);
