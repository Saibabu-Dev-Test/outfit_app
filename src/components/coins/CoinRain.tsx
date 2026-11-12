// Like coins flipping across the screen, opened from a like notification
// ("🪙 Gold coin likes! 12 people liked your photos"). One coin per person (max 15), each in the
// level's colours (Bronze / Silver / Gold / Diamond), spinning while it falls, with the coin
// flip sound (Settings switch respected). Non-blocking (pointerEvents none), Reanimated on the
// UI thread, and any error just hides it.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { likeLevelLabel } from '../../config/likeLevels';
import { CoinRainBusEvent, onCoinRain, showCoinRain } from '../../services/coinBus';
import { decodeCoinRain, rainCoinCount } from '../../services/likeCoins';
import { consumeLaunchPayload } from '../../native/notifications';
import { playCoinSound } from '../../native/coinSound';
import Coin from './Coin';

const FALL_MS = 2200;
const STAGGER_MS = 170;
const COIN = 36; // small coins (was 56)

function RainCoin({ e, index, width, height }: { e: CoinRainBusEvent; index: number; width: number; height: number }) {
  const y = useSharedValue(-COIN * 2);
  const spin = useSharedValue(0);
  // Spread across the screen (deterministic per index so it never jumps on re-render)
  const x = useMemo(() => {
    const slots = Math.max(1, Math.floor(width / (COIN * 0.9)));
    const col = (index * 7) % slots;
    return Math.min(width - COIN, col * (width / slots) + ((index * 13) % 17));
  }, [index, width]);
  useEffect(() => {
    const delay = index * STAGGER_MS;
    y.value = withDelay(delay, withTiming(height + COIN, { duration: FALL_MS, easing: Easing.in(Easing.quad) }));
    spin.value = withDelay(delay, withRepeat(withTiming(360, { duration: 420, easing: Easing.linear }), -1, false));
  }, [index, height, y, spin]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { perspective: 600 }, { rotateY: `${spin.value}deg` }],
  }));
  return (
    <Animated.View style={[styles.coin, { left: x }, style]}>
      <Coin tier={e.level} size={COIN} />
    </Animated.View>
  );
}

function CoinRainOverlay() {
  const { width, height } = useWindowDimensions();
  const [shown, setShown] = useState<{ e: CoinRainBusEvent; key: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    const off = onCoinRain(e => {
      try {
        clear();
        const n = rainCoinCount(e.count);
        setShown({ e: { level: e.level, count: e.count }, key: Date.now() });
        // The coin sound is a 1.8 s small-coin jingle: start at most 4 (SoundPool plays 4 at once),
        // spread across the rain so it never turns into noise
        const step = Math.max(1, Math.ceil(n / 4));
        for (let i = 0; i < n; i += step) {
          timers.current.push(setTimeout(playCoinSound, i * STAGGER_MS));
        }
        timers.current.push(setTimeout(() => setShown(null), n * STAGGER_MS + FALL_MS + 300));
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
  }, []);

  if (!shown) return null;
  const n = rainCoinCount(shown.e.count);
  const lbl = likeLevelLabel(shown.e.level);
  return (
    <View pointerEvents="none" style={styles.fill}>
      {Array.from({ length: n }, (_, i) => (
        <RainCoin key={`${shown.key}_${i}`} e={shown.e} index={i} width={width} height={height} />
      ))}
      <View style={styles.label}>
        <Text style={styles.labelText}>
          🪙 {shown.e.count.toLocaleString()} {lbl} coin {shown.e.count === 1 ? 'like' : 'likes'}!
        </Text>
      </View>
    </View>
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
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998, elevation: 9998 },
  coin: { position: 'absolute', top: 0 },
  label: { position: 'absolute', top: '42%', left: 0, right: 0, alignItems: 'center' },
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
