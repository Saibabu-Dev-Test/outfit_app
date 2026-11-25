// Free-source rows for the Govt / Hospitals tabs (Worker origin 'free': Wikidata, Wikipedia,
// OpenStreetMap, official .gov.in sites; no AI). Hospital row = name, address, tap-to-call phone,
// map link, type label (Govt / Private / "Likely private · ownership not confirmed" or "Type not listed" when OSM does not tag it) and a
// "source · date" line. Govt sections get the same source line (name, date, link).
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { AppLanguage } from '../../i18n/appLanguage';
import { CivicKey, civicText } from '../../i18n/civicLabels';
import { CivicSrc, GovtData, Hospital } from '../../services/civicApi';
import { callNumber, openLink } from './civicParts';
import { Bi, CivicCard, biLabel } from './bi';

// Names that read as a government facility (same idea as the Worker's classifyHospital)
const GOVT_NAME =
  /\b(government|govt\.?|ggh|phc|chc|uphc|area hospital|district hospital|general hospital|primary health|community health|urban health|health (sub )?centre|sub[- ]?centre|esic?|railway hospital|teaching hospital|medical college|aiims|civil hospital|taluk hospital|mandal hospital|cghs)(?![a-z])/i;

// Type label key for a free-source hospital (OSM operator:type / ownership). No ownership tag and a
// name that does not read as a govt facility = "Likely private · ownership not confirmed" (never
// "Private"); no tag but a govt-looking name = "Type not listed". Rows without OSM ownership = not listed.
export const hospTypeKey = (h: Pick<Hospital, 'ownership'> & { name?: string; type?: string }): CivicKey => {
  if (h.ownership === 'govt') return 'typeGovt';
  if (h.ownership === 'private') return 'typePrivate';
  if (h.ownership === 'unknown' && h.name && !GOVT_NAME.test(`${h.name} ${h.type || ''}`)) return 'typePrivateLikely';
  return 'typeNotListed';
};

// A row / dataset from the free sources (ownership is only set on OSM rows)
export const isFreeHospital = (h: Hospital, dataOrigin?: string): boolean => dataOrigin === 'free' || h.origin === 'free' || h.ownership !== undefined;

// The district (Collectorate) website from a free Govt row's offices, '' when none is listed
export const districtSiteOf = (d?: GovtData | null): string => {
  const o = (d?.offices || []).find(x => x.website && /district|collectorate/i.test(`${x.name} ${x.what}`));
  return o ? o.website : '';
};

const host = (u: string) => u.replace(/^https?:\/\//, '').split('/')[0];

// "📚 Source: Wikipedia · 2026-11-22 · 🔗 en.wikipedia.org" (tap = open the source page)
export function SrcLine({ lang, src, fallbackUrl }: { lang: AppLanguage; src?: CivicSrc | null; fallbackUrl?: string }) {
  const url = (src && src.url) || fallbackUrl || '';
  const name = (src && src.name) || (url ? host(url) : '');
  if (!name && !url) return null;
  const parts = [name, src && src.date ? src.date : ''].filter(Boolean).join(' · ');
  const body = (
    <Text style={[ui.muted, { fontSize: 12, marginTop: 4 }, url ? { color: colors.primary } : null]} numberOfLines={2}>
      📚 {civicText(lang, 'sourceOne')}: {parts}
      {url ? ` · 🔗 ${host(url)}` : ''}
    </Text>
  );
  return url ? (
    <TouchableOpacity testID="civic-src-line" onPress={() => openLink(url)}>
      {body}
    </TouchableOpacity>
  ) : (
    <View testID="civic-src-line">{body}</View>
  );
}

// One OpenStreetMap hospital: compact, only what the free source states
export function FreeHospitalRow({ h, t, lang, children }: { h: Hospital; t?: Hospital | null; lang: AppLanguage; children?: React.ReactNode }) {
  const T = (k: CivicKey) => civicText(lang, k);
  const typeKey = hospTypeKey(h);
  return (
    <CivicCard lang={lang} hasTranslation={!!t}>
      <Bi en={h.name} tr={t?.name} style={ui.h2} />
      <Text testID="hosp-type" style={[typeKey === 'typeNotListed' || typeKey === 'typePrivateLikely' ? ui.muted : ui.good, { fontSize: 12 }]}>
        🏷️ {biLabel(lang, typeKey)}
      </Text>
      {h.address ? (
        <Bi prefix="📍 " en={h.address} tr={t?.address} />
      ) : (
        <Text style={[ui.muted, { fontSize: 12 }]}>
          📍 {T('address')}: {biLabel(lang, 'publicNA')}
        </Text>
      )}
      {!h.phone ? (
        <Text style={[ui.muted, { fontSize: 12 }]}>
          📞 {T('phone')}: {biLabel(lang, 'publicNA')}
        </Text>
      ) : null}
      <View style={[ui.row, { marginTop: 6, flexWrap: 'wrap' }]}>
        {h.phone ? (
          <TouchableOpacity testID="hosp-call" style={[ui.btnGhost, { marginRight: 8, marginTop: 4 }]} onPress={() => callNumber(h.phone)}>
            <Text style={ui.btnGhostText}>📞 {h.phone}</Text>
          </TouchableOpacity>
        ) : null}
        {h.mapUrl ? (
          <TouchableOpacity testID="hosp-map" style={[ui.btnGhost, { marginRight: 8, marginTop: 4 }]} onPress={() => openLink(h.mapUrl as string)}>
            <Text style={ui.btnGhostText}>🗺️ {T('map')}</Text>
          </TouchableOpacity>
        ) : null}
        {h.website ? (
          <TouchableOpacity style={[ui.btnGhost, { marginTop: 4 }]} onPress={() => openLink(h.website)}>
            <Text style={ui.btnGhostText}>🔗 {T('open')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <SrcLine lang={lang} src={h.src} fallbackUrl={h.osmUrl} />
      {children}
    </CivicCard>
  );
}
