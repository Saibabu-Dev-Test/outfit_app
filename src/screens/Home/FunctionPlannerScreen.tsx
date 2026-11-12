// 📅 Function planner: add / edit / delete functions (name, type, date, time, city, note).
// Each shows when it is, the weather (within 16 days) and outfit ideas; the phone reminds the
// evening before and on the morning (services/functionPlanner.ts).
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { localDateKey } from '../../utils/date';
import {
  FUNCTION_TYPES,
  FunctionType,
  OUTFIT_TIPS,
  PlannedFunction,
  cancelPlanReminders,
  daysUntil,
  deleteFunction,
  isValidDate,
  isValidTime,
  loadFunctions,
  newFunctionId,
  saveFunction,
  syncPlanReminders,
  typeMeta,
  upcomingFunctions,
  whenText,
} from '../../services/functionPlanner';
import { DayWeather, weatherFor, weatherText, weatherTip } from '../../services/weatherApi';

interface Draft {
  id: string | null;
  title: string;
  type: FunctionType;
  date: string;
  time: string;
  city: string;
  note: string;
}

const EMPTY: Draft = { id: null, title: '', type: 'wedding', date: '', time: '', city: '', note: '' };

export default function FunctionPlannerScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const uid = user?.id ? String(user.id) : '';
  const [list, setList] = useState<PlannedFunction[]>([]);
  const [wx, setWx] = useState<Record<string, DayWeather | null>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const today = localDateKey();

  const refresh = useCallback(
    async (l?: PlannedFunction[]) => {
      const all = l || (await loadFunctions(uid));
      const up = upcomingFunctions(all, localDateKey());
      setList(up);
      up.filter(f => f.city && daysUntil(f.date) < 16).forEach(f => {
        weatherFor(f.city, f.date).then(w => setWx(prev => ({ ...prev, [f.id]: w })));
      });
    },
    [uid],
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const save = async () => {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) return Alert.alert('Name it', 'e.g. "Priya\'s wedding" or "Office Diwali party"');
    if (!isValidDate(draft.date)) return Alert.alert('Date', 'Use YYYY-MM-DD, e.g. 2026-12-05');
    if (daysUntil(draft.date) < 0) return Alert.alert('Date', 'That date has already passed.');
    if (draft.time && !isValidTime(draft.time)) return Alert.alert('Time', 'Use 24-hour HH:MM, e.g. 18:30');
    const old = list.find(f => f.id === draft.id);
    if (old) await cancelPlanReminders(old);
    const f: PlannedFunction = {
      id: draft.id || newFunctionId(),
      title: title.slice(0, 60),
      type: draft.type,
      date: draft.date,
      time: draft.time || null,
      city: draft.city.trim().slice(0, 60),
      note: draft.note.trim().slice(0, 300),
      createdAt: old?.createdAt || Date.now(),
    };
    const all = await saveFunction(uid, f);
    await syncPlanReminders(all);
    setDraft(null);
    refresh(all);
  };

  const remove = (f: PlannedFunction) =>
    Alert.alert('Delete?', f.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelPlanReminders(f);
          refresh(await deleteFunction(uid, f.id));
        },
      },
    ]);

  const quickDates = [0, 1, 7].map(n => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return { label: n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : 'In a week', key: localDateKey(d) };
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📅 Function planner</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setDraft({ ...EMPTY })}>
          <Text style={styles.addText}>＋ Add</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {!list.length ? (
          <Text style={styles.empty}>No functions planned. Tap ＋ Add for reminders, weather and outfit ideas.</Text>
        ) : null}
        {list.map(f => {
          const meta = typeMeta(f.type);
          const w = wx[f.id];
          const wt = w ? weatherText(w.code) : null;
          const n = daysUntil(f.date, today);
          return (
            <View key={f.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.emoji}>{meta.emoji}</Text>
                <View style={styles.body}>
                  <Text style={styles.cardTitle}>{f.title}</Text>
                  <Text style={[styles.sub, n <= 1 && styles.soon]}>
                    {whenText(n)} · {f.date}
                    {f.time ? ` · ${f.time}` : ''}
                    {f.city ? ` · ${f.city}` : ''}
                  </Text>
                </View>
              </View>
              {w && wt ? (
                <Text style={styles.weather}>
                  {wt.emoji} {wt.label} · {w.tMin}°–{w.tMax}°C{w.rainChance != null ? ` · 💧 ${w.rainChance}%` : ''}
                </Text>
              ) : null}
              <Text style={styles.tip}>👗 {OUTFIT_TIPS[f.type]}</Text>
              {w ? <Text style={styles.tip}>🌦️ {weatherTip(w)}</Text> : null}
              {f.note ? <Text style={styles.note}>📝 {f.note}</Text> : null}
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => setDraft({ id: f.id, title: f.title, type: f.type, date: f.date, time: f.time || '', city: f.city, note: f.note })}>
                  <Text style={styles.link}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(f)}>
                  <Text style={[styles.link, styles.danger]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!draft} animationType="slide" transparent onRequestClose={() => setDraft(null)}>
        <View style={styles.sheetWrap}>
          <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>{draft?.id ? 'Edit function' : 'New function'}</Text>
            <TextInput
              style={styles.input}
              placeholder="Name (e.g. Priya's wedding)"
              placeholderTextColor={colors.textMuted}
              value={draft?.title}
              maxLength={60}
              onChangeText={t => setDraft(d => (d ? { ...d, title: t } : d))}
            />
            <View style={styles.chips}>
              {FUNCTION_TYPES.map(t => (
                <TouchableOpacity
                  key={t.type}
                  style={[styles.chip, draft?.type === t.type && styles.chipOn]}
                  onPress={() => setDraft(d => (d ? { ...d, type: t.type } : d))}>
                  <Text style={[styles.chipText, draft?.type === t.type && styles.chipTextOn]}>
                    {t.emoji} {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Date YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={draft?.date}
              maxLength={10}
              keyboardType="numbers-and-punctuation"
              onChangeText={t => setDraft(d => (d ? { ...d, date: t.trim() } : d))}
            />
            <View style={styles.chips}>
              {quickDates.map(q => (
                <TouchableOpacity key={q.key} style={styles.chip} onPress={() => setDraft(d => (d ? { ...d, date: q.key } : d))}>
                  <Text style={styles.chipText}>{q.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Time HH:MM (optional)"
              placeholderTextColor={colors.textMuted}
              value={draft?.time}
              maxLength={5}
              keyboardType="numbers-and-punctuation"
              onChangeText={t => setDraft(d => (d ? { ...d, time: t.trim() } : d))}
            />
            <TextInput
              style={styles.input}
              placeholder="City (for the weather)"
              placeholderTextColor={colors.textMuted}
              value={draft?.city}
              maxLength={60}
              onChangeText={t => setDraft(d => (d ? { ...d, city: t } : d))}
            />
            <TextInput
              style={[styles.input, styles.noteInput]}
              placeholder="Note (optional): dress code, gift..."
              placeholderTextColor={colors.textMuted}
              value={draft?.note}
              maxLength={300}
              multiline
              onChangeText={t => setDraft(d => (d ? { ...d, note: t } : d))}
            />
            <View style={styles.sheetBtns}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setDraft(null)}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={save}>
                <Text style={styles.btnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
  title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  addBtn: { backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  addText: { color: colors.onPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  content: { padding: spacing.base, paddingBottom: spacing.xxxl },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  emoji: { fontSize: 30 },
  body: { flex: 1, marginLeft: spacing.sm },
  cardTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  sub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  soon: { color: colors.accent, fontWeight: fontWeight.bold },
  weather: { fontSize: fontSize.sm, color: colors.textPrimary, marginTop: spacing.sm, fontWeight: fontWeight.semiBold },
  tip: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  note: { fontSize: fontSize.sm, color: colors.textPrimary, marginTop: spacing.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm },
  link: { color: colors.primary, fontWeight: fontWeight.bold, marginLeft: spacing.lg },
  danger: { color: colors.error },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '88%', backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.base },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary, marginBottom: spacing.md },
  input: { backgroundColor: colors.inputBg, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.textPrimary, fontSize: fontSize.base, marginBottom: spacing.sm },
  noteInput: { minHeight: 70, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, marginBottom: 6 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.xs, color: colors.textPrimary },
  chipTextOn: { color: colors.onPrimary, fontWeight: fontWeight.bold },
  sheetBtns: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm, marginBottom: spacing.xl },
  btn: { backgroundColor: colors.primary, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 9, marginLeft: spacing.sm },
  btnText: { color: colors.onPrimary, fontWeight: fontWeight.bold },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.textPrimary, fontWeight: fontWeight.bold },
}));
