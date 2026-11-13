// Full-screen photo viewer shared by circle polls, A-F feed posts, chat photos, wardrobe items and
// profile photos: swipe (or ‹ ›) between photos, pinch or double-tap to zoom, drag while zoomed, ✕ closes.
// An optional footer per photo (e.g. "Vote B") lets screens vote from full screen.
// No native deps (PanResponder + Animated), so it works the same on Android and on the web build.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  PanResponder,
  Animated,
  StatusBar,
  ActivityIndicator,
  useWindowDimensions,
  GestureResponderEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';

export interface ViewerPhoto {
  uri: string;
  label?: string; // shown above the photo, e.g. "B · Red shirt"
}

interface Props {
  visible: boolean;
  photos: ViewerPhoto[];
  index?: number; // photo shown first
  onClose: () => void;
  renderFooter?: (index: number) => React.ReactNode;
}

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const HEADER_H = 52;
const FOOTER_H = 92;

// ── One zoomable photo ────────────────────────────────────────────────────
function ZoomableImage({
  uri,
  width,
  height,
  active,
  onZoomChange,
}: {
  uri: string;
  width: number;
  height: number;
  active: boolean;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  // Gesture state lives in a ref so the PanResponder (created once) always sees the latest values
  const g = useRef({ scale: 1, x: 0, y: 0, startDist: 0, startScale: 1, startX: 0, startY: 0, pinching: false, lastTap: 0 })
    .current;
  const zoomCb = useRef(onZoomChange);
  zoomCb.current = onZoomChange;
  const size = useRef({ width, height });
  size.current = { width, height };

  const clamp = () => {
    const maxX = (size.current.width * (g.scale - 1)) / 2;
    const maxY = (size.current.height * (g.scale - 1)) / 2;
    g.x = Math.max(-maxX, Math.min(maxX, g.x));
    g.y = Math.max(-maxY, Math.min(maxY, g.y));
  };
  const apply = () => {
    scale.setValue(g.scale);
    tx.setValue(g.x);
    ty.setValue(g.y);
  };
  const animateTo = (s: number, x: number, y: number) => {
    g.scale = s;
    g.x = x;
    g.y = y;
    Animated.parallel([
      Animated.spring(scale, { toValue: s, useNativeDriver: true, friction: 7 }),
      Animated.spring(tx, { toValue: x, useNativeDriver: true, friction: 7 }),
      Animated.spring(ty, { toValue: y, useNativeDriver: true, friction: 7 }),
    ]).start();
    zoomCb.current(s > 1.01);
  };

  // Swiped to another photo: this one goes back to normal size
  useEffect(() => {
    if (!active && g.scale !== 1) {
      g.scale = 1;
      g.x = 0;
      g.y = 0;
      apply();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const distance = (e: GestureResponderEvent): number => {
    const t = e.nativeEvent.touches;
    if (!t || t.length < 2) return 0;
    return Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Two fingers = pinch. One finger only when zoomed (otherwise the list swipes to the next photo).
        onStartShouldSetPanResponder: e => (e.nativeEvent.touches?.length || 0) >= 2,
        // Capture a second finger before the photo's tap handler / the list can keep the touch (pinch)
        onStartShouldSetPanResponderCapture: e => (e.nativeEvent.touches?.length || 0) >= 2,
        onMoveShouldSetPanResponderCapture: e => (e.nativeEvent.touches?.length || 0) >= 2,
        onMoveShouldSetPanResponder: (e, s) =>
          (e.nativeEvent.touches?.length || 0) >= 2 || (g.scale > 1.01 && (Math.abs(s.dx) > 3 || Math.abs(s.dy) > 3)),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: e => {
          const d = distance(e);
          g.pinching = d > 0;
          g.startDist = d;
          g.startScale = g.scale;
          g.startX = g.x;
          g.startY = g.y;
        },
        onPanResponderMove: (e, s) => {
          const d = distance(e);
          if (d > 0) {
            if (!g.pinching) {
              g.pinching = true;
              g.startDist = d;
              g.startScale = g.scale;
            }
            g.scale = Math.max(1, Math.min(MAX_SCALE, (g.startScale * d) / Math.max(1, g.startDist)));
            // keep the pan offset where it was when the pinch started
            g.startX = g.x - s.dx;
            g.startY = g.y - s.dy;
          } else {
            g.pinching = false;
            g.x = g.startX + s.dx;
            g.y = g.startY + s.dy;
          }
          clamp();
          apply();
        },
        onPanResponderRelease: () => {
          g.pinching = false;
          if (g.scale <= 1.01) animateTo(1, 0, 0);
          else zoomCb.current(true);
        },
        onPanResponderTerminate: () => {
          g.pinching = false;
          if (g.scale <= 1.01) animateTo(1, 0, 0);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Double-tap: zoom in / back out
  const onTap = () => {
    const now = Date.now();
    if (now - g.lastTap < 300) {
      g.lastTap = 0;
      if (g.scale > 1.01) animateTo(1, 0, 0);
      else animateTo(DOUBLE_TAP_SCALE, 0, 0);
    } else {
      g.lastTap = now;
    }
  };

  return (
    <View style={{ width, height }} {...responder.panHandlers}>
      <TouchableWithoutFeedback onPress={onTap}>
        <Animated.View
          style={[
            styles.zoomBox,
            { width, height, transform: [{ translateX: tx }, { translateY: ty }, { scale }] },
          ]}>
          <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
}

// ── Viewer ────────────────────────────────────────────────────────────────
export default function FullScreenImageViewer({ visible, photos, index = 0, onClose, renderFooter }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ViewerPhoto>>(null);
  const [page, setPage] = useState(index);
  const [zoomed, setZoomed] = useState(false);
  const [ready, setReady] = useState(false);

  const start = Math.max(0, Math.min(index, photos.length - 1));
  useEffect(() => {
    if (visible) {
      setPage(start);
      setZoomed(false);
      setReady(false);
      // Let the modal lay out before showing the list (avoids a flash of photo A)
      const t = setTimeout(() => setReady(true), 30);
      return () => clearTimeout(t);
    }
  }, [visible, start]);

  const hasFooter = !!renderFooter;
  const imageH = Math.max(200, height - insets.top - insets.bottom - HEADER_H - (hasFooter ? FOOTER_H : 0));
  const many = photos.length > 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    if (p !== page && p >= 0 && p < photos.length) {
      setPage(p);
      setZoomed(false);
    }
  };

  const go = (p: number) => {
    if (p < 0 || p >= photos.length) return;
    listRef.current?.scrollToIndex({ index: p, animated: true });
    setPage(p);
    setZoomed(false);
  };

  const current = photos[page];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {current?.label || ''}
          </Text>
          <Text style={styles.counter}>{many ? `${page + 1} / ${photos.length}` : ''}</Text>
        </View>

        <View style={{ height: imageH }}>
          {visible && ready && photos.length ? (
            <FlatList
              ref={listRef}
              data={photos}
              horizontal
              pagingEnabled
              scrollEnabled={many && !zoomed}
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={start}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              keyExtractor={(_, i) => String(i)}
              onScroll={onScroll}
              scrollEventThrottle={32}
              renderItem={({ item, index: i }) => (
                <ZoomableImage
                  uri={item.uri}
                  width={width}
                  height={imageH}
                  active={i === page}
                  onZoomChange={z => i === page && setZoomed(z)}
                />
              )}
            />
          ) : (
            <ActivityIndicator style={styles.spinner} color={colors.textInverse} />
          )}
          {many && page > 0 ? (
            <TouchableOpacity style={[styles.arrow, styles.arrowLeft]} onPress={() => go(page - 1)} accessibilityLabel="Previous photo">
              <Text style={styles.arrowText}>‹</Text>
            </TouchableOpacity>
          ) : null}
          {many && page < photos.length - 1 ? (
            <TouchableOpacity style={[styles.arrow, styles.arrowRight]} onPress={() => go(page + 1)} accessibilityLabel="Next photo">
              <Text style={styles.arrowText}>›</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {many ? (
          <View style={styles.dots}>
            {photos.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
            ))}
          </View>
        ) : null}
        {hasFooter ? <View style={styles.footer}>{renderFooter!(page)}</View> : null}
      </View>
    </Modal>
  );
}

// ── Vote / action bar for the viewer footer ───────────────────────────────
interface VoteBarProps {
  label: string; // button text, e.g. "Vote B" / "✓ You voted B"
  info?: string; // e.g. "40% · 2 votes"
  active?: boolean; // my current choice
  busy?: boolean;
  onPress?: () => void; // omit for read-only (e.g. the owner's tally)
}

export function ViewerVoteBar({ label, info, active, busy, onPress }: VoteBarProps) {
  return (
    <View style={styles.voteBar}>
      {onPress ? (
        <TouchableOpacity
          style={[styles.voteBtn, active && styles.voteBtnOn]}
          onPress={onPress}
          disabled={busy}
          accessibilityRole="button"
          activeOpacity={0.8}>
          {busy ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={[styles.voteBtnText, active && styles.voteBtnTextOn]}>{label}</Text>
          )}
        </TouchableOpacity>
      ) : (
        <Text style={styles.voteReadOnly}>{label}</Text>
      )}
      {info ? <Text style={styles.voteInfo}>{info}</Text> : null}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  header: { height: HEADER_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#FFFFFF', fontSize: 18, fontWeight: fontWeight.bold },
  title: { flex: 1, color: '#FFFFFF', fontSize: fontSize.base, fontWeight: fontWeight.bold, marginHorizontal: spacing.md },
  counter: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.sm, minWidth: 44, textAlign: 'right' },
  zoomBox: { alignItems: 'center', justifyContent: 'center' },
  spinner: { marginTop: spacing.xxl },
  arrow: {
    position: 'absolute',
    top: '45%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLeft: { left: 8 },
  arrowRight: { right: 8 },
  arrowText: { color: '#FFFFFF', fontSize: 30, lineHeight: 32, fontWeight: fontWeight.bold },
  dots: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)', marginHorizontal: 3 },
  dotOn: { backgroundColor: '#FFFFFF' },
  footer: { minHeight: FOOTER_H - 14, justifyContent: 'center', paddingHorizontal: spacing.xl },
  voteBar: { alignItems: 'center' },
  voteBtn: {
    minWidth: 180,
    height: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteBtnOn: { backgroundColor: colors.accent },
  voteBtnText: { color: '#1A1040', fontWeight: fontWeight.extraBold, fontSize: fontSize.base },
  voteBtnTextOn: { color: '#FFFFFF' },
  voteReadOnly: { color: '#FFFFFF', fontWeight: fontWeight.bold, fontSize: fontSize.base },
  voteInfo: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.sm, marginTop: 6 },
}));
