// Govt tab: pick a state (and a district) to see the full public picture for that place: state
// leaders (Governor, CM, Deputy CMs, ministers + portfolios), district Collector / SP / Police
// Commissioner, MPs and MLAs with party, government offices (address / phone / website), state and
// central schemes (eligibility, how to apply), grievance portals, elections, departments, services
// and helplines. Researched by Gemini with Google Search on the Worker (civic_data in D1), with the
// source links and an "as of" date. Every item in the app language (Telugu / Hindi) AND English.
// Neutral information only: no AI ratings. A place not researched yet is researched on demand.
// "Previous vs present government" (GovtCompareBox): neutral side-by-side facts per state / centre,
// every point with its source + date, no verdict.
import React from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { isOwnerUser } from '../../services/adminSystem';
import { useAppLanguage } from '../../i18n/appLanguage';
import { civicText } from '../../i18n/civicLabels';
import { CivicPerson, CivicRep, GovtData, civicItem, getGovtData } from '../../services/civicApi';
import { CivicStatus, PlacePicker, ReviewsBox, SourcesBox, callNumber, openLink, useCivicPlace } from './civicParts';
import { Bi, biLabel } from './bi';
import { useCivicData } from './useCivicData';
import GovtCompareBox from './GovtCompareBox';

const Links = ({ phone, website, lang }: { phone?: string; website?: string; lang: ReturnType<typeof useAppLanguage> }) =>
  phone || website ? (
    <View style={[ui.row, { flexWrap: 'wrap' }]}>
      {phone ? (
        <TouchableOpacity onPress={() => callNumber(phone)} style={{ marginRight: 14, marginTop: 2 }}>
          <Text style={[ui.muted, { color: colors.primary }]}>📞 {phone}</Text>
        </TouchableOpacity>
      ) : null}
      {website ? (
        <TouchableOpacity onPress={() => openLink(website)} style={{ marginTop: 2 }}>
          <Text style={[ui.muted, { color: colors.primary }]}>🔗 {civicText(lang, 'open')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  ) : null;

function Row({ label, en, tr }: { label: string; en?: string; tr?: string }) {
  if (!en) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={ui.muted}>{label}</Text>
      <Bi en={en} tr={tr} style={[ui.body, { fontWeight: '700' }]} />
    </View>
  );
}

const personLine = (p?: CivicPerson | CivicRep) => {
  if (!p || !p.name) return '';
  const extra = [('constituency' in p && p.constituency) || '', p.party ? `(${p.party})` : ''].filter(Boolean).join(' ');
  return extra ? `${p.name} · ${extra}` : p.name;
};

export default function GovtScreen() {
  const lang = useAppLanguage();
  const L = (k: Parameters<typeof biLabel>[1]) => biLabel(lang, k);
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [place, setPlace] = useCivicPlace();
  const { res, phase, errorText, refresh, tr } = useCivicData<GovtData>('govt', place.state, place.district, '', lang, () =>
    getGovtData(place.state, place.district),
  );

  const d = res?.data;
  const t = (tr && res?.i18n?.[tr]) || null;
  const lead = d?.leaders;
  const tlead = t?.leaders;
  const dist = d?.district;
  const tdist = t?.district;
  const el = d?.election;
  const tel = t?.election;
  const anyDistrict = !!(dist && (dist.collector || dist.sp || dist.policeCommissioner || dist.mps.length || dist.mlas.length || dist.headquarters));
  const anyElection = !!(el && (el.lastAssembly || el.lastLokSabha || el.next || el.voterHelpline || el.ceoWebsite));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={ui.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={phase === 'loading' && !!res} onRefresh={refresh} />}
      >
        <View style={[ui.row, { marginBottom: 8 }]}>
          <Text style={[ui.h1, ui.flex1]}>{civicText(lang, 'govtTitle')}</Text>
          {isOwnerUser() ? (
            <TouchableOpacity onPress={() => navigation.navigate('AdminCivic')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={ui.muted}>🛡️ Moderate</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <PlacePicker lang={lang} place={place} onChange={setPlace} />
        {place.state ? <CivicStatus lang={lang} phase={phase} hasData={!!d} aiConfigured={!!res?.aiConfigured} errorText={errorText} /> : null}
        {place.state ? <GovtCompareBox lang={lang} state={place.state} /> : null}
        {d ? (
          <>
            {d.overview ? (
              <View style={ui.card}>
                <Text style={ui.h2}>{L('overview')}</Text>
                <Bi en={d.overview} tr={t?.overview} />
              </View>
            ) : null}

            {lead && (lead.governor || lead.chiefMinister.name || lead.deputyCMs.length || lead.ministers.length) ? (
              <View style={ui.card}>
                <Text style={ui.h2}>🏛️ {L('leaders')}</Text>
                <Row label={L('governor')} en={lead.governor} tr={tlead?.governor} />
                <Row label={L('cm')} en={personLine(lead.chiefMinister)} tr={personLine(tlead?.chiefMinister)} />
                {lead.deputyCMs.map((p, i) => (
                  <View key={`dcm${i}`}>
                    <Row label={L('deputyCm')} en={personLine(p)} tr={personLine(tlead?.deputyCMs?.[i])} />
                    {p.role ? <Bi en={p.role} tr={tlead?.deputyCMs?.[i]?.role} style={ui.muted} /> : null}
                  </View>
                ))}
                {lead.ministers.length ? <Text style={[ui.muted, { marginTop: 10 }]}>{L('ministers')}</Text> : null}
                {lead.ministers.map((p, i) => (
                  <View key={`min${i}`} style={{ marginTop: 6 }}>
                    <Bi en={personLine(p)} tr={personLine(tlead?.ministers?.[i])} style={[ui.body, { fontWeight: '700' }]} />
                    {p.role ? <Bi en={p.role} tr={tlead?.ministers?.[i]?.role} style={ui.muted} /> : null}
                  </View>
                ))}
              </View>
            ) : null}

            {anyDistrict && dist ? (
              <View style={ui.card}>
                <Text style={ui.h2}>📍 {L('districtOfficials')}</Text>
                <Row label={L('hq')} en={dist.headquarters} tr={tdist?.headquarters} />
                <Row label={L('collector')} en={dist.collector} tr={tdist?.collector} />
                <Row label={L('sp')} en={dist.sp} tr={tdist?.sp} />
                <Row label={L('commissioner')} en={dist.policeCommissioner} tr={tdist?.policeCommissioner} />
                {dist.mps.length ? <Text style={[ui.muted, { marginTop: 10 }]}>{L('mps')}</Text> : null}
                {dist.mps.map((p, i) => (
                  <Bi key={`mp${i}`} en={personLine(p)} tr={personLine(tdist?.mps?.[i])} style={[ui.body, { fontWeight: '700', marginTop: 4 }]} />
                ))}
                {dist.mlas.length ? <Text style={[ui.muted, { marginTop: 10 }]}>{L('mlas')}</Text> : null}
                {dist.mlas.map((p, i) => (
                  <Bi key={`mla${i}`} en={personLine(p)} tr={personLine(tdist?.mlas?.[i])} style={[ui.body, { marginTop: 4 }]} />
                ))}
              </View>
            ) : null}

            {d.helplines.length ? (
              <View style={ui.card}>
                <Text style={ui.h2}>📞 {L('helplines')}</Text>
                {d.helplines.map((h, i) => (
                  <View key={`${h.name}${i}`} style={[ui.row, { marginTop: 6 }]}>
                    <View style={ui.flex1}>
                      <Bi en={h.name} tr={t?.helplines?.[i]?.name} />
                    </View>
                    <TouchableOpacity style={ui.btn} onPress={() => callNumber(h.number)}>
                      <Text style={ui.btnText}>{h.number}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            {d.offices && d.offices.length ? (
              <View style={ui.card}>
                <Text style={ui.h2}>🏢 {L('offices')}</Text>
                {d.offices.map((x, i) => (
                  <View key={`${x.name}${i}`} style={{ marginTop: 10 }}>
                    <Bi en={x.name} tr={t?.offices?.[i]?.name} style={[ui.body, { fontWeight: '700' }]} />
                    {x.what ? <Bi en={x.what} tr={t?.offices?.[i]?.what} /> : null}
                    {x.address ? <Bi prefix="📍 " en={x.address} tr={t?.offices?.[i]?.address} style={ui.muted} /> : null}
                    <Links phone={x.phone} website={x.website} lang={lang} />
                  </View>
                ))}
              </View>
            ) : null}

            {d.schemes.length ? (
              <View style={ui.card}>
                <Text style={ui.h2}>🎯 {L('schemes')}</Text>
                {d.schemes.map((x, i) => {
                  const ts = t?.schemes?.[i];
                  return (
                    <View key={`${x.name}${i}`} style={{ marginTop: 12 }}>
                      <Bi en={x.name} tr={ts?.name} style={[ui.body, { fontWeight: '700' }]} />
                      {x.level ? <Text style={ui.muted}>{L(x.level === 'central' ? 'centralScheme' : 'stateScheme')}</Text> : null}
                      {x.who ? <Bi prefix={`👤 ${civicText(lang, 'eligibility')}: `} en={x.who} tr={ts?.who} /> : null}
                      {x.benefit ? <Bi prefix={`🎁 ${civicText(lang, 'benefit')}: `} en={x.benefit} tr={ts?.benefit} /> : null}
                      {x.apply ? <Bi prefix={`📝 ${civicText(lang, 'howApply')}: `} en={x.apply} tr={ts?.apply} /> : null}
                      <Links website={x.website} lang={lang} />
                    </View>
                  );
                })}
              </View>
            ) : null}

            {d.grievance && d.grievance.length ? (
              <View style={ui.card}>
                <Text style={ui.h2}>📣 {L('grievance')}</Text>
                {d.grievance.map((x, i) => (
                  <View key={`${x.name}${i}`} style={{ marginTop: 10 }}>
                    <Bi en={x.name} tr={t?.grievance?.[i]?.name} style={[ui.body, { fontWeight: '700' }]} />
                    {x.how ? <Bi en={x.how} tr={t?.grievance?.[i]?.how} /> : null}
                    <Links phone={x.phone} website={x.website} lang={lang} />
                  </View>
                ))}
              </View>
            ) : null}

            {anyElection && el ? (
              <View style={ui.card}>
                <Text style={ui.h2}>🗳️ {L('election')}</Text>
                <Row label={L('lastAssembly')} en={el.lastAssembly} tr={tel?.lastAssembly} />
                <Row label={L('lastLokSabha')} en={el.lastLokSabha} tr={tel?.lastLokSabha} />
                <Row label={L('nextElection')} en={el.next} tr={tel?.next} />
                {el.voterHelpline || el.ceoWebsite ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={ui.muted}>{L('voterHelpline')}</Text>
                    <Links phone={el.voterHelpline} website={el.ceoWebsite} lang={lang} />
                  </View>
                ) : null}
              </View>
            ) : null}

            {d.departments.length ? (
              <View style={ui.card}>
                <Text style={ui.h2}>🗂️ {L('departments')}</Text>
                {d.departments.map((x, i) => (
                  <View key={`${x.name}${i}`} style={{ marginTop: 8 }}>
                    <Bi en={x.name} tr={t?.departments?.[i]?.name} style={[ui.body, { fontWeight: '700' }]} />
                    {x.what ? <Bi en={x.what} tr={t?.departments?.[i]?.what} /> : null}
                    <Links phone={x.helpline} website={x.website} lang={lang} />
                  </View>
                ))}
              </View>
            ) : null}

            {d.services.length ? (
              <View style={ui.card}>
                <Text style={ui.h2}>🧾 {L('services')}</Text>
                {d.services.map((x, i) => (
                  <View key={`${x.name}${i}`} style={{ marginTop: 8 }}>
                    <Bi en={x.name} tr={t?.services?.[i]?.name} style={[ui.body, { fontWeight: '700' }]} />
                    {x.how ? <Bi en={x.how} tr={t?.services?.[i]?.how} /> : null}
                    <Links website={x.website} lang={lang} />
                  </View>
                ))}
              </View>
            ) : null}

            <SourcesBox lang={lang} sources={res?.sources} updatedAt={res?.updatedAt || 0} asOf={d.asOf} />
          </>
        ) : null}
        {place.state && res ? <ReviewsBox lang={lang} item={civicItem('govt', place.state, place.district)} userName={user?.name} myUid={user?.id} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
