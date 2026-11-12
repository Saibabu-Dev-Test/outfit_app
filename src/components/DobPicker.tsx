// Date of birth picker with no native deps: year -> month -> day in three SelectModal steps.
// Value is 'YYYY-MM-DD'. Also exports DobRequiredModal: the one-time blocking prompt on Home
// for older accounts that have no date of birth (mirrors the mandatory gender prompt).
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SelectModal from './SelectModal';
import { themedStyles, colors } from '../theme';
import { isValidDob } from '../utils/age';
import { formatDate } from '../utils/formatDate';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Stored 'YYYY-MM-DD' -> shown 'DD-MM-YYYY'
export const formatDob = (dob?: string | null): string => (/^\d{4}-\d{2}-\d{2}$/.test(dob || '') ? formatDate(dob) : '');

interface FieldProps {
  value: string;
  onChange: (dob: string) => void;
  disabled?: boolean;
  boxStyle?: any;
  valueStyle?: any;
  placeholderStyle?: any;
}

export function DobField({ value, onChange, disabled, boxStyle, valueStyle, placeholderStyle }: FieldProps) {
  const [step, setStep] = useState<'none' | 'year' | 'month' | 'day'>('none');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState(0);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 116 }, (_, i) => String(thisYear - 5 - i));
  const daysIn = year && month ? new Date(Number(year), month, 0).getDate() : 31;
  const days = Array.from({ length: daysIn }, (_, i) => String(i + 1));
  return (
    <>
      <TouchableOpacity
        style={boxStyle || styles.box}
        onPress={() => setStep('year')}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityLabel="Date of birth">
        <Text style={value ? valueStyle || styles.value : placeholderStyle || styles.placeholder}>
          {value ? formatDob(value) : 'Select date of birth'}
        </Text>
        <Text style={styles.chev}>▾</Text>
      </TouchableOpacity>
      <SelectModal
        visible={step === 'year'}
        title="Year of birth"
        options={years}
        selected={value ? value.slice(0, 4) : null}
        onSelect={y => {
          setYear(y);
          setTimeout(() => setStep('month'), 250);
        }}
        onClose={() => setStep(s => (s === 'year' ? 'none' : s))}
      />
      <SelectModal
        visible={step === 'month'}
        title="Month"
        options={MONTHS}
        onSelect={m => {
          setMonth(MONTHS.indexOf(m) + 1);
          setTimeout(() => setStep('day'), 250);
        }}
        onClose={() => setStep(s => (s === 'month' ? 'none' : s))}
      />
      <SelectModal
        visible={step === 'day'}
        title="Day"
        options={days}
        onSelect={d => {
          const dob = `${year}-${String(month).padStart(2, '0')}-${d.padStart(2, '0')}`;
          if (isValidDob(dob)) onChange(dob);
          setStep('none');
        }}
        onClose={() => setStep(s => (s === 'day' ? 'none' : s))}
      />
    </>
  );
}

export function DobRequiredModal({ visible, onSave }: { visible: boolean; onSave: (dob: string) => Promise<void> }) {
  const [dob, setDob] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Your date of birth</Text>
          <Text style={styles.body}>
            Date of birth is now required. Your age is shown beside your name, and it personalises outfit and astrology suggestions.
          </Text>
          <DobField value={dob} onChange={d => { setDob(d); setErr(''); }} disabled={saving} />
          {!!err && <Text style={styles.err}>{err}</Text>}
          <TouchableOpacity
            style={[styles.btn, (!dob || saving) && styles.btnOff]}
            disabled={!dob || saving}
            onPress={async () => {
              setSaving(true);
              try {
                await onSave(dob);
              } catch {
                setErr('Could not save. Check your connection and try again.');
              } finally {
                setSaving(false);
              }
            }}>
            <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background, height: 52, paddingHorizontal: 14 },
  value: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  placeholder: { fontSize: 15, color: colors.textMuted },
  chev: { fontSize: 12, color: colors.textSecondary },
  overlay: { flex: 1, backgroundColor: 'rgba(10,25,64,0.55)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 18 },
  title: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: 6 },
  body: { fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 19 },
  err: { color: colors.error, fontSize: 12, marginTop: 8 },
  btn: { marginTop: 16, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnOff: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
}));
