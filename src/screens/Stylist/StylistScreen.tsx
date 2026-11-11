// "Style" tab: AI stylist chat (Gemini free tier). Pick an occasion, a place and a language;
// the AI suggests clothes, colours and styles. Clothing topics only, max messages per day.
// Free offline picker (services/luckyPairs.ts): 3-5 top + bottom pairs from the user's own wardrobe
// for today's lucky colour, with photos and a short positive reason in EN / Telugu / Hindi. It is the
// default without an API key (or while the AI is out of credits / quota) and the answer whenever
// an AI call fails, so raw API errors are never shown.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  ActivityIndicator,
  Image,
  StyleSheet,
} from 'react-native';
import KeyboardSafeView from '../../components/KeyboardSafeView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getWardrobeItems, WardrobeItemResponse } from '../../services/wardrobeApi';
import { categoryIcon } from '../../constants/wardrobe';
import { getTodayVaaraColour } from '../../utils/panchangam';
import { useDayKey } from '../../hooks/useDayKey';
import { AI_DAILY_LIMIT, isAiConfigured } from '../../config/ai';
import {
  AI_LANGUAGES,
  AiLanguage,
  AiTurn,
  OCCASIONS,
  askStylist,
  defaultAiLanguage,
  getAiUsedToday,
  isAiPaused,
} from '../../services/aiStylist';
import { LuckyPairsResult, OCC_WORD, occasionKey, PAIR_TEXT, pairsSubtitle, pickLuckyPairs } from '../../services/luckyPairs';
import { offlineAnswer, pairsIntro, parseIntent } from '../../services/stylistIntent';
import { PLACES } from '../../services/stylistChips';
import { PlaceAdvice, placeAdvice } from '../../services/stylistPlaces';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hashString } from '../../utils/astro';
import { containsProfanity, RESPECT_MESSAGE } from '../../utils/profanity';

// pairs: show today's lucky wardrobe pairs under this message (offline picker)
// pairsCount / occ: how many pairs (1..3) and for which occasion, fixed when the answer was given
type Msg = { id: string; role: 'user' | 'model'; text: string; error?: boolean; pairs?: boolean; pairsCount?: number; occ?: string | null };

// What suits this place / occasion: the best outfit for it, what the wardrobe has or lacks (and the
// closest item owned now), a practical tip and today's lucky colour (services/stylistPlaces.ts)
function PlaceAdviceView({ advice }: { advice: PlaceAdvice }) {
  return (
    <View style={styles.adviceBox}>
      {advice.lines.map((l, i) => (
        <Text key={i} style={i === 0 ? styles.adviceBest : styles.adviceLine}>
          {i === 0 ? '💡 ' : advice.add && l === advice.add ? '➕ ' : '• '}
          {l}
        </Text>
      ))}
    </View>
  );
}

// Today's lucky top + bottom pairs with their photos and a short reason
function LuckyPairsView({ result, language }: { result: LuckyPairsResult; language: AiLanguage }) {
  const T = PAIR_TEXT[language];
  const photo = (uri: string | null, label: string) =>
    uri ? (
      <Image source={{ uri }} style={styles.pairPhoto} resizeMode="cover" />
    ) : (
      <View style={[styles.pairPhoto, styles.pairPhotoEmpty]}>
        <Text style={styles.pairPhotoLabel}>{label}</Text>
      </View>
    );
  const name = (i: WardrobeItemResponse) =>
    `${categoryIcon(i.category)} ${i.color && !i.color.startsWith('#') ? `${i.color} ` : ''}${i.name}`;
  return (
    <View style={styles.pairsBox}>
      <Text style={styles.pairsTitle}>{T.title}</Text>
      <View style={styles.pairsSubRow}>
        {result.vaara.colours.map(c => (
          <View key={c.name} style={[styles.luckyDot, { backgroundColor: c.hex }]} />
        ))}
        <Text style={styles.pairsSub}>{pairsSubtitle(result.vaara, language)}</Text>
      </View>
      {result.pairs.length === 0 ? (
        <Text style={styles.offlineText}>{T.needItems}</Text>
      ) : (
        result.pairs.map((p, idx) => (
          <View key={`${p.top.id}_${p.bottom.id}`} style={styles.pairCard}>
            <View style={styles.pairPhotos}>
              <View style={styles.pairCol}>
                {photo(p.top.imageUrl, T.top)}
                <Text style={styles.pairName} numberOfLines={2}>
                  {name(p.top)}
                </Text>
              </View>
              <Text style={styles.pairPlus}>+</Text>
              <View style={styles.pairCol}>
                {photo(p.bottom.imageUrl, T.bottom)}
                <Text style={styles.pairName} numberOfLines={2}>
                  {name(p.bottom)}
                </Text>
              </View>
            </View>
            <Text style={styles.pairWhy}>
              {idx === 0 ? '⭐ ' : '✨ '}
              {p.why}
            </Text>
          </View>
        ))
      )}
      {result.pairs.length > 0 && result.pairs.length < 3 ? <Text style={styles.pairsHint}>{T.fewItems}</Text> : null}
    </View>
  );
}

export default function StylistScreen() {
  const { user } = useAuth();
  const uid = user?.id;
  const aiOn = isAiConfigured();
  useDayKey(); // re-render at midnight so the day's colour updates
  const vaara = getTodayVaaraColour();

  const [language, setLanguage] = useState<AiLanguage>(defaultAiLanguage(user?.language));
  const [occasion, setOccasion] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  // Last tapped Occasion / Place chip: it drives the picks and the advice card
  const [focus, setFocus] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [used, setUsed] = useState(0);
  const [wardrobe, setWardrobe] = useState<WardrobeItemResponse[]>([]);
  // Occasion/place chips: open until the first message, then folded into one bar
  const [pickersOpen, setPickersOpen] = useState(true);
  const scrollRef = useRef<any>(null);

  useEffect(() => {
    setLanguage(defaultAiLanguage(user?.language));
  }, [user?.language]);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      getWardrobeItems(uid)
        .then(setWardrobe)
        .catch(e => console.warn('Stylist wardrobe load failed:', e?.message));
      if (aiOn) getAiUsedToday(uid).then(setUsed);
    }, [uid, aiOn]),
  );

  const left = Math.max(0, AI_DAILY_LIMIT - used);
  // AI usable right now (key set and not resting after a credits / quota failure)
  const [aiResting, setAiResting] = useState(isAiPaused());
  const aiReady = aiOn && !aiResting;
  // The last tapped chip leads; else the occasion, else the place (every chip maps to a rule key)
  const effOcc = (o: string | null) =>
    o || (focus && occasionKey(focus) ? focus : null) || occasion || (place && occasionKey(place) ? place : null);
  const firstOcc = effOcc(null);
  const luckyPairs = pickLuckyPairs(wardrobe, language, { occasion: firstOcc, max: 3 });
  const pairsFor = (m: Msg) => pickLuckyPairs(wardrobe, language, { occasion: m.occ ?? null, max: m.pairsCount || 3 });
  // Advice card + wardrobe pairs for one answer (the empty-pairs hint is skipped under advice)
  const pairsAnswer = (occ: string | null, result: LuckyPairsResult) => {
    const a = placeAdvice(wardrobe, language, occ);
    return (
      <>
        {a ? <PlaceAdviceView advice={a} /> : null}
        {a && result.pairs.length === 0 ? null : <LuckyPairsView result={result} language={language} />}
      </>
    );
  };
  const occWord = (o: string | null) => {
    const k = occasionKey(o);
    return k ? OCC_WORD[language][k] : null;
  };
  const scrollDown = (animated = true) =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated }), 80);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || sending || !uid) return;
    setPickersOpen(false);
    if (containsProfanity(text)) {
      setMessages(prev => [...prev, { id: `${Date.now()}_e`, role: 'model', text: RESPECT_MESSAGE, error: true }]);
      scrollDown();
      return;
    }
    const mine: Msg = { id: `${Date.now()}_u`, role: 'user', text };
    const history: AiTurn[] = [...messages.filter(m => !m.error), mine].map(m => ({ role: m.role, text: m.text }));
    setMessages(prev => [...prev, mine]);
    setInput('');
    scrollDown();

    // 1) Offline first: wardrobe picks (count / occasion), colour, "goes with", weather questions
    const intent = parseIntent(text);
    const occ = effOcc(intent.occasion || occasion);
    if (intent.occasion) {
      setOccasion(intent.occasion);
      setFocus(intent.occasion);
    }
    if (intent.wantsPairs) {
      const n = intent.count || 3;
      setMessages(prev => [
        ...prev,
        { id: `${Date.now()}_p`, role: 'model', text: pairsIntro(language, n, occWord(occ)), pairs: true, pairsCount: n, occ },
      ]);
      scrollDown();
      return;
    }
    const offline = offlineAnswer(intent, language, vaara);
    if (offline) {
      setMessages(prev => [...prev, { id: `${Date.now()}_o`, role: 'model', text: offline }]);
      scrollDown();
      return;
    }
    // 2) Other questions: free Gemini (cached per question / day / language), else the offline picks
    const fallback = () =>
      setMessages(prev => [
        ...prev,
        { id: `${Date.now()}_p`, role: 'model', text: pairsIntro(language, 3, occWord(occ)), pairs: true, pairsCount: 3, occ },
      ]);
    if (!aiReady || left <= 0) {
      fallback();
      scrollDown();
      return;
    }
    const cacheKey = `outfit.stylist.ai.${uid}.${new Date().toISOString().slice(0, 10)}.${language}.${hashString(
      `${text.toLowerCase()}|${occasion || ''}|${place || ''}`,
    )}`;
    const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
    if (cached) {
      setMessages(prev => [...prev, { id: `${Date.now()}_m`, role: 'model', text: cached }]);
      scrollDown();
      return;
    }
    setSending(true);
    try {
      const r = await askStylist(uid, history, {
        occasion,
        place,
        language,
        gender: user?.gender,
        stylePrefs: user?.stylePrefs,
        wardrobeCategories: Array.from(new Set(wardrobe.map(w => w.category).filter(Boolean))),
        luckyColours: vaara.colours.map(c => c.name),
        luckyWhy: vaara.why,
      });
      setUsed(r.usedToday);
      AsyncStorage.setItem(cacheKey, r.text).catch(() => undefined);
      setMessages(prev => [...prev, { id: `${Date.now()}_m`, role: 'model', text: r.text }]);
    } catch (e: any) {
      // Never show the raw error: answer with today's lucky pairs from the wardrobe instead
      console.warn('Stylist AI failed, offline picks shown:', e?.detail || e?.message);
      setAiResting(isAiPaused());
      fallback();
      if (uid) getAiUsedToday(uid).then(setUsed);
    } finally {
      setSending(false);
      scrollDown();
    }
  };

  // Occasion / Place chip: advice for it + the wardrobe picks re-ranked for it (offline, no AI
  // call). Tap again to clear.
  const showChip = (next: string | null) => {
    setFocus(next);
    if (!next || messages.length === 0) return; // the first-screen card below updates by itself
    setMessages(prev => [
      ...prev,
      { id: `${Date.now()}_p`, role: 'model', text: pairsIntro(language, 3, occWord(next)), pairs: true, pairsCount: 3, occ: next },
    ]);
    scrollDown();
  };
  const askForOccasion = (occ: string) => {
    const next = occasion === occ ? null : occ;
    setOccasion(next);
    showChip(next);
  };
  const askForPlace = (p: string) => {
    const next = place === p ? null : p;
    setPlace(next);
    showChip(next);
  };


  // Small pill chips in a one-line horizontal row (flexGrow 0 so the row never stretches tall)
  const chips = (list: string[], value: string | null, onPick: (v: string) => void, labels?: Record<string, string>) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipScroll}
      contentContainerStyle={styles.chipRow}
      keyboardShouldPersistTaps="handled">
      {list.map(o => {
        const on = value === o;
        return (
          <TouchableOpacity
            key={o}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => onPick(o)}
            disabled={sending}
            activeOpacity={0.8}>
            <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
              {labels?.[o] || o}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const pickerSummary = [occasion ? `🎯 ${occasion}` : '🎯 Occasion', place ? `📍 ${place}` : '📍 Place'].join('   ');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})}
      />
      <KeyboardSafeView style={styles.flex1}>
        {/* Compact header: title + language pills */}
        <View style={styles.header}>
          <View style={styles.flex1}>
            <Text style={styles.title}>AI Stylist ✦</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {aiReady ? `${left}/${AI_DAILY_LIMIT} messages left today` : 'Your personal style guide'}
            </Text>
          </View>
          <View style={styles.langRow}>
            {AI_LANGUAGES.map(l => {
              const on = language === l;
              return (
                <TouchableOpacity
                  key={l}
                  style={[styles.langPill, on && styles.chipOn]}
                  onPress={() => setLanguage(l)}
                  disabled={sending}>
                  <Text style={[styles.langText, on && styles.chipTextOn]}>{LANG_LABEL[l]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Occasion + place: one collapsible bar */}
        <TouchableOpacity style={styles.pickerBar} onPress={() => setPickersOpen(o => !o)} activeOpacity={0.8}>
          <Text style={styles.pickerSummary} numberOfLines={1}>
            {pickerSummary}
          </Text>
          <Text style={styles.pickerToggle}>{pickersOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {pickersOpen ? (
          <View style={styles.pickers}>
            {chips(OCCASIONS, occasion, askForOccasion)}
            {chips(PLACES, place, askForPlace)}
          </View>
        ) : null}

        {/* Chat history takes the rest of the screen */}
        <ScrollView
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chat}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollDown(false)}>
          <View style={styles.luckyRow}>
            {vaara.colours.map(c => (
              <View key={c.name} style={[styles.luckyDot, { backgroundColor: c.hex }]} />
            ))}
            <Text style={styles.luckyTitle} numberOfLines={2}>
              Today's lucky colour: {vaara.colours.map(c => c.name).join(' / ')}
            </Text>
          </View>

          {messages.length === 0 ? (
            <>
              {aiReady ? (
                <View style={styles.soon}>
                  <Text style={styles.soonEmoji}>👗</Text>
                  <Text style={styles.soonTitle}>Ask me what to wear</Text>
                  <Text style={styles.soonText}>
                    Pick an occasion above, or type e.g. "Navy shirt, which pants and shoes go with it?"
                  </Text>
                </View>
              ) : null}
              {/* Free offline picks: the default without AI, and a ready answer with it */}
              {pairsAnswer(firstOcc, luckyPairs)}
            </>
          ) : (
            messages.map(m => (
              <View key={m.id}>
                <View
                  style={[
                    styles.bubble,
                    m.role === 'user' ? styles.bubbleMe : styles.bubbleAi,
                    m.error && styles.bubbleErr,
                  ]}>
                  <Text
                    selectable
                    style={[styles.bubbleText, m.role === 'user' && styles.bubbleTextMe, m.error && styles.bubbleTextErr]}>
                    {m.text}
                  </Text>
                </View>
                {m.pairs ? pairsAnswer(m.occ ?? null, pairsFor(m)) : null}
              </View>
            ))
          )}
          {sending ? (
            <View style={[styles.bubble, styles.bubbleAi, styles.typing]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.typingText}>Stylist is typing…</Text>
            </View>
          ) : null}
        </ScrollView>

        {true ? (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder="Ask about clothes, colours, style..."
              placeholderTextColor={colors.textMuted}
              value={input}
              onChangeText={setInput}
              onFocus={() => scrollDown()}
              editable={!sending}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || sending) && styles.disabled]}
              onPress={() => send()}
              disabled={!input.trim() || sending}>
              <Text style={styles.sendText}>➤</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardSafeView>
    </SafeAreaView>
  );
}

const LANG_LABEL: Record<AiLanguage, string> = { English: 'EN', Telugu: 'తె', Hindi: 'हि' };

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: 6,
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  sub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },
  langRow: { flexDirection: 'row', alignItems: 'center' },
  langPill: {
    minWidth: 36,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginLeft: 6,
    alignItems: 'center',
  },
  langText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  pickerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerSummary: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semiBold, color: colors.textPrimary },
  pickerToggle: { fontSize: fontSize.xs, color: colors.textMuted, marginLeft: spacing.sm },
  pickers: { paddingBottom: 2 },
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: { alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: 4 },
  chip: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semiBold, color: colors.textPrimary },
  chipTextOn: { color: colors.onPrimary },
  chatScroll: { flex: 1 },
  chat: { flexGrow: 1, paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.md },
  luckyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    maxWidth: '100%',
  },
  luckyDot: { width: 12, height: 12, borderRadius: 6, marginRight: 4, borderWidth: 1, borderColor: colors.border },
  luckyTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.semiBold, color: colors.textSecondary, marginLeft: 2, flexShrink: 1 },
  soon: { alignItems: 'center', padding: spacing.lg },
  soonEmoji: { fontSize: 40 },
  soonTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary, marginTop: spacing.sm },
  soonText: { fontSize: fontSize.base, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
  offline: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  offlineTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: 6 },
  offlineText: { fontSize: fontSize.base, color: colors.textSecondary, lineHeight: 22 },
  adviceBox: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  adviceBest: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary, lineHeight: 22 },
  adviceLine: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20, marginTop: 6 },
  pairsBox: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  pairsTitle: { fontSize: fontSize.base, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  pairsSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: spacing.sm, flexWrap: 'wrap' },
  pairsSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginLeft: 2, flexShrink: 1 },
  pairsHint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  pairCard: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  pairPhotos: { flexDirection: 'row', alignItems: 'flex-start' },
  pairCol: { flex: 1, alignItems: 'center' },
  pairPhoto: { width: '100%', aspectRatio: 1, borderRadius: borderRadius.md, backgroundColor: colors.inputBg },
  pairPhotoEmpty: { alignItems: 'center', justifyContent: 'center' },
  pairPhotoLabel: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: fontWeight.semiBold },
  pairPlus: { fontSize: 22, fontWeight: fontWeight.bold, color: colors.textMuted, marginHorizontal: 6, marginTop: 40 },
  pairName: { fontSize: fontSize.xs, color: colors.textPrimary, fontWeight: fontWeight.semiBold, marginTop: 4, textAlign: 'center' },
  pairWhy: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20, marginTop: spacing.sm },
  bubble: {
    maxWidth: '85%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleAi: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleErr: { borderColor: colors.error, borderWidth: 1.5 },
  bubbleText: { fontSize: 15.5, color: colors.textPrimary, lineHeight: 23 },
  bubbleTextMe: { color: colors.onPrimary },
  bubbleTextErr: { fontSize: fontSize.sm, lineHeight: 20 },
  typing: { flexDirection: 'row', alignItems: 'center' },
  typingText: { fontSize: fontSize.sm, color: colors.textMuted, marginLeft: spacing.sm },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 42,
    backgroundColor: colors.inputBg,
    borderRadius: 21,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  sendText: { color: colors.onPrimary, fontSize: 18 },
  disabled: { opacity: 0.4 },
}));
