// Me > 🔮 Astrology (జాతకం) tab: today's offline reading (services/astrologyDaily.ts), festival of
// the day / coming soon (services/festivals.ts), and an optional one-a-day AI "More details".
// Everything shows instantly from the phone; nothing here needs the network except "More details".
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Switch } from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import { useDayKey } from '../hooks/useDayKey';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AstroLang, AstroProfile, astroLanguage, dailyReading } from '../services/astrologyDaily';
import { LABELS } from '../i18n/astroLabels';
import { colourName, LANG_META } from '../i18n/astroNames';
import { proseFor } from '../i18n/astroProse';
import { festivalsAround, festivalText, FestivalHit } from '../services/festivals';
import { astroAiAvailable, fetchAstroDetails, getCachedAstroDetails } from '../services/astrologyAi';
import type { WardrobeItemResponse } from '../services/wardrobeApi';

interface Props {
  uid: string;
  profile: AstroProfile;
  wardrobe?: WardrobeItemResponse[] | null;
  onEditProfile: () => void;
}

const SHOW_EN_KEY = 'outfit.astro.showEnglish';
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (k: string) => {
  const [, m, d] = k.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

export default function AstrologyPanel({ uid, profile, wardrobe, onEditProfile }: Props) {
  const dayKey = useDayKey();
  const appLang = astroLanguage(profile.language);
  const [lang, setLang] = useState<AstroLang>(appLang);
  useEffect(() => setLang(appLang), [appLang]);
  const t = { ...LABELS[lang], ...proseFor(lang).t } as Record<string, string>;
  const rtl = LANG_META[lang].rtl;
  // "Show English too": English text under the chosen language (default on for non-English)
  const [showEn, setShowEn] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(SHOW_EN_KEY)
      .then(v => setShowEn(v !== '0'))
      .catch(() => undefined);
  }, []);
  const toggleEn = (v: boolean) => {
    setShowEn(v);
    AsyncStorage.setItem(SHOW_EN_KEY, v ? '1' : '0').catch(() => undefined);
  };
  const bi = lang !== 'English' && showEn;

  // Pure and instant: recomputed only when the day, language or profile changes
  const reading = useMemo(
    () => dailyReading(profile, { uid, lang, wardrobe }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, lang, dayKey, profile.dob, profile.timeOfBirth, profile.placeOfBirth, profile.rashi, profile.gender, profile.name, wardrobe],
  );
  const en = useMemo(
    () => (bi ? dailyReading(profile, { uid, lang: 'English', wardrobe }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bi, uid, dayKey, profile.dob, profile.timeOfBirth, profile.placeOfBirth, profile.rashi, profile.gender, profile.name, wardrobe],
  );
  // Text in the chosen language, with the English line under it when "Show English too" is on
  const Bi = ({ text, enText, style }: { text: string; enText?: string | null; style?: any }) => (
    <View>
      <Text style={[style, rtl && styles.rtl]}>{text}</Text>
      {bi && enText && enText !== text ? <Text style={styles.enLine}>{enText}</Text> : null}
    </View>
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

  const swatches = (cs: { name: string; hex: string; en?: string }[]) => (
    <View style={styles.swatches}>
      {cs.map(c => (
        <View key={c.name + c.hex} style={styles.swatch}>
          <View style={[styles.dot, { backgroundColor: c.hex }]} />
          <Text style={styles.swatchText}>
            {c.name}
            {bi && c.en && c.en !== c.name ? ` (${c.en})` : ''}
          </Text>
        </View>
      ))}
    </View>
  );

  const festivalCard = (h: FestivalHit) => {
    const f = festivalText(h.festival, lang);
    const fe = festivalText(h.festival, 'English');
    return (
      <View key={h.festival.id + h.date} style={[styles.card, styles.festCard]}>
        <Text style={styles.festTag}>
          {h.inDays === 0 ? t.festivalToday : `${t.upcoming} · ${h.inDays === 1 ? t.tomorrow : fill(t.inDays, { n: h.inDays })}`}
        </Text>
        <Bi style={styles.festName} text={`${h.festival.emoji} ${f.name} · ${shortDate(h.date)}`} enText={`${fe.name} · ${shortDate(h.date)}`} />
        <Bi style={styles.body} text={f.about} enText={fe.about} />
        <Text style={styles.sub}>{t.celebrate}</Text>
        <Bi style={styles.body} text={f.celebrate} enText={fe.celebrate} />
        <Text style={styles.sub}>{t.wear}</Text>
        <Bi style={styles.body} text={f.wear} enText={fe.wear} />
        {swatches(h.festival.colours.map(c => ({ name: colourName(c.name, lang), en: c.name, hex: c.hex })))}
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
          {(appLang === 'English' ? (['English'] as AstroLang[]) : (['English', appLang] as AstroLang[])).map(l => (
            <TouchableOpacity key={l} style={[styles.langBtn, lang === l && styles.langOn]} onPress={() => setLang(l)}>
              <Text style={[styles.langText, lang === l && styles.langTextOn]}>{LANG_META[l].short}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {lang !== 'English' ? (
        <View style={styles.enRow}>
          <Text style={styles.enLabel}>{t.showEnglish}{t.showEnglish !== LABELS.English.showEnglish ? ` · ${LABELS.English.showEnglish}` : ''}</Text>
          <Switch value={showEn} onValueChange={toggleEn} />
        </View>
      ) : null}

      {shownFest.map(festivalCard)}

      {reading.needsDob ? (
        <View style={[styles.card, styles.askCard]}>
          <Bi style={styles.body} text={t.needDob} enText={proseFor('English').t.needDob} />
          <TouchableOpacity style={styles.askBtn} onPress={onEditProfile}>
            <Text style={styles.askBtnText}>{t.edit}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.title}>🗓️ {t.panchang}</Text>
        {reading.panchang.map((p, i) => (
          <View key={p.label} style={styles.row}>
            <Text style={styles.rowLabel}>{p.label}</Text>
            <Text style={styles.rowValue}>
              {p.value}
              {bi && en && en.panchang[i] && en.panchang[i].value !== p.value ? `\n${en.panchang[i].value}` : ''}
            </Text>
          </View>
        ))}
      </View>

      {reading.chartRows.length ? (
        <View style={styles.card}>
          <Text style={styles.title}>🪐 {t.chart}</Text>
          {reading.chartRows.map((r, i) => (
            <View key={r.label} style={styles.row}>
              <Text style={styles.rowLabel}>
                {r.label}
                {bi && en?.chartRows[i] ? `\n${en.chartRows[i].label}` : ''}
              </Text>
              <Text style={styles.rowValue}>
                {r.value}
                {bi && en?.chartRows[i] && en.chartRows[i].value !== r.value ? `\n${en.chartRows[i].value}` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.title}>🔮 {t.jathakam}</Text>
        {reading.rashiLine ? <Bi style={styles.rashi} text={reading.rashiLine} enText={en?.rashiLine} /> : null}
        <Text style={styles.stars}>{'★'.repeat(reading.stars)}{'☆'.repeat(5 - reading.stars)}</Text>
        <Bi style={styles.body} text={reading.overview} enText={en?.overview} />
        <Text style={styles.sub}>😊 {t.mood}</Text>
        <Bi style={styles.body} text={reading.mood} enText={en?.mood} />
        <Text style={styles.sub}>✅ {t.do}</Text>
        {reading.doList.map((d, i) => (
          <Bi key={d} style={styles.bullet} text={`• ${d}`} enText={en ? `  ${en.doList[i] || ''}` : null} />
        ))}
        <Text style={styles.sub}>🙅 {t.avoid}</Text>
        {reading.avoidList.map((d, i) => (
          <Bi key={d} style={styles.bullet} text={`• ${d}`} enText={en ? `  ${en.avoidList[i] || ''}` : null} />
        ))}
        <Text style={styles.sub}>⏰ {t.lucky}</Text>
        <Bi style={styles.body} text={reading.luckyTime} enText={en?.luckyTime} />
        <Text style={styles.sub}>🧘 {t.calm}</Text>
        <Bi style={styles.body} text={reading.calmTime} enText={en?.calmTime} />
        {reading.note ? (
          <TouchableOpacity onPress={onEditProfile}>
            <Bi style={styles.note} text={reading.note} enText={en?.note} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>👗 {t.dress}</Text>
        <Bi style={styles.dressTitle} text={reading.dress.title} enText={en?.dress.title} />
        {swatches(reading.dress.colours.map((c, i) => ({ ...c, en: en?.dress.colours[i]?.name })))}
        <Bi style={styles.body} text={reading.dress.why} enText={en?.dress.why} />
        <Bi style={[styles.body, styles.idea]} text={reading.dress.idea} enText={en?.dress.idea} />
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
        <Bi style={styles.title} text={reading.crush.title} enText={en?.crush.title} />
        <Bi style={styles.body} text={reading.crush.text} enText={en?.crush.text} />
      </View>

      {!fest.today.length && !fest.upcoming.length && fest.next ? (
        <Text style={styles.nextFest}>
          {fest.next.festival.emoji}{' '}
          {fill(t.next, { name: festivalText(fest.next.festival, lang).name, date: shortDate(fest.next.date), n: fest.next.inDays })}
        </Text>
      ) : null}

      {more ? (
        <View style={styles.card}>
          <Text style={styles.title}>{t.more}</Text>
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

      <Bi style={styles.disclaimer} text={t.disclaimer} enText={proseFor('English').t.disclaimer} />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  greeting: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  enLine: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  enRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  enLabel: { fontSize: fontSize.sm, color: colors.textSecondary, flexShrink: 1 },
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
