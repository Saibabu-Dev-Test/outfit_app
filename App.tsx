import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import NotificationGate from './src/components/NotificationGate';
import { captureClipboardReferral } from './src/utils/referralLink';
import { ThemeProvider, useTheme } from './src/theme';

function Themed() {
  const { isDark } = useTheme();
  // Android first launch after installing from an invite link: keep the referral code the
  // download page copied (OUTFITREF:CODE) for the sign-up screen
  useEffect(() => {
    captureClipboardReferral();
  }, []);
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
