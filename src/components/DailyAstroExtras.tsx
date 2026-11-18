// Inside Home > "Today's lucky colour": the daily rashi colour line (Chandra gochara: today's Moon
// rashi counted from the user's janma rashi, so it changes as the Moon moves) and "Good day to buy?"
// (tithi, nakshatra, Chandrashtama + today's Rahu kalam at the user's place). Traditional guidance.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, themedStyles } from '../theme';
import { useAppLanguage } from '../i18n/appLanguage';
import { dailyGuideText } from '../i18n/dailyGuideText';
import {
  NAKSHATRA_NAMES,
  PLANET_NAMES,
  RASHI_NAMES,
  colourName,
  tithiName,
} from '../i18n/astroNames';
import { birthChart, istClock12, rashiIndex } from '../utils/astro';
import {
  buyAdvice,
  dailyRashiColour,
  todayPanchang,
  BuyVerdict,
} from '../utils/dailyGuide';
import { useIstDayKey } from '../hooks/useDayKey';

// Janma rashi: the saved one, else the one computed from the date of birth (when the day is certain)
export const janmaRashiOf = (
  p?: {
    rashi?: string | null;
    dob?: string | null;
    timeOfBirth?: string | null;
  } | null,
): number => {
  const saved = rashiIndex(p?.rashi);
  if (saved >= 0) return saved;
  const c = p ? birthChart({ dob: p.dob, timeOfBirth: p.timeOfBirth }) : null;
  return c && !c.uncertain ? c.rashi : -1;
};

const moonShort = (name: string) => name.replace(/\s*\(.*\)\s*$/, '');

const VERDICT_COLOUR: Record<BuyVerdict, string> = {
  yes: '#10B981',
  careful: '#F59E0B',
  no: '#EF4444',
};

export default function DailyAstroExtras({
  part,
  profile,
  place,
}: {
  part: 'rashi' | 'buy';
  profile?: {
    rashi?: string | null;
    dob?: string | null;
    timeOfBirth?: string | null;
  } | null;
  place: { lat: number; lng: number };
}) {
  const lang = useAppLanguage();
  const istDay = useIstDayKey();
  const T = dailyGuideText(lang);
  const janma = janmaRashiOf(profile);

  const data = useMemo(() => {
    const p = todayPanchang(new Date(), place);
    return { p, colour: dailyRashiColour(janma, p), buy: buyAdvice(p, janma) };
    // istDay re-runs this at 12:00 AM IST
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [janma, place.lat, place.lng, istDay]);

  const { colour, buy } = data;
  const tithi = tithiName(buy.tithi, lang);
  const nak = NAKSHATRA_NAMES[lang][buy.nakshatra];
  const reason = buy.reasons.map(r => T.buyReason[r](tithi, nak)).join('; ');

  if (part === 'rashi') {
    return colour ? (
      <View style={styles.rashiRow}>
        <View style={[styles.dot, { backgroundColor: colour.colour.hex }]} />
        <Text style={styles.rashiLine}>
          {T.rashiLine({
            moon:
              lang === 'English'
                ? moonShort(RASHI_NAMES.English[colour.moonRashi])
                : RASHI_NAMES[lang][colour.moonRashi],
            house: colour.house,
            rashi: RASHI_NAMES[lang][colour.janmaRashi],
            colour: colourName(
              colour.planet === 1 ? 'White / Silver' : colour.colour.name,
              lang,
            ),
            lord: PLANET_NAMES[lang][colour.planet],
            kind: colour.kind,
          })}
        </Text>
      </View>
    ) : null;
  }

  return (
    <View style={styles.buyBox}>
      <View style={styles.buyHead}>
        <Text style={styles.buyTitle}>🛍️ {T.buyTitle}</Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: VERDICT_COLOUR[buy.verdict] },
          ]}
        >
          <Text style={styles.badgeText}>{T.buyVerdict[buy.verdict]}</Text>
        </View>
      </View>
      <Text style={styles.buyReason}>{reason}.</Text>
      <Text style={styles.rahu}>
        ⏰ {T.rahu(istClock12(buy.rahu.start), istClock12(buy.rahu.end))}
      </Text>
      <Text style={styles.note}>{T.traditional}</Text>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    rashiRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginTop: 4,
      marginRight: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rashiLine: {
      flex: 1,
      fontSize: 13,
      color: colors.accent,
      fontWeight: '600',
      lineHeight: 19,
    },
    buyBox: {
      marginTop: 10,
      padding: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buyHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    buyTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
      flexShrink: 1,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
      marginLeft: 8,
    },
    badgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
    buyReason: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
      marginTop: 4,
    },
    rahu: {
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: '600',
      marginTop: 4,
    },
    note: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 4,
      fontStyle: 'italic',
    },
  }),
);
