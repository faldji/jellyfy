import { describe, expect, it } from 'vitest';

import {
  acceptRemoteSkip,
  classifyRemoteSeek,
  cycleRepeatMode,
  isExternalSeek,
  lockScreenControls,
  repeatModeFromRemote,
  shuffleFromRemote,
  wallFromPlayerClock,
  type RemoteSeekDecision,
} from '@/playback/remote';

describe('lockScreenControls', () => {
  it('asks for skip, shuffle, and repeat, and leaves the 10 second buttons off', () => {
    expect(lockScreenControls({ shuffle: true, repeat: 'one' })).toMatchObject({
      showNextTrack: true,
      showPreviousTrack: true,
      showSeekForward: false,
      showSeekBackward: false,
      showShuffle: true,
      showRepeat: true,
      shuffleEnabled: true,
      repeatMode: 'one',
    });
  });
});

describe('repeat and shuffle commands', () => {
  it('cycles off, all, one', () => {
    expect(cycleRepeatMode('off')).toBe('all');
    expect(cycleRepeatMode('all')).toBe('one');
    expect(cycleRepeatMode('one')).toBe('off');
  });

  it('uses a named repeat mode and cycles when the button omits one', () => {
    expect(repeatModeFromRemote('one', 'off')).toBe('one');
    expect(repeatModeFromRemote(undefined, 'off')).toBe('all');
  });

  it('uses an explicit shuffle value and toggles when the button omits one', () => {
    expect(shuffleFromRemote(false, true)).toBe(false);
    expect(shuffleFromRemote(undefined, false)).toBe(true);
  });
});

describe('acceptRemoteSkip', () => {
  it('drops a second delivery of the same press', () => {
    expect(acceptRemoteSkip(1_000, 1_100)).toBe(false);
    expect(acceptRemoteSkip(1_000, 1_280)).toBe(true);
  });
});

describe('isExternalSeek', () => {
  it('ignores a normal tick and a late tick that only caught up', () => {
    expect(isExternalSeek({ previousMediaTime: 10, mediaTime: 10.25, elapsedMs: 250 })).toBe(false);
    expect(isExternalSeek({ previousMediaTime: 10, mediaTime: 15, elapsedMs: 5_000 })).toBe(false);
  });

  it('accepts a scrub forward and a scrub backward', () => {
    expect(isExternalSeek({ previousMediaTime: 10, mediaTime: 40, elapsedMs: 250 })).toBe(true);
    expect(isExternalSeek({ previousMediaTime: 40, mediaTime: 8, elapsedMs: 250 })).toBe(true);
  });

  it('ignores noise and non-finite times', () => {
    expect(isExternalSeek({ previousMediaTime: 10, mediaTime: 11, elapsedMs: 50 })).toBe(false);
    expect(isExternalSeek({ previousMediaTime: Number.NaN, mediaTime: 10, elapsedMs: 250 })).toBe(false);
  });
});

describe('classifyRemoteSeek', () => {
  const base = {
    mediaSeconds: 40,
    startOffset: 0,
    displayPosition: 12,
    openedAgoMs: 20_000,
    advancing: false,
    suppressed: false,
    perform: true,
    staleWall: null as number | null,
  };

  function decide(extra: Partial<typeof base> = {}): RemoteSeekDecision {
    return classifyRemoteSeek({ ...base, ...extra });
  }

  it('reopens a transcoded stream for a real scrub', () => {
    expect(decide()).toBe('reopen');
  });

  it('notes a scrub the native player already performed', () => {
    expect(decide({ perform: false })).toBe('note');
  });

  it('ignores a catch-up seek to the start and to the previous item', () => {
    expect(decide({ mediaSeconds: 0, displayPosition: 6, openedAgoMs: 4_000 })).toBe('ignore');
    expect(decide({ mediaSeconds: 90, displayPosition: 2, openedAgoMs: 4_000, staleWall: 90 })).toBe('ignore');
  });

  it('ignores seeks while the new track is still opening', () => {
    expect(decide({ openedAgoMs: 500 })).toBe('ignore');
    expect(decide({ advancing: true })).toBe('ignore');
    expect(decide({ suppressed: true })).toBe('ignore');
    expect(decide({ mediaSeconds: 12.4, displayPosition: 12 })).toBe('ignore');
  });
});

describe('wallFromPlayerClock', () => {
  it('adds the transcode open offset and ignores a negligible one', () => {
    expect(wallFromPlayerClock(12, 60)).toBe(72);
    expect(wallFromPlayerClock(12, 0)).toBe(12);
    expect(wallFromPlayerClock(12, 0.02)).toBe(12);
  });
});
