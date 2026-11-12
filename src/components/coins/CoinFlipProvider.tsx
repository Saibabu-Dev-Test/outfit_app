// Global coin flip overlay, mounted once at the app root. Any award calls showCoinFlip()
// (services/coinBus). Non-blocking (pointerEvents none), merges rapid awards into one flip,
// the flip runs on the UI thread (Reanimated), and an error here never reaches the app.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { CoinTier, tierFor, tierLabel } from '../../config/coins';
import { CoinFlipEvent, onCoinFlip } from '../../services/coinBus';
import Coin from './Coin';

const FLIP_MS = 900;
const HOLD_MS = 1500;
const FADE_MS = 300;
const MERGE_MS = 250; // awards this close together become one flip

interface Shown {
  earned: number;
  total: number;
  tier: CoinTier;
  fromTier: CoinTier;
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
  const pending = useRef<Shown | null>(null);
  const current = useRef<Shown | null>(null);
  const phase = useRef<'idle' | 'show' | 'fade'>('idle');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mergeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      timers.current.push(setTimeout(fn, ms));
    };

    const play = () => {
      try {
        const next = pending.current;
        pending.current = null;
        if (!next) {
          phase.current = 'idle';
          setShown(null);
          return;
        }
        current.current = next;
        phase.current = 'show';
        setShown({ ...next });
        cancelAnimation(rotate);
        rotate.value = 0;
        lift.value = 0;
        textOpacity.value = 0;
        opacity.value = withTiming(1, { duration: 120 });
        // 3 full turns, ending face on, with a small toss
        rotate.value = withTiming(1080, { duration: FLIP_MS, easing: Easing.out(Easing.cubic) });
        lift.value = withSequence(
          withTiming(-70, { duration: FLIP_MS / 2, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: FLIP_MS / 2, easing: Easing.in(Easing.quad) }),
        );
        later(FLIP_MS - 100, () => {
          textOpacity.value = withTiming(1, { duration: 200 });
        });
        later(FLIP_MS + HOLD_MS, () => {
          phase.current = 'fade';
          opacity.value = withTiming(0, { duration: FADE_MS });
        });
        later(FLIP_MS + HOLD_MS + FADE_MS + 20, () => {
          current.current = null;
          play(); // next queued award, or hide
        });
      } catch (e: any) {
        console.warn('coin flip failed:', e?.message);
        phase.current = 'idle';
        setShown(null);
      }
    };

    const off = onCoinFlip((e: CoinFlipEvent) => {
      try {
        const earned = Math.max(0, Number(e?.earned) || 0);
        const total = Math.max(0, Number(e?.total) || 0);
        if (!earned) return;
        // Still showing: add to the coin on screen
        if (phase.current === 'show' && current.current) {
          const c = current.current;
          c.earned += earned;
          c.total = Math.max(c.total, total);
          c.tier = tierFor(c.total);
          setShown({ ...c });
          return;
        }
        const p = pending.current;
        if (p) {
          p.earned += earned;
          p.total = Math.max(p.total, total);
          p.tier = tierFor(p.total);
        } else {
          pending.current = { earned, total, tier: tierFor(total), fromTier: tierFor(total - earned) };
        }
        if (phase.current === 'idle' && !mergeTimer.current) {
          mergeTimer.current = setTimeout(() => {
            mergeTimer.current = null;
            play();
          }, MERGE_MS);
        }
      } catch {}
    });

    const pendingTimers = timers.current;
    return () => {
      off();
      if (mergeTimer.current) clearTimeout(mergeTimer.current);
      pendingTimers.forEach(clearTimeout);
    };
  }, [rotate, lift, opacity, textOpacity]);

  if (!shown) return null;
  const levelUp = shown.tier !== shown.fromTier;
  return (
    <Animated.View pointerEvents="none" style={[styles.fill, wrapStyle]}>
      <View style={styles.card}>
        <Animated.View style={coinStyle}>
          <Coin tier={shown.tier} size={96} />
        </Animated.View>
        <Animated.View style={[styles.texts, textStyle]}>
          <Text style={styles.earned}>+{shown.earned} {shown.earned === 1 ? 'coin' : 'coins'}</Text>
          <Text style={styles.total}>
            Total: {shown.total.toLocaleString()} · {tierLabel(shown.tier)}
          </Text>
          {levelUp ? <Text style={styles.level}>Level up! {tierLabel(shown.tier)}</Text> : null}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default function CoinFlipProvider({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      {children}
      <Boundary>
        <CoinFlipOverlay />
      </Boundary>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 9999, elevation: 9999 },
  card: { alignItems: 'center', paddingTop: 90, paddingBottom: 18, paddingHorizontal: 22 },
  texts: { alignItems: 'center', marginTop: 14, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 18 },
  earned: { color: '#FFD95A', fontSize: 22, fontWeight: '800' },
  total: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginTop: 2 },
  level: { color: '#7FE7FF', fontSize: 14, fontWeight: '800', marginTop: 4 },
});
