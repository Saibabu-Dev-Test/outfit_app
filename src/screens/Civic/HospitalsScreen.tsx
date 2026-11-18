// Hospitals tab: government / private hospitals for a state (or district) from the Worker
// (civic_data in D1, researched with Google Search: address, phone only when found, specialities,
// 24x7 emergency, Aarogyasri / Dr NTR Vaidya Seva / PM-JAY empanelment, website, map link, sources),
// each item in the app language (Telugu / Hindi) AND English, people's reviews per hospital, and
// "Hospital AI" that answers ONLY from the stored list (services/hospitalAi.ts). 108 / 112 always on
// top; the AI never diagnoses and always says to verify with the hospital.
import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { isOwnerUser } from '../../services/adminSystem';
import { useAppLanguage } from '../../i18n/appLanguage';
import { civicText } from '../../i18n/civicLabels';
import { stateByCodeApp } from './stateName';
import { HospData, HospVariant, Hospital, civicItem, getHospData } from '../../services/civicApi';
import { askHospitalAi, hospitalAiAvailable } from '../../services/hospitalAi';
import { AiLanguage, AiTurn } from '../../services/aiStylist';
import { CivicStatus, PlacePicker, ReviewsBox, SourcesBox, callNumber, openLink, useCivicPlace } from './civicParts';
import { Bi, biLabel } from './bi';
import { useCivicData } from './useCivicData';

function HospitalCard({
  h,
  t,
  lang,
  item,
  userName,
  myUid,
}: {
  h: Hospital;
  t?: Hospital | null;
  lang: ReturnType<typeof useAppLanguage>;
  item: string;
  userName?: string;
  myUid?: string;
}) {
  const T = (k: Parameters<typeof civicText>[1]) => civicText(lang, k);
  const [open, setOpen] = useState(false);
  const join = (xs?: string[]) => (xs && xs.length ? xs.join(' • ') : '');
  return (
    <View style={ui.card}>
      <TouchableOpacity onPress={() => setOpen(v => !v)} activeOpacity={0.8}>
        <Bi en={h.name} tr={t?.name} style={ui.h2} />
        {h.type ? <Bi en={h.type} tr={t?.type} style={ui.muted} /> : null}
        {h.emergency24x7 ? <Text style={ui.good}>🚑 24x7 {biLabel(lang, 'emergency')}</Text> : null}
        {h.address ? <Bi prefix="📍 " en={h.address} tr={t?.address} /> : null}
        {h.specialities.length ? <Bi prefix="🩺 " en={join(h.specialities)} tr={join(t?.specialities)} style={ui.muted} /> : null}
        {h.schemes.length ? (
          <View style={{ marginTop: 4 }}>
            <Text style={ui.muted}>🪪 {biLabel(lang, 'schemesAccepted')}</Text>
            <Bi en={h.schemes.join(', ')} tr={t?.schemes?.join(', ')} />
          </View>
        ) : null}
        {h.note ? <Bi en={h.note} tr={t?.note} style={ui.muted} /> : null}
      </TouchableOpacity>
      <View style={[ui.row, { marginTop: 6, flexWrap: 'wrap' }]}>
        {h.phone ? (
          <TouchableOpacity style={[ui.btnGhost, { marginRight: 8, marginTop: 4 }]} onPress={() => callNumber(h.phone)}>
            <Text style={ui.btnGhostText}>📞 {h.phone}</Text>
          </TouchableOpacity>
        ) : null}
        {h.mapUrl ? (
          <TouchableOpacity style={[ui.btnGhost, { marginRight: 8, marginTop: 4 }]} onPress={() => openLink(h.mapUrl as string)}>
            <Text style={ui.btnGhostText}>🗺️ {T('map')}</Text>
          </TouchableOpacity>
        ) : null}
        {h.website ? (
          <TouchableOpacity style={[ui.btnGhost, { marginTop: 4 }]} onPress={() => openLink(h.website)}>
            <Text style={ui.btnGhostText}>🔗 {T('open')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {open ? <ReviewsBox lang={lang} item={item} userName={userName} myUid={myUid} /> : null}
    </View>
  );
}

export default function HospitalsScreen() {
  const lang = useAppLanguage();
  const T = (k: Parameters<typeof civicText>[1]) => civicText(lang, k);
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [place, setPlace] = useCivicPlace();
  const [variant, setVariant] = useState<HospVariant>('govt');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [history, setHistory] = useState<AiTurn[]>([]);
  const { res, phase, errorText, refresh, tr } = useCivicData<HospData>('hosp', place.state, place.district, variant, lang, () =>
    getHospData(place.state, variant, place.district),
  );
  const placeKey = `${place.state}|${place.district}|${variant}`;
  const [lastKey, setLastKey] = useState(placeKey);
  if (lastKey !== placeKey) {
    setLastKey(placeKey);
    setAnswer('');
    setHistory([]);
  }

  const list = res?.data?.hospitals || [];
  const trList = (tr && res?.i18n?.[tr]?.hospitals) || [];
  const aiLang: AiLanguage = lang;

  const ask = async () => {
    const q = question.trim();
    if (!q || !user?.id || !list.length) return;
    setAsking(true);
    try {
      const where = `${place.district ? `${place.district}, ` : ''}${stateByCodeApp(place.state)} (${variant === 'govt' ? 'government' : 'private'} hospitals)`;
      const turns: AiTurn[] = [...history, { role: 'user' as const, text: q }].slice(-6);
      const a = await askHospitalAi(user.id, where, list, turns, aiLang);
      setAnswer(a);
      setHistory([...turns, { role: 'model' as const, text: a }].slice(-6));
      setQuestion('');
    } catch (e: any) {
      Alert.alert(T('askHospAi'), e?.message || T('error'));
    } finally {
      setAsking(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={phase === 'loading' && !!res} onRefresh={refresh} />}>
        <View style={[ui.row, { marginBottom: 8 }]}>
          <Text style={[ui.h1, ui.flex1]}>{T('hospTitle')}</Text>
          {isOwnerUser() ? (
            <TouchableOpacity onPress={() => navigation.navigate('AdminCivic')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={ui.muted}>🛡️ Moderate</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={[ui.card, { borderColor: '#C62828' }]}>
          <Text style={ui.bad}>🚑 {T('emergencyLine')}</Text>
          <View style={[ui.row, { marginTop: 8 }]}>
            <TouchableOpacity style={[ui.btn, { marginRight: 8, backgroundColor: '#C62828' }]} onPress={() => callNumber('108')}>
              <Text style={ui.btnText}>📞 108</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[ui.btn, { backgroundColor: '#C62828' }]} onPress={() => callNumber('112')}>
              <Text style={ui.btnText}>📞 112</Text>
            </TouchableOpacity>
          </View>
        </View>
        <PlacePicker lang={lang} place={place} onChange={setPlace} />
        <View style={[ui.row, { marginBottom: 8 }]}>
          {(['govt', 'private'] as HospVariant[]).map(v => (
            <TouchableOpacity key={v} style={[ui.chip, v === variant && ui.chipOn]} onPress={() => setVariant(v)}>
              <Text style={[ui.chipText, v === variant && ui.chipTextOn]}>{v === 'govt' ? T('govtHosp') : T('privateHosp')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {place.state ? <CivicStatus lang={lang} phase={phase} hasData={list.length > 0} aiConfigured={!!res?.aiConfigured} errorText={errorText} /> : null}
        {list.length ? (
          <>
            <Text style={[ui.muted, { marginBottom: 8 }]}>⚠️ {T('verify')}{lang !== 'English' ? `\n${civicText('English', 'verify')}` : ''}</Text>
            {hospitalAiAvailable() ? (
              <View style={ui.card}>
                <Text style={ui.h2}>🤖 {T('askHospAi')}</Text>
                <Text style={ui.muted}>{T('hospAiNote')}</Text>
                <TextInput
                  style={ui.input}
                  value={question}
                  onChangeText={setQuestion}
                  placeholder={T('askHospHint')}
                  placeholderTextColor={colors.textMuted}
                  maxLength={300}
                  onSubmitEditing={ask}
                  returnKeyType="send"
                />
                <TouchableOpacity style={[ui.btn, (asking || !question.trim()) && ui.btnOff]} disabled={asking || !question.trim()} onPress={ask}>
                  <Text style={ui.btnText}>{asking ? '…' : T('ask')}</Text>
                </TouchableOpacity>
                {answer ? <Text style={[ui.body, { marginTop: 10 }]}>{answer}</Text> : null}
              </View>
            ) : null}
            {list.map((h, i) => (
              <HospitalCard
                key={h.slug}
                h={h}
                t={trList[i] || null}
                lang={lang}
                item={civicItem('hosp', place.state, place.district, h.slug)}
                userName={user?.name}
                myUid={user?.id}
              />
            ))}
            <SourcesBox lang={lang} sources={res?.sources} updatedAt={res?.updatedAt || 0} asOf={res?.data?.asOf} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
