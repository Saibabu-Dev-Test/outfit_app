// Laws tab: search Indian law sections by word, section number ("318", "318(4)") or old IPC number
// ("ipc 420", "420"), offline from src/data/laws via services/laws.ts. Disclaimer always on top;
// "Whom to contact" shows the national helplines (tap to call). Guidance only, not legal advice.
// Each section shows a plain-language title first (app language + English), the legal title smaller,
// and a simple explanation (data/laws/plain.*.ts, AI-written; the official text prevails).
// "Offence guide (BNS 2023)" mode: common offences with a simple title + explanation in the app
// language AND English (hand-written static data), the official BNSS First Schedule rows (section,
// punishment, cognizable, bailable, court, old IPC), a simple jail range / fine line, and how to
// file a police complaint under the BNSS. Searchable in EN / TE / HI, by section or old IPC number.
import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { useAppLanguage } from '../../i18n/appLanguage';
import { civicText } from '../../i18n/civicLabels';
import { ACTS, ActId, LAW_DISCLAIMER } from '../../data/laws/acts';
import { DEPT_CONTACTS, HELPLINES } from '../../data/laws/contacts';
import { LawSection, plainTitle, searchLaws } from '../../services/laws';
import { trCode } from './useCivicData';
import { Bi } from './bi';
import { callNumber, openLink } from './civicParts';
import { OFFENCE_CATEGORIES, OffenceCategory } from '../../data/laws/offenceGuide';
import {
  Flag,
  GuideLang,
  OffenceGuideItem,
  bailableFlag,
  categoryLabel,
  cognizableFlag,
  complaintSteps,
  entryFlag,
  searchOffences,
  simplePunishment,
} from '../../services/offenceGuide';

const cogKey = (f: Flag | 'mixed') => (f === 'yes' ? 'cogYes' : f === 'no' ? 'cogNo' : f === 'cond' ? 'cogCond' : 'dependsMain');
const bailKey = (f: Flag | 'mixed') => (f === 'yes' ? 'bailable' : f === 'no' ? 'nonBailable' : 'dependsMain');

function BiLines({ en, tr, style }: { en: string[]; tr?: string[] | null; style?: any }) {
  return (
    <View>
      {en.map((line, i) => (
        <Bi key={`${line}${i}`} en={line} tr={tr ? tr[i] : undefined} style={style} />
      ))}
    </View>
  );
}

function OffenceCard({ e, lang, open, onToggle }: { e: OffenceGuideItem; lang: ReturnType<typeof useAppLanguage>; open: boolean; onToggle: () => void }) {
  const T = (k: Parameters<typeof civicText>[1]) => civicText(lang, k);
  const L = (k: Parameters<typeof civicText>[1]) => (lang === 'English' ? civicText('English', k) : `${civicText(lang, k)} · ${civicText('English', k)}`);
  const code = trCode(lang);
  const gl: GuideLang | null = code;
  const secs = [...new Set(e.rows.map(r => r.section.replace(/\(.*$/, '')))].join(', ');
  const ipc = [...new Set(e.rows.map(r => (r.oldRef || '').replace(/^IPC /, '')).filter(Boolean).join(', ').split(', '))].filter(Boolean).join(', ');
  const cog = entryFlag(e.rows, r => cognizableFlag(r.cognizable));
  const bail = entryFlag(e.rows, r => bailableFlag(r.bailable));
  const steps = complaintSteps(cog === 'mixed' ? 'depends' : cog);
  return (
    <TouchableOpacity style={ui.card} activeOpacity={0.8} onPress={onToggle}>
      <Bi en={e.t.en} tr={gl ? e.t[gl] : undefined} style={ui.h2} />
      <Text style={[ui.muted, { fontSize: 12 }]}>
        BNS {secs}
        {ipc ? ` · ${T('oldLaw')}: IPC ${ipc}` : ''}
      </Text>
      <View style={{ marginTop: 4 }}>
        <Bi en={e.x.en} tr={gl ? e.x[gl] : undefined} lines={open ? undefined : 3} />
      </View>
      <Text style={[ui.muted, { marginTop: 4 }]}>
        🚓 {T(cogKey(cog))}
        {'\n'}🔓 {T(bailKey(bail))}
      </Text>
      {open ? (
        <View style={{ marginTop: 8 }}>
          <Text style={ui.h2}>📜 {L('cases')}</Text>
          {e.rows.map(r => (
            <View key={r.id} style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 }}>
              <Text style={[ui.body, { fontWeight: '700' }]}>BNS {r.section}</Text>
              <Text style={ui.body}>{r.summary}</Text>
              <View style={{ marginTop: 4 }}>
                <Text style={ui.muted}>⚖️ {L('punishment')}</Text>
                <BiLines en={simplePunishment(r.punishment, 'en')} tr={gl ? simplePunishment(r.punishment, gl) : null} style={[ui.body, { fontWeight: '700' }]} />
                <Text style={[ui.muted, { fontSize: 12 }]}>{T('officialText')}: {r.punishment}</Text>
              </View>
              {r.cognizable ? (
                <View style={{ marginTop: 4 }}>
                  <Bi en={`🚓 ${civicText('English', cogKey(cognizableFlag(r.cognizable)))}`} tr={lang !== 'English' ? `🚓 ${T(cogKey(cognizableFlag(r.cognizable)))}` : undefined} />
                  <Text style={[ui.muted, { fontSize: 12 }]}>{T('officialText')}: {r.cognizable}</Text>
                </View>
              ) : null}
              {r.bailable ? (
                <View style={{ marginTop: 4 }}>
                  <Bi en={`🔓 ${civicText('English', bailKey(bailableFlag(r.bailable)))}`} tr={lang !== 'English' ? `🔓 ${T(bailKey(bailableFlag(r.bailable)))}` : undefined} />
                  <Text style={[ui.muted, { fontSize: 12 }]}>{T('officialText')}: {r.bailable}</Text>
                </View>
              ) : null}
              {r.court ? <Text style={ui.muted}>🏛️ {T('court')}: {r.court}</Text> : null}
              {r.oldRef ? <Text style={ui.muted}>{T('oldLaw')}: {r.oldRef}</Text> : null}
            </View>
          ))}
          <View style={{ marginTop: 12 }}>
            <Text style={ui.h2}>📝 {L('howToComplain')}</Text>
            {steps.map((st, i) => (
              <View key={`${st.ref}${i}`} style={{ marginTop: 6 }}>
                <Bi prefix={`${i + 1}. `} en={st.t.en} tr={gl ? `${st.t[gl]}` : undefined} />
                <Text style={[ui.muted, { fontSize: 12 }]}>{st.ref}</Text>
              </View>
            ))}
          </View>
          {lang !== 'English' ? <Text style={[ui.muted, { marginTop: 8 }]}>🌐 {T('translationNote')}</Text> : null}
          <View style={{ marginTop: 8 }}>
            {[
              ['BNS 2023', e.sources.bns],
              ['BNSS 2023', e.sources.bnss],
              ['BNSS First Schedule (NCRB)', e.sources.schedule],
            ].map(([label, url]) => (
              <TouchableOpacity key={url} onPress={() => openLink(url)}>
                <Text style={[ui.body, { color: colors.primary }]}>🔗 {T('source')}: {label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function SectionCard({ s, lang, open, onToggle }: { s: LawSection; lang: ReturnType<typeof useAppLanguage>; open: boolean; onToggle: () => void }) {
  const T = (k: Parameters<typeof civicText>[1]) => civicText(lang, k);
  const code = trCode(lang);
  const local = code && s.plain ? s.plain[code] : undefined;
  const enPlain = s.plain?.en;
  const enTitle = plainTitle(s, 'en');
  return (
    <TouchableOpacity style={ui.card} activeOpacity={0.8} onPress={onToggle}>
      <Bi en={enTitle} tr={local?.t} style={ui.h2} />
      <Text style={[ui.muted, { fontSize: 12 }]}>
        {s.act} {s.section}
        {enTitle !== s.title ? ` · ${T('legalTitle')}: ${s.title}` : ''}
      </Text>
      {s.oldRef ? (
        <Text style={[ui.muted, { fontSize: 12 }]}>
          {T('oldLaw')}: {s.oldRef}
        </Text>
      ) : null}
      <View style={{ marginTop: 4 }}>
        <Bi en={enPlain?.x || s.summary} tr={local?.x} lines={open ? undefined : 3} />
      </View>
      {open ? (
        <View style={{ marginTop: 8 }}>
          {s.meaning ? <Text style={ui.body}>💡 {T('meaning')}: {s.meaning}</Text> : null}
          {s.examples && s.examples.length ? <Text style={ui.body}>📝 {T('examples')}: {s.examples.join(' • ')}</Text> : null}
          {enPlain?.x && s.summary ? <Text style={[ui.muted, { marginBottom: 4 }]}>📜 {s.summary}</Text> : null}
          {local?.p ? <Text style={ui.body}>⚖️ {T('punishment')}: {local.p}</Text> : null}
          {s.punishment ? (
            <Text style={local?.p ? ui.muted : ui.body}>
              {local?.p ? '' : `⚖️ ${T('punishment')}: `}
              {s.punishment}
            </Text>
          ) : null}
          {s.cognizable ? <Text style={ui.body}>🚓 {T('cognizable')}: {s.cognizable}</Text> : null}
          {s.bailable ? <Text style={ui.body}>🔓 {T('bail')}: {s.bailable}</Text> : null}
          {s.court ? <Text style={ui.body}>🏛️ {T('court')}: {s.court}</Text> : null}
          {s.timeLimit ? <Text style={ui.body}>⏳ {T('timeLimit')}: {s.timeLimit}</Text> : null}
          {s.source ? (
            <TouchableOpacity onPress={() => openLink(s.source)}>
              <Text style={[ui.body, { color: colors.primary }]}>🔗 {T('source')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function LawsScreen() {
  const lang = useAppLanguage();
  const T = (k: Parameters<typeof civicText>[1]) => civicText(lang, k);
  const [query, setQuery] = useState('');
  const [act, setAct] = useState<ActId | 'ALL'>('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const results = useMemo(() => searchLaws(query, act, 100), [query, act]);
  const [mode, setMode] = useState<'sections' | 'guide'>('sections');
  const [gQuery, setGQuery] = useState('');
  const [gCat, setGCat] = useState<OffenceCategory | 'ALL'>('ALL');
  const guide = useMemo(() => searchOffences(gQuery, gCat), [gQuery, gCat]);
  const gl: GuideLang = trCode(lang) || 'en';

  const header = (
    <View>
      <Text style={[ui.h1, { marginBottom: 8 }]}>{T('lawsTitle')}</Text>
      <View style={[ui.card, { borderColor: '#F5A623' }]}>
        <Text style={ui.h2}>⚠️ {T('disclaimer')}</Text>
        <Text style={ui.body}>{LAW_DISCLAIMER}</Text>
        <Text style={[ui.muted, { marginTop: 4 }]}>🤖 {T('aiTranslated')}</Text>
        {lang !== 'English' ? <Text style={ui.muted}>{civicText('English', 'aiTranslated')}</Text> : null}
      </View>
      <TouchableOpacity style={ui.card} onPress={() => setShowContacts(v => !v)} activeOpacity={0.8}>
        <Text style={ui.h2}>📞 {T('whomToContact')} {showContacts ? '▴' : '▾'}</Text>
        {showContacts ? (
          <View>
            {HELPLINES.map(h => (
              <View key={h.id} style={[ui.row, { marginTop: 6 }]}>
                <View style={ui.flex1}>
                  <Text style={[ui.body, { fontWeight: '700' }]}>{h.who}</Text>
                  <Text style={ui.muted}>{h.situation}</Text>
                </View>
                <TouchableOpacity style={ui.btn} onPress={() => callNumber(h.number)}>
                  <Text style={ui.btnText}>{h.number}</Text>
                </TouchableOpacity>
              </View>
            ))}
            {DEPT_CONTACTS.map(d => (
              <View key={d.id} style={{ marginTop: 10 }}>
                <Text style={[ui.body, { fontWeight: '700' }]}>{d.situation}</Text>
                <Text style={ui.body}>
                  → {d.whom}. {d.how}
                </Text>
                {d.web ? (
                  <TouchableOpacity onPress={() => openLink(d.web as string)}>
                    <Text style={[ui.muted, { color: colors.primary }]}>{d.web}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </TouchableOpacity>
      <View style={[ui.row, { marginBottom: 8, flexWrap: 'wrap' }]}>
        {(['guide', 'sections'] as const).map(m => (
          <TouchableOpacity key={m} style={[ui.chip, mode === m && ui.chipOn]} onPress={() => setMode(m)}>
            <Text style={[ui.chipText, mode === m && ui.chipTextOn]}>{m === 'guide' ? `⚖️ ${T('offenceGuide')}` : `📜 ${T('allSections')}`}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const guideHeader = (
    <View>
      {header}
      <View style={ui.card}>
        <Bi en={civicText('English', 'bnsNote')} tr={lang !== 'English' ? T('bnsNote') : undefined} />
      </View>
      <TextInput
        style={ui.input}
        value={gQuery}
        onChangeText={setGQuery}
        placeholder={T('searchOffence')}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        returnKeyType="search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {(['ALL', ...(Object.keys(OFFENCE_CATEGORIES) as OffenceCategory[])] as (OffenceCategory | 'ALL')[]).map(c => {
          const on = c === gCat;
          return (
            <TouchableOpacity key={c} style={[ui.chip, on && ui.chipOn]} onPress={() => setGCat(c)}>
              <Text style={[ui.chipText, on && ui.chipTextOn]}>{c === 'ALL' ? T('allActs') : categoryLabel(c, gl)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={[ui.muted, { marginBottom: 8 }]}>
        {guide.length} {T('results')}
      </Text>
    </View>
  );

  const sectionsHeader = (
    <View>
      {header}
      <TextInput
        style={ui.input}
        value={query}
        onChangeText={setQuery}
        placeholder={T('searchLaws')}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        returnKeyType="search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {(['ALL', ...ACTS.map(a => a.id)] as (ActId | 'ALL')[]).map(id => {
          const on = id === act;
          return (
            <TouchableOpacity key={id} style={[ui.chip, on && ui.chipOn]} onPress={() => setAct(id)}>
              <Text style={[ui.chipText, on && ui.chipTextOn]}>{id === 'ALL' ? T('allActs') : id}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={[ui.muted, { marginBottom: 8 }]}>
        {results.length} {T('results')}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {mode === 'guide' ? (
        <FlatList
          data={guide}
          keyExtractor={e => `g-${e.id}`}
          contentContainerStyle={ui.scroll}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={guideHeader}
          initialNumToRender={10}
          renderItem={({ item }) => <OffenceCard e={item} lang={lang} open={openId === `g-${item.id}`} onToggle={() => setOpenId(openId === `g-${item.id}` ? null : `g-${item.id}`)} />}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={s => s.id}
          contentContainerStyle={ui.scroll}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={sectionsHeader}
          initialNumToRender={12}
          renderItem={({ item }) => <SectionCard s={item} lang={lang} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />}
        />
      )}
    </SafeAreaView>
  );
}
