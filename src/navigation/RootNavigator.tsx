import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabNavigator from './BottomTabNavigator';
import AuthNavigator from './AuthNavigator';
import { AuthProvider, useAuth } from '../context/AuthContext';
import CircleChatScreen from '../screens/Circles/CircleChatScreen';
import CircleInfoScreen from '../screens/Circles/CircleInfoScreen';
import FeedScreen from '../screens/Feed/FeedScreen';
import NewPostScreen from '../screens/Feed/NewPostScreen';
import CommentsScreen from '../screens/Feed/CommentsScreen';
import UserProfileScreen from '../screens/Profile/UserProfileScreen';
import UserSearchScreen from '../screens/Profile/UserSearchScreen';
import AdminScreen from '../screens/Admin/AdminScreen';
import AppLockGate from '../components/AppLockGate';
import type { RootStackParamList } from './types';

export type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function NavigationContent() {
  const { isAuthenticated, initializing, login } = useAuth();

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
    <>
    <NavigationContainer>
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
            {/* Pushed over the tabs from Circles, Home, Profile and Feed */}
            <Stack.Group screenOptions={{ animation: 'slide_from_right' }}>
              <Stack.Screen name="CircleChat" component={CircleChatScreen} />
              <Stack.Screen name="CircleInfo" component={CircleInfoScreen} />
              <Stack.Screen name="Feed" component={FeedScreen} />
              <Stack.Screen name="NewPost" component={NewPostScreen} />
              <Stack.Screen name="Comments" component={CommentsScreen} />
              <Stack.Screen name="UserProfile" component={UserProfileScreen} />
              <Stack.Screen name="UserSearch" component={UserSearchScreen} />
              <Stack.Screen name="Admin" component={AdminScreen} />
            </Stack.Group>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    <AppLockGate />
    </>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#FAF9FC', alignItems: 'center', justifyContent: 'center' },
  splashLogo: { fontSize: 44 },
  splashName: { fontSize: 24, fontWeight: '900', color: '#0A1940', letterSpacing: 4, marginTop: 8 },
  splashSpinner: { marginTop: 20 },
});

export default function RootNavigator() {
  return (
    <AuthProvider>
      <NavigationContent />
    </AuthProvider>
  );
}
