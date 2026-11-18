// Home > "Weather & climate today": min / max, rain chance, wind, UV / heat, air quality and severe
// weather flags (cyclone / toofan, heavy rain, heatwave, strong wind) from Open-Meteo (free, no key),
// then precautions for the user's age group and "Go out today?" with the best time window.
// Place: approximate device location when allowed (asked politely once), else Hyderabad.
// Data is cached for 3 hours; offline shows the last saved reading.
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, borderRadius, themedStyles } from '../theme';
import { useAppLanguage } from '../i18n/appLanguage';
import {
  aqiBandIndex,
  dailyGuideText,
  hourLabel,
  uvBandIndex,
} from '../i18n/dailyGuideText';
import { getTodayWeather, TodayWeatherResult } from '../services/todayWeather';
import { weatherText } from '../services/weatherApi';
import { ageFromDobIST } from '../utils/age';
import { istClock12 } from '../utils/astro';
import {
  ageGroup,
  ageTipKeys,
  goOutAdvice,
  todayPanchang,
  weatherAlerts,
  GoOutVerdict,
} from '../utils/dailyGuide';
import type { HomePlace } from '../hooks/useHomePlace';

const VERDICT_COLOUR: Record<GoOutVerdict, string> = {
  yes: '#10B981',
  careful: '#F59E0B',
  avoid: '#EF4444',
};
const r0 = (n: number | null | undefined) =>
  n === null || n === undefined ? '–' : String(Math.round(n));

export default function WeatherCard({
  place,
  askNeeded,
  busy,
  onAllow,
  onNotNow,
  dob,
}: {
  place: HomePlace;
  askNeeded: boolean;
  busy: boolean;
  onAllow: (rationale: {
    title: string;
    message: string;
    allow?: string;
    notNow?: string;
  }) => void;
  onNotNow: () => void;
  dob?: string | null;
}) {
  const lang = useAppLanguage();
  const T = dailyGuideText(lang);
  const [res, setRes] = useState<TodayWeatherResult | null | undefined>(
    undefined,
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getTodayWeather(place.lat, place.lng).then(r => {
        if (alive) setRes(r);
      });
      return () => {
        alive = false;
      };
    }, [place.lat, place.lng]),
  );

  const w = res?.weather || null;
  const view = useMemo(() => {
    if (!w) return null;
    const age = ageFromDobIST(dob);
    const group = ageGroup(age);
    const rahu = todayPanchang(new Date(), place).rahu;
    return {
      group,
      alerts: weatherAlerts(w),
      tips: ageTipKeys(w),
      go: goOutAdvice(w, group, rahu),
      rahu,
    };
  }, [w, dob, place]);

  const allow = () =>
    onAllow({
      title: T.permTitle,
      message: T.permMessage,
      allow: T.allow,
      notNow: T.notNow,
    });

  const sky = w ? weatherText(w.code) : null;
  const goBecause = view
    ? view.go.because
        .map(k =>
          k in T.because
            ? T.because[k as keyof typeof T.because]
            : T.alerts[k as keyof typeof T.alerts].replace(/^\S+\s/, ''),
        )
        .join(', ')
    : '';

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>🌦️ {T.weatherTitle}</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.placeRow}>
          <Text style={styles.place}>
            {place.source === 'device' ? T.placeDevice : T.placeDefault}
          </Text>
          {place.source === 'default' && !askNeeded ? (
            <TouchableOpacity onPress={allow} disabled={busy} hitSlop={8}>
              <Text style={styles.link}>{busy ? '…' : T.useMine}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {askNeeded ? (
          <View style={styles.askBox}>
            <Text style={styles.askText}>{T.askLocation}</Text>
            <View style={styles.askButtons}>
              <TouchableOpacity
                style={styles.askPrimary}
                onPress={allow}
                disabled={busy}
                activeOpacity={0.85}
              >
                <Text style={styles.askPrimaryText}>{T.allow}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.askSecondary}
                onPress={onNotNow}
                activeOpacity={0.85}
              >
                <Text style={styles.askSecondaryText}>{T.notNow}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {res === undefined ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.muted}> {T.loading}</Text>
          </View>
        ) : !w || !view || !sky ? (
          <Text style={styles.muted}>{T.unavailable}</Text>
        ) : (
          <>
            <View style={styles.nowRow}>
              <Text style={styles.nowEmoji}>{sky.emoji}</Text>
              <View style={styles.flex1}>
                <Text style={styles.nowTemp}>
                  {T.now}: {r0(w.nowTemp)}°C
                </Text>
                <Text style={styles.sky}>{T.sky[sky.label] || sky.label}</Text>
              </View>
            </View>

            <View style={styles.grid}>
              <Stat
                label={T.minMax}
                value={`${r0(w.tMin)}° / ${r0(w.tMax)}°C`}
              />
              <Stat
                label={T.rainChance}
                value={w.rainChance === null ? '–' : `${r0(w.rainChance)}%`}
              />
              <Stat
                label={T.wind}
                value={w.windMax === null ? '–' : `${r0(w.windMax)} km/h`}
              />
              <Stat
                label={T.uv}
                value={
                  w.uvMax === null
                    ? '–'
                    : `${r0(w.uvMax)} · ${T.uvBand[uvBandIndex(w.uvMax)]}`
                }
              />
              <Stat
                label={T.air}
                value={
                  w.aqi === null
                    ? '–'
                    : `AQI ${r0(w.aqi)} · ${T.aqiBand[aqiBandIndex(w.aqi)]}`
                }
                wide
              />
            </View>

            {view.alerts.length ? (
              <View style={styles.alertBox}>
                <Text style={styles.alertTitle}>⚠️ {T.alertsTitle}</Text>
                {view.alerts.map(a => (
                  <Text
                    key={a.kind}
                    style={[styles.alertText, a.severe && styles.alertSevere]}
                  >
                    {T.alerts[a.kind]}
                  </Text>
                ))}
                <Text style={styles.note}>{T.alertNote}</Text>
              </View>
            ) : null}

            <Text style={styles.subTitle}>
              🧑‍🤝‍🧑 {T.ageTitle(T.groupName[view.group])}
            </Text>
            {view.tips.map(k => (
              <Text key={k} style={styles.tip}>
                • {T.tips[view.group][k]}
              </Text>
            ))}

            <View style={styles.goBox}>
              <View style={styles.goHead}>
                <Text style={styles.goTitle}>🚶 {T.goTitle}</Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: VERDICT_COLOUR[view.go.verdict] },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {T.goVerdict[view.go.verdict]}
                  </Text>
                </View>
              </View>
              <Text style={styles.goText}>
                {view.go.verdict === 'yes'
                  ? T.goYes
                  : view.go.verdict === 'careful'
                  ? T.goCareful(goBecause)
                  : T.goAvoid(goBecause)}{' '}
                {view.go.window
                  ? T.goWindow(
                      hourLabel(view.go.window.from),
                      hourLabel(view.go.window.to),
                    )
                  : T.goNoWindow}
              </Text>
              {view.go.rahuOverlap ? (
                <Text style={styles.note}>
                  ⏰{' '}
                  {T.goRahu(
                    istClock12(view.rahu.start),
                    istClock12(view.rahu.end),
                  )}
                </Text>
              ) : null}
            </View>

            <Text style={styles.note}>
              {res?.stale ? `${T.offline} ` : ''}
              {T.updated(istClock12(w.fetchedAt))} · Open-Meteo
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.stat, wide && styles.statWide]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    flex1: { flex: 1 },
    headerRow: {
      paddingHorizontal: spacing.base,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginHorizontal: spacing.base,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.base,
    },
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    place: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    link: { fontSize: 12, color: colors.accent, fontWeight: '700' },
    askBox: {
      marginTop: 8,
      padding: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: colors.pinkSoft,
    },
    askText: { fontSize: 13, color: colors.textPrimary, lineHeight: 19 },
    askButtons: { flexDirection: 'row', marginTop: 8 },
    askPrimary: {
      backgroundColor: colors.accent,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 16,
    },
    askPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
    askSecondary: { paddingHorizontal: 14, paddingVertical: 7, marginLeft: 8 },
    askSecondaryText: {
      color: colors.textSecondary,
      fontWeight: '700',
      fontSize: 13,
    },
    loadingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    muted: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
    nowRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    nowEmoji: { fontSize: 34, marginRight: 10 },
    nowTemp: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    sky: { fontSize: 13, color: colors.textSecondary },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 10,
      marginHorizontal: -4,
    },
    stat: { width: '50%', paddingHorizontal: 4, marginBottom: 8 },
    statWide: { width: '100%' },
    statLabel: { fontSize: 11, color: colors.textMuted },
    statValue: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 1,
    },
    alertBox: {
      marginTop: 4,
      padding: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: '#F59E0B',
    },
    alertTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    alertText: { fontSize: 13, color: colors.textPrimary, lineHeight: 19 },
    alertSevere: { color: '#EF4444', fontWeight: '700' },
    subTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
      marginTop: 10,
      marginBottom: 2,
    },
    tip: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
      marginTop: 2,
    },
    goBox: {
      marginTop: 10,
      padding: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    goHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    goTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
      flexShrink: 1,
    },
    goText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
      marginTop: 4,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
      marginLeft: 8,
    },
    badgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
    note: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 6,
      fontStyle: 'italic',
    },
  }),
);
