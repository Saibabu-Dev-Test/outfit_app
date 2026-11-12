// A banner ad (Circles list, people search). The ad view is 0 x 0 until an ad has loaded, and nothing
// renders at all when there is no fill, the module is missing or anything throws. Web: BannerAdSlot.web.tsx.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import AdErrorBoundary from './AdErrorBoundary';
import { adsModule, initAds } from '../../native/ads';
import { adUnitId } from '../../config/ads';

interface Props {
  slot: 'circlesBanner' | 'searchBanner';
  style?: ViewStyle;
  // Called once an ad is actually showing (e.g. to show a "Sponsored" label around it)
  onLoaded?: () => void;
}

function Banner({ slot, style, onLoaded }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    initAds().catch(() => undefined);
  }, []);
  const m = adsModule();
  if (!m || failed) return null;
  const BannerAd = m.BannerAd;
  const sizes = m.BannerAdSize || {};
  const adSize = sizes.ANCHORED_ADAPTIVE_BANNER;
  if (!BannerAd || !adSize) return null;
  return (
    <View style={[styles.wrap, style]}>
      <BannerAd
        unitId={adUnitId(slot)}
        size={adSize}
        onAdLoaded={() => {
          onLoaded?.();
        }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

export default function BannerAdSlot(props: Props) {
  return (
    <AdErrorBoundary>
      <Banner {...props} />
    </AdErrorBoundary>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
