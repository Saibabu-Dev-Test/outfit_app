import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import KeyboardSafeView from '../../components/KeyboardSafeView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { pickImage, AVATAR_PICK } from '../../utils/imagePicker';
import { getUserProfile, saveUserProfile, uploadAvatar } from '../../services/userApi';
import { isValidDob } from '../../utils/age';
import { mdFromDob, mdLabel, setBirthdayListing } from '../../services/birthdayApi';
import { checkNotifications, openNotificationSettings } from '../../native/notifications';
import {
  astroChartStale,
  birthDetailsComplete,
  birthKey,
  birthProfileUpdate,
  jathakamFor,
  StoredAstroChart,
} from '../../services/birthProfile';
import { astroLanguage, birthChartRows } from '../../services/astrologyDaily';
import SelectModal from '../../components/SelectModal';
import { APP_LANGUAGES, setAppLanguage, useAppLanguage } from '../../i18n/appLanguage';
import { getPhotoBg, isPhotoBgSupported, PHOTO_BG_LABEL, PHOTO_BG_MODES, PhotoBgMode, setPhotoBg } from '../../native/photoBackground';
import CityPickerModal from '../../components/CityPickerModal';
import FeedbackBoardModal from '../../components/FeedbackBoardModal';
import ZoomableImage from '../../components/ZoomableImage';
import TimePickerModal from '../../components/TimePickerModal';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles, statusBarStyle, useTheme, ThemeMode } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { copyReferralLink, referralLink, shareMyReferral, shareReferral, shareReferralOnWhatsApp } from '../../utils/referralLink';
import {
  countFriendsJoined,
  joinedWithLinkText,
  ensureReferralCode,
  isWeeklyStar,
  REFERRAL_POINTS,
} from '../../services/rewardsApi';
import { getLockCapability, isAppLockOn, turnOffAppLock, turnOnAppLock } from '../../native/appLock';
import { signOutKeepLock } from '../../services/authApi';
import { auth } from '../../config/firebaseConfig';
import { isAutoUpdateOn, isUpdateSupported, setAutoUpdate } from '../../native/appUpdate';
import { isCoinSoundOn, isCoinSoundSupported, setCoinSound } from '../../native/coinSound';

// "+91 98765 43210" from users/{uid}.phone (10 digits), else the saved phoneNumber
const phoneLabel = (p?: { phone?: string; phoneNumber?: string } | null): string => {
  const d = (p?.phone || '').replace(/\D/g, '');
  if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  return d ? `+${d}` : p?.phoneNumber || '';
};

interface UserProfile {
  id?: string;
  phoneNumber?: string;
  phone?: string; // login key (digits), read-only here
  name?: string;
  dob?: string;
  timeOfBirth?: string;
  placeOfBirth?: string;
  rashi?: string;
  language?: string;
  gender?: string;
  maritalStatus?: string;
  astroChart?: StoredAstroChart | null; // auto: computed from the birth details (services/birthProfile)
  birthConfirmed?: boolean;
  birthConfirmedKey?: string | null;
  bio?: string;
  avatarUrl?: string | null;
  isPublic?: boolean;
  stylePrefs?: string[];
  showBirthday?: boolean; // "Show my birthday" on Home (default off)
  createdAt?: any;
  updatedAt?: any;
}

const LANGUAGES = [
  'Telugu', 'Hindi', 'English', 'Tamil', 'Kannada', 'Malayalam',
  'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Odia', 'Urdu',
];

// Marital status: shapes the astrology relationship lines (married: spouse and family only)
const MARITAL_OPTIONS = ['Single', 'Married', 'Prefer not to say'];

const THEME_LABEL: Record<ThemeMode, string> = { system: 'System', light: 'Light', dark: 'Dark' };

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user: authUser, logout, updateUserData } = useAuth();
  const { mode: themeMode, isDark, setMode: setThemeMode } = useTheme();
  const appLanguage = useAppLanguage();
  const [photoBg, setPhotoBgState] = useState<PhotoBgMode>('plain');
  useEffect(() => {
    getPhotoBg().then(setPhotoBgState);
  }, []);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [editIsPublic, setEditIsPublic] = useState<boolean>(true);
  const [profileData, setProfileData] = useState<UserProfile | null>(authUser);
  const [loading, setLoading] = useState<boolean>(true);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  // App lock (fingerprint): hidden when the phone has no biometrics
  const [lockSupported, setLockSupported] = useState(false);
  const [lockOn, setLockOn] = useState(false);
  const [bdayBusy, setBdayBusy] = useState(false);
  // Automatic updates: user's choice, OFF by default
  const [autoUpdate, setAutoUpdateState] = useState(false);
  useEffect(() => {
    isAutoUpdateOn().then(setAutoUpdateState);
  }, []);
  // Coin sound: plays with each coin flip, ON by default
  const [coinSound, setCoinSoundState] = useState(true);
  useEffect(() => {
    isCoinSoundOn().then(setCoinSoundState);
  }, []);
  const toggleCoinSound = (on: boolean) => {
    setCoinSoundState(on);
    setCoinSound(on);
  };
  const toggleAutoUpdate = (on: boolean) => {
    setAutoUpdateState(on);
    setAutoUpdate(on);
  };
  // Referrals + weekly celebrity badge
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralError, setReferralError] = useState('');
  const [friendsJoined, setFriendsJoined] = useState(0);
  const [isStar, setIsStar] = useState(false);

  // Edit modal states
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editDob, setEditDob] = useState<string>('');
  const [editTimeOfBirth, setEditTimeOfBirth] = useState<string>('');
  const [editPlaceOfBirth, setEditPlaceOfBirth] = useState<string>('');
  const [isPlaceOpen, setIsPlaceOpen] = useState<boolean>(false);
  const [editRashi, setEditRashi] = useState<string>('');
  const [editLanguage, setEditLanguage] = useState<string>('');
  const [editGender, setEditGender] = useState<string>('');
  const [editMarital, setEditMarital] = useState<string>('');
  const [editBio, setEditBio] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);

  // Picker modals
  const [isTimePickerOpen, setIsTimePickerOpen] = useState<boolean>(false);
  const [confirmingBirth, setConfirmingBirth] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState<boolean>(false);

  // Gender dropdown state
  const [isGenderDropdownOpen, setIsGenderDropdownOpen] = useState<boolean>(false);

  // Calendar picker state for DOB
  const [isCalendarVisible, setIsCalendarVisible] = useState<boolean>(false);
  const [calYear, setCalYear] = useState<number>(1998);
  const [calMonth, setCalMonth] = useState<number>(7);
  const [selectedDay, setSelectedDay] = useState<number>(15);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState<boolean>(false);

  const GENDER_OPTIONS = [
    { label: 'Male', icon: '👨', value: 'Male' },
    { label: 'Female', icon: '👩', value: 'Female' },
    { label: 'Other', icon: '🧑', value: 'Other' },
  ];

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const DAY_HEADINGS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const YEAR_LIST = Array.from({ length: 2026 - 1940 + 1 }, (_, i) => 2026 - i);

  const handleOpenCalendar = () => {
    if (editDob) {
      const parts = editDob.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          setCalYear(y);
          setCalMonth(m);
          setSelectedDay(d);
        }
      }
    } else {
      setCalYear(1998);
      setCalMonth(7);
      setSelectedDay(15);
    }
    setIsYearPickerOpen(false);
    setIsCalendarVisible(true);
  };

  const handleConfirmCalendarDate = () => {
    const mm = String(calMonth + 1).padStart(2, '0');
    const dd = String(selectedDay).padStart(2, '0');
    setEditDob(`${calYear}-${mm}-${dd}`);
    setIsCalendarVisible(false);
  };

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(y => y - 1);
    } else {
      setCalMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(y => y + 1);
    } else {
      setCalMonth(m => m + 1);
    }
  };


  // Avatar: compressed base64 data URI saved on users/{uid}.avatarUrl (no Firebase Storage)
  const handlePickAvatar = async (source: 'camera' | 'library') => {
    const uid = authUser?.id;
    if (!uid) {
      Alert.alert('Not signed in', 'Please sign in again to change your photo.');
      return;
    }
    try {
      // Small avatar: it is also copied onto chat messages and posts
      const picked = await pickImage(source, AVATAR_PICK);
      if (!picked) return;
      setUploadingAvatar(true);
      const url = await uploadAvatar(uid, picked.dataUri);
      setProfileData(prev => (prev ? { ...prev, avatarUrl: url } : { id: uid, avatarUrl: url }));
      updateUserData({ avatarUrl: url });
      Alert.alert('Success', 'Profile photo updated!');
    } catch (err: any) {
      console.warn('Avatar upload error:', err?.message);
      Alert.alert('Photo Upload Failed', err?.message || 'Unable to update photo right now.');
    } finally {
      setUploadingAvatar(false);
    }
  };



  const handleSelectAvatarSource = () => {
    Alert.alert(
      'Change Profile Photo',
      'Choose an option to update your profile photo',
      [
        { text: 'Take Photo', onPress: () => handlePickAvatar('camera') },
        { text: 'Choose from Library', onPress: () => handlePickAvatar('library') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };


const fetchProfile = async () => {
  if (!authUser?.id) {
    setLoading(false);
    return;
  }
  try {
    setLoading(true);
    // Load saved profile from Firestore users/{uid}
    const stored = await getUserProfile(authUser.id);
    const merged: UserProfile = {
      id: authUser.id,
      phoneNumber: stored.phoneNumber || authUser.phoneNumber || '',
      phone: stored.phone || '',
      name: stored.name || authUser.name || '',
      avatarUrl: stored.avatarUrl || authUser.avatarUrl || null,
      dob: stored.dob || '',
      timeOfBirth: stored.timeOfBirth || '',
      placeOfBirth: stored.placeOfBirth || '',
      rashi: stored.rashi || '',
      language: stored.language || '',
      gender: stored.gender || '',
      maritalStatus: stored.maritalStatus || '',
      astroChart: stored.astroChart || null,
      birthConfirmed: stored.birthConfirmed === true,
      birthConfirmedKey: stored.birthConfirmedKey || null,
      bio: stored.bio || '',
      isPublic: stored.isPublic !== false,
      stylePrefs: Array.isArray(stored.stylePrefs) ? stored.stylePrefs : [],
      showBirthday: stored.showBirthday === true,
    };
    setIsAdmin(stored.role === 'admin');
    // Birth chart saved for other details (or before this screen computed it): recompute and save
    if (astroChartStale(merged, merged.astroChart)) {
      const upd = birthProfileUpdate(merged, { prevConfirmedKey: merged.birthConfirmedKey });
      Object.assign(merged, upd);
      saveUserProfile(authUser.id, upd).catch(e => console.warn('Birth chart save failed:', e?.message));
    }
    setProfileData(merged);
    updateUserData(merged as any);
  } catch (err: any) {
    console.warn('Fetch Profile Error:', err?.message);
  } finally {
    setLoading(false);
  }
};

  // ✅ ONLY ONE useEffect (removed duplicate)
  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  // Me > Edit profile opens the edit form directly
  useEffect(() => {
    if (route?.params?.edit && !loading) {
      handleOpenEditModal();
      navigation.setParams({ edit: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.edit, loading]);

  useEffect(() => {
    checkNotifications().then(s => setNotifEnabled(s === 'on'));
  }, []);

  const pickTheme = () =>
    Alert.alert('Dark mode', `Now: ${THEME_LABEL[themeMode]}${themeMode === 'system' ? (isDark ? ' (dark)' : ' (light)') : ''}`, [
      { text: 'Follow system', onPress: () => setThemeMode('system') },
      { text: 'Light', onPress: () => setThemeMode('light') },
      { text: 'Dark', onPress: () => setThemeMode('dark') },
    ]);

  const pickAppLanguage = () =>
    Alert.alert('App language', `Wardrobe labels show in: ${appLanguage}`, [
      ...APP_LANGUAGES.map(l => ({ text: l, onPress: () => setAppLanguage(l) })),
    ]);

  const pickPhotoBg = () =>
    Alert.alert('Photo background', 'For clothing photos you add: plain white / black (opposite to the clothes) or a blurred background.', [
      ...PHOTO_BG_MODES.map(m => ({
        text: PHOTO_BG_LABEL[m],
        onPress: () => {
          setPhotoBgState(m);
          setPhotoBg(m);
        },
      })),
    ]);

  // App lock, invite code, friends joined, ⭐ badge
  useEffect(() => {
    const uid = authUser?.id;
    let alive = true;
    (async () => {
      // Optional app lock (off by default): switch shown on Android when the phone can be locked
      const cap = await getLockCapability();
      const supported = Platform.OS === 'android' && cap !== 'unsupported';
      const on = await isAppLockOn();
      if (alive) {
        setLockSupported(supported);
        setLockOn(on);
      }
      if (!uid) return;
      isWeeklyStar(uid).then(v => alive && setIsStar(v));
      countFriendsJoined(uid).then(n => alive && setFriendsJoined(n));
      try {
        const code = await ensureReferralCode(uid);
        if (alive) setReferralCode(code);
      } catch (e: any) {
        if (alive) setReferralError(e?.message || 'Could not load your invite code');
      }
    })();
    return () => {
      alive = false;
    };
  }, [authUser?.id]);

  // App lock switch. ON: fingerprint (session encrypted) or, without one, the phone's screen lock.
  // OFF: one fingerprint / screen-lock check, then the app opens straight in again.
  const [lockBusy, setLockBusy] = useState(false);
  // "Show my birthday": day + month on friends' Home (never the year / age). Default off.
  const handleToggleBirthday = async (value: boolean) => {
    const uid = profileData?.id || authUser?.id;
    if (!uid || bdayBusy) return;
    if (value && !mdFromDob(profileData?.dob)) {
      Alert.alert('Add your date of birth', 'Add your date of birth in Edit profile first, then turn this on.');
      return;
    }
    setBdayBusy(true);
    try {
      await setBirthdayListing(uid, value, { dob: profileData?.dob, name: profileData?.name, avatar: profileData?.avatarUrl });
      setProfileData(prev => (prev ? { ...prev, showBirthday: value } : prev));
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setBdayBusy(false);
    }
  };

  const handleToggleLock = async (value: boolean) => {
    if (lockBusy) return;
    setLockBusy(true);
    try {
      const r = value ? await turnOnAppLock(authUser?.id) : await turnOffAppLock(authUser?.id);
      if (r.ok) {
        setLockOn(value);
        return;
      }
      if (r.message) Alert.alert('App lock', r.message);
      if (r.invalidated) await signOutKeepLock();
    } finally {
      setLockBusy(false);
    }
  };

  const handleShareInvite = () => {
    if (referralCode) shareReferral(referralCode);
    else shareMyReferral(authUser?.id); // waits for (or creates) the code
  };

  // ✅ ONLY ONE handleOpenEditModal (removed duplicate)
  const handleOpenEditModal = () => {
    setEditName(profileData?.name || '');
    setEditDob(profileData?.dob || '');
    setEditTimeOfBirth(profileData?.timeOfBirth || '');
    setEditPlaceOfBirth(profileData?.placeOfBirth || '');
    setEditRashi(profileData?.rashi || '');
    setEditLanguage(profileData?.language || '');
    setEditGender(profileData?.gender || '');
    setEditMarital(profileData?.maritalStatus || '');
    setEditBio(profileData?.bio || '');
    setEditIsPublic(profileData?.isPublic !== false);
    setIsGenderDropdownOpen(false);
    setIsEditModalVisible(true);
  };

 const handleSaveProfile = async () => {
  const uid = profileData?.id || authUser?.id;
  if (!uid) {
    Alert.alert('Not signed in', 'Please sign in again to save your profile.');
    return;
  }

  if (!editGender.trim()) {
    Alert.alert('Gender required', 'Please select your gender. It is needed for outfit and astrology suggestions.');
    return;
  }

  if (!isValidDob(editDob)) {
    Alert.alert('Date of birth required', 'Please select your date of birth. Your age is shown beside your name.');
    return;
  }

  const updatedProfile: UserProfile = {
    id: uid,
    name: editName.trim(),
    phoneNumber: profileData?.phoneNumber,
    phone: profileData?.phone,
    dob: editDob.trim(),
    timeOfBirth: editTimeOfBirth.trim(),
    placeOfBirth: editPlaceOfBirth.trim(),
    rashi: editRashi.trim(),
    language: editLanguage.trim(),
    gender: editGender.trim(),
    maritalStatus: editMarital,
    bio: editBio.trim(),
    avatarUrl: profileData?.avatarUrl || null,
    isPublic: editIsPublic,
    stylePrefs: profileData?.stylePrefs || [],
  };

  // Rashi, nakshatra, Lagna, dasha... are worked out from the birth details (no manual entry).
  // Changing the details clears the "confirmed" tick until the user confirms them again.
  const birth = birthProfileUpdate(updatedProfile, { prevConfirmedKey: profileData?.birthConfirmedKey });
  Object.assign(updatedProfile, birth);

  try {
    setSavingProfile(true);
    // Merge into Firestore users/{uid} (avatar is saved separately)
    await saveUserProfile(uid, {
      ...birth,
      name: updatedProfile.name,
      dob: updatedProfile.dob,
      timeOfBirth: updatedProfile.timeOfBirth,
      placeOfBirth: updatedProfile.placeOfBirth,
      rashi: updatedProfile.rashi,
      language: updatedProfile.language,
      gender: updatedProfile.gender,
      maritalStatus: updatedProfile.maritalStatus,
      bio: updatedProfile.bio,
      isPublic: updatedProfile.isPublic,
    });
    // Keep the birthday listing in step with the new name / date of birth (off if no date)
    updatedProfile.showBirthday = profileData?.showBirthday === true;
    if (updatedProfile.showBirthday) {
      const keep = !!mdFromDob(updatedProfile.dob);
      updatedProfile.showBirthday = keep;
      setBirthdayListing(uid, keep, { dob: updatedProfile.dob, name: updatedProfile.name, avatar: updatedProfile.avatarUrl }).catch(e =>
        console.warn('Birthday listing update failed:', e?.message),
      );
    }
    setProfileData(updatedProfile);
    updateUserData(updatedProfile as any);
    setIsEditModalVisible(false);
    Alert.alert('Success', 'Profile saved!');
  } catch (error: any) {
    console.warn('Save Profile Error:', error?.message);
    Alert.alert('Update Failed', error?.message || 'Unable to update profile right now.');
  } finally {
    setSavingProfile(false);
  }
};

  // "Confirm birth details": the user checks name / date / time / place and ticks them
  const handleConfirmBirth = async () => {
    const uid = profileData?.id || authUser?.id;
    if (!uid || !profileData || confirmingBirth) return;
    if (!birthDetailsComplete(profileData)) {
      Alert.alert('Add your birth details', 'Please add your name, date of birth and place of birth (time of birth is optional), then confirm.');
      handleOpenEditModal();
      return;
    }
    const upd = birthProfileUpdate(profileData, { confirm: true });
    try {
      setConfirmingBirth(true);
      await saveUserProfile(uid, upd);
      const next = { ...profileData, ...upd };
      setProfileData(next);
      updateUserData(next as any);
    } catch (e: any) {
      Alert.alert('Could not confirm', e?.message || 'Please try again.');
    } finally {
      setConfirmingBirth(false);
    }
  };

  // Birth chart rows in the reading language (English under them), computed live on the phone
  const chartLang = astroLanguage(profileData?.language);
  const jathakam = profileData?.dob ? jathakamFor(profileData) : null;
  const chartRows = jathakam ? birthChartRows(jathakam, chartLang) : [];
  const chartRowsEn = jathakam && chartLang !== 'English' ? birthChartRows(jathakam, 'English') : null;
  const birthOk = !!profileData?.birthConfirmed && profileData?.birthConfirmedKey === birthKey(profileData || {});

  const handleSignOut = async () => {
    try {
      setLoggingOut(true);
      await logout();
    } catch (error: any) {
      Alert.alert('Sign Out Failed', error?.message || 'Unable to sign out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.flexTitle]}>Settings</Text>
          <TouchableOpacity
            style={[styles.editBtn, styles.inviteHeaderBtn, !referralCode && styles.inviteShareOff]}
            onPress={handleShareInvite}
            disabled={!referralCode}
            accessibilityLabel="Invite friends to download the app"
            activeOpacity={0.7}>
            <Text style={styles.editBtnText}>🎁 Invite</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} onPress={handleOpenEditModal} activeOpacity={0.7}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Main Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileGradient}>
            {/* Tap the photo to view it full screen (zoom); the 📷 badge changes it */}
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={profileData?.avatarUrl ? () => setAvatarViewerOpen(true) : handleSelectAvatarSource}
              onLongPress={handleSelectAvatarSource}
              disabled={uploadingAvatar}
              activeOpacity={0.8}>
              <View style={styles.avatar}>
                {profileData?.avatarUrl ? (
                  <Image
                    source={{ uri: profileData.avatarUrl }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.avatarText}>👤</Text>
                )}
                {uploadingAvatar && (
                  <View style={styles.avatarLoadingOverlay}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.cameraBadge}
                onPress={handleSelectAvatarSource}
                disabled={uploadingAvatar}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.cameraIconText}>📷</Text>
              </TouchableOpacity>
            </TouchableOpacity>
            {profileData?.avatarUrl ? (
              <ZoomableImage
                visible={avatarViewerOpen}
                images={[profileData.avatarUrl]}
                onClose={() => setAvatarViewerOpen(false)}
              />
            ) : null}


            {loading && !profileData ? (
              <ActivityIndicator color="#FFFFFF" style={{ marginVertical: spacing.sm }} />
            ) : (
              <>
                <Text style={styles.profileName}>
                  {profileData?.name ? profileData.name : 'Set Your Name'}
                  {isStar ? ' ⭐' : ''}
                </Text>
                {isStar && <Text style={styles.starBadgeText}>Weekly celebrity</Text>}
                
                {Boolean(profileData?.bio) && (
                  <Text style={styles.profileBio}>{profileData?.bio}</Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* Account: which Gmail this app is signed in with */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Account</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>✉️ Signed in with Google</Text>
                <Text style={styles.infoValue} numberOfLines={1} selectable>
                  {authUser?.email || auth.currentUser?.email || 'Unknown'}
                </Text>
              </View>
            </View>
            {authUser?.phoneNumber ? (
              <>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>📱 Mobile number</Text>
                    <Text style={styles.infoValue}>{authUser.phoneNumber}</Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* Birth details: shown and confirmable; the chart below is worked out from them */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Birth details</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>🙂 Name</Text>
                <Text style={styles.infoValue}>{profileData?.name ? profileData.name : 'Not specified'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>🎂 Date of Birth</Text>
                <Text style={styles.infoValue}>
                  {profileData?.dob ? profileData.dob : 'Not specified'}
                </Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>⏰ Time of Birth</Text>
                <Text style={styles.infoValue}>
                  {profileData?.timeOfBirth ? profileData.timeOfBirth : 'Not known (optional)'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>📍 Place of Birth</Text>
                <Text style={styles.infoValue}>
                  {profileData?.placeOfBirth ? profileData.placeOfBirth : 'Not specified'}
                </Text>
              </View>
            </View>
          </View>

          {birthOk ? (
            <View style={styles.confirmedRow}>
              <Text style={styles.confirmedTick}>✓</Text>
              <Text style={styles.confirmedText}>Birth details confirmed</Text>
              <TouchableOpacity onPress={handleOpenEditModal} activeOpacity={0.8}>
                <Text style={styles.confirmEdit}>Edit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.confirmBtn, confirmingBirth && styles.confirmBtnBusy]}
              onPress={handleConfirmBirth}
              disabled={confirmingBirth}
              activeOpacity={0.85}>
              {confirmingBirth ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm birth details</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Birth chart: auto-filled from the birth details (offline engine), no manual entry */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>🪐 Birth chart (auto)</Text>
          {chartRows.length ? (
            <View style={styles.infoGrid}>
              {chartRows.map((row, i) => (
                <View key={row.key} style={styles.chartRow}>
                  <Text style={styles.chartLabel}>
                    {row.label}
                    {chartRowsEn && chartRowsEn[i] && chartRowsEn[i].label !== row.label ? `\n${chartRowsEn[i].label}` : ''}
                  </Text>
                  <Text style={styles.chartValue}>
                    {row.value}
                    {chartRowsEn && chartRowsEn[i] && chartRowsEn[i].value !== row.value ? `\n${chartRowsEn[i].value}` : ''}
                  </Text>
                </View>
              ))}
              {!jathakam?.timeKnown ? (
                <Text style={styles.chartHint}>Add your time of birth for your Lagna and an exact nakshatra pada.</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.chartHint}>
              Add your date of birth (and time and place, if you know them): your rashi, nakshatra, tithi, Lagna, gana,
              yoni, nadi, Mahadasha and numbers fill in automatically.
            </Text>
          )}
        </View>

        {/* Personal Details Section */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Personal Information</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>🗣️ Language</Text>
                <Text style={styles.infoValue}>
                  {profileData?.language ? profileData.language : 'Not specified'}
                </Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>👤 Gender</Text>
                <Text style={styles.infoValue}>
                  {profileData?.gender ? profileData.gender : 'Not specified'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>💍 Marital status</Text>
                <Text style={styles.infoValue}>
                  {profileData?.maritalStatus ? profileData.maritalStatus : 'Not specified'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Admin (Feed, Find people and my public profile are reached from the Feed tab) */}
        {isAdmin && (
          <View style={styles.menuSection}>
            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => navigation.navigate('Admin')}>
              <View style={styles.menuLeft}>
                <View style={styles.menuIconBox}>
                  <Text style={styles.menuIcon}>🛡️</Text>
                </View>
                <Text style={styles.menuLabel}>Admin</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Invite friends */}
        <View style={styles.menuSection}>
          <View style={styles.inviteBox}>
            <Text style={styles.inviteTitle}>🎁 Invite friends</Text>
            <Text style={styles.inviteSub}>
              Share your link. Friends who sign up with it count as yours. {REFERRAL_POINTS} points per friend.
            </Text>
            <View style={styles.inviteRow}>
              <Text style={styles.inviteCode} selectable>
                {referralCode || (referralError ? '------' : '…')}
              </Text>
              <TouchableOpacity
                style={[styles.inviteShare, !referralCode && styles.inviteShareOff]}
                onPress={handleShareInvite}
                activeOpacity={0.8}>
                <Text style={styles.inviteShareText}>Share</Text>
              </TouchableOpacity>
            </View>
            {!!referralCode && (
              <>
                <Text style={styles.inviteLink} selectable numberOfLines={1}>
                  {referralLink(referralCode)}
                </Text>
                <View style={styles.inviteRow}>
                  <TouchableOpacity
                    style={[styles.inviteShare, styles.inviteWhatsApp]}
                    onPress={() => shareReferralOnWhatsApp(referralCode)}
                    activeOpacity={0.8}>
                    <Text style={styles.inviteShareText}>WhatsApp</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.inviteShare, styles.inviteCopy]}
                    onPress={() => copyReferralLink(referralCode)}
                    activeOpacity={0.8}>
                    <Text style={styles.inviteCopyText}>Copy link</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {!!referralError && <Text style={styles.inviteError}>{referralError}</Text>}
            <Text style={styles.inviteFriends}>👥 {joinedWithLinkText(friendsJoined)}</Text>
          </View>
        </View>

        {/* Show my birthday: opt-in, off by default (day + month only) */}
        <View style={styles.menuSection}>
          <View style={styles.menuItem}>
            <View style={[styles.menuLeft, styles.flexTitle]}>
              <View style={styles.menuIconBox}>
                <Text style={styles.menuIcon}>🎂</Text>
              </View>
              <View style={styles.flexTitle}>
                <Text style={styles.menuLabel}>Show my birthday</Text>
                <Text style={styles.lockValue}>
                  {profileData?.showBirthday
                    ? `On: others see ${mdFromDob(profileData?.dob) ? mdLabel(mdFromDob(profileData?.dob) as string) : 'your birthday'} on Home and can send wishes (never the year)`
                    : 'Off: your birthday stays private'}
                </Text>
              </View>
            </View>
            <Switch
              value={profileData?.showBirthday === true}
              onValueChange={handleToggleBirthday}
              disabled={bdayBusy}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.textInverse}
            />
          </View>
        </View>

        {/* App lock: optional, off by default */}
        {lockSupported && (
          <View style={styles.menuSection}>
            <View style={styles.menuItem}>
              <View style={[styles.menuLeft, styles.flexTitle]}>
                <View style={styles.menuIconBox}>
                  <Text style={styles.menuIcon}>🔒</Text>
                </View>
                <View style={styles.flexTitle}>
                  <Text style={styles.menuLabel}>Unlock with fingerprint</Text>
                  <Text style={styles.lockValue}>
                    {lockOn ? 'On: asks for your fingerprint when Outfit opens' : 'Off: Outfit opens straight in'}
                  </Text>
                </View>
              </View>
              <Switch
                value={lockOn}
                onValueChange={handleToggleLock}
                disabled={lockBusy}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.textInverse}
              />
            </View>
          </View>
        )}

        {/* Coin sound: on by default */}
        {isCoinSoundSupported() && (
          <View style={styles.menuSection}>
            <View style={styles.menuItem}>
              <View style={[styles.menuLeft, styles.flexTitle]}>
                <View style={styles.menuIconBox}>
                  <Text style={styles.menuIcon}>🪙</Text>
                </View>
                <View style={styles.flexTitle}>
                  <Text style={styles.menuLabel}>Coin sound</Text>
                  <Text style={styles.lockValue}>
                    {coinSound ? 'On: a short ding when you earn coins (follows media volume)' : 'Off: coin flips are silent'}
                  </Text>
                </View>
              </View>
              <Switch
                value={coinSound}
                onValueChange={toggleCoinSound}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.textInverse}
              />
            </View>
          </View>
        )}

        {/* Menu Section */}
        <View style={styles.menuSection}>
          {[
            { id: 'ach', icon: '🏆', label: 'Achievements', onPress: () => navigation.navigate('Achievements') },
            {
              id: 'notif',
              icon: '🔔',
              label: 'Notifications',
              value: notifEnabled ? 'On' : 'Off',
              onPress: () => openNotificationSettings(),
            },
            {
              id: 'dark',
              icon: '🌙',
              label: 'Dark mode',
              value: THEME_LABEL[themeMode],
              onPress: pickTheme,
            },
            {
              id: 'applang',
              icon: '🌐',
              label: 'App language',
              value: appLanguage,
              onPress: pickAppLanguage,
            },
            ...(isPhotoBgSupported()
              ? [
                  {
                    id: 'photobg',
                    icon: '🖼️',
                    label: 'Photo background',
                    value: PHOTO_BG_LABEL[photoBg],
                    onPress: pickPhotoBg,
                  },
                ]
              : []),
            ...(isUpdateSupported()
              ? [
                  {
                    id: 'updates',
                    icon: '🔄',
                    label: 'Automatic updates',
                    value: autoUpdate ? 'On: tells you when a new version is ready' : 'Off',
                    onPress: () => toggleAutoUpdate(!autoUpdate),
                  },
                ]
              : []),
            {
              id: 'feedback',
              icon: '💌',
              label: 'Feedback & Suggestions',
              value: 'Board: share ideas, like, reply and quote',
              onPress: () => setFeedbackOpen(true),
            },
            { id: 'help', icon: '❓', label: 'Help & Support' },
            { id: 'terms', icon: '📋', label: 'Terms & Conditions' },
          ].map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={item.onPress}
              disabled={!item.onPress}
              activeOpacity={0.7}>
              <View style={[styles.menuLeft, styles.flexTitle]}>
                <View style={styles.menuIconBox}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                </View>
                <View style={styles.flexTitle}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  {item.value ? (
                    <Text style={styles.menuValue} numberOfLines={1}>
                      {item.value}
                    </Text>
                  ) : null}
                </View>
              </View>
              {item.id === 'dark' ? (
                <Switch
                  value={isDark}
                  onValueChange={v => setThemeMode(v ? 'dark' : 'light')}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.textInverse}
                />
              ) : item.id === 'updates' ? (
                <Switch
                  value={autoUpdate}
                  onValueChange={toggleAutoUpdate}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.textInverse}
                />
              ) : (
                <Text style={styles.menuArrow}>›</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={[styles.signOutBtn, loggingOut && { opacity: 0.7 }]}
          onPress={handleSignOut}
          disabled={loggingOut}
          activeOpacity={0.8}>
          {loggingOut ? (
            <ActivityIndicator color={colors.error} size="small" />
          ) : (
            <Text style={styles.signOutText}>Sign Out</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.version}>Outfit v1.0.0</Text>
      </ScrollView>

      <FeedbackBoardModal
        visible={feedbackOpen}
        uid={authUser?.id}
        name={profileData?.name || authUser?.name}
        onClose={() => setFeedbackOpen(false)}
      />

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalVisible(false)}>
        {/* Sheet bottom sits right on the keyboard (KeyboardSafeView) */}
        <KeyboardSafeView style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.backdropPressable}
            activeOpacity={1}
            onPress={() => setIsEditModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile Details</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Profile Photo Section */}
              <View style={styles.modalAvatarSection}>
                <TouchableOpacity
                  style={styles.modalAvatarContainer}
                  onPress={handleSelectAvatarSource}
                  disabled={uploadingAvatar}
                  activeOpacity={0.8}>
                  <View style={styles.modalAvatar}>
                    {profileData?.avatarUrl ? (
                      <Image
                        source={{ uri: profileData.avatarUrl }}
                        style={styles.modalAvatarImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.modalAvatarText}>👤</Text>
                    )}
                    {uploadingAvatar && (
                      <View style={styles.avatarLoadingOverlay}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalChangePhotoBtn}
                  onPress={handleSelectAvatarSource}
                  disabled={uploadingAvatar}>
                  <Text style={styles.modalChangePhotoText}>📷 Upload Profile Photo</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>

                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter your full name"
                  placeholderTextColor="#9E9EBA"
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                {/* Read-only: login depends on this number */}
                <View style={[styles.modalInputTouchable, styles.readOnlyInput]}>
                  <Text style={styles.modalInputValueText}>
                    {phoneLabel(profileData) || 'Not set'}
                  </Text>
                  <Text style={styles.inputCalendarIcon}>🔒</Text>
                </View>
                <Text style={styles.readOnlyHint}>Used to sign in, so it can't be changed here.</Text>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Date of Birth</Text>
                  <TouchableOpacity
                    style={styles.modalInputTouchable}
                    onPress={handleOpenCalendar}
                    activeOpacity={0.85}>
                    <Text style={editDob ? styles.modalInputValueText : styles.modalInputPlaceholderText}>
                      {editDob || 'Select DOB'}
                    </Text>
                    <Text style={styles.inputCalendarIcon}>📅</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Time of Birth</Text>
                  <TouchableOpacity
                    style={styles.modalInputTouchable}
                    onPress={() => setIsTimePickerOpen(true)}
                    activeOpacity={0.85}>
                    <Text style={editTimeOfBirth ? styles.modalInputValueText : styles.modalInputPlaceholderText}>
                      {editTimeOfBirth || 'Select time'}
                    </Text>
                    <Text style={styles.inputCalendarIcon}>⏰</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Place of Birth</Text>
                <TouchableOpacity
                  style={styles.modalInputTouchable}
                  onPress={() => setIsPlaceOpen(true)}
                  activeOpacity={0.85}>
                  <Text
                    numberOfLines={1}
                    style={[editPlaceOfBirth ? styles.modalInputValueText : styles.modalInputPlaceholderText, styles.flexShrink]}>
                    {editPlaceOfBirth || 'Select city (for your birth chart)'}
                  </Text>
                  <Text style={styles.inputCalendarIcon}>📍</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.autoNote}>
                Rashi, nakshatra, Lagna and the rest of your birth chart are worked out from these details automatically.
              </Text>

              <View style={styles.formRow}>
                <View style={[styles.inputGroup, styles.flexOne]}>
                  <Text style={styles.inputLabel}>Language</Text>
                  <TouchableOpacity
                    style={styles.modalInputTouchable}
                    onPress={() => setIsLanguageOpen(true)}
                    activeOpacity={0.85}>
                    <Text
                      numberOfLines={1}
                      style={[editLanguage ? styles.modalInputValueText : styles.modalInputPlaceholderText, styles.flexShrink]}>
                      {editLanguage || 'Select Language'}
                    </Text>
                    <Text style={styles.dropdownArrowIcon}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Gender *</Text>
                <TouchableOpacity
                  style={styles.modalInputTouchable}
                  onPress={() => setIsGenderDropdownOpen(o => !o)}
                  activeOpacity={0.85}>
                  <Text style={editGender ? styles.modalInputValueText : styles.modalInputPlaceholderText}>
                    {editGender
                      ? (() => {
                          const matched = GENDER_OPTIONS.find(
                            g => g.value.toLowerCase() === editGender.toLowerCase()
                          );
                          return matched ? `${matched.icon}  ${matched.label}` : editGender;
                        })()
                      : 'Select Gender'}
                  </Text>
                  <Text style={styles.dropdownArrowIcon}>{isGenderDropdownOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {isGenderDropdownOpen && (
                  <View style={styles.genderDropdownMenu}>
                    {GENDER_OPTIONS.map(opt => {
                      const isActive = editGender?.toLowerCase() === opt.value.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.genderOptionItem, isActive && styles.genderOptionActive]}
                          onPress={() => {
                            setEditGender(opt.value);
                            setIsGenderDropdownOpen(false);
                          }}
                          activeOpacity={0.8}>
                          <Text style={[styles.genderOptionText, isActive && styles.genderOptionTextActive]}>
                            {opt.icon}   {opt.label}
                          </Text>
                          {isActive && <Text style={styles.genderOptionCheck}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Marital status</Text>
                <View style={styles.chipRow}>
                  {MARITAL_OPTIONS.map(m => {
                    const on = editMarital === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => setEditMarital(on ? '' : m)}
                        activeOpacity={0.8}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{m}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput
                  style={[styles.modalInput, styles.bioInput]}
                  placeholder="Tell us about your style preference..."
                  placeholderTextColor="#9E9EBA"
                  multiline
                  numberOfLines={3}
                  value={editBio}
                  onChangeText={setEditBio}
                />
              </View>

              <View style={styles.publicRow}>
                <View style={styles.flexShrink}>
                  <Text style={styles.publicTitle}>Public profile</Text>
                  <Text style={styles.publicHint}>
                    {editIsPublic
                      ? 'Anyone signed in can see your profile, posts and public wardrobe items.'
                      : 'Others see "This profile is private".'}
                  </Text>
                </View>
                <Switch
                  value={editIsPublic}
                  onValueChange={setEditIsPublic}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.textInverse}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsEditModalVisible(false)}
                disabled={savingProfile}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, savingProfile && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}>
                {savingProfile ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Details</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardSafeView>
      </Modal>

      {/* Calendar Picker Modal */}
      <Modal
        visible={isCalendarVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsCalendarVisible(false)}>
        <View style={styles.calendarOverlay}>
          <TouchableOpacity
            style={styles.backdropPressable}
            activeOpacity={1}
            onPress={() => setIsCalendarVisible(false)}
          />
          <View style={styles.calendarCard}>
            {/* Header */}
            <View style={styles.calendarCardHeader}>
              <Text style={styles.calendarCardSub}>SELECT DATE OF BIRTH</Text>
              <Text style={styles.calendarCardTitle}>
                {MONTH_NAMES[calMonth]} {selectedDay}, {calYear}
              </Text>
            </View>

            {/* Navigation Bar */}
            <View style={styles.monthYearBar}>
              <TouchableOpacity style={styles.calNavBtn} onPress={handlePrevMonth}>
                <Text style={styles.calNavText}>◀</Text>
              </TouchableOpacity>

              <View style={styles.monthYearLabelRow}>
                <Text style={styles.monthYearText}>{MONTH_NAMES[calMonth]}</Text>
                <TouchableOpacity
                  style={styles.yearSelectChip}
                  onPress={() => setIsYearPickerOpen(o => !o)}
                  activeOpacity={0.8}>
                  <Text style={styles.yearSelectText}>{calYear} {isYearPickerOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.calNavBtn} onPress={handleNextMonth}>
                <Text style={styles.calNavText}>▶</Text>
              </TouchableOpacity>
            </View>

            {isYearPickerOpen ? (
              <ScrollView style={styles.yearListScroll} contentContainerStyle={styles.yearListGrid} showsVerticalScrollIndicator={true}>
                {YEAR_LIST.map(y => (
                  <TouchableOpacity
                    key={y}
                    style={[styles.yearItem, y === calYear && styles.yearItemActive]}
                    onPress={() => {
                      setCalYear(y);
                      setIsYearPickerOpen(false);
                    }}>
                    <Text style={[styles.yearItemText, y === calYear && styles.yearItemTextActive]}>
                      {y}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <>
                {/* Days of Week */}
                <View style={styles.dayHeadingsRow}>
                  {DAY_HEADINGS.map(dh => (
                    <Text key={dh} style={styles.dayHeadingText}>{dh}</Text>
                  ))}
                </View>

                {/* Day Grid */}
                <View style={styles.daysGrid}>
                  {Array.from({ length: new Date(calYear, calMonth, 1).getDay() }).map((_, i) => (
                    <View key={`blank-${i}`} style={styles.dayCellEmpty} />
                  ))}
                  {Array.from({ length: new Date(calYear, calMonth + 1, 0).getDate() }).map((_, i) => {
                    const dayNum = i + 1;
                    const isSelected = dayNum === selectedDay;
                    return (
                      <TouchableOpacity
                        key={`day-${dayNum}`}
                        style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                        onPress={() => setSelectedDay(dayNum)}
                        activeOpacity={0.7}>
                        <Text style={[styles.dayCellText, isSelected && styles.dayCellTextSelected]}>
                          {dayNum}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Calendar Actions */}
            <View style={styles.calendarActions}>
              <TouchableOpacity
                style={styles.calCancelBtn}
                onPress={() => setIsCalendarVisible(false)}>
                <Text style={styles.calCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.calConfirmBtn}
                onPress={handleConfirmCalendarDate}>
                <Text style={styles.calConfirmText}>Set Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CityPickerModal
        visible={isPlaceOpen}
        selected={editPlaceOfBirth}
        onSelect={setEditPlaceOfBirth}
        onClose={() => setIsPlaceOpen(false)}
      />
      <TimePickerModal
        visible={isTimePickerOpen}
        value={editTimeOfBirth}
        onConfirm={setEditTimeOfBirth}
        onClose={() => setIsTimePickerOpen(false)}
      />
      <SelectModal
        visible={isLanguageOpen}
        title="Select Language"
        options={LANGUAGES}
        selected={editLanguage}
        onSelect={setEditLanguage}
        onClose={() => setIsLanguageOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backArrow: { fontSize: 34, color: colors.primary, marginRight: spacing.sm, lineHeight: 36 },
  flexTitle: { flex: 1 },
  menuValue: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },
  flexShrink: { flexShrink: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  flexOne: { flex: 1 },
  autoNote: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 16 },
  confirmedRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  confirmedTick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.success,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: fontWeight.extraBold,
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  confirmedText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  confirmEdit: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.bold },
  confirmBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  confirmBtnBusy: { opacity: 0.7 },
  confirmBtnText: { color: colors.textInverse, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  chartLabel: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: fontWeight.bold, marginRight: spacing.sm },
  chartValue: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: fontWeight.semiBold, flexShrink: 1, textAlign: 'right' },
  chartHint: { fontSize: fontSize.xs, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm, lineHeight: 16 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.surface },
  chipText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.semiBold },
  chipTextOn: { color: colors.primary, fontWeight: fontWeight.bold },
  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  publicTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  publicHint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
  },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.extraBold, color: colors.textPrimary, letterSpacing: -0.5 },
  inviteHeaderBtn: { marginRight: spacing.sm },
  editBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
  },
  editBtnText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  profileCard: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 5,
  },
  profileGradient: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.base,
  },
  avatarContainer: { position: 'relative', marginBottom: spacing.md },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  avatarText: { fontSize: 40 },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  cameraIconText: { fontSize: 13 },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  verifiedText: { color: colors.textInverse, fontSize: 11, fontWeight: fontWeight.bold },
  modalAvatarSection: {
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  modalAvatarContainer: {
    marginBottom: spacing.xs,
  },
  modalAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalAvatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  modalAvatarText: { fontSize: 36 },
  modalChangePhotoBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalChangePhotoText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },

  profileName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textInverse, marginBottom: 2 },
  profileHandle: { fontSize: fontSize.sm, color: colors.accentLight, marginBottom: spacing.xs },
  profileBio: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.85)', textAlign: 'center', paddingHorizontal: spacing.md, marginTop: 2 },
  // Details Card
  detailsCard: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.base,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  detailsTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  infoGrid: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.md,
  },
  starBadgeText: { fontSize: fontSize.xs, color: '#FFE082', fontWeight: fontWeight.bold, marginBottom: 2 },
  inviteBox: { padding: spacing.base },
  inviteTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  inviteSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4, lineHeight: 17 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  inviteCode: {
    flex: 1,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: 4,
  },
  inviteShare: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  inviteShareOff: { opacity: 0.5 },
  inviteLink: { fontSize: fontSize.xs, color: colors.primary, marginTop: spacing.sm },
  inviteWhatsApp: { backgroundColor: '#25D366', marginRight: spacing.sm },
  inviteCopy: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  inviteCopyText: { color: colors.textPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  inviteShareText: { color: colors.textInverse, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  inviteError: { fontSize: fontSize.xs, color: colors.error, marginTop: 6 },
  inviteFriends: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.sm, fontWeight: fontWeight.medium },
  menuSection: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginBottom: spacing.base,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { fontSize: 18 },
  menuLabel: { fontSize: fontSize.base, color: colors.textPrimary, fontWeight: fontWeight.medium },
  lockValue: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.semiBold },
  menuArrow: { fontSize: 22, color: colors.textMuted, fontWeight: fontWeight.regular },
  signOutBtn: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.base,
    padding: spacing.base,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  signOutText: { color: colors.error, fontWeight: fontWeight.bold, fontSize: fontSize.base },
  version: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginBottom: spacing.base,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 64, 0.6)',
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  modalCloseIcon: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: fontWeight.bold,
    padding: spacing.xs,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  bioInput: {
    height: 70,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.base,
  },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnText: {
    color: colors.textInverse,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.base,
  },
  // Touchable input & Dropdown styles
  modalInputTouchable: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readOnlyInput: { backgroundColor: colors.divider, opacity: 0.85 },
  readOnlyHint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },
  modalInputValueText: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  modalInputPlaceholderText: {
    fontSize: fontSize.base,
    color: '#9E9EBA',
    fontWeight: fontWeight.regular,
  },
  inputCalendarIcon: {
    fontSize: 18,
  },
  dropdownArrowIcon: {
    fontSize: 12,
    color: colors.textMuted,
  },
  genderDropdownMenu: {
    marginTop: 6,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  genderOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  genderOptionActive: {
    backgroundColor: '#F0F7FF',
  },
  genderOptionText: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  genderOptionTextActive: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  genderOptionCheck: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
    fontSize: 16,
  },

  // Calendar Modal styles
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 64, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  calendarCard: {
    width: '92%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  calendarCardHeader: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  calendarCardSub: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  calendarCardTitle: {
    fontSize: fontSize.lg,
    color: '#FFFFFF',
    fontWeight: fontWeight.bold,
    marginTop: 2,
  },
  monthYearBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  calNavBtn: {
    padding: spacing.xs + 2,
  },
  calNavText: {
    fontSize: 16,
    color: colors.primary,
  },
  monthYearLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  monthYearText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  yearSelectChip: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  yearSelectText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  yearListScroll: {
    maxHeight: 200,
    marginVertical: spacing.xs,
  },
  yearListGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  yearItem: {
    width: '28%',
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  yearItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yearItemText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  yearItemTextActive: {
    color: '#FFFFFF',
    fontWeight: fontWeight.bold,
  },
  dayHeadingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  dayHeadingText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 36,
  },
  dayCell: {
    width: '14.28%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayCellText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: fontWeight.bold,
  },
  calendarActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  calCancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCancelText: {
    color: colors.textSecondary,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.sm,
  },
  calConfirmBtn: {
    flex: 1,
    height: 42,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calConfirmText: {
    color: '#FFFFFF',
    fontWeight: fontWeight.bold,
    fontSize: fontSize.sm,
  },
}));
