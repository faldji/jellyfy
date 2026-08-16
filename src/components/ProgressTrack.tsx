import { useEffect } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { bufferBarInsets } from '@/lib/media-buffer';

type Props = {
  progress: SharedValue<number>;
  duration: number;
  buffered?: number;
  bufferedStart?: number;
  height: number;
  accent: string;
  bufferColor: string;
  trackColor: string;
  onWidth?: (width: number) => void;
};

/** Dark track + loaded region + solid played fill (pixel width, no % layout). */
export function ProgressTrack({
  progress,
  duration,
  buffered,
  bufferedStart = 0,
  height,
  accent,
  bufferColor,
  trackColor,
  onWidth,
}: Props) {
  const width = useSharedValue(1);
  const bufferLeft = useSharedValue(0);
  const bufferRight = useSharedValue(100);

  useEffect(() => {
    const insets = bufferBarInsets(duration, bufferedStart, buffered ?? bufferedStart);
    bufferLeft.value = insets.left;
    bufferRight.value = insets.right;
  }, [bufferLeft, bufferRight, buffered, bufferedStart, duration]);

  const bufferStyle = useAnimatedStyle(() => ({
    left: `${bufferLeft.value}%`,
    right: `${bufferRight.value}%`,
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(0, width.value * progress.value),
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.max(1, e.nativeEvent.layout.width);
    width.value = next;
    onWidth?.(next);
  };

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }]} onLayout={onLayout}>
      <Animated.View style={[styles.layer, { height, backgroundColor: bufferColor }, bufferStyle]} />
      <Animated.View style={[styles.layer, { height, backgroundColor: accent }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 2,
  },
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
});
