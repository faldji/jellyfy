import { Pressable, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/store/auth';
import { useColors } from '@/theme/useColors';

export function UserAvatar({ onPress, size = 32 }: { onPress?: () => void; size?: number }) {
  const name = useAuth((s) => s.session?.userName) ?? 'J';
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Account"
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.accent,
        },
      ]}>
      <Text style={[styles.letter, { fontSize: size * 0.42, color: c.onAccent }]}>{name.slice(0, 1).toUpperCase()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  letter: { fontWeight: '800' },
});
