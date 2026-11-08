// Current theme, readable outside React (styles, StatusBar). ThemeProvider keeps it in sync.
import { colors, darkColors, lightColors } from './colors';

let dark = false;
let version = 0;

export const isDarkTheme = (): boolean => dark;
export const themeVersion = (): number => version;

// Copies the palette into `colors`. Returns true when it changed.
export const applyPalette = (isDark: boolean): boolean => {
  if (isDark === dark && version > 0) return false;
  dark = isDark;
  version += 1;
  Object.assign(colors, isDark ? darkColors : lightColors);
  return true;
};

// Module-level styles that follow the theme: the factory reads `colors` again after a switch.
export function themedStyles<T extends object>(factory: () => T): T {
  let cache: T | null = null;
  let builtFor = -1;
  const current = (): T => {
    if (!cache || builtFor !== version) {
      cache = factory();
      builtFor = version;
    }
    return cache as T;
  };
  return new Proxy({} as T, {
    get: (_t, key) => (current() as any)[key],
    has: (_t, key) => key in (current() as any),
    ownKeys: () => Reflect.ownKeys(current() as any),
    getOwnPropertyDescriptor: (_t, key) => ({
      enumerable: true,
      configurable: true,
      value: (current() as any)[key],
    }),
  });
}

export const statusBarStyle = (): 'light-content' | 'dark-content' =>
  dark ? 'light-content' : 'dark-content';
