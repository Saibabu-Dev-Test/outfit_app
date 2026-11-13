// "▶ Watch ad for ..." button: shows a Rewarded ad on the user's own tap; when the reward is
// earned, the feature is unlocked for today (rewardUnlocks) and onUnlocked runs.
// When no ad can be shown (no fill / offline / ads unavailable) the user is told and nothing is
// unlocked; after 2 failed tries in a session the content is unlocked anyway so nobody is stuck.
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import { showRewardedAd } from './adsService';
import { unlockToday } from './rewardUnlocks';
import { recordMonthlyProgress } from '../services/monthlyTasksApi';

const fails: Record<string, number> = {};

interface Props {
  feature: string; // e.g. 'astro', 'porutham', 'stylist'
  label: string;
  onUnlocked: () => void;
  uid?: string | null;
}

export default function RewardedUnlockButton({ feature, label, onUnlocked, uid }: Props) {
  const [busy, setBusy] = useState(false);
  const press = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await showRewardedAd();
      if (ok) {
        await unlockToday(feature);
        if (uid) recordMonthlyProgress(uid, 'adsWatched', 1);
        onUnlocked();
        return;
      }
      fails[feature] = (fails[feature] || 0) + 1;
      if (fails[feature] >= 2) {
        await unlockToday(feature);
        onUnlocked();
        return;
      }
      Alert.alert('No ad right now', 'Could not load an ad. Please check your internet and try again in a minute.');
    } catch {
      // never crash on an ad
    } finally {
      setBusy(false);
    }
  };
  return (
    <TouchableOpacity style={styles.btn} onPress={press} activeOpacity={0.85} disabled={busy}>
      {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.text}>▶ {label}</Text>}
    </TouchableOpacity>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    btn: {
      backgroundColor: colors.accent,
      borderRadius: borderRadius.full,
      paddingVertical: 10,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      alignSelf: 'center',
      marginVertical: spacing.sm,
      minWidth: 220,
    },
    text: { color: '#FFFFFF', fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  }),
);
