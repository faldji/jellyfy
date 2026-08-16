import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { playback } from '@/playback/engine';

const REST = [0.26, 0.42, 0.22, 0.36, 0.3];
const PEAK = [0.78, 1, 0.62, 0.92, 0.7];
const LOW = [0.18, 0.28, 0.16, 0.24, 0.2];

type Props = {
  playing: boolean;
  color: string;
  height?: number;
};

function Bar({
  value,
  color,
  maxH,
  width,
}: {
  value: SharedValue<number>;
  color: string;
  maxH: number;
  width: number;
}) {
  const style = useAnimatedStyle(() => ({
    height: Math.max(2, value.value * maxH),
    width,
    borderRadius: width / 2,
    backgroundColor: color,
  }));
  return <Animated.View style={style} />;
}

function bounce(bar: SharedValue<number>, peak: number, low: number, delay: number) {
  bar.value = withRepeat(
    withSequence(
      withTiming(peak, { duration: 170 + delay, easing: Easing.inOut(Easing.quad) }),
      withTiming(low, { duration: 150 + delay, easing: Easing.inOut(Easing.quad) })
    ),
    -1,
    true
  );
}

/** Compact equalizer. Live samples on web when the player allows; otherwise loops while playing. */
export function SpectrumBars({ playing, color, height = 18 }: Props) {
  const b0 = useSharedValue(REST[0]);
  const b1 = useSharedValue(REST[1]);
  const b2 = useSharedValue(REST[2]);
  const b3 = useSharedValue(REST[3]);
  const b4 = useSharedValue(REST[4]);
  const bars = [b0, b1, b2, b3, b4];
  const live = useSharedValue(0);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    return playback.subscribeSamples((levels) => {
      if (!playingRef.current) return;
      if (!live.value) {
        bars.forEach((bar) => cancelAnimation(bar));
      }
      live.value = 1;
      bars.forEach((bar, i) => {
        bar.value = withTiming(Math.max(0.08, Math.min(1, levels[i] ?? 0)), { duration: 55 });
      });
    });
  }, [b0, b1, b2, b3, b4, live]);

  useEffect(() => {
    if (!playing) {
      live.value = 0;
      bars.forEach((bar, i) => {
        cancelAnimation(bar);
        bar.value = withTiming(REST[i], { duration: 200 });
      });
      return;
    }
    const start = setTimeout(() => {
      if (live.value) return;
      bars.forEach((bar, i) => bounce(bar, PEAK[i], LOW[i], i * 32));
    }, 120);
    return () => {
      clearTimeout(start);
      bars.forEach((bar) => cancelAnimation(bar));
    };
  }, [b0, b1, b2, b3, b4, live, playing]);

  const width = Math.max(2, Math.round(height / 7));

  return (
    <View style={[styles.row, { height, gap: Math.max(2, width - 1) }]} accessibilityElementsHidden>
      {bars.map((bar, i) => (
        <Bar key={i} value={bar} color={color} maxH={height} width={width} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
