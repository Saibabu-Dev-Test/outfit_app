// A flat coin face drawn with plain Views (no images, no gradients)
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CoinTier } from '../../config/coins';

export const COIN_COLORS: Record<CoinTier, { face: string; rim: string; inner: string; mark: string }> = {
  silver: { face: '#C9CED6', rim: '#8E959F', inner: '#DDE1E7', mark: '#6B727C' },
  gold: { face: '#F6C431', rim: '#C8901A', inner: '#FFD95A', mark: '#9A6A08' },
  diamond: { face: '#BFF4FF', rim: '#3BC9E6', inner: '#EAFDFF', mark: '#0E9DBD' },
};

interface Props {
  tier: CoinTier;
  size?: number;
}

export default function Coin({ tier, size = 96 }: Props) {
  const c = COIN_COLORS[tier] || COIN_COLORS.silver;
  const inner = Math.round(size * 0.74);
  return (
    <View
      style={[
        styles.coin,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: c.face, borderColor: c.rim, borderWidth: Math.max(2, size * 0.06) },
      ]}
    >
      <View style={[styles.inner, { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: c.inner, borderColor: c.rim }]}>
        <Text style={[styles.mark, { color: c.mark, fontSize: Math.round(size * 0.38) }]}>{tier === 'diamond' ? '◆' : '★'}</Text>
      </View>
      {/* shine */}
      <View
        style={[
          styles.shine,
          { width: size * 0.28, height: size * 0.14, borderRadius: size * 0.1, top: size * 0.14, left: size * 0.2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  coin: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  inner: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  mark: { fontWeight: '900', includeFontPadding: false, textAlign: 'center' },
  shine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '-25deg' }] },
});
