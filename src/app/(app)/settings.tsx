import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { StreamQuality } from '@/api/types';
import { GlassSurface } from '@/components/GlassSurface';
import { HomeLayoutEditor } from '@/components/HomeLayoutEditor';
import { IconButton } from '@/components/IconButton';
import { useNowPlayingPadding } from '@/components/MiniPlayer';
import { resolveDeviceName } from '@/lib/device';
import { normalizeServerUrl } from '@/lib/format';
import { closeOverlay } from '@/lib/navigation';
import { PLAY_ALL_LIMITS } from '@/lib/play-all';
import { radii, spacing } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import { usePlayer } from '@/store/player';
import { useRecents } from '@/store/recents';
import { useSettings } from '@/store/settings';
import { ACCENT_SWATCHES, previewColors, THEME_META, type AccentId } from '@/theme/palettes';
import { useColors } from '@/theme/useColors';

const QUALITIES: { key: StreamQuality; label: string; hint: string }[] = [
  { key: 'original', label: 'Original', hint: 'Best available · MP3 in the browser' },
  { key: 'high', label: 'High', hint: '320 kbps' },
  { key: 'normal', label: 'Normal', hint: '192 kbps' },
  { key: 'low', label: 'Low', hint: '96 kbps' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const session = useAuth((s) => s.session);
  const logout = useAuth((s) => s.logout);
  const quality = useSettings((s) => s.quality);
  const setQuality = useSettings((s) => s.setQuality);
  const themeId = useSettings((s) => s.themeId);
  const setThemeId = useSettings((s) => s.setThemeId);
  const accentId = useSettings((s) => s.accentId);
  const setAccentId = useSettings((s) => s.setAccentId);
  const playAllLimit = useSettings((s) => s.playAllLimit);
  const setPlayAllLimit = useSettings((s) => s.setPlayAllLimit);
  const srEnabled = useSettings((s) => s.srEnabled);
  const srBaseUrl = useSettings((s) => s.srBaseUrl);
  const setSrEnabled = useSettings((s) => s.setSrEnabled);
  const setSrBaseUrl = useSettings((s) => s.setSrBaseUrl);
  const bottomPad = useNowPlayingPadding();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: bottomPad }}>
      <View style={styles.nav}>
        <IconButton name="chevron-back" accessibilityLabel="Back" onPress={() => closeOverlay(router)} />
        <Text style={[styles.title, { color: c.text }]}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={[styles.section, { color: c.textSub }]}>Account</Text>
      <GlassSurface style={[styles.card, { borderColor: c.hairline }]}>
        <Text style={[styles.rowTitle, { color: c.text }]}>{session?.userName}</Text>
        <Text style={[styles.hint, { color: c.textSub }]}>{session?.serverName}</Text>
        <Text style={[styles.hint, { color: c.textSub }]}>{session?.serverUrl}</Text>
        <Text style={[styles.hint, { color: c.textSub }]}>{resolveDeviceName()}</Text>
      </GlassSurface>

      <Text style={[styles.section, { color: c.textSub }]}>Theme</Text>
      <Text style={[styles.blurb, { color: c.textMuted }]}>Choose how the app looks.</Text>
      <View style={styles.themeGrid}>
        {THEME_META.map((item) => {
          const preview = previewColors(item.id);
          const active = themeId === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setThemeId(item.id)}
              style={[
                styles.themeCard,
                {
                  backgroundColor: preview.bg,
                  borderColor: active ? c.accent : preview.hairline,
                },
              ]}>
              <View style={styles.themeSwatches}>
                <View style={[styles.dot, { backgroundColor: preview.accent }]} />
                <View style={[styles.dot, { backgroundColor: preview.elevate }]} />
                <View style={[styles.dot, { backgroundColor: preview.text }]} />
              </View>
              <Text style={[styles.themeName, { color: preview.text }]}>{item.label}</Text>
              <Text style={[styles.themeHint, { color: preview.textMuted }]} numberOfLines={2}>
                {item.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.section, { color: c.textSub }]}>Accent color</Text>
      <View style={styles.accentRow}>
        {ACCENT_SWATCHES.map((item) => {
          const hex = item.id === 'theme' ? c.accent : item.hex;
          const active = accentId === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setAccentId(item.id as AccentId)}
              accessibilityLabel={item.label}
              style={[
                styles.accentDot,
                {
                  backgroundColor: hex,
                  borderColor: active ? c.text : 'transparent',
                },
              ]}>
              {item.id === 'theme' ? <Text style={[styles.accentT, { color: c.onAccent }]}>T</Text> : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.section, { color: c.textSub }]}>Smart Recommendations</Text>
      <Text style={[styles.blurb, { color: c.textMuted }]}>
        Optional plugin. When off, Jellyfy uses Jellyfin only. The service URL is separate from your Jellyfin address.
      </Text>
      <Pressable
        style={[styles.option, { borderBottomColor: c.hairline }]}
        onPress={() => setSrEnabled(!srEnabled)}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: c.text }]}>Use Smart Recommendations</Text>
          <Text style={[styles.hint, { color: c.textSub }]}>
            {srEnabled && !normalizeServerUrl(srBaseUrl)
              ? 'Add a service URL below to turn this on'
              : srEnabled
                ? 'Radio, Home recommendations, and listening events'
                : 'Disabled'}
          </Text>
        </View>
        <View
          style={[
            styles.radio,
            { borderColor: srEnabled ? c.accent : c.textMuted, backgroundColor: srEnabled ? c.accent : 'transparent' },
          ]}
        />
      </Pressable>
      <TextInput
        value={srBaseUrl}
        onChangeText={setSrBaseUrl}
        onBlur={() => setSrBaseUrl(normalizeServerUrl(srBaseUrl))}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="https://sr.example.com"
        placeholderTextColor={c.textMuted}
        style={[styles.urlInput, { backgroundColor: c.elevate, color: c.text }]}
      />

      <Text style={[styles.section, { color: c.textSub }]}>Home</Text>
      <HomeLayoutEditor />

      <Text style={[styles.section, { color: c.textSub }]}>Play all limit</Text>
      <Text style={[styles.blurb, { color: c.textMuted }]}>
        How many songs to queue when you play an album, artist, or playlist.
      </Text>
      {PLAY_ALL_LIMITS.map((item) => {
        const active = playAllLimit === item.key;
        return (
          <Pressable
            key={item.key}
            style={[styles.option, { borderBottomColor: c.hairline }]}
            onPress={() => setPlayAllLimit(item.key)}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: c.text }]}>{item.label}</Text>
              <Text style={[styles.hint, { color: c.textSub }]}>{item.hint}</Text>
            </View>
            <View
              style={[
                styles.radio,
                { borderColor: active ? c.accent : c.textMuted, backgroundColor: active ? c.accent : 'transparent' },
              ]}
            />
          </Pressable>
        );
      })}

      <Text style={[styles.section, { color: c.textSub }]}>Streaming quality</Text>
      {QUALITIES.map((item) => {
        const active = quality === item.key;
        return (
          <Pressable
            key={item.key}
            style={[styles.option, { borderBottomColor: c.hairline }]}
            onPress={() => {
              if (quality === item.key) return;
              setQuality(item.key);
              void usePlayer.getState().reloadCurrent();
            }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: c.text }]}>{item.label}</Text>
              <Text style={[styles.hint, { color: c.textSub }]}>{item.hint}</Text>
            </View>
            <View
              style={[
                styles.radio,
                { borderColor: active ? c.accent : c.textMuted, backgroundColor: active ? c.accent : 'transparent' },
              ]}
            />
          </Pressable>
        );
      })}

      <Pressable style={[styles.option, { borderBottomColor: c.hairline }]} onPress={() => useRecents.getState().clear()}>
        <Text style={[styles.rowTitle, { color: c.text }]}>Clear recently played</Text>
      </Pressable>

      <Pressable
        style={[styles.option, { marginTop: 24, borderBottomColor: 'transparent' }]}
        onPress={() => {
          void logout().then(() => router.replace('/login'));
        }}>
        <Text style={[styles.rowTitle, { color: c.danger }]}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: 16,
  },
  title: { fontWeight: '800', fontSize: 16 },
  section: {
    fontWeight: '800',
    textTransform: 'uppercase',
    fontSize: 12,
    paddingHorizontal: spacing.lg,
    marginTop: 22,
    marginBottom: 8,
  },
  blurb: { paddingHorizontal: spacing.lg, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  card: {
    marginHorizontal: spacing.lg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  themeGrid: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  themeCard: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 2,
    padding: 12,
    minHeight: 96,
  },
  themeSwatches: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  themeName: { fontWeight: '800', fontSize: 15 },
  themeHint: { fontSize: 11, marginTop: 2 },
  accentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: spacing.lg,
    marginTop: 4,
  },
  accentDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentT: { color: '#fff', fontWeight: '900', fontSize: 12 },
  option: {
    marginHorizontal: spacing.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  hint: { marginTop: 2 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  urlInput: {
    marginHorizontal: spacing.lg,
    marginTop: 8,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
});
