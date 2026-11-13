// Me > 💑 Pelli Porutham: bride's and groom's birth details -> Moon nakshatra / rashi from the
// offline birth-chart engine (utils/jathakam.ts) -> the 10 South-Indian poruthams (utils/porutham.ts).
// Free: score, verdict and one line per porutham. Detailed explanation: one rewarded ad (today).
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenShell from '../../components/ScreenShell';
import { ui } from '../../components/ui';
import KeyboardSafeView from '../../components/KeyboardSafeView';
import { DobField } from '../../components/DobPicker';
import TimePickerModal from '../../components/TimePickerModal';
import CityPickerModal from '../../components/CityPickerModal';
import RewardedUnlockButton from '../../ads/RewardedUnlockButton';
import { isUnlockedToday } from '../../ads/rewardUnlocks';
import { useAuth } from '../../context/AuthContext';
import { computeJathakam, DEFAULT_PLACE } from '../../utils/jathakam';
import { birthPlaceOf } from '../../constants/indianCities';
import { NAKSHATRA_NAMES, RASHI_NAMES } from '../../i18n/astroNames';
import { matchPorutham } from '../../utils/porutham';

interface Person {
  name: string;
  dob: string;
  time: string;
  place: string;
}
const EMPTY: Person = { name: '', dob: '', time: '', place: '' };

const chartOf = (p: Person) =>
  p.dob ? computeJathakam({ dob: p.dob, timeOfBirth: p.time || null, name: p.name }, birthPlaceOf(p.place) || DEFAULT_PLACE) : null;

export default function PoruthamScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const [bride, setBride] = useState<Person>(EMPTY);
  const [groom, setGroom] = useState<Person>(EMPTY);
  const [timeFor, setTimeFor] = useState<'bride' | 'groom' | null>(null);
  const [placeFor, setPlaceFor] = useState<'bride' | 'groom' | null>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    isUnlockedToday('porutham').then(setFull).catch(() => undefined);
  }, []);

  const bc = useMemo(() => chartOf(bride), [bride]);
  const gc = useMemo(() => chartOf(groom), [groom]);
  const result = useMemo(
    () => (bc && gc ? matchPorutham({ nakshatra: bc.nakshatra, rashi: bc.rashi }, { nakshatra: gc.nakshatra, rashi: gc.rashi }) : null),
    [bc, gc],
  );

  const set = (who: 'bride' | 'groom', patch: Partial<Person>) =>
    who === 'bride' ? setBride(p => ({ ...p, ...patch })) : setGroom(p => ({ ...p, ...patch }));

  const personCard = (who: 'bride' | 'groom', p: Person, chart: ReturnType<typeof chartOf>) => (
    <View style={ui.card} key={who}>
      <Text style={ui.h2}>{who === 'bride' ? '👰 Bride (ammayi)' : '🤵 Groom (abbayi)'}</Text>
      <Text style={ui.muted}>Name</Text>
      <TextInput style={ui.input} value={p.name} onChangeText={t => set(who, { name: t })} placeholder="Name" />
      <Text style={ui.muted}>Date of birth</Text>
      <DobField value={p.dob} onChange={d => set(who, { dob: d })} />
      <View style={[ui.row, { marginTop: 8 }]}>
        <TouchableOpacity style={[ui.btnGhost, ui.flex1, { marginRight: 6 }]} onPress={() => setTimeFor(who)}>
          <Text style={ui.btnGhostText}>{p.time ? `⏰ ${p.time}` : '⏰ Birth time (optional)'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ui.btnGhost, ui.flex1]} onPress={() => setPlaceFor(who)}>
          <Text style={ui.btnGhostText} numberOfLines={1}>
            {p.place ? `📍 ${p.place.split(',')[0]}` : '📍 Birth place'}
          </Text>
        </TouchableOpacity>
      </View>
      {chart ? (
        <Text style={[ui.body, { marginTop: 8 }]}>
          ⭐ {NAKSHATRA_NAMES.English[chart.nakshatra]} pada {chart.pada + 1} · 🌙 {RASHI_NAMES.English[chart.rashi]}
          {chart.uncertain ? '\n(The Moon changed star that day: add the birth time for an exact star)' : ''}
        </Text>
      ) : null}
    </View>
  );

  return (
    <ScreenShell title="Pelli Porutham" navigation={navigation}>
      <KeyboardSafeView>
        <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[ui.body, { marginBottom: 12 }]}>
            Enter both birth details. We find each person's birth star and rashi on your phone and check the 10 South-Indian poruthams.
          </Text>
          {personCard('bride', bride, bc)}
          {personCard('groom', groom, gc)}

          {result ? (
            <View style={ui.card}>
              <Text style={ui.h1}>
                {result.score}/10 {result.verdict === 'excellent' ? '💚' : result.verdict === 'good' ? '💛' : result.verdict === 'average' ? '🧡' : '❤️‍🩹'}
              </Text>
              <Text style={[ui.body, { marginBottom: 8 }]}>{result.summary}</Text>
              {result.items.map(i => (
                <View key={i.id} style={{ marginBottom: full ? 10 : 4 }}>
                  <Text style={i.match ? ui.good : ui.bad}>
                    {i.match ? '✓' : '✗'} {i.name}
                    {i.id === 'rajju' || i.id === 'vedha' ? ' (essential)' : ''}
                  </Text>
                  <Text style={ui.body}>{i.short}</Text>
                  {full ? <Text style={ui.muted}>{i.detail}</Text> : null}
                </View>
              ))}
              {!full ? (
                <RewardedUnlockButton
                  feature="porutham"
                  uid={user?.id}
                  label="Watch ad for detailed explanation"
                  onUnlocked={() => setFull(true)}
                />
              ) : null}
              <Text style={[ui.muted, { marginTop: 8 }]}>
                Traditional guidance only. For a marriage decision please also consult a family astrologer with full horoscopes.
              </Text>
            </View>
          ) : (
            <Text style={ui.muted}>Add both dates of birth to see the match.</Text>
          )}
        </ScrollView>
      </KeyboardSafeView>

      <TimePickerModal
        visible={!!timeFor}
        value={timeFor === 'bride' ? bride.time : groom.time}
        onConfirm={v => {
          if (timeFor) set(timeFor, { time: v });
          setTimeFor(null);
        }}
        onClose={() => setTimeFor(null)}
      />
      <CityPickerModal
        visible={!!placeFor}
        selected={placeFor === 'bride' ? bride.place : groom.place}
        onSelect={l => {
          if (placeFor) set(placeFor, { place: l });
          setPlaceFor(null);
        }}
        onClose={() => setPlaceFor(null)}
      />
    </ScreenShell>
  );
}
