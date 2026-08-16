import { Tabs } from 'expo-router';

import { useColors } from '@/theme/useColors';

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.bg },
        tabBarStyle: { display: 'none', height: 0 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="library" options={{ title: 'Your Library' }} />
      <Tabs.Screen name="likes" options={{ title: 'Liked Songs', href: null }} />
    </Tabs>
  );
}
