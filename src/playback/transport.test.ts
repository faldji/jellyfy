import { describe, expect, it } from 'vitest';

import { playheadLooksStuckAtEnd } from '@/playback/transport';

describe('playheadLooksStuckAtEnd', () => {
  it('treats a leftover position as stuck and a real start as not stuck', () => {
    expect(playheadLooksStuckAtEnd(42, 200, 0)).toBe(true);
    expect(playheadLooksStuckAtEnd(1.8, 2_000, 0)).toBe(false);
    expect(playheadLooksStuckAtEnd(0.4, 100, 0)).toBe(false);
    expect(playheadLooksStuckAtEnd(42, 200, 30)).toBe(false);
  });
});
