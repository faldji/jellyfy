import { describe, expect, it } from 'vitest';

import {
  acceptCompletion,
  armCompletion,
  disarmCompletion,
  idleCompletionGate,
  isNativeTrackComplete,
  resolveAutoAdvance,
  resolveUserNext,
  type CompletionGate,
} from '@/playback/advance';

const now = 10_000;

function tryComplete(
  gate: CompletionGate,
  extra: Partial<Parameters<typeof acceptCompletion>[0]> = {}
) {
  return acceptCompletion({
    gate,
    itemId: gate.itemId,
    loadGen: gate.loadGen,
    status: { didJustFinish: true, playbackState: 'ended' },
    now,
    ignoreEndUntil: 0,
    pendingSeek: 0,
    ...extra,
  });
}

describe('isNativeTrackComplete', () => {
  it('accepts didJustFinish and playbackState ended only', () => {
    expect(isNativeTrackComplete({ didJustFinish: true })).toBe(true);
    expect(isNativeTrackComplete({ playbackState: 'ended' })).toBe(true);
    expect(isNativeTrackComplete({ didJustFinish: false, playbackState: 'ready' })).toBe(false);
    expect(isNativeTrackComplete({ didJustFinish: false, playbackState: 'buffering' })).toBe(false);
    expect(isNativeTrackComplete(null)).toBe(false);
  });

  it('does not treat a stalled playhead as completion', () => {
    const nearEnd = { didJustFinish: false, playbackState: 'ready', currentTime: 179.9, duration: 180 };
    expect(isNativeTrackComplete(nearEnd)).toBe(false);
  });
});

describe('completion gate', () => {
  it('advances exactly once on native completion', () => {
    const gate = armCompletion(1, 'track-a');
    const first = tryComplete(gate);
    expect(first.accept).toBe(true);
    expect(first.reason).toBe('accepted');
    const second = tryComplete(first.gate);
    expect(second.accept).toBe(false);
    expect(second.reason).toBe('already-consumed');
  });

  it('duplicate completion events do not skip a track', () => {
    let gate = armCompletion(4, 'a');
    const events = [
      { didJustFinish: true, playbackState: 'ended' },
      { didJustFinish: true, playbackState: 'ended' },
      { didJustFinish: false, playbackState: 'ended' },
    ];
    let accepted = 0;
    for (const status of events) {
      const result = tryComplete(gate, { status });
      gate = result.gate;
      if (result.accept) accepted += 1;
    }
    expect(accepted).toBe(1);
  });

  it('a stale completion from an old track cannot advance the new track', () => {
    const onB = armCompletion(2, 'track-b');
    const staleA = tryComplete(onB, { itemId: 'track-a', loadGen: 1 });
    expect(staleA.accept).toBe(false);
    expect(staleA.reason).toBe('stale-generation');

    const wrongItem = tryComplete(onB, { itemId: 'track-a', loadGen: 2 });
    expect(wrongItem.accept).toBe(false);
    expect(wrongItem.reason).toBe('stale-item');
  });

  it('manual next disarms so automatic completion cannot race a second skip', () => {
    const playingA = armCompletion(1, 'a');
    const afterManual = disarmCompletion(2);
    const autoAfterManual = tryComplete(afterManual, { itemId: 'a', loadGen: 1 });
    expect(autoAfterManual.accept).toBe(false);

    const autoFirst = tryComplete(playingA);
    expect(autoFirst.accept).toBe(true);
    const manualWins = disarmCompletion(playingA.loadGen + 1);
    const duplicateAuto = tryComplete(manualWins, {
      itemId: 'a',
      loadGen: playingA.loadGen,
      status: { didJustFinish: true },
    });
    expect(duplicateAuto.accept).toBe(false);
  });

  it('ignores completion during seek and the post-replace ignore window', () => {
    const gate = armCompletion(1, 'a');
    expect(tryComplete(gate, { pendingSeek: 12 }).accept).toBe(false);
    expect(tryComplete(gate, { now: 100, ignoreEndUntil: 500 }).accept).toBe(false);
    expect(tryComplete(gate, { now: 600, ignoreEndUntil: 500 }).accept).toBe(true);
  });

  it('idle gate never accepts', () => {
    expect(tryComplete(idleCompletionGate(), { itemId: 'a', loadGen: 0 }).accept).toBe(false);
  });
});

describe('resolveAutoAdvance', () => {
  it('queue end stops when repeat is off', () => {
    expect(resolveAutoAdvance({ index: 2, queueLength: 3, repeat: 'off' })).toEqual({
      action: 'stop',
      index: 2,
    });
    expect(resolveAutoAdvance({ index: 0, queueLength: 1, repeat: 'off' })).toEqual({
      action: 'stop',
      index: 0,
    });
  });

  it('repeat-one replays the same index', () => {
    expect(resolveAutoAdvance({ index: 1, queueLength: 4, repeat: 'one' })).toEqual({
      action: 'replay',
      index: 1,
    });
  });

  it('repeat-all wraps from the last track to the first', () => {
    expect(resolveAutoAdvance({ index: 2, queueLength: 3, repeat: 'all' })).toEqual({
      action: 'wrap',
      index: 0,
    });
    expect(resolveAutoAdvance({ index: 0, queueLength: 3, repeat: 'all' })).toEqual({
      action: 'next',
      index: 1,
    });
  });

  it('shuffle follows play order (index into the permutation), not source order', () => {
    const playOrder = ['c', 'a', 'b'];
    const first = resolveAutoAdvance({ index: 0, queueLength: playOrder.length, repeat: 'off' });
    expect(first).toEqual({ action: 'next', index: 1 });
    expect(playOrder[first.index]).toBe('a');
    const last = resolveAutoAdvance({ index: 2, queueLength: playOrder.length, repeat: 'off' });
    expect(last.action).toBe('stop');
  });
});

describe('resolveUserNext', () => {
  it('skips repeat-one so lock-screen next does not replay', () => {
    expect(resolveUserNext({ index: 0, queueLength: 3, repeat: 'one' })).toEqual({
      action: 'next',
      index: 1,
    });
  });

  it('wraps only when repeat-all is on', () => {
    expect(resolveUserNext({ index: 2, queueLength: 3, repeat: 'all' }).action).toBe('wrap');
    expect(resolveUserNext({ index: 2, queueLength: 3, repeat: 'off' }).action).toBe('stop');
  });
});
