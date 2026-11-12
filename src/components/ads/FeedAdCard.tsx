// "Sponsored" card between Feed posts (after every FEED_AD_EVERY posts): an AdMob Native advanced
// ad (feed_native) laid out like a post: icon + headline + advertiser, text, media, button.
// Renders nothing while loading, on no fill, or on any error. Web: FeedAdCard.web.tsx.
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { borderRadius, colors, fontSize, fontWeight, spacing, themedStyles } from '../../theme';
import AdErrorBoundary from './AdErrorBoundary';
import { adsModule, initAds } from '../../native/ads';
import { adUnitId } from '../../config/ads';

function NativeCard() {
  const m = adsModule();
  const [ad, setAd] = useState<any>(null);

  useEffect(() => {
    if (!m?.NativeAd) return;
    let alive = true;
    let loaded: any = null;
    (async () => {
      try {
        await initAds();
        loaded = await m.NativeAd.createForAdRequest(adUnitId('feedNative'), { startVideoMuted: true });
        if (alive) setAd(loaded);
        else loaded?.destroy?.();
      } catch {
        // No fill / offline: show nothing
      }
    })();
    return () => {
      alive = false;
      try {
        loaded?.destroy?.();
      } catch {}
    };
  }, [m]);

  if (!m || !ad || !m.NativeAdView || !m.NativeAsset) return null;
  const { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } = m;
  const ratio = ad.mediaContent?.aspectRatio > 0 ? ad.mediaContent.aspectRatio : 16 / 9;
  return (
    <NativeAdView nativeAd={ad} style={styles.card}>
      <View style={styles.head}>
        {ad.icon?.url ? (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: ad.icon.url }} style={styles.icon} />
          </NativeAsset>
        ) : null}
        <View style={styles.headText}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={styles.headline} numberOfLines={1}>
              {ad.headline}
            </Text>
          </NativeAsset>
          <View style={styles.subRow}>
            <Text style={styles.badge}>Ad</Text>
            {ad.advertiser ? (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text style={styles.advertiser} numberOfLines={1}>
                  {ad.advertiser}
                </Text>
              </NativeAsset>
            ) : (
              <Text style={styles.advertiser}>Sponsored</Text>
            )}
          </View>
        </View>
      </View>
      {NativeMediaView ? <NativeMediaView style={[styles.media, { aspectRatio: ratio }]} resizeMode="cover" /> : null}
      {ad.body ? (
        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text style={styles.body} numberOfLines={3}>
            {ad.body}
          </Text>
        </NativeAsset>
      ) : null}
      {ad.callToAction ? (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text style={styles.cta}>{ad.callToAction}</Text>
        </NativeAsset>
      ) : null}
    </NativeAdView>
  );
}

export default function FeedAdCard() {
  if (!adsModule()) return null;
  return (
    <AdErrorBoundary>
      <NativeCard />
    </AdErrorBoundary>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    marginVertical: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  icon: { width: 36, height: 36, borderRadius: 18, marginRight: spacing.sm, backgroundColor: colors.border },
  headText: { flex: 1 },
  headline: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  badge: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
    backgroundColor: '#F9A825',
    borderRadius: 3,
    paddingHorizontal: 4,
    marginRight: spacing.xs,
    overflow: 'hidden',
  },
  advertiser: { fontSize: fontSize.xs, color: colors.textMuted, flexShrink: 1 },
  media: { width: '100%', backgroundColor: colors.border },
  body: { fontSize: fontSize.sm, color: colors.textSecondary, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  cta: {
    alignSelf: 'flex-start',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    color: colors.onPrimary,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.sm,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
  },
}));
