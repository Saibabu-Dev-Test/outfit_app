// Owner only: moderation for the Govt / Hospitals tabs. Reported and recent people's reviews (hide /
// unhide), civic AI data status, today's AI research count vs the daily cap, recent research errors,
// and "Refresh now" for one place. Opened from the 🛡️ link in the Govt / Hospitals tab titles (shown
// to the owner only). The Worker checks the verified owner email on every call too.
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import EarnShell from '../Earn/EarnShell';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { isOwnerUser } from '../../services/adminSystem';
import { INDIA_STATES } from '../../constants/indiaStates';
import { AdminCivic, AiProviders, CivicKind, CivicReview, getAdminCivic, refreshCivic, setReviewHidden } from '../../services/civicApi';
import { fmtDate } from '../Civic/civicParts';

const TARGETS: { label: string; kind: CivicKind; variant: string }[] = [
  { label: 'Govt', kind: 'govt', variant: '' },
  { label: 'Hosp (govt)', kind: 'hosp', variant: 'govt' },
  { label: 'Hosp (private)', kind: 'hosp', variant: 'private' },
];

function ReviewRow({ r, onToggle }: { r: CivicReview; onToggle: (r: CivicReview) => void }) {
  return (
    <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
      <Text style={ui.muted}>
        {r.item} · {r.userName} · {'★'.repeat(r.stars)} · {fmtDate(r.updatedAt)}
        {r.reportCount ? ` · ⚑ ${r.reportCount}` : ''}
        {r.hidden ? ' · HIDDEN' : ''}
      </Text>
      {r.body ? <Text style={ui.body}>{r.body}</Text> : null}
      <TouchableOpacity style={[ui.btnGhost, { alignSelf: 'flex-start', marginTop: 4 }]} onPress={() => onToggle(r)}>
        <Text style={ui.btnGhostText}>{r.hidden ? 'Unhide' : 'Hide'}</Text>
      </TouchableOpacity>
    </View>
  );
}


// AI fallback chain on the Worker, one line: "Gemini 2/3 keys ready · Groq ready · Workers AI ready"
export const providersLine = (p: AiProviders): string =>
  [
    `Gemini ${p.gemini.ready}/${p.gemini.keys} key${p.gemini.keys === 1 ? '' : 's'} ready`,
    `Groq ${!p.groq.configured ? 'not set' : p.groq.coolingUntil ? 'cooling down' : 'ready'}`,
    `Workers AI ${!p.workersAi.configured ? 'off' : p.workersAi.coolingUntil ? 'cooling down' : 'ready'}`,
  ].join(' · ');

export default function AdminCivicScreen({ navigation }: { navigation: any }) {
  const owner = isOwnerUser();
  const [snap, setSnap] = useState<AdminCivic | null>(null);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState('TG');
  const [district, setDistrict] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    if (!owner) return;
    setLoading(true);
    try {
      setSnap(await getAdminCivic());
    } catch (e: any) {
      Alert.alert('Moderation', e?.message || 'Could not load');
    } finally {
      setLoading(false);
    }
  }, [owner]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggle = async (r: CivicReview) => {
    try {
      await setReviewHidden(r.item, r.author, !r.hidden);
      load();
    } catch (e: any) {
      Alert.alert('Moderation', e?.message || 'Failed');
    }
  };

  const refresh = async (kind: CivicKind, variant: string, label: string) => {
    setBusy(label);
    try {
      const r = await refreshCivic(kind, state, district, variant);
      Alert.alert('Refresh', r.ok ? 'Updated' : `Not updated: ${r.error || 'unknown'}`);
      load();
    } catch (e: any) {
      Alert.alert('Refresh', e?.message || 'Failed');
    } finally {
      setBusy('');
    }
  };

  if (!owner) {
    return (
      <EarnShell title="🛡️ Civic moderation" navigation={navigation}>
        <View style={ui.scroll}>
          <Text style={ui.body}>Owner only.</Text>
        </View>
      </EarnShell>
    );
  }

  return (
    <EarnShell title="🛡️ Civic moderation" navigation={navigation}>
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        {loading && !snap ? <ActivityIndicator color={colors.primary} /> : null}
        {snap ? (
          <View style={ui.card}>
            <Text style={ui.h2}>AI research</Text>
            <Text style={snap.aiConfigured ? ui.good : ui.bad}>{snap.aiConfigured ? 'GEMINI_API_KEY set on Worker' : 'GEMINI_API_KEY not set on Worker (research off)'}</Text>
            <Text style={ui.body}>
              Today: {snap.aiToday} / {snap.aiDailyMax}
            </Text>
            {snap.aiProviders ? <Text style={ui.muted}>{providersLine(snap.aiProviders)}</Text> : null}
            {snap.data.map(d => (
              <Text key={`${d.kind}${d.status}`} style={ui.muted}>
                {d.kind} · {d.status}: {d.count} (oldest {fmtDate(d.oldest)})
              </Text>
            ))}
            {snap.errors.map(e => (
              <Text key={`${e.kind}${e.state}${e.district}${e.variant}`} style={ui.bad}>
                {e.kind} {e.state} {e.district || '-'} {e.variant}: {e.error}
              </Text>
            ))}
          </View>
        ) : null}
        <View style={ui.card}>
          <Text style={ui.h2}>Refresh one place now</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {INDIA_STATES.map(s => (
              <TouchableOpacity key={s.code} style={[ui.chip, s.code === state && ui.chipOn]} onPress={() => setState(s.code)}>
                <Text style={[ui.chipText, s.code === state && ui.chipTextOn]}>{s.code}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput style={ui.input} value={district} onChangeText={setDistrict} placeholder="District (empty = state)" placeholderTextColor={colors.textMuted} />
          <View style={[ui.row, { flexWrap: 'wrap' }]}>
            {TARGETS.map(t => (
              <TouchableOpacity key={t.label} style={[ui.btn, { marginRight: 8, marginBottom: 8 }, !!busy && ui.btnOff]} disabled={!!busy} onPress={() => refresh(t.kind, t.variant, t.label)}>
                <Text style={ui.btnText}>{busy === t.label ? '…' : t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={ui.card}>
          <Text style={ui.h2}>Reported reviews ({snap?.reported.length || 0})</Text>
          {(snap?.reported || []).map(r => (
            <ReviewRow key={`r${r.item}${r.author}`} r={r} onToggle={toggle} />
          ))}
        </View>
        <View style={ui.card}>
          <Text style={ui.h2}>Recent reviews</Text>
          {(snap?.recent || []).map(r => (
            <ReviewRow key={`n${r.item}${r.author}`} r={r} onToggle={toggle} />
          ))}
        </View>
      </ScrollView>
    </EarnShell>
  );
}
