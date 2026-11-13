// AdMob NATIVE ad drawn like an outfit post in the feed (same card as PostCard): advertiser icon +
// name where the poster's name goes, the big media (photo / video) at the same square size as post
// photos, the headline as the caption and the call-to-action button where the vote buttons sit.
// "Ad" label (AdMob native policy: the ad must be clearly marked) + AdChoices from the SDK.
// Loads its own ad; renders nothing while loading or on any error (never a blank box, never a crash).
// variant="row": compact card for other lists (circles, user search): icon, headline, body, CTA.
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import { adsLib, initAds, unitFor } from './adsService';
import AdErrorBoundary from './AdErrorBoundary';

interface Props {
  width: number;
  variant?: 'post' | 'row';
}

function NativeAdInner({ width, variant = 'post' }: Props) {
  const [ad, setAd] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    let loaded: any = null;
    (async () => {
      try {
        const L = adsLib();
        const unit = unitFor('native');
        if (!L || !unit) return;
        await initAds();
        loaded = await L.NativeAd.createForAdRequest(unit, {
          aspectRatio: variant === 'post' ? L.NativeMediaAspectRatio?.SQUARE : L.NativeMediaAspectRatio?.ANY,
          startVideoMuted: true,
        });
        if (alive) setAd(loaded);
        else loaded?.destroy?.();
      } catch (e: any) {
        console.warn('Native ad failed:', e?.message);
      }
    })();
    return () => {
      alive = false;
      try {
        loaded?.destroy?.();
      } catch {}
    };
  }, [variant]);

  const L = adsLib();
  if (!ad || !L) return null;
  const { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } = L;
  const name = ad.advertiser || ad.store || 'Sponsored';
  const cta = ad.callToAction || 'Learn more';

  if (variant === 'row') {
    return (
      <NativeAdView nativeAd={ad} style={styles.row}>
        <View style={styles.rowInner}>
          {ad.icon?.url ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image source={{ uri: ad.icon.url }} style={styles.rowIcon} />
            </NativeAsset>
          ) : (
            <View style={[styles.rowIcon, styles.iconFallback]} />
          )}
          <View style={styles.flex1}>
            <View style={styles.nameLine}>
              <Text style={styles.adBadge}>Ad</Text>
              <NativeAsset assetType={NativeAssetType.HEADLINE}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {ad.headline}
                </Text>
              </NativeAsset>
            </View>
            {ad.body ? (
              <NativeAsset assetType={NativeAssetType.BODY}>
                <Text style={styles.rowBody} numberOfLines={2}>
                  {ad.body}
                </Text>
              </NativeAsset>
            ) : null}
          </View>
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text style={styles.rowCta}>{cta}</Text>
          </NativeAsset>
        </View>
      </NativeAdView>
    );
  }

  return (
    <NativeAdView nativeAd={ad} style={styles.post}>
      <View style={styles.header}>
        {ad.icon?.url ? (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: ad.icon.url }} style={styles.icon} />
          </NativeAsset>
        ) : (
          <View style={[styles.icon, styles.iconFallback]} />
        )}
        <View style={styles.headerText}>
          {ad.advertiser ? (
            <NativeAsset assetType={NativeAssetType.ADVERTISER}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
            </NativeAsset>
          ) : (
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
          )}
          <View style={styles.nameLine}>
            <Text style={styles.adBadge}>Ad</Text>
            <Text style={styles.sponsored}>Sponsored</Text>
          </View>
        </View>
      </View>

      <NativeMediaView style={{ width, height: width, backgroundColor: colors.border }} resizeMode="cover" />

      <View style={styles.ctaBox}>
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text style={styles.cta}>{cta}</Text>
        </NativeAsset>
      </View>
      <NativeAsset assetType={NativeAssetType.HEADLINE}>
        <Text style={styles.caption} numberOfLines={2}>
          <Text style={styles.captionName}>{name} </Text>
          {ad.headline}
        </Text>
      </NativeAsset>
      {ad.body ? (
        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text style={styles.body} numberOfLines={2}>
            {ad.body}
          </Text>
        </NativeAsset>
      ) : null}
    </NativeAdView>
  );
}

export default function NativeAdCard(props: Props) {
  return (
    <AdErrorBoundary>
      <NativeAdInner {...props} />
    </AdErrorBoundary>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    flex1: { flex: 1 },
    post: { marginBottom: spacing.base, backgroundColor: colors.surface, paddingBottom: spacing.sm },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    icon: { width: 34, height: 34, borderRadius: 17 },
    iconFallback: { backgroundColor: colors.border },
    headerText: { marginLeft: spacing.sm, flex: 1 },
    name: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
    nameLine: { flexDirection: 'row', alignItems: 'center' },
    adBadge: {
      fontSize: 10,
      fontWeight: '800',
      color: '#FFFFFF',
      backgroundColor: '#F2A93B',
      borderRadius: 3,
      paddingHorizontal: 4,
      marginRight: 6,
      overflow: 'hidden',
    },
    sponsored: { fontSize: fontSize.xs, color: colors.textMuted },
    ctaBox: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    cta: {
      textAlign: 'center',
      backgroundColor: colors.primary,
      color: colors.onPrimary,
      fontWeight: fontWeight.bold,
      fontSize: fontSize.sm,
      paddingVertical: 10,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
    },
    caption: { fontSize: fontSize.sm, color: colors.textPrimary, paddingHorizontal: spacing.md, paddingTop: 6, lineHeight: 19 },
    captionName: { fontWeight: fontWeight.bold },
    body: { fontSize: fontSize.xs, color: colors.textSecondary, paddingHorizontal: spacing.md, paddingTop: 2 },
    row: {
      marginHorizontal: spacing.md,
      marginVertical: spacing.xs,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    rowInner: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm },
    rowIcon: { width: 44, height: 44, borderRadius: 10, marginRight: spacing.sm },
    rowTitle: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
    rowBody: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
    rowCta: {
      marginLeft: spacing.sm,
      backgroundColor: colors.primary,
      color: colors.onPrimary,
      fontWeight: fontWeight.bold,
      fontSize: fontSize.xs,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
  }),
);
