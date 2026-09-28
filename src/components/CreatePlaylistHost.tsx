import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCreatePlaylist } from '@/api/hooks';
import { radii, spacing } from '@/constants/theme';
import { SheetBackdrop, SheetGrabber, SheetSurface, useSwipeDownClose } from '@/hooks/use-swipe-down-close';
import { useUi } from '@/store/ui';
import { useColors } from '@/theme/useColors';

export function CreatePlaylistForm({ onClose, interceptBack = false }: { onClose: () => void; interceptBack?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const create = useCreatePlaylist();
  const [name, setName] = useState('');
  const pendingId = useRef<string | null>(null);
  const { gesture, style, backdropStyle, dismiss } = useSwipeDownClose(
    () => {
      const id = pendingId.current;
      pendingId.current = null;
      onClose();
      if (id) router.push({ pathname: '/playlist/[id]', params: { id } });
    },
    { animateIn: true, interceptBack }
  );

  return (
    <View style={styles.overlay}>
      <SheetBackdrop style={backdropStyle} />
      <SheetSurface wash={c.bg} style={[styles.sheet, style, { paddingBottom: insets.bottom + 24 }]}>
      <GestureDetector gesture={gesture}>
        <View>
          <SheetGrabber color={c.textMuted} />
        </View>
      </GestureDetector>
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
          <Pressable onPress={dismiss} style={[styles.cancel, { borderColor: c.textMuted }]}>
            <Text style={[styles.cancelText, { color: c.text }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const trimmed = name.trim() || 'My playlist';
              create.mutate(
                { name: trimmed },
                {
                  onSuccess: (result) => {
                    pendingId.current = result.id ?? null;
                    dismiss();
                  },
                }
              );
            }}
            style={[styles.create, { backgroundColor: c.accent }]}>
            <Text style={[styles.createText, { color: c.onAccent }]}>Create</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      </SheetSurface>
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
      transparent
      animationType="none"
      onRequestClose={close}
      presentationStyle="overFullScreen"
      statusBarTranslucent>
      {open ? <CreatePlaylistForm onClose={close} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  sheet: { paddingTop: 8, paddingHorizontal: spacing.xl },
  fill: { paddingBottom: 12 },
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
