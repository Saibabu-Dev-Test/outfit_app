// Me tab > Earnings: total coins and ₹ value, withdrawable vs pending, tasks completed, a breakdown
// by type (ads, votes, surveys, offers, check-ins, referrals) and the recent history. Read only;
// the ledger is users/{uid}/earnings (services/earnApi.ts).
import React, { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ui } from './ui';
import { rupeesText } from '../config/earn';
import { EARN_TYPES, EARN_TYPE_ICON, EARN_TYPE_LABEL, EarnEntry, Withdrawal, summarize } from '../services/earnLedger';
import { getMyWithdrawals, subscribeEarnings } from '../services/earnApi';
import { timeAgo } from '../utils/date';

const STATUS_TEXT = { pending: 'Pending', approved: 'Approved', reversed: 'Reversed' } as const;

export default function EarningsSection({ uid, onOpenEarn }: { uid: string; onOpenEarn?: () => void }) {
  const [entries, setEntries] = useState<EarnEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => (uid ? subscribeEarnings(uid, setEntries) : undefined), [uid]);
  useEffect(() => {
    if (uid) getMyWithdrawals(uid).then(setWithdrawals);
  }, [uid]);

  const s = useMemo(() => summarize(entries, withdrawals), [entries, withdrawals]);
  const recent = entries.slice(0, showAll ? 30 : 5);

  return (
    <View style={[ui.card, { marginHorizontal: 16 }]}>
      <View style={ui.row}>
        <Text style={[ui.h2, ui.flex1]}>💰 Earnings</Text>
        {onOpenEarn ? (
          <TouchableOpacity onPress={onOpenEarn}>
            <Text style={ui.good}>Earn more ›</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={ui.h1}>
        🪙 {s.totalCoins.toLocaleString('en-IN')} · {rupeesText(s.totalCoins)}
      </Text>
      <Text style={ui.body}>
        Withdrawable {rupeesText(s.withdrawableCoins)} · Pending {rupeesText(s.pendingCoins)}
      </Text>
      <Text style={ui.muted}>
        {s.tasksCompleted} tasks completed{s.withdrawnCoins ? ` · Withdrawn ${rupeesText(s.withdrawnCoins)}` : ''}
      </Text>

      <View style={{ marginTop: 10 }}>
        {EARN_TYPES.map(t => (
          <View key={t} style={[ui.row, { paddingVertical: 3 }]}>
            <Text style={[ui.body, ui.flex1]}>
              {EARN_TYPE_ICON[t]} {EARN_TYPE_LABEL[t]}
            </Text>
            <Text style={ui.body}>
              {s.byType[t].count} · 🪙 {s.byType[t].coins.toLocaleString('en-IN')}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[ui.h2, { marginTop: 10 }]}>Recent</Text>
      {!recent.length ? <Text style={ui.muted}>No earnings yet. Open the Earn tab to start.</Text> : null}
      {recent.map(e => (
        <View key={e.id} style={[ui.row, { paddingVertical: 3 }]}>
          <Text style={[ui.body, ui.flex1]} numberOfLines={1}>
            {EARN_TYPE_ICON[e.type]} {EARN_TYPE_LABEL[e.type]}
            {e.partner && e.partner !== 'app' ? ` · ${e.partner}` : ''} · {timeAgo(e.createdAt)}
          </Text>
          <Text style={e.status === 'reversed' ? ui.bad : e.status === 'approved' ? ui.good : ui.muted}>
            +{e.coins} {STATUS_TEXT[e.status]}
          </Text>
        </View>
      ))}
      {entries.length > 5 ? (
        <TouchableOpacity onPress={() => setShowAll(v => !v)}>
          <Text style={[ui.muted, { marginTop: 6 }]}>{showAll ? 'Show less' : 'Show more'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
