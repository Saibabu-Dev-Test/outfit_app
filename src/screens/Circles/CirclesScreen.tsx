// Circles: Mine / Discover / 📍 Nearby tabs, join with an invite code, create a public or private circle.
//   Discover: public circles of my district (location on: reverse-geocoded and saved on my profile;
//             off: my profile's district, or I pick one). Works with location on or off.
//   Nearby:   public circles with a location within 3 km (needs location; otherwise a prompt).
// Public circles are joined without a code; private circles are never listed (code / link only).
// New public circles get my district automatically; my location is optional (also shows in Nearby).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
  Switch,
  Linking,
} from 'react-native';
import KeyboardSafeView from '../../components/KeyboardSafeView';
import BannerAdSlot from '../../components/ads/BannerAdSlot';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useDayKey } from '../../hooks/useDayKey';
import { getMyBirthday, isMyBirthdayToday } from '../../services/birthdayApi';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import {
  Circle,
  createCircle,
  getMyCircles,
  getNearbyCircles,
  getDistrictCircles,
  formatKm,
  NEARBY_KM,
  joinCircle,
  joinWithCode,
  codeFromInvite,
} from '../../services/circlesApi';
import { timeAgo } from '../../utils/date';
import { getApproxLocation, LocationFailReason } from '../../native/location';
import { MyDistrict, pickMyDistrict, resolveMyPlace } from '../../services/districtApi';
import CityPickerModal from '../../components/CityPickerModal';
import { useBottomSpace } from '../../hooks/useBottomSpace';

export const EMOJIS = ['👗', '🔥', '🤍', '💼', '🌟', '🕰️', '👟', '💍', '🎉', '🌸', '🧥', '🪔', '👜', '🕶️', '🥻', '💄'];

export const PRIVATE_NOTICE =
  'Private circles may be reviewed by moderators if reported, to keep the community safe.';

type TabKey = 'mine' | 'discover' | 'nearby';
const TABS: TabKey[] = ['mine', 'discover', 'nearby'];

export default function CirclesScreen() {
  const sheetPad = useBottomSpace(16);
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const uid = user?.id;

  const [tab, setTab] = useState<TabKey>('mine');
  const [mine, setMine] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);

  // Create form
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEmoji, setNewEmoji] = useState(EMOJIS[0]);
  const [newPrivate, setNewPrivate] = useState(false);
  const [newNearby, setNewNearby] = useState(true); // public: also save my location (Nearby)
  const [creating, setCreating] = useState(false);

  // Nearby: public circles within NEARBY_KM (3 km)
  const [nearby, setNearby] = useState<Circle[]>([]);
  const [nearbyLoaded, setNearbyLoaded] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<{ message: string; reason: LocationFailReason | 'load' } | null>(null);

  // Discover: public circles of my district
  const [myDistrict, setMyDistrict] = useState<MyDistrict | null>(null);
  const myCoords = useRef<{ lat: number; lng: number } | null>(null);
  const [discover, setDiscover] = useState<Circle[]>([]);
  const [discoverLoaded, setDiscoverLoaded] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [districtPickerOpen, setDistrictPickerOpen] = useState(false);

  const loadDiscoverFor = useCallback(async (d: MyDistrict | null) => {
    setDiscoverError(null);
    try {
      setDiscover(d ? await getDistrictCircles(d.districtKey) : []);
    } catch (e: any) {
      setDiscoverError(e?.message || 'Could not load circles in your district.');
    }
  }, []);

  const loadDiscover = useCallback(async () => {
    if (!uid) return;
    setDiscoverLoading(true);
    const place = await resolveMyPlace(uid);
    if (place.coords) myCoords.current = place.coords;
    setMyDistrict(place.district);
    await loadDiscoverFor(place.district);
    setDiscoverLoading(false);
    setDiscoverLoaded(true);
  }, [uid, loadDiscoverFor]);

  const onPickDistrict = async (label: string) => {
    if (!uid || !label) return;
    setDiscoverLoading(true);
    try {
      const d = await pickMyDistrict(uid, label);
      setMyDistrict(d);
      await loadDiscoverFor(d);
    } catch (e: any) {
      Alert.alert('Could not save district', e?.message || 'Please try again.');
    }
    setDiscoverLoading(false);
    setDiscoverLoaded(true);
  };

  const loadNearby = useCallback(async () => {
    setNearbyLoading(true);
    setNearbyError(null);
    const loc = await getApproxLocation();
    if (!loc.ok) {
      setNearby([]);
      setNearbyError({ message: loc.message, reason: loc.reason });
      setNearbyLoading(false);
      setNearbyLoaded(true);
      return;
    }
    try {
      myCoords.current = loc.coords;
      setNearby(await getNearbyCircles(loc.coords.lat, loc.coords.lng));
    } catch (e: any) {
      setNearbyError({ message: e?.message || 'Could not load nearby circles.', reason: 'load' });
    }
    setNearbyLoading(false);
    setNearbyLoaded(true);
  }, []);

  const openTab = (k: TabKey) => {
    setTab(k);
    if (k === 'nearby' && !nearbyLoaded && !nearbyLoading) loadNearby();
    if (k === 'discover' && !discoverLoaded && !discoverLoading) loadDiscover();
  };

  // Opened with { tab }: switch to that tab, then clear the param
  const route = useRoute<any>();
  const wantTab: TabKey | undefined = route.params?.tab;
  useEffect(() => {
    if (!wantTab) return;
    const k: TabKey = TABS.includes(wantTab) ? wantTab : 'mine';
    setTab(k);
    if (k === 'nearby') loadNearby();
    if (k === 'discover') loadDiscover();
    navigation.setParams({ tab: undefined });
  }, [wantTab, navigation, loadNearby, loadDiscover]);

  const load = useCallback(
    async (showSpinner = true) => {
      if (!uid) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (showSpinner) setLoading(true);
      try {
        setMine(await getMyCircles(uid));
        setError(null);
      } catch (e: any) {
        setError(e?.message || 'Could not load your circles.');
      }
      setLoading(false);
      setRefreshing(false);
    },
    [uid],
  );

  // Back on this screen: reload; Nearby re-checks when it is the open tab (a circle may have gone
  // private), otherwise it reloads the next time it is opened
  const tabRef = useRef<TabKey>(tab);
  tabRef.current = tab;
  // Birthday circle visibility (one cached read of birthdays/{me})
  const [bdayToday, setBdayToday] = useState(false);
  const bdayDay = useDayKey();
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    getMyBirthday(uid).then(m => alive && setBdayToday(isMyBirthdayToday(m)));
    return () => {
      alive = false;
    };
  }, [uid, bdayDay]);
  useFocusEffect(
    useCallback(() => {
      load(false);
      if (tabRef.current === 'nearby') loadNearby();
      else setNearbyLoaded(false);
      if (tabRef.current === 'discover') loadDiscover();
      else setDiscoverLoaded(false);
    }, [load, loadNearby, loadDiscover]),
  );

  const openCircle = (c: Circle) => navigation.navigate('CircleChat', { circleId: c.id });

  const handleJoin = async (c: Circle) => {
    if (!uid) return;
    setJoiningId(c.id);
    try {
      await joinCircle(c, uid, { districtKey: myDistrict?.districtKey, coords: myCoords.current });
      const joined = (x: Circle) => (x.id === c.id ? { ...x, memberIds: [...x.memberIds, uid] } : x);
      setNearby(prev => prev.map(joined));
      setDiscover(prev => prev.map(joined));
      await load(false);
      openCircle(c);
    } catch (e: any) {
      Alert.alert('Could not join', e?.message || 'Please try again.');
    } finally {
      setJoiningId(null);
    }
  };

  const handleJoinWithCode = async () => {
    if (!uid) return;
    setJoiningCode(true);
    try {
      const circleId = await joinWithCode(code, uid);
      setCode('');
      await load(false);
      navigation.navigate('CircleChat', { circleId });
    } catch (e: any) {
      Alert.alert('Could not join', e?.message || 'Please check the code.');
    } finally {
      setJoiningCode(false);
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewDesc('');
    setNewEmoji(EMOJIS[0]);
    setNewPrivate(false);
    setNewNearby(true);
  };

  const handleCreate = async () => {
    if (!uid) {
      Alert.alert('Not signed in', 'Please sign in again.');
      return;
    }
    if (!newName.trim()) {
      Alert.alert('Name needed', 'Please give your circle a name.');
      return;
    }
    setCreating(true);
    try {
      // Public circles: district set automatically (from my location, else my profile district);
      // the approximate location (~100 m) is optional and also puts the circle in Nearby.
      let location: { lat: number; lng: number } | null = null;
      let district: MyDistrict | null = null;
      if (!newPrivate) {
        const place = await resolveMyPlace(uid, newNearby);
        location = newNearby ? place.coords : null;
        district = place.district;
        if (!district) {
          Alert.alert(
            'District needed',
            'Public circles show in Discover to people of your district. Turn on Location, or choose your district on the Discover tab, or make it private and invite people with the code.',
            [
              { text: 'OK', style: 'cancel' },
              { text: 'Make it private', onPress: () => setNewPrivate(true) },
            ],
          );
          return;
        }
        if (newNearby && !location) {
          Alert.alert(
            'No location',
            `Location is off, so the circle shows in Discover (${district.district}) but not in Nearby. You can add its location later in circle info.`,
          );
        }
        setMyDistrict(district);
      }
      const c = await createCircle(
        { name: newName, description: newDesc, emoji: newEmoji, isPrivate: newPrivate, location, district, radiusKm: null },
        uid,
      );
      if (location) setNearbyLoaded(false); // show it next time Nearby / Discover opens
      setDiscoverLoaded(false);
      setCreateOpen(false);
      resetForm();
      setTab('mine');
      load(false);
      openCircle(c);
    } catch (e: any) {
      Alert.alert('Could not create circle', e?.message || 'Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const data = tab === 'mine' ? mine : tab === 'discover' ? discover : nearby;
  const busy =
    loading ||
    (tab === 'nearby' && (nearbyLoading || !nearbyLoaded)) ||
    (tab === 'discover' && (discoverLoading || !discoverLoaded));

  const renderCircle = ({ item }: { item: Circle }) => {
    const isMember = !!uid && item.memberIds.includes(uid);
    const count = item.memberIds.length;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => (isMember ? openCircle(item) : handleJoin(item))}>
        <View style={styles.emojiBg}>
          <Text style={styles.emoji}>{item.emoji}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            {item.isPrivate && <Text style={styles.lock}>🔒</Text>}
          </View>
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
          <Text style={styles.cardMeta}>
            {tab === 'nearby' && item.distanceKm != null ? `📍 ${formatKm(item.distanceKm)} away · ` : ''}
            {count} {count === 1 ? 'member' : 'members'}
            {item.lastMessageAt ? ` · active ${timeAgo(item.lastMessageAt)}` : ''}
          </Text>
        </View>
        {isMember ? (
          <Text style={styles.openText}>›</Text>
        ) : (
          <View style={styles.joinBtn}>
            {joiningId === item.id ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Text style={styles.joinBtnText}>Join</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const header = (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={styles.subtitle}>Community</Text>
          <Text style={styles.title}>Circles</Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity style={styles.createBtn} onPress={() => setCreateOpen(true)}>
            <Text style={styles.createBtnText}>+ Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Join with code */}
      <View style={styles.codeRow}>
        <TextInput
          style={styles.codeInput}
          placeholder="Join with invite code"
          placeholderTextColor={colors.textMuted}
          value={code}
          // A pasted invite link / message (outfit://join/CODE) becomes just the code
          onChangeText={t => setCode(codeFromInvite(t) || t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.codeBtn, (code.trim().length !== 6 || joiningCode) && styles.disabled]}
          disabled={code.trim().length !== 6 || joiningCode}
          onPress={handleJoinWithCode}>
          {joiningCode ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Text style={styles.codeBtnText}>Join</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.codeHint}>Private circles are joined only with the invite code or link.</Text>

      {/* 🎉 Today's "Happy birthday to all" circle: only on my own (opted-in) birthday */}
      {bdayToday ? (
        <TouchableOpacity
          style={styles.bdayCircle}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('BirthdayChat', { mode: 'circle' })}>
          <Text style={styles.bdayEmoji}>🎉</Text>
          <View style={styles.bdayMid}>
            <Text style={styles.bdayTitle}>Happy birthday to all</Text>
            <Text style={styles.bdaySub}>Everyone with a birthday today · chat and photos · gone tomorrow</Text>
          </View>
          <Text style={styles.bdayArrow}>›</Text>
        </TouchableOpacity>
      ) : null}

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(k => (
          <TouchableOpacity
            key={k}
            style={[styles.tab, tab === k && styles.tabActive]}
            onPress={() => openTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit>
              {k === 'mine' ? `Mine (${mine.length})` : k === 'discover' ? '🏙️ Discover' : `📍 Nearby (${NEARBY_KM} km)`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'nearby' ? (
        <View style={styles.nearbyBar}>
          <Text style={styles.nearbyHint}>Public circles within {NEARBY_KM} km of you, nearest first</Text>
          <TouchableOpacity onPress={loadNearby} disabled={nearbyLoading}>
            <Text style={styles.nearbyLink}>{nearbyLoading ? 'Finding…' : '↻ Refresh'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {tab === 'discover' ? (
        <View style={styles.nearbyBar}>
          <Text style={styles.nearbyHint}>
            {myDistrict
              ? `Public circles in ${myDistrict.district} district${
                  myDistrict.source === 'location' ? ' (from your location)' : ''
                }`
              : 'Choose your district to see its public circles'}
          </Text>
          <TouchableOpacity onPress={() => setDistrictPickerOpen(true)} disabled={discoverLoading}>
            <Text style={styles.nearbyLink}>{myDistrict ? 'Change' : 'Choose'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {error && tab === 'mine' ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  // Empty Nearby: location refused / off, load error, or no circles within 3 km
  const nearbyEmpty = () => {
    if (nearbyError && nearbyError.reason !== 'load') {
      const settings = nearbyError.reason === 'blocked' || nearbyError.reason === 'denied';
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📍</Text>
          <Text style={styles.emptyText}>
            Nearby needs your approximate location (about 100 m) to find public circles within {NEARBY_KM} km.
            {'\n'}
            {nearbyError.message}
          </Text>
          <View style={styles.emptyBtns}>
            <TouchableOpacity style={styles.emptyBtn} onPress={loadNearby}>
              <Text style={styles.emptyBtnText}>Try again</Text>
            </TouchableOpacity>
            {settings || nearbyError.reason === 'off' ? (
              <TouchableOpacity
                style={[styles.emptyBtn, styles.emptyBtnAlt]}
                onPress={() =>
                  nearbyError.reason === 'off' && Platform.OS === 'android'
                    ? Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => Linking.openSettings())
                    : Linking.openSettings()
                }>
                <Text style={[styles.emptyBtnText, styles.emptyBtnAltText]}>Open settings</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      );
    }
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>📍</Text>
        <Text style={styles.emptyText}>
          {nearbyError
            ? nearbyError.message
            : `No public circles within ${NEARBY_KM} km yet. Create a public one and people around you can join! Circles further away are joined with their invite code.`}
        </Text>
        <View style={styles.emptyBtns}>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => {
              setNewPrivate(false);
              setCreateOpen(true);
            }}>
            <Text style={styles.emptyBtnText}>+ Create a circle</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const discoverEmpty = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🏙️</Text>
      <Text style={styles.emptyText}>
        {discoverError
          ? discoverError
          : myDistrict
            ? `No public circles in ${myDistrict.district} district yet. Create a public one and people of your district can join!`
            : 'Turn on Location, or choose your district (pick your city), to see public circles of your district.'}
      </Text>
      <View style={styles.emptyBtns}>
        {myDistrict ? (
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => {
              setNewPrivate(false);
              setCreateOpen(true);
            }}>
            <Text style={styles.emptyBtnText}>+ Create a circle</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setDistrictPickerOpen(true)}>
            <Text style={styles.emptyBtnText}>Choose district</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})}
      />
      <FlatList
        data={busy ? [] : data}
        keyExtractor={c => c.id}
        renderItem={renderCircle}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(false);
              if (tab === 'nearby') loadNearby();
              if (tab === 'discover') loadDiscover();
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          busy ? (
            <View>
              <ActivityIndicator style={styles.spinner} color={colors.primary} />
              {tab === 'nearby' ? <Text style={styles.emptyText}>Finding circles near you…</Text> : null}
            </View>
          ) : tab === 'nearby' ? (
            nearbyEmpty()
          ) : tab === 'discover' ? (
            discoverEmpty()
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>◎</Text>
              <Text style={styles.emptyText}>
                You have not joined any circles yet. Create one, join with an invite code, or look in Discover / 📍 Nearby.
              </Text>
            </View>
          )
        }
      />
      {/* Banner under the circles list (nothing when there is no ad) */}
      <BannerAdSlot slot="circlesBanner" />

      {/* Create circle */}
      <Modal
        visible={createOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateOpen(false)}>
        {/* Sheet bottom sits right on the keyboard (KeyboardSafeView) */}
        <KeyboardSafeView style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.flex1}
            activeOpacity={1}
            onPress={() => setCreateOpen(false)}
          />
          <View style={[styles.modalCard, { paddingBottom: sheetPad }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Create a circle</Text>

              <Text style={styles.label}>Emoji</Text>
              <View style={styles.emojiGrid}>
                {EMOJIS.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.emojiChoice, newEmoji === e && styles.emojiChoiceActive]}
                    onPress={() => setNewEmoji(e)}>
                    <Text style={styles.emojiChoiceText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Name (must be unique)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Office Looks"
                placeholderTextColor={colors.textMuted}
                value={newName}
                onChangeText={setNewName}
                maxLength={60}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="What is this circle about?"
                placeholderTextColor={colors.textMuted}
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
                maxLength={300}
              />

              <View style={styles.visRow}>
                <View style={styles.flex1}>
                  <Text style={styles.visTitle}>{newPrivate ? '🔒 Private' : '🌍 Public'}</Text>
                  <Text style={styles.visHint}>
                    {newPrivate
                      ? 'Never listed. People join only with your invite code or link.'
                      : 'Shown in Discover to people of your district (set automatically). Anyone can join.'}
                  </Text>
                </View>
                <Switch
                  value={newPrivate}
                  onValueChange={setNewPrivate}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.textInverse}
                />
              </View>
              {!newPrivate && (
                <View style={styles.visRow}>
                  <View style={styles.flex1}>
                    <Text style={styles.visTitle}>📍 Also show in Nearby</Text>
                    <Text style={styles.visHint}>
                      Optional: saves your approximate location (about 100 m) so people within {NEARBY_KM} km see it.
                    </Text>
                  </View>
                  <Switch
                    value={newNearby}
                    onValueChange={setNewNearby}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={colors.textInverse}
                  />
                </View>
              )}
              {newPrivate && <Text style={styles.notice}>{PRIVATE_NOTICE}</Text>}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setCreateOpen(false)}
                  disabled={creating}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, creating && styles.disabled]}
                  onPress={handleCreate}
                  disabled={creating}>
                  {creating ? (
                    <ActivityIndicator color={colors.textInverse} size="small" />
                  ) : (
                    <Text style={styles.saveText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardSafeView>
      </Modal>

      {/* Discover with location off: pick a city -> its district (saved on the profile) */}
      <CityPickerModal
        visible={districtPickerOpen}
        title="Your district (pick your city)"
        selected={null}
        onSelect={onPickDistrict}
        onClose={() => setDistrictPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },
  listContent: { paddingBottom: spacing.xxxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.extraBold, color: colors.textPrimary, letterSpacing: -0.5 },
  headerBtns: { flexDirection: 'row', gap: spacing.sm },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  createBtnText: { color: colors.textInverse, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  codeRow: { flexDirection: 'row', paddingHorizontal: spacing.base, gap: spacing.sm, marginBottom: spacing.md },
  codeInput: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    letterSpacing: 2,
    fontWeight: fontWeight.bold,
  },
  codeBtn: {
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBtnText: { color: colors.textInverse, fontWeight: fontWeight.bold },
  disabled: { opacity: 0.5 },
  codeHint: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    paddingHorizontal: spacing.base,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  bdayCircle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  bdayEmoji: { fontSize: 30, marginRight: spacing.sm },
  bdayMid: { flex: 1 },
  bdayTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  bdaySub: { fontSize: fontSize.xs, color: colors.textSecondary },
  bdayArrow: { fontSize: 22, color: colors.textMuted },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    backgroundColor: colors.divider,
    borderRadius: borderRadius.full,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.full, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surface },
  tabText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.semiBold },
  tabTextActive: { color: colors.primary, fontWeight: fontWeight.bold },
  error: { color: colors.error, fontSize: fontSize.sm, paddingHorizontal: spacing.base, marginBottom: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  emojiBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  emoji: { fontSize: 26 },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary, flexShrink: 1 },
  lock: { fontSize: 12, marginLeft: 4 },
  cardDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },
  openText: { fontSize: 26, color: colors.textMuted, marginLeft: spacing.sm },
  joinBtn: {
    minWidth: 64,
    height: 34,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginLeft: spacing.sm,
  },
  joinBtnText: { color: colors.textInverse, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  spinner: { marginTop: spacing.xxl, marginBottom: spacing.sm },
  nearbyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  nearbyHint: { fontSize: fontSize.xs, color: colors.textSecondary, flex: 1 },
  nearbyLink: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.bold },
  emptyBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  emptyBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  emptyBtnText: { color: colors.textInverse, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  emptyBtnAlt: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
  emptyBtnAltText: { color: colors.primary },
  empty: { alignItems: 'center', padding: spacing.xxl },
  emptyEmoji: { fontSize: 40, color: colors.textMuted, marginBottom: spacing.sm },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.md },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emojiChoice: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiChoiceActive: { borderColor: colors.accent, backgroundColor: colors.surfaceElevated },
  emojiChoiceText: { fontSize: 22 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  inputMulti: { height: 80, textAlignVertical: 'top', paddingTop: spacing.sm },
  visRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.base,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  visTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  visHint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  notice: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    color: '#92400E',
    backgroundColor: '#FFF7E6',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    lineHeight: 16,
  },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.textSecondary, fontWeight: fontWeight.bold },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: colors.textInverse, fontWeight: fontWeight.bold },
}));
