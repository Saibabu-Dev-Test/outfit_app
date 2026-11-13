// Like coins flipping together, opened from a like notification
// ("🪙 Gold coin likes! 12 people liked your photos"). One small coin per person (max 20), each in
// the level's colours (Bronze / Silver / Gold / Diamond). All coins flip AT THE SAME TIME with the
// same slow-motion 4 s flip as the award overlay (CoinFlipProvider) and the coin sound plays ONCE at
// the start (Settings switch + volume respected). Visual only: no coins are awarded here.
// Non-blocking (pointerEvents none), Reanimated on the UI thread, and any error just hides it.
import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { likeLevelLabel } from '../../config/likeLevels';
import { CoinRainBusEvent, onCoinRain, showCoinRain } from '../../services/coinBus';
import { decodeCoinRain, rainCoinCount } from '../../services/likeCoins';
import { consumeLaunchPayload } from '../../native/notifications';
import { playCoinSound } from '../../native/coinSound';
import Coin from './Coin';

const FLIP_MS = 4000; // same slow-motion flip as CoinFlipProvider (matches the 4 s coin sound)
const HOLD_MS = 1000;
const FADE_MS = 200;
const COIN = 36; // small coins
const TOSS = 28;
const PER_ROW = 5;

// One coin: 3 full turns slowing down like a settling coin, with a small toss (all start together)
function BurstCoin({ e }: { e: CoinRainBusEvent }) {
  const rotate = useSharedValue(0);
  const lift = useSharedValue(0);
  useEffect(() => {
    rotate.value = withTiming(1080, { duration: FLIP_MS, easing: Easing.out(Easing.cubic) });
    lift.value = withSequence(
      withTiming(-TOSS, { duration: FLIP_MS / 2, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: FLIP_MS / 2, easing: Easing.in(Easing.quad) }),
    );
  }, [rotate, lift]);
  const style = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { translateY: lift.value }, { rotateY: `${rotate.value}deg` }],
  }));
  return (
    <Animated.View style={[styles.coin, style]}>
      <Coin tier={e.level} size={COIN} />
    </Animated.View>
  );
}

function CoinRainOverlay() {
  const [shown, setShown] = useState<{ e: CoinRainBusEvent; key: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const opacity = useSharedValue(0);
  const wrapStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    const off = onCoinRain(e => {
      try {
        clear();
        setShown({ e: { level: e.level, count: e.count }, key: Date.now() });
        opacity.value = withTiming(1, { duration: 80 });
        // One coin sound for the whole burst (never N overlapping sounds)
        playCoinSound();
        timers.current.push(
          setTimeout(() => {
            opacity.value = withTiming(0, { duration: FADE_MS });
          }, FLIP_MS + HOLD_MS),
        );
        timers.current.push(setTimeout(() => setShown(null), FLIP_MS + HOLD_MS + FADE_MS + 50));
      } catch {
        setShown(null);
      }
    });
    // Opened from a like notification: its payload says which coins to flip
    const check = () => {
      consumeLaunchPayload()
        .then(raw => {
          const e = decodeCoinRain(raw);
          if (e) showCoinRain(e);
        })
        .catch(() => undefined);
    };
    const first = setTimeout(check, 900); // after the first screen is up
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') setTimeout(check, 300);
    });
    return () => {
      off();
      clear();
      clearTimeout(first);
      sub.remove();
    };
  }, [opacity]);

  if (!shown) return null;
  const n = rainCoinCount(shown.e.count);
  const lbl = likeLevelLabel(shown.e.level);
  return (
    <Animated.View pointerEvents="none" style={[styles.fill, wrapStyle]}>
      <View style={[styles.grid, { width: Math.min(n, PER_ROW) * (COIN + 14) }]}>
        {Array.from({ length: n }, (_, i) => (
          <BurstCoin key={`${shown.key}_${i}`} e={shown.e} />
        ))}
      </View>
      <View style={styles.label}>
        <Text style={styles.labelText}>
          🪙 {shown.e.count.toLocaleString()} {lbl} coin {shown.e.count === 1 ? 'like' : 'likes'}!
        </Text>
      </View>
    </Animated.View>
  );
}

class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: any) {
    console.warn('Coin rain failed:', e?.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function CoinRain() {
  return (
    <Boundary>
      <CoinRainOverlay />
    </Boundary>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 9998, elevation: 9998 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingTop: 60 },
  coin: { margin: 7 },
  label: { alignItems: 'center', marginTop: 14 },
  labelText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
});
