import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import NotificationGate from './src/components/NotificationGate';
import { ThemeProvider, useTheme } from './src/theme';

function Themed() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {/* Notifications must be on to use the app */}
      <NotificationGate>
        <RootNavigator />
      </NotificationGate>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <Themed />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

export default App;
