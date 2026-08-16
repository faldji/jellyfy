import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radii, spacing } from '@/constants/theme';
import { usePlayer } from '@/store/player';
import { useRecents } from '@/store/recents';
import { useToast } from '@/store/toast';
import { useUi } from '@/store/ui';
import { useColors } from '@/theme/useColors';

export function CreateSheet() {
  const open = useUi((s) => s.createOpen);
  const close = useUi((s) => s.closeCreate);
  const openCreatePlaylist = useUi((s) => s.openCreatePlaylist);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();

  const go = (href: Href) => {
    close();
    router.push(href);
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={close}
      presentationStyle="overFullScreen"
      statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: c.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { backgroundColor: c.bg, paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={styles.row} onPress={openCreatePlaylist}>
            <View style={[styles.icon, { backgroundColor: c.accent }]}>
              <Ionicons name="musical-notes-outline" size={22} color={c.onAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: c.text }]}>Playlist</Text>
              <Text style={[styles.sub, { color: c.textSub }]}>Create a playlist with songs from your library</Text>
            </View>
          </Pressable>
          <Pressable
            style={styles.row}
            onPress={() => {
              const seed = usePlayer.getState().current ?? useRecents.getState().items[0];
              if (!seed) {
                close();
                useToast.getState().show('Play a song first to start radio');
                return;
              }
              go({ pathname: '/radio/[id]', params: { id: seed.id } });
            }}>
            <View style={[styles.icon, { backgroundColor: c.accent }]}>
              <Ionicons name="radio-outline" size={22} color={c.onAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: c.text }]}>Radio</Text>
              <Text style={[styles.sub, { color: c.textSub }]}>A station based on what you are playing</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700' },
  sub: { fontSize: 13, marginTop: 2, lineHeight: 18 },
});
