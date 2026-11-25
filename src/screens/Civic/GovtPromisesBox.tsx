// Govt tab > "Promises: what was promised, done, pending": the PRESENT government's election
// manifesto promises for the picked state or the centre, each with a status (done / in progress /
// not done / no update). A status other than "no update" always carries a neutral fact with its own
// public source link + date (the Worker forces "no update" otherwise and drops evaluative words).
// Real data only: the counts are computed from the researched promises on screen (never a sample,
// placeholder or seed number); with no researched promises the box says "no data yet" instead.
// Collapsed until the user opens it, so research is only asked for when someone wants it (same
// per-user / daily caps on the Worker). Each item in the app language with an English toggle.
import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { AppLanguage } from '../../i18n/appLanguage';
import { CivicKey, civicText } from '../../i18n/civicLabels';
import { CENTRE_CODE, PROMISE_STATUSES, PromiseItem, PromiseStatus, PromisesData, getPromisesData } from '../../services/civicApi';
import { CivicStatus, SourcesBox, openLink } from './civicParts';
import { Bi, CivicCard, biLabel } from './bi';
import { stateByCodeApp } from './stateName';
import { useCivicData } from './useCivicData';

export const STATUS_LABEL: Record<PromiseStatus, CivicKey> = {
  done: 'prmDone',
  in_progress: 'prmInProgress',
  not_done: 'prmNotDone',
  no_update: 'prmNoUpdate',
};
// read at render time (colors is the live light / dark palette)
const statusColor = (st: PromiseStatus): string =>
  st === 'done' ? colors.success : st === 'in_progress' ? colors.info : st === 'not_done' ? colors.error : colors.textMuted;

const host = (u: string) => u.replace(/^https:\/\//, '').split('/')[0];

// A Worker deployed before kind 'gprm' answers 400 "bad kind / state / district / variant" (or 404 =
// 'serverOld'): the feature is simply not live there yet. Any other failure with nothing saved is
// "no data yet". Never a raw error text on screen, never numbers without researched promises.
export type PromisesNotice = 'notLive' | 'noData' | null;
export const promisesNotice = (phase: string, errorText: string, hasData: boolean): PromisesNotice => {
  if (hasData) return null;
  if (phase === 'serverOld' || /\b(bad|unknown|invalid) kind\b/i.test(errorText || '')) return 'notLive';
  return phase === 'error' ? 'noData' : null;
};

// Counts from the promises themselves (only researched, sourced promises reach the app)
export const countPromises = (list: PromiseItem[]) => ({
  total: list.length,
  done: list.filter(p => p.status === 'done').length,
  in_progress: list.filter(p => p.status === 'in_progress').length,
  not_done: list.filter(p => p.status === 'not_done').length,
  no_update: list.filter(p => p.status === 'no_update').length,
});

function Badge({ status, lang }: { status: PromiseStatus; lang: AppLanguage }) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: statusColor(status), borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{civicText(lang, STATUS_LABEL[status])}</Text>
    </View>
  );
}

export default function GovtPromisesBox({ lang, state }: { lang: AppLanguage; state: string }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'state' | 'centre'>('state');
  const [filter, setFilter] = useState<PromiseStatus | 'all'>('all');
  const code = scope === 'centre' ? CENTRE_CODE : state;
  // Not opened = no request at all (state '' disables the hook)
  const { res, phase, errorText, tr, aiNote, fromCache } = useCivicData<PromisesData>('gprm', open ? code : '', '', '', lang, c => getPromisesData(code, c));
  const d = res?.data;
  const t = (tr && res?.i18n?.[tr]) || null;
  const list = useMemo(() => (d && Array.isArray(d.promises) ? d.promises.filter(p => p && p.text) : []), [d]);
  const n = countPromises(list);
  const hasData = list.length > 0;
  const shown = list.map((p, i) => ({ p, i })).filter(x => filter === 'all' || x.p.status === filter);
  const pct = (k: number) => (n.total ? `${(k / n.total) * 100}%` : '0%');
  const notice = promisesNotice(phase, errorText, hasData);

  return (
    <CivicCard lang={lang} hasTranslation={!!t}>
      <TouchableOpacity onPress={() => setOpen(v => !v)} activeOpacity={0.8}>
        <Text style={ui.h2}>
          📜 {biLabel(lang, 'prmTitle')} {open ? '▴' : '▾'}
        </Text>
        <Text style={ui.muted}>{civicText(lang, 'prmNote')}</Text>
        {lang !== 'English' && civicText(lang, 'prmNote') !== civicText('English', 'prmNote') ? <Text style={[ui.muted, { fontSize: 12 }]}>{civicText('English', 'prmNote')}</Text> : null}
        {!open ? <Text style={[ui.body, { color: colors.primary, marginTop: 6 }]}>{civicText(lang, 'prmShow')}</Text> : null}
      </TouchableOpacity>
      {open ? (
        <View style={{ marginTop: 8 }}>
          <View style={[ui.row, { flexWrap: 'wrap', marginBottom: 6 }]}>
            {(['state', 'centre'] as const).map(sc => (
              <TouchableOpacity
                key={sc}
                style={[ui.chip, scope === sc && ui.chipOn]}
                onPress={() => {
                  setScope(sc);
                  setFilter('all');
                }}
              >
                <Text style={[ui.chipText, scope === sc && ui.chipTextOn]}>{sc === 'centre' ? civicText(lang, 'centre') : stateByCodeApp(state)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {notice ? (
            <Text testID={notice === 'notLive' ? 'prm-notlive' : 'prm-nodata-yet'} style={[ui.muted, { marginVertical: 6 }]}>
              {notice === 'notLive' ? '⏳' : '🔎'} {biLabel(lang, notice === 'notLive' ? 'prmNotLive' : 'prmNoDataYet')}
            </Text>
          ) : (
            <CivicStatus lang={lang} phase={phase} hasData={hasData} aiConfigured={!!(res?.researchConfigured ?? res?.aiConfigured)} errorText={errorText} aiNote={aiNote} fromCache={fromCache} />
          )}
          {!hasData && phase !== 'loading' && phase !== 'collecting' && phase !== 'error' && phase !== 'serverOld' ? (
            <Text testID="prm-nodata" style={[ui.muted, { marginVertical: 6 }]}>
              🔎 {biLabel(lang, 'prmNoData')}
            </Text>
          ) : null}
          {d && hasData ? (
            <View>
              <View style={{ marginBottom: 6 }}>
                {d.govt.party ? <Bi en={d.govt.party} tr={t?.govt?.party} style={[ui.body, { fontWeight: '700' }]} /> : null}
                {d.govt.head ? (
                  <View>
                    <Text style={[ui.muted, { fontSize: 12 }]}>{civicText(lang, 'prmHead')}</Text>
                    <Bi en={d.govt.head} tr={t?.govt?.head} />
                  </View>
                ) : null}
                {d.govt.source ? (
                  <TouchableOpacity onPress={() => openLink(d.govt.source)}>
                    <Text style={[ui.muted, { fontSize: 12, color: colors.primary }]} numberOfLines={1}>
                      🔗 {civicText(lang, 'prmManifesto')}
                      {d.govt.year ? ` ${d.govt.year}` : ''}
                      {d.govt.term ? ` (${d.govt.term})` : ''}: {host(d.govt.source)}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {d.asOf ? (
                  <Text style={[ui.muted, { fontSize: 12 }]}>
                    {civicText(lang, 'asOf')}: {d.asOf}
                  </Text>
                ) : null}
              </View>
              <Text testID="prm-counts" style={[ui.body, { fontWeight: '700' }]}>
                {civicText(lang, 'prmTotal')} {n.total} · {civicText(lang, 'prmDone')} {n.done} · {civicText(lang, 'prmInProgress')} {n.in_progress} · {civicText(lang, 'prmNotDone')} {n.not_done} ·{' '}
                {civicText(lang, 'prmNoUpdate')} {n.no_update}
              </Text>
              <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border, marginVertical: 6 }}>
                {PROMISE_STATUSES.map(st => (n[st] ? <View key={st} style={{ width: pct(n[st]) as any, backgroundColor: statusColor(st) }} /> : null))}
              </View>
              <View style={[ui.row, { flexWrap: 'wrap', marginBottom: 4 }]}>
                {(['all', ...PROMISE_STATUSES] as const).map(st => (
                  <TouchableOpacity key={st} style={[ui.chip, filter === st && ui.chipOn]} onPress={() => setFilter(st)}>
                    <Text style={[ui.chipText, filter === st && ui.chipTextOn]}>
                      {st === 'all' ? `${civicText(lang, 'prmAll')} ${n.total}` : `${civicText(lang, STATUS_LABEL[st])} ${n[st]}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {!shown.length ? <Text style={ui.muted}>{civicText(lang, 'prmNoneInFilter')}</Text> : null}
              {shown.map(({ p, i }) => {
                const tp = t?.promises?.[i];
                return (
                  <View key={`p${i}`} style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 }}>
                    <Badge status={p.status} lang={lang} />
                    <Bi en={p.text} tr={tp?.text} style={[ui.body, { fontWeight: '700' }]} />
                    {p.fact ? <Bi en={p.fact} tr={tp?.fact} /> : null}
                    {p.source ? (
                      <TouchableOpacity onPress={() => openLink(p.source)}>
                        <Text style={[ui.muted, { fontSize: 12, color: colors.primary }]} numberOfLines={1}>
                          🔗 {host(p.source)}
                          {p.date ? ` · 📅 ${p.date}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
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
