import type { AudioLockScreenOptions } from 'expo-audio';

/** Jump larger than this, and larger than time spent since the last tick, is a remote scrub. */
export const EXTERNAL_SEEK_SECONDS = 1.5;

/** Collapse duplicate notification and headset deliveries of one press. */
export const REMOTE_SKIP_GAP_MS = 280;

export type RepeatModeName = 'off' | 'all' | 'one';

export type LockScreenControls = AudioLockScreenOptions & {
  showNextTrack: boolean;
  showPreviousTrack: boolean;
  showShuffle: boolean;
  showRepeat: boolean;
  shuffleEnabled: boolean;
  repeatMode: RepeatModeName;
  durationMs: number;
  positionOffsetMs: number;
  accentColor: string;
  iconColor: string;
  mutedColor: string;
};

/**
 * Previous, play/pause, next, and the system scrubber.
 * The ±10s buttons stay off: the web media session uses them in place of next and previous.
 */
export function lockScreenControls(
  state: {
    shuffle?: boolean;
    repeat?: RepeatModeName;
    durationMs?: number;
    positionOffsetMs?: number;
    accentColor?: string;
    iconColor?: string;
    mutedColor?: string;
  } = {}
): LockScreenControls {
  return {
    showNextTrack: true,
    showPreviousTrack: true,
    showSeekForward: false,
    showSeekBackward: false,
    showShuffle: true,
    showRepeat: true,
    shuffleEnabled: Boolean(state.shuffle),
    repeatMode: state.repeat ?? 'off',
    durationMs: state.durationMs ?? 0,
    positionOffsetMs: state.positionOffsetMs ?? 0,
    accentColor: state.accentColor ?? '',
    iconColor: state.iconColor ?? '',
    mutedColor: state.mutedColor ?? '',
  };
}

/** Same order as the in-app button: off, then the whole queue, then the current item. */
export function cycleRepeatMode(mode: RepeatModeName): RepeatModeName {
  if (mode === 'off') return 'all';
  if (mode === 'all') return 'one';
  return 'off';
}

/** A named remote mode wins. A button with no mode cycles. */
export function repeatModeFromRemote(value: unknown, current: RepeatModeName): RepeatModeName {
  if (value === 'off' || value === 'all' || value === 'one') return value;
  return cycleRepeatMode(current);
}

/** An explicit remote value wins. A button with no value toggles. */
export function shuffleFromRemote(value: unknown, current: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return !current;
}

export function acceptRemoteSkip(lastAt: number, now: number, minGapMs = REMOTE_SKIP_GAP_MS): boolean {
  return now - lastAt >= minGapMs;
}

/**
 * True when the playhead moved in a way playback itself cannot explain.
 * A late tick while the screen is locked moves about as far as the elapsed time.
 */
export function isExternalSeek(input: {
  previousMediaTime: number;
  mediaTime: number;
  elapsedMs: number;
}): boolean {
  const { previousMediaTime, mediaTime, elapsedMs } = input;
  if (!Number.isFinite(previousMediaTime) || !Number.isFinite(mediaTime)) return false;
  const delta = mediaTime - previousMediaTime;
  if (Math.abs(delta) < EXTERNAL_SEEK_SECONDS) return false;
  if (delta > 0) {
    const elapsedSec = Math.max(0, elapsedMs) / 1000;
    if (delta <= elapsedSec + 0.75) return false;
  }
  return true;
}

/** Wall-clock seconds. A transcoded stream's player clock starts at 0 even when opened mid-track. */
export function wallFromPlayerClock(mediaSeconds: number, startOffset: number): number {
  const media = Number.isFinite(mediaSeconds) ? Math.max(0, mediaSeconds) : 0;
  const offset = startOffset > 0.05 ? startOffset : 0;
  return offset + media;
}

export type RemoteSeekDecision = 'ignore' | 'note' | 'reopen';

/**
 * A lock-screen scrub on a transcoded stream has to reopen the file.
 * The system also seeks to 0, or back to the previous item's position, when Next
 * publishes the new duration. Those catch-up seeks must not open another session.
 */
export function classifyRemoteSeek(input: {
  mediaSeconds: number;
  startOffset: number;
  displayPosition: number;
  openedAgoMs: number;
  advancing: boolean;
  suppressed: boolean;
  /** Native playback did not move; JS has to reopen the stream at this position. */
  perform: boolean;
  staleWall?: number | null;
}): RemoteSeekDecision {
  if (input.advancing || input.suppressed) return 'ignore';
  if (!Number.isFinite(input.mediaSeconds)) return 'ignore';
  const wall = wallFromPlayerClock(input.mediaSeconds, input.startOffset);
  if (!Number.isFinite(wall)) return 'ignore';
  if (Math.abs(wall - input.displayPosition) < 2) return 'ignore';
  const ago = input.openedAgoMs;
  if (wall < 1.5 && ago < 8_000) return 'ignore';
  if (
    input.staleWall != null &&
    input.staleWall > 1.5 &&
    Math.abs(wall - input.staleWall) < 2.5 &&
    ago < 8_000
  ) {
    return 'ignore';
  }
  if (ago < 3_000) return 'ignore';
  if (!input.perform) return 'note';
  return 'reopen';
}
