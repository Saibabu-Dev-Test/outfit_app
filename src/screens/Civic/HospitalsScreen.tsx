// Hospitals tab: government / private hospitals for a state (or district) from the Worker
// (civic_data in D1, AI-researched from public sources), people's reviews per hospital, and
// "Hospital AI" that answers ONLY from the stored list (services/hospitalAi.ts). 108 / 112 always on
// top; the AI never diagnoses and always says to verify with the hospital.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useAppLanguage } from '../../i18n/appLanguage';
import { civicText } from '../../i18n/civicLabels';
import { stateByCodeApp } from './stateName';
import { CivicDataResponse, HospData, HospVariant, Hospital, civicItem, getHospData } from '../../services/civicApi';
import { askHospitalAi, hospitalAiAvailable } from '../../services/hospitalAi';
import { AiLanguage, AiTurn } from '../../services/aiStylist';
import { PlacePicker, ReviewsBox, Stars, callNumber, fmtDate, openLink, useCivicPlace } from './civicParts';

function HospitalCard({ h, lang, item, userName, myUid }: { h: Hospital; lang: ReturnType<typeof useAppLanguage>; item: string; userName?: string; myUid?: string }) {
  const T = (k: Parameters<typeof civicText>[1]) => civicText(lang, k);
  const [open, setOpen] = useState(false);
  return (
    <View style={ui.card}>
      <TouchableOpacity onPress={() => setOpen(v => !v)} activeOpacity={0.8}>
        <View style={ui.row}>
          <Text style={[ui.h2, ui.flex1]}>{h.name}</Text>
          {h.stars !== null ? <Stars value={h.stars} size={14} /> : null}
        </View>
        {h.emergency24x7 ? <Text style={ui.good}>🚑 24x7 {T('emergency')}</Text> : null}
        {h.address ? <Text style={ui.body}>📍 {h.address}</Text> : null}
        {h.specialities.length ? <Text style={ui.muted}>{h.specialities.join(' • ')}</Text> : null}
        {h.schemes.length ? <Text style={ui.muted}>🪪 {h.schemes.join(', ')}</Text> : null}
        {h.note ? <Text style={ui.muted}>{h.note}</Text> : null}
      </TouchableOpacity>
      <View style={[ui.row, { marginTop: 6 }]}>
        {h.phone ? (
          <TouchableOpacity style={[ui.btnGhost, { marginRight: 8 }]} onPress={() => callNumber(h.phone)}>
            <Text style={ui.btnGhostText}>📞 {h.phone}</Text>
          </TouchableOpacity>
        ) : null}
        {h.website ? (
          <TouchableOpacity style={ui.btnGhost} onPress={() => openLink(h.website)}>
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
  const [place, setPlace] = useCivicPlace();
  const [variant, setVariant] = useState<HospVariant>('govt');
  const [res, setRes] = useState<CivicDataResponse<HospData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [history, setHistory] = useState<AiTurn[]>([]);

  const load = useCallback(async () => {
    if (!place.state) return;
    setLoading(true);
    setError('');
    setAnswer('');
    setHistory([]);
    try {
      setRes(await getHospData(place.state, variant, place.district));
    } catch (e: any) {
      setRes(null);
      setError(e?.message || 'error');
    } finally {
      setLoading(false);
    }
  }, [place.state, place.district, variant]);

  useEffect(() => {
    load();
  }, [load]);

  const list = res?.data?.hospitals || [];
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
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <Text style={[ui.h1, { marginBottom: 8 }]}>{T('hospTitle')}</Text>
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
        {loading && !res ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={ui.bad}>{T('error')}</Text> : null}
        {res && !list.length ? (
          <View style={ui.card}>
            <Text style={ui.body}>{res.status === 'pending' ? T('pending') : res.aiConfigured ? T('noData') : T('aiOff')}</Text>
          </View>
        ) : null}
        {list.length ? (
          <>
            <Text style={[ui.muted, { marginBottom: 8 }]}>
              {T('updated')}: {fmtDate(res!.updatedAt)} · {T('aiInfoNote')} {T('verify')}
            </Text>
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
            {list.map(h => (
              <HospitalCard
                key={h.slug}
                h={h}
                lang={lang}
                item={civicItem('hosp', place.state, place.district, h.slug)}
                userName={user?.name}
                myUid={user?.id}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
