// Me > 💍 Function planner: the user's functions (pelli, haldi, mehendi, birthday...). Each has a
// name, date, time and place; shows how many days are left. Stored in users/{uid}/functions/{fid}
// {title, events: [{name, date, time, place}], createdAt, updatedAt} (owner only, firestore.rules).
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import ScreenShell from '../../components/ScreenShell';
import KeyboardSafeView from '../../components/KeyboardSafeView';
import { ui } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { localDateKey } from '../../utils/date';
import { firestoreErrorMessage } from '../../utils/firebaseErrors';

interface PlanEvent {
  name: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM or ''
  place: string;
}
interface PlannedFunction {
  id: string;
  title: string;
  events: PlanEvent[];
}

const TYPES = ['Pelli / Wedding', 'Engagement', 'Haldi', 'Mehendi', 'Sangeet', 'Reception', 'Birthday', 'Festival', 'Other'];

export const isValidDateKey = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !isNaN(d.getTime()) && localDateKey(d) === s;
};
export const isValidTime = (s: string) => s === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const daysLeft = (date: string) => {
  const t = new Date(`${date}T00:00:00`).getTime();
  const today = new Date(`${localDateKey()}T00:00:00`).getTime();
  return Math.round((t - today) / 86400000);
};
const whenText = (n: number) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n > 1 ? `In ${n} days` : `${-n} days ago`);

export default function FunctionPlannerScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const uid = user?.id || '';
  const [list, setList] = useState<PlannedFunction[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState(TYPES[0]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [place, setPlace] = useState('');

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'functions'));
      const items: PlannedFunction[] = snap.docs.map(d => {
        const x: any = d.data();
        return {
          id: d.id,
          title: String(x?.title || 'Function'),
          events: Array.isArray(x?.events) ? x.events.filter((e: any) => e && typeof e.date === 'string') : [],
        };
      });
      items.sort((a, b) => (a.events[0]?.date || '9999').localeCompare(b.events[0]?.date || '9999'));
      setList(items);
    } catch (e: any) {
      console.warn('load functions failed:', e?.code, e?.message);
      setList([]);
    } finally {
      setRefreshing(false);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const add = async () => {
    const name = (title.trim() || type).slice(0, 80);
    if (!isValidDateKey(date.trim())) return Alert.alert('Date', 'Enter the date as YYYY-MM-DD, e.g. 2026-12-20.');
    if (!isValidTime(time.trim())) return Alert.alert('Time', 'Enter the time as HH:MM (24 hours), e.g. 18:30, or leave it empty.');
    setBusy(true);
    try {
      const ref = doc(collection(db, 'users', uid, 'functions'));
      await setDoc(ref, {
        title: name,
        events: [{ name: type, date: date.trim(), time: time.trim(), place: place.trim().slice(0, 80) }],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTitle('');
      setDate('');
      setTime('');
      setPlace('');
      load();
    } catch (e: any) {
      Alert.alert('Not saved', firestoreErrorMessage(e, 'Saving the function'));
    } finally {
      setBusy(false);
    }
  };

  const remove = (f: PlannedFunction) =>
    Alert.alert('Delete function?', f.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'users', uid, 'functions', f.id));
            load();
          } catch (e: any) {
            Alert.alert('Not deleted', firestoreErrorMessage(e, 'Deleting'));
          }
        },
      },
    ]);

  return (
    <ScreenShell title="Function planner" navigation={navigation}>
      <KeyboardSafeView>
        <ScrollView
          contentContainerStyle={ui.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
          <View style={ui.card}>
            <Text style={ui.h2}>Add a function</Text>
            <View style={[ui.row, { flexWrap: 'wrap' }]}>
              {TYPES.map(t => (
                <TouchableOpacity key={t} style={[ui.chip, type === t && ui.chipOn]} onPress={() => setType(t)}>
                  <Text style={[ui.chipText, type === t && ui.chipTextOn]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={ui.input} value={title} onChangeText={setTitle} placeholder="Name (e.g. Ravi's wedding)" maxLength={80} />
            <TextInput style={ui.input} value={date} onChangeText={setDate} placeholder="Date YYYY-MM-DD" maxLength={10} />
            <TextInput style={ui.input} value={time} onChangeText={setTime} placeholder="Time HH:MM (optional)" maxLength={5} />
            <TextInput style={ui.input} value={place} onChangeText={setPlace} placeholder="Place / city (optional)" maxLength={80} />
            <TouchableOpacity style={[ui.btn, busy && ui.btnOff]} onPress={add} disabled={busy}>
              {busy ? <ActivityIndicator /> : <Text style={ui.btnText}>Save</Text>}
            </TouchableOpacity>
          </View>

          <Text style={ui.h2}>My functions</Text>
          {!list ? <ActivityIndicator /> : null}
          {list && !list.length ? <Text style={ui.body}>No functions yet. Add one above.</Text> : null}
          {(list || []).map(f => {
            const e = f.events[0];
            const n = e ? daysLeft(e.date) : null;
            return (
              <View key={f.id} style={ui.card}>
                <View style={ui.row}>
                  <View style={ui.flex1}>
                    <Text style={ui.h2}>{f.title}</Text>
                    {e ? (
                      <Text style={ui.body}>
                        {e.name} · {e.date}
                        {e.time ? ` ${e.time}` : ''}
                        {e.place ? ` · ${e.place}` : ''}
                      </Text>
                    ) : null}
                    {n !== null ? <Text style={n >= 0 ? ui.good : ui.muted}>{whenText(n)}</Text> : null}
                  </View>
                  <TouchableOpacity style={ui.btnGhost} onPress={() => remove(f)}>
                    <Text style={ui.btnGhostText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          <TouchableOpacity style={ui.btnGhost} onPress={() => navigation.navigate('WeatherOutfit')}>
            <Text style={ui.btnGhostText}>🌤️ Today's outfit for the weather</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardSafeView>
    </ScreenShell>
  );
}
