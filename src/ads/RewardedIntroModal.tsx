// Rewarded INTERSTITIAL with the intro AdMob policy requires: says what the reward is, counts down
// and lets the user say "No thanks" before the ad plays. Used for "double your coins".
import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import { ADS } from '../config/ads';
import { showRewardedInterstitialAd } from './adsService';

interface Props {
  visible: boolean;
  title: string; // e.g. 'Double your 50 coins?'
  onDone: (earned: boolean) => void;
}

export default function RewardedIntroModal({ visible, title, onDone }: Props) {
  const [left, setLeft] = useState(ADS.rewardedInterstitialIntroSec);
  const started = useRef(false);

  useEffect(() => {
    if (!visible) return;
    started.current = false;
    setLeft(ADS.rewardedInterstitialIntroSec);
    const t = setInterval(() => setLeft(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [visible]);

  const play = async () => {
    if (started.current) return;
    started.current = true;
    let earned = false;
    try {
      earned = await showRewardedInterstitialAd();
    } catch {}
    onDone(earned);
  };

  useEffect(() => {
    if (visible && left <= 0) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onDone(false)}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>A short ad starts in {Math.max(0, left)} s</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.no} onPress={() => onDone(false)}>
              <Text style={styles.noText}>No thanks</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.yes} onPress={play}>
              <Text style={styles.yesText}>▶ Watch now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.xl },
    box: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg },
    title: { fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary, textAlign: 'center' },
    sub: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
    row: { flexDirection: 'row', marginTop: spacing.lg },
    no: { flex: 1, padding: spacing.md, alignItems: 'center' },
    noText: { color: colors.textSecondary, fontWeight: fontWeight.bold },
    yes: { flex: 1, padding: spacing.md, alignItems: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.full },
    yesText: { color: colors.onPrimary, fontWeight: fontWeight.bold },
  }),
);
