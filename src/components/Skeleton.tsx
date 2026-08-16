import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radii } from '@/constants/theme';
import { useColors } from '@/theme/useColors';

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.block, { backgroundColor: c.elevate }, animated, style]} />;
}

const styles = StyleSheet.create({
  block: {
    borderRadius: radii.md,
  },
});
