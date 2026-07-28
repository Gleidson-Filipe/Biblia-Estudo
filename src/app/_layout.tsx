import { DarkTheme, DefaultTheme, ThemeProvider as RouterThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { ThemeProvider, useAppTheme } from '@/components/ThemeContext';
import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

function AppStack() {
  const { isDark } = useAppTheme();
  return (
    <RouterThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_bottom' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="save-sheet" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="novo-assunto" options={{ headerShown: false, animation: 'slide_from_right' }} />
      </Stack>
    </RouterThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <KeyboardProvider>
          <ThemeProvider>
            <AppStack />
          </ThemeProvider>
          <AnimatedSplashOverlay />
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
