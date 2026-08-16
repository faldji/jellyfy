import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/GlassSurface';
import { radii, spacing } from '@/constants/theme';
import { useToast } from '@/store/toast';
import { useColors } from '@/theme/useColors';

export function ToastHost() {
  const message = useToast((s) => s.message);
  const insets = useSafeAreaInsets();
  const c = useColors();
  if (!message) return null;
  return (
    <View style={[styles.wrap, { top: insets.top + 12 }]}>
      <GlassSurface style={[styles.pill, { borderColor: c.accent }]}>
        <Text style={[styles.text, { color: c.text }]}>{message}</Text>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
    pointerEvents: 'none',
  },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radii.pill,
    maxWidth: '88%',
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
  },
  text: { fontWeight: '700', fontSize: 13, textAlign: 'center' },
});
