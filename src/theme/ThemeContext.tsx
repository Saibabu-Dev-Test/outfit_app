// Theme: 'system' (default), 'light' or 'dark', saved in AsyncStorage.
// On a change the palette is copied into `colors`; RootNavigator remounts its tree (key),
// so every screen, including module-level styles, picks up the new colours.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, Palette } from './colors';
import { applyPalette } from './themeState';

export type ThemeMode = 'system' | 'light' | 'dark';
const KEY = 'outfit.themeMode';

interface ThemeCtx {
  mode: ThemeMode;
  isDark: boolean;
  colors: Palette;
  setMode: (m: ThemeMode) => void;
}

const Ctx = createContext<ThemeCtx>({
  mode: 'system',
  isDark: false,
  colors,
  setMode: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [system, setSystem] = useState<ColorSchemeName | null | undefined>(Appearance.getColorScheme());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(v => {
        if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
      })
      .catch(() => {})
      .finally(() => setReady(true));
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme));
    return () => sub.remove();
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  // Apply before children render (sync, during render of the provider)
  applyPalette(isDark);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  };

  const value = useMemo(() => ({ mode, isDark, colors: { ...colors }, setMode }), [mode, isDark]);

  // Wait for the saved mode so the app doesn't flash the wrong theme
  if (!ready) return null;
  // Screens remount on a change (RootNavigator keys its tree on isDark)
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useTheme = () => useContext(Ctx);
