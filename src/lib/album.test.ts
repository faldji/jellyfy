import { describe, expect, it } from 'vitest';

import type { BaseItem } from '@/api/types';
import { albumTrackNumber, groupAlbumDiscs } from '@/lib/album';

const track = (partial: Partial<BaseItem> & { id: string }): BaseItem => ({
  type: 'Audio',
  ...partial,
});

describe('albumTrackNumber', () => {
  it('prefers the Jellyfin index over list position', () => {
    expect(albumTrackNumber({ indexNumber: 7 }, 0)).toBe(7);
    expect(albumTrackNumber({}, 2)).toBe(3);
    expect(albumTrackNumber({})).toBeNull();
  });
});

describe('groupAlbumDiscs', () => {
  it('keeps a single disc as one group', () => {
    const groups = groupAlbumDiscs([
      track({ id: '1', indexNumber: 1 }),
      track({ id: '2', indexNumber: 2 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.disc).toBe(1);
    expect(groups[0]?.tracks).toHaveLength(2);
  });

  it('splits multi-disc albums in disc order', () => {
    const groups = groupAlbumDiscs([
      track({ id: 'a', parentIndexNumber: 2, indexNumber: 1 }),
      track({ id: 'b', parentIndexNumber: 1, indexNumber: 1 }),
      track({ id: 'c', parentIndexNumber: 1, indexNumber: 2 }),
    ]);
    expect(groups.map((group) => group.disc)).toEqual([1, 2]);
    expect(groups[0]?.tracks.map((item) => item.id)).toEqual(['b', 'c']);
    expect(groups[1]?.tracks.map((item) => item.id)).toEqual(['a']);
  });
});
