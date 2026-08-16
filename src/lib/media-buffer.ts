/** Minimal TimeRanges shape (HTMLMediaElement.buffered / seekable). */
export type TimeRangeList = {
  length: number;
  start: (index: number) => number;
  end: (index: number) => number;
};

export type BufferRange = {
  start: number;
  end: number;
};

/**
 * Range that contains `time`, matching how HTML5 / YouTube draw the loaded bar.
 * Does not invent a lookahead when nothing is buffered.
 */
export function rangeContaining(ranges: TimeRangeList | null | undefined, time: number): BufferRange | null {
  if (!ranges || !ranges.length) return null;
  const t = Number.isFinite(time) ? Math.max(0, time) : 0;
  try {
    for (let i = 0; i < ranges.length; i += 1) {
      const start = ranges.start(i);
      const end = ranges.end(i);
      if (t >= start - 0.5 && t <= end + 0.35) {
        return { start, end };
      }
    }
    let best: BufferRange | null = null;
    for (let i = 0; i < ranges.length; i += 1) {
      const start = ranges.start(i);
      const end = ranges.end(i);
      if (start <= t + 0.5) best = { start, end };
    }
    return best;
  } catch {
    return null;
  }
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** CSS-style left/right percents for a loaded region on a 0..duration bar. */
export function bufferBarInsets(
  duration: number,
  bufferedStart: number,
  bufferedEnd: number
): { left: number; right: number } {
  if (!(duration > 0)) return { left: 0, right: 100 };
  const start = clamp01(bufferedStart / duration);
  const end = Math.max(start, clamp01(bufferedEnd / duration));
  return { left: start * 100, right: (1 - end) * 100 };
}
