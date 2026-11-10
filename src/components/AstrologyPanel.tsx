// Me > 🔮 Astrology (జాతకం) tab: today's offline reading (services/astrologyDaily.ts), festival of
// the day / coming soon (services/festivals.ts), and an optional one-a-day AI "More details".
// Everything shows instantly from the phone; nothing here needs the network except "More details".
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import { useDayKey } from '../hooks/useDayKey';
import { AstroLang, AstroProfile, astroLanguage, dailyReading } from '../services/astrologyDaily';
import { festivalsAround, festivalText, FestivalHit } from '../services/festivals';
import { astroAiAvailable, fetchAstroDetails, getCachedAstroDetails } from '../services/astrologyAi';
import type { WardrobeItemResponse } from '../services/wardrobeApi';

interface Props {
  uid: string;
  profile: AstroProfile;
  wardrobe?: WardrobeItemResponse[] | null;
  onEditProfile: () => void;
}

const L: Record<AstroLang, Record<string, string>> = {
  English: {
    panchang: "Today's panchang",
    jathakam: 'As per your jathakam today',
    mood: 'How to be today',
    do: 'Good to do',
    avoid: 'Better to avoid',
    lucky: 'Lucky time',
    calm: 'Pause time',
    dress: 'What to wear today',
    fromWardrobe: 'From your wardrobe',
    festivalToday: 'Festival today',
    upcoming: 'Coming up',
    inDays: 'in {n} days',
    tomorrow: 'tomorrow',
    next: 'Next festival: {name} · {date} ({n} days)',
    celebrate: 'How to celebrate',
    wear: 'What to wear',
    needDob: 'Add your date of birth (and time of birth, if you know it) so I can read your moon sign and star. Today\'s panchang and lucky colours are below.',
    edit: 'Edit profile',
    more: '✨ More details',
    moreLoading: 'Reading the stars…',
    moreFail: 'More details are not available right now. Your reading above is complete for today.',
    disclaimer: 'Traditional guidance for a positive day (Lahiri, Hyderabad sunrise). Your choices shape your day!',
  },
  Telugu: {
    panchang: 'నేటి పంచాంగం',
    jathakam: 'మీ జాతకం ప్రకారం ఈ రోజు',
    mood: 'ఈ రోజు ఎలా ఉండాలి',
    do: 'చేయదగినవి',
    avoid: 'దూరంగా ఉంచదగినవి',
    lucky: 'శుభ సమయం',
    calm: 'విరామ సమయం',
    dress: 'ఈ రోజు ఏ దుస్తులు',
    fromWardrobe: 'మీ వార్డ్‌రోబ్ నుండి',
    festivalToday: 'ఈ రోజు పండుగ',
    upcoming: 'త్వరలో',
    inDays: '{n} రోజుల్లో',
    tomorrow: 'రేపు',
    next: 'తదుపరి పండుగ: {name} · {date} ({n} రోజులు)',
    celebrate: 'ఎలా జరుపుకోవాలి',
    wear: 'ఏ దుస్తులు ధరించాలి',
    needDob: 'మీ రాశి, నక్షత్రం తెలుసుకోవడానికి పుట్టిన తేదీ (తెలిస్తే పుట్టిన సమయం కూడా) చేర్చండి. నేటి పంచాంగం, అదృష్ట రంగులు కింద ఉన్నాయి.',
    edit: 'Edit profile',
    more: '✨ మరిన్ని వివరాలు',
    moreLoading: 'గ్రహాలను చదువుతున్నాం…',
    moreFail: 'మరిన్ని వివరాలు ఇప్పుడు అందుబాటులో లేవు. పైన ఉన్న ఫలితం ఈ రోజుకి పూర్తి.',
    disclaimer: 'సానుకూలమైన రోజు కోసం సంప్రదాయ సూచనలు (లాహిరి, హైదరాబాద్ సూర్యోదయం). మీ నిర్ణయాలే మీ రోజును తీర్చిదిద్దుతాయి!',
  },
};
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (k: string) => {
  const [, m, d] = k.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

export default function AstrologyPanel({ uid, profile, wardrobe, onEditProfile }: Props) {
  const dayKey = useDayKey();
  const [lang, setLang] = useState<AstroLang>(astroLanguage(profile.language));
  useEffect(() => setLang(astroLanguage(profile.language)), [profile.language]);
  const t = L[lang];

  // Pure and instant: recomputed only when the day, language or profile changes
  const reading = useMemo(
    () => dailyReading(profile, { uid, lang, wardrobe }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, lang, dayKey, profile.dob, profile.timeOfBirth, profile.rashi, profile.gender, profile.name, wardrobe],
  );
  const fest = useMemo(() => festivalsAround(new Date(), 7), [dayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [more, setMore] = useState<string | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreErr, setMoreErr] = useState(false);
  useEffect(() => {
    let alive = true;
    setMore(null);
    setMoreErr(false);
    if (uid) getCachedAstroDetails(uid, reading.dayKey, lang).then(v => alive && setMore(v));
    return () => {
      alive = false;
    };
  }, [uid, reading.dayKey, lang]);
  const loadMore = async () => {
    if (!uid || moreBusy) return;
    setMoreBusy(true);
    setMoreErr(false);
    try {
      setMore(await fetchAstroDetails(uid, profile, reading));
    } catch {
      setMoreErr(true);
    } finally {
      setMoreBusy(false);
    }
  };

  const swatches = (cs: { name: string; hex: string }[]) => (
    <View style={styles.swatches}>
      {cs.map(c => (
        <View key={c.name + c.hex} style={styles.swatch}>
          <View style={[styles.dot, { backgroundColor: c.hex }]} />
          <Text style={styles.swatchText}>{c.name}</Text>
        </View>
      ))}
    </View>
  );

  const festivalCard = (h: FestivalHit) => {
    const f = festivalText(h.festival, lang);
    return (
      <View key={h.festival.id + h.date} style={[styles.card, styles.festCard]}>
        <Text style={styles.festTag}>
          {h.inDays === 0 ? t.festivalToday : `${t.upcoming} · ${h.inDays === 1 ? t.tomorrow : fill(t.inDays, { n: h.inDays })}`}
        </Text>
        <Text style={styles.festName}>
          {h.festival.emoji} {f.name} · {shortDate(h.date)}
        </Text>
        <Text style={styles.body}>{f.about}</Text>
        <Text style={styles.sub}>{t.celebrate}</Text>
        <Text style={styles.body}>{f.celebrate}</Text>
        <Text style={styles.sub}>{t.wear}</Text>
        <Text style={styles.body}>{f.wear}</Text>
        {swatches(h.festival.colours)}
      </View>
    );
  };

  const shownFest = [...fest.today, ...fest.upcoming].slice(0, 2);

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Text style={styles.greeting} numberOfLines={1}>
          {reading.greeting}
        </Text>
        <View style={styles.langRow}>
          {(['English', 'Telugu'] as AstroLang[]).map(l => (
            <TouchableOpacity key={l} style={[styles.langBtn, lang === l && styles.langOn]} onPress={() => setLang(l)}>
              <Text style={[styles.langText, lang === l && styles.langTextOn]}>{l === 'English' ? 'EN' : 'తె'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {shownFest.map(festivalCard)}

      {reading.needsDob ? (
        <View style={[styles.card, styles.askCard]}>
          <Text style={styles.body}>{t.needDob}</Text>
          <TouchableOpacity style={styles.askBtn} onPress={onEditProfile}>
            <Text style={styles.askBtnText}>{t.edit}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.title}>🗓️ {t.panchang}</Text>
        {reading.panchang.map(p => (
          <View key={p.label} style={styles.row}>
            <Text style={styles.rowLabel}>{p.label}</Text>
            <Text style={styles.rowValue}>{p.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>🔮 {t.jathakam}</Text>
        {reading.rashiLine ? <Text style={styles.rashi}>{reading.rashiLine}</Text> : null}
        <Text style={styles.stars}>{'★'.repeat(reading.stars)}{'☆'.repeat(5 - reading.stars)}</Text>
        <Text style={styles.body}>{reading.overview}</Text>
        <Text style={styles.sub}>😊 {t.mood}</Text>
        <Text style={styles.body}>{reading.mood}</Text>
        <Text style={styles.sub}>✅ {t.do}</Text>
        {reading.doList.map(d => (
          <Text key={d} style={styles.bullet}>• {d}</Text>
        ))}
        <Text style={styles.sub}>🙅 {t.avoid}</Text>
        {reading.avoidList.map(d => (
          <Text key={d} style={styles.bullet}>• {d}</Text>
        ))}
        <Text style={styles.sub}>⏰ {t.lucky}</Text>
        <Text style={styles.body}>{reading.luckyTime}</Text>
        <Text style={styles.sub}>🧘 {t.calm}</Text>
        <Text style={styles.body}>{reading.calmTime}</Text>
        {reading.note ? (
          <TouchableOpacity onPress={onEditProfile}>
            <Text style={styles.note}>{reading.note}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>👗 {t.dress}</Text>
        <Text style={styles.dressTitle}>{reading.dress.title}</Text>
        {swatches(reading.dress.colours)}
        <Text style={styles.body}>{reading.dress.why}</Text>
        <Text style={[styles.body, styles.idea]}>{reading.dress.idea}</Text>
        {reading.dress.pair ? (
          <View style={styles.pair}>
            <Text style={styles.sub}>{t.fromWardrobe}</Text>
            <View style={styles.pairRow}>
              {[reading.dress.pair.top, reading.dress.pair.bottom].map(i => (
                <View key={i.id} style={styles.pairItem}>
                  {i.imageUrl ? <Image source={{ uri: i.imageUrl }} style={styles.pairImg} /> : <View style={[styles.pairImg, styles.pairEmpty]} />}
                  <Text style={styles.pairName} numberOfLines={1}>
                    {i.name}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.body}>{reading.dress.pair.why}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.card, styles.crushCard]}>
        <Text style={styles.title}>{reading.crush.title}</Text>
        <Text style={styles.body}>{reading.crush.text}</Text>
      </View>

      {!fest.today.length && !fest.upcoming.length && fest.next ? (
        <Text style={styles.nextFest}>
          {fest.next.festival.emoji}{' '}
          {fill(t.next, { name: festivalText(fest.next.festival, lang).name, date: shortDate(fest.next.date), n: fest.next.inDays })}
        </Text>
      ) : null}

      {more ? (
        <View style={styles.card}>
          <Text style={styles.title}>✨ {lang === 'Telugu' ? 'మరిన్ని వివరాలు' : 'More details'}</Text>
          <Text style={styles.body}>{more}</Text>
        </View>
      ) : astroAiAvailable() && uid ? (
        <TouchableOpacity style={styles.moreBtn} onPress={loadMore} disabled={moreBusy}>
          {moreBusy ? (
            <View style={styles.moreRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.moreText}> {t.moreLoading}</Text>
            </View>
          ) : (
            <Text style={styles.moreText}>{t.more}</Text>
          )}
        </TouchableOpacity>
      ) : null}
      {moreErr ? <Text style={styles.note}>{t.moreFail}</Text> : null}

      <Text style={styles.disclaimer}>{t.disclaimer}</Text>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  greeting: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  langRow: { flexDirection: 'row', backgroundColor: colors.divider, borderRadius: borderRadius.full, padding: 2 },
  langBtn: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: borderRadius.full },
  langOn: { backgroundColor: colors.surface },
  langText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.semiBold },
  langTextOn: { color: colors.primary, fontWeight: fontWeight.bold },
  card: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  festCard: { borderColor: colors.accent, borderWidth: 1.5 },
  askCard: { borderColor: colors.primary },
  crushCard: { borderColor: '#F48FB1' },
  festTag: { fontSize: fontSize.xs, color: colors.accent, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  festName: { fontSize: fontSize.base, fontWeight: fontWeight.extraBold, color: colors.textPrimary, marginTop: 2, marginBottom: 4 },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.extraBold, color: colors.textPrimary, marginBottom: spacing.sm },
  rashi: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.bold, marginBottom: 2 },
  stars: { fontSize: 18, color: '#F9A825', marginBottom: 4 },
  sub: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary, marginTop: spacing.sm },
  body: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20, marginTop: 2 },
  bullet: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20, marginLeft: 4 },
  note: { fontSize: fontSize.xs, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm, lineHeight: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rowLabel: { fontSize: fontSize.sm, color: colors.textMuted, marginRight: spacing.sm },
  rowValue: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: fontWeight.semiBold, flexShrink: 1, textAlign: 'right' },
  dressTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.accent },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 6 },
  swatch: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.md, marginBottom: 4 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.border, marginRight: 4 },
  swatchText: { fontSize: fontSize.xs, color: colors.textSecondary },
  idea: { marginTop: spacing.sm, color: colors.textPrimary },
  pair: { marginTop: 4 },
  pairRow: { flexDirection: 'row', marginTop: 6 },
  pairItem: { width: 96, marginRight: spacing.sm },
  pairImg: { width: 96, height: 96, borderRadius: borderRadius.md },
  pairEmpty: { backgroundColor: colors.divider },
  pairName: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  askBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: 6,
  },
  askBtnText: { color: colors.textInverse, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  nextFest: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md, textAlign: 'center' },
  moreBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  moreRow: { flexDirection: 'row', alignItems: 'center' },
  moreText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  disclaimer: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 16 },
}));
