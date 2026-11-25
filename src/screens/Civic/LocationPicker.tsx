// State -> District -> Mandal picker for the Govt / Hospitals tabs. Every value is CHOSEN from the
// official LGD list (src/data/locations): tap to choose, with a filter box that only narrows the list
// (typed text is never accepted as a value). The third level's label follows the state (Mandal in
// AP / TG, Tehsil, Taluk, Taluka, Block, Circle, Sub-division). Mandal is optional.
// Fabric-safe (see the Hospitals addViewAt crash fix, 7bb800c): the card always mounts the same three
// rows in the same order (collapsable={false}), every list row has a stable key (the LGD code), the
// option lists render inside a fixed-height ScrollView with removeClippedSubviews off.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { INDIA_STATES } from '../../constants/indiaStates';
import { AppLanguage, langCode } from '../../i18n/appLanguage';
import { CivicKey, civicText } from '../../i18n/civicLabels';
import { PlaceOption, SubLevel, districtsOf, filterOptions, findDistrict, findSubDistrict, placeLabel, subDistrictsOf, subLevelOf } from '../../data/locations';

export const PLACE_KEY = 'outfit.civic.place';

export interface CivicPlace {
  state: string; // app state code ('' = none)
  district: string; // LGD district name ('' = whole state)
  districtCode?: number;
  mandal: string; // LGD sub-district name ('' = whole district)
  mandalCode?: number;
}

export const EMPTY_PLACE: CivicPlace = { state: '', district: '', mandal: '' };

/**
 * A saved place made valid against the LGD list (pure: tested). Older app versions saved a typed
 * district ("kurnool"): it becomes the LGD district of that name, or is dropped (no free text).
 */
export function validPlace(p: any): CivicPlace {
  if (!p || typeof p.state !== 'string' || !INDIA_STATES.some(s => s.code === p.state)) return EMPTY_PLACE;
  const state = p.state;
  const ds = districtsOf(state);
  const d = (typeof p.districtCode === 'number' && ds.find(x => x.code === p.districtCode)) || findDistrict(state, String(p.district || ''));
  if (!d) return { state, district: '', mandal: '' };
  const ms = subDistrictsOf(state, d.code);
  const m = (typeof p.mandalCode === 'number' && ms.find(x => x.code === p.mandalCode)) || findSubDistrict(state, d.code, String(p.mandal || ''));
  return { state, district: d.name, districtCode: d.code, mandal: m ? m.name : '', mandalCode: m ? m.code : undefined };
}

export const useCivicPlace = (): [CivicPlace, (p: CivicPlace) => void] => {
  const [place, setPlace] = useState<CivicPlace>(EMPTY_PLACE);
  useEffect(() => {
    AsyncStorage.getItem(PLACE_KEY)
      .then(v => {
        if (!v) return;
        setPlace(validPlace(JSON.parse(v)));
      })
      .catch(() => undefined);
  }, []);
  const save = useCallback((p: CivicPlace) => {
    const ok = validPlace(p);
    setPlace(ok);
    AsyncStorage.setItem(PLACE_KEY, JSON.stringify(ok)).catch(() => undefined);
  }, []);
  return [place, save];
};

const LEVEL_KEY: Record<SubLevel, CivicKey> = {
  mandal: 'lvMandal',
  tehsil: 'lvTehsil',
  taluk: 'lvTaluk',
  taluka: 'lvTaluka',
  block: 'lvBlock',
  circle: 'lvCircle',
  subdivision: 'lvSubdivision',
};

// "Mandal" / "Tehsil" / "Taluk" ... for the state, in the app language
export const subLevelLabel = (lang: AppLanguage, state: string): string => civicText(lang, LEVEL_KEY[subLevelOf(state)]);

export const fill = (text: string, vars: Record<string, string>): string => text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));

const STATE_OPTIONS: PlaceOption[] = INDIA_STATES.map((s, i) => ({ code: i + 1, name: s.name }));

const MAX_ROWS = 120; // longest LGD list is 75 districts (UP) / 41 sub-districts: never cut in practice

function SelectRow({
  testID,
  label,
  value,
  placeholder,
  options,
  lc,
  lang,
  disabled,
  emptyText,
  selectedCode,
  onPick,
  onClear,
}: {
  testID: string;
  label: string;
  value: string;
  placeholder: string;
  options: PlaceOption[];
  lc: string;
  lang: AppLanguage;
  disabled?: boolean;
  emptyText?: string;
  selectedCode?: number;
  onPick: (o: PlaceOption) => void;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const shown = useMemo(() => filterOptions(options, q).slice(0, MAX_ROWS), [options, q]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const pick = (o: PlaceOption) => {
    setOpen(false);
    setQ('');
    onPick(o);
  };
  return (
    <View collapsable={false} style={{ marginTop: 8 }} testID={testID}>
      <Text style={ui.muted}>{label}</Text>
      <View style={ui.row}>
        <TouchableOpacity
          testID={`${testID}-open`}
          disabled={disabled || !options.length}
          style={[ui.input, ui.flex1, { marginBottom: 0, justifyContent: 'center' }, (disabled || !options.length) && { opacity: 0.5 }]}
          onPress={() => setOpen(v => !v)}
        >
          <Text style={value ? ui.body : ui.muted} numberOfLines={1}>
            {value || placeholder} {open ? '▴' : '▾'}
          </Text>
        </TouchableOpacity>
        {value && onClear ? (
          <TouchableOpacity testID={`${testID}-clear`} onPress={onClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginLeft: 8 }}>
            <Text style={[ui.muted, { fontSize: 16 }]}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {!disabled && !options.length && emptyText ? <Text style={[ui.muted, { marginTop: 4 }]}>{emptyText}</Text> : null}
      <View collapsable={false}>
        {open ? (
          <View collapsable={false} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: 4 }}>
            <TextInput
              testID={`${testID}-filter`}
              style={[ui.input, { marginBottom: 0 }]}
              value={q}
              onChangeText={setQ}
              placeholder={civicText(lang, 'filterList')}
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              maxLength={40}
            />
            <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" removeClippedSubviews={false}>
              {shown.map(o => {
                const on = o.code === selectedCode;
                const local = placeLabel(o, lc);
                return (
                  <TouchableOpacity key={`${testID}-${o.code}`} testID={`${testID}-opt-${o.code}`} onPress={() => pick(o)} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
                    <Text style={[ui.body, on && { color: colors.primary, fontWeight: '700' }]}>
                      {local}
                      {local !== o.name ? ` · ${o.name}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {!shown.length ? <Text style={[ui.muted, { padding: 12 }]}>{civicText(lang, 'noMatchList')}</Text> : null}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function PlacePicker({ lang, place, onChange }: { lang: AppLanguage; place: CivicPlace; onChange: (p: CivicPlace) => void }) {
  const lc = langCode(lang);
  const T = (k: CivicKey) => civicText(lang, k);
  const stateIdx = INDIA_STATES.findIndex(s => s.code === place.state);
  const districts = useMemo(() => (place.state ? districtsOf(place.state) : []), [place.state]);
  const subs = useMemo(() => (place.state && place.districtCode ? subDistrictsOf(place.state, place.districtCode) : []), [place.state, place.districtCode]);
  const level = place.state ? subLevelLabel(lang, place.state) : civicText(lang, 'lvMandal');
  const dOpt = districts.find(d => d.code === place.districtCode);
  const mOpt = subs.find(m => m.code === place.mandalCode);
  return (
    <View style={ui.card} collapsable={false} testID="civic-place-picker">
      <Text style={ui.h2}>📍 {T('state')}</Text>
      <SelectRow
        testID="pick-state"
        label={T('state')}
        value={stateIdx >= 0 ? INDIA_STATES[stateIdx].name : ''}
        placeholder={T('pickState')}
        options={STATE_OPTIONS}
        lc={lc}
        lang={lang}
        selectedCode={stateIdx + 1}
        onPick={o => {
          const s = INDIA_STATES[o.code - 1];
          if (s && s.code !== place.state) onChange({ state: s.code, district: '', mandal: '' });
        }}
      />
      <SelectRow
        testID="pick-district"
        label={T('lvDistrict')}
        value={dOpt ? placeLabel(dOpt, lc) : ''}
        placeholder={`${T('pickDistrict')} (${T('optional')})`}
        options={districts}
        lc={lc}
        lang={lang}
        disabled={!place.state}
        selectedCode={place.districtCode}
        onPick={o => {
          if (o.code !== place.districtCode) onChange({ state: place.state, district: o.name, districtCode: o.code, mandal: '' });
        }}
        onClear={() => onChange({ state: place.state, district: '', mandal: '' })}
      />
      <SelectRow
        testID="pick-mandal"
        label={level}
        value={mOpt ? placeLabel(mOpt, lc) : ''}
        placeholder={`${fill(T('pickSub'), { level })} (${T('optional')})`}
        options={subs}
        lc={lc}
        lang={lang}
        disabled={!place.districtCode}
        emptyText={place.districtCode ? fill(T('noSubdistricts'), { level }) : undefined}
        selectedCode={place.mandalCode}
        onPick={o => onChange({ ...place, mandal: o.name, mandalCode: o.code })}
        onClear={() => onChange({ ...place, mandal: '', mandalCode: undefined })}
      />
    </View>
  );
}

export type ScopeLevel = 'mandal' | 'district' | 'state';

// What the screen asked for (most specific level picked)
export const askedLevel = (p: CivicPlace): ScopeLevel => (p.mandal ? 'mandal' : p.district ? 'district' : 'state');

/**
 * The visible "No data for <mandal>, showing <district> district" note (pure: tested): '' when the
 * shown level is the asked one.
 */
export function scopeNote(lang: AppLanguage, place: CivicPlace, shown: ScopeLevel, stateName: string): string {
  const asked = askedLevel(place);
  if (asked === shown || asked === 'state') return '';
  if (shown === 'district') return fill(civicText(lang, 'scopeDistrict'), { m: place.mandal, d: place.district });
  return fill(civicText(lang, asked === 'mandal' ? 'scopeStateFromSub' : 'scopeState'), { m: place.mandal, d: place.district, s: stateName });
}
