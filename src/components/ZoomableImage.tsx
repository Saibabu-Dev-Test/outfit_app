// Full-screen photo viewer: pinch to zoom, double-tap to zoom in/out, drag to pan when zoomed,
// swipe left/right between several photos, ✕ to close (Android back closes too).
// Pure JS (PanResponder + Animated), so it needs no native setup and works the same on the web
// build (arrows and double-click there). Usage:
//   <ZoomableImage visible={!!photos} images={photos || []} initialIndex={0} onClose={() => setPhotos(null)} />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  PanResponderGestureState,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  GestureResponderEvent,
  useWindowDimensions,
} from 'react-native';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 280;

interface Props {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  // Optional caption per photo (e.g. "A · Red dress")
  labels?: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const touchDistance = (e: GestureResponderEvent): number => {
  const t = e.nativeEvent.touches;
  if (!t || t.length < 2) return 0;
  const dx = t[0].pageX - t[1].pageX;
  const dy = t[0].pageY - t[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
};

interface PageProps {
  uri: string;
  width: number;
  height: number;
  active: boolean;
  onZoomChange: (zoomed: boolean) => void;
}

function ZoomPage({ uri, width, height, active, onZoomChange }: PageProps) {
  const scaleV = useRef(new Animated.Value(1)).current;
  const txV = useRef(new Animated.Value(0)).current;
  const tyV = useRef(new Animated.Value(0)).current;
  // Current values (Animated values can't be read synchronously)
  const cur = useRef({ scale: 1, tx: 0, ty: 0 });
  // Values at the start of the current gesture phase
  const start = useRef({ scale: 1, tx: 0, ty: 0, dist: 0, touches: 0, dx: 0, dy: 0 });
  const lastTap = useRef(0);
  const moved = useRef(false);
  const zoomCb = useRef(onZoomChange);
  zoomCb.current = onZoomChange;
  const dims = useRef({ width, height });
  dims.current = { width, height };

  const bounds = (scale: number) => ({
    x: Math.max(0, (dims.current.width * scale - dims.current.width) / 2),
    y: Math.max(0, (dims.current.height * scale - dims.current.height) / 2),
  });

  const apply = (scale: number, tx: number, ty: number, animate: boolean) => {
    const b = bounds(scale);
    const next = { scale, tx: clamp(tx, -b.x, b.x), ty: clamp(ty, -b.y, b.y) };
    const wasZoomed = cur.current.scale > 1.01;
    cur.current = next;
    if (animate) {
      Animated.parallel([
        Animated.spring(scaleV, { toValue: next.scale, useNativeDriver: false, friction: 7 }),
        Animated.spring(txV, { toValue: next.tx, useNativeDriver: false, friction: 7 }),
        Animated.spring(tyV, { toValue: next.ty, useNativeDriver: false, friction: 7 }),
      ]).start();
    } else {
      scaleV.setValue(next.scale);
      txV.setValue(next.tx);
      tyV.setValue(next.ty);
    }
    const isZoomed = next.scale > 1.01;
    if (isZoomed !== wasZoomed) zoomCb.current(isZoomed);
  };

  // Leaving a page resets its zoom
  useEffect(() => {
    if (!active && cur.current.scale !== 1) apply(1, 0, 0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const begin = (e: GestureResponderEvent, g: PanResponderGestureState) => {
    start.current = {
      scale: cur.current.scale,
      tx: cur.current.tx,
      ty: cur.current.ty,
      dist: touchDistance(e),
      touches: e.nativeEvent.touches?.length || 1,
      dx: g.dx,
      dy: g.dy,
    };
  };

  const onDoubleTap = (e: GestureResponderEvent) => {
    if (cur.current.scale > 1.01) {
      apply(1, 0, 0, true);
      return;
    }
    // Zoom towards the tapped point
    const { locationX, locationY } = e.nativeEvent;
    const cx = dims.current.width / 2;
    const cy = dims.current.height / 2;
    const s = DOUBLE_TAP_SCALE;
    apply(s, (cx - (locationX ?? cx)) * (s - 1), (cy - (locationY ?? cy)) * (s - 1), true);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // A second finger always goes to this page (pinch), never to the list behind it
        onMoveShouldSetPanResponderCapture: e => (e.nativeEvent.touches?.length || 0) >= 2,
        onMoveShouldSetPanResponder: (e, g) =>
          (e.nativeEvent.touches?.length || 0) >= 2 ||
          (cur.current.scale > 1.01 && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2)),
        // While zoomed keep the gesture; at 1x let the list take horizontal swipes
        onPanResponderTerminationRequest: () => cur.current.scale <= 1.01,
        onShouldBlockNativeResponder: () => cur.current.scale > 1.01,
        onPanResponderGrant: (e, g) => {
          moved.current = false;
          begin(e, g);
        },
        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches?.length || 1;
          if (touches !== start.current.touches) begin(e, g); // finger added / lifted mid-gesture
          if (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8) moved.current = true;
          const ddx = g.dx - start.current.dx;
          const ddy = g.dy - start.current.dy;
          if (touches >= 2 && start.current.dist > 0) {
            moved.current = true;
            const dist = touchDistance(e);
            const scale = clamp((start.current.scale * dist) / start.current.dist, 0.8, MAX_SCALE);
            const ratio = scale / start.current.scale;
            apply(scale, start.current.tx * ratio + ddx, start.current.ty * ratio + ddy, false);
          } else if (cur.current.scale > 1.01) {
            apply(cur.current.scale, start.current.tx + ddx, start.current.ty + ddy, false);
          }
        },
        onPanResponderRelease: e => {
          if (cur.current.scale < 1.05) {
            apply(1, 0, 0, true);
          }
          if (!moved.current) {
            const now = Date.now();
            if (now - lastTap.current < DOUBLE_TAP_MS) {
              lastTap.current = 0;
              onDoubleTap(e);
            } else {
              lastTap.current = now;
            }
          }
        },
        onPanResponderTerminate: () => {
          if (cur.current.scale < 1.05) apply(1, 0, 0, true);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <View style={{ width, height }} {...responder.panHandlers}>
      <Animated.View
        style={[
          styles.fill,
          { transform: [{ translateX: txV }, { translateY: tyV }, { scale: scaleV }] },
        ]}>
        <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

export default function ZoomableImage({ visible, images, initialIndex = 0, onClose, labels }: Props) {
  const { width, height } = useWindowDimensions();
  const list = useMemo(() => images.filter(Boolean), [images]);
  const startAt = clamp(initialIndex, 0, Math.max(0, list.length - 1));
  const [index, setIndex] = useState(startAt);
  const [zoomed, setZoomed] = useState(false);
  const listRef = useRef<FlatList<string>>(null);

  useEffect(() => {
    if (visible) {
      setIndex(startAt);
      setZoomed(false);
    }
  }, [visible, startAt]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    setIndex(clamp(i, 0, list.length - 1));
  };

  const go = useCallback(
    (i: number) => {
      const next = clamp(i, 0, list.length - 1);
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
    },
    [list.length],
  );

  if (!visible || !list.length) return null;
  const multi = list.length > 1;
  const label = labels?.[index];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" {...(Platform.OS === 'android' ? { backgroundColor: '#000' } : {})} />
      <View style={styles.backdrop}>
        <FlatList
          ref={listRef}
          data={list}
          horizontal
          pagingEnabled
          scrollEnabled={multi && !zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startAt}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(_, i) => String(i)}
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={Platform.OS === 'web' ? onScrollEnd : undefined}
          renderItem={({ item, index: i }) => (
            <ZoomPage uri={item} width={width} height={height} active={i === index} onZoomChange={setZoomed} />
          )}
        />

        <View style={styles.topBar} pointerEvents="box-none">
          <Text style={styles.counter}>{multi ? `${index + 1} / ${list.length}` : ' '}</Text>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityLabel="Close photo"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {multi && Platform.OS === 'web' ? (
          <>
            {index > 0 ? (
              <TouchableOpacity style={[styles.arrow, styles.arrowLeft]} onPress={() => go(index - 1)}>
                <Text style={styles.arrowText}>‹</Text>
              </TouchableOpacity>
            ) : null}
            {index < list.length - 1 ? (
              <TouchableOpacity style={[styles.arrow, styles.arrowRight]} onPress={() => go(index + 1)}>
                <Text style={styles.arrowText}>›</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}

        <View style={styles.bottomBar} pointerEvents="none">
          {label ? <Text style={styles.label}>{label}</Text> : null}
          {multi ? (
            <View style={styles.dots}>
              {list.map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
              ))}
            </View>
          ) : null}
          <Text style={styles.hint}>{zoomed ? 'Double-tap to zoom out' : 'Pinch or double-tap to zoom'}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 44,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  counter: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLeft: { left: 12 },
  arrowRight: { right: 12 },
  arrowText: { color: '#FFF', fontSize: 32, lineHeight: 34 },
  bottomBar: { position: 'absolute', bottom: 28, left: 0, right: 0, alignItems: 'center' },
  label: { color: '#FFF', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  dots: { flexDirection: 'row', marginBottom: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)', marginHorizontal: 3 },
  dotOn: { backgroundColor: '#FFF' },
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
});
