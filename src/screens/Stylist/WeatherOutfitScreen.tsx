// Me > 🌤️ Today's outfit for the weather: today's weather for the profile district (Open-Meteo, free,
// no key) + tips + the 3 best top/bottom pairs from the user's own wardrobe for the chosen occasion.
// Logic: services/weatherOutfit.ts. Never moves or changes wardrobe data (read only).
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenShell from '../../components/ScreenShell';
import { ui } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { getWardrobeItems, WardrobeItemResponse } from '../../services/wardrobeApi';
import { getUserProfile } from '../../services/userApi';
import { getTodayWeather, suggestForWeather, Weather, weatherTips } from '../../services/weatherOutfit';
import type { LuckyPair } from '../../services/luckyPairs';

const OCCASIONS = ['Casual', 'Office', 'College', 'Temple', 'Party', 'Wedding'];

export default function WeatherOutfitScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const uid = user?.id || '';
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<WardrobeItemResponse[]>([]);
  const [occasion, setOccasion] = useState(OCCASIONS[0]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    setError(null);
    try {
      const [profile, wardrobe] = await Promise.all([
        getUserProfile(uid),
        getWardrobeItems(uid).catch(() => [] as WardrobeItemResponse[]),
      ]);
      setItems(wardrobe);
      const place = (profile as any)?.district || (profile as any)?.placeOfBirth || null;
      setWeather(await getTodayWeather(place));
    } catch (e: any) {
      setError(e?.message || 'Could not load the weather. Please check your internet.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  let pairs: LuckyPair[] = [];
  try {
    pairs = weather ? suggestForWeather(items, weather, occasion) : [];
  } catch {
    pairs = [];
  }

  return (
    <ScreenShell title="Outfit for the weather" navigation={navigation}>
      <ScrollView
        contentContainerStyle={ui.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {loading ? <ActivityIndicator /> : null}
        {error ? (
          <View style={ui.card}>
            <Text style={ui.body}>{error}</Text>
          </View>
        ) : null}
        {weather ? (
          <View style={ui.card}>
            <Text style={ui.muted}>Today in {weather.place}</Text>
            <Text style={ui.h1}>
              {weather.tempNow}°C · {weather.summary}
            </Text>
            <Text style={ui.body}>
              High {weather.tempMax}° · Low {weather.tempMin}° · Rain {weather.rainChance}%
            </Text>
            {weatherTips(weather).map(t => (
              <Text key={t} style={ui.body}>
                • {t}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={ui.h2}>Occasion</Text>
        <View style={[ui.row, { flexWrap: 'wrap' }]}>
          {OCCASIONS.map(o => (
            <TouchableOpacity key={o} style={[ui.chip, occasion === o && ui.chipOn]} onPress={() => setOccasion(o)}>
              <Text style={[ui.chipText, occasion === o && ui.chipTextOn]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {weather && !pairs.length ? (
          <View style={ui.card}>
            <Text style={ui.body}>Add a few tops and bottoms to your wardrobe to get outfit ideas here.</Text>
          </View>
        ) : null}
        {pairs.map((p, i) => (
          <View key={`${p.top.id}_${p.bottom.id}_${i}`} style={ui.card}>
            <Text style={ui.h2}>
              {i + 1}. {p.top.name || p.top.category} + {p.bottom.name || p.bottom.category}
            </Text>
            <Text style={ui.body}>{p.why}</Text>
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}
