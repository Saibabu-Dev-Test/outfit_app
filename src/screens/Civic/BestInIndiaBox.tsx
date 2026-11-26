// Hospitals tab: "Best in India for <disease>" under the "Where to go for…" box. The query goes
// through the disease search (services/diseaseSearch.ts: English, everyday words, Telugu, Hindi,
// misspellings) to the departments to see, a red 108 / 112 notice for red-flag conditions, and the
// top NIRF India Rankings 2025 (Medical) institutions for those departments (data/topHospitalsIndia.ts):
// speciality institutes first when they fit, then by NIRF rank, same state first. Every rank carries
// its source link and the note that NIRF is a teaching + research ranking, not a treatment rating.
// Under it, "Govt package rates": the official PM-JAY HBP 2022 and CGHS 2025 rates for the procedures
// that treat the matched disease (services/procedureRates.ts), behind a toggle, each with its source.
// Each institution is a HeadlineCard: bold "#rank name", city / state summary; tap = its NIRF source link.
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { AppLanguage } from '../../i18n/appLanguage';
import { civicText } from '../../i18n/civicLabels';
import { diseaseName } from '../../services/diseaseSearch';
import { NIRF_SOURCE_LABEL, bestHospitalsFor } from '../../data/topHospitalsIndia';
import { CGHS, PMJAY, RateHit, priceLine, ratesFor, rowTitle } from '../../services/procedureRates';
import { callNumber, openLink } from './civicParts';
import { biLabel } from './bi';
import HeadlineCard from '../../components/HeadlineCard';

const RED = '#C62828';

function RateRows({ title, hits, source, asOf }: { title: string; hits: RateHit[]; source: string; asOf: string }) {
  if (!hits.length) return null;
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={[ui.body, { fontWeight: '700' }]}>{title}</Text>
      {hits.map(h => (
        <View key={`${h.scheme}:${h.row.code}`} style={{ marginTop: 4 }}>
          <Text style={ui.body}>
            {rowTitle(h.row)} <Text style={ui.muted}>({h.row.code})</Text>
          </Text>
          <Text style={ui.good}>💰 {priceLine(h)}</Text>
        </View>
      ))}
      <TouchableOpacity onPress={() => openLink(source)}>
        <Text style={[ui.muted, { fontSize: 12, color: colors.primary }]}>
          🔗 {title} · {asOf}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Govt package rates for the matched disease (hidden until tapped; the data is bundled, no network)
export function GovtRatesBox({ lang, query }: { lang: AppLanguage; query: string }) {
  const T = (k: Parameters<typeof civicText>[1]) => civicText(lang, k);
  const [open, setOpen] = useState(false);
  const r = query.trim() ? ratesFor(query, 3) : null;
  if (!r || !r.disease || (!r.pmjay.length && !r.cghs.length)) return null;
  return (
    <View style={{ marginTop: 10 }}>
      <TouchableOpacity onPress={() => setOpen(v => !v)}>
        <Text style={[ui.muted, { color: colors.primary }]}>
          💰 {biLabel(lang, 'govtRates')} {open ? '▴' : '▾'}
        </Text>
      </TouchableOpacity>
      {open ? (
        <>
          <RateRows title="PM-JAY HBP 2022" hits={r.pmjay} source={PMJAY.source} asOf={PMJAY.asOf} />
          <RateRows title="CGHS 2025" hits={r.cghs} source={CGHS.source} asOf={CGHS.asOf} />
          <Text style={[ui.muted, { fontSize: 12, marginTop: 6 }]}>{T('cityTiers')}</Text>
          <Text style={[ui.muted, { fontSize: 12 }]}>ℹ️ {T('govtRatesNote')}</Text>
        </>
      ) : null}
    </View>
  );
}

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
        <HeadlineCard
          key={h.nirfId}
          divided
          lang={lang}
          headline={`#${h.rank} ${h.name}`}
          summaryPrefix="📍 "
          summary={`${h.city}, ${h.state}${h.reason === 'specialist' ? ` · ⭐ ${T('specialistInst')}` : ''}`}
        >
          <TouchableOpacity onPress={() => openLink(h.sourceUrl)}>
            <Text style={[ui.muted, { fontSize: 12, color: colors.primary }]}>
              🔗 {T('nirfRank')} {h.rank} · {NIRF_SOURCE_LABEL}
            </Text>
          </TouchableOpacity>
        </HeadlineCard>
      ))}
      <Text style={[ui.muted, { fontSize: 12, marginTop: 8 }]}>ℹ️ {biLabel(lang, 'nirfNote')}</Text>
      <GovtRatesBox lang={lang} query={q} />
      <Text style={[ui.muted, { fontSize: 12 }]}>⚠️ {biLabel(lang, 'notDiagnosis')}</Text>
    </View>
  );
}
