import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from './src/components/keyboard';
import RootNavigator from './src/navigation/RootNavigator';
import NotificationGate from './src/components/NotificationGate';
import { captureClipboardReferral } from './src/utils/referralLink';
import { initAds } from './src/native/ads';
import { ThemeProvider, useTheme } from './src/theme';

function Themed() {
  const { isDark } = useTheme();
  // Android first launch after installing from an invite link: keep the referral code the
  // download page copied (OUTFITREF:CODE) for the sign-up screen
  useEffect(() => {
    captureClipboardReferral();
    // Mobile Ads SDK, a few seconds after start so it never slows the first screen (never throws)
    const t = setTimeout(() => {
      initAds().catch(() => undefined);
    }, 3000);
    return () => clearTimeout(t);
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
        {/* Keyboard animation for every message box / form (edge-to-edge window: bars translucent) */}
        <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
          <Themed />
        </KeyboardProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

export default App;
