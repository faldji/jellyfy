import { describe, expect, it } from 'vitest';

import { buildPlayingBody } from '@/playback/report';

describe('buildPlayingBody', () => {
  const base = {
    itemId: 't1',
    playSessionId: 'p1',
    isPaused: false,
    canSeek: true,
    positionTicks: 10,
    playMethod: 'DirectPlay' as const,
    repeatMode: 'RepeatNone' as const,
    playbackOrder: 'Default' as const,
    queue: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
  };

  it('includes the queue on start and on a shuffle update, not on a periodic progress', () => {
    const start = buildPlayingBody({ ...base, kind: 'start' });
    const progress = buildPlayingBody({ ...base, kind: 'progress' });
    const shuffled = buildPlayingBody({ ...base, kind: 'progress', includeQueue: true });
    expect(start.nowPlayingQueue).toEqual(base.queue);
    expect(progress.nowPlayingQueue).toBeUndefined();
    expect(shuffled.nowPlayingQueue).toEqual(base.queue);
  });

  it('keeps start and progress item ids independent so a late progress cannot retarget a new track', () => {
    const startA = buildPlayingBody({ ...base, kind: 'start', itemId: 'a', playSessionId: 's-a' });
    const progressB = buildPlayingBody({
      ...base,
      kind: 'progress',
      itemId: 'b',
      playSessionId: 's-b',
    });
    expect(startA.itemId).toBe('a');
    expect(startA.playSessionId).toBe('s-a');
    expect(progressB.itemId).toBe('b');
    expect(progressB.playSessionId).toBe('s-b');
    expect(progressB.nowPlayingQueue).toBeUndefined();
  });
});
