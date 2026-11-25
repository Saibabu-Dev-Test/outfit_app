// Hospitals tab: government / private hospitals for a state (or district) from the Worker
// (civic_data in D1, researched with Google Search: address, phone only when found, specialities,
// 24x7 emergency, Aarogyasri / Dr NTR Vaidya Seva / PM-JAY empanelment, website, map link, sources),
// each item in the app language (Telugu / Hindi) AND English, people's reviews per hospital, and
// "Hospital AI" that answers ONLY from the stored list (on the Worker, civic/ask.js). 108 / 112 always on
// top; the AI never diagnoses and always says to verify with the hospital.
// Fast: the saved list shows instantly (useCivicData cache: address, phone, timings, map link,
// 24x7, schemes), each card in the app language with an English toggle; Hospital AI runs on the
// Worker from the same stored list(s) in the app language + English (services/civicAi.ts), through the
// Worker's AI fallback chain (Gemini keys -> Groq -> Workers AI). No on-phone AI key is used here.
// Filter Government / Private / All, "Where to go for…" disease / speciality search over the loaded
// public data (services/hospitalSearch.ts), and an optional facts-only order by the count of listed
// specialities + facilities (never a rating). Per hospital: timings, 24x7, specialities, what it is
// publicly stated to be special for, publicly listed specialist doctors (+ experience), facilities,
// schemes, map link, source URLs; anything no public source states shows "Public info not available".
// Free sources (Worker origin 'free', OpenStreetMap): compact rows (civicFreeParts.tsx) with name,
// address, tap-to-call phone, map link, Govt / Private / "Type not listed" label and source + date.
// Header language chip (LanguageChip): app language picker + "Also show English".
// The search goes through the disease dictionary first (services/diseaseSearch.ts: EN / everyday
// words / Telugu / Hindi, misspellings -> departments -> speciality words), falling back to the old
// word expansion, and shows "Best in India for <disease>" (BestInIndiaBox: NIRF 2025 Medical ranks,
// a teaching + research ranking, never a treatment rating; 108 / 112 for red-flag conditions).
// When no hospital in the list states the searched speciality ("ear" -> ENT), the general /
// multi-speciality GOVT hospitals in the list (AIIMS, medical colleges, GGH, district / area hospitals;
// hospitalSearch.generalGovtHospitals) are shown labelled "May treat this — call to confirm" (never a claim).
import React, { useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { isOwnerUser } from '../../services/adminSystem';
import { useAppLanguage } from '../../i18n/appLanguage';
import { civicText } from '../../i18n/civicLabels';
import { HospData, HospVariant, Hospital, civicItem, getHospData } from '../../services/civicApi';
import { factsCount, generalGovtHospitals, searchHospitals, sortByFacts, uniqueRowKeys } from '../../services/hospitalSearch';
import { askHospitals } from '../../services/civicAi';
import { useCivicLabels } from '../../services/civicI18n';
import { CivicAskBox, Turn } from './civicAiParts';
import { CivicStatus, PlacePicker, ReviewsBox, SourcesBox, callNumber, openLink, useCivicPlace } from './civicParts';
import { Bi, CivicCard, biLabel } from './bi';
import { useCivicData } from './useCivicData';
import LanguageChip from './LanguageChip';
import { FreeHospitalRow, isFreeHospital } from './civicFreeParts';
import { hospitalTermsFor, specialitiesFor } from '../../services/diseaseSearch';
import BestInIndiaBox from './BestInIndiaBox';

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
  maybe,
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
  maybe?: string;
}) {
  const T = (k: Parameters<typeof civicText>[1]) => civicText(lang, k);
  const [open, setOpen] = useState(false);
  const join = (xs?: string[]) => (xs && xs.length ? xs.join(' • ') : '');
  const host = (u: string) => u.replace(/^https:\/\//, '').split('/')[0];
  const n = factsCount(h);
  return (
    <CivicCard lang={lang} hasTranslation={!!t}>
      <TouchableOpacity onPress={() => setOpen(v => !v)} activeOpacity={0.8}>
        <Bi en={h.name} tr={t?.name} style={ui.h2} />
        {kindLabel ? <Text style={[ui.muted, { fontSize: 12 }]}>🏷️ {kindLabel}</Text> : null}
        {maybe ? <Text testID="hosp-may-treat" style={[ui.bad, { fontSize: 12 }]}>📞 {maybe}</Text> : null}
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
    </CivicCard>
  );
}

// OpenStreetMap row + people's reviews behind a small toggle
function FreeHospitalCard({ h, t, lang, item, userName, myUid, maybe }: { h: Hospital; t?: Hospital | null; lang: ReturnType<typeof useAppLanguage>; item: string; userName?: string; myUid?: string; maybe?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <FreeHospitalRow h={h} t={t} lang={lang}>
      {maybe ? (
        <Text testID="hosp-may-treat" style={[ui.bad, { fontSize: 12, marginTop: 4 }]}>
          📞 {maybe}
        </Text>
      ) : null}
      <TouchableOpacity onPress={() => setOpen(v => !v)} style={{ marginTop: 6 }}>
        <Text style={[ui.muted, { color: colors.primary }]}>
          ⭐ {civicText(lang, 'reviews')} {open ? '▴' : '▾'}
        </Text>
      </TouchableOpacity>
      {open ? <ReviewsBox lang={lang} item={item} userName={userName} myUid={myUid} /> : null}
    </FreeHospitalRow>
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
  useCivicLabels(lang);
  // One loader per kind; a loader whose kind is filtered out gets state '' (no request at all)
  const useGovt = variant === 'govt' || variant === 'all';
  const usePriv = variant === 'private' || variant === 'all';
  const gov = useCivicData<HospData>('hosp', useGovt ? place.state : '', place.district, 'govt', lang, c => getHospData(place.state, 'govt', place.district, c));
  const priv = useCivicData<HospData>('hosp', usePriv ? place.state : '', place.district, 'private', lang, c =>
    getHospData(place.state, 'private', place.district, c),
  );
  const active = [...(useGovt ? [{ v: 'govt' as HospVariant, d: gov }] : []), ...(usePriv ? [{ v: 'private' as HospVariant, d: priv }] : [])];
  const refresh = () => active.forEach(a => a.d.refresh());
  const phase = active.some(a => a.d.phase === 'loading') ? 'loading' : active[0]?.d.phase;
  const anyRes = active.some(a => !!a.d.res);
  const placeKey = `${place.state}|${place.district}|${variant}`;

  const raw = active.flatMap(a => {
    const hs = (a.d.res?.data?.hospitals || []).filter(h => !!h && typeof h === 'object' && !!h.name);
    const trs = (a.d.tr && a.d.res?.i18n?.[a.d.tr]?.hospitals) || [];
    const origin = a.d.res?.data?.origin;
    return hs.map((h, i) => ({ h, t: trs[i] || null, v: a.v, free: isFreeHospital(h, origin) }));
  });
  // One unique, stable key per row, fixed before search / sort (uniqueRowKeys: Fabric addViewAt crash)
  const keys = uniqueRowKeys(raw);
  const rows = raw.map((r, i) => ({ ...r, key: keys[i] }));
  const list = rows.map(r => r.h);
  const found = where.trim() ? searchHospitals(list, where, hospitalTermsFor(where)).map(m => ({ ...rows[list.indexOf(m.h)], matched: m.matched })) : rows.map(r => ({ ...r, matched: [] as string[] }));
  // Nothing in the list states the searched speciality: general / multi-speciality govt hospitals
  // (AIIMS, medical colleges, GGH, district / area hospitals) as "may treat this — call to confirm"
  const searching = !!where.trim() && list.length > 0 && !found.length;
  const needSp = searching ? specialitiesFor(where) : [];
  const fallback = needSp.length ? generalGovtHospitals(rows).map(r => ({ ...r, matched: [] as string[] })) : [];
  const maybe = fallback.length > 0;
  const shown = maybe ? fallback : byFacts ? sortByFacts(found) : found;
  const workerAi = active.some(a => !!a.d.res?.aiConfigured);

  // Hospital AI runs only on the Worker (its AI fallback chain); no on-phone AI key
  const ask = (q: string, history: Turn[]) => askHospitals(place.state, place.district, active.map(a => a.v), q, lang, history);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView testID="hosp-scroll" contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled" removeClippedSubviews={false} refreshControl={<RefreshControl refreshing={phase === 'loading' && anyRes} onRefresh={refresh} />}>
        <View style={[ui.row, { marginBottom: 8 }]}>
          <Text style={[ui.h1, ui.flex1]}>{T('hospTitle')}</Text>
          <LanguageChip lang={lang} />
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
        {/* Stable containers (collapsable={false}, always mounted): the ScrollView's direct children keep
            the same count and order whatever the filter / results (Fabric "addViewAt" crash). */}
        <View collapsable={false} testID="hosp-status">
          {place.state
            ? active.map(a => (
                <View key={`status-${a.v}`} collapsable={false}>
                  {variant === 'all' && a.d.phase !== 'ready' && a.d.phase !== 'idle' ? (
                    <Text style={[ui.muted, { fontSize: 12 }]}>{a.v === 'govt' ? T('govtHosp') : T('privateHosp')}</Text>
                  ) : null}
                  <CivicStatus
                    lang={lang}
                    phase={a.d.phase}
                    hasData={(a.d.res?.data?.hospitals || []).length > 0}
                    aiConfigured={!!(a.d.res?.researchConfigured ?? a.d.res?.aiConfigured)}
                    errorText={a.d.errorText}
                    aiNote={a.d.aiNote}
                    fromCache={a.d.fromCache}
                  />
                </View>
              ))
            : null}
        </View>
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
          {list.length > 0 ? (
            <TouchableOpacity style={[ui.chip, byFacts && ui.chipOn, { alignSelf: 'flex-start' }]} onPress={() => setByFacts(v => !v)}>
              <Text style={[ui.chipText, byFacts && ui.chipTextOn]}>📊 {T('sortFacts')}</Text>
            </TouchableOpacity>
          ) : null}
          {byFacts && list.length > 0 ? <Text style={[ui.muted, { fontSize: 12 }]}>{biLabel(lang, 'factsNote')}</Text> : null}
          {searching && !maybe ? <Text style={[ui.muted, { marginTop: 6 }]}>{T('noMatch')}</Text> : null}
          {maybe ? (
            <View testID="hosp-maybe" style={{ marginTop: 6 }}>
              <Text style={ui.bad}>⚠️ {biLabel(lang, 'mayTreatTitle')}</Text>
              <Text style={[ui.muted, { marginTop: 2 }]}>
                🩺 {T('seeSpecialities')}: {needSp.join(' • ')}
              </Text>
            </View>
          ) : null}
        </View>
        <View collapsable={false} testID="hosp-best">
          <BestInIndiaBox lang={lang} query={where} state={place.state} />
        </View>
        <View collapsable={false} testID="hosp-list">
          {list.length ? (
            <View collapsable={false}>
              <Text style={[ui.muted, { marginBottom: 8 }]}>
                ⚠️ {T('verify')}
                {lang !== 'English' && T('verify') !== civicText('English', 'verify') ? `\n${civicText('English', 'verify')}` : ''}
              </Text>
              {workerAi ? (
                <CivicAskBox key={placeKey} lang={lang} title={T('askHospAi')} note={T('hospAiNote')} hint={T('askHospHint')} onAsk={ask} />
              ) : null}
              {shown.map(r =>
                r.free ? (
                  <FreeHospitalCard
                    key={r.key}
                    maybe={maybe ? biLabel(lang, 'mayTreat') : undefined}
                    h={r.h}
                    t={r.t}
                    lang={lang}
                    item={civicItem('hosp', place.state, place.district, r.h.slug)}
                    userName={user?.name}
                    myUid={user?.id}
                  />
                ) : (
                  <HospitalCard
                    key={r.key}
                    maybe={maybe ? biLabel(lang, 'mayTreat') : undefined}
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
                ),
              )}
              {active.map(a =>
                a.d.res?.data ? (
                  <SourcesBox key={`src-${a.v}`} lang={lang} sources={a.d.res?.sources} updatedAt={a.d.res?.updatedAt || 0} asOf={a.d.res?.data?.asOf} />
                ) : null,
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
