import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCreatePlaylist } from '@/api/hooks';
import { radii, spacing } from '@/constants/theme';
import { useUi } from '@/store/ui';
import { useColors } from '@/theme/useColors';

export function CreatePlaylistForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const create = useCreatePlaylist();
  const [name, setName] = useState('');

  return (
    <View style={[styles.screen, { backgroundColor: c.bg, paddingTop: insets.top + 12 }]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={[styles.heading, { color: c.text }]}>Give your playlist a name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          autoFocus
          placeholder="My playlist"
          placeholderTextColor={c.textMuted}
          style={[styles.input, { color: c.text, borderBottomColor: c.text }]}
        />
        <View style={styles.actions}>
          <Pressable onPress={onClose} style={[styles.cancel, { borderColor: c.textMuted }]}>
            <Text style={[styles.cancelText, { color: c.text }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const trimmed = name.trim() || 'My playlist';
              create.mutate(
                { name: trimmed },
                {
                  onSuccess: (result) => {
                    onClose();
                    if (result.id) router.push({ pathname: '/playlist/[id]', params: { id: result.id } });
                  },
                }
              );
            }}
            style={[styles.create, { backgroundColor: c.accent }]}>
            <Text style={[styles.createText, { color: c.onAccent }]}>Create</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Renders above stack modals. Mount once in the app shell. */
export function CreatePlaylistHost() {
  const open = useUi((s) => s.createPlaylistOpen);
  const close = useUi((s) => s.closeCreatePlaylist);
  return (
    <Modal
      visible={open}
      animationType="slide"
      onRequestClose={close}
      presentationStyle="overFullScreen"
      statusBarTranslucent>
      {open ? <CreatePlaylistForm onClose={close} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'center' },
  heading: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 36 },
  input: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    borderBottomWidth: 2,
    paddingVertical: 8,
  },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 28 },
  cancel: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  cancelText: { fontWeight: '800', fontSize: 16 },
  create: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: radii.pill },
  createText: { fontWeight: '800', fontSize: 16 },
});
