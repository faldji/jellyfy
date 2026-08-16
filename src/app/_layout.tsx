import '@/global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { queryClient } from '@/api/query';
import { ToastHost } from '@/components/ToastHost';
import { PlaybackHost } from '@/playback/PlaybackHost';
import { useAuth } from '@/store/auth';
import { useColors } from '@/theme/useColors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const hydrate = useAuth((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);
  const c = useColors();

  const navTheme = useMemo(() => {
    const base = c.isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: c.bg,
        card: c.bg,
        text: c.text,
        border: c.hairline,
        primary: c.accent,
      },
    };
  }, [c]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated) {
      void SplashScreen.hideAsync();
    }
  }, [hydrated]);

  if (!hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navTheme}>
          <PlaybackHost />
          <StatusBar style={c.isDark ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: c.bg },
              animation: 'slide_from_right',
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(app)" />
          </Stack>
          <ToastHost />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
