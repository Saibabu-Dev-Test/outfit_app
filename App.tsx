import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from './src/components/keyboard';
import RootNavigator from './src/navigation/RootNavigator';
import NotificationGate from './src/components/NotificationGate';
import { captureClipboardReferral } from './src/utils/referralLink';
import { allowAds, initAds } from './src/native/ads';
import { isSafeMode, markBootOk } from './src/native/safeMode';
import { ThemeProvider, useTheme } from './src/theme';
import CoinFlipProvider from './src/components/coins/CoinFlipProvider';

function Themed() {
  const { isDark } = useTheme();
  // Android first launch after installing from an invite link: keep the referral code the
  // download page copied (OUTFITREF:CODE) for the sign-up screen
  useEffect(() => {
    try {
      captureClipboardReferral();
    } catch {}
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Start-up health: the first screen has been up for 8 s -> this launch counts as good
    // (CrashModule safe-mode counter, native/safeMode.ts)
    timers.push(setTimeout(markBootOk, 8000));
    // Mobile Ads SDK: only after the first screen is up and settled (never during start-up), and
    // never in start-up safe mode. Ad slots render nothing until then. Never throws.
    if (!isSafeMode()) {
      timers.push(
        setTimeout(() => {
          try {
            allowAds();
            initAds().catch(() => undefined);
          } catch {}
        }, 10000),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {/* Notifications must be on to use the app */}
      {/* Coin flip overlay for coin rewards (likes, uploads, shares) */}
      <CoinFlipProvider>
        <NotificationGate>
          <RootNavigator />
        </NotificationGate>
      </CoinFlipProvider>
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
