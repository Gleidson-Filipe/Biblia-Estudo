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
    cardSecondary: '#FDFBF7',
    border: '#EBE6DA',
    borderStrong: '#DDD5C8',
    badge: '#F2EDE4',
    accent: '#1E40AF', // Royal Covenant Blue
    accentSubtle: 'rgba(30, 64, 175, 0.08)',
    success: '#15803D',
    error: '#B91C1C',
    warning: '#B45309',
    
    // Orange/Highlight colors
    orange: '#EA580C',
    orangeBg: 'rgba(234, 88, 12, 0.05)',
    orangeBorder: '#FDBA74',
    
    // Tab bar custom styling
    tabBarBackground: 'rgba(250, 247, 242, 0.92)',
    tabBarBorder: '#EAE2D5',
    tabBarShadow: '#1A1613',
    
    // Skeleton indicator
    skeleton: '#000000',

    // Parchment paper look
    parchment: '#FAF6EE',
    parchmentBorder: '#EAE2D5',

    // Modal overlay background
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
  dark: {
    text: '#F2EFEA', // Creme
    background: '#0F0E0D', // Carvão profundo
    backgroundElement: '#242120', // surface-elevated
    backgroundSelected: '#322E2D',
    textSecondary: '#A69E96',
    textMuted: '#706861',
    card: '#161413',
    cardSecondary: '#1C1A19',
    border: '#2D2927',
    borderStrong: '#3A3735',
    badge: '#2C2826',
    accent: '#3B82F6', // Lighter Royal Blue for dark mode readability
    accentSubtle: 'rgba(59, 130, 246, 0.15)',
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    
    // Orange/Highlight colors
    orange: '#F97316',
    orangeBg: 'rgba(249, 115, 22, 0.08)',
    orangeBorder: '#C2410C',
    
    // Tab bar custom styling
    tabBarBackground: 'rgba(26, 24, 23, 0.92)',
    tabBarBorder: '#242120',
    tabBarShadow: '#000000',
    
    // Skeleton indicator
    skeleton: '#FFFFFF',

    // Parchment paper look
    parchment: '#232120',
    parchmentBorder: '#363230',

    // Modal overlay background
    overlay: 'rgba(0, 0, 0, 0.6)',
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
