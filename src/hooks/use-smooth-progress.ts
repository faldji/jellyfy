import { useEffect, useRef } from 'react';
import { cancelAnimation, Easing, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { clamp01 } from '@/lib/media-buffer';

/**
 * Playhead ratio that runs at 60fps while audio is playing.
 * Store ticks (~250ms) only correct drift; seeks and pause snap.
 */
export function useSmoothProgress(
  position: number,
  duration: number,
  playing: boolean,
  frozen = false
): SharedValue<number> {
  const progress = useSharedValue(duration > 0 ? clamp01(position / duration) : 0);
  const running = useRef(false);

  useEffect(() => {
    const target = duration > 0 ? clamp01(position / duration) : 0;

    if (frozen || !playing || !(duration > 0) || position >= duration - 0.05) {
      running.current = false;
      cancelAnimation(progress);
      progress.value = target;
      return;
    }

    const drift = Math.abs(progress.value - target);
    if (running.current && drift <= 0.012) return;

    running.current = true;
    cancelAnimation(progress);
    progress.value = target;
    progress.value = withTiming(
      1,
      {
        duration: Math.max(0, duration - position) * 1000,
        easing: Easing.linear,
      },
      (finished) => {
        if (finished) running.current = false;
      }
    );
  }, [duration, frozen, playing, position, progress]);

  return progress;
}
