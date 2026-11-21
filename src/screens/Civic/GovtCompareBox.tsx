// Govt tab > "Previous vs present government": a neutral side-by-side comparison for the picked state
// or the centre (schemes, budgets, major projects, schemes started / stopped). Every point shows its
// own source link + date; the Worker drops points without them and drops evaluative words. There is
// no verdict, rating or "which is best" anywhere. Collapsed until the user opens it, so research is
// only asked for when someone wants it (same per-user / daily caps on the Worker).
// Each item in the app language with an English toggle (civic_i18n / civic_data.i18n).
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { AppLanguage } from '../../i18n/appLanguage';
import { CivicKey, civicText } from '../../i18n/civicLabels';
import { CENTRE_CODE, COMPARE_AREAS, CompareArea, CompareData, CompareFact, CompareGovt, getCompareData } from '../../services/civicApi';
import { CivicStatus, SourcesBox, openLink } from './civicParts';
import { Bi, CivicCard, biLabel } from './bi';
import { stateByCodeApp } from './stateName';
import { useCivicData } from './useCivicData';

export const AREA_LABEL: Record<CompareArea, CivicKey> = {
  schemes: 'schemes',
  budget: 'areaBudget',
  projects: 'areaProjects',
  started: 'areaStarted',
  stopped: 'areaStopped',
};

const host = (u: string) => u.replace(/^https:\/\//, '').split('/')[0];

function FactCell({ f, tf, lang }: { f: CompareFact | null; tf?: CompareFact | null; lang: AppLanguage }) {
  if (!f) return <Text style={[ui.muted, { fontSize: 12 }]}>{biLabel(lang, 'notListed')}</Text>;
  return (
    <View>
      <Bi en={f.text} tr={tf?.text} />
      <Text style={[ui.muted, { fontSize: 12 }]}>
        📅 {civicText(lang, 'date')}: {f.date}
      </Text>
      <TouchableOpacity onPress={() => openLink(f.source)}>
        <Text style={[ui.muted, { fontSize: 12, color: colors.primary }]} numberOfLines={1}>
          🔗 {host(f.source)}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function GovtHead({ g, tg, label, lang }: { g: CompareGovt; tg?: CompareGovt | null; label: CivicKey; lang: AppLanguage }) {
  return (
    <View style={[ui.flex1, { paddingRight: 6 }]}>
      <Text style={[ui.muted, { fontSize: 12 }]}>{biLabel(lang, label)}</Text>
      {g.label ? <Bi en={g.label} tr={tg?.label} style={[ui.body, { fontWeight: '700' }]} /> : null}
      {g.head ? <Bi en={g.head} tr={tg?.head} /> : null}
      {g.party ? <Bi en={g.party} tr={tg?.party} style={ui.muted} /> : null}
      {g.from || g.to ? (
        <Text style={[ui.muted, { fontSize: 12 }]}>
          {g.from || '…'} – {g.to || '…'}
        </Text>
      ) : null}
      {g.source ? (
        <TouchableOpacity onPress={() => openLink(g.source)}>
          <Text style={[ui.muted, { fontSize: 12, color: colors.primary }]} numberOfLines={1}>
            🔗 {host(g.source)}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function GovtCompareBox({ lang, state }: { lang: AppLanguage; state: string }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'state' | 'centre'>('state');
  const code = scope === 'centre' ? CENTRE_CODE : state;
  // Not opened = no request at all (state '' disables the hook)
  const { res, phase, errorText, tr, aiNote, fromCache } = useCivicData<CompareData>('gcmp', open ? code : '', '', '', lang, c => getCompareData(code, c));
  const d = res?.data;
  const t = (tr && res?.i18n?.[tr]) || null;

  return (
    <CivicCard lang={lang} hasTranslation={!!t}>
      <TouchableOpacity onPress={() => setOpen(v => !v)} activeOpacity={0.8}>
        <Text style={ui.h2}>
          ⚖️ {biLabel(lang, 'compareTitle')} {open ? '▴' : '▾'}
        </Text>
        <Text style={ui.muted}>{civicText(lang, 'compareNote')}</Text>
        {lang !== 'English' && civicText(lang, 'compareNote') !== civicText('English', 'compareNote') ? <Text style={[ui.muted, { fontSize: 12 }]}>{civicText('English', 'compareNote')}</Text> : null}
        {!open ? <Text style={[ui.body, { color: colors.primary, marginTop: 6 }]}>{civicText(lang, 'compareShow')}</Text> : null}
      </TouchableOpacity>
      {open ? (
        <View style={{ marginTop: 8 }}>
          <View style={[ui.row, { flexWrap: 'wrap', marginBottom: 6 }]}>
            {(['state', 'centre'] as const).map(sc => (
              <TouchableOpacity key={sc} style={[ui.chip, scope === sc && ui.chipOn]} onPress={() => setScope(sc)}>
                <Text style={[ui.chipText, scope === sc && ui.chipTextOn]}>{sc === 'centre' ? civicText(lang, 'centre') : stateByCodeApp(state)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <CivicStatus lang={lang} phase={phase} hasData={!!d} aiConfigured={!!(res?.researchConfigured ?? res?.aiConfigured)} errorText={errorText} aiNote={aiNote} fromCache={fromCache} />
          {d ? (
            <View>
              <View style={[ui.row, { alignItems: 'flex-start', marginBottom: 6 }]}>
                <GovtHead g={d.previous} tg={t?.previous} label="previousGovt" lang={lang} />
                <GovtHead g={d.present} tg={t?.present} label="presentGovt" lang={lang} />
              </View>
              {COMPARE_AREAS.map(area => {
                const rows = d.rows.map((r, i) => ({ r, i })).filter(x => x.r.area === area);
                if (!rows.length) return null;
                return (
                  <View key={area} style={{ marginTop: 10 }}>
                    <Text style={ui.h2}>{biLabel(lang, AREA_LABEL[area])}</Text>
                    {rows.map(({ r, i }) => {
                      const tr2 = t?.rows?.[i];
                      return (
                        <View key={`${area}${i}`} style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 }}>
                          <Bi en={r.topic} tr={tr2?.topic} style={[ui.body, { fontWeight: '700' }]} />
                          <View style={[ui.row, { alignItems: 'flex-start', marginTop: 4 }]}>
                            <View style={[ui.flex1, { paddingRight: 6 }]}>
                              <Text style={[ui.muted, { fontSize: 11 }]}>{civicText(lang, 'previousGovt')}</Text>
                              <FactCell f={r.previous} tf={tr2?.previous} lang={lang} />
                            </View>
                            <View style={ui.flex1}>
                              <Text style={[ui.muted, { fontSize: 11 }]}>{civicText(lang, 'presentGovt')}</Text>
                              <FactCell f={r.present} tf={tr2?.present} lang={lang} />
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
              <SourcesBox lang={lang} sources={res?.sources} updatedAt={res?.updatedAt || 0} asOf={d.asOf} />
            </View>
          ) : null}
        </View>
      ) : null}
    </CivicCard>
  );
}
