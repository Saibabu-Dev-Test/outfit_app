// Light and dark palettes. `colors` is the live palette: ThemeProvider copies the
// active one into it, then remounts the app so every screen re-reads it.
export const lightColors = {
  // Brand
  primary: '#2D1F6E',
  primaryLight: '#4A3A9A',
  primaryDark: '#1A1040',
  accent: '#8B5CF6',
  accentLight: '#C4B5FD',
  pink: '#E91E63',
  pinkSoft: '#FFF0F5',

  // Background
  background: '#F5F4FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FAFAFF',
  card: '#FFFFFF',
  inputBg: '#F5F4FA',

  // Text
  textPrimary: '#1A1040',
  textSecondary: '#6B6B8A',
  textMuted: '#A0A0BF',
  textInverse: '#FFFFFF',
  onPrimary: '#FFFFFF',

  // UI
  border: '#E8E6F0',
  divider: '#F0EEF8',
  shadow: 'rgba(45, 31, 110, 0.12)',

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Tab Bar
  tabActive: '#2D1F6E',
  tabInactive: '#A0A0BF',
  tabBackground: '#FFFFFF',

  // Overlay
  overlay: 'rgba(26, 16, 64, 0.5)',
};

export type Palette = typeof lightColors;

export const darkColors: Palette = {
  primary: '#8B7CF6',
  primaryLight: '#A99BFA',
  primaryDark: '#E4DEFF',
  accent: '#A78BFA',
  accentLight: '#5B4A9E',
  pink: '#F06292',
  pinkSoft: '#3A2033',

  background: '#0F0D17',
  surface: '#1A1724',
  surfaceElevated: '#221E2E',
  card: '#1A1724',
  inputBg: '#24202F',

  textPrimary: '#F2F0FA',
  textSecondary: '#B4B0C8',
  textMuted: '#7D7896',
  textInverse: '#FFFFFF',
  onPrimary: '#FFFFFF',

  border: '#2E2A3B',
  divider: '#262233',
  shadow: 'rgba(0, 0, 0, 0.5)',

  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#60A5FA',

  tabActive: '#C4B5FD',
  tabInactive: '#7D7896',
  tabBackground: '#1A1724',

  overlay: 'rgba(0, 0, 0, 0.65)',
};

// Live palette (mutated in place by ThemeProvider)
export const colors: Palette = { ...lightColors };
