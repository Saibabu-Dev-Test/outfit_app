// Hour (1-12) / minute (00-59) / AM-PM picker built with ScrollViews
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { themedStyles, colors } from '../theme';
import { useBottomSpace } from '../hooks/useBottomSpace';

interface Props {
  visible: boolean;
  value?: string | null; // "07:30 AM"
  onConfirm: (value: string) => void;
  onClose: () => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const PERIODS = ['AM', 'PM'];

export const parseTime = (v?: string | null): { h: number; m: number; p: string } => {
  const match = (v || '').trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!match) return { h: 6, m: 0, p: 'AM' };
  let h = parseInt(match[1], 10);
  const m = Math.min(59, parseInt(match[2], 10));
  let p = (match[3] || '').toUpperCase();
  if (!p) {
    // 24h input
    p = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
  }
  if (h < 1 || h > 12) h = 12;
  return { h, m, p };
};

export const formatTime = (h: number, m: number, p: string) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${p}`;

export default function TimePickerModal({ visible, value, onConfirm, onClose }: Props) {
  const bottomPad = useBottomSpace();
  const [h, setH] = useState(6);
  const [m, setM] = useState(0);
  const [p, setP] = useState('AM');

  useEffect(() => {
    if (visible) {
      const t = parseTime(value);
      setH(t.h);
      setM(t.m);
      setP(t.p);
    }
  }, [visible, value]);

  const col = (items: (string | number)[], sel: string | number, onPick: (v: any) => void, fmt?: (v: any) => string) => (
    <ScrollView style={styles.col} contentContainerStyle={styles.colContent} showsVerticalScrollIndicator>
      {items.map(it => {
        const active = it === sel;
        return (
          <TouchableOpacity
            key={String(it)}
            style={[styles.cell, active && styles.cellActive]}
            onPress={() => onPick(it)}
            activeOpacity={0.8}>
            <Text style={[styles.cellText, active && styles.cellTextActive]}>{fmt ? fmt(it) : String(it)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingBottom: bottomPad }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.sub}>SELECT TIME OF BIRTH</Text>
          <Text style={styles.title}>{formatTime(h, m, p)}</Text>
          <View style={styles.row}>
            <View style={styles.colWrap}>
              <Text style={styles.colLabel}>Hour</Text>
              {col(HOURS, h, setH, v => String(v).padStart(2, '0'))}
            </View>
            <View style={styles.colWrap}>
              <Text style={styles.colLabel}>Minute</Text>
              {col(MINUTES, m, setM, v => String(v).padStart(2, '0'))}
            </View>
            <View style={styles.colWrap}>
              <Text style={styles.colLabel}>AM/PM</Text>
              {col(PERIODS, p, setP)}
            </View>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.okBtn}
              onPress={() => {
                onConfirm(formatTime(h, m, p));
                onClose();
              }}>
              <Text style={styles.okText}>Set Time</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,25,64,0.45)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 18 },
  sub: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginTop: 4, marginBottom: 12 },
  row: { flexDirection: 'row', height: 240 },
  colWrap: { flex: 1, marginHorizontal: 4 },
  colLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textAlign: 'center', marginBottom: 6 },
  col: { flex: 1, backgroundColor: colors.background, borderRadius: 12 },
  colContent: { paddingVertical: 4 },
  cell: { paddingVertical: 10, alignItems: 'center', marginHorizontal: 6, borderRadius: 10 },
  cellActive: { backgroundColor: '#6C5CE7' },
  cellText: { fontSize: 16, color: colors.textPrimary },
  cellTextActive: { color: '#FFFFFF', fontWeight: '800' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelText: { color: colors.textSecondary, fontWeight: '700' },
  okBtn: { backgroundColor: '#6C5CE7', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginLeft: 8 },
  okText: { color: '#FFFFFF', fontWeight: '800' },
}));
