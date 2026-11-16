// Admin › Shared tasks: the owner-funded daily task pool (server/earn/taskPool.js).
// Set the day's coin budget, claim time and per-user cap, add task slots, remove open slots.
// Admins only (firestore.rules: taskPool/{day} + slots). Claims / coins are server only.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import EarnShell from '../Earn/EarnShell';
import { ui } from '../Earn/earnUi';
import { useAuth } from '../../context/AuthContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import {
  POOL_TASK_LABEL,
  POOL_TASK_TYPES,
  PoolTaskType,
  TASK_POOL_DEFAULT_CLAIM_MINUTES,
  TASK_POOL_DEFAULT_USER_CAP,
  isTaskPoolConfigured,
  rupeesText,
} from '../../config/earn';
import { addPoolSlots, deletePoolSlot, savePoolSettings, subscribePoolDay, subscribePoolSlots } from '../../services/taskPoolApi';
import { PoolDay, PoolSlot, effectiveStatus, slotsOverBudget } from '../../services/taskPoolLogic';
import { istDateKey } from '../../utils/istDate';

const intOf = (t: string) => (t.trim() === '' ? NaN : Number(t));

export default function AdminTaskPoolScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const uid = user?.id || '';
  const { isAdmin, checked } = useIsAdmin(uid);
  const today = istDateKey();
  const tomorrow = istDateKey(Date.now() + 86400000);
  const [day, setDay] = useState(today);
  const [pool, setPool] = useState<PoolDay | null>(null);
  const [slots, setSlots] = useState<PoolSlot[]>([]);
  const [budget, setBudget] = useState('');
  const [minutes, setMinutes] = useState(String(TASK_POOL_DEFAULT_CLAIM_MINUTES));
  const [cap, setCap] = useState(String(TASK_POOL_DEFAULT_USER_CAP));
  const [type, setType] = useState<PoolTaskType>('checkin');
  const [reward, setReward] = useState('');
  const [count, setCount] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribePoolDay(day, p => {
      setPool(p);
      if (p) {
        setBudget(String(p.budgetCoins));
        setMinutes(String(p.claimMinutes));
        setCap(String(p.perUserCap));
      }
    });
  }, [isAdmin, day]);
  useEffect(() => (isAdmin ? subscribePoolSlots(day, setSlots) : undefined), [isAdmin, day]);

  const now = Date.now();
  const counts = useMemo(() => {
    const c = { open: 0, claimed: 0, done: 0 };
    slots.forEach(s => {
      c[effectiveStatus(s, now)]++;
    });
    return c;
  }, [slots, now]);
  const over = slotsOverBudget(slots, pool);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert('Not saved', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (checked && !isAdmin) {
    return (
      <EarnShell title="Shared tasks" navigation={navigation}>
        <View style={ui.scroll}>
          <Text style={ui.body}>Admins only.</Text>
        </View>
      </EarnShell>
    );
  }

  return (
    <EarnShell title="Shared tasks" navigation={navigation}>
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
        {!isTaskPoolConfigured() ? (
          <Text style={[ui.bad, { marginBottom: 8 }]}>
            Server not set yet (TASK_POOL_ENDPOINT in config/earn.ts). Users won't see shared tasks until it is.
          </Text>
        ) : null}
        <View style={[ui.row, { flexWrap: 'wrap' }]}>
          {[today, tomorrow].map(k => (
            <TouchableOpacity key={k} style={[ui.chip, day === k && ui.chipOn]} onPress={() => setDay(k)}>
              <Text style={[ui.chipText, day === k && ui.chipTextOn]}>
                {k === today ? 'Today' : 'Tomorrow'} · {k}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={ui.card}>
          <Text style={ui.h2}>Budget & rules</Text>
          <Text style={ui.muted}>
            Paid from your money (not ad revenue share). Paid today: {pool ? `${pool.paidCoins} coins (${rupeesText(pool.paidCoins)})` : '0'}
          </Text>
          <Text style={[ui.muted, { marginTop: 8 }]}>Daily budget (coins, 100 = ₹1)</Text>
          <TextInput style={ui.input} value={budget} onChangeText={t => setBudget(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="e.g. 2000" />
          <Text style={ui.muted}>Claim time (minutes)</Text>
          <TextInput style={ui.input} value={minutes} onChangeText={t => setMinutes(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
          <Text style={ui.muted}>Tasks per user per day</Text>
          <TextInput style={ui.input} value={cap} onChangeText={t => setCap(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
          <TouchableOpacity
            style={[ui.btn, !!busy && ui.btnOff]}
            disabled={!!busy}
            onPress={() =>
              run('save', () =>
                savePoolSettings(day, uid, { budgetCoins: intOf(budget), claimMinutes: intOf(minutes), perUserCap: intOf(cap) }),
              )
            }>
            <Text style={ui.btnText}>{pool ? 'Save' : 'Start this day'}</Text>
          </TouchableOpacity>
        </View>

        <View style={ui.card}>
          <Text style={ui.h2}>Add slots</Text>
          {!pool ? <Text style={ui.muted}>Save the budget for this day first.</Text> : null}
          <View style={[ui.row, { flexWrap: 'wrap', marginTop: 6 }]}>
            {POOL_TASK_TYPES.map(t => (
              <TouchableOpacity key={t} style={[ui.chip, type === t && ui.chipOn]} onPress={() => setType(t)}>
                <Text style={[ui.chipText, type === t && ui.chipTextOn]}>{POOL_TASK_LABEL[t]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={ui.muted}>Reward per slot (coins)</Text>
          <TextInput style={ui.input} value={reward} onChangeText={t => setReward(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="e.g. 10" />
          <Text style={ui.muted}>How many slots</Text>
          <TextInput style={ui.input} value={count} onChangeText={t => setCount(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="e.g. 20" />
          <TouchableOpacity
            style={[ui.btn, (!!busy || !pool) && ui.btnOff]}
            disabled={!!busy || !pool}
            onPress={() =>
              run('add', async () => {
                await addPoolSlots(day, type, intOf(reward), intOf(count));
                setCount('');
              })
            }>
            <Text style={ui.btnText}>Add slots</Text>
          </TouchableOpacity>
        </View>

        <View style={ui.card}>
          <Text style={ui.h2}>Slots ({slots.length})</Text>
          <Text style={ui.muted}>
            Open {counts.open} · Taken {counts.claimed} · Done {counts.done}
          </Text>
          {over > 0 ? (
            <Text style={[ui.bad, { marginTop: 6 }]}>
              Unpaid slots are {over} coins more than the budget left. Extra slots can't be taken once the budget is used.
            </Text>
          ) : null}
          {slots.map(s => {
            const st = effectiveStatus(s, now);
            return (
              <View key={s.id} style={[ui.row, { marginTop: 8 }]}>
                <Text style={[ui.body, ui.flex1]}>
                  {POOL_TASK_LABEL[s.taskType]} · {s.rewardCoins} coins · {st}
                </Text>
                {st === 'open' ? (
                  <TouchableOpacity style={ui.btnGhost} disabled={!!busy} onPress={() => run(`del_${s.id}`, () => deletePoolSlot(day, s.id))}>
                    <Text style={ui.btnGhostText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </EarnShell>
  );
}
