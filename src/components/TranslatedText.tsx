// Another user's text (post caption, comment / reply, circle chat, birthday wish) in the reader's
// language, translated on the phone (services/translate.ts, ML Kit, offline once the model is in).
// Shows the translation by default with small chips under it: original · reader's language ·
// English, e.g. (TE) (HI) (EN). Tapping a chip switches what is shown. Own messages, text already in
// the reader's language, untranslatable languages, the web build, and "model not downloaded yet"
// (e.g. offline on first use) all show the original text with no chips.
// `prefix` renders inside the same Text before the body (the author's name, as the feed does);
// `renderBody` lets a screen draw the body itself (BirthdayChat highlights @mentions).
import React, { ReactNode, useEffect, useState } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import { useAuth } from '../context/AuthContext';
import {
  cachedLanguage,
  cachedTranslation,
  chipCodes,
  chipLabel,
  onModelReady,
  prepareReaderModels,
  targetCode,
  translateText,
} from '../services/translate';

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  authorId?: string | number | null; // own text is never translated
  prefix?: ReactNode;
  renderBody?: (text: string) => ReactNode;
  chipsStyle?: StyleProp<ViewStyle>;
}

export default function TranslatedText({ text, style, authorId, prefix, renderBody, chipsStyle }: Props) {
  const { user } = useAuth();
  const reader = targetCode(user?.language);
  const mine = authorId != null && user?.id != null && String(authorId) === String(user.id);
  const active = !mine && !!text;

  const [from, setFrom] = useState<string | null>(() => (active ? cachedLanguage(text) || null : null));
  // code -> text in that language (the original is under `from`)
  const [versions, setVersions] = useState<Record<string, string>>(() => {
    const hit = active ? cachedTranslation(text, reader) : undefined;
    return hit !== undefined ? { [reader]: hit } : {};
  });
  const [shown, setShown] = useState<string>(reader);
  const [modelTick, setModelTick] = useState(0);

  useEffect(() => {
    if (active) prepareReaderModels(user?.language);
  }, [active, user?.language]);

  useEffect(() => onModelReady(() => setModelTick(t => t + 1)), []);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    setShown(reader);
    translateText(text, reader).then(r => {
      if (!alive) return;
      setFrom(r.from);
      setVersions(r.translated ? { [reader]: r.text } : {});
    });
    return () => {
      alive = false;
    };
  }, [active, text, reader, modelTick]);

  const pickChip = (code: string) => {
    if (code === from || versions[code] !== undefined) {
      setShown(code);
      return;
    }
    translateText(text, code).then(r => {
      if (!r.translated) return; // no model for that one yet: stay on what is shown
      setVersions(v => ({ ...v, [code]: r.text }));
      setShown(code);
    });
  };

  const translated = active && !!from && from !== reader && versions[reader] !== undefined;
  const body = !translated || shown === from ? text : versions[shown] ?? versions[reader];
  const content = (
    <Text style={style}>
      {prefix}
      {renderBody ? renderBody(body) : body}
    </Text>
  );
  if (!translated || !from) return content;

  return (
    <View>
      {content}
      <View style={[styles.chips, chipsStyle]}>
        {chipCodes(from, reader).map(code => {
          const on = code === shown;
          return (
            <TouchableOpacity
              key={code}
              onPress={() => pickChip(code)}
              style={[styles.chip, on && styles.chipOn]}
              hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
              accessibilityRole="button"
              accessibilityLabel={`Show in ${chipLabel(code)}${code === from ? ' (original)' : ''}`}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{chipLabel(code)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    chips: { flexDirection: 'row', gap: spacing.xs, marginTop: 3 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.full,
      paddingHorizontal: 7,
      paddingVertical: 1,
    },
    chipOn: { borderColor: colors.primary, backgroundColor: colors.primary },
    chipText: { fontSize: fontSize.xs - 1, color: colors.textSecondary, fontWeight: fontWeight.semiBold },
    chipTextOn: { color: '#FFFFFF' },
  }),
);
