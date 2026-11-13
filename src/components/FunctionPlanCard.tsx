// Home: 📅 the next planned function (wedding, puja, party...) with its weather and what to wear.
// Weather comes from Open-Meteo once the date is within the 16-day forecast. Empty state invites
// the user to plan one. Also re-arms the planner reminders (idempotent) when Home is shown.
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, themedStyles } from '../theme';
import { useDayKey } from '../hooks/useDayKey';
import {
  OUTFIT_TIPS,
  PlannedFunction,
  daysUntil,
  loadFunctions,
  syncPlanReminders,
  typeMeta,
  upcomingFunctions,
  whenText,
} from '../services/functionPlanner';
import { DayWeather, weatherFor, weatherText, weatherTip } from '../services/weatherApi';

export default function FunctionPlanCard({ uid }: { uid: string }) {
  const navigation = useNavigation<any>();
  const dayKey = useDayKey();
  const [next, setNext] = useState<PlannedFunction | null | undefined>(undefined);
  const [more, setMore] = useState(0);
  const [wx, setWx] = useState<DayWeather | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadFunctions(uid).then(list => {
        if (!alive) return;
        const up = upcomingFunctions(list, dayKey);
        setNext(up[0] || null);
        setMore(Math.max(0, up.length - 1));
        setWx(null);
        syncPlanReminders(list);
        const f = up[0];
        if (f?.city && daysUntil(f.date, dayKey) < 16) {
          weatherFor(f.city, f.date).then(w => alive && setWx(w));
        }
      });
      return () => {
        alive = false;
      };
    }, [uid, dayKey]),
  );

  if (next === undefined) return null;
  const open = () => navigation.navigate('FunctionPlanner');

  if (!next) {
    return (
      <TouchableOpacity style={[styles.card, styles.emptyCard]} onPress={open} activeOpacity={0.85}>
        <Text style={styles.emoji}>📅</Text>
        <View style={styles.body}>
          <Text style={styles.title}>Plan a function</Text>
          <Text style={styles.sub}>Wedding, puja or party coming up? Get reminders, weather and outfit ideas.</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    );
  }

  const meta = typeMeta(next.type);
  const n = daysUntil(next.date, dayKey);
  const w = wx ? weatherText(wx.code) : null;
  return (
    <TouchableOpacity style={styles.card} onPress={open} activeOpacity={0.85}>
      <View style={styles.row}>
        <Text style={styles.emoji}>{meta.emoji}</Text>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {next.title}
          </Text>
          <Text style={[styles.sub, n <= 1 && styles.soon]}>
            {whenText(n)}
            {next.time ? ` · ${next.time}` : ''}
            {next.city ? ` · ${next.city}` : ''}
          </Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </View>
      {wx && w ? (
        <Text style={styles.weather}>
          {w.emoji} {w.label} · {wx.tMin}°–{wx.tMax}°C{wx.rainChance != null ? ` · 💧 ${wx.rainChance}%` : ''}
        </Text>
      ) : next.city && n >= 16 ? (
        <Text style={styles.hint}>Weather shows up 16 days before.</Text>
      ) : null}
      <Text style={styles.tip}>👗 {wx ? weatherTip(wx) : OUTFIT_TIPS[next.type]}</Text>
      {more ? <Text style={styles.hint}>+{more} more planned</Text> : null}
    </TouchableOpacity>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    card: {
      marginHorizontal: spacing.base,
      marginTop: spacing.xl,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: spacing.base,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyCard: { flexDirection: 'row', alignItems: 'center' },
    row: { flexDirection: 'row', alignItems: 'center' },
    emoji: { fontSize: 30 },
    body: { flex: 1, marginLeft: spacing.sm },
    title: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
    sub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
    soon: { color: colors.accent, fontWeight: fontWeight.bold },
    arrow: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
    weather: { fontSize: fontSize.sm, color: colors.textPrimary, marginTop: spacing.sm, fontWeight: fontWeight.semiBold },
    tip: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
    hint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs },
  }),
);
