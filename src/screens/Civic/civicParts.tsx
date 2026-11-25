// Shared bits for the Govt / Hospitals tabs: State -> District -> Mandal picker (LocationPicker.tsx), stars,
// people's reviews.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { AppLanguage } from '../../i18n/appLanguage';
import { CivicKey, civicText } from '../../i18n/civicLabels';
import { AnsweredBy, CivicReviewsResponse, getReviews, postReview, reportReview } from '../../services/civicApi';

export { PlacePicker, useCivicPlace, scopeNote, askedLevel, subLevelLabel } from './LocationPicker';
export type { CivicPlace, ScopeLevel } from './LocationPicker';

export const openLink = (url: string) => {
  if (url) Linking.openURL(url).catch(() => undefined);
};

export const callNumber = (n: string) => {
  const d = String(n || '').split(/[,/]/)[0].replace(/[^0-9+]/g, '');
  if (d) Linking.openURL(`tel:${d}`).catch(() => undefined);
};

export function Stars({ value, onPick, size = 22 }: { value: number; onPick?: (n: number) => void; size?: number }) {
  return (
    <View style={ui.row}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} disabled={!onPick} onPress={() => onPick && onPick(n)} hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}>
          <Text style={{ fontSize: size, color: n <= Math.round(value) ? '#F5A623' : colors.border }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function ReviewsBox({ lang, item, userName, myUid }: { lang: AppLanguage; item: string; userName?: string; myUid?: string }) {
  const [data, setData] = useState<CivicReviewsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getReviews(item);
      setData(r);
      if (r.mine) {
        setStars(r.mine.stars);
        setBody(r.mine.body);
      } else {
        setStars(0);
        setBody('');
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [item]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!stars) return;
    setBusy(true);
    try {
      await postReview(item, stars, body, userName);
      Alert.alert(civicText(lang, 'saved'));
      load();
    } catch (e: any) {
      Alert.alert(civicText(lang, 'yourReview'), e?.message || civicText(lang, 'error'));
    } finally {
      setBusy(false);
    }
  };

  const report = async (author: string) => {
    try {
      await reportReview(item, author);
      Alert.alert(civicText(lang, 'reported'));
    } catch (e: any) {
      Alert.alert(civicText(lang, 'report'), e?.message || civicText(lang, 'error'));
    }
  };

  return (
    <View style={ui.card}>
      <View style={ui.row}>
        <Text style={[ui.h2, ui.flex1]}>{civicText(lang, 'reviews')}</Text>
        {data && data.avg !== null ? (
          <Text style={ui.muted}>
            {civicText(lang, 'avg')} {data.avg} ★ ({data.count})
          </Text>
        ) : null}
      </View>
      <Text style={ui.body}>{civicText(lang, 'yourReview')}</Text>
      <Stars value={stars} onPick={setStars} size={28} />
      <TextInput
        style={[ui.input, { minHeight: 70, textAlignVertical: 'top' }]}
        value={body}
        onChangeText={setBody}
        placeholder={civicText(lang, 'writeReview')}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={1000}
      />
      <TouchableOpacity style={[ui.btn, (!stars || busy) && ui.btnOff]} disabled={!stars || busy} onPress={submit}>
        <Text style={ui.btnText}>{busy ? '…' : civicText(lang, 'submit')}</Text>
      </TouchableOpacity>
      {loading ? <ActivityIndicator style={{ marginTop: 12 }} color={colors.primary} /> : null}
      {data && !data.reviews.length && !loading ? <Text style={[ui.muted, { marginTop: 12 }]}>{civicText(lang, 'noReviews')}</Text> : null}
      {(data?.reviews || []).map(r => (
        <View key={`${r.item}:${r.author}`} style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
          <View style={ui.row}>
            <Text style={[ui.body, ui.flex1, { fontWeight: '700' }]}>{r.userName}</Text>
            <Stars value={r.stars} size={14} />
          </View>
          {r.body ? <Text style={ui.body}>{r.body}</Text> : null}
          <View style={ui.row}>
            <Text style={[ui.muted, ui.flex1]}>{fmtDate(r.updatedAt)}</Text>
            {r.author !== myUid ? (
              <TouchableOpacity onPress={() => report(r.author)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={ui.muted}>⚑ {civicText(lang, 'report')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

// "local\nEnglish" (just English when the language is English or not translated yet)
const bothLines = (lang: AppLanguage, k: CivicKey, sep = '\n') => {
  const en = civicText('English', k);
  const local = civicText(lang, k);
  return lang === 'English' || local === en ? en : `${local}${sep}${en}`;
};

// Status line for a civic place: collecting / translating / server update / error / AI limit
// (bilingual). fromCache: saved info is on screen while the Worker answer is on its way.
export function CivicStatus({
  lang,
  phase,
  hasData,
  aiConfigured,
  errorText,
  aiNote,
  fromCache,
}: {
  lang: AppLanguage;
  phase: string;
  hasData: boolean;
  aiConfigured: boolean;
  errorText?: string;
  aiNote?: CivicKey | null;
  fromCache?: boolean;
}) {
  const both = (k: CivicKey) => bothLines(lang, k);
  const note = aiNote ? <Text style={[ui.muted, { marginBottom: 8 }]}>⚠️ {both(aiNote)}</Text> : null;
  if (phase === 'loading' && !hasData) return <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />;
  if (phase === 'serverOld') return <View style={ui.card}><Text style={ui.body}>⏳ {both('serverUpdate')}</Text></View>;
  if (phase === 'error' && !hasData)
    return (
      <View style={ui.card}>
        <Text style={ui.bad}>{both('error')}</Text>
        {errorText ? <Text style={ui.muted}>{errorText}</Text> : null}
        {note}
      </View>
    );
  // Some parts (Govt) already on screen: a small line instead of the big spinner card
  if (phase === 'collecting' && hasData)
    return (
      <View style={[ui.row, { marginBottom: 8 }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[ui.muted, ui.flex1, { marginLeft: 8 }]}>🔎 {both('collecting')}</Text>
      </View>
    );
  if (phase === 'collecting')
    return (
      <View style={ui.card}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[ui.body, { marginTop: 8, textAlign: 'center' }]}>🔎 {both('collecting')}</Text>
        {note}
      </View>
    );
  if (!hasData && phase === 'ready')
    return (
      <View style={ui.card}>
        <Text style={ui.body}>{both(aiConfigured ? 'noData' : 'aiOff')}</Text>
        {note}
      </View>
    );
  if (phase === 'translating' && lang !== 'English') return <Text style={[ui.muted, { marginBottom: 8 }]}>🌐 {civicText(lang, 'translating')}</Text>;
  if (fromCache && hasData) return <Text style={[ui.muted, { marginBottom: 8, fontSize: 12 }]}>💾 {civicText(lang, 'showingSaved')}</Text>;
  return note;
}

// Public web pages the research used + "as of" + verify note
export function SourcesBox({ lang, sources, updatedAt, asOf }: { lang: AppLanguage; sources?: { url: string; title: string }[]; updatedAt: number; asOf?: string }) {
  const both = (k: CivicKey) => bothLines(lang, k, ' · ');
  const host = (u: string) => u.replace(/^https:\/\//, '').split('/')[0];
  return (
    <View style={ui.card}>
      <Text style={ui.h2}>📚 {both('sources')}</Text>
      <Text style={ui.muted}>
        {civicText(lang, 'updated')}: {fmtDate(updatedAt)}
        {asOf ? ` · ${civicText(lang, 'asOf')} ${asOf}` : ''}
      </Text>
      <Text style={[ui.body, { marginTop: 4 }]}>⚠️ {civicText(lang, 'outdated')}</Text>
      {lang !== 'English' && civicText(lang, 'outdated') !== civicText('English', 'outdated') ? <Text style={ui.muted}>{civicText('English', 'outdated')}</Text> : null}
      {(sources || []).map((s, i) => (
        <TouchableOpacity key={`${s.url}${i}`} onPress={() => openLink(s.url)} style={{ marginTop: 6 }}>
          <Text style={[ui.muted, { color: colors.primary }]} numberOfLines={2}>
            🔗 {s.title || host(s.url)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const ANSWER_KEY: Record<AnsweredBy, CivicKey> = {
  free: 'srcFree',
  gemini: 'srcGemini',
  groq: 'srcGroq',
  'workers-ai': 'srcWorkersAi',
  saved: 'srcSaved',
};

// "Answered by: Free public sources · 25 Nov 2026" (which source in the fallback chain answered)
export function AnsweredByLine({ lang, by, updatedAt }: { lang: AppLanguage; by?: AnsweredBy; updatedAt?: number }) {
  if (!by) return null;
  return (
    <Text testID="civic-answered-by" style={[ui.muted, { fontSize: 12, marginBottom: 6 }]}>
      ℹ️ {civicText(lang, 'srcAnswered')}: {civicText(lang, ANSWER_KEY[by])}
      {updatedAt ? ` · ${fmtDate(updatedAt)}` : ''}
    </Text>
  );
}

// Visible "No data for <mandal>, showing <district> district" line ('' = nothing to say)
export function ScopeNoteLine({ text }: { text: string }) {
  if (!text) return null;
  return (
    <View testID="civic-scope-note" style={[ui.card, { borderColor: '#F5A623', paddingVertical: 8 }]}>
      <Text style={ui.body}>📍 {text}</Text>
    </View>
  );
}
