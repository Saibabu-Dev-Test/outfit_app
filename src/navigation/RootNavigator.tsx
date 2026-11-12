import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  createNavigationContainerRef,
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  NavigationState,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabNavigator from './BottomTabNavigator';
import AuthNavigator from './AuthNavigator';
import { AuthProvider, useAuth } from '../context/AuthContext';
import CircleChatScreen from '../screens/Circles/CircleChatScreen';
import CircleInfoScreen from '../screens/Circles/CircleInfoScreen';
import CommentsScreen from '../screens/Feed/CommentsScreen';
import UserProfileScreen from '../screens/Profile/UserProfileScreen';
import UserSearchScreen from '../screens/Profile/UserSearchScreen';
import AdminScreen from '../screens/Admin/AdminScreen';
import AdminUsersScreen from '../screens/Admin/AdminUsersScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import AchievementsScreen from '../screens/Profile/AchievementsScreen';
import MonthlyTasksScreen from '../screens/Profile/MonthlyTasksScreen';
import AdminRewardsScreen from '../screens/Admin/AdminRewardsScreen';
import LikesScreen from '../screens/Profile/LikesScreen';
import LikedByScreen from '../screens/Profile/LikedByScreen';
import FollowListScreen from '../screens/Profile/FollowListScreen';
import PostDetailScreen from '../screens/Feed/PostDetailScreen';
import BirthdayChatScreen from '../screens/Home/BirthdayChatScreen';
import PoruthamScreen from '../screens/Astrology/PoruthamScreen';
import FunctionPlannerScreen from '../screens/Home/FunctionPlannerScreen';
import { colors, themedStyles, useTheme } from '../theme';
import AppLockGate from '../components/AppLockGate';
import ActivityWatcher from '../components/ActivityWatcher';
import CircleInviteLink from '../components/CircleInviteLink';
import SessionLockScreen from '../components/SessionLockScreen';
import TamperScreen from '../components/TamperScreen';
import { getVaultStatus, subscribeVault, VaultStatus } from '../native/sessionVault';
import type { RootStackParamList } from './types';

export type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function useVaultStatus(): VaultStatus {
  const [status, setStatus] = useState<VaultStatus>(getVaultStatus());
  useEffect(() => {
    setStatus(getVaultStatus());
    return subscribeVault(setStatus);
  }, []);
  return status;
}

// Used by CircleInviteLink to open a circle after joining from an invite link
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Kept across a theme switch (the tree remounts) so the user stays on the same screen
let savedNavState: NavigationState | undefined;

function NavigationContent() {
  const { isAuthenticated, initializing, login } = useAuth();
  const vault = useVaultStatus();
  const { isDark } = useTheme();
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
    },
  };

  // APK not signed with the official key: blocked, signed out
  if (vault === 'tampered') return <TamperScreen />;
  // Fingerprint lock on: the session stays encrypted until the fingerprint unlocks it
  if (vault === 'locked' || vault === 'unlocking' || vault === 'invalidated') {
    return <SessionLockScreen status={vault} />;
  }

  // Checking the saved session (stay logged in until logout)
  if (initializing) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>👗</Text>
        <Text style={styles.splashName}>OUTFIT</Text>
        <ActivityIndicator color="#E91E63" style={styles.splashSpinner} />
      </View>
    );
  }

  return (
    <React.Fragment key={isDark ? 'dark' : 'light'}>
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      initialState={isAuthenticated ? savedNavState : undefined}
      onStateChange={st => {
        savedNavState = st;
      }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth">
            {(props) => (
              <AuthNavigator
                {...props}
                onLoginSuccess={(userData) => login(userData)}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="MainApp" component={BottomTabNavigator} />
            {/* Pushed over the tabs from Circles, Home, Me and Feed */}
            <Stack.Group screenOptions={{ animation: 'slide_from_right' }}>
              <Stack.Screen name="CircleChat" component={CircleChatScreen} />
              <Stack.Screen name="CircleInfo" component={CircleInfoScreen} />
              <Stack.Screen name="Settings" component={ProfileScreen} />
              <Stack.Screen name="Achievements" component={AchievementsScreen} />
              <Stack.Screen name="MonthlyTasks" component={MonthlyTasksScreen} />
              <Stack.Screen name="AdminRewards" component={AdminRewardsScreen} />
              <Stack.Screen name="Likes" component={LikesScreen} />
              <Stack.Screen name="LikedBy" component={LikedByScreen} />
              <Stack.Screen name="PostDetail" component={PostDetailScreen} />
              <Stack.Screen name="FollowList" component={FollowListScreen} />
              <Stack.Screen name="Comments" component={CommentsScreen} />
              <Stack.Screen name="BirthdayChat" component={BirthdayChatScreen} />
              <Stack.Screen name="Porutham" component={PoruthamScreen} />
              <Stack.Screen name="FunctionPlanner" component={FunctionPlannerScreen} />
              <Stack.Screen name="UserProfile" component={UserProfileScreen} />
              <Stack.Screen name="UserSearch" component={UserSearchScreen} />
              <Stack.Screen name="Admin" component={AdminScreen} />
              <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
            </Stack.Group>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    <AppLockGate />
    <ActivityWatcher />
    <CircleInviteLink navigationRef={navigationRef} />
    </React.Fragment>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  splashLogo: { fontSize: 44 },
  splashName: { fontSize: 24, fontWeight: '900', color: colors.textPrimary, letterSpacing: 4, marginTop: 8 },
  splashSpinner: { marginTop: 20 },
}));

export default function RootNavigator() {
  return (
    <AuthProvider>
      <NavigationContent />
    </AuthProvider>
  );
}
