import { StyleSheet, Text, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { useColors } from '@/theme/useColors';

type Props = {
  title: string;
  subtitle?: string;
};

export function EmptyState({ title, subtitle }: Props) {
  const c = useColors();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: c.textSub }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 48,
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
