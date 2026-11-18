// Shared bits for the Govt / Hospitals tabs: state + district picker, stars, people's reviews.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ui } from '../Earn/earnUi';
import { colors } from '../../theme';
import { INDIA_STATES } from '../../constants/indiaStates';
import { AppLanguage } from '../../i18n/appLanguage';
import { civicText } from '../../i18n/civicLabels';
import { CivicReviewsResponse, getReviews, postReview, reportReview } from '../../services/civicApi';

const PLACE_KEY = 'outfit.civic.place';

export interface CivicPlace {
  state: string;
  district: string;
}

export const useCivicPlace = (): [CivicPlace, (p: CivicPlace) => void] => {
  const [place, setPlace] = useState<CivicPlace>({ state: '', district: '' });
  useEffect(() => {
    AsyncStorage.getItem(PLACE_KEY)
      .then(v => {
        if (!v) return;
        const p = JSON.parse(v);
        if (p && typeof p.state === 'string') setPlace({ state: p.state, district: String(p.district || '') });
      })
      .catch(() => undefined);
  }, []);
  const save = useCallback((p: CivicPlace) => {
    setPlace(p);
    AsyncStorage.setItem(PLACE_KEY, JSON.stringify(p)).catch(() => undefined);
  }, []);
  return [place, save];
};

export const openLink = (url: string) => {
  if (url) Linking.openURL(url).catch(() => undefined);
};

export const callNumber = (n: string) => {
  const d = String(n || '').split(/[,/]/)[0].replace(/[^0-9+]/g, '');
  if (d) Linking.openURL(`tel:${d}`).catch(() => undefined);
};

export function PlacePicker({ lang, place, onChange }: { lang: AppLanguage; place: CivicPlace; onChange: (p: CivicPlace) => void }) {
  const [district, setDistrict] = useState(place.district);
  useEffect(() => setDistrict(place.district), [place.district]);
  return (
    <View style={ui.card}>
      <Text style={ui.h2}>{civicText(lang, 'state')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {INDIA_STATES.map(s => {
          const on = s.code === place.state;
          return (
            <TouchableOpacity key={s.code} style={[ui.chip, on && ui.chipOn]} onPress={() => onChange({ state: s.code, district: on ? place.district : '' })}>
              <Text style={[ui.chipText, on && ui.chipTextOn]}>{s.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {place.state ? (
        <TextInput
          style={ui.input}
          value={district}
          onChangeText={setDistrict}
          onEndEditing={() => onChange({ ...place, district: district.trim() })}
          onSubmitEditing={() => onChange({ ...place, district: district.trim() })}
          placeholder={civicText(lang, 'districtHint')}
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          maxLength={40}
        />
      ) : (
        <Text style={ui.muted}>{civicText(lang, 'pickState')}</Text>
      )}
    </View>
  );
}

export function Stars({ value, onPick, size = 22 }: { value: number; onPick?: (n: number) => void; size?: number }) {
  return (
    <View style={ui.row}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} disabled={!onPick} onPress={() => onPick && onPick(n)} hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}>
          <Text style={{ fontSize: size, color: n <= Math.round(value) ? '#F5A623' : colors.border }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function ReviewsBox({ lang, item, userName, myUid }: { lang: AppLanguage; item: string; userName?: string; myUid?: string }) {
  const [data, setData] = useState<CivicReviewsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getReviews(item);
      setData(r);
      if (r.mine) {
        setStars(r.mine.stars);
        setBody(r.mine.body);
      } else {
        setStars(0);
        setBody('');
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [item]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!stars) return;
    setBusy(true);
    try {
      await postReview(item, stars, body, userName);
      Alert.alert(civicText(lang, 'saved'));
      load();
    } catch (e: any) {
      Alert.alert(civicText(lang, 'yourReview'), e?.message || civicText(lang, 'error'));
    } finally {
      setBusy(false);
    }
  };

  const report = async (author: string) => {
    try {
      await reportReview(item, author);
      Alert.alert(civicText(lang, 'reported'));
    } catch (e: any) {
      Alert.alert(civicText(lang, 'report'), e?.message || civicText(lang, 'error'));
    }
  };

  return (
    <View style={ui.card}>
      <View style={ui.row}>
        <Text style={[ui.h2, ui.flex1]}>{civicText(lang, 'reviews')}</Text>
        {data && data.avg !== null ? (
          <Text style={ui.muted}>
            {civicText(lang, 'avg')} {data.avg} ★ ({data.count})
          </Text>
        ) : null}
      </View>
      <Text style={ui.body}>{civicText(lang, 'yourReview')}</Text>
      <Stars value={stars} onPick={setStars} size={28} />
      <TextInput
        style={[ui.input, { minHeight: 70, textAlignVertical: 'top' }]}
        value={body}
        onChangeText={setBody}
        placeholder={civicText(lang, 'writeReview')}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={1000}
      />
      <TouchableOpacity style={[ui.btn, (!stars || busy) && ui.btnOff]} disabled={!stars || busy} onPress={submit}>
        <Text style={ui.btnText}>{busy ? '…' : civicText(lang, 'submit')}</Text>
      </TouchableOpacity>
      {loading ? <ActivityIndicator style={{ marginTop: 12 }} color={colors.primary} /> : null}
      {data && !data.reviews.length && !loading ? <Text style={[ui.muted, { marginTop: 12 }]}>{civicText(lang, 'noReviews')}</Text> : null}
      {(data?.reviews || []).map(r => (
        <View key={`${r.item}:${r.author}`} style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
          <View style={ui.row}>
            <Text style={[ui.body, ui.flex1, { fontWeight: '700' }]}>{r.userName}</Text>
            <Stars value={r.stars} size={14} />
          </View>
          {r.body ? <Text style={ui.body}>{r.body}</Text> : null}
          <View style={ui.row}>
            <Text style={[ui.muted, ui.flex1]}>{fmtDate(r.updatedAt)}</Text>
            {r.author !== myUid ? (
              <TouchableOpacity onPress={() => report(r.author)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={ui.muted}>⚑ {civicText(lang, 'report')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
