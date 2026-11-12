// Small dependency-free slider (0..1): tap or drag along the track. Used for the coin sound volume.
import React, { useRef, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, themedStyles } from '../theme';

interface Props {
  value: number; // 0..1
  onChange: (v: number) => void; // while dragging
  onCommit?: (v: number) => void; // on release
  label?: string;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export default function VolumeSlider({ value, onChange, onCommit, label = 'Volume' }: Props) {
  const width = useRef(1);
  const [w, setW] = useState(0);
  const last = useRef(value);
  const at = (e: GestureResponderEvent) => clamp(e.nativeEvent.locationX / Math.max(1, width.current));
  const move = (e: GestureResponderEvent) => {
    const v = Math.round(at(e) * 20) / 20; // 5% steps
    last.current = v;
    onChange(v);
  };
  const pct = Math.round(clamp(value) * 100);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        🔊 {label}: {pct}%
      </Text>
      <View
        style={styles.touch}
        onLayout={(e: LayoutChangeEvent) => {
          width.current = e.nativeEvent.layout.width;
          setW(e.nativeEvent.layout.width);
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={move}
        onResponderMove={move}
        onResponderRelease={() => onCommit?.(last.current)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: pct }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={ev => {
          const v = clamp(value + (ev.nativeEvent.actionName === 'increment' ? 0.1 : -0.1));
          onChange(v);
          onCommit?.(v);
        }}>
        <View style={styles.track} pointerEvents="none">
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
        <View pointerEvents="none" style={[styles.thumb, { left: Math.max(0, clamp(value) * w - 11) }]} />
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { paddingTop: 8 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semiBold, color: colors.textSecondary, marginBottom: 4 },
  touch: { height: 32, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.accent },
  thumb: { position: 'absolute', top: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.surface },
}));
