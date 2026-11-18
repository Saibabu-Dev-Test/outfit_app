// Bilingual text for the Govt / Hospitals / Laws tabs: the user's app language (Telugu / Hindi)
// first, then the English original under it in small muted text. English app language = English only.
import React from 'react';
import { StyleProp, Text, TextStyle, View } from 'react-native';
import { ui } from '../Earn/earnUi';
import { AppLanguage } from '../../i18n/appLanguage';
import { CivicKey, civicText } from '../../i18n/civicLabels';

// "ముఖ్యమంత్రి · Chief Minister" (English: "Chief Minister")
export const biLabel = (lang: AppLanguage, key: CivicKey): string =>
  lang === 'English' ? civicText('English', key) : `${civicText(lang, key)} · ${civicText('English', key)}`;

const same = (a?: string, b?: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

export function Bi({
  en,
  tr,
  style,
  prefix = '',
  lines,
}: {
  en?: string;
  tr?: string | null;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  lines?: number;
}) {
  if (!en && !tr) return null;
  const local = tr && !same(tr, en) ? tr : '';
  if (!local) {
    return (
      <Text style={style || ui.body} numberOfLines={lines}>
        {prefix}
        {en}
      </Text>
    );
  }
  return (
    <View>
      <Text style={style || ui.body} numberOfLines={lines}>
        {prefix}
        {local}
      </Text>
      {en ? (
        <Text style={[ui.muted, { fontSize: 12 }]} numberOfLines={lines}>
          {en}
        </Text>
      ) : null}
    </View>
  );
}
