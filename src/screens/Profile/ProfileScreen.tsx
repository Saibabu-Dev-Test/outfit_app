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
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary, launchCamera, ImagePickerResponse } from 'react-native-image-picker';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, updateUserProfile, uploadProfileAvatar, UserProfile } from '../../services/authApi';


const menuItems = [
  { id: '1', icon: '🎨', label: 'Style Preferences', hasArrow: true },
  { id: '2', icon: '🏆', label: 'Achievements', hasArrow: true },
  { id: '3', icon: '🔔', label: 'Notifications', hasToggle: true },
  { id: '4', icon: '🌙', label: 'Dark Mode', hasToggle: true },
  { id: '5', icon: '❓', label: 'Help & Support', hasArrow: true },
  { id: '6', icon: '📋', label: 'Terms & Conditions', hasArrow: true },
];

export default function ProfileScreen() {
  const { user: authUser, logout, updateUserData } = useAuth();
  const [profileData, setProfileData] = useState<UserProfile | null>(authUser);
  const [loading, setLoading] = useState<boolean>(true);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [darkEnabled, setDarkEnabled] = useState(false);

  // Edit modal states
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editDob, setEditDob] = useState<string>('');
  const [editTimeOfBirth, setEditTimeOfBirth] = useState<string>('');
  const [editRashi, setEditRashi] = useState<string>('');
  const [editLanguage, setEditLanguage] = useState<string>('');
  const [editGender, setEditGender] = useState<string>('');
  const [editBio, setEditBio] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);

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


  const handleUploadImage = async (response: ImagePickerResponse) => {
    if (response.didCancel) return;
    if (response.errorCode || response.errorMessage) {
      Alert.alert('Image Error', response.errorMessage || 'Failed to select image');
      return;
    }

    const asset = response.assets && response.assets[0];
    if (!asset || (!asset.uri && !asset.base64)) return;

    try {
      setUploadingAvatar(true);
      const res = await uploadProfileAvatar(profileData?.id || authUser?.id, {
        uri: asset.uri || '',
        name: asset.fileName || 'avatar.jpg',
        type: asset.type || 'image/jpeg',
        base64: asset.base64 || undefined,
      });

      if (res?.avatarUrl) {
        setProfileData(prev =>
          prev
            ? { ...prev, avatarUrl: res.avatarUrl }
            : ({ avatarUrl: res.avatarUrl, phoneNumber: authUser?.phoneNumber || '' } as UserProfile)
        );
        updateUserData({ avatarUrl: res.avatarUrl });
        Alert.alert('Success', 'Profile photo updated successfully!');
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err?.message || 'Failed to upload profile photo to AWS S3.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSelectAvatarSource = () => {
    Alert.alert(
      'Change Profile Photo',
      'Choose an option to update your profile photo',
      [
        {
          text: 'Take Photo',
          onPress: () => {
            launchCamera(
              { mediaType: 'photo', quality: 0.8, includeBase64: true },
              handleUploadImage
            );
          },
        },
        {
          text: 'Choose from Library',
          onPress: () => {
            launchImageLibrary(
              { mediaType: 'photo', quality: 0.8, includeBase64: true },
              handleUploadImage
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };


  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await getUserProfile(authUser?.id);
      if (res?.user) {
        setProfileData(res.user);
        updateUserData(res.user);
      }
    } catch (err: any) {
      console.warn('Failed to load profile details from backend:', err?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [authUser?.id]);

  const handleOpenEditModal = () => {
    setEditName(profileData?.name || '');
    setEditPhone(profileData?.phoneNumber || '');
    setEditDob(profileData?.dob || '');
    setEditTimeOfBirth(profileData?.timeOfBirth || '');
    setEditRashi(profileData?.rashi || '');
    setEditLanguage(profileData?.language || '');
    setEditGender(profileData?.gender || '');
    setEditBio(profileData?.bio || '');
    setIsGenderDropdownOpen(false);
    setIsEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editPhone.trim()) {
      Alert.alert('Validation Error', 'Phone number cannot be empty.');
      return;
    }

    try {
      setSavingProfile(true);
      const res = await updateUserProfile({
        userId: profileData?.id || authUser?.id,
        name: editName.trim(),
        phoneNumber: editPhone.trim(),
        dob: editDob.trim(),
        timeOfBirth: editTimeOfBirth.trim(),
        rashi: editRashi.trim(),
        language: editLanguage.trim(),
        gender: editGender.trim(),
        bio: editBio.trim(),
      });

      if (res?.user) {
        setProfileData(res.user);
        updateUserData(res.user);
        setIsEditModalVisible(false);
        Alert.alert('Success', 'Profile details updated successfully!');
      }
    } catch (error: any) {
      Alert.alert('Update Failed', error?.message || 'Unable to update profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

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
        barStyle="dark-content"
        {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.editBtn} onPress={handleOpenEditModal} activeOpacity={0.7}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Main Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileGradient}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleSelectAvatarSource}
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
              <View style={styles.cameraBadge}>
                <Text style={styles.cameraIconText}>📷</Text>
              </View>
            </TouchableOpacity>


            {loading && !profileData ? (
              <ActivityIndicator color="#FFFFFF" style={{ marginVertical: spacing.sm }} />
            ) : (
              <>
                <Text style={styles.profileName}>
                  {profileData?.name ? profileData.name : 'Set Your Name'}
                </Text>
                
                {Boolean(profileData?.bio) && (
                  <Text style={styles.profileBio}>{profileData?.bio}</Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* Personal Details Section */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Personal Information</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>🎂 Date of Birth</Text>
                <Text style={styles.infoValue}>
                  {profileData?.dob ? profileData.dob : 'Not specified'}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>⏰ Time of Birth</Text>
                <Text style={styles.infoValue}>
                  {profileData?.timeOfBirth ? profileData.timeOfBirth : 'Not specified'}
                </Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>✨ Rashi</Text>
                <Text style={styles.infoValue}>
                  {profileData?.rashi ? profileData.rashi : 'Not specified'}
                </Text>
              </View>
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
            </View>
          </View>
        </View>

        {/* Menu Section */}
        <View style={styles.menuSection}>
          {menuItems.map(item => {
            const toggle =
              item.id === '3' ? notifEnabled :
              item.id === '4' ? darkEnabled : false;
            const setToggle =
              item.id === '3' ? setNotifEnabled :
              item.id === '4' ? setDarkEnabled : undefined;

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                activeOpacity={item.hasArrow ? 0.7 : 1}>
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconBox}>
                    <Text style={styles.menuIcon}>{item.icon}</Text>
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>
                {item.hasArrow && <Text style={styles.menuArrow}>›</Text>}
                {item.hasToggle && setToggle && (
                  <Switch
                    value={toggle}
                    onValueChange={setToggle}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={colors.textInverse}
                  />
                )}
              </TouchableOpacity>
            );
          })}
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

        <Text style={styles.version}>Outfit Vote v1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEditModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}>
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
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter phone number"
                  placeholderTextColor="#9E9EBA"
                  keyboardType="phone-pad"
                  value={editPhone}
                  onChangeText={setEditPhone}
                />
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
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 07:30 AM"
                    placeholderTextColor="#9E9EBA"
                    value={editTimeOfBirth}
                    onChangeText={setEditTimeOfBirth}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Rashi</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Megha / Mesha"
                    placeholderTextColor="#9E9EBA"
                    value={editRashi}
                    onChangeText={setEditRashi}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Language</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. English, Telugu"
                    placeholderTextColor="#9E9EBA"
                    value={editLanguage}
                    onChangeText={setEditLanguage}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Gender</Text>
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
        </KeyboardAvoidingView>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
});
