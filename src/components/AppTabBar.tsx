import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/GlassSurface';
import { TAB_BAR_HEIGHT } from '@/constants/theme';
import { APP_TABS, hideAppChrome, tabFromPathname, type AppTabKey } from '@/lib/chrome';
import { useUi } from '@/store/ui';
import { useColors } from '@/theme/useColors';

function openTab(router: ReturnType<typeof useRouter>, key: AppTabKey) {
  const tab = APP_TABS.find((entry) => entry.key === key);
  if (!tab) return;
  useUi.getState().closeCreate();
  if (key === 'queue') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    router.push('/queue');
    return;
  }
  useUi.getState().setLastTab(key);
  try {
    if (router.canDismiss()) router.dismissTo('/(app)/(tabs)');
  } catch {
    // Already at the tab root.
  }
  router.navigate(tab.href);
}

export function AppTabBar() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const router = useRouter();
  const pathname = usePathname();
  const createOpen = useUi((s) => s.createOpen);
  const toggleCreate = useUi((s) => s.toggleCreate);
  const lastTab = useUi((s) => s.lastTab);
  const setLastTab = useUi((s) => s.setLastTab);

  useEffect(() => {
    const tab = tabFromPathname(pathname);
    if (tab) setLastTab(tab);
  }, [pathname, setLastTab]);

  if (hideAppChrome(pathname)) return null;

  const focused = tabFromPathname(pathname) ?? lastTab;

  return (
    <GlassSurface
      style={[
        styles.wrap,
        {
          paddingBottom: Math.max(insets.bottom, 6),
          borderTopColor: c.hairline,
        },
      ]}>
      <View style={styles.tabs}>
        {APP_TABS.map((tab) => {
          const selected = !createOpen && focused === tab.key;
          const color = selected ? c.text : c.textMuted;
          return (
            <Pressable
              key={tab.key}
              onPress={() => openTab(router, tab.key)}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}>
              <Ionicons name={selected ? tab.on : tab.off} size={22} color={color} />
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={toggleCreate}
          style={styles.tab}
          accessibilityRole="tab"
          accessibilityState={{ selected: createOpen }}
          accessibilityLabel="Create">
          <View style={createOpen ? [styles.createOn, { backgroundColor: c.text }] : undefined}>
            <Ionicons name={createOpen ? 'close' : 'add'} size={22} color={createOpen ? c.bg : c.textMuted} />
          </View>
          <Text style={[styles.label, { color: createOpen ? c.bg : c.textMuted }]} numberOfLines={1}>
            {createOpen ? '' : 'Create'}
          </Text>
        </Pressable>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 25,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabs: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: { fontSize: 9, fontWeight: '600' },
  createOn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
