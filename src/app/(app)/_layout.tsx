import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';

import { ActionSheetHost } from '@/components/ActionSheet';
import { AppTabBar } from '@/components/AppTabBar';
import { CreatePlaylistHost } from '@/components/CreatePlaylistHost';
import { CreateSheet } from '@/components/CreateSheet';
import { GlassProvider } from '@/components/GlassSurface';
import { NowPlayingBar } from '@/components/MiniPlayer';
import { useAuth } from '@/store/auth';
import { useColors } from '@/theme/useColors';

export default function AppGroupLayout() {
  const session = useAuth((s) => s.session);
  const c = useColors();
  if (!session) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgDeep }}>
      <GlassProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.bg },
            animation: 'slide_from_right',
          }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="player" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="queue" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="add-to-playlist" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="create-playlist" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </GlassProvider>
      <NowPlayingBar />
      <AppTabBar />
      <CreateSheet />
      <CreatePlaylistHost />
      <ActionSheetHost />
    </View>
  );
}
