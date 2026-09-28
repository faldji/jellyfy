import type { PlaybackOrder, PlaybackStartInfo, PlayMethod, RepeatMode } from '@/api/types';

export type PlayingReportKind = 'start' | 'progress';

export function buildPlayingBody(input: {
  kind: PlayingReportKind;
  itemId: string;
  playSessionId: string;
  isPaused: boolean;
  canSeek: boolean;
  positionTicks: number;
  playMethod: PlayMethod;
  repeatMode: RepeatMode;
  playbackOrder: PlaybackOrder;
  queue: { id: string }[];
  /** Shuffle replaces the upcoming order, so that one progress post includes the queue. */
  includeQueue?: boolean;
}): PlaybackStartInfo {
  const body: PlaybackStartInfo = {
    itemId: input.itemId,
    playSessionId: input.playSessionId,
    isPaused: input.isPaused,
    isMuted: false,
    canSeek: input.canSeek,
    positionTicks: input.positionTicks,
    playMethod: input.playMethod,
    repeatMode: input.repeatMode,
    playbackOrder: input.playbackOrder,
  };
  if (input.kind === 'start' || input.includeQueue) {
    body.nowPlayingQueue = input.queue;
  }
  return body;
}
