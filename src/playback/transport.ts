/** Pure playback/SR helpers so repeat and leave events stay deterministic. */

export type LeaveKind = 'SKIP' | 'PLAY_COMPLETE';

export function leaveEventType(
  position: number,
  duration: number,
  naturalEnd: boolean
): LeaveKind {
  const nearEnd =
    duration > 0 && (naturalEnd || duration - position <= 3 || position / duration >= 0.9);
  return nearEnd ? 'PLAY_COMPLETE' : 'SKIP';
}

/**
 * replace() often keeps the previous item's currentTime.
 * Real playback cannot get this far ahead of the time since the source opened.
 */
export function playheadLooksStuckAtEnd(
  currentTime: number,
  elapsedSinceLoadMs: number,
  requestedStart: number
): boolean {
  if (requestedStart > 0.05) return false;
  if (!(currentTime > 1.25)) return false;
  const elapsedSec = Math.max(0, elapsedSinceLoadMs) / 1000;
  return currentTime > elapsedSec + 1.5;
}

export function isNativeLoopWrap(prevTime: number, currentTime: number, duration: number): boolean {
  if (!(duration > 2) || !(prevTime > 0)) return false;
  return prevTime >= duration * 0.8 && currentTime < 2;
}
