import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColors } from '@/theme/useColors';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  variant?: 'inverse' | 'surface';
  style?: StyleProp<ViewStyle>;
  onSubmit?: () => void;
};

export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  variant = 'inverse',
  style,
  onSubmit,
}: Props) {
  const c = useColors();
  const inverse = variant === 'inverse';
  const bg = inverse ? c.text : c.glass;
  const fg = inverse ? c.bg : c.text;
  const muted = inverse ? (c.isDark ? '#6A6A6A' : '#8A8A8A') : c.textMuted;

  return (
    <View style={[styles.box, { backgroundColor: bg, borderColor: inverse ? 'transparent' : c.hairline }, style]}>
      <Ionicons name="search" size={18} color={muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={muted}
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
        returnKeyType="search"
        underlineColorAndroid="transparent"
        clearButtonMode="never"
        onSubmitEditing={onSubmit}
        accessibilityLabel={placeholder}
        style={[styles.input, { color: fg }, webNoOutline]}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search">
          <Ionicons name="close" size={18} color={muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 24,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 10,
  },
});

const webNoOutline = { outlineWidth: 0, outlineStyle: 'none' } as Record<string, string | number>;
