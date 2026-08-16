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

/** Native loop / a replace after ended() often leaves currentTime at the previous duration. */
export function playheadLooksStuckAtEnd(
  currentTime: number,
  duration: number,
  didJustFinish: boolean,
  requestedStart: number
): boolean {
  if (requestedStart > 0.05) return false;
  if (didJustFinish && currentTime > 1) return true;
  if (!(currentTime > 1.25)) return false;
  if (duration > 2 && currentTime >= duration - 1) return true;
  return currentTime > 1.25 && requestedStart <= 0.05;
}

export function isNativeLoopWrap(prevTime: number, currentTime: number, duration: number): boolean {
  if (!(duration > 2) || !(prevTime > 0)) return false;
  return prevTime >= duration * 0.8 && currentTime < 2;
}
