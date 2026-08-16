import { describe, expect, it } from 'vitest';

import type { BaseItem } from '@/api/types';
import { isAudio, isCollectionItem, isItemActive } from '@/lib/media';

const artist = (id: string): BaseItem => ({
  id,
  type: 'MusicArtist',
  mediaType: 'Audio',
  name: 'Artist',
});

const album = (id: string): BaseItem => ({
  id,
  type: 'MusicAlbum',
  mediaType: 'Audio',
  name: 'Album',
});

const song = (id: string, extra?: Partial<BaseItem>): BaseItem => ({
  id,
  type: 'Audio',
  mediaType: 'Audio',
  name: 'Song',
  ...extra,
});

describe('isAudio / isCollectionItem', () => {
  it('does not treat artists or albums as playable streams', () => {
    expect(isCollectionItem(artist('a'))).toBe(true);
    expect(isCollectionItem(album('b'))).toBe(true);
    expect(isAudio(artist('a'))).toBe(false);
    expect(isAudio(album('b'))).toBe(false);
    expect(isAudio(song('t'))).toBe(true);
  });
});

describe('isItemActive', () => {
  it('does not mark an artist active just because another track is playing', () => {
    const current = song('t1', { albumArtists: [{ id: 'a1', name: 'A' }] });
    expect(isItemActive(artist('a1'), current, 'library')).toBe(false);
    expect(isItemActive(artist('a1'), current, 'a1')).toBe(true);
  });

  it('still matches an album to the current track', () => {
    const current = song('t1', { albumId: 'al1' });
    expect(isItemActive(album('al1'), current, 'library')).toBe(true);
    expect(isItemActive(album('al2'), current, 'library')).toBe(false);
  });
});
