/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1A1613', // Charcoal quente
    background: '#FAF7F2', // Sépia Luxo
    backgroundElement: '#F2EDE4', // surface-elevated
    backgroundSelected: '#EAE2D5',
    textSecondary: '#5C534C',
    textMuted: '#8C8177',
    card: '#FFFFFF',
    accent: '#1E40AF', // Royal Covenant Blue
    accentSubtle: 'rgba(30, 64, 175, 0.08)',
    success: '#15803D',
    error: '#B91C1C',
    warning: '#B45309',
  },
  dark: {
    text: '#F2EFEA', // Creme
    background: '#0F0E0D', // Carvão profundo
    backgroundElement: '#242120', // surface-elevated
    backgroundSelected: '#322E2D',
    textSecondary: '#A69E96',
    textMuted: '#706861',
    card: '#1A1817',
    accent: '#3B82F6', // Lighter Royal Blue for dark mode readability
    accentSubtle: 'rgba(59, 130, 246, 0.15)',
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
