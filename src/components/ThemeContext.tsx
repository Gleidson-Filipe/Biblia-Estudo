import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeOverride = 'light' | 'dark' | null;

interface ThemeContextValue {
  isDark: boolean;
  themeOverride: ThemeOverride;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  themeOverride: null,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeOverride, setThemeOverride] = useState<ThemeOverride>(null);

  useEffect(() => {
    AsyncStorage.getItem('themeOverride').then(val => {
      if (val === 'light' || val === 'dark') setThemeOverride(val);
    });
  }, []);

  const effectiveScheme = themeOverride ?? systemScheme;
  const isDark = effectiveScheme === 'dark';

  const toggleTheme = () => {
    const next: ThemeOverride = isDark ? 'light' : 'dark';
    setThemeOverride(next);
    AsyncStorage.setItem('themeOverride', next);
  };

  return (
    <ThemeContext.Provider value={{ isDark, themeOverride, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
