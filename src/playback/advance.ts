/** Pure end-of-track / queue-advance helpers. No timers, no position stall. */

export type RepeatModeUi = 'off' | 'all' | 'one';

export type CompletionGate = {
  loadGen: number;
  itemId: string | null;
  consumed: boolean;
};

export type NativePlaybackSignal = {
  didJustFinish?: boolean;
  playbackState?: string;
  isLoaded?: boolean;
  playing?: boolean;
  currentTime?: number;
  duration?: number;
};

export type AutoAdvanceAction = 'replay' | 'next' | 'wrap' | 'stop';

export type AutoAdvance = {
  action: AutoAdvanceAction;
  index: number;
};

export function idleCompletionGate(): CompletionGate {
  return { loadGen: 0, itemId: null, consumed: true };
}

/** Arm after a new source is loaded so only that generation may complete. */
export function armCompletion(loadGen: number, itemId: string | null): CompletionGate {
  if (!itemId) return { loadGen, itemId: null, consumed: true };
  return { loadGen, itemId, consumed: false };
}

/** Manual skip / replace: a stale native complete must not move the new track. */
export function disarmCompletion(loadGen: number): CompletionGate {
  return { loadGen, itemId: null, consumed: true };
}

/**
 * Explicit native completion is preferred. Android can occasionally stop at the
 * final position without exposing a reliable didJustFinish/playbackState signal,
 * so a loaded finite track that is no longer playing at its end is also treated
 * as complete.
 */
export function isNativeTrackComplete(status: NativePlaybackSignal | null | undefined): boolean {
  if (!status) return false;
  if (status.didJustFinish || status.playbackState === 'ended') return true;
  const duration = Number(status.duration ?? 0);
  const position = Number(status.currentTime ?? 0);
  return Boolean(
    status.isLoaded &&
      !status.playing &&
      Number.isFinite(duration) &&
      duration > 1 &&
      Number.isFinite(position) &&
      position >= duration - 0.35
  );
}

export function acceptCompletion(input: {
  gate: CompletionGate;
  itemId: string | null;
  loadGen: number;
  status: NativePlaybackSignal | null | undefined;
  now: number;
  ignoreEndUntil: number;
  pendingSeek: number;
}): { accept: boolean; gate: CompletionGate; reason: string } {
  const { gate } = input;
  if (!isNativeTrackComplete(input.status)) {
    return { accept: false, gate, reason: 'not-native-complete' };
  }
  if (input.pendingSeek > 0.05) {
    return { accept: false, gate, reason: 'pending-seek' };
  }
  if (input.now < input.ignoreEndUntil) {
    return { accept: false, gate, reason: 'ignore-end-until' };
  }
  if (gate.consumed) {
    return { accept: false, gate, reason: 'already-consumed' };
  }
  if (input.loadGen !== gate.loadGen) {
    return { accept: false, gate, reason: 'stale-generation' };
  }
  if (!input.itemId || !gate.itemId || input.itemId !== gate.itemId) {
    return { accept: false, gate, reason: 'stale-item' };
  }
  return { accept: true, gate: { ...gate, consumed: true }, reason: 'accepted' };
}

export function resolveAutoAdvance(input: {
  index: number;
  queueLength: number;
  repeat: RepeatModeUi;
}): AutoAdvance {
  const { index, queueLength, repeat } = input;
  if (queueLength <= 0 || index < 0) return { action: 'stop', index: -1 };
  if (repeat === 'one') return { action: 'replay', index };
  if (index < queueLength - 1) return { action: 'next', index: index + 1 };
  if (repeat === 'all') return { action: 'wrap', index: 0 };
  return { action: 'stop', index };
}

/** Lock-screen / headset next: skip even when repeat-one is on. */
export function resolveUserNext(input: {
  index: number;
  queueLength: number;
  repeat: RepeatModeUi;
}): AutoAdvance {
  const { index, queueLength, repeat } = input;
  if (queueLength <= 0 || index < 0) return { action: 'stop', index: -1 };
  if (index < queueLength - 1) return { action: 'next', index: index + 1 };
  if (repeat === 'all') return { action: 'wrap', index: 0 };
  return { action: 'stop', index };
}
