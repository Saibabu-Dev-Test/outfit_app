// Header language chip for the Govt / Hospitals / Laws tabs (next to the owner's "Moderate" badge):
// shows the app language in its own script; tapping it opens a picker of the 12 app languages plus
// an "Also show English" switch. Picking a language calls setAppLanguage (the same setting as
// Settings > App language), so every civic screen re-renders in it; content shows the selected
// language with the English original under it while the switch is on.
import React, { useState } from 'react';
import { Modal, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { APP_LANGUAGES, APP_LANGUAGE_NATIVE, AppLanguage, setAppLanguage } from '../../i18n/appLanguage';
import { civicText } from '../../i18n/civicLabels';
import { setCivicShowEnglish, useCivicShowEnglish } from '../../i18n/civicEnglish';

export default function LanguageChip({ lang }: { lang: AppLanguage }) {
  const [open, setOpen] = useState(false);
  const showEn = useCivicShowEnglish();
  const pick = (l: AppLanguage) => {
    setAppLanguage(l);
    setOpen(false);
  };
  return (
    <>
      <TouchableOpacity
        testID="civic-lang-chip"
        style={[ui.chip, { marginRight: 8, marginBottom: 0, paddingVertical: 4 }]}
        onPress={() => setOpen(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`${civicText('English', 'langPicker')}: ${lang}`}
      >
        <Text style={ui.chipText}>🌐 {APP_LANGUAGE_NATIVE[lang]}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }}>
          <TouchableOpacity activeOpacity={1} style={[ui.card, { maxHeight: '80%' }]} onPress={() => undefined}>
            <Text style={ui.h2}>
              🌐 {civicText(lang, 'langPicker')}
              {lang !== 'English' && civicText(lang, 'langPicker') !== civicText('English', 'langPicker') ? ` · ${civicText('English', 'langPicker')}` : ''}
            </Text>
            <ScrollView style={{ marginTop: 6 }}>
              {APP_LANGUAGES.map(l => {
                const on = l === lang;
                return (
                  <TouchableOpacity
                    key={l}
                    testID={`civic-lang-${l}`}
                    onPress={() => pick(l)}
                    style={{ paddingVertical: 10, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[ui.body, ui.flex1, on && { fontWeight: '700', color: colors.primary }]}>
                      {on ? '✓ ' : ''}
                      {APP_LANGUAGE_NATIVE[l]}
                    </Text>
                    {l !== 'English' ? <Text style={ui.muted}>{l}</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={[ui.row, { marginTop: 10 }]}>
              <Text style={[ui.body, ui.flex1]}>
                {civicText(lang, 'alsoEnglish')}
                {lang !== 'English' && civicText(lang, 'alsoEnglish') !== civicText('English', 'alsoEnglish') ? `\n${civicText('English', 'alsoEnglish')}` : ''}
              </Text>
              <Switch testID="civic-lang-english" value={showEn} onValueChange={setCivicShowEnglish} disabled={lang === 'English'} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
