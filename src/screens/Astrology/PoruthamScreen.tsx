// 💑 Pelli Porutham (పెళ్లి పొరుత్తం): marriage compatibility from two birth stars. You (from your
// saved birth details, or a star picked by hand) and a partner (name + date of birth, optional time
// and place, or nakshatra + rashi directly). The 10 traditional poruthams come from
// utils/porutham.ts; everything is worked out on the phone (no network, no ads).
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StatusBar, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { DobField } from '../../components/DobPicker';
import SelectModal from '../../components/SelectModal';
import TimePickerModal from '../../components/TimePickerModal';
import CityPickerModal from '../../components/CityPickerModal';
import { jathakamFor } from '../../services/birthProfile';
import { NAKSHATRAS, RASHI_EN, rashiIndex } from '../../utils/astro';
import {
  computePorutham,
  nakshatraLabel,
  PORUTHAM_DISCLAIMER,
  PoruthamPerson,
  rashiLabel,
  rashisOfNakshatra,
} from '../../utils/porutham';
import { useBottomSpace } from '../../hooks/useBottomSpace';

interface SelfParams {
  name?: string | null;
  dob?: string | null;
  timeOfBirth?: string | null;
  placeOfBirth?: string | null;
  rashi?: string | null;
  gender?: string | null;
}

interface PersonInput {
  mode: 'dob' | 'star';
  name: string;
  dob: string;
  time: string;
  place: string;
  nak: number | null;
  rashi: number | null;
}

interface Resolved {
  person: PoruthamPerson | null;
  uncertain: boolean; // no birth time and the Moon changed star that day
}

const NAK_OPTIONS = NAKSHATRAS.map((_, i) => nakshatraLabel(i));
const RASHI_OPTIONS = RASHI_EN.map((_, i) => rashiLabel(i));

const resolve = (p: PersonInput): Resolved => {
  if (p.mode === 'dob') {
    const j = p.dob ? jathakamFor({ name: p.name, dob: p.dob, timeOfBirth: p.time || null, placeOfBirth: p.place || null }) : null;
    return j ? { person: { nakshatra: j.nakshatra, rashi: j.rashi }, uncertain: j.uncertain } : { person: null, uncertain: false };
  }
  if (p.nak === null) return { person: null, uncertain: false };
  const rs = rashisOfNakshatra(p.nak);
  const rashi = p.rashi !== null && rs.includes(p.rashi) ? p.rashi : rs.length === 1 ? rs[0] : null;
  return { person: rashi === null ? null : { nakshatra: p.nak, rashi }, uncertain: false };
};

export default function PoruthamScreen({ navigation, route }: { navigation: any; route: any }) {
  const bottomPad = useBottomSpace();
  const { user } = useAuth();
  const self: SelfParams = route?.params?.self || {
    name: user?.name,
    dob: user?.dob,
    timeOfBirth: user?.timeOfBirth,
    placeOfBirth: (user as any)?.placeOfBirth,
    rashi: user?.rashi,
    gender: user?.gender,
  };
  const selfIsBride = (self.gender || '').toLowerCase().startsWith('f');
  const [iAmBride, setIAmBride] = useState(selfIsBride);
  const savedRashi = rashiIndex(self.rashi);
  const [me, setMe] = useState<PersonInput>({
    mode: self.dob ? 'dob' : 'star',
    name: self.name || '',
    dob: self.dob || '',
    time: self.timeOfBirth || '',
    place: self.placeOfBirth || '',
    nak: null,
    rashi: savedRashi >= 0 ? savedRashi : null,
  });
  const [partner, setPartner] = useState<PersonInput>({ mode: 'dob', name: '', dob: '', time: '', place: '', nak: null, rashi: null });

  // Which picker is open: '<who>:<field>'
  const [picker, setPicker] = useState<string | null>(null);

  const meR = useMemo(() => resolve(me), [me]);
  const partnerR = useMemo(() => resolve(partner), [partner]);
  const report = useMemo(() => {
    if (!meR.person || !partnerR.person) return null;
    return iAmBride ? computePorutham(meR.person, partnerR.person) : computePorutham(partnerR.person, meR.person);
  }, [meR, partnerR, iAmBride]);

  const setterOf = (who: 'me' | 'partner') => (who === 'me' ? setMe : setPartner);
  const inputOf = (who: 'me' | 'partner') => (who === 'me' ? me : partner);
  const update = (who: 'me' | 'partner', patch: Partial<PersonInput>) => setterOf(who)(prev => ({ ...prev, ...patch }));

  const personCard = (who: 'me' | 'partner') => {
    const p = inputOf(who);
    const r = who === 'me' ? meR : partnerR;
    const role = (who === 'me') === iAmBride ? 'Bride · వధువు' : 'Groom · వరుడు';
    const rs = p.nak !== null ? rashisOfNakshatra(p.nak) : [];
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {who === 'me' ? 'You · మీరు' : 'Partner · భాగస్వామి'} <Text style={styles.role}>({role})</Text>
        </Text>
        <View style={styles.segment}>
          {(['dob', 'star'] as const).map(m => (
            <TouchableOpacity key={m} style={[styles.segBtn, p.mode === m && styles.segOn]} onPress={() => update(who, { mode: m })}>
              <Text style={[styles.segText, p.mode === m && styles.segTextOn]}>{m === 'dob' ? 'Birth details' : 'Pick star'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {p.mode === 'dob' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={colors.textMuted}
              value={p.name}
              onChangeText={v => update(who, { name: v })}
            />
            <DobField value={p.dob} onChange={d => update(who, { dob: d })} boxStyle={styles.input} />
            <TouchableOpacity style={styles.input} onPress={() => setPicker(`${who}:time`)}>
              <Text style={p.time ? styles.value : styles.placeholder}>{p.time || 'Birth time (optional)'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.input} onPress={() => setPicker(`${who}:place`)}>
              <Text style={p.place ? styles.value : styles.placeholder}>{p.place || 'Birth place (optional)'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.input} onPress={() => setPicker(`${who}:nak`)}>
              <Text style={p.nak !== null ? styles.value : styles.placeholder}>
                {p.nak !== null ? nakshatraLabel(p.nak) : 'Nakshatra · నక్షత్రం'}
              </Text>
            </TouchableOpacity>
            {rs.length > 1 ? (
              <TouchableOpacity style={styles.input} onPress={() => setPicker(`${who}:rashi`)}>
                <Text style={p.rashi !== null && rs.includes(p.rashi) ? styles.value : styles.placeholder}>
                  {p.rashi !== null && rs.includes(p.rashi) ? rashiLabel(p.rashi) : 'Rashi · రాశి'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
        {r.person ? (
          <Text style={styles.star}>
            ⭐ {nakshatraLabel(r.person.nakshatra)} · {rashiLabel(r.person.rashi)}
          </Text>
        ) : null}
        {r.uncertain ? (
          <Text style={styles.note}>No birth time: the Moon changed star that day, so the star may differ. Add the time or pick the star.</Text>
        ) : null}
      </View>
    );
  };

  const [pWho, pField] = (picker || ':').split(':') as ['me' | 'partner', string];
  const pInput = picker ? inputOf(pWho) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle={statusBarStyle()} {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>💑 Pelli Porutham · పెళ్లి పొరుత్తం</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} keyboardShouldPersistTaps="handled">
        <View style={styles.roleRow}>
          <Text style={styles.roleLabel}>I am the</Text>
          <View style={styles.segment}>
            {[true, false].map(b => (
              <TouchableOpacity key={String(b)} style={[styles.segBtn, iAmBride === b && styles.segOn]} onPress={() => setIAmBride(b)}>
                <Text style={[styles.segText, iAmBride === b && styles.segTextOn]}>{b ? 'Bride · వధువు' : 'Groom · వరుడు'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {personCard('me')}
        {personCard('partner')}

        {report ? (
          <View style={[styles.card, report.verdict === 'good' ? styles.good : report.verdict === 'fair' ? styles.fair : styles.low]}>
            <Text style={styles.score}>
              {report.score}/{report.total}
            </Text>
            <Text style={styles.verdict}>{report.verdictText.en}</Text>
            <Text style={styles.verdictTe}>{report.verdictText.te}</Text>
            {report.results.map(x => (
              <View key={x.key} style={styles.row}>
                <Text style={[styles.mark, x.match ? styles.yes : styles.no]}>{x.match ? '✓' : '✗'}</Text>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>
                    {x.name.en} · {x.name.te}
                  </Text>
                  <Text style={styles.why}>{x.why.en}</Text>
                  <Text style={styles.whyTe}>{x.why.te}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>Enter both people's birth details (or pick their stars) to see the poruthams.</Text>
        )}

        <Text style={styles.disclaimer}>{PORUTHAM_DISCLAIMER.en}</Text>
        <Text style={styles.disclaimer}>{PORUTHAM_DISCLAIMER.te}</Text>
      </ScrollView>

      <TimePickerModal
        visible={pField === 'time'}
        value={pInput?.time}
        onConfirm={v => {
          update(pWho, { time: v });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <CityPickerModal
        visible={pField === 'place'}
        selected={pInput?.place}
        onSelect={v => update(pWho, { place: v })}
        onClose={() => setPicker(null)}
      />
      <SelectModal
        visible={pField === 'nak'}
        title="Nakshatra · నక్షత్రం"
        options={NAK_OPTIONS}
        selected={pInput && pInput.nak !== null ? NAK_OPTIONS[pInput.nak] : null}
        onSelect={v => {
          const n = NAK_OPTIONS.indexOf(v);
          if (n >= 0) update(pWho, { nak: n, rashi: rashisOfNakshatra(n)[0] });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <SelectModal
        visible={pField === 'rashi'}
        title="Rashi · రాశి"
        options={pInput && pInput.nak !== null ? rashisOfNakshatra(pInput.nak).map(i => RASHI_OPTIONS[i]) : []}
        selected={pInput && pInput.rashi !== null ? RASHI_OPTIONS[pInput.rashi] : null}
        onSelect={v => {
          const r = RASHI_OPTIONS.indexOf(v);
          if (r >= 0) update(pWho, { rashi: r });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    back: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
    title: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
    content: { padding: spacing.base, paddingBottom: spacing.xxxl },
    roleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    roleLabel: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.semiBold },
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    cardTitle: { fontSize: fontSize.base, fontWeight: fontWeight.extraBold, color: colors.textPrimary, marginBottom: spacing.sm },
    role: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semiBold },
    segment: { flexDirection: 'row', backgroundColor: colors.divider, borderRadius: borderRadius.full, padding: 2, alignSelf: 'flex-start', marginBottom: spacing.sm },
    segBtn: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: borderRadius.full },
    segOn: { backgroundColor: colors.background },
    segText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.semiBold },
    segTextOn: { color: colors.primary, fontWeight: fontWeight.bold },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      marginBottom: spacing.sm,
      color: colors.textPrimary,
      fontSize: fontSize.sm,
    },
    value: { fontSize: fontSize.sm, color: colors.textPrimary },
    placeholder: { fontSize: fontSize.sm, color: colors.textMuted },
    star: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.bold, marginTop: 2 },
    note: { fontSize: fontSize.xs, color: colors.textMuted, fontStyle: 'italic', marginTop: 4, lineHeight: 16 },
    good: { borderColor: '#2E7D32', borderWidth: 1.5 },
    fair: { borderColor: '#F9A825', borderWidth: 1.5 },
    low: { borderColor: '#C62828', borderWidth: 1.5 },
    score: { fontSize: 36, fontWeight: fontWeight.extraBold, color: colors.primary, textAlign: 'center' },
    verdict: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: fontWeight.semiBold, textAlign: 'center' },
    verdictTe: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
    row: { flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.divider },
    mark: { width: 24, fontSize: fontSize.base, fontWeight: fontWeight.extraBold },
    yes: { color: '#2E7D32' },
    no: { color: '#C62828' },
    rowBody: { flex: 1 },
    rowTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
    why: { fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 16, marginTop: 1 },
    whyTe: { fontSize: fontSize.xs, color: colors.textMuted, lineHeight: 16 },
    hint: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', marginVertical: spacing.md },
    disclaimer: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 16 },
  }),
);
