import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { BottomTabBarHeightCallbackContext, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from '../../components/keyboard';
import { colors, fontSize, fontWeight, spacing, themedStyles } from '../../theme';

type TabItem = {
  name: string;
  icon: string;
  iconActive: string;
  label: string;
};

const TABS: TabItem[] = [
  { name: 'Home', icon: '⌂', iconActive: '⌂', label: 'Home' },
  { name: 'Feed', icon: '▦', iconActive: '▦', label: 'Feed' },
  { name: 'Stylist', icon: '✦', iconActive: '✦', label: 'Style' },
  { name: 'Wardrobe', icon: '☰', iconActive: '☰', label: 'Wardrobe' },
  { name: 'Circles', icon: '◎', iconActive: '◎', label: 'Circles' },
  { name: 'Me', icon: '⊙', iconActive: '⊙', label: 'Me' },
];

export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Real height for useBottomTabBarHeight(): the AI Stylist message box uses it as its keyboard offset.
  const onHeightChange = React.useContext(BottomTabBarHeightCallbackContext);
  // Hidden while the keyboard is open: it fades out with the keyboard's own animation (opacity only,
  // no height change, so the message box above it never jumps); the keyboard covers its area.
  const kb = useReanimatedKeyboardAnimation();
  const hideStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, Math.max(0, kb.progress.value)) }));

  return (
    <Animated.View
      style={[styles.container, { paddingBottom: insets.bottom || spacing.sm }, hideStyle]}
      onLayout={e => onHeightChange?.(e.nativeEvent.layout.height)}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        // Look tabs up by route name so the bar stays right if the navigator order changes
        const tab = TABS.find(t => t.name === route.name) || TABS[index] || TABS[0];
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
    </Animated.View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
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
    color: colors.onPrimary,
  },
  stylistLabel: {
    color: colors.tabActive,
    fontWeight: fontWeight.bold,
  },
}));
