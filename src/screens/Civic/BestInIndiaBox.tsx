// Hospitals tab: "Best in India for <disease>" under the "Where to go for…" box. The query goes
// through the disease search (services/diseaseSearch.ts: English, everyday words, Telugu, Hindi,
// misspellings) to the departments to see, a red 108 / 112 notice for red-flag conditions, and the
// top NIRF India Rankings 2025 (Medical) institutions for those departments (data/topHospitalsIndia.ts):
// speciality institutes first when they fit, then by NIRF rank, same state first. Every rank carries
// its source link and the note that NIRF is a teaching + research ranking, not a treatment rating.
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { AppLanguage } from '../../i18n/appLanguage';
import { civicText } from '../../i18n/civicLabels';
import { diseaseName } from '../../services/diseaseSearch';
import { NIRF_SOURCE_LABEL, bestHospitalsFor } from '../../data/topHospitalsIndia';
import { callNumber, openLink } from './civicParts';
import { biLabel } from './bi';

const RED = '#C62828';

export default function BestInIndiaBox({ lang, query, state }: { lang: AppLanguage; query: string; state?: string }) {
  const T = (k: Parameters<typeof civicText>[1]) => civicText(lang, k);
  const q = query.trim();
  const best = q ? bestHospitalsFor(q, { state, limit: 5 }) : null;
  if (!best || !best.match || best.match.score < 0.4) return null;
  const d = best.match.disease;
  const local = diseaseName(d, lang);
  return (
    <View style={ui.card}>
      <Text style={ui.h2}>
        🏆 {T('bestInIndia')} {local}
      </Text>
      {local !== d.en ? <Text style={ui.muted}>{d.en}</Text> : null}
      {best.match.score < 1 ? (
        <Text style={[ui.muted, { fontSize: 12 }]}>
          {T('didYouMean')}: {local}
        </Text>
      ) : null}
      {best.emergency ? (
        <View style={{ marginTop: 6, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: RED }}>
          <Text style={ui.bad}>🚑 {T('diseaseEmergency')}</Text>
          <View style={[ui.row, { marginTop: 6 }]}>
            <TouchableOpacity style={[ui.btn, { marginRight: 8, backgroundColor: RED }]} onPress={() => callNumber('108')}>
              <Text style={ui.btnText}>📞 108</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[ui.btn, { backgroundColor: RED }]} onPress={() => callNumber('112')}>
              <Text style={ui.btnText}>📞 112</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      <Text style={[ui.muted, { marginTop: 6 }]}>🩺 {biLabel(lang, 'seeSpecialities')}</Text>
      <View style={[ui.row, { flexWrap: 'wrap' }]}>
        {best.specialities.map(s => (
          <View key={s} style={[ui.chip, { marginTop: 4 }]}>
            <Text style={ui.chipText}>{s}</Text>
          </View>
        ))}
      </View>
      {best.hospitals.map(h => (
        <View key={h.nirfId} style={{ marginTop: 8 }}>
          <Text style={[ui.body, { fontWeight: '700' }]}>
            #{h.rank} {h.name}
          </Text>
          <Text style={ui.muted}>
            📍 {h.city}, {h.state}
            {h.reason === 'specialist' ? ` · ⭐ ${T('specialistInst')}` : ''}
          </Text>
          <TouchableOpacity onPress={() => openLink(h.sourceUrl)}>
            <Text style={[ui.muted, { fontSize: 12, color: colors.primary }]}>
              🔗 {T('nirfRank')} {h.rank} · {NIRF_SOURCE_LABEL}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
      <Text style={[ui.muted, { fontSize: 12, marginTop: 8 }]}>ℹ️ {biLabel(lang, 'nirfNote')}</Text>
      <Text style={[ui.muted, { fontSize: 12 }]}>⚠️ {biLabel(lang, 'notDiagnosis')}</Text>
    </View>
  );
}
