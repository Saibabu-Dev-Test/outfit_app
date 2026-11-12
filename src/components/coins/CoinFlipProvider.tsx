// Global coin flip overlay, mounted once at the app root. Any award calls showCoinFlip()
// (services/coinBus). Every award gets its own flip: awards are queued and played one after
// another (~1.4 s slow spin that lands on the coin sound's settle ring + ~1 s text). When more than 3 are waiting the rest play faster so a run
// of likes never lags behind. Non-blocking (pointerEvents none), the flip runs on the UI thread
// (Reanimated), the coin sound plays at flip start, and an error here never reaches the app.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { CoinTier, tierFor, tierLabel } from '../../config/coins';
import { CoinFlipEvent, onCoinFlip } from '../../services/coinBus';
import { playCoinSound } from '../../native/coinSound';
import Coin, { CoinFace } from './Coin';
import CoinRain from './CoinRain';
import { isSafeMode } from '../../native/safeMode';

// Matches res/raw/coin_flip.ogg (1.8 s small-coin clinks; settle ring at ~1.34 s, then it rings out)
const FLIP_MS = 1400;
const HOLD_MS = 1000;
const FADE_MS = 150;
const FAST_AFTER = 3; // more than this many waiting: play the rest faster
const FAST_FACTOR = 0.45;
const MAX_QUEUE = 30; // safety cap; oldest extra flips are dropped
const COIN_SIZE = 64; // small coin (was 96)
const TOSS = 44; // toss height, scaled with the smaller coin (was 60)

interface Shown {
  earned: number;
  total: number;
  tier: CoinTier;
  fromTier: CoinTier;
  face: CoinFace;
  caption?: string;
}

class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: any) {
    console.warn('Coin flip overlay failed:', e?.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function CoinFlipOverlay() {
  const [shown, setShown] = useState<Shown | null>(null);
  const queue = useRef<Shown[]>([]);
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const rotate = useSharedValue(0);
  const lift = useSharedValue(0);
  const opacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  const coinStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { translateY: lift.value }, { rotateY: `${rotate.value}deg` }],
  }));
  const wrapStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  useEffect(() => {
    const later = (ms: number, fn: () => void) => {
      const id = setTimeout(() => {
        timers.current = timers.current.filter(t => t !== id);
        fn();
      }, ms);
      timers.current.push(id);
    };

    const play = () => {
      try {
        const next = queue.current.shift();
        if (!next) {
          busy.current = false;
          setShown(null);
          return;
        }
        busy.current = true;
        // Long queue: speed up this flip and the ones after it
        const k = queue.current.length >= FAST_AFTER ? FAST_FACTOR : 1;
        const flip = Math.round(FLIP_MS * k);
        const hold = Math.round(HOLD_MS * k);
        const fade = Math.round(FADE_MS * k);
        setShown(next);
        playCoinSound();
        cancelAnimation(rotate);
        cancelAnimation(lift);
        rotate.value = 0;
        lift.value = 0;
        textOpacity.value = 0;
        opacity.value = withTiming(1, { duration: 80 });
        // 3 full turns slowing down like a settling coin, ending face on, with a small toss
        rotate.value = withTiming(1080, { duration: flip, easing: Easing.out(Easing.cubic) });
        lift.value = withSequence(
          withTiming(-TOSS, { duration: flip / 2, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: flip / 2, easing: Easing.in(Easing.quad) }),
        );
        later(Math.max(0, flip - 80), () => {
          textOpacity.value = withTiming(1, { duration: 120 });
        });
        later(flip + hold, () => {
          // Another flip waiting: go straight to it (no fade gap)
          if (queue.current.length) {
            play();
            return;
          }
          opacity.value = withTiming(0, { duration: fade });
          later(fade + 20, play);
        });
      } catch (e: any) {
        console.warn('coin flip failed:', e?.message);
        queue.current = [];
        busy.current = false;
        setShown(null);
      }
    };

    const off = onCoinFlip((e: CoinFlipEvent) => {
      try {
        const earned = Math.max(0, Number(e?.earned) || 0);
        const total = Math.max(0, Number(e?.total) || 0);
        const caption = typeof e?.caption === 'string' ? e.caption.slice(0, 60) : undefined;
        if (!earned && !caption) return;
        const tier = tierFor(total);
        queue.current.push({ earned, total, tier, fromTier: tierFor(total - earned), face: e?.face || tier, caption });
        if (queue.current.length > MAX_QUEUE) queue.current.splice(0, queue.current.length - MAX_QUEUE);
        if (!busy.current) {
          busy.current = true;
          later(0, play);
        }
      } catch {}
    });

    return () => {
      off();
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [rotate, lift, opacity, textOpacity]);

  if (!shown) return null;
  const levelUp = shown.tier !== shown.fromTier;
  return (
    <Animated.View pointerEvents="none" style={[styles.fill, wrapStyle]}>
      <View style={styles.card}>
        <Animated.View style={coinStyle}>
          <Coin tier={shown.face} size={COIN_SIZE} />
        </Animated.View>
        <Animated.View style={[styles.texts, textStyle]}>
          {shown.caption ? <Text style={styles.caption}>{shown.caption}</Text> : null}
          {shown.earned ? (
            <>
              <Text style={styles.earned}>+{shown.earned} {shown.earned === 1 ? 'coin' : 'coins'}</Text>
              <Text style={styles.total}>
                Total: {shown.total.toLocaleString()} · {tierLabel(shown.tier)}
              </Text>
              {levelUp ? <Text style={styles.level}>Level up! {tierLabel(shown.tier)}</Text> : null}
            </>
          ) : null}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default function CoinFlipProvider({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      {children}
      {/* Start-up safe mode: no animated overlay (coins are still awarded) */}
      {isSafeMode() ? null : (
        <>
          <CoinRain />
          <Boundary>
            <CoinFlipOverlay />
          </Boundary>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 9999, elevation: 9999 },
  card: { alignItems: 'center', paddingTop: 90, paddingBottom: 18, paddingHorizontal: 22 },
  texts: { alignItems: 'center', marginTop: 14, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 18 },
  earned: { color: '#FFD95A', fontSize: 22, fontWeight: '800' },
  caption: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginBottom: 2 },
  total: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginTop: 2 },
  level: { color: '#7FE7FF', fontSize: 14, fontWeight: '800', marginTop: 4 },
});
