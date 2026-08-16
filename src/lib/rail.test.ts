import { describe, expect, it } from 'vitest';

import { canSeeAll, takeRail } from '@/lib/rail';

describe('takeRail', () => {
  it('does not pad when the list is shorter than the cap', () => {
    expect(takeRail(['a', 'b'], 8)).toEqual({ shown: ['a', 'b'], hasMore: false });
  });

  it('caps to the configured limit and reports leftover items', () => {
    expect(takeRail([1, 2, 3, 4], 3)).toEqual({ shown: [1, 2, 3], hasMore: true });
  });

  it('treats a non-positive cap as empty', () => {
    expect(takeRail(['a'], 0).shown).toEqual([]);
    expect(takeRail(['a'], -2).shown).toEqual([]);
  });
});

describe('canSeeAll', () => {
  it('is false when the destination is not larger than the rail', () => {
    expect(canSeeAll(2, 8)).toBe(false);
    expect(canSeeAll(8, 8)).toBe(false);
    expect(canSeeAll(10, 0)).toBe(false);
  });

  it('is true only when the destination has more than what the rail shows', () => {
    expect(canSeeAll(12, 8)).toBe(true);
  });
});
