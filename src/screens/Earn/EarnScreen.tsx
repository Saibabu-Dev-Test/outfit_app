// Earn tab.
// 1. Daily gate (resets 00:00 IST): watch 1 rewarded ad + vote on 1 outfit, ticked live from
//    users/{uid}/earnDaily/{day}. Until both are done only the checklist shows.
// 2. Unlocked: balance, daily check-in, Surveys (CPX Research wall, one ad after each completed
//    survey before the next one opens), Offerwall.GG, referral code, UPI + withdrawal.
// Values: config/earn.ts. Data: services/earnApi.ts. Maths: services/earnLedger.ts.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ui } from '../../components/ui';
import { colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { showRewardedAd, showRewardedInterstitialAd } from '../../ads/adsService';
import { recordMonthlyProgress } from '../../services/monthlyTasksApi';
import {
  COINS_PER_RUPEE,
  EARN_AD_COINS,
  EARN_CHECKIN_COINS,
  EARN_REFERRAL_COINS,
  EARN_VOTE_COINS,
  HOLD_DAYS_MAX,
  HOLD_DAYS_MIN,
  MIN_WITHDRAW_RUPEES,
  USER_SHARE,
  cpxWallUrl,
  isCpxConfigured,
  offerwallUrl,
  rupeesText,
} from '../../config/earn';
import {
  EarnDay,
  EarnEntry,
  EMPTY_DAY,
  Withdrawal,
  isUnlocked,
  latestSurveyAt,
  summarize,
  surveyAdOwed,
  withdrawCheck,
} from '../../services/earnLedger';
import {
  EarnMeta,
  bindDevice,
  clearSurveyAd,
  dailyCheckIn,
  getCpxHash,
  getMyWithdrawals,
  recordEarnAd,
  requestWithdrawal,
  saveUpi,
  subscribeEarnDay,
  subscribeEarnMeta,
  subscribeEarnings,
} from '../../services/earnApi';
import { istDateKey, msUntilIstMidnight } from '../../utils/istDate';
import { getMyReferralCode, shareMyReferral } from '../../utils/referralLink';
import { countFriendsJoined } from '../../services/rewardsApi';

// The current IST day key; changes at 00:00 IST while the screen is open
const useIstDay = () => {
  const [day, setDay] = useState(istDateKey());
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const arm = () => {
      t = setTimeout(() => {
        setDay(istDateKey());
        arm();
      }, msUntilIstMidnight() + 1000);
    };
    arm();
    return () => clearTimeout(t);
  }, []);
  return day;
};

const adFails: Record<string, number> = {};

function Check({ done, label, cta, onPress, busy }: { done: boolean; label: string; cta: string; onPress: () => void; busy?: boolean }) {
  return (
    <View style={[ui.card, ui.row]}>
      <Text style={{ fontSize: 22, marginRight: 10 }}>{done ? '✅' : '⬜'}</Text>
      <Text style={[ui.h2, ui.flex1, { marginBottom: 0 }]}>{label}</Text>
      {done ? (
        <Text style={ui.good}>Done</Text>
      ) : (
        <TouchableOpacity style={[ui.btn, busy && ui.btnOff]} onPress={onPress} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={ui.btnText}>{cta}</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function EarnScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const uid = user?.id || '';
  const day = useIstDay();
  const [today, setToday] = useState<EarnDay | null>(null);
  const [entries, setEntries] = useState<EarnEntry[]>([]);
  const [meta, setMeta] = useState<EarnMeta>({ surveyAdClearedAt: 0, deviceHash: null, upi: null });
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [device, setDevice] = useState<'checking' | 'ok' | string>('checking');
  const [busy, setBusy] = useState<string | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [friends, setFriends] = useState(0);
  const [upiInput, setUpiInput] = useState('');
  const [amount, setAmount] = useState('');
  const deviceChecked = useRef('');

  useEffect(() => {
    if (!uid) return;
    setToday(null);
    return subscribeEarnDay(uid, day, setToday);
  }, [uid, day]);
  useEffect(() => (uid ? subscribeEarnings(uid, setEntries) : undefined), [uid]);
  useEffect(() => (uid ? subscribeEarnMeta(uid, setMeta) : undefined), [uid]);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      // One account per phone: checked once per session per account
      if (deviceChecked.current !== uid) {
        deviceChecked.current = uid;
        bindDevice(uid).then(r => setDevice(r.ok ? 'ok' : r.message));
      }
      getMyWithdrawals(uid).then(setWithdrawals);
      getMyReferralCode(uid).then(setRefCode);
      countFriendsJoined(uid).then(setFriends).catch(() => undefined);
    }, [uid]),
  );

  const summary = useMemo(() => summarize(entries, withdrawals), [entries, withdrawals]);
  const d = today || EMPTY_DAY;
  const unlocked = isUnlocked(d);
  const owed = surveyAdOwed(entries, meta.surveyAdClearedAt);

  // ── Gate actions ──
  const watchGateAd = async () => {
    setBusy('gateAd');
    try {
      const ok = await showRewardedAd();
      if (ok) {
        const coins = await recordEarnAd(uid);
        recordMonthlyProgress(uid, 'adsWatched', 1);
        if (coins) Alert.alert('Ad watched', `+${coins} coins (pending) 🪙`);
        return;
      }
      adFails.gate = (adFails.gate || 0) + 1;
      if (adFails.gate >= 2) {
        // Nobody gets stuck on a no-fill day: tick it without coins
        await recordEarnAd(uid, { skipped: true });
        return;
      }
      Alert.alert('No ad right now', 'Could not load an ad. Please check your internet and try again in a minute.');
    } finally {
      setBusy(null);
    }
  };

  // ── Unlocked actions ──
  const checkIn = async () => {
    setBusy('checkin');
    try {
      const c = await dailyCheckIn(uid);
      Alert.alert(c ? 'Checked in' : 'Already checked in', c ? `+${c} coins (pending) 🪙` : 'Come back tomorrow.');
    } catch (e: any) {
      Alert.alert('Check-in', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  // One ad after each completed survey before the next survey opens
  const payOwedAd = async () => {
    setBusy('surveyAd');
    try {
      let ok = await showRewardedInterstitialAd();
      if (!ok) {
        adFails.survey = (adFails.survey || 0) + 1;
        if (adFails.survey < 2) {
          Alert.alert('No ad right now', 'Could not load an ad. Please try again in a minute.');
          return;
        }
        ok = true; // two no-fills: let the user continue
      } else {
        await recordEarnAd(uid);
        recordMonthlyProgress(uid, 'adsWatched', 1);
      }
      await clearSurveyAd(uid, latestSurveyAt(entries));
    } catch (e: any) {
      Alert.alert('Surveys', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const openSurveys = async () => {
    if (owed) return payOwedAd();
    if (!isCpxConfigured()) {
      Alert.alert('Surveys', 'Surveys are coming soon. Check back in a few days.');
      return;
    }
    setBusy('survey');
    try {
      const hash = await getCpxHash();
      navigation.navigate('EarnWall', { url: cpxWallUrl(uid, hash), title: 'Surveys', kind: 'survey' });
    } catch (e: any) {
      Alert.alert('Surveys', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const openOffers = () => {
    const url = offerwallUrl(uid);
    if (!url) {
      Alert.alert('Offers', 'Offers are coming soon. Check back in a few days.');
      return;
    }
    navigation.navigate('EarnWall', { url, title: 'Offers', kind: 'offer' });
  };

  const onSaveUpi = async () => {
    setBusy('upi');
    const r = await saveUpi(uid, upiInput);
    setBusy(null);
    if (r.ok) {
      setUpiInput('');
      Alert.alert('UPI saved', 'Withdrawals will be sent to this UPI id.');
    } else Alert.alert('UPI id', r.message);
  };

  const onWithdraw = async () => {
    if (!meta.upi) return Alert.alert('UPI id', 'Save your UPI id first.');
    const rupees = Number(amount);
    const c = withdrawCheck(rupees, summary, MIN_WITHDRAW_RUPEES);
    if (!c.ok) return Alert.alert('Withdraw', c.message);
    setBusy('withdraw');
    try {
      await requestWithdrawal(uid, meta.upi, rupees);
      setAmount('');
      setWithdrawals(await getMyWithdrawals(uid));
      Alert.alert('Request sent', `₹${rupees} to ${meta.upi}. Our team checks and pays it, usually within 7 days.`);
    } catch (e: any) {
      Alert.alert('Withdraw', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  // ── Render ──
  const header = (
    <View style={[ui.row, { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[ui.h1, ui.flex1]}>Earn</Text>
      <Text style={ui.h2}>
        🪙 {summary.totalCoins.toLocaleString('en-IN')} · {rupeesText(summary.totalCoins)}
      </Text>
    </View>
  );

  if (device !== 'ok' && device !== 'checking') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {header}
        <View style={ui.scroll}>
          <View style={ui.card}>
            <Text style={ui.h2}>Earn is not available on this account</Text>
            <Text style={ui.body}>{device}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!today || device === 'checking') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {header}
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!unlocked) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {header}
        <ScrollView contentContainerStyle={ui.scroll}>
          <Text style={ui.h2}>Complete to start earning today</Text>
          <Text style={[ui.muted, { marginBottom: 12 }]}>Resets every day at midnight (India time).</Text>
          <Check done={d.adWatched} label="Watch 1 ad" cta="▶ Watch" onPress={watchGateAd} busy={busy === 'gateAd'} />
          <Check done={d.voted} label="Vote on 1 outfit" cta="Go to Feed" onPress={() => navigation.navigate('Feed')} />
          <Text style={ui.muted}>
            You get +{EARN_AD_COINS} coins per ad and +{EARN_VOTE_COINS} for your first vote today. {COINS_PER_RUPEE} coins = ₹1.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {header}
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
        <View style={ui.card}>
          <Text style={ui.muted}>Withdrawable</Text>
          <Text style={ui.h1}>{rupeesText(summary.withdrawableCoins)}</Text>
          <Text style={ui.muted}>
            Pending {rupeesText(summary.pendingCoins)} · {summary.tasksCompleted} tasks done
          </Text>
        </View>

        <View style={[ui.card, ui.row]}>
          <View style={ui.flex1}>
            <Text style={ui.h2}>📅 Daily check-in</Text>
            <Text style={ui.muted}>+{EARN_CHECKIN_COINS} coins every day</Text>
          </View>
          {d.checkedIn ? (
            <Text style={ui.good}>Done today</Text>
          ) : (
            <TouchableOpacity style={[ui.btn, busy === 'checkin' && ui.btnOff]} onPress={checkIn} disabled={!!busy}>
              <Text style={ui.btnText}>Check in</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={ui.card}>
          <Text style={ui.h2}>📝 Surveys</Text>
          <Text style={ui.body}>
            Answer paid surveys from CPX Research. You get {Math.round(USER_SHARE * 100)}% of what the survey pays. Earnings are held {HOLD_DAYS_MIN}–{HOLD_DAYS_MAX} days, then become withdrawable.
          </Text>
          {owed ? <Text style={[ui.muted, { marginTop: 6 }]}>Survey done! Watch 1 ad to open the next survey.</Text> : null}
          <TouchableOpacity style={[ui.btn, { marginTop: 10 }, busy === 'survey' || busy === 'surveyAd' ? ui.btnOff : null]} onPress={openSurveys} disabled={!!busy}>
            {busy === 'survey' || busy === 'surveyAd' ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={ui.btnText}>{owed ? '▶ Watch ad to continue' : isCpxConfigured() ? 'Open surveys' : 'Coming soon'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={ui.card}>
          <Text style={ui.h2}>🎯 Offers (Offerwall.GG)</Text>
          <Text style={ui.body}>
            Try apps and complete offers. You get {Math.round(USER_SHARE * 100)}% of the payout, held {HOLD_DAYS_MIN}–{HOLD_DAYS_MAX} days.
          </Text>
          <TouchableOpacity style={[ui.btn, { marginTop: 10 }]} onPress={openOffers}>
            <Text style={ui.btnText}>{offerwallUrl(uid) ? 'Open offers' : 'Coming soon'}</Text>
          </TouchableOpacity>
        </View>

        <View style={ui.card}>
          <Text style={ui.h2}>🤝 Invite friends</Text>
          <Text style={ui.body}>
            When a friend joins with your code and finishes their first Earn day, you both get {EARN_REFERRAL_COINS} coins.
          </Text>
          <View style={[ui.row, { marginTop: 8 }]}>
            <Text style={[ui.h1, ui.flex1]}>{refCode || '······'}</Text>
            <TouchableOpacity style={ui.btn} onPress={() => shareMyReferral(uid)}>
              <Text style={ui.btnText}>Share</Text>
            </TouchableOpacity>
          </View>
          <Text style={ui.muted}>Friends joined: {friends}</Text>
        </View>

        <View style={ui.card}>
          <Text style={ui.h2}>💸 Withdraw to UPI</Text>
          <Text style={ui.muted}>
            Minimum ₹{MIN_WITHDRAW_RUPEES}. One UPI id per account. Checked and paid by our team.
          </Text>
          {meta.upi ? <Text style={[ui.body, { marginTop: 6 }]}>UPI: {meta.upi}</Text> : null}
          <TextInput
            style={ui.input}
            value={upiInput}
            onChangeText={setUpiInput}
            placeholder={meta.upi ? 'Change UPI id' : 'Your UPI id (name@okbank)'}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={[ui.btnGhost, busy === 'upi' && ui.btnOff]} onPress={onSaveUpi} disabled={!!busy || !upiInput.trim()}>
            <Text style={ui.btnGhostText}>Save UPI id</Text>
          </TouchableOpacity>
          <TextInput
            style={[ui.input, { marginTop: 10 }]}
            value={amount}
            onChangeText={t => setAmount(t.replace(/[^0-9]/g, ''))}
            placeholder={`Amount in ₹ (min ${MIN_WITHDRAW_RUPEES})`}
            keyboardType="number-pad"
          />
          <TouchableOpacity style={[ui.btn, busy === 'withdraw' && ui.btnOff]} onPress={onWithdraw} disabled={!!busy}>
            <Text style={ui.btnText}>Request withdrawal</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
