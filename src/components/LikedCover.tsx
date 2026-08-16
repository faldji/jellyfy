import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { useColors } from '@/theme/useColors';

export function LikedCover({ size = 56 }: { size?: number }) {
  const c = useColors();
  return (
    <LinearGradient
      colors={[c.accentDim, c.accent, c.accentPress]}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={[styles.box, { width: size, height: size, borderRadius: size > 80 ? 8 : 4 }]}>
      <Ionicons name="heart" size={size * 0.42} color={c.onAccent} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
