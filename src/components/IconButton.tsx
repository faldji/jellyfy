import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useColors } from '@/theme/useColors';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  onPress?: () => void;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  disabled?: boolean;
};

export function IconButton({
  name,
  size = 24,
  color,
  onPress,
  hitSlop = 10,
  style,
  accessibilityLabel,
  disabled,
}: Props) {
  const theme = useColors();
  const iconColor = color ?? theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress?.();
      }}
      hitSlop={hitSlop}
      style={({ pressed }) => [{ opacity: disabled ? 0.35 : pressed ? 0.55 : 1 }, style]}>
      <Ionicons name={name} size={size} color={iconColor} />
    </Pressable>
  );
}
