// One easy-to-read item for the civic lists (Govt promises / compare / schemes / offices, Hospitals):
// a short bold HEADLINE (colors.civicHeadline), under it a 1-2 line SUMMARY (colors.civicSummary,
// numberOfLines 2), and "Tap for details" that opens the full details (sources, dates, status, ...).
// Headline = the item's existing short title / text, cut to HEADLINE_MAX chars with "…" while
// collapsed (full text when open). Summary = the item's existing fact / description; none = nothing
// extra is shown (no placeholder). Text goes through <Bi>, so the app language + English toggle of
// the surrounding <CivicCard> keeps working. Status badges and action buttons stay visible.
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fontSize, fontWeight, themedStyles } from '../theme';
import { AppLanguage } from '../i18n/appLanguage';
import { civicText } from '../i18n/civicLabels';
import { Bi } from '../screens/Civic/bi';

export const HEADLINE_MAX = 60;

// "A long promise text that goes on …" (word boundary when one is near the cut)
export const shortHeadline = (s?: string | null, max = HEADLINE_MAX): string => {
  const v = (s || '').replace(/\s+/g, ' ').trim();
  if (v.length <= max) return v;
  const cut = v.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp >= max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:·–-]+$/, '')}…`;
};

// read through themedStyles, so a light / dark switch picks up the live palette
export const headlineStyles = themedStyles(() =>
  StyleSheet.create({
    headline: { fontSize: fontSize.md, fontWeight: fontWeight.extraBold, color: colors.civicHeadline, lineHeight: 22 },
    summary: { fontSize: fontSize.sm, color: colors.civicSummary, lineHeight: 19, marginTop: 2 },
    more: { fontSize: fontSize.xs, color: colors.primary, fontWeight: fontWeight.bold, marginTop: 4 },
    divided: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
    details: { marginTop: 4 },
  }),
);

export default function HeadlineCard({
  lang,
  headline,
  headlineTr,
  summary,
  summaryTr,
  summaryPrefix = '',
  badge,
  extra,
  footer,
  children,
  divided = false,
  testID,
}: {
  lang: AppLanguage;
  headline: string;
  headlineTr?: string | null;
  summary?: string | null;
  summaryTr?: string | null;
  summaryPrefix?: string;
  badge?: React.ReactNode; // always shown above the headline (status badge)
  extra?: React.ReactNode; // always shown under the summary (labels, matches)
  footer?: React.ReactNode; // always shown under the details (call / map buttons)
  children?: React.ReactNode; // the full details, shown on tap
  divided?: boolean; // top border, for rows inside one card
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const s = headlineStyles;
  const short = shortHeadline(headline);
  const shortTr = headlineTr ? shortHeadline(headlineTr) : headlineTr;
  const cut = short !== (headline || '').replace(/\s+/g, ' ').trim() || (!!headlineTr && shortTr !== headlineTr.replace(/\s+/g, ' ').trim());
  const hasDetails = React.Children.toArray(children).length > 0;
  const canExpand = hasDetails || cut || !!(summary || summaryTr);
  return (
    <View testID={testID} style={divided ? s.divided : undefined}>
      {badge}
      <TouchableOpacity
        testID="headline-toggle"
        onPress={() => setOpen(v => !v)}
        disabled={!canExpand}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View testID="headline-title">
          <Bi en={open ? headline : short} tr={open ? headlineTr : shortTr} style={s.headline} />
        </View>
        {summary || summaryTr ? (
          <View testID="headline-summary">
            <Bi prefix={summaryPrefix} en={summary || ''} tr={summaryTr} style={s.summary} lines={open ? undefined : 2} />
          </View>
        ) : null}
        {extra}
        {canExpand ? (
          <Text style={s.more}>
            {open ? '▴' : '▾'} {civicText(lang, open ? 'hideDetails' : 'tapDetails')}
          </Text>
        ) : null}
      </TouchableOpacity>
      {open && hasDetails ? (
        <View testID="headline-details" style={s.details}>
          {children}
        </View>
      ) : null}
      {footer}
    </View>
  );
}
