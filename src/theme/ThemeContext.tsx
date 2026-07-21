import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { AppColors, darkColors, lightColors, makeSharedStyles } from '../theme';

const THEME_KEY = 'filebrowser.color-scheme';
type ThemeMode = 'dark' | 'light';
type ThemeValue = { mode: ThemeMode; dark: boolean; colors: AppColors; sharedStyles: ReturnType<typeof makeSharedStyles>; setDark: (enabled: boolean) => void };

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  // Dark is intentionally the default, including during the first render.
  const [mode, setMode] = useState<ThemeMode>('dark');
  useEffect(() => { AsyncStorage.getItem(THEME_KEY).then(value => { if (value === 'light' || value === 'dark') setMode(value); }).catch(() => {}); }, []);
  const value = useMemo<ThemeValue>(() => {
    const palette = mode === 'dark' ? darkColors : lightColors;
    return { mode, dark: mode === 'dark', colors: palette, sharedStyles: makeSharedStyles(palette), setDark: enabled => { const next = enabled ? 'dark' : 'light'; setMode(next); void AsyncStorage.setItem(THEME_KEY, next); } };
  }, [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme must be used inside ThemeProvider.');
  return value;
}
