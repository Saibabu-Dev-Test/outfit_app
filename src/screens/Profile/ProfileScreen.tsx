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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, updateUserProfile, UserProfile } from '../../services/authApi';

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
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>👤</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            </View>

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
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 1998-08-15"
                    placeholderTextColor="#9E9EBA"
                    value={editDob}
                    onChangeText={setEditDob}
                  />
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
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Male / Female / Other"
                  placeholderTextColor="#9E9EBA"
                  value={editGender}
                  onChangeText={setEditGender}
                />
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
  },
  avatarText: { fontSize: 40 },
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
});
