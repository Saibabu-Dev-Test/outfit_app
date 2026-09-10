import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

const stats = [
  { label: 'Outfits', value: '48' },
  { label: 'Votes', value: '1.2K' },
  { label: 'Circles', value: '7' },
  { label: 'Followers', value: '1.5K' },
  { label: 'Following', value: '2.5K' },
];

const menuItems = [
  { id: '1', icon: '🎨', label: 'Style Preferences', hasArrow: true },
  { id: '2', icon: '🏆', label: 'Achievements', hasArrow: true },
  { id: '3', icon: '🔔', label: 'Notifications', hasToggle: true },
  { id: '4', icon: '🌙', label: 'Dark Mode', hasToggle: true },
  { id: '5', icon: '❓', label: 'Help & Support', hasArrow: true },
  { id: '6', icon: '📋', label: 'Terms & Conditions', hasArrow: true },
];

export default function ProfileScreen() {
  const [notifEnabled, setNotifEnabled] = React.useState(true);
  const [darkEnabled, setDarkEnabled] = React.useState(false);

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
          <TouchableOpacity style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
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
            <Text style={styles.profileName}>Dinesh Veera</Text>
            <Text style={styles.profileHandle}>8374330906</Text>
            <Text style={styles.profileBio}>Fashion enthusiast • megha rasi</Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {stats.map((stat, index) => (
              <React.Fragment key={stat.label}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
                {index < stats.length - 1 && <View style={styles.statDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Style DNA */}
        <View style={styles.styleDnaCard}>
          <Text style={styles.styleDnaTitle}>Outfit Style</Text>
          <View style={styles.dnaRow}>
            {['Minimal', 'Classic', 'Casual'].map(tag => (
              <View key={tag} style={styles.dnaTag}>
                <Text style={styles.dnaTagText}>{tag}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.updateStyleBtn}>
            <Text style={styles.updateStyleText}>Update Style Profile →</Text>
          </TouchableOpacity>
        </View>

        {/* Menu */}
        <View style={styles.menuSection}>
          {menuItems.map(item => {
            const toggle =
              item.id === '4' ? notifEnabled :
              item.id === '5' ? darkEnabled : false;
            const setToggle =
              item.id === '4' ? setNotifEnabled :
              item.id === '5' ? setDarkEnabled : undefined;

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
        <TouchableOpacity style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Outfit Vote v1.0.0</Text>
      </ScrollView>
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
  profileHandle: { fontSize: fontSize.sm, color: colors.accentLight, marginBottom: spacing.sm },
  profileBio: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.divider, marginVertical: spacing.xs },
  styleDnaCard: {
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
  styleDnaTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.primary, marginBottom: spacing.md },
  dnaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  dnaTag: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  dnaTagText: { color: colors.primary, fontWeight: fontWeight.semiBold, fontSize: fontSize.sm },
  updateStyleBtn: {},
  updateStyleText: { color: colors.accent, fontWeight: fontWeight.semiBold, fontSize: fontSize.sm },
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
});
