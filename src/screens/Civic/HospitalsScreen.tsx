// Hospitals tab: government / private hospitals for a state (or district) from the Worker
// (civic_data in D1, researched with Google Search: address, phone only when found, specialities,
// 24x7 emergency, Aarogyasri / Dr NTR Vaidya Seva / PM-JAY empanelment, website, map link, sources),
// each item in the app language (Telugu / Hindi) AND English, people's reviews per hospital, and
// "Hospital AI" that answers ONLY from the stored list (services/hospitalAi.ts). 108 / 112 always on
// top; the AI never diagnoses and always says to verify with the hospital.
// Filter Government / Private / All, "Where to go for…" disease / speciality search over the loaded
// public data (services/hospitalSearch.ts), and an optional facts-only order by the count of listed
// specialities + facilities (never a rating). Per hospital: timings, 24x7, specialities, what it is
// publicly stated to be special for, publicly listed specialist doctors (+ experience), facilities,
// schemes, map link, source URLs; anything no public source states shows "Public info not available".
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
import { factsCount, searchHospitals, sortByFacts } from '../../services/hospitalSearch';
import { askHospitalAi, hospitalAiAvailable } from '../../services/hospitalAi';
import { AiLanguage, AiTurn } from '../../services/aiStylist';
import { CivicStatus, PlacePicker, ReviewsBox, SourcesBox, callNumber, openLink, useCivicPlace } from './civicParts';
import { Bi, biLabel } from './bi';
import { useCivicData } from './useCivicData';

type HospFilter = HospVariant | 'all';

// "Label: Public info not available" when a public source did not state the value
function NA({ lang, label }: { lang: ReturnType<typeof useAppLanguage>; label: Parameters<typeof civicText>[1] }) {
  return (
    <Text style={[ui.muted, { fontSize: 12 }]}>
      {civicText(lang, label)}: {biLabel(lang, 'publicNA')}
    </Text>
  );
}

function HospitalCard({
  h,
  t,
  lang,
  item,
  userName,
  myUid,
  kindLabel,
  matched,
  showCount,
}: {
  h: Hospital;
  t?: Hospital | null;
  lang: ReturnType<typeof useAppLanguage>;
  item: string;
  userName?: string;
  myUid?: string;
  kindLabel?: string;
  matched?: string[];
  showCount?: boolean;
}) {
  const T = (k: Parameters<typeof civicText>[1]) => civicText(lang, k);
  const [open, setOpen] = useState(false);
  const join = (xs?: string[]) => (xs && xs.length ? xs.join(' • ') : '');
  const host = (u: string) => u.replace(/^https:\/\//, '').split('/')[0];
  const n = factsCount(h);
  return (
    <View style={ui.card}>
      <TouchableOpacity onPress={() => setOpen(v => !v)} activeOpacity={0.8}>
        <Bi en={h.name} tr={t?.name} style={ui.h2} />
        {kindLabel ? <Text style={[ui.muted, { fontSize: 12 }]}>🏷️ {kindLabel}</Text> : null}
        {h.type ? <Bi en={h.type} tr={t?.type} style={ui.muted} /> : null}
        {matched && matched.length ? (
          <Text style={[ui.good, { marginTop: 2 }]}>
            🔎 {T('matches')}: {matched.join(' • ')}
          </Text>
        ) : null}
        {showCount ? (
          <Text style={[ui.muted, { fontSize: 12 }]}>
            🩺 {n.specialities} {T('specialities')} · 🏥 {n.facilities} {T('facilities')}
          </Text>
        ) : null}
        {h.emergency24x7 ? <Text style={ui.good}>🚑 24x7 {biLabel(lang, 'emergency')}</Text> : <NA lang={lang} label="emergency24" />}
        {h.timings ? <Bi prefix={`🕒 ${T('timings')}: `} en={h.timings} tr={t?.timings} /> : <NA lang={lang} label="timings" />}
        {h.address ? <Bi prefix="📍 " en={h.address} tr={t?.address} /> : <NA lang={lang} label="address" />}
        {h.specialities.length ? <Bi prefix="🩺 " en={join(h.specialities)} tr={join(t?.specialities)} style={ui.muted} /> : <NA lang={lang} label="specialities" />}
        {h.schemes.length ? (
          <View style={{ marginTop: 4 }}>
            <Text style={ui.muted}>🪪 {biLabel(lang, 'schemesAccepted')}</Text>
            <Bi en={h.schemes.join(', ')} tr={t?.schemes?.join(', ')} />
          </View>
        ) : (
          <NA lang={lang} label="schemesAccepted" />
        )}
        {h.note ? <Bi en={h.note} tr={t?.note} style={ui.muted} /> : null}
        {!h.phone ? <NA lang={lang} label="phone" /> : null}
      </TouchableOpacity>
      {open ? (
        <View style={{ marginTop: 6 }}>
          <Text style={[ui.muted, { marginTop: 4 }]}>⭐ {biLabel(lang, 'specialFor')}</Text>
          {h.specialFor && h.specialFor.length ? <Bi en={join(h.specialFor)} tr={join(t?.specialFor)} /> : <Text style={[ui.muted, { fontSize: 12 }]}>{biLabel(lang, 'publicNA')}</Text>}
          <Text style={[ui.muted, { marginTop: 6 }]}>👩‍⚕️ {biLabel(lang, 'doctors')}</Text>
          {h.doctors && h.doctors.length ? (
            h.doctors.map((d, i) => {
              const td = t?.doctors?.[i];
              return (
                <View key={`${d.name}${i}`} style={{ marginTop: 4 }}>
                  <Bi en={[d.name, d.qualification].filter(Boolean).join(', ')} tr={td ? [td.name, td.qualification].filter(Boolean).join(', ') : undefined} style={[ui.body, { fontWeight: '700' }]} />
                  {d.speciality ? <Bi en={d.speciality} tr={td?.speciality} style={ui.muted} /> : null}
                  <Text style={[ui.muted, { fontSize: 12 }]}>
                    {T('experience')}: {d.experience || civicText(lang, 'publicNA')}
                  </Text>
                  <TouchableOpacity onPress={() => openLink(d.source)}>
                    <Text style={[ui.muted, { fontSize: 12, color: colors.primary }]}>🔗 {host(d.source)}</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <Text style={[ui.muted, { fontSize: 12 }]}>{biLabel(lang, 'publicNA')}</Text>
          )}
          <Text style={[ui.muted, { marginTop: 6 }]}>🏥 {biLabel(lang, 'facilities')}</Text>
          {h.facilities && h.facilities.length ? <Bi en={join(h.facilities)} tr={join(t?.facilities)} /> : <Text style={[ui.muted, { fontSize: 12 }]}>{biLabel(lang, 'publicNA')}</Text>}
          <Text style={[ui.muted, { marginTop: 6 }]}>📚 {biLabel(lang, 'sources')}</Text>
          {h.sources && h.sources.length ? (
            h.sources.map(u => (
              <TouchableOpacity key={u} onPress={() => openLink(u)}>
                <Text style={[ui.muted, { fontSize: 12, color: colors.primary }]} numberOfLines={1}>
                  🔗 {host(u)}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={[ui.muted, { fontSize: 12 }]}>{biLabel(lang, 'publicNA')}</Text>
          )}
        </View>
      ) : null}
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
  const [variant, setVariant] = useState<HospFilter>('govt');
  const [where, setWhere] = useState('');
  const [byFacts, setByFacts] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [history, setHistory] = useState<AiTurn[]>([]);
  // One loader per kind; a loader whose kind is filtered out gets state '' (no request at all)
  const useGovt = variant === 'govt' || variant === 'all';
  const usePriv = variant === 'private' || variant === 'all';
  const gov = useCivicData<HospData>('hosp', useGovt ? place.state : '', place.district, 'govt', lang, () => getHospData(place.state, 'govt', place.district));
  const priv = useCivicData<HospData>('hosp', usePriv ? place.state : '', place.district, 'private', lang, () =>
    getHospData(place.state, 'private', place.district),
  );
  const active = [...(useGovt ? [{ v: 'govt' as HospVariant, d: gov }] : []), ...(usePriv ? [{ v: 'private' as HospVariant, d: priv }] : [])];
  const refresh = () => active.forEach(a => a.d.refresh());
  const phase = active.some(a => a.d.phase === 'loading') ? 'loading' : active[0]?.d.phase;
  const anyRes = active.some(a => !!a.d.res);
  const placeKey = `${place.state}|${place.district}|${variant}`;
  const [lastKey, setLastKey] = useState(placeKey);
  if (lastKey !== placeKey) {
    setLastKey(placeKey);
    setAnswer('');
    setHistory([]);
  }

  const rows = active.flatMap(a => {
    const hs = a.d.res?.data?.hospitals || [];
    const trs = (a.d.tr && a.d.res?.i18n?.[a.d.tr]?.hospitals) || [];
    return hs.map((h, i) => ({ h, t: trs[i] || null, v: a.v }));
  });
  const list = rows.map(r => r.h);
  const found = where.trim() ? searchHospitals(list, where).map(m => ({ ...rows[list.indexOf(m.h)], matched: m.matched })) : rows.map(r => ({ ...r, matched: [] as string[] }));
  const shown = byFacts ? sortByFacts(found) : found;
  const aiLang: AiLanguage = lang;

  const ask = async () => {
    const q = question.trim();
    if (!q || !user?.id || !list.length) return;
    setAsking(true);
    try {
      const placeLabel = `${place.district ? `${place.district}, ` : ''}${stateByCodeApp(place.state)} (${
        variant === 'govt' ? 'government' : variant === 'private' ? 'private' : 'government and private'
      } hospitals)`;
      const turns: AiTurn[] = [...history, { role: 'user' as const, text: q }].slice(-6);
      const a = await askHospitalAi(user.id, placeLabel, list, turns, aiLang);
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
      <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={phase === 'loading' && anyRes} onRefresh={refresh} />}>
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
          {(['govt', 'private', 'all'] as HospFilter[]).map(v => (
            <TouchableOpacity key={v} style={[ui.chip, v === variant && ui.chipOn]} onPress={() => setVariant(v)}>
              <Text style={[ui.chipText, v === variant && ui.chipTextOn]}>{v === 'govt' ? T('govtHosp') : v === 'private' ? T('privateHosp') : T('allHosp')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {place.state
          ? active.map(a => (
              <View key={a.v}>
                {variant === 'all' && a.d.phase !== 'ready' && a.d.phase !== 'idle' ? (
                  <Text style={[ui.muted, { fontSize: 12 }]}>{a.v === 'govt' ? T('govtHosp') : T('privateHosp')}</Text>
                ) : null}
                <CivicStatus
                  lang={lang}
                  phase={a.d.phase}
                  hasData={(a.d.res?.data?.hospitals || []).length > 0}
                  aiConfigured={!!a.d.res?.aiConfigured}
                  errorText={a.d.errorText}
                />
              </View>
            ))
          : null}
        {list.length ? (
          <View style={ui.card}>
            <Text style={ui.h2}>🔎 {biLabel(lang, 'whereToGo')}</Text>
            <TextInput
              style={ui.input}
              value={where}
              onChangeText={setWhere}
              placeholder={T('whereHint')}
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              maxLength={60}
              returnKeyType="search"
            />
            <TouchableOpacity style={[ui.chip, byFacts && ui.chipOn, { alignSelf: 'flex-start' }]} onPress={() => setByFacts(v => !v)}>
              <Text style={[ui.chipText, byFacts && ui.chipTextOn]}>📊 {T('sortFacts')}</Text>
            </TouchableOpacity>
            {byFacts ? <Text style={[ui.muted, { fontSize: 12 }]}>{biLabel(lang, 'factsNote')}</Text> : null}
            {where.trim() && !found.length ? <Text style={[ui.muted, { marginTop: 6 }]}>{T('noMatch')}</Text> : null}
          </View>
        ) : null}
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
            {shown.map(r => (
              <HospitalCard
                key={`${r.v}:${r.h.slug}`}
                h={r.h}
                t={r.t}
                lang={lang}
                item={civicItem('hosp', place.state, place.district, r.h.slug)}
                userName={user?.name}
                myUid={user?.id}
                kindLabel={variant === 'all' ? (r.v === 'govt' ? T('govtHosp') : T('privateHosp')) : undefined}
                matched={r.matched}
                showCount={byFacts}
              />
            ))}
            {active.map(a =>
              a.d.res?.data ? (
                <SourcesBox key={`src-${a.v}`} lang={lang} sources={a.d.res?.sources} updatedAt={a.d.res?.updatedAt || 0} asOf={a.d.res?.data?.asOf} />
              ) : null,
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
