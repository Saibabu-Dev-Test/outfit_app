// Earn tab. Every signed-in user sees every earning option straight away (no daily ad / vote gate,
// no ad before any task):
//   balance, daily check-in, optional rewarded ad (+coins, daily cap), Surveys = CPX wall,
//   Offers = Offerwall.GG wall, Surveys & offers = BitLabs wall, Games = BitLabs games tab
//   (display_mode=gaming; Offerwall.GG wall if BitLabs is not set up), Quizzes & learning (Coming
//   soon: no partner link), referral code, UPI + withdrawal.
// A card whose partner is not set up in this build stays on screen and says "Coming soon".
// No partner names on this screen (they are in Terms).
// Values: config/earn.ts. Data: services/earnApi.ts. Maths: services/earnLedger.ts.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ui } from './earnUi';
import { colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { showRewardedAd } from '../../native/ads';
import {
  EARN_AD_COINS,
  EARN_CHECKIN_COINS,
  EARN_MAX_ADS_PER_DAY,
  EARN_REFERRAL_COINS,
  MIN_WITHDRAW_RUPEES,
  bitlabsGamesUrl,
  bitlabsWallUrl,
  cpxWallUrl,
  isBitlabsConfigured,
  isCpxConfigured,
  offerwallUrl,
  rupeesText,
} from '../../config/earn';
import {
  EarnDay,
  EarnEntry,
  EMPTY_DAY,
  Withdrawal,
  summarize,
  withdrawCheck,
} from '../../services/earnLedger';
import {
  EarnMeta,
  bindDevice,
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

// Ad no-fills in a row this session (the ad card asks the user to try later)
let adNoFill = 0;

export default function EarnScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const uid = user?.id || '';
  const day = useIstDay();
  const [today, setToday] = useState<EarnDay | null>(null);
  const [entries, setEntries] = useState<EarnEntry[]>([]);
  const [meta, setMeta] = useState<EarnMeta>({ deviceHash: null, upi: null });
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
  const adsLeft = Math.max(0, EARN_MAX_ADS_PER_DAY - d.adsCount);

  // ── Actions (all open for every signed-in user) ──
  // Optional rewarded ad: +EARN_AD_COINS (pending) for the first EARN_MAX_ADS_PER_DAY ads of the day
  const watchAd = async () => {
    setBusy('ad');
    try {
      const r = await showRewardedAd('earnRewarded');
      if (r === 'earned') {
        adNoFill = 0;
        const coins = await recordEarnAd(uid);
        Alert.alert('Ad watched', coins ? `+${coins} coins (pending) 🪙` : 'Daily ad coins already collected. Come back tomorrow.');
        return;
      }
      if (r === 'closed') {
        Alert.alert('Ad closed early', 'Watch the ad to the end to get the coins.');
        return;
      }
      adNoFill++;
      Alert.alert('No ad right now', adNoFill >= 2 ? 'No ads are available at the moment. Please try again later.' : 'Could not load an ad. Please check your internet and try again in a minute.');
    } finally {
      setBusy(null);
    }
  };

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

  const openSurveys = async () => {
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

  const openBitlabs = () => {
    if (!isBitlabsConfigured()) {
      Alert.alert('Surveys & offers', 'Coming soon. Check back in a few days.');
      return;
    }
    navigation.navigate('EarnWall', { url: bitlabsWallUrl(uid), title: 'Surveys & offers', kind: 'offer' });
  };

  // Games: the games tab of the surveys & offers wall; the offers wall (which also lists games) when
  // that wall is not set up in this build
  const gamesUrl = (): string | null => (isBitlabsConfigured() ? bitlabsGamesUrl(uid) : offerwallUrl(uid));
  const openGames = () => {
    const url = gamesUrl();
    if (!url) {
      Alert.alert('Games', 'Games are coming soon. Check back in a few days.');
      return;
    }
    navigation.navigate('EarnWall', { url, title: 'Games', kind: 'offer' });
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

        <View style={[ui.card, ui.row]}>
          <View style={ui.flex1}>
            <Text style={ui.h2}>▶️ Watch an ad</Text>
            <Text style={ui.muted}>
              +{EARN_AD_COINS} coins per ad · {adsLeft} of {EARN_MAX_ADS_PER_DAY} left today
            </Text>
          </View>
          {adsLeft > 0 ? (
            <TouchableOpacity style={[ui.btn, busy === 'ad' && ui.btnOff]} onPress={watchAd} disabled={!!busy}>
              {busy === 'ad' ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={ui.btnText}>Watch</Text>}
            </TouchableOpacity>
          ) : (
            <Text style={ui.good}>Done today</Text>
          )}
        </View>

        <View style={ui.card}>
          <Text style={ui.h2}>📝 Surveys</Text>
          <Text style={ui.body}>
            Answer paid surveys and earn coins.
          </Text>
          <TouchableOpacity style={[ui.btn, { marginTop: 10 }, busy === 'survey' ? ui.btnOff : null]} onPress={openSurveys} disabled={!!busy}>
            {busy === 'survey' ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={ui.btnText}>{isCpxConfigured() ? 'Open surveys' : 'Coming soon'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={ui.card}>
          <Text style={ui.h2}>🎯 Offers</Text>
          <Text style={ui.body}>
            Try apps and complete offers to earn coins.
          </Text>
          <TouchableOpacity style={[ui.btn, { marginTop: 10 }]} onPress={openOffers}>
            <Text style={ui.btnText}>{offerwallUrl(uid) ? 'Open offers' : 'Coming soon'}</Text>
          </TouchableOpacity>
        </View>

        <View style={ui.card}>
          <Text style={ui.h2}>📋 Surveys & offers</Text>
          <Text style={ui.body}>
            Surveys, offers and games. Earnings depend on you and the task.
          </Text>
          <TouchableOpacity style={[ui.btn, { marginTop: 10 }]} onPress={openBitlabs}>
            <Text style={ui.btnText}>{isBitlabsConfigured() ? 'Open' : 'Coming soon'}</Text>
          </TouchableOpacity>
        </View>

        <View style={ui.card}>
          <Text style={ui.h2}>🎮 Games</Text>
          <Text style={ui.body}>
            Play games and reach the goals shown to earn coins.
          </Text>
          <TouchableOpacity style={[ui.btn, { marginTop: 10 }]} onPress={openGames}>
            <Text style={ui.btnText}>{gamesUrl() ? 'Play games' : 'Coming soon'}</Text>
          </TouchableOpacity>
        </View>

        {/* No current partner gives a quiz / learning link: shown honestly as Coming soon */}
        <View style={ui.card}>
          <Text style={ui.h2}>🧠 Quizzes & learning</Text>
          <Text style={ui.body}>
            Quizzes and learn-and-earn tasks are on the way.
          </Text>
          <View style={[ui.btnGhost, { marginTop: 10 }]}>
            <Text style={ui.btnGhostText}>Coming soon</Text>
          </View>
        </View>

        <View style={ui.card}>
          <Text style={ui.h2}>🤝 Invite friends</Text>
          <Text style={ui.body}>
            When a friend joins with your code and does their first daily check-in, you both get {EARN_REFERRAL_COINS} coins.
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
