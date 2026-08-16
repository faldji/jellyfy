import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  Easing,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const SNAP = { damping: 26, stiffness: 280, mass: 0.85 };
const OUT = { duration: 280, easing: Easing.bezier(0.32, 0.72, 0, 1) };
const IN = { duration: 420, easing: Easing.bezier(0.2, 0.85, 0.2, 1) };

type Options = {
  active?: boolean;
  /** Drive the sheet ourselves (transparent modal). */
  animateIn?: boolean;
};

/** Swipe down to dismiss a sheet that uses a downward close control. */
export function useSwipeDownClose(onClose: () => void, options: boolean | Options = true) {
  const opts: Options = typeof options === 'boolean' ? { active: options } : options;
  const active = opts.active ?? true;
  const animateIn = Boolean(opts.animateIn);
  const { height } = useWindowDimensions();
  const sheetY = useSharedValue(animateIn ? height : 0);
  const scrollY = useSharedValue(0);
  const dragging = useSharedValue(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const finish = useCallback(() => onCloseRef.current(), []);

  const slideOut = useCallback(() => {
    sheetY.value = withTiming(height, OUT, (done) => {
      if (done) runOnJS(finish)();
    });
  }, [finish, height, sheetY]);

  const dismiss = useCallback(() => {
    if (animateIn) {
      slideOut();
      return;
    }
    finish();
  }, [animateIn, finish, slideOut]);

  const playIn = useCallback(() => {
    if (!active) return;
    if (animateIn) {
      sheetY.value = withTiming(0, IN);
      return;
    }
    sheetY.value = 0;
  }, [active, animateIn, sheetY]);

  useEffect(() => {
    playIn();
  }, [playIn]);

  useFocusEffect(
    useCallback(() => {
      // Reused native-stack screens keep the last translateY (off-screen after dismiss).
      if (!active || !animateIn) return;
      if (sheetY.value > 8) sheetY.value = withTiming(0, IN);
    }, [active, animateIn, sheetY])
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
    onBeginDrag: (event) => {
      scrollY.value = event.contentOffset.y;
    },
    onEndDrag: (event) => {
      scrollY.value = event.contentOffset.y;
    },
    onMomentumEnd: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const makePan = useCallback(
    (ignoreScroll: boolean) =>
      Gesture.Pan()
        .activeOffsetY(12)
        .failOffsetX([-32, 32])
        .onUpdate((e) => {
          if (dragging.value === 0 && (e.translationY < 0 || (!ignoreScroll && scrollY.value > 4))) {
            return;
          }
          dragging.value = 1;
          sheetY.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          const pulled = dragging.value === 1;
          dragging.value = 0;
          if (!pulled) return;
          if (e.translationY > height * 0.18 || e.velocityY > 900) {
            sheetY.value = withTiming(height, OUT, (done) => {
              if (done) runOnJS(finish)();
            });
            return;
          }
          sheetY.value = withSpring(0, SNAP);
        })
        .onFinalize(() => {
          dragging.value = 0;
        }),
    [finish, height, sheetY]
  );

  const gesture = useMemo(() => makePan(false), [makePan]);
  const createHandle = useCallback(() => makePan(true), [makePan]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, sheetY.value / Math.max(1, height * 0.72)),
  }));

  return { gesture, createHandle, style, backdropStyle, dismiss, onScroll, scrollY, sheetY };
}

export function SheetGrabber({ color }: { color: string }) {
  return <View style={[styles.grabber, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    marginBottom: 6,
    opacity: 0.55,
  },
});
