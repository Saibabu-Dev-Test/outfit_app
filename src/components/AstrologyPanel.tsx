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
import { festivalDressFor, PLAN_LABELS, planText } from '../services/festivalPlans';
import { astroAiAvailable, fetchAstroDetails, getCachedAstroDetails } from '../services/astrologyAi';
import { loadAstroUnlock, saveAstroUnlock, shortText } from '../services/astroUnlock';
import { watchAdToUnlock } from '../native/ads';
import type { WardrobeItemResponse } from '../services/wardrobeApi';

interface Props {
  uid: string;
  profile: AstroProfile;
  wardrobe?: WardrobeItemResponse[] | null;
  onEditProfile: () => void;
  onOpenPorutham?: () => void; // 💑 Pelli Porutham screen
}

const SHOW_EN_KEY = 'outfit.astro.showEnglish';

// Free summary / rewarded-ad lock texts (English + Telugu; other languages show English)
const LOCK_TEXT: Record<string, { summary: string; title: string; body: string; btn: string; busy: string; closed: string; open: string }> = {
  English: {
    summary: "Today in short",
    title: '🔒 Full reading',
    body: "Panchang, birth chart, good / avoid, timings, remedies and what to wear. Watch a short ad to open it for today.",
    btn: '▶ Watch ad · see full reading',
    busy: 'Loading ad…',
    closed: 'The ad was closed early, so the full reading stays locked. Try again any time.',
    open: '🔓 Full reading open for today',
  },
  Telugu: {
    summary: 'ఈ రోజు సంక్షిప్తంగా',
    title: '🔒 పూర్తి జాతకం',
    body: 'పంచాంగం, జన్మ చార్ట్, చేయదగినవి / వద్దు, సమయాలు, పరిహారాలు, దుస్తులు. ఈ రోజుకు తెరవడానికి చిన్న యాడ్ చూడండి.',
    btn: '▶ యాడ్ చూసి పూర్తి జాతకం చూడండి',
    busy: 'యాడ్ లోడ్ అవుతోంది…',
    closed: 'యాడ్ మధ్యలో మూసేశారు, అందుకే పూర్తి జాతకం తెరవలేదు. మళ్లీ ప్రయత్నించండి.',
    open: '🔓 ఈ రోజుకు పూర్తి జాతకం తెరిచి ఉంది',
  },
};
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (k: string) => {
  const [, m, d] = k.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

export default function AstrologyPanel({ uid, profile, wardrobe, onEditProfile, onOpenPorutham }: Props) {
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

  // Full reading: open for the rest of the local day after a rewarded ad (services/astroUnlock.ts).
  // dayKey changes at local midnight, which re-reads the saved day and locks it again.
  const [unlocked, setUnlocked] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockMsg, setUnlockMsg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUnlocked(false);
    setUnlockMsg(null);
    loadAstroUnlock(uid, dayKey).then(v => alive && setUnlocked(v));
    return () => {
      alive = false;
    };
  }, [uid, dayKey]);
  const lt = LOCK_TEXT[lang] || LOCK_TEXT.English;
  const unlockFull = async () => {
    if (unlockBusy) return;
    setUnlockBusy(true);
    setUnlockMsg(null);
    try {
      const day = dayKey;
      if (await watchAdToUnlock('astroRewarded')) {
        await saveAstroUnlock(uid, day);
        setUnlocked(true);
      } else {
        setUnlockMsg(lt.closed);
      }
    } finally {
      setUnlockBusy(false);
    }
  };

  // Pure and instant: recomputed only when the day, language or profile changes
  const reading = useMemo(
    () => dailyReading(profile, { uid, lang, wardrobe }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, lang, dayKey, profile.dob, profile.timeOfBirth, profile.placeOfBirth, profile.rashi, profile.gender, profile.name, profile.maritalStatus, wardrobe],
  );
  const en = useMemo(
    () => (bi ? dailyReading(profile, { uid, lang: 'English', wardrobe }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bi, uid, dayKey, profile.dob, profile.timeOfBirth, profile.placeOfBirth, profile.rashi, profile.gender, profile.name, profile.maritalStatus, wardrobe],
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
        {planBlock(h)}
      </View>
    );
  };

  // Festival planning (from 7 days before): get ready, fasting, food, and my colour by rashi
  const planBlock = (h: FestivalHit) => {
    const pl = PLAN_LABELS[lang];
    const ple = PLAN_LABELS.English;
    const p = planText(h.festival.id, lang);
    const pe = planText(h.festival.id, 'English');
    const dress = festivalDressFor(h.festival, reading.chart?.rashi ?? null);
    const head = (k: 'prep' | 'fast' | 'food' | 'yourColour') => (bi && pl[k] !== ple[k] ? `${pl[k]} · ${ple[k]}` : pl[k]);
    return (
      <View style={styles.planBox}>
        <Text style={styles.planTitle}>📝 {bi && pl.plan !== ple.plan ? `${pl.plan} · ${ple.plan}` : pl.plan}</Text>
        <Text style={styles.sub}>🧹 {head('prep')}</Text>
        <Bi style={styles.body} text={p.prep} enText={pe.prep} />
        <Text style={styles.sub}>🙏 {head('fast')}</Text>
        <Bi style={styles.body} text={p.fast} enText={pe.fast} />
        <Text style={styles.sub}>🍲 {head('food')}</Text>
        <Bi style={styles.body} text={p.food} enText={pe.food} />
        {dress ? (
          <>
            <Text style={styles.sub}>👗 {head('yourColour')}</Text>
            {swatches(
              [dress.main, ...(dress.accent ? [dress.accent] : [])].map(c => ({ name: colourName(c.name, lang), en: c.name, hex: c.hex })),
            )}
          </>
        ) : null}
      </View>
    );
  };

  const shownFest = [...fest.today, ...fest.upcoming].slice(0, 3);

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


      {reading.needsDob ? (
        <View style={[styles.card, styles.askCard]}>
          <Bi style={styles.body} text={t.needDob} enText={proseFor('English').t.needDob} />
          <TouchableOpacity style={styles.askBtn} onPress={onEditProfile}>
            <Text style={styles.askBtnText}>{t.edit}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {unlocked ? (
        <>
          <Text style={styles.unlockedTag}>{lt.open}</Text>
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

        {reading.verdict ? (
          <View style={[styles.card, reading.verdict.rating === 'good' ? styles.vGoodCard : reading.verdict.rating === 'caution' ? styles.vBadCard : styles.vMixedCard]}>
            <Bi style={styles.title} text={`⚖️ ${reading.verdict.headings.title}`} enText={en?.verdict ? `⚖️ ${en.verdict.headings.title}` : null} />
            <View style={[styles.badge, reading.verdict.rating === 'good' ? styles.badgeGood : reading.verdict.rating === 'caution' ? styles.badgeBad : styles.badgeMixed]}>
              <Text style={styles.badgeText}>
                {reading.verdict.ratingLabel}
                {bi && en?.verdict && en.verdict.ratingLabel !== reading.verdict.ratingLabel ? ` · ${en.verdict.ratingLabel}` : ''}
              </Text>
            </View>
            <Bi style={styles.body} text={reading.verdict.summary} enText={en?.verdict?.summary} />
            <View style={[styles.vBox, styles.vGoodBox]}>
              <Text style={[styles.sub, styles.vGoodText]}>✅ {reading.verdict.headings.positive}</Text>
              {reading.verdict.positives.map((x, i) => (
                <Bi key={x.text} style={[styles.bullet, styles.vGoodText]} text={`• ${x.areaLabel}: ${x.text}`} enText={en?.verdict?.positives[i] ? `  ${en.verdict.positives[i].text}` : null} />
              ))}
            </View>
            <View style={[styles.vBox, styles.vBadBox]}>
              <Text style={[styles.sub, styles.vBadText]}>⚠️ {reading.verdict.headings.careful}</Text>
              {reading.verdict.cautions.map((x, i) => (
                <Bi key={x.text} style={[styles.bullet, styles.vBadText]} text={`• ${x.areaLabel}: ${x.text}`} enText={en?.verdict?.cautions[i] ? `  ${en.verdict.cautions[i].text}` : null} />
              ))}
            </View>
            <Text style={styles.sub}>⏳ {reading.verdict.headings.badTimes}</Text>
            <Bi style={styles.note} text={reading.verdict.headings.timingLine} enText={en?.verdict?.headings.timingLine} />
            {reading.verdict.badTimes.map(r => (
              <View key={r.label} style={styles.row}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                <Text style={styles.rowValue}>{r.value}</Text>
              </View>
            ))}
            <Text style={styles.sub}>🙏 {reading.verdict.headings.remedies}</Text>
            {reading.verdict.remedies.map((r, i) => (
              <View key={r.label} style={styles.row}>
                <Text style={styles.rowLabel}>
                  {r.label}
                  {bi && en?.verdict?.remedies[i] && en.verdict.remedies[i].label !== r.label ? `\n${en.verdict.remedies[i].label}` : ''}
                </Text>
                <Text style={styles.rowValue}>
                  {r.value}
                  {bi && en?.verdict?.remedies[i] && en.verdict.remedies[i].value !== r.value ? `\n${en.verdict.remedies[i].value}` : ''}
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
          {reading.luckyNumber !== null ? (
            <>
              <Text style={styles.sub}>🔢 {t.luckyNumber}</Text>
              <Text style={styles.luckyNumber}>
                {reading.luckyNumber}
                {reading.luckyNumber2 !== null ? ` · ${reading.luckyNumber2}` : ''}
              </Text>
            </>
          ) : null}
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

        <View style={[styles.card, styles.relCard]}>
          <Bi style={styles.title} text={reading.relation.title} enText={en?.relation.title} />
          <Bi style={styles.body} text={reading.relation.text} enText={en?.relation.text} />
          {reading.relation.outing ? <Bi style={[styles.body, styles.idea]} text={`🚗 ${reading.relation.outing}`} enText={en?.relation.outing ? `🚗 ${en.relation.outing}` : null} /> : null}
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
        </>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.title}>🌟 {lt.summary}</Text>
            {reading.rashiLine ? <Bi style={styles.rashi} text={reading.rashiLine} enText={en?.rashiLine} /> : null}
            <Text style={styles.stars}>{'★'.repeat(reading.stars)}{'☆'.repeat(5 - reading.stars)}</Text>
            <Bi
              style={styles.body}
              text={shortText(reading.verdict?.summary || reading.overview)}
              enText={en ? shortText(en.verdict?.summary || en.overview) : null}
            />
            {swatches(reading.dress.colours.slice(0, 2).map((c, i) => ({ ...c, en: en?.dress.colours[i]?.name })))}
          </View>
          <View style={[styles.card, styles.lockCard]}>
            <Text style={styles.title}>{lt.title}</Text>
            <Text style={styles.body}>{lt.body}</Text>
            <TouchableOpacity
              style={[styles.askBtn, styles.unlockBtn]}
              onPress={unlockFull}
              disabled={unlockBusy}
              accessibilityLabel="Watch an ad to see the full reading for today">
              {unlockBusy ? (
                <View style={styles.moreRow}>
                  <ActivityIndicator size="small" color={colors.textInverse} />
                  <Text style={styles.askBtnText}> {lt.busy}</Text>
                </View>
              ) : (
                <Text style={styles.askBtnText}>{lt.btn}</Text>
              )}
            </TouchableOpacity>
            {unlockMsg ? <Text style={styles.note}>{unlockMsg}</Text> : null}
          </View>
        </>
      )}

      {/* Festivals come after today's astrology reading */}
      {shownFest.map(festivalCard)}

      {onOpenPorutham ? (
        <TouchableOpacity style={styles.moreBtn} onPress={onOpenPorutham} accessibilityLabel="Pelli Porutham">
          <Text style={styles.moreText}>💑 Pelli Porutham · పెళ్లి పొరుత్తం</Text>
        </TouchableOpacity>
      ) : null}

      <Bi style={styles.disclaimer} text={t.disclaimer} enText={proseFor('English').t.disclaimer} />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  lockCard: { borderWidth: 1, borderColor: colors.primary },
  unlockBtn: { alignSelf: 'stretch', alignItems: 'center' },
  unlockedTag: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.sm, textAlign: 'center' },
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
  planBox: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  planTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  festCard: { borderColor: colors.accent, borderWidth: 1.5 },
  askCard: { borderColor: colors.primary },
  relCard: { borderColor: '#F48FB1' },
  vGoodCard: { borderColor: '#2E7D32', borderWidth: 1.5 },
  vMixedCard: { borderColor: '#F9A825', borderWidth: 1.5 },
  vBadCard: { borderColor: '#C62828', borderWidth: 1.5 },
  badge: { alignSelf: 'flex-start', borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: 3, marginBottom: 4 },
  badgeGood: { backgroundColor: '#2E7D32' },
  badgeMixed: { backgroundColor: '#F9A825' },
  badgeBad: { backgroundColor: '#C62828' },
  badgeText: { color: '#FFFFFF', fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  vBox: { borderRadius: borderRadius.md, padding: spacing.sm, marginTop: spacing.sm, borderWidth: 1 },
  vGoodBox: { backgroundColor: 'rgba(46,125,50,0.08)', borderColor: 'rgba(46,125,50,0.35)' },
  vBadBox: { backgroundColor: 'rgba(198,40,40,0.08)', borderColor: 'rgba(198,40,40,0.35)' },
  vGoodText: { color: '#2E7D32' },
  vBadText: { color: '#C62828' },
  festTag: { fontSize: fontSize.xs, color: colors.accent, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  festName: { fontSize: fontSize.base, fontWeight: fontWeight.extraBold, color: colors.textPrimary, marginTop: 2, marginBottom: 4 },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.extraBold, color: colors.textPrimary, marginBottom: spacing.sm },
  rashi: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.bold, marginBottom: 2 },
  stars: { fontSize: 18, color: '#F9A825', marginBottom: 4 },
  sub: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary, marginTop: spacing.sm },
  body: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20, marginTop: 2 },
  luckyNumber: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary, marginTop: 2 },
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
