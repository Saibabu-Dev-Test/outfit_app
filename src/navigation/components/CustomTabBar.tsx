import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../theme';

type TabItem = {
  name: string;
  icon: string;
  iconActive: string;
  label: string;
};

const TABS: TabItem[] = [
  { name: 'Home', icon: '⌂', iconActive: '⌂', label: 'Home' },
  { name: 'Wardrobe', icon: '☰', iconActive: '☰', label: 'Wardrobe' },
  { name: 'Stylist', icon: '✦', iconActive: '✦', label: 'Stylist' },
  { name: 'Circles', icon: '◎', iconActive: '◎', label: 'Circles' },
  { name: 'Profile', icon: '⊙', iconActive: '⊙', label: 'Me' },
];

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || spacing.sm }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const tab = TABS[index];
        const isStylist = tab.name === 'Stylist';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (isStylist) {
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.85}>
              <View style={styles.stylistButton}>
                <Text style={styles.stylistIcon}>{tab.icon}</Text>
              </View>
              <Text style={[styles.tabLabel, styles.stylistLabel]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.75}>
            <Text style={[styles.tabIcon, isFocused && styles.tabIconActive]}>
              {isFocused ? tab.iconActive : tab.icon}
            </Text>
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {isFocused && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.tabBackground,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: spacing.xs,
  },
  tabIcon: {
    fontSize: 22,
    color: colors.tabInactive,
    marginBottom: 3,
  },
  tabIconActive: {
    color: colors.tabActive,
  },
  tabLabel: {
    fontSize: fontSize.xs,
    color: colors.tabInactive,
    fontWeight: fontWeight.medium,
  },
  tabLabelActive: {
    color: colors.tabActive,
    fontWeight: fontWeight.bold,
  },
  activeIndicator: {
    position: 'absolute',
    top: -spacing.sm,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.tabActive,
  },
  stylistButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
    marginTop: -20,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  stylistIcon: {
    fontSize: 22,
    color: colors.textInverse,
  },
  stylistLabel: {
    color: colors.tabActive,
    fontWeight: fontWeight.bold,
  },
});
