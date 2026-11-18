// Laws tab: search Indian law sections by word, section number ("318", "318(4)") or old IPC number
// ("ipc 420", "420"), offline from src/data/laws via services/laws.ts. Disclaimer always on top;
// "Whom to contact" shows the national helplines (tap to call). Guidance only, not legal advice.
// Each section shows a plain-language title first (app language + English), the legal title smaller,
// and a simple explanation (data/laws/plain.*.ts, AI-written; the official text prevails).
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
      <FlatList
        data={results}
        keyExtractor={s => s.id}
        contentContainerStyle={ui.scroll}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        initialNumToRender={12}
        renderItem={({ item }) => <SectionCard s={item} lang={lang} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />}
      />
    </SafeAreaView>
  );
}
