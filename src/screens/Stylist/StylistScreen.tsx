// "Style" tab: AI stylist chat (Gemini free tier). Pick an occasion, a place and a language;
// the AI suggests clothes, colours and styles. Clothing topics only, max messages per day.
// Without an API key it shows "coming soon" plus picks from the user's own wardrobe.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getWardrobeItems, WardrobeItemResponse } from '../../services/wardrobeApi';
import { categoryIcon } from '../../constants/wardrobe';
import { getTodayVaaraColour } from '../../utils/panchangam';
import { AI_DAILY_LIMIT, isAiConfigured } from '../../config/ai';
import {
  AI_LANGUAGES,
  AiLanguage,
  AiTurn,
  OCCASIONS,
  askStylist,
  defaultAiLanguage,
  getAiUsedToday,
} from '../../services/aiStylist';
import { containsProfanity, RESPECT_MESSAGE } from '../../utils/profanity';

const TOP_CATS = ['Shirts', 'T-Shirts', 'Kurtas', 'Tops', 'Kurtis', 'Jackets', 'Ethnic'];
const BOTTOM_CATS = ['Jeans', 'Trousers', 'Pants', 'Shorts', 'Leggings', 'Skirts'];
const ONE_PIECE_CATS = ['Sarees', 'Dresses', 'Lehengas'];
const SHOE_CATS = ['Footwear', 'Shoes'];
const OCCASION_PREFS: Record<string, string[]> = {
  Work: ['Formal', 'Daily Wear'],
  College: ['Casual', 'Daily Wear'],
  Date: ['Casual', 'Party'],
  Party: ['Party', 'Casual', 'Ethnic'],
  'Wedding / Function': ['Ethnic', 'Formal'],
  'Casual outing': ['Casual', 'Daily Wear'],
  Travel: ['Casual', 'Daily Wear'],
};
const PLACES = ['Indoor', 'Outdoor', 'Beach', 'Temple', 'Office', 'Restaurant', 'Hill station'];

// Offline pick from the user's own wardrobe (used when the AI key isn't set)
const suggestFromWardrobe = (items: WardrobeItemResponse[], occasion: string): string | null => {
  if (!items.length) return null;
  const prefs = OCCASION_PREFS[occasion] || [];
  const score = (i: WardrobeItemResponse) =>
    (prefs.includes(i.wearType || '') ? 2 : 0) + (prefs.includes(i.fabric || '') ? 1 : 0);
  const best = (cats: string[]) =>
    items.filter(i => cats.includes(i.category)).sort((a, b) => score(b) - score(a))[0];
  const onePiece = best(ONE_PIECE_CATS);
  const top = best(TOP_CATS);
  const bottom = best(BOTTOM_CATS);
  const shoes = best(SHOE_CATS);
  const pieces = onePiece && (!top || !bottom || score(onePiece) > score(top)) ? [onePiece, shoes] : [top, bottom, shoes];
  const chosen = pieces.filter(Boolean) as WardrobeItemResponse[];
  if (!chosen.length) return null;
  return chosen.map(i => `${categoryIcon(i.category)} ${i.color && !i.color.startsWith('#') ? `${i.color} ` : ''}${i.name}`).join('\n');
};

type Msg = { id: string; role: 'user' | 'model'; text: string; error?: boolean };

export default function StylistScreen() {
  const { user } = useAuth();
  const uid = user?.id;
  const aiOn = isAiConfigured();
  const vaara = getTodayVaaraColour();

  const [language, setLanguage] = useState<AiLanguage>(defaultAiLanguage(user?.language));
  const [occasion, setOccasion] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [used, setUsed] = useState(0);
  const [wardrobe, setWardrobe] = useState<WardrobeItemResponse[]>([]);
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
  const scrollDown = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || sending || !uid) return;
    if (containsProfanity(text)) {
      setMessages(prev => [...prev, { id: `${Date.now()}_e`, role: 'model', text: RESPECT_MESSAGE, error: true }]);
      return;
    }
    const mine: Msg = { id: `${Date.now()}_u`, role: 'user', text };
    const history: AiTurn[] = [...messages.filter(m => !m.error), mine].map(m => ({ role: m.role, text: m.text }));
    setMessages(prev => [...prev, mine]);
    setInput('');
    setSending(true);
    scrollDown();
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
      setMessages(prev => [...prev, { id: `${Date.now()}_m`, role: 'model', text: r.text }]);
    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        { id: `${Date.now()}_e`, role: 'model', text: e?.message || 'Please try again.', error: true },
      ]);
      if (uid) getAiUsedToday(uid).then(setUsed);
    } finally {
      setSending(false);
      scrollDown();
    }
  };

  const askForOccasion = (occ: string) => {
    setOccasion(occ);
    if (!aiOn) return;
    const where = place ? ` at a ${place.toLowerCase()} place` : '';
    send(`What should I wear for ${occ.toLowerCase()}${where} today? Suggest clothes, colours and a style tip.`);
  };

  const offlinePick = occasion ? suggestFromWardrobe(wardrobe, occasion) : null;

  const chips = (list: string[], value: string | null, onPick: (v: string) => void, small = false) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {list.map(o => {
        const on = value === o;
        return (
          <TouchableOpacity
            key={o}
            style={[styles.chip, small && styles.chipSmall, on && styles.chipOn]}
            onPress={() => onPick(o)}
            disabled={sending}
            activeOpacity={0.8}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})}
      />
      <View style={styles.header}>
        <View style={styles.flex1}>
          <Text style={styles.title}>AI Stylist ✦</Text>
          <Text style={styles.sub}>
            {aiOn ? `Clothes, colours & style · ${left}/${AI_DAILY_LIMIT} messages left today` : 'Your personal style guide'}
          </Text>
        </View>
      </View>

      <Text style={styles.label}>Language</Text>
      {chips(AI_LANGUAGES, language, v => setLanguage(v as AiLanguage), true)}
      <Text style={styles.label}>Occasion</Text>
      {chips(OCCASIONS, occasion, askForOccasion)}
      <Text style={styles.label}>Place</Text>
      {chips(PLACES, place, v => setPlace(place === v ? null : v), true)}

      <KeyboardAvoidingView style={styles.flex1} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={styles.flex1} contentContainerStyle={styles.chat} keyboardShouldPersistTaps="handled">
          <View style={styles.luckyCard}>
            <View style={styles.luckyRow}>
              {vaara.colours.map(c => (
                <View key={c.name} style={[styles.luckyDot, { backgroundColor: c.hex }]} />
              ))}
              <Text style={styles.luckyTitle}>Today's lucky colour: {vaara.colours.map(c => c.name).join(' / ')}</Text>
            </View>
            <Text style={styles.luckyWhy}>{vaara.why}</Text>
          </View>

          {!aiOn ? (
            <View style={styles.soon}>
              <Text style={styles.soonEmoji}>✨</Text>
              <Text style={styles.soonTitle}>AI stylist is coming soon</Text>
              <Text style={styles.soonText}>
                Soon you can chat with your AI stylist in English, Telugu or Hindi. Meanwhile, pick an occasion for a
                look from your own wardrobe.
              </Text>
              {occasion ? (
                <View style={styles.offline}>
                  <Text style={styles.offlineTitle}>{occasion} look from your wardrobe</Text>
                  <Text style={styles.offlineText}>
                    {offlinePick ||
                      'Add a few items (top, bottom, footwear) to your wardrobe and I will put outfits together from them.'}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.soon}>
              <Text style={styles.soonEmoji}>👗</Text>
              <Text style={styles.soonTitle}>Ask me what to wear</Text>
              <Text style={styles.soonText}>
                Pick an occasion above, or type e.g. "Navy shirt, which pants and shoes go with it?"
              </Text>
            </View>
          ) : (
            messages.map(m => (
              <View key={m.id} style={[styles.bubble, m.role === 'user' ? styles.bubbleMe : styles.bubbleAi, m.error && styles.bubbleErr]}>
                <Text style={[styles.bubbleText, m.role === 'user' && styles.bubbleTextMe]}>{m.text}</Text>
              </View>
            ))
          )}
          {sending ? <ActivityIndicator style={styles.typing} color={colors.primary} /> : null}
        </ScrollView>

        {aiOn ? (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder={left > 0 ? 'Ask about clothes, colours, style...' : 'Daily limit reached'}
              placeholderTextColor={colors.textMuted}
              value={input}
              onChangeText={setInput}
              editable={left > 0 && !sending}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || sending || left <= 0) && styles.disabled]}
              onPress={() => send()}
              disabled={!input.trim() || sending || left <= 0}>
              <Text style={styles.sendText}>➤</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.base, paddingTop: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  sub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    paddingHorizontal: spacing.base,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  chipRow: { paddingHorizontal: spacing.base, paddingVertical: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  chipSmall: { paddingVertical: 5, paddingHorizontal: 12 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semiBold, color: colors.textPrimary },
  chipTextOn: { color: colors.onPrimary },
  chat: { padding: spacing.base, paddingBottom: spacing.xl },
  luckyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  luckyRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  luckyDot: { width: 18, height: 18, borderRadius: 9, marginRight: 4, borderWidth: 1, borderColor: colors.border },
  luckyTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary, marginLeft: 4 },
  luckyWhy: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4, lineHeight: 17 },
  soon: { alignItems: 'center', padding: spacing.lg },
  soonEmoji: { fontSize: 40 },
  soonTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary, marginTop: spacing.sm },
  soonText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
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
  offlineText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 21 },
  bubble: { maxWidth: '85%', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  bubbleAi: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bubbleErr: { borderColor: colors.error },
  bubbleText: { fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 20 },
  bubbleTextMe: { color: colors.onPrimary },
  typing: { alignSelf: 'flex-start', marginLeft: spacing.md },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 42,
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontSize: fontSize.sm,
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
