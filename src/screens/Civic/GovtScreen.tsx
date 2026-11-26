// Govt tab: pick a state (and a district) to see the full public picture for that place: state
// leaders (Governor, CM, Deputy CMs, ministers + portfolios), district Collector / SP / Police
// Commissioner, MPs and MLAs with party, government offices (address / phone / website), state and
// central schemes (eligibility, how to apply), grievance portals, elections, departments, services
// and helplines. Researched by Gemini with Google Search on the Worker (civic_data in D1), with the
// source links and an "as of" date. Every item in the app language (Telugu / Hindi) AND English.
// Neutral information only: no AI ratings. A place not researched yet is researched on demand.
// "Previous vs present government" (GovtCompareBox): neutral side-by-side facts per state / centre,
// every point with its source + date, no verdict.
// "Promises" (GovtPromisesBox): the present government's manifesto promises with done / in progress /
// not done / no update, each status backed by a dated public source; counts from real data only.
// Fast: saved answer shown instantly (useCivicData cache), each card in the app language with an
// English toggle, and "Explain simply" (schemes / grievance / services) answered by AI from the
// stored data only, in the app language + English.
// Free sources (Worker origin 'free': Wikidata, Wikipedia, official .gov.in): each section shows its
// source line (name, date, link); Collector / SP have no free source, so they show "Public info not
// available" with the district website link. Header language chip: app language + "Also show English".
// Location: State -> District -> Mandal chosen from the official LGD lists (LocationPicker). A picked
// mandal shows its own facts (Wikipedia summary, assembly constituencies named after it) above the
// district's; nothing public for the mandal = the note "No data for <mandal>, showing <district>
// district" (state-wide with a note when the district has nothing either).
// Offices / schemes / grievance / departments / services rows are HeadlineCards: bold name, 2-line
// summary (what it is / benefit / how), tap = the rest; phone / website links stay visible.
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
import { AnsweredByLine, CivicStatus, PlacePicker, ReviewsBox, ScopeNoteLine, SourcesBox, callNumber, openLink, scopeNote, subLevelLabel, useCivicPlace } from './civicParts';
import { answerFor, shownLevel, useFallbackWhen, useScopeLevel } from './useScopeLevel';
import { stateByCodeApp } from './stateName';
import { Bi, CivicCard, biLabel } from './bi';
import { ExplainButton } from './civicAiParts';
import { explainGovt } from '../../services/civicAi';
import { useCivicLabels } from '../../services/civicI18n';
import { useCivicData } from './useCivicData';
import GovtCompareBox from './GovtCompareBox';
import GovtPromisesBox from './GovtPromisesBox';
import LanguageChip from './LanguageChip';
import { SrcLine, districtSiteOf } from './civicFreeParts';
import HeadlineCard from '../../components/HeadlineCard';

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

// Collector / SP with no public source: "Public info not available" + the district website
function NotListed({ label, lang, site }: { label: string; lang: ReturnType<typeof useAppLanguage>; site: string }) {
  return (
    <View style={{ marginTop: 8 }} testID="govt-not-listed">
      <Text style={ui.muted}>{label}</Text>
      <Text style={ui.body}>{biLabel(lang, 'publicNA')}</Text>
      {site ? (
        <TouchableOpacity onPress={() => openLink(site)}>
          <Text style={[ui.muted, { color: colors.primary }]}>🔗 {biLabel(lang, 'districtSite')}</Text>
        </TouchableOpacity>
      ) : null}
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
  useCivicLabels(lang);
  // Scope: the picked mandal, else (no answer at all) the district, else the state (useScopeLevel)
  const { req, fallback: scopeDown } = useScopeLevel(place);
  const { res, phase, errorText, refresh, tr, aiNote, fromCache, answeredBy } = useCivicData<GovtData>(
    'govt',
    place.state,
    req.district,
    '',
    lang,
    code => getGovtData(place.state, req.district, code, req.mandal),
    req.mandal,
  );
  useFallbackWhen(!!place.state && phase === 'ready' && answerFor(res, place.state, req) && !res?.data, req, scopeDown);

  const d = res?.data;
  const t = (tr && res?.i18n?.[tr]) || null;
  const lead = d?.leaders;
  const tlead = t?.leaders;
  const dist = d?.district;
  const tdist = t?.district;
  const el = d?.election;
  const tel = t?.election;
  const anyDistrict = !!(dist && (dist.collector || dist.sp || dist.policeCommissioner || dist.mps.length || dist.mlas.length || dist.headquarters));
  const mandal = d?.mandal;
  const tmandal = t?.mandal;
  const anyMandal = !!(mandal && (mandal.overview || (mandal.mlas || []).length));
  // Level shown: the Worker's data.scope; else a mandal with nothing public = the district (or the
  // state when the district block is empty too)
  const lv0 = shownLevel(req, d?.scope);
  const shownLv = req.level === 'mandal' && !d?.scope ? (anyMandal ? 'mandal' : anyDistrict ? 'district' : 'state') : lv0 === 'mandal' && !anyMandal ? (anyDistrict ? 'district' : 'state') : lv0;
  const note = d ? scopeNote(lang, place, shownLv, stateByCodeApp(place.state)) : '';
  const shownDistrict = shownLv === 'state' ? '' : place.district;
  const explain = (focus: 'schemes' | 'grievance' | 'services') => () => explainGovt(place.state, shownDistrict, focus, lang);
  const src = d?.src;
  const free = d?.origin === 'free';
  const districtSite = districtSiteOf(d);
  // a district is picked: Collector / SP always get a line ("Public info not available" when empty)
  const showOfficials = !!shownDistrict && (free || anyDistrict);
  const anyElection = !!(el && (el.lastAssembly || el.lastLokSabha || el.next || el.voterHelpline || el.ceoWebsite));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={ui.scroll}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        refreshControl={<RefreshControl refreshing={phase === 'loading' && !!res} onRefresh={refresh} />}
      >
        <View style={[ui.row, { marginBottom: 8 }]}>
          <Text style={[ui.h1, ui.flex1]}>{civicText(lang, 'govtTitle')}</Text>
          <LanguageChip lang={lang} />
          {isOwnerUser() ? (
            <TouchableOpacity onPress={() => navigation.navigate('AdminCivic')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={ui.muted}>🛡️ Moderate</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <PlacePicker lang={lang} place={place} onChange={setPlace} />
        {place.state ? <CivicStatus lang={lang} phase={phase} hasData={!!d} aiConfigured={!!(res?.researchConfigured ?? res?.aiConfigured)} errorText={errorText} aiNote={aiNote} fromCache={fromCache} /> : null}
        <View collapsable={false} testID="govt-scope">
          <ScopeNoteLine text={note} />
          {d ? <AnsweredByLine lang={lang} by={answeredBy} updatedAt={res?.updatedAt} /> : null}
        </View>
        {place.state ? <GovtCompareBox lang={lang} state={place.state} /> : null}
        {place.state ? <GovtPromisesBox lang={lang} state={place.state} /> : null}
        {d ? (
          <>
            {d.overview ? (
              <CivicCard lang={lang} hasTranslation={!!t}>
                <Text style={ui.h2}>{L('overview')}</Text>
                <Bi en={d.overview} tr={t?.overview} />
                <SrcLine lang={lang} src={src?.overview} />
              </CivicCard>
            ) : null}

            {anyMandal && mandal && shownLv === 'mandal' ? (
              <CivicCard lang={lang} hasTranslation={!!t}>
                <View testID="govt-mandal">
                  <Text style={ui.h2}>
                    📌 {subLevelLabel(lang, place.state)}: {mandal.name || place.mandal}
                  </Text>
                  {mandal.overview ? <Bi en={mandal.overview} tr={tmandal?.overview} /> : null}
                  {(mandal.mlas || []).length ? <Text style={[ui.muted, { marginTop: 10 }]}>{L('mlas')}</Text> : null}
                  {(mandal.mlas || []).map((p, i) => (
                    <Bi key={`mmla${i}`} en={personLine(p)} tr={personLine(tmandal?.mlas?.[i])} style={[ui.body, { marginTop: 4 }]} />
                  ))}
                  <SrcLine lang={lang} src={mandal.src} />
                </View>
              </CivicCard>
            ) : null}

            {lead && (lead.governor || lead.chiefMinister.name || lead.deputyCMs.length || lead.ministers.length) ? (
              <CivicCard lang={lang} hasTranslation={!!t}>
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
                <SrcLine lang={lang} src={src?.leaders} />
              </CivicCard>
            ) : null}

            {(anyDistrict || showOfficials) && dist ? (
              <CivicCard lang={lang} hasTranslation={!!t}>
                <Text style={ui.h2}>📍 {L('districtOfficials')}</Text>
                <Row label={L('hq')} en={dist.headquarters} tr={tdist?.headquarters} />
                {showOfficials && !dist.collector ? <NotListed label={L('collector')} lang={lang} site={districtSite} /> : <Row label={L('collector')} en={dist.collector} tr={tdist?.collector} />}
                {showOfficials && !dist.sp ? <NotListed label={L('sp')} lang={lang} site={districtSite} /> : <Row label={L('sp')} en={dist.sp} tr={tdist?.sp} />}
                <Row label={L('commissioner')} en={dist.policeCommissioner} tr={tdist?.policeCommissioner} />
                {dist.mps.length ? <Text style={[ui.muted, { marginTop: 10 }]}>{L('mps')}</Text> : null}
                {dist.mps.map((p, i) => (
                  <Bi key={`mp${i}`} en={personLine(p)} tr={personLine(tdist?.mps?.[i])} style={[ui.body, { fontWeight: '700', marginTop: 4 }]} />
                ))}
                {dist.mlas.length ? <Text style={[ui.muted, { marginTop: 10 }]}>{L('mlas')}</Text> : null}
                {dist.mlas.map((p, i) => (
                  <Bi key={`mla${i}`} en={personLine(p)} tr={personLine(tdist?.mlas?.[i])} style={[ui.body, { marginTop: 4 }]} />
                ))}
                <SrcLine lang={lang} src={src?.district} />
              </CivicCard>
            ) : null}

            {d.helplines.length ? (
              <CivicCard lang={lang} hasTranslation={!!t}>
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
                <SrcLine lang={lang} src={src?.schemes} />
              </CivicCard>
            ) : null}

            {d.offices && d.offices.length ? (
              <CivicCard lang={lang} hasTranslation={!!t}>
                <Text style={ui.h2}>🏢 {L('offices')}</Text>
                {d.offices.map((x, i) => (
                  <HeadlineCard
                    key={`${x.name}${i}`}
                    divided
                    lang={lang}
                    headline={x.name}
                    headlineTr={t?.offices?.[i]?.name}
                    summary={x.what}
                    summaryTr={t?.offices?.[i]?.what}
                    footer={<Links phone={x.phone} website={x.website} lang={lang} />}
                  >
                    {x.address ? <Bi prefix="📍 " en={x.address} tr={t?.offices?.[i]?.address} style={ui.muted} /> : null}
                  </HeadlineCard>
                ))}
              </CivicCard>
            ) : null}

            {d.schemes.length ? (
              <CivicCard lang={lang} hasTranslation={!!t}>
                <Text style={ui.h2}>🎯 {L('schemes')}</Text>
                {d.schemes.map((x, i) => {
                  const ts = t?.schemes?.[i];
                  return (
                    <HeadlineCard
                      key={`${x.name}${i}`}
                      divided
                      lang={lang}
                      headline={x.name}
                      headlineTr={ts?.name}
                      summaryPrefix={x.benefit ? `🎁 ${civicText(lang, 'benefit')}: ` : ''}
                      summary={x.benefit}
                      summaryTr={x.benefit ? ts?.benefit : null}
                      extra={x.level ? <Text style={ui.muted}>{L(x.level === 'central' ? 'centralScheme' : 'stateScheme')}</Text> : null}
                      footer={<Links website={x.website} lang={lang} />}
                    >
                      {x.who ? <Bi prefix={`👤 ${civicText(lang, 'eligibility')}: `} en={x.who} tr={ts?.who} /> : null}
                      {x.apply ? <Bi prefix={`📝 ${civicText(lang, 'howApply')}: `} en={x.apply} tr={ts?.apply} /> : null}
                    </HeadlineCard>
                  );
                })}
                <SrcLine lang={lang} src={src?.schemes} />
                {res?.aiConfigured ? <ExplainButton lang={lang} onExplain={explain('schemes')} /> : null}
              </CivicCard>
            ) : null}

            {d.grievance && d.grievance.length ? (
              <CivicCard lang={lang} hasTranslation={!!t}>
                <Text style={ui.h2}>📣 {L('grievance')}</Text>
                {d.grievance.map((x, i) => (
                  <HeadlineCard
                    key={`${x.name}${i}`}
                    divided
                    lang={lang}
                    headline={x.name}
                    headlineTr={t?.grievance?.[i]?.name}
                    summary={x.how}
                    summaryTr={t?.grievance?.[i]?.how}
                    footer={<Links phone={x.phone} website={x.website} lang={lang} />}
                  />
                ))}
                <SrcLine lang={lang} src={src?.schemes} />
                {res?.aiConfigured ? <ExplainButton lang={lang} onExplain={explain('grievance')} /> : null}
              </CivicCard>
            ) : null}

            {anyElection && el ? (
              <CivicCard lang={lang} hasTranslation={!!t}>
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
                <SrcLine lang={lang} src={src?.election} />
              </CivicCard>
            ) : null}

            {d.departments.length ? (
              <CivicCard lang={lang} hasTranslation={!!t}>
                <Text style={ui.h2}>🗂️ {L('departments')}</Text>
                {d.departments.map((x, i) => (
                  <HeadlineCard
                    key={`${x.name}${i}`}
                    divided
                    lang={lang}
                    headline={x.name}
                    headlineTr={t?.departments?.[i]?.name}
                    summary={x.what}
                    summaryTr={t?.departments?.[i]?.what}
                    footer={<Links phone={x.helpline} website={x.website} lang={lang} />}
                  />
                ))}
              </CivicCard>
            ) : null}

            {d.services.length ? (
              <CivicCard lang={lang} hasTranslation={!!t}>
                <Text style={ui.h2}>🧾 {L('services')}</Text>
                {d.services.map((x, i) => (
                  <HeadlineCard
                    key={`${x.name}${i}`}
                    divided
                    lang={lang}
                    headline={x.name}
                    headlineTr={t?.services?.[i]?.name}
                    summary={x.how}
                    summaryTr={t?.services?.[i]?.how}
                    footer={<Links website={x.website} lang={lang} />}
                  />
                ))}
                <SrcLine lang={lang} src={src?.schemes} />
                {res?.aiConfigured ? <ExplainButton lang={lang} onExplain={explain('services')} /> : null}
              </CivicCard>
            ) : null}

            <SourcesBox lang={lang} sources={res?.sources} updatedAt={res?.updatedAt || 0} asOf={d.asOf} />
          </>
        ) : null}
        {place.state && res ? <ReviewsBox lang={lang} item={civicItem('govt', place.state, shownDistrict)} userName={user?.name} myUid={user?.id} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
