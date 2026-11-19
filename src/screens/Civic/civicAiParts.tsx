// Civic AI boxes: "Ask about laws" (Laws tab), Hospital AI (Hospitals tab) and "Explain simply" (Govt
// tab). The answer shows in the app language with an English toggle (CivicCard), always ending with
// the safety line. Failures show a clear message (free-tier limit / credits used up / daily limit).
import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { APP_LANGUAGE_NATIVE, AppLanguage } from '../../i18n/appLanguage';
import { CivicKey, civicText } from '../../i18n/civicLabels';
import { CivicAnswer, aiErrorKey } from '../../services/civicAi';
import { Bi, CivicCard } from './bi';

const both = (lang: AppLanguage, k: CivicKey) => {
  const en = civicText('English', k);
  const local = civicText(lang, k);
  return lang === 'English' || local === en ? en : `${local}\n${en}`;
};

export type Turn = { role: 'user' | 'model'; text: string };

// Free-text question box with a short chat memory (last 6 turns)
export function CivicAskBox({
  lang,
  title,
  note,
  hint,
  onAsk,
  footer,
}: {
  lang: AppLanguage;
  title: string;
  note: string;
  hint: string;
  onAsk: (question: string, history: Turn[]) => Promise<CivicAnswer>;
  footer?: (a: CivicAnswer) => React.ReactNode;
}) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<CivicAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState<CivicKey | null>(null);
  const [history, setHistory] = useState<Turn[]>([]);
  const ask = async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setErr(null);
    try {
      const a = await onAsk(q, history.slice(-6));
      setAnswer(a);
      setHistory(h => [...h, { role: 'user' as const, text: q }, { role: 'model' as const, text: a.en || a.answer }].slice(-6));
      setQuestion('');
    } catch (e) {
      setErr(aiErrorKey(e));
    } finally {
      setAsking(false);
    }
  };
  return (
    <CivicCard lang={lang} hasTranslation={!!answer?.en}>
      <Text style={ui.h2}>🤖 {title}</Text>
      <Text style={ui.muted}>{note}</Text>
      <TextInput
        style={ui.input}
        value={question}
        onChangeText={setQuestion}
        placeholder={hint}
        placeholderTextColor={colors.textMuted}
        maxLength={400}
        onSubmitEditing={ask}
        returnKeyType="send"
      />
      <TouchableOpacity style={[ui.btn, (asking || !question.trim()) && ui.btnOff]} disabled={asking || !question.trim()} onPress={ask}>
        <Text style={ui.btnText}>{asking ? '…' : civicText(lang, 'ask')}</Text>
      </TouchableOpacity>
      {err ? <Text style={[ui.bad, { marginTop: 8 }]}>{both(lang, err)}</Text> : null}
      {answer ? (
        <View style={{ marginTop: 10 }}>
          <Bi en={answer.en || answer.answer} tr={answer.en ? answer.answer : null} />
          {footer ? footer(answer) : null}
        </View>
      ) : null}
    </CivicCard>
  );
}

// One-tap "Explain simply" under a Govt card (schemes, grievance, services, ...); cached on the Worker
export function ExplainButton({ lang, onExplain }: { lang: AppLanguage; onExplain: () => Promise<CivicAnswer> }) {
  const [answer, setAnswer] = useState<CivicAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<CivicKey | null>(null);
  const [showEn, setShowEn] = useState(false);
  const run = async () => {
    if (busy) return;
    if (answer) {
      setAnswer(null);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      setAnswer(await onExplain());
    } catch (e) {
      setErr(aiErrorKey(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ marginTop: 10 }}>
      <TouchableOpacity style={[ui.btnGhost, { alignSelf: 'flex-start' }]} onPress={run} disabled={busy}>
        <Text style={ui.btnGhostText}>✨ {civicText(lang, 'explainSimply')}{answer ? ' ▴' : ''}</Text>
      </TouchableOpacity>
      {busy ? <ActivityIndicator color={colors.primary} style={{ marginTop: 6 }} /> : null}
      {err ? <Text style={[ui.bad, { marginTop: 6 }]}>{both(lang, err)}</Text> : null}
      {answer ? (
        <View style={{ marginTop: 6 }}>
          <Text style={ui.body}>{showEn && answer.en ? answer.en : answer.answer}</Text>
          {answer.en ? (
            <TouchableOpacity onPress={() => setShowEn(v => !v)} style={[ui.chip, showEn && ui.chipOn, { alignSelf: 'flex-start', marginTop: 6 }]}>
              <Text style={[ui.chipText, showEn && ui.chipTextOn, { fontSize: 11 }]}>{showEn ? APP_LANGUAGE_NATIVE[lang] : civicText(lang, 'englishToggle')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
