import { useCallback, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";

import { ProgressTrack } from "@/components/ProgressTrack";
import { useSmoothProgress } from "@/hooks/use-smooth-progress";
import { hexAlpha } from "@/lib/color";
import { formatDuration } from "@/lib/format";
import { useColors } from "@/theme/useColors";

type Props = {
  position: number;
  duration: number;
  playing?: boolean;
  buffered?: number;
  bufferedStart?: number;
  onSeek: (seconds: number) => void;
  showTimes?: boolean;
};

export function SeekBar({
  position,
  duration,
  playing = false,
  buffered,
  bufferedStart = 0,
  onSeek,
  showTimes = true,
}: Props) {
  const c = useColors();
  const [width, setWidth] = useState(1);
  const [draggingJs, setDraggingJs] = useState(false);
  const dragging = useSharedValue(false);
  const dragRatio = useSharedValue(0);
  const barWidth = useSharedValue(1);
  const clock = useSmoothProgress(position, duration, playing, draggingJs);
  const shown = useDerivedValue(() =>
    dragging.value ? dragRatio.value : clock.value,
  );

  const durationRef = useRef(duration);
  const onSeekRef = useRef(onSeek);
  const widthRef = useRef(width);
  durationRef.current = duration;
  onSeekRef.current = onSeek;
  widthRef.current = width;

  const commitFromX = useCallback((x: number) => {
    const dur = durationRef.current;
    const w = Math.max(1, widthRef.current);
    if (!(dur > 0)) return;
    const ratio = Math.min(1, Math.max(0, x / w));
    onSeekRef.current(ratio * dur);
  }, []);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .activeOffsetX([-4, 4])
        .failOffsetY([-16, 16])
        .hitSlop(16)
        .onBegin((e) => {
          dragging.value = true;
          runOnJS(setDraggingJs)(true);
          const w = Math.max(1, barWidth.value);
          dragRatio.value = Math.min(1, Math.max(0, e.x / w));
        })
        .onUpdate((e) => {
          const w = Math.max(1, barWidth.value);
          dragRatio.value = Math.min(1, Math.max(0, e.x / w));
        })
        .onEnd((e) => {
          dragging.value = false;
          runOnJS(setDraggingJs)(false);
          runOnJS(commitFromX)(e.x);
        })
        .onFinalize(() => {
          dragging.value = false;
          runOnJS(setDraggingJs)(false);
        }),
    [barWidth, commitFromX, dragRatio, dragging],
  );

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shown.value * barWidth.value }],
    opacity: dragging.value ? 1 : 0.85,
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.max(1, e.nativeEvent.layout.width);
    setWidth(w);
    barWidth.value = w;
    widthRef.current = w;
  };
  const remaining = Math.max(0, duration - position);

  return (
    <View>
      <GestureDetector gesture={gesture}>
        <View
          style={[styles.hit, Platform.OS === "web" ? webNoTouch : null]}
          onLayout={onLayout}
          accessibilityRole="adjustable"
          accessibilityLabel="Seek"
        >
          <ProgressTrack
            progress={shown}
            duration={duration}
            buffered={buffered}
            bufferedStart={bufferedStart}
            height={3}
            accent={c.accent}
            bufferColor={hexAlpha(c.accent, c.isDark ? 0.15 : 0.25)}
            trackColor={c.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}
          />
          <Animated.View
            style={[
              styles.thumb,
              thumbStyle,
              { backgroundColor: c.accent, pointerEvents: "none" },
            ]}
          />
        </View>
      </GestureDetector>
      {showTimes ? (
        <View style={styles.times}>
          <Text style={[styles.time, { color: c.textSub }]}>
            {formatDuration(position)}
          </Text>
          <Text style={[styles.time, { color: c.textSub }]}>
            -{formatDuration(remaining)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const webNoTouch = { touchAction: "none" } as Record<string, string>;

const styles = StyleSheet.create({
  hit: { height: 28, justifyContent: "center" },
  thumb: {
    position: "absolute",
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  times: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  time: { fontSize: 11, fontVariant: ["tabular-nums"] },
});
