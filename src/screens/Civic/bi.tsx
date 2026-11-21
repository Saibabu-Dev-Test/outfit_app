// Bilingual text for the Govt / Hospitals / Laws tabs. Inside a <CivicCard> the card shows the user's
// app language, with an "English" toggle in its header that adds the English original under each
// line (small muted text). Outside a card (no toggle) both are shown, as before. English app
// language = English only. A line with no translation shows the English text.
import React, { createContext, useContext, useState } from 'react';
import { StyleProp, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { ui } from '../Earn/earnUi';
import { AppLanguage } from '../../i18n/appLanguage';
import { CivicKey, civicText } from '../../i18n/civicLabels';

// "ముఖ్యమంత్రి · Chief Minister" (English, or no translation yet: "Chief Minister")
export const biLabel = (lang: AppLanguage, key: CivicKey): string => {
  const en = civicText('English', key);
  const local = lang === 'English' ? en : civicText(lang, key);
  return local === en ? en : `${local} · ${en}`;
};

const same = (a?: string, b?: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

// true = show the English line under the translated one (default outside a card)
const ShowEnglish = createContext<boolean>(true);

export function CivicCard({
  lang,
  children,
  style,
  hasTranslation = true,
}: {
  lang: AppLanguage;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  hasTranslation?: boolean;
}) {
  const [showEn, setShowEn] = useState(false);
  const toggle = lang !== 'English' && hasTranslation;
  return (
    <View style={[ui.card, style]}>
      {toggle ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 }}>
          <TouchableOpacity
            onPress={() => setShowEn(v => !v)}
            style={[ui.chip, showEn && ui.chipOn, { paddingVertical: 2, marginRight: 0 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="switch"
            accessibilityState={{ checked: showEn }}
          >
            <Text style={[ui.chipText, showEn && ui.chipTextOn, { fontSize: 11 }]}>
              {showEn ? '✓ ' : ''}
              {civicText(lang, 'englishToggle')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <ShowEnglish.Provider value={toggle ? showEn : true}>{children}</ShowEnglish.Provider>
    </View>
  );
}

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
  const showEn = useContext(ShowEnglish);
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
      {en && showEn ? (
        <Text style={[ui.muted, { fontSize: 12 }]} numberOfLines={lines}>
          {en}
        </Text>
      ) : null}
    </View>
  );
}
