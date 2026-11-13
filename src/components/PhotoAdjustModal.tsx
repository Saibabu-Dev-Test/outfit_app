// "Adjust" photo option: zoom in / out (pinch, double-tap or − / ＋) and drag the photo inside a
// frame; Apply returns the visible part as a crop (fractions 0..1, utils/cropMath.ts), which is
// cut from the processed photo (after Blur / Remove BG / Blur face) before upload.
// Pure JS (PanResponder + Animated) like ZoomableImage, so it needs no native gesture setup.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  GestureResponderEvent,
  Image,
  Modal,
  PanResponder,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AdjustView,
  FRAME_ASPECTS,
  FrameAspect,
  NormCrop,
  aspectRatio,
  clampView,
  coverScale,
  cropRect,
  doubleTapView,
  frameSize,
  pinchView,
} from '../utils/cropMath';
import { AppLanguage } from '../i18n/appLanguage';
import { photoText } from '../i18n/photoEditLabels';

/** What the Adjust screen remembers, so reopening it shows the same framing. */
export interface AdjustState {
  aspect: FrameAspect;
  zoom: number;
  // pan as a fraction of the frame size (survives a different screen size)
  fx: number;
  fy: number;
  crop: NormCrop;
}

interface Props {
  visible: boolean;
  uri: string | null; // the processed photo shown in the frame
  initial?: AdjustState | null;
  lang?: AppLanguage;
  onCancel: () => void;
  onApply: (state: AdjustState) => void;
}

const DOUBLE_TAP_MS = 280;

const touchDistance = (e: GestureResponderEvent): number => {
  const t = e.nativeEvent.touches;
  if (!t || t.length < 2) return 0;
  return Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
};

export default function PhotoAdjustModal({ visible, uri, initial, lang, onCancel, onApply }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [aspect, setAspect] = useState<FrameAspect>(initial?.aspect || 'photo');

  // Image size (needed for the cover / crop maths)
  useEffect(() => {
    if (!visible || !uri) return;
    let alive = true;
    setSize(null);
    setAspect(initial?.aspect || 'photo');
    Image.getSize(
      uri,
      (w, h) => alive && setSize({ w, h }),
      () => alive && setSize({ w: 1000, h: 1250 }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, uri]);

  const maxW = winW - 32;
  const maxH = Math.max(200, winH - insets.top - insets.bottom - 250);
  const frame = size ? frameSize(aspectRatio(aspect, size.w, size.h), maxW, maxH) : { width: maxW, height: maxH };
  const cover = size ? coverScale(size.w, size.h, frame.width, frame.height) : 1;
  const baseW = size ? size.w * cover : frame.width;
  const baseH = size ? size.h * cover : frame.height;

  const scaleV = useRef(new Animated.Value(1)).current;
  const txV = useRef(new Animated.Value(0)).current;
  const tyV = useRef(new Animated.Value(0)).current;
  const view = useRef<AdjustView>({ zoom: 1, tx: 0, ty: 0 });
  const start = useRef({ view: { zoom: 1, tx: 0, ty: 0 } as AdjustView, dist: 0, touches: 0, dx: 0, dy: 0 });
  const lastTap = useRef(0);
  const moved = useRef(false);
  const geo = useRef({ iw: 1, ih: 1, fw: 1, fh: 1 });
  geo.current = { iw: size?.w || 1, ih: size?.h || 1, fw: frame.width, fh: frame.height };
  const origin = useRef({ x: 0, y: 0 });
  const frameRef = useRef<any>(null);

  const setView = (v: AdjustView, animate = false) => {
    const g = geo.current;
    const c = clampView(v, g.iw, g.ih, g.fw, g.fh);
    view.current = c;
    if (animate) {
      Animated.parallel([
        Animated.spring(scaleV, { toValue: c.zoom, useNativeDriver: false, friction: 7 }),
        Animated.spring(txV, { toValue: c.tx, useNativeDriver: false, friction: 7 }),
        Animated.spring(tyV, { toValue: c.ty, useNativeDriver: false, friction: 7 }),
      ]).start();
    } else {
      scaleV.setValue(c.zoom);
      txV.setValue(c.tx);
      tyV.setValue(c.ty);
    }
  };

  // Start from the saved framing (same aspect) or centred at zoom 1
  useEffect(() => {
    if (!visible || !size) return;
    const same = initial && initial.aspect === aspect;
    setView(
      same
        ? { zoom: initial!.zoom, tx: initial!.fx * frame.width, ty: initial!.fy * frame.height }
        : { zoom: 1, tx: 0, ty: 0 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, size, aspect, frame.width, frame.height]);

  const begin = (e: GestureResponderEvent, dx: number, dy: number) => {
    start.current = { view: { ...view.current }, dist: touchDistance(e), touches: e.nativeEvent.touches?.length || 1, dx, dy };
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (e, g) => {
          moved.current = false;
          begin(e, g.dx, g.dy);
        },
        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches?.length || 1;
          if (touches !== start.current.touches) begin(e, g.dx, g.dy);
          if (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6) moved.current = true;
          const ddx = g.dx - start.current.dx;
          const ddy = g.dy - start.current.dy;
          if (touches >= 2 && start.current.dist > 0) {
            moved.current = true;
            setView(pinchView(start.current.view, touchDistance(e) / start.current.dist, ddx, ddy));
          } else {
            const s = start.current.view;
            setView({ zoom: s.zoom, tx: s.tx + ddx, ty: s.ty + ddy });
          }
        },
        onPanResponderRelease: e => {
          if (moved.current) return;
          const now = Date.now();
          if (now - lastTap.current < DOUBLE_TAP_MS) {
            lastTap.current = 0;
            const g = geo.current;
            const px = e.nativeEvent.pageX - origin.current.x;
            const py = e.nativeEvent.pageY - origin.current.y;
            const inside = px >= 0 && py >= 0 && px <= g.fw && py <= g.fh;
            setView(doubleTapView(view.current, inside ? px : g.fw / 2, inside ? py : g.fh / 2, g.fw, g.fh), true);
          } else {
            lastTap.current = now;
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const zoomBy = (k: number) => setView(pinchView(view.current, k), true);

  const apply = () => {
    const g = geo.current;
    const v = view.current;
    onApply({
      aspect,
      zoom: v.zoom,
      fx: g.fw ? v.tx / g.fw : 0,
      fy: g.fh ? v.ty / g.fh : 0,
      crop: cropRect(g.iw, g.ih, g.fw, g.fh, v),
    });
  };

  const aspectLabel = (a: FrameAspect) => (a === 'photo' ? photoText('aspectPhoto', lang) : a);

  if (!visible) return null;
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <StatusBar barStyle="light-content" {...(Platform.OS === 'android' ? { backgroundColor: '#000' } : {})} />
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.headerBtn}>{photoText('cancel', lang)}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{photoText('adjustTitle', lang)}</Text>
          <TouchableOpacity onPress={apply} disabled={!size} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.headerBtn, styles.applyText]}>{photoText('apply', lang)}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stage}>
          {uri && size ? (
            <View
              ref={frameRef}
              onLayout={() =>
                frameRef.current?.measureInWindow((x: number, y: number) => {
                  origin.current = { x, y };
                })
              }
              style={[styles.frame, { width: frame.width, height: frame.height }]}
              {...responder.panHandlers}>
              <Animated.View
                style={[
                  styles.abs,
                  {
                    left: (frame.width - baseW) / 2,
                    top: (frame.height - baseH) / 2,
                    width: baseW,
                    height: baseH,
                    transform: [{ translateX: txV }, { translateY: tyV }, { scale: scaleV }],
                  },
                ]}>
                <Image source={{ uri }} style={{ width: baseW, height: baseH }} resizeMode="stretch" />
              </Animated.View>
              {/* Frame guides (rule of thirds) */}
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <View style={[styles.guideV, { left: frame.width / 3 }]} />
                <View style={[styles.guideV, { left: (frame.width * 2) / 3 }]} />
                <View style={[styles.guideH, { top: frame.height / 3 }]} />
                <View style={[styles.guideH, { top: (frame.height * 2) / 3 }]} />
              </View>
            </View>
          ) : (
            <ActivityIndicator color="#FFF" />
          )}
        </View>

        <Text style={styles.hint}>{photoText('adjustHint', lang)}</Text>
        <View style={styles.row}>
          {FRAME_ASPECTS.map(a => (
            <TouchableOpacity key={a} style={[styles.chip, aspect === a && styles.chipOn]} onPress={() => setAspect(a)}>
              <Text style={[styles.chipText, aspect === a && styles.chipTextOn]}>{aspectLabel(a)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.row}>
          <TouchableOpacity style={styles.round} onPress={() => zoomBy(1 / 1.25)} accessibilityLabel="Zoom out">
            <Text style={styles.roundText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={() => setView({ zoom: 1, tx: 0, ty: 0 }, true)}>
            <Text style={styles.chipText}>{photoText('reset', lang)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.round} onPress={() => zoomBy(1.25)} accessibilityLabel="Zoom in">
            <Text style={styles.roundText}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44 },
  headerBtn: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  applyText: { color: '#A29BFE', fontWeight: '800' },
  title: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
  frame: { overflow: 'hidden', borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#111' },
  guideV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.45)' },
  guideH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.45)' },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', paddingHorizontal: 24, marginTop: 10 },
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 5,
  },
  chipOn: { backgroundColor: '#FFF', borderColor: '#FFF' },
  chipText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: '#1A1040' },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  roundText: { color: '#FFF', fontSize: 22, fontWeight: '700' },
});
