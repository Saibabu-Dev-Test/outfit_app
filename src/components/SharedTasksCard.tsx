// Earn tab › Shared tasks: today's owner-funded task slots (server/earn/taskPool.js).
// Take one open slot, finish it before the timer ends, then tap Done; the server checks the task and
// adds the coins as pending. A slot not finished in time goes back to the pool for others.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { ui } from '../screens/Earn/earnUi';
import { colors } from '../theme';
import { POOL_TASK_LABEL, PoolTaskType, isTaskPoolConfigured } from '../config/earn';
import { showRewardedAd } from '../native/ads';
import { EarnDay } from '../services/earnLedger';
import { dailyCheckIn, recordEarnAd } from '../services/earnApi';
import {
  claimPoolSlot,
  completePoolSlot,
  subscribeMyPoolDay,
  subscribePoolDay,
  subscribePoolSlots,
} from '../services/taskPoolApi';
import { PoolDay, PoolSlot, PoolUserDay, poolView, timeLeftText } from '../services/taskPoolLogic';

const HOW_TO: Record<PoolTaskType, string> = {
  checkin: 'Tap "Do it" to check in for today.',
  rewardedAd: 'Tap "Do it" and watch the ad to the end.',
  pollVote: 'Vote on any poll in Feed, then come back and tap Done.',
};

interface Props {
  uid: string;
  day: string;
  earnDay: EarnDay;
  navigation: any;
}

export default function SharedTasksCard({ uid, day, earnDay, navigation }: Props) {
  const [pool, setPool] = useState<PoolDay | null>(null);
  const [slots, setSlots] = useState<PoolSlot[]>([]);
  const [me, setMe] = useState<PoolUserDay>({ claims: 0, done: 0 });
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const on = isTaskPoolConfigured();

  useEffect(() => (on ? subscribePoolDay(day, setPool) : undefined), [on, day]);
  useEffect(() => (on ? subscribePoolSlots(day, setSlots) : undefined), [on, day]);
  useEffect(() => (on && uid ? subscribeMyPoolDay(day, uid, setMe) : undefined), [on, day, uid]);

  const view = useMemo(() => poolView(slots, pool, me, uid, now), [slots, pool, me, uid, now]);

  // Countdown while I hold a slot; otherwise refresh every 30 s so expired claims show as open again
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), view.mine ? 1000 : 30000);
    return () => clearInterval(t);
  }, [view.mine]);

  if (!on || !pool || (!slots.length && !view.mine)) return null;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert('Shared tasks', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
      setNow(Date.now());
    }
  };

  const claim = (slotId: string) =>
    run(`claim_${slotId}`, async () => {
      const r = await claimPoolSlot(day, slotId);
      const mins = Math.max(1, Math.round((r.expiresAt - Date.now()) / 60000));
      Alert.alert('Task is yours', `Finish it in ${mins} min, then tap Done. After that it goes back to the pool.`);
    });

  const complete = (slot: PoolSlot) =>
    run('done', async () => {
      const coins = await completePoolSlot(day, slot.id);
      Alert.alert('Task checked', `+${coins} coins (pending) 🪙`);
    });

  // Do the task in the app, then ask the server to check it
  const doIt = (slot: PoolSlot) =>
    run('do', async () => {
      if (slot.taskType === 'checkin') {
        if (!earnDay.checkedIn) await dailyCheckIn(uid);
      } else if (slot.taskType === 'rewardedAd') {
        const r = await showRewardedAd('earnRewarded');
        if (r !== 'earned') {
          throw new Error(r === 'closed' ? 'Watch the ad to the end to finish this task.' : 'No ad right now. Try again in a minute.');
        }
        await recordEarnAd(uid);
      } else {
        navigation.navigate('Feed');
        return;
      }
      const coins = await completePoolSlot(day, slot.id);
      Alert.alert('Task checked', `+${coins} coins (pending) 🪙`);
    });

  const mine = view.mine;
  return (
    <View style={ui.card}>
      <Text style={ui.h2}>🧩 Shared tasks · ఈరోజు టాస్కులు</Text>
      <Text style={ui.body}>
        A few tasks for everyone, first come first served. Take one and finish it within {pool.claimMinutes} min, or it goes back
        for others.
      </Text>
      <Text style={[ui.muted, { marginTop: 4 }]}>
        You can take {view.claimsLeft} more today · {view.openCount} open now
      </Text>

      {mine ? (
        <View style={{ marginTop: 10 }}>
          <Text style={ui.h2}>
            {POOL_TASK_LABEL[mine.taskType]} · {mine.rewardCoins} coins
          </Text>
          <Text style={ui.muted}>
            ⏳ {timeLeftText(mine.claimExpiresAt, now)} left · {HOW_TO[mine.taskType]}
          </Text>
          <View style={[ui.row, { marginTop: 8 }]}>
            <TouchableOpacity style={[ui.btn, { marginRight: 8 }, !!busy && ui.btnOff]} onPress={() => doIt(mine)} disabled={!!busy}>
              {busy === 'do' ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={ui.btnText}>Do it</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[ui.btnGhost, !!busy && ui.btnOff]} onPress={() => complete(mine)} disabled={!!busy}>
              {busy === 'done' ? <ActivityIndicator /> : <Text style={ui.btnGhostText}>Done</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {!mine && view.open.length && view.claimsLeft > 0
        ? view.open.map(g => (
            <View key={`${g.taskType}_${g.rewardCoins}`} style={[ui.row, { marginTop: 10 }]}>
              <View style={ui.flex1}>
                <Text style={[ui.h2, { marginBottom: 0 }]}>{POOL_TASK_LABEL[g.taskType]}</Text>
                <Text style={ui.muted}>
                  {g.rewardCoins} coins · {g.count} left
                </Text>
              </View>
              <TouchableOpacity
                style={[ui.btn, !!busy && ui.btnOff]}
                onPress={() => claim(g.slotId)}
                disabled={!!busy}>
                {busy === `claim_${g.slotId}` ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={ui.btnText}>Take</Text>}
              </TouchableOpacity>
            </View>
          ))
        : null}

      {!mine && (!view.open.length || view.claimsLeft <= 0) ? (
        <Text style={[ui.muted, { marginTop: 8 }]}>
          {view.claimsLeft <= 0 ? 'You have used your tasks for today. Come back tomorrow.' : 'No open tasks right now. Check again later.'}
        </Text>
      ) : null}
      <Text style={[ui.muted, { marginTop: 8 }]}>Coins are added as pending after the server checks the task.</Text>
    </View>
  );
}
