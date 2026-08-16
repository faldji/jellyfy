import { useEffect, useId, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radii, spacing } from '@/constants/theme';
import { useColors } from '@/theme/useColors';

export type SheetAction = {
  key: string;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
};

type Presented = Props & { id: string };

const listeners = new Set<(sheet: Presented | null) => void>();
let current: Presented | null = null;

function publish(next: Presented | null) {
  current = next;
  listeners.forEach((fn) => fn(next));
}

/** Renders the sheet above stack modals (now playing, queue). Mount once in the app shell. */
export function ActionSheetHost() {
  const [sheet, setSheet] = useState<Presented | null>(current);
  const insets = useSafeAreaInsets();
  const c = useColors();

  useEffect(() => {
    listeners.add(setSheet);
    return () => {
      listeners.delete(setSheet);
    };
  }, []);

  const close = () => sheet?.onClose();

  return (
    <Modal
      visible={Boolean(sheet)}
      transparent
      animationType="fade"
      onRequestClose={close}
      presentationStyle="overFullScreen"
      statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: c.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { backgroundColor: c.bg, paddingBottom: insets.bottom + spacing.md }]}>
          {sheet?.title ? <Text style={[styles.title, { color: c.text }]}>{sheet.title}</Text> : null}
          {sheet?.subtitle ? <Text style={[styles.sub, { color: c.textSub }]}>{sheet.subtitle}</Text> : null}
          {(sheet?.actions ?? []).map((action) => (
            <Pressable
              key={action.key}
              disabled={action.disabled}
              onPress={() => {
                close();
                action.onPress();
              }}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.elevate }]}>
              <Text
                style={[
                  styles.label,
                  { color: c.text },
                  action.destructive && { color: c.danger },
                  action.disabled && { color: c.textMuted },
                ]}>
                {action.label}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={close} style={[styles.cancel, { backgroundColor: c.elevate }]}>
            <Text style={[styles.cancelText, { color: c.text }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function ActionSheet({ visible, title, subtitle, actions, onClose }: Props) {
  const id = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) {
      publish({
        id,
        visible,
        title,
        subtitle,
        actions,
        onClose: () => onCloseRef.current(),
      });
      return;
    }
    if (current?.id === id) publish(null);
  }, [actions, id, subtitle, title, visible]);

  useEffect(
    () => () => {
      if (current?.id === id) publish(null);
    },
    [id]
  );

  return null;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.lg,
  },
  title: { fontSize: 16, fontWeight: '800', paddingHorizontal: spacing.lg },
  sub: { fontSize: 13, paddingHorizontal: spacing.lg, marginTop: 4, marginBottom: spacing.sm },
  row: { paddingHorizontal: spacing.lg, paddingVertical: 14 },
  label: { fontSize: 16, fontWeight: '600' },
  cancel: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    borderRadius: radii.pill,
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelText: { fontWeight: '800', fontSize: 15 },
});
