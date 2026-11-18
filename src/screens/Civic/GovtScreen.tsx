// Govt tab: pick a state (and optionally a district) to see departments, welfare schemes, citizen
// services and helplines, researched by AI from public sources on the Worker (civic_data in D1,
// refreshed by a capped cron) plus people's star reviews. Neutral information only: no politics.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { isOwnerUser } from '../../services/adminSystem';
import { useAppLanguage } from '../../i18n/appLanguage';
import { civicText } from '../../i18n/civicLabels';
import { CivicDataResponse, GovtData, civicItem, getGovtData } from '../../services/civicApi';
import { PlacePicker, ReviewsBox, callNumber, fmtDate, openLink, useCivicPlace } from './civicParts';

export default function GovtScreen() {
  const lang = useAppLanguage();
  const T = (k: Parameters<typeof civicText>[1]) => civicText(lang, k);
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [place, setPlace] = useCivicPlace();
  const [res, setRes] = useState<CivicDataResponse<GovtData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!place.state) return;
    setLoading(true);
    setError('');
    try {
      setRes(await getGovtData(place.state, place.district));
    } catch (e: any) {
      setRes(null);
      setError(e?.message || T('error'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.state, place.district]);

  useEffect(() => {
    load();
  }, [load]);

  const d = res?.data;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <View style={[ui.row, { marginBottom: 8 }]}>
          <Text style={[ui.h1, ui.flex1]}>{T('govtTitle')}</Text>
          {isOwnerUser() ? (
            <TouchableOpacity onPress={() => navigation.navigate('AdminCivic')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={ui.muted}>🛡️ Moderate</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <PlacePicker lang={lang} place={place} onChange={setPlace} />
        {loading && !res ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={ui.bad}>{T('error')}</Text> : null}
        {res && !d ? (
          <View style={ui.card}>
            <Text style={ui.body}>{res.status === 'pending' ? T('pending') : res.aiConfigured ? T('noData') : T('aiOff')}</Text>
          </View>
        ) : null}
        {d ? (
          <>
            <View style={ui.card}>
              <Text style={ui.h2}>{T('overview')}</Text>
              <Text style={ui.body}>{d.overview}</Text>
              <Text style={[ui.muted, { marginTop: 6 }]}>
                {T('updated')}: {fmtDate(res!.updatedAt)} · {T('aiInfoNote')}
              </Text>
            </View>
            {d.helplines.length ? (
              <View style={ui.card}>
                <Text style={ui.h2}>📞 {T('helplines')}</Text>
                {d.helplines.map((h, i) => (
                  <View key={`${h.name}${i}`} style={[ui.row, { marginTop: 6 }]}>
                    <Text style={[ui.body, ui.flex1]}>{h.name}</Text>
                    <TouchableOpacity style={ui.btn} onPress={() => callNumber(h.number)}>
                      <Text style={ui.btnText}>{h.number}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
            {d.departments.length ? (
              <View style={ui.card}>
                <Text style={ui.h2}>🏢 {T('departments')}</Text>
                {d.departments.map((x, i) => (
                  <View key={`${x.name}${i}`} style={{ marginTop: 8 }}>
                    <Text style={[ui.body, { fontWeight: '700' }]}>{x.name}</Text>
                    {x.what ? <Text style={ui.body}>{x.what}</Text> : null}
                    <View style={ui.row}>
                      {x.helpline ? (
                        <TouchableOpacity onPress={() => callNumber(x.helpline)} style={{ marginRight: 12 }}>
                          <Text style={[ui.muted, { color: colors.primary }]}>📞 {x.helpline}</Text>
                        </TouchableOpacity>
                      ) : null}
                      {x.website ? (
                        <TouchableOpacity onPress={() => openLink(x.website)}>
                          <Text style={[ui.muted, { color: colors.primary }]}>🔗 {T('open')}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            {d.schemes.length ? (
              <View style={ui.card}>
                <Text style={ui.h2}>🎯 {T('schemes')}</Text>
                {d.schemes.map((x, i) => (
                  <View key={`${x.name}${i}`} style={{ marginTop: 8 }}>
                    <Text style={[ui.body, { fontWeight: '700' }]}>{x.name}</Text>
                    {x.who ? <Text style={ui.body}>👤 {x.who}</Text> : null}
                    {x.benefit ? <Text style={ui.body}>🎁 {x.benefit}</Text> : null}
                    {x.apply ? <Text style={ui.body}>📝 {x.apply}</Text> : null}
                    {x.website ? (
                      <TouchableOpacity onPress={() => openLink(x.website)}>
                        <Text style={[ui.muted, { color: colors.primary }]}>🔗 {T('open')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
            {d.services.length ? (
              <View style={ui.card}>
                <Text style={ui.h2}>🧾 {T('services')}</Text>
                {d.services.map((x, i) => (
                  <View key={`${x.name}${i}`} style={{ marginTop: 8 }}>
                    <Text style={[ui.body, { fontWeight: '700' }]}>{x.name}</Text>
                    {x.how ? <Text style={ui.body}>{x.how}</Text> : null}
                    {x.website ? (
                      <TouchableOpacity onPress={() => openLink(x.website)}>
                        <Text style={[ui.muted, { color: colors.primary }]}>🔗 {T('open')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
        {place.state && res ? <ReviewsBox lang={lang} item={civicItem('govt', place.state, place.district)} userName={user?.name} myUid={user?.id} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
